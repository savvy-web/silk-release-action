---
title: Release Action Architecture
category: architecture
status: current
completeness: 95
created: 2026-02-07
updated: 2026-05-22
last-synced: 2026-05-22
module: release-action
related:
  - integration.md
  - testing.md
dependencies: []
---

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
  - [Entry Points](#entry-points)
  - [Phase Detection](#phase-detection)
  - [Phase 1: Release Branch Management](#phase-1-release-branch-management)
  - [Phase 2: Release Validation](#phase-2-release-validation)
  - [Phase 3: Release Publishing](#phase-3-release-publishing)
  - [Phase 3a: Issue Closing](#phase-3a-issue-closing)
  - [Post-Release Housekeeping (out of action)](#post-release-housekeeping-out-of-action)
  - [Module Dependency Graph](#module-dependency-graph)
  - [Shared Infrastructure](#shared-infrastructure)
  - [Schema Layer](#schema-layer)
  - [Type System](#type-system)
- [Rationale](#rationale)
  - [Why Three Phases?](#why-three-phases)
  - [Why API Commits?](#why-api-commits)
  - [Why Recreate vs Rebase?](#why-recreate-vs-rebase)
  - [Why a Five-Step Phase-3 Flow?](#why-a-five-step-phase-3-flow)
  - [Why Pack Once per Directory?](#why-pack-once-per-directory)
  - [Why Step.failure Is Non-Throwing?](#why-stepfailure-is-non-throwing)
  - [Why a Silk-Specific Publishability Helper?](#why-a-silk-specific-publishability-helper)
- [Key Design Patterns](#key-design-patterns)
  - [Step-Buffered Logging](#step-buffered-logging)
  - [State Management](#state-management)
  - [Error Handling Strategy](#error-handling-strategy)
  - [GitHub API Usage](#github-api-usage)
  - [Dry-Run Mode](#dry-run-mode)
- [File Reference](#file-reference)

## Overview

The `silk-release-action` is a TypeScript GitHub Action implementing a three-phase automated release workflow for monorepos and single-package repositories using changesets. It runs as a Node.js 24 action (`runs.using: node24`) with `pre`, `main`, and `post` lifecycle hooks, declared in `action.yml`.

The action automates the full release lifecycle: detecting pending changes, managing a release branch and PR, validating builds and registry readiness, publishing to multiple registries (npm, JSR, GitHub Packages, custom), creating Git tags and GitHub releases with attestations, and closing linked issues. All operations produce GitHub Check Runs for rich CI feedback and post sticky comments on the release PR for at-a-glance status.

Phase 3 is a pure Effect orchestration built on `@savvy-web/github-action-effects@2.0.0` library services. Phases 1 and 2 remain as a mix of Effect entry points (entry-point scripts, `src/release/validation.ts`) and imperative utility modules. The library ships the `Attest` and `Sbom` services, eliminating the old `src/services/attest/` directory entirely. The 2.0 layer shape changed the contracts this action adopts: `GitHubAppLive` and `ActionCacheLive` now require `HttpClient.HttpClient` (provided via `FetchHttpClient.layer`) and secret-bearing APIs take or decode to `Redacted<string>` (see [State Management](#state-management)).

## Current State

### Entry Points

Three lifecycle scripts correspond to the GitHub Actions `pre`, `main`, and `post` execution stages. All three are full Effect programs run via `Action.run` from `@savvy-web/github-action-effects`:

- **`src/pre.ts`** — Pre-action setup. Provisions a GitHub App installation token via `GitHubToken.provision()` using the `app-client-id` and `app-private-key` inputs. `provision` persists the `InstallationToken` envelope (token, expiry, installation ID, and resolved App identity) to `ActionState` under an internal key; under 2.0 the `InstallationToken.token` field decodes to `Redacted<string>`. Also records the optional `github-token` input to `GithubPackagesTokenState` in `src/state.ts`. Failures here abort the workflow. The `PreLive` layer composes `GitHubAppLive` over `OctokitAuthAppLive` plus `NodeFileSystem.layer`; because 2.0's `GitHubAppLive` requires `HttpClient.HttpClient`, both `pre.ts` and `post.ts` provide `FetchHttpClient.layer`.
- **`src/main.ts`** — Main orchestrator. Auto-detects the package manager via `detectRepoType()`, reads action inputs, retrieves the token via `GitHubToken.client()`, and calls `detectWorkflowPhase()` to determine which phase to run. Routes execution to one of four phase handlers. Each phase emits its results through the `ReleaseOutput` schema (see `src/schema/`).
- **`src/post.ts`** — Post-action cleanup. Logs total execution duration, then conditionally revokes the GitHub App installation token via `GitHubToken.dispose()`. Errors are emitted as warnings so they never fail the overall workflow.

Input renames from the `github-action-effects` 1.1.0 migration: `app-id` → `app-client-id`, `private-key` → `app-private-key`.

### Phase Detection

**`detect-workflow-phase.ts`**

The phase router determines which phase to execute based on GitHub event context. It exports both an async version (with API calls for release commit detection) and a synchronous lightweight version for quick checks.

Detection priority order:

1. **Explicit phase** — If the `phase` input is provided, skip detection and use it directly. This supports the `silk-router-action` pattern where phase is pre-determined.
2. **Phase 3a (close-issues)** — `pull_request` event where the release PR (`changeset-release/main` to `main`) was merged. Detected from event payload without API calls.
3. **Phase 3 (publishing)** — Push to main with a release commit. Detection uses a two-strategy approach with retry logic: primary queries `listPullRequestsAssociatedWithCommit`; fallback queries recently closed PRs from the release branch and matches `merge_commit_sha`. 3 attempts with 5-second delays handle GitHub API eventual consistency.
4. **Phase 2 (validation)** — Push to the release branch (`changeset-release/main`).
5. **Phase 1 (branch-management)** — Push to main that is not a release commit.
6. **None** — Any other branch or event. Logs a skip message and exits.

### Phase 1: Release Branch Management

Triggers on push to `main` (non-release commits). Phase 1 is rewired onto the `ChangesetAnalyzer` service from `@savvy-web/github-action-effects` (replacing the old `get-changeset-status.ts` module). Publishability detection now flows through `PublishabilityDetectorAdaptiveLive` from `src/release/publishability.ts` (which delegates to the silk rules in silk mode). The remaining utility modules are:

- **`check-release-branch.ts`** — Checks whether the `changeset-release/main` branch exists and whether an open PR exists from that branch to the target branch.
- **`create-release-branch.ts`** — Creates a new branch from `origin/{targetBranch}`, runs the changeset version command, creates a signed API commit (see `create-api-commit.ts`), links issues found in changeset files via GraphQL mutations, and opens a PR with standard labels. The PR title and commit subject are resolved from the releasing packages via `release-summary-helpers.ts` (see [Release PR and commit titles](#release-pr-and-commit-titles)).
- **`update-release-branch.ts`** — Recreates the branch from main rather than rebasing. Collects linked issues from changesets before running the version command. Creates an API commit with the main branch HEAD as parent. Handles PR reopening if the branch was previously deleted. Uses the same title/commit-subject resolution as `create-release-branch.ts`.

#### Release PR and commit titles

Both branch-management modules resolve the PR title and the commit subject from the packages that will release, using helpers in `release-summary-helpers.ts`. The flow is: `listPublishablePackages` (an Effect over `WorkspaceDiscovery` + `PublishabilityDetector`, so it already honors the changeset `ignore` list and the silk rules) → `getReleasingPackages` (the subset whose `package.json` changed in this version bump) → `resolveReleasePrTitle`. `formatReleasePackageList` renders the commit body. The per-package-versioning signal comes from `yield* isMonorepoForTagging(process.cwd())` (Effect-based, resolved through the same detector plus `ChangesetConfig.fixed`).

The title format keys off versioning topology rather than how many packages release this run. `resolveReleasePrTitle` takes `perPackageVersioning`, which is the same signal as `isMonorepoForTagging` so the PR title and the git tag strategy stay aligned:

- `perPackageVersioning === false` (a single releasable package, or a fixed group sharing one version) → `release: <version>`, mirroring the commit title.
- `perPackageVersioning === true` (multiple packages on independent versions) → `release: name@version, …` listing the releasing packages, even when only one releases. The shared npm scope is omitted when every releasable package is under one scope (mixed scopes keep full names), and the list collapses to `release: <count> packages` past `RELEASE_TITLE_MAX_LENGTH` (100).
- Nothing releasing in a single-package repo → the root `package.json` version; otherwise the configured `pr-title-prefix`.

The commit subject matches the PR title; the commit body is a bullet list of full (scoped) `name@version` from `formatReleasePackageList`, so the commit is an unambiguous record even when the title omits a shared scope. See `src/utils/release-summary-helpers.ts` for the resolution logic.

### Phase 2: Release Validation

Triggers on push to the release branch. Creates all validation Check Runs upfront for immediate visibility. Phase 2 now routes through `src/release/validation.ts` (`runValidation`) — a pure Effect program — rather than a chain of imperative utility modules.

**`src/release/validation.ts`** (`runValidation`) — Enumerates workspace packages, diffs versions against the target branch to discover which packages are being released (`detectReleasedPackages` drops changeset-ignored names entirely via `ChangesetConfig.isIgnored`, so they never appear, not even as version-only rows), resolves publish targets via `resolvePublishableTargets` (the `PublishabilityDetectorAdaptiveLive` seam), groups targets by build directory, runs `PackagePublish.dryRun` per build directory, generates one SBOM per build directory via the `Sbom` service, applies `sbom-config` metadata, and assembles a `ValidationReport`. The report is build-centric: `ValidationPackageResult` carries builds, sizes, SBOMs, and registry targets. `strict-warnings` mode escalates warning-severity findings to `failure` for auto-merge gating.

Phase 2 emits three per-step Check Runs — `Publish Validation`, `Release Notes Preview` and `SBOM Preview`. Their titles carry no decorative leading icons (the older `📦`/`📋`/`🔏` markers were removed); the only title decoration is the `🧪` marker prepended in dry-run mode (see [Dry-Run Mode](#dry-run-mode)).

The remaining Phase-2 imperative modules handle check-run lifecycle:

- **`validate-builds.ts`** — Runs the build command and parses stdout/stderr for TypeScript errors and generic error patterns.
- **`link-issues-from-commits.ts`** — Gets commits since the last release tag and extracts issue references.
- **`create-validation-check.ts`** — Creates a unified Check Run aggregating all validation steps.
- **`update-sticky-comment.ts`** — Posts or updates a PR comment using an HTML marker for idempotent updates.
- **`cleanup-validation-checks.ts`** — On workflow failure, marks any incomplete Check Runs as failed.
- **`extract-release-notes.ts`** — Extracts the first-H2-to-second-H2 CHANGELOG section for the new version.
- **`count-changesets.ts`** — Counts changesets per package.
- **`derive-check-conclusion.ts`** — Derives a GitHub check-run conclusion from findings with `strict-warnings` support.

### Phase 3: Release Publishing

Triggers on merge of the release PR to main. Phase 3 is a pure Effect orchestration in `src/release/`. The old imperative modules (`publish-packages.ts`, `create-github-releases.ts`, `create-attestation.ts`, `attest-runner.ts`, `detect-released-packages.ts`, `generate-publish-summary.ts`, `registry-auth.ts`, `resolve-targets.ts`, `topological-sort.ts`, `pre-validate-target.ts`, `dry-run-publish.ts`, `registry-utils.ts`, `logger.ts`, and others) are all deleted.

`main.ts` calls the five Phase-3 steps in sequence:

1. **`detectReleases`** (`src/release/publish.ts`) — Detects released packages from the merged PR's file diff (PR-first) or commit diff (fallback), then drops changeset-ignored names entirely via `ChangesetConfig.isIgnored`. Wrapped in `Step.withStep`.
2. **`runBuildAndSbom`** (`src/release/publish.ts`) — Runs `ci:build` once, then generates one CycloneDX SBOM per package via `Sbom.generate`. Aborts the phase if the build fails. Returns `BuildSbomResult` including per-package SBOM paths.
3. **`runPublishTargets`** (`src/release/publish.ts`) — Publishes packages. Discovers workspace packages, resolves publish targets via `PublishabilityDetector`, sorts topologically via `TopologicalSorter`, and calls `publishDirectoryGroup` for each unique build directory. The publish orchestrator aborts before any releases if fewer than half the targets published (i.e., N/2 or 0/N).
4. **`runReleases`** (`src/release/releases.ts`) — Creates Git tags (sha-aware idempotency) and GitHub releases, uploads SBOM and tarball assets, creates SLSA provenance and SBOM attestations (idempotent: checks `Attest.listForSubject` before writing). One attestation per build directory, not per target.
5. **`buildPublishSummary`** (`src/release/report.ts`) — Generates the sticky-comment publish summary and Check Run output.

The `determine-tag-strategy.ts` utility (still in `src/utils/`) decides between single-tag and per-package tag strategies and runs between steps 3 and 4. `main.ts` resolves the per-package-tags boolean via `yield* isMonorepoForTagging(process.cwd())` (Effect, through the single detector + `ChangesetConfig.fixed`) and passes it to the pure `determineTagStrategy(publishResults, needsPerPackageTags)`.

#### `publishDirectoryGroup` three-way probe-then-decide

For each npm target in a directory group:

1. **Pack once** — `PackagePublish.pack(directory)` runs once for the group; the same tarball (same digest) is used for all targets.
2. **Auth setup** — `PackagePublish.setupAuth` (which takes a `Redacted<string>` token under 2.0) writes the token to `~/.npmrc` before the probe so authenticated registries (e.g. GitHub Packages) can be probed. `PackagePublishLive` now requires `ActionOutputs` so it can mask the registry token via `setSecret`.
3. **Probe** — `NpmRegistry.getPublishedIntegrity` checks whether the version is already on the registry.
4. **Decide** — Three outcomes, each rendered with the correct icon:
   - Version absent → publish tarball → `Step.success("published")`
   - Version present, digest matches → recovery skip → `Step.success("skipped-identical (recovery)")`
   - Version present, digest mismatch → abort → `Step.failure("failed-mismatch")`
5. **Attestation** — After all targets in the group are resolved, `runAttestations` checks `Attest.listForSubject` for existing provenance and SBOM attestations; writes fresh ones only if absent.

#### Abort-before-releases gate

After `runPublishTargets`, `main.ts` checks whether the publish results warrant creating GitHub releases. The rule: if fewer than half the targets published (i.e., every target failed or was mismatched), the release step is skipped and the workflow fails. A fully-recovered run (all targets were `skipped-identical`) proceeds to release creation normally.

### Phase 3a: Issue Closing

**`close-linked-issues.ts`** — Queries the merged PR's `closingIssuesReferences` via GraphQL (up to 50 issues). For each linked issue, posts a comment noting the release and closes the issue. Creates a Check Run summarizing results.

### Post-Release Housekeeping (out of action)

The published GitHub release this phase creates is consumed by a **repo-local workflow**, not by the action itself: `.github/workflows/release-sync.yml` listens on `release: [published]` and, for stable SemVer `>= 1.0.0` tags, moves the `v<major>` alias tag to the released commit and hard-resets `dev` to `main`. See **CLAUDE.md → Development & Release Cycle** for the full `dev → main → release` loop.

### Module Dependency Graph

Key dependency flows:

```text
main.ts
  |
  +-- detect-workflow-phase.ts (routing)
  |
  +-- Phase 1 chain:
  |     ChangesetAnalyzer (library service, replaces get-changeset-status)
  |     check-release-branch.ts
  |     create-release-branch.ts
  |       +-- create-api-commit.ts
  |       +-- parse-changesets.ts
  |       +-- release-summary-helpers.ts (listPublishablePackages, getReleasingPackages)
  |       +-- determine-tag-strategy.ts (isMonorepoForTagging)
  |         +-- release/publishability.ts (PublishabilityDetectorAdaptiveLive)
  |         +-- release/changeset-config.ts (ChangesetConfig service)
  |     update-release-branch.ts
  |       +-- create-api-commit.ts
  |       +-- parse-changesets.ts
  |       +-- detect-repo-type.ts
  |       +-- release-summary-helpers.ts (listPublishablePackages, getReleasingPackages)
  |       +-- determine-tag-strategy.ts (isMonorepoForTagging)
  |
  +-- Phase 2 chain:
  |     link-issues-from-commits.ts
  |     validate-builds.ts
  |     release/validation.ts (runValidation — Effect, all-in-one)
  |       +-- release/resolve-targets.ts (resolvePublishableTargets seam)
  |       +-- release/publishability.ts (PublishabilityDetectorAdaptiveLive)
  |       +-- release/changeset-config.ts (ChangesetConfig service)
  |       +-- infer-sbom-metadata.ts
  |       +-- load-release-config.ts
  |       +-- count-changesets.ts
  |       +-- extract-release-notes.ts
  |       +-- validate-ntia-compliance.ts
  |       +-- PackagePublish.dryRun (library service)
  |       +-- Sbom.generate (library service)
  |     release/report.ts (buildValidationComment, buildChecksTable, …)
  |     create-validation-check.ts + derive-check-conclusion.ts
  |     update-sticky-comment.ts
  |     cleanup-validation-checks.ts
  |
  +-- Phase 3 chain (all Effect):
  |     release/publish.ts
  |       detectReleases → GitHubContent / PullRequest / GitHubCommit +
  |                        ChangesetConfig (isIgnored filter)
  |       runBuildAndSbom → CommandRunner + Sbom (library services)
  |       runPublishTargets → WorkspaceDiscovery + PublishabilityDetector +
  |                           TopologicalSorter + PackagePublish + NpmRegistry +
  |                           Attest (library services)
  |     determine-tag-strategy.ts (between publish and releases)
  |       isMonorepoForTagging → WorkspaceDiscovery + PublishabilityDetector + ChangesetConfig.fixed
  |       determineTagStrategy (pure; needsPerPackageTags computed at main.ts boundary)
  |     release/releases.ts
  |       runReleases → GitHubRelease + GitTag + GitHubArtifactMetadata +
  |                     Attest + OidcTokenIssuer (library services)
  |     release/report.ts (buildPublishSummary, buildReleaseNotesPreviewSummary, …)
  |     release/layers.ts
  |       ReleaseLive = WorkspacesLive + ChangesetConfigLive + PublishabilityDetectorAdaptiveLive
  |
  +-- Phase 3a:
  |     close-linked-issues.ts
  |
  +-- Cross-cutting:
        create-api-commit.ts (Phase 1)
          +-- commit-signoff.ts (DCO trailer)
        release-summary-helpers.ts (Phase 1: PR/commit titles; Phase 3: tag strategy via listPublishablePackages)
        determine-tag-strategy.ts (Phase 1 + Phase 3: isMonorepoForTagging via the single detector)
        tokens.ts (still used by Phase 2 build validation context)
        summary-writer.ts (all phases)
        schema/release-output.ts + schema/projections.ts (all phases, output)
        schema/silk-release-config.ts (Phase 2: sbom-config decoding)
```

### Shared Infrastructure

- **`summary-writer.ts`** — Type-safe markdown generation using `ts-markdown`. Provides methods for tables, key-value tables, bulleted lists, headings, code blocks, and multi-section document building. Writes to the GitHub Actions job summary.

- **`create-api-commit.ts`** — Creates Git commits via the GitHub REST API (blob, tree, commit, ref update). Produces automatically GPG-signed commits when authenticated as a GitHub App. Used by both `create-release-branch.ts` and `update-release-branch.ts`.

- **`tokens.ts`** — Two exported helpers for the (non-Effect) publish chain context. `appToken()` returns the GitHub App installation token from `ActionState`. `packagesToken()` prefers the workflow `github-token` and falls back to the App token.

- **`commit-signoff.ts`** — Resolves the DCO `Signed-off-by` trailer for action-created commits. Reads the App bot identity via `GitHubToken.botIdentity()` and falls back to `github-actions[bot]` when unavailable.

- **`detect-repo-type.ts`** — Detects whether the repository is a monorepo or single-package repo. Auto-detects the package manager from `package.json`. Reads changeset configuration for ignore patterns and private package handling. Exports `matchesIgnorePattern(name, pattern)` (exact and `@scope/*` wildcard), the shared matcher behind `ChangesetConfig.isIgnored`.

- **`release-summary-helpers.ts`** — Release-title and package-listing helpers built on the single `PublishabilityDetector`. `listPublishablePackages(root)` is an Effect over `WorkspaceDiscovery` + `PublishabilityDetector` (so it inherits changeset-ignore and silk-rule handling); `getReleasingPackages`, `resolveReleasePrTitle` and `formatReleasePackageList` are pure. This replaced the parallel synchronous reimplementation of the silk rules (the deleted `getAllWorkspacePackages` / `getPublishablePackages` / `isPublishablePackage` / `computeTargetCount`). Consumed by Phase 1 (PR/commit titles) and Phase 3 tag strategy.

- **`parse-changesets.ts`** — Parses changeset YAML frontmatter from `.changeset/*.md` files. Extracts package names, bump types, and summary descriptions. Used during branch creation to link issues.

- **`determine-tag-strategy.ts`** — Decides between single-tag (`v1.0.0`) for single-package repos and per-package tags (`@scope/pkg@1.0.0`) for independent monorepo versioning. `isMonorepoForTagging(root)` is Effect-based, resolving the publishable set through `listPublishablePackages` (the single detector) plus `ChangesetConfig.fixed`; `determineTagStrategy(publishResults, needsPerPackageTags)` is pure — the caller computes the boolean at the `main.ts` boundary and passes it in.

- **`extract-release-notes.ts`** — Extracts a CHANGELOG section from first-H2 to second-H2 for a given version. Used by Phase 2 validation and Phase 3 release creation.

- **`count-changesets.ts`** — Counts changesets per package. Used by Phase 2 validation.

- **`derive-check-conclusion.ts`** — Derives a GitHub check-run conclusion (`success` | `failure` | `neutral`) from structured `ValidationFinding` arrays. Supports `strict-warnings` escalation.

- **`infer-sbom-metadata.ts`** — Infers SBOM metadata from `package.json` fields (license, author, repository, homepage).

- **`validate-ntia-compliance.ts`** — Validates SBOMs against the 7 NTIA minimum elements.

- **`load-release-config.ts`** — Layered config loading (repo file, action input, env var) for SBOM metadata. Now decodes through `SilkReleaseConfig` schema from `src/schema/silk-release-config.ts`.

- **`detect-copyright-year.ts`** — Detects copyright year ranges from LICENSE files, existing copyright notices, and git history.

### Schema Layer

The `src/schema/` directory contains the structured output contract and input config schema.

- **`src/schema/release-output.ts`** — Defines `ReleaseOutput` as a `Schema.Union` of three phase structs discriminated by the `phase` literal: `BranchManagementOutput`, `ValidationOutput`, `PublishingOutput`. Each struct carries orthogonal machine flags (`noop`, `succeeded`, `hasFailures`) plus a derived human-readable `status`. The action emits a Schema-encoded instance as the single `result` action output plus five scalar mirrors (`phase`, `status`, `succeeded`, `package-count`, `release-pr-number`). Action manifest outputs collapsed from ~22 to 9 total.
- **`src/schema/projections.ts`** — Three pure projection functions (`toBranchManagementOutput`, `toValidationOutput`, `toPublishingOutput`). Each takes an explicit input interface as the deliberate seam between internal pipeline types and the published contract.
- **`src/schema/silk-release-config.ts`** — `SilkReleaseConfig` Effect schema for the `sbom-config` action input (and `.github/silk-release.json`). The `INPUT_SCHEMA_URL` constant points to the hosted JSON Schema at the `savvy-web/silk-release-action` rename target.

Two JSON Schema artifacts at repo root are generated from these schemas: `silk-release-action.input.schema.json` and `silk-release-action.output.schema.json`. Both carry `$id` URLs pointing to `raw.githubusercontent.com/savvy-web/silk-release-action/main/`.

### Type System

- **`src/release/types.ts`** — Stable type home for publish-chain result shapes: `TargetPublishResult`, `PackagePublishResult`, `PublishPackagesResult`, `ValidationFinding`, `ValidationFindingScope`, `ValidationPackageResult`, `PackageBuildResult`, `BuildTargetResult`, `BuildSbom`, `ReleaseInfo`, `AssetInfo`. The three-way `TargetPublishResult.status` (`"published" | "skipped" | "failed"`) is the canonical publish outcome; `success: boolean` is a backward-compat projection.
- **`src/types/publish-config.ts`** — Comprehensive type definitions for the multi-registry publishing system: `PublishTarget`, `ResolvedTarget`, `PublishResult`, `AuthSetupResult`, `PrePackedTarball` and related types.
- **`src/types/shared-types.ts`** — Shared interfaces used across modules: `ValidationResult` and `PackageValidationResult`.
- **`src/types/sbom-config.ts`** — Type definitions for SBOM configuration: `SBOMConfig`, `EnhancedCycloneDXDocument`, NTIA compliance types, and supplier/copyright metadata types.
- **`src/types/global.d.ts`** — Global type augmentations for Vitest testing globals.

## Rationale

### Why Three Phases?

The three-phase approach separates concerns by execution context:

1. **Branch management** runs on every push to main. It is fast (no builds) and creates/updates the release PR as a staging area.
2. **Validation** runs on the release branch. Build compilation, dry-run publishing, and SBOM generation can be slow without blocking pushes to main. The release PR provides a visible gate for review.
3. **Publishing** only runs after the release PR is merged. This gating ensures human approval before packages reach registries.

This separation also means that validation failures never block development on main, and publishing failures are isolated from the validation context.

### Why API Commits?

Using the GitHub REST API to create commits instead of `git push` provides:

- **Automatic GPG signing**: Commits created by a GitHub App are automatically signed and marked as "verified" in the GitHub UI.
- **Atomic operations**: Branch creation and commit happen as API calls, avoiding race conditions with concurrent pushes.
- **No git credentials on runner**: The runner never needs git push access — only the API token is used.
- **DCO compliance**: The commit message can include a `Signed-off-by` footer.

### Why Recreate vs Rebase?

The `update-release-branch.ts` module recreates the release branch from main instead of performing a `git rebase`. The release branch contains only machine-generated changes (changeset version bumps and CHANGELOG updates). Recreation is atomic; there is never a reason to preserve manual commits on it.

### Why a Five-Step Phase-3 Flow?

Phase 3 is split into `detectReleases` → `runBuildAndSbom` → `runPublishTargets` → `runReleases` → summary to enforce fail-fast gating at each boundary:

- Build failure aborts before any tarball is created.
- Publish failure of more than half the targets aborts before GitHub releases are created, preventing a release that references versions which are not fully on registries.
- Attestation failures are non-fatal so a single OIDC hiccup does not roll back the entire release.

### Why Pack Once per Directory?

When publishing to multiple registries, the action packs the tarball once and reuses it for all targets. This ensures every registry receives identical content with the same SHA-256 digest. This is critical for attestation — provenance attestations reference a specific digest, so all targets must share the same tarball.

### Why Step.failure Is Non-Throwing?

`@savvy-web/github-action-effects` introduced `Step.failure` as a non-throwing primitive. Unlike an Effect failure (which short-circuits), `Step.failure(label)` renders `❌ label` and spills the buffered step output to the log, but the Effect value continues propagating normally. This allows the orchestrator to record a failed outcome for a target, emit the correct icon in the log, and still process the remaining targets in the batch. Every failure path in `publishDirectoryGroup` and `runReleases` uses `Step.failure`; no failure path emits `✅`.

### Why a Silk-Specific Publishability Helper?

The vanilla `PublishabilityDetectorLive` from `workspaces-effect` treats `package.json#private: true` as "not publishable" full stop. Silk convention inverts that: in silk mode `private: true` is the norm on workspace `package.json` and publishability is derived from `publishConfig`, not the `private` flag. The silk rules therefore consult `publishConfig.targets` first, then `publishConfig.access`, and only fall back to the `private` flag as a last-resort default (see [Publishability Detection (Silk Rules)](integration.md#publishability-detection-silk-rules) for the full precedence). `PublishabilityDetectorAdaptiveLive` in `src/release/publishability.ts` short-circuits changeset-ignored packages to `[]` regardless of mode (via `ChangesetConfig.isIgnored`), then reads `ChangesetConfig.mode` per-call and dispatches to the silk override (silk mode), the library default (vanilla mode), or a no-op detector (none mode). This single ignore-aware detector is the only publishability path — Phase 1 (`listPublishablePackages`/`isMonorepoForTagging`), Phase 2 (`runValidation`) and Phase 3 (`runPublishTargets`) all resolve through it. The same rules are encoded identically in `pnpm-config-dependency-action` and the silk `changesets` package.

## Key Design Patterns

### Step-Buffered Logging

Every Phase-3 operation is wrapped in `Step.withStep(name, effect)`. The library buffers all log output emitted during the step and either flushes it on success or spills it on failure. Key primitives:

- `Step.withStep(name, effect)` — wraps an operation; buffers output; re-emits buffer on failure.
- `Step.success(label)` — marks the step passed; renders `✅ label`.
- `Step.failure(label)` — marks the step failed; renders `❌ label`; spills buffer; returns normally (does not throw).

This gives every sub-operation a clear emoji-annotated outcome in the GitHub Actions log without requiring the orchestrator to catch and re-wrap errors.

### State Management

GitHub Actions state passes data between `pre`, `main`, and `post` lifecycle hooks. State schemas are defined in `src/state.ts`:

- **`StartTimeState`** — Wall-clock timestamp captured by `pre.ts` for total-duration reporting in `post.ts`.
- **`GithubPackagesTokenState`** — Optional workflow `github-token` written by `pre.ts` when the input is provided; read by the Phase-3 publish flow.
- **`PackageManagerState`** — Auto-detected package manager, written by `main.ts` Phase-0 boot.

The GitHub App installation token is persisted by `GitHubToken.provision` (from `@savvy-web/github-action-effects`) under an internal key and read back via `GitHubToken.client()` / `GitHubToken.read()`. `process.env.GITHUB_TOKEN` is never written by the action.

Under the 2.0 library the secret-bearing token APIs all take or decode to `Redacted<string>`: `GitHubApp.generateToken` / `revokeToken`, `GitHubClientLive.fromToken` / `fromApp`, `PackagePublish.setupAuth` and the decoded `InstallationToken.token` field. Wrapping tokens in `Redacted` keeps them out of logs and error renders.

### Error Handling Strategy

Errors are handled differently depending on execution context:

- **Pre-action**: Fatal. Calls `setFailed()` immediately because the token is required for all subsequent operations.
- **Post-action**: Non-fatal. Emits `warning()` so that token revocation failures never fail the overall workflow.
- **Phase handlers**: Each phase wraps its execution in try/catch. On failure, incomplete Check Runs are cleaned up via `cleanupValidationChecks()`, then `setFailed()` is called.
- **Phase-3 per-target failures**: Non-fatal via `Step.failure`. The batch continues; the abort-before-releases gate checks aggregate results afterward.
- **Network operations**: Retry logic with exponential backoff for transient API failures.

### GitHub API Usage

The action uses three GitHub API communication patterns:

- **REST API** (`octokit.rest.*`): Standard CRUD operations — Check Runs, branch queries, PR listing, file comparisons, release creation, asset uploads.
- **GraphQL API**: Complex queries requiring nested data. Used for `closingIssuesReferences` on PRs (linked issues) and branch protection mutations.
- **Library services**: `@savvy-web/github-action-effects@2.0.0` provides Effect services (`PullRequest`, `GitTag`, `CheckRun`, `GitHubRelease`, `GitHubArtifactMetadata`, `GitHubCommit`, `GitHubContent`, `NpmRegistry`, `Attest`, `Sbom`, `PackagePublish`, `RegistryClassifier`) that wrap all Phase-3 GitHub and registry interactions. No raw Octokit calls remain in `src/release/` modules.

### Dry-Run Mode

When `dry-run: true` is set, the action executes a parallel path that validates without mutations: package manager commands run with `--dry-run` flags, Git branch and commit operations are skipped, Check Run titles are prefixed with the `🧪` test-tube marker (the only title decoration — the per-step check-run names otherwise carry no icons), and registry publish commands use the dry-run flag. All validation logic runs identically to production mode.

## File Reference

| File | Description |
| :--- | :---------- |
| `src/pre.ts` | Pre-action: Effect program, App token provisioning via GitHubToken.provision |
| `src/main.ts` | Main orchestrator: phase detection, routing, ReleaseOutput emission |
| `src/post.ts` | Post-action: Effect program, duration reporting, token revocation |
| `src/state.ts` | Schema.Class state bundles shared across pre/main/post |
| `src/schema/release-output.ts` | ReleaseOutput Schema.Union, phase structs, ReleaseFlags, deriveStatus |
| `src/schema/projections.ts` | toBranchManagementOutput, toValidationOutput, toPublishingOutput |
| `src/schema/silk-release-config.ts` | SilkReleaseConfig Effect schema; INPUT_SCHEMA_URL |
| `src/release/publish.ts` | detectReleases, runBuildAndSbom, runPublishTargets, publishDirectoryGroup |
| `src/release/releases.ts` | runReleases: tags, GitHub releases, SBOM/attestation uploads |
| `src/release/validation.ts` | runValidation: Phase-2 dry-run + SBOM + ValidationReport |
| `src/release/report.ts` | buildValidationComment, buildPublishSummary, buildChecksTable, buildFindingsTable |
| `src/release/publishability.ts` | SilkPublishabilityDetectorLive, PublishabilityDetectorAdaptiveLive |
| `src/release/changeset-config.ts` | ChangesetConfig Effect service: single source of changeset-config truth (mode, versionPrivate, ignorePatterns, isIgnored, fixed) |
| `src/release/layers.ts` | ReleaseLive = WorkspacesLive + ChangesetConfigLive + PublishabilityDetectorAdaptiveLive |
| `src/release/resolve-targets.ts` | resolvePublishableTargets seam for Phase-2 and Phase-3 |
| `src/release/types.ts` | TargetPublishResult, PackagePublishResult, ValidationFinding, ValidationPackageResult, etc. |
| `src/release/errors.ts` | ValidationError, ReleasesError tagged error types |
| `src/utils/check-release-branch.ts` | Check if release branch and PR exist |
| `src/utils/cleanup-validation-checks.ts` | Mark incomplete Check Runs as failed on error |
| `src/utils/close-linked-issues.ts` | Close issues linked to merged release PR |
| `src/utils/commit-signoff.ts` | DCO Signed-off-by trailer via GitHubToken.botIdentity |
| `src/utils/create-api-commit.ts` | GitHub API commits (auto-signed by App) |
| `src/utils/create-release-branch.ts` | Create release branch, version, commit, and PR |
| `src/utils/create-validation-check.ts` | Unified Check Run aggregating all validations |
| `src/utils/count-changesets.ts` | Count changesets per package |
| `src/utils/derive-check-conclusion.ts` | Check-run conclusion from findings with strict-warnings support |
| `src/utils/detect-repo-type.ts` | Monorepo/single-repo and package manager detection; exports matchesIgnorePattern (shared changeset-ignore matcher) |
| `src/utils/detect-workflow-phase.ts` | Phase routing based on GitHub event context |
| `src/utils/determine-tag-strategy.ts` | isMonorepoForTagging (Effect, via the single detector + ChangesetConfig.fixed) and pure determineTagStrategy |
| `src/utils/extract-release-notes.ts` | First-H2-to-second-H2 CHANGELOG section extraction |
| `src/utils/infer-sbom-metadata.ts` | Infer SBOM metadata from package.json fields |
| `src/utils/link-issues-from-commits.ts` | Extract and cross-reference issues from commits |
| `src/utils/load-release-config.ts` | Layered config loading; decodes via SilkReleaseConfig schema |
| `src/utils/parse-changesets.ts` | Changeset YAML frontmatter parsing |
| `src/utils/release-summary-helpers.ts` | listPublishablePackages (Effect over the single detector), getReleasingPackages, resolveReleasePrTitle, formatReleasePackageList |
| `src/utils/summary-writer.ts` | Type-safe markdown via ts-markdown |
| `src/utils/tokens.ts` | appToken() and packagesToken() helpers for non-Effect publish chain context |
| `src/utils/update-release-branch.ts` | Recreate release branch from main |
| `src/utils/update-sticky-comment.ts` | Idempotent PR comment management |
| `src/utils/validate-builds.ts` | Build validation with error annotation |
| `src/utils/validate-ntia-compliance.ts` | NTIA minimum elements SBOM validation |
| `src/types/publish-config.ts` | Multi-registry publishing type definitions |
| `src/types/sbom-config.ts` | SBOM configuration and CycloneDX types |
| `src/types/shared-types.ts` | ValidationResult and PackageValidationResult interfaces |
| `src/types/global.d.ts` | Global type augmentations for Vitest |
