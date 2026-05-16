---
title: Release Action Architecture
category: architecture
status: current
completeness: 95
created: 2026-02-07
updated: 2026-05-16
last-synced: 2026-05-16
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
  - [Module Dependency Graph](#module-dependency-graph)
  - [Shared Infrastructure](#shared-infrastructure)
  - [Type System](#type-system)
- [Rationale](#rationale)
  - [Why Three Phases?](#why-three-phases)
  - [Why API Commits?](#why-api-commits)
  - [Why Recreate vs Rebase?](#why-recreate-vs-rebase)
  - [Why Pre-validate All Targets?](#why-pre-validate-all-targets)
  - [Why Topological Sorting?](#why-topological-sorting)
  - [Why a Silk-Specific Publishability Helper?](#why-a-silk-specific-publishability-helper)
- [Key Design Patterns](#key-design-patterns)
  - [State Management](#state-management)
  - [Error Handling Strategy](#error-handling-strategy)
  - [GitHub API Usage](#github-api-usage)
  - [Dry-Run Mode](#dry-run-mode)
- [File Reference](#file-reference)

## Overview

The `workflow-release-action` is a TypeScript GitHub Action implementing a three-phase automated release workflow for monorepos and single-package repositories using changesets. It runs as a Node.js 24 action (`runs.using: node24`) with `pre`, `main`, and `post` lifecycle hooks, declared in `action.yml`.

The action automates the full release lifecycle: detecting pending changes, managing a release branch and PR, validating builds and registry readiness, publishing to multiple registries (npm, JSR, GitHub Packages, custom), creating Git tags and GitHub releases with attestations, and closing linked issues. All operations produce GitHub Check Runs for rich CI feedback and post sticky comments on the release PR for at-a-glance status.

The codebase totals approximately 17,000 lines of TypeScript across 3 entry points, 2 schema modules, 9 service modules (Effect-based `Attest` service), 40+ utility modules, and 4 type definition files.

## Current State

### Entry Points

Three lifecycle scripts correspond to the GitHub Actions `pre`, `main`, and
`post` execution stages. All three are now full Effect programs run via
`Action.run` from `@savvy-web/github-action-effects`:

- **`src/pre.ts`** -- Pre-action setup. Provisions a GitHub App installation token via `GitHubToken.provision()` using the `app-client-id` and `app-private-key` inputs. `provision` persists the `InstallationToken` envelope — token, expiry, installation ID, and the resolved App identity (slug, bot user ID, name) — to `ActionState` under an internal key. Also records the optional `github-token` input (for GitHub Packages / attestation fallback) to `GithubPackagesTokenState` in `src/state.ts`. Failures here abort the workflow. The `PreLive` layer composes `GitHubAppLive` over `OctokitAuthAppLive` plus `NodeFileSystem.layer`.
- **`src/main.ts`** -- Main orchestrator. Auto-detects the package manager via `detectRepoType()`, reads action inputs, retrieves the token via `GitHubToken.client()`, and calls `detectWorkflowPhase()` to determine which phase to run. Routes execution to one of four phase handlers. Each phase emits its results through the `ReleaseOutput` schema (see `src/schema/`).
- **`src/post.ts`** -- Post-action cleanup. Logs total execution duration, then conditionally revokes the GitHub App installation token via `GitHubToken.dispose()`. Errors are emitted as warnings so they never fail the overall workflow. The `PostLive` layer mirrors `PreLive`.

Input renames from the `github-action-effects` 1.1.0 migration:
`app-id` → `app-client-id`, `private-key` → `app-private-key`.

### Phase Detection

**`detect-workflow-phase.ts`** (411 lines)

The phase router determines which phase to execute based on GitHub event
context. It exports both an async version (with API calls for release commit
detection) and a synchronous lightweight version for quick checks.

Detection priority order:

1. **Explicit phase** -- If the `phase` input is provided, skip detection and
   use it directly. This supports the `workflow-control-action` pattern where
   phase is pre-determined.

2. **Phase 3a (close-issues)** -- `pull_request` event where the release PR
   (`changeset-release/main` to `main`) was merged. Detected from event
   payload without API calls.

3. **Phase 3 (publishing)** -- Push to main with a release commit. Detection
   uses a two-strategy approach with retry logic:
   - **Primary**: Query `listPullRequestsAssociatedWithCommit` to find a
     merged PR from the release branch.
   - **Fallback**: Query recently closed PRs from the release branch and
     match `merge_commit_sha` against the current commit. This handles cases
     where the branch is auto-deleted before the association API returns
     results.
   - **Retry**: 3 attempts with 5-second delays between attempts to handle
     GitHub API eventual consistency after PR merge.

4. **Phase 2 (validation)** -- Push to the release branch
   (`changeset-release/main`).

5. **Phase 1 (branch-management)** -- Push to main that is not a release
   commit.

6. **None** -- Any other branch or event. Logs a skip message and exits.

### Phase 1: Release Branch Management

Triggers on push to `main` (non-release commits). Three sequential steps:

- **`detect-publishable-changes.ts`** (467 lines) -- Runs
  `changeset status --output=json` to find pending changesets. Discovers
  workspace packages via `workspaces-effect`'s sync API
  (`findWorkspaceRootSync` + `getWorkspacePackagesSync`), reads each
  package's raw `package.json`, then applies the silk publishability rules
  via `silkDetect()` from `silk-publishability.ts`. Separates packages
  into two categories: publishable (silk returns one or more
  `PublishTarget`s) and version-only (have changesets but silk returns
  an empty target list -- receive version bumps and GitHub releases
  only). Creates a GitHub Check Run summarizing discovered packages.
  Historical note: an earlier implementation gated publishability on
  `hasPublishConfig && isPublicOrRestricted`, which honored only
  `publishConfig.access`. Private packages that declared
  `publishConfig.targets` were misclassified as version-only. The silk
  helper makes private+targets first-class.

- **`get-changeset-status.ts`** (236 lines) -- Wraps the changeset status
  command with fallback logic. If changesets have already been consumed (after
  a version command), checks out the merge base between the release branch and
  target branch to retrieve the original changeset state.

- **`check-release-branch.ts`** (158 lines) -- Checks whether the
  `changeset-release/main` branch exists (via `repos.getBranch` REST API,
  handling 404) and whether an open PR exists from that branch to the target
  branch. Creates a Check Run reporting findings.

- **`create-release-branch.ts`** (504 lines) -- Creates a new branch from
  `origin/{targetBranch}`, runs the changeset version command, creates a
  signed API commit (see `create-api-commit.ts`), links issues found in
  changeset files via GraphQL mutations, and opens a PR with standard labels.
  Includes retry logic with exponential backoff for API operations.

- **`update-release-branch.ts`** (868 lines) -- Recreates the branch from
  main rather than rebasing (avoids merge conflicts entirely). Collects linked
  issues from changesets BEFORE running the version command (since version
  consumes changesets). Creates an API commit with the main branch HEAD as
  parent (effectively rebasing onto main). After the version command runs,
  computes a version-aware PR title for single-package repos (e.g.,
  "release: 1.2.3") by calling `isSinglePackage()` and reading `package.json`;
  falls back to `prTitlePrefix` for multi-package repos or on failure. For
  existing open PRs, updates the title via `pulls.update`. Handles PR
  reopening if the branch was previously deleted, with a fallback that resets
  `prNumber` to `null` when the reopen API call fails (e.g., after a
  force-push), causing the existing "create new PR" block to execute instead
  of leaving the release branch orphaned without a PR.

### Phase 2: Release Validation

Triggers on push to the release branch. Creates all validation Check Runs
upfront for immediate visibility, then runs steps sequentially:

- **`link-issues-from-commits.ts`** (626 lines) -- Gets commits since the
  last release tag via `compareCommitsWithBasehead`. Extracts issue references
  using patterns like `closes #N`, `fixes #N`, `resolves #N`. Queries
  GraphQL for PR-linked issues (via `closingIssuesReferences`). Creates
  cross-reference comments on linked issues.

- **`validate-builds.ts`** (232 lines) -- Runs the build command (e.g.,
  `pnpm ci:build`). Parses stdout and stderr for TypeScript errors
  (`TS\d{4}:` pattern) and generic error patterns. Creates a Check Run with
  annotations (capped at 50 per GitHub API limit).

- **`validate-publish.ts`** (360 lines) -- Multi-registry dry-run validation
  for each package. For each package: resolves publish targets via
  `resolveTargets()`, sets up authentication via `setupRegistryAuth()`,
  pre-validates (directory exists, `package.json` present) via
  `preValidateTarget()`, then runs `dryRunPublish()`. Version conflicts
  (package already published at that version) are treated as non-errors.
  Handles version-only packages that have no publish targets.

- **`generate-release-notes-preview.ts`** (460 lines) -- Extracts the latest
  version section from each package's `CHANGELOG.md` file. Creates a Check
  Run with a formatted preview of all pending release notes.

- **`generate-sbom-preview.ts`** (471 lines) -- Generates Software Bill of
  Materials previews for each package. Validates NTIA compliance via
  `validate-ntia-compliance.ts`. Creates a Check Run with SBOM details.

- **`create-validation-check.ts`** (128 lines) -- Creates a unified Check Run
  aggregating results from all validation steps into a single status table.

- **`update-sticky-comment.ts`** (120 lines) -- Posts or updates a PR comment
  using the `<!-- sticky-comment-id: release-validation -->` HTML marker for
  idempotent updates. Contains validation results table, publish summary,
  version-only package list, and release notes preview link.

- **`cleanup-validation-checks.ts`** (151 lines) -- On workflow failure, marks
  any incomplete Check Runs as failed with the error message. Prevents
  orphaned "in progress" checks.

### Phase 3: Release Publishing

Triggers on merge of the release PR to main. Creates publishing Check Runs
upfront, then runs steps sequentially:

- **`detect-released-packages.ts`** (303 lines) -- Two detection strategies:
  1. **From PR**: Gets files changed in the merged PR via `pulls.listFiles`,
     reads old and new `package.json` versions from the PR diff.
  2. **From commit**: Compares `HEAD~1` with `HEAD` to find version changes.
  Infers bump type (major, minor, patch) from version comparison.

- **`publish-packages.ts`** (756 lines) -- The core publishing engine.
  Pre-validates ALL targets across ALL packages before publishing any single
  package (fail-early strategy). Sorts packages in topological order via
  `topological-sort.ts`. For each package, resolves targets, sets up auth,
  builds, and calls `publishToTarget()`. Collects results including tarball
  paths, provenance URLs, and attestation details.

- **`publish-target.ts`** (776 lines) -- Handles publishing a single package
  to a single registry. Packs the tarball (`npm pack`), verifies tarball
  integrity via SHA-512 hash, uploads to the registry. Supports four registry
  types:
  - **npm** (npmjs.org): OIDC trusted publishing or token-based auth
  - **JSR** (jsr.io): OIDC trusted publishing via `jsr publish`
  - **GitHub Packages**: GitHub App token auth
  - **Custom registries**: Token from `custom-registries` input

- **`determine-tag-strategy.ts`** (215 lines) -- Decides between single-tag
  (`v1.0.0`) for single-package repos or fixed versioning groups, and
  per-package tags (`@scope/pkg@1.0.0`) for independent versioning in
  monorepos. Also determines the overall release type (major, minor, patch)
  from changeset bump types.

- **`create-github-releases.ts`** (761 lines) -- Creates GitHub releases for
  each tag. Extracts release notes from `CHANGELOG.md` files. Uploads tarball
  assets from the publish step. Creates attestations (provenance, SBOM,
  per-asset) via `create-attestation.ts`.

- **`create-attestation.ts`** -- Generates npm provenance attestations and CycloneDX SBOM attestations via the GitHub Attestations API. Delegates to `attest-runner.ts` for signing and upload; uses `packagesToken()` (workflow token with `attestations:write`) rather than the App token. Enhances SBOM metadata via `enhance-sbom-metadata.ts`. No longer uses `@actions/attest`.
- **`attest-runner.ts`** (210 lines) -- Promise-returning shim around the Effect-based `Attest` service. Provides `runProvenanceAttestation()`, `runSbomAttestation()`, and `runCreateStorageRecord()`. All imports are dynamic so the heavy Effect + sigstore graph only loads when an attestation actually runs; dry-run paths never touch it. The storage-record call links attestations to the GitHub Packages artifact metadata UI.

- **`generate-publish-summary.ts`** (1,055 lines) -- Generates detailed
  markdown summaries for publish results. Three summary types: normal
  publish results, pre-validation failure summaries, and build failure
  summaries. Used for both Check Run output and job summary.

### Phase 3a: Issue Closing

- **`close-linked-issues.ts`** (265 lines) -- Queries the merged PR's
  `closingIssuesReferences` via GraphQL (up to 50 issues). For each linked
  issue, posts a comment noting the release and closes the issue. Creates a
  Check Run summarizing results.

- **`run-close-linked-issues.ts`** (48 lines) -- Thin wrapper that calls
  `closeLinkedIssues()` and sets action outputs (`closed_issues_count`,
  `failed_issues_count`, `closed_issues`).

### Module Dependency Graph

Key dependency flows between modules:

```text
main.ts
  |
  +-- detect-workflow-phase.ts (routing)
  |
  +-- Phase 1 chain:
  |     detect-publishable-changes.ts
  |       +-- get-changeset-status.ts
  |       +-- find-package-path.ts
  |       +-- silk-publishability.ts
  |       +-- release-summary-helpers.ts
  |         +-- silk-publishability.ts
  |     check-release-branch.ts
  |     create-release-branch.ts
  |       +-- create-api-commit.ts
  |       +-- parse-changesets.ts
  |     update-release-branch.ts
  |       +-- create-api-commit.ts
  |       +-- parse-changesets.ts
  |       +-- detect-repo-type.ts
  |
  +-- Phase 2 chain:
  |     link-issues-from-commits.ts
  |     validate-builds.ts
  |     validate-publish.ts
  |       +-- resolve-targets.ts
  |       +-- registry-auth.ts
  |       +-- pre-validate-target.ts
  |       +-- dry-run-publish.ts
  |       +-- registry-utils.ts
  |     generate-release-notes-preview.ts
  |     generate-sbom-preview.ts
  |       +-- infer-sbom-metadata.ts
  |       +-- validate-ntia-compliance.ts
  |     create-validation-check.ts
  |     update-sticky-comment.ts
  |     cleanup-validation-checks.ts
  |
  +-- Phase 3 chain:
  |     detect-released-packages.ts
  |       +-- find-package-path.ts
  |     publish-packages.ts
  |       +-- topological-sort.ts
  |       +-- resolve-targets.ts
  |       +-- registry-auth.ts
  |       +-- publish-target.ts
  |       +-- pre-validate-target.ts
  |       +-- load-release-config.ts
  |     determine-tag-strategy.ts
  |       +-- release-summary-helpers.ts
  |     create-github-releases.ts
  |       +-- create-attestation.ts
  |           +-- attest-runner.ts (Promise shim)
  |               +-- services/attest/* (Effect service)
  |       +-- enhance-sbom-metadata.ts
  |     generate-publish-summary.ts
  |     close-linked-issues.ts
  |
  +-- Cross-cutting:
        create-api-commit.ts (Phase 1: create/update branch)
          +-- commit-signoff.ts (DCO trailer)
        registry-auth.ts (Phase 2: validate, Phase 3: publish)
        registry-utils.ts (Phase 2: validate, Phase 3: publish)
        resolve-targets.ts (Phase 2: validate, Phase 3: publish)
        find-package-path.ts (Phase 1: detect, Phase 3: detect)
        release-summary-helpers.ts (Phase 1: detect, Phase 3: tags)
        silk-publishability.ts
          (Phase 1: detect-publishable-changes,
           Phase 1/3: release-summary-helpers)
        tokens.ts (Phase 3: attestation + packages auth)
        _actions-compat.ts (Phase 2/3: publish chain shim)
        logger.ts (all phases)
        summary-writer.ts (all phases)
        schema/release-output.ts + schema/projections.ts (all phases, output)
```

### Shared Infrastructure

- **`logger.ts`** (162 lines) -- Structured workflow logging using emoji-based
  state indicators and phase markers. Provides methods for phase headers,
  step groups (wrapping `@actions/core` startGroup/endGroup), context
  logging, success/warning/error messages, and skip/no-action messages.
  All methods are constants on a frozen object.

- **`summary-writer.ts`** (125 lines) -- Type-safe markdown generation using
  the `ts-markdown` library. Provides methods for tables, key-value tables,
  bulleted lists, headings, code blocks, sections, and multi-section document
  building. Writes to the GitHub Actions job summary.

- **`topological-sort.ts`** (170 lines) -- Implements Kahn's algorithm for
  sorting packages in dependency order. Discovers workspaces via
  `workspaces-effect` (`findWorkspaceRootSync` + `getWorkspacePackagesSync`)
  and builds the production-dependency map inline from each
  `WorkspacePackage.dependencies` field. This intentionally mirrors the
  old `workspace-tools` `createDependencyMap` call with
  `withDevDependencies: false`, `withPeerDependencies: false`,
  `withOptionalDependencies: false` -- only `dependencies` participates
  in publish order. Returns sorted package names with dependencies
  first, or reports circular dependency errors.

- **`create-api-commit.ts`** (326 lines) -- Creates Git commits via the
  GitHub REST API (blob, tree, commit, ref update). Produces automatically
  GPG-signed commits when authenticated as a GitHub App. Handles file
  additions, modifications, and deletions. Used by both
  `create-release-branch.ts` and `update-release-branch.ts`.

- **`tokens.ts`** (31 lines) -- Two exported helpers used by the publish chain. `appToken()` returns the GitHub App installation token from `ActionState`. `packagesToken()` prefers the workflow `github-token` (carries `packages:write` and `attestations:write`) and falls back to the App token. Both read via `_actions-compat.ts`'s `getState` shim; `process.env.GITHUB_TOKEN` is never written by the action.
- **`_actions-compat.ts`** (211 lines) -- Custom shim replacing `@actions/core`, `@actions/exec`, and `@actions/github` in the publish chain. Implements the GitHub Actions workflow-command protocol (`::group::`, `::warning::`, etc.) using `node:child_process` and `node:fs` — no `http-client`/`undici` import. This eliminates the `Class extends value [object Module] is not a constructor` crash that `@actions/core`'s static `oidc-utils.js` import caused in the bundled output.
- **`commit-signoff.ts`** (new) -- Resolves the DCO `Signed-off-by` trailer for action-created commits. Reads the App bot identity via `GitHubToken.botIdentity()` and falls back to `github-actions[bot]` when unavailable.

- **`find-package-path.ts`** (96 lines) -- Resolves package names to
  filesystem paths using `workspaces-effect`'s sync API
  (`findWorkspaceRootSync` + `getWorkspacePackagesSync`). Caches the
  workspace map to avoid repeated filesystem operations across multiple
  lookups.

- **`detect-repo-type.ts`** (298 lines) -- Detects whether the repository is
  a monorepo or single-package repo. A small `listWorkspacePackages()`
  helper wraps `workspaces-effect`'s sync API; `isSinglePackage()`,
  `hasWorkspacePackages()`, and `detectRepoType()` all consume it.
  Auto-detects the package manager from the `packageManager` field in
  `package.json`. Reads changeset configuration for ignore patterns and
  private package handling.

- **`silk-publishability.ts`** (141 lines) -- Non-Effect helper that
  encodes the silk publishability rules used across all silk release
  tooling. Exports `silkDetect(pkgName, rawPackageJson) → PublishTarget[]`
  (the `PublishTarget` Schema.Class comes from `workspaces-effect`) and
  the `isSilkPublishable()` predicate. The rules:
  1. `private !== true` -- publishable to one default npm target (or
     whatever `publishConfig.registry`/`access`/`directory` says).
  2. `private === true` with `publishConfig.targets` -- publishable to
     each target. String targets (`"npm"`, `"github"`, `"jsr"`, or URL
     strings) inherit parent `access`; object targets may override
     `access` and `registry`.
  3. `private === true` with `publishConfig.access` (no `targets`) --
     publishable to one target using that access.
  4. Otherwise -- not publishable (empty array).
  Mirrors the canonical implementations in
  `pnpm-config-dependency-action/src/services/publishability.ts` and
  `changesets/package/src/services/silk-publishability.ts` so that the
  three actions agree on what counts as publishable. Used by
  `detect-publishable-changes.ts` (Phase 1 routing) and
  `release-summary-helpers.ts` (target counting for summaries).

- **`parse-changesets.ts`** (246 lines) -- Parses changeset YAML frontmatter
  from `.changeset/*.md` files. Extracts package names, bump types, and
  summary descriptions. Used during branch creation to link issues.

- **`release-summary-helpers.ts`** (282 lines) -- Package discovery and
  workspace analysis utilities. Provides changeset config reading
  (fixed/linked groups), workspace package info retrieval, and package
  group classification. `getAllWorkspacePackages()` re-reads each
  workspace's raw `package.json` from disk (needed because
  `workspaces-effect`'s typed `PublishConfig` schema does not surface
  `publishConfig.targets`) and feeds the raw JSON through `silkDetect()`
  so that `WorkspacePackageInfo.targetCount` reflects silk rules
  rather than `publishConfig.access` alone.

- **`registry-utils.ts`** (149 lines) -- Registry URL utilities including
  display name generation, package view URL construction, npm registry
  detection, and GitHub Packages registry detection.

- **`resolve-targets.ts`** (208 lines) -- Reads `publishConfig` from each
  package's `package.json` and resolves it into a list of `ResolvedTarget`
  objects (one per registry). Handles npm, JSR, GitHub Packages, and custom
  registries. Maps registry URLs to environment variable names for auth.

- **`registry-auth.ts`** (523 lines) -- Sets up authentication for each
  registry type. Creates/modifies `.npmrc` files with auth tokens. Supports
  OIDC token exchange for npm and JSR, GitHub App token for GitHub Packages,
  and explicit tokens for custom registries. Validates registry availability
  with health checks (10-second timeout).

- **`pre-validate-target.ts`** (238 lines) -- Pre-publication validation for
  a single target. Checks that the package directory exists, `package.json`
  is present and parseable, the version field exists, and the tarball can
  be created.

- **`dry-run-publish.ts`** (217 lines) -- Executes `npm publish --dry-run`
  against each target registry. Parses output for errors vs. warnings.
  Treats "version already published" as a non-error (idempotent).

- **`load-release-config.ts`** (377 lines) -- Loads release configuration
  from the SBOM config input, environment variables, and package-level
  settings. Merges supplier, copyright, and license metadata for SBOM
  generation.

- **`infer-sbom-metadata.ts`** (289 lines) -- Infers SBOM metadata from
  `package.json` fields (license, author, repository, homepage). Falls back
  to repository-level defaults when package-level metadata is incomplete.

- **`validate-ntia-compliance.ts`** (256 lines) -- Validates that generated
  SBOMs meet NTIA (National Telecommunications and Information
  Administration) minimum elements for software transparency.

- **`enhance-sbom-metadata.ts`** (247 lines) -- Enriches CycloneDX SBOM
  documents with supplier information, copyright notices, and lifecycle
  metadata from the release configuration.

- **`detect-copyright-year.ts`** (142 lines) -- Detects copyright year ranges
  from LICENSE files, existing copyright notices, and Git history. Used by
  SBOM metadata generation.

### Schema Layer

The `src/schema/` directory contains the structured output contract, replacing
the ~22 scattered `outputs.set()` calls that existed before.

- **`src/schema/release-output.ts`** -- Defines `ReleaseOutput` as a `Schema.Union` of three phase structs discriminated by the `phase` literal: `BranchManagementOutput`, `ValidationOutput`, `PublishingOutput`. Each struct carries the three orthogonal machine flags (`noop`, `succeeded`, `hasFailures`) plus a derived human-readable `status` (`"no-op" | "success" | "partial" | "failed"`). The `SCHEMA_URL` constant points to the SchemaStore-hosted JSON Schema. The action emits a Schema-encoded instance as the single `result` action output plus five scalar mirrors (`phase`, `status`, `succeeded`, `package-count`, `release-pr-number`). Action manifest outputs collapsed from ~22 declared to 9 total.
- **`src/schema/projections.ts`** -- Three pure projection functions (`toBranchManagementOutput`, `toValidationOutput`, `toPublishingOutput`). Each takes an explicit input interface — the deliberate seam between internal pipeline types and the published contract. `main.ts` adapts internal results into these inputs; the projections stay pure and independently testable.

### Effect-Based Attest Service

The `src/services/attest/` directory is a self-contained Effect service that
replaced `@actions/attest` entirely for signing and uploading attestations.

- **`service.ts`** -- Defines the `Attest` Context.Tag and `AttestError` tagged error. The service surface includes `buildStatement`, `save`, `buildBundle`, `attest`, `sbom`, and `provenance`. The tag is namespaced `github-action-effects/Attest` for future upstreaming.
- **`live.ts`** -- `AttestLive` implementation. Composes the in-toto builder, `SigstoreSigner`, and `GitHubClient` to post bundles to `POST /repos/{owner}/{repo}/attestations`.
- **`oidc.ts`** -- `OidcTokenIssuer` service. Fetches GitHub Actions OIDC JWTs via `@effect/platform` `HttpClient` (no `node:fetch` / undici in the bundle). Requires the `ACTIONS_ID_TOKEN_REQUEST_TOKEN` / `ACTIONS_ID_TOKEN_REQUEST_URL` env vars (`id-token: write` workflow permission).
- **`signer.ts`** -- `SigstoreSigner` service. Wraps `@sigstore/sign` v4 (`DSSEBundleBuilder` + `FulcioSigner` + `RekorWitness`) behind an Effect surface. Produces `SigstoreBundle` values accepted by the GitHub attestations API.
- **`sbom.ts`** -- `Sbom` service. Generates CycloneDX 1.5 BOMs from a post-relink dependency graph using `@cyclonedx/cyclonedx-library` directly (no `cdxgen` subprocess). The library is lazily imported so provenance-only paths never load it.
- **`intoto.ts`** -- Pure in-toto statement builder. Exports `buildStatement`, `subject`, `npmPurl`, and `serializeStatement`.
- **`slsa.ts`** -- SLSA Provenance v1 predicate builder. `buildSLSAProvenancePredicate` assembles a SLSA v1 build definition + run details from decoded JWT claims.
- **`types.ts`** -- Shared types: `InTotoStatement`, `SigstoreBundle`, `AttestationRecord`, `AttestInput`, `SLSA_PROVENANCE_V1`, `CYCLONEDX_BOM` predicate type constants.
- **`testing.ts`** -- `AttestTest` and `SbomTest` test layers. Mirrors the upstream `GitHubClientTest` pattern: `state()` form records calls into shared arrays; `empty()` provides sensible no-op defaults. No cryptographic work runs in tests.

### Type System

- **`types/publish-config.ts`** (334 lines) -- Comprehensive type definitions
  for the multi-registry publishing system: `PublishTarget`,
  `ResolvedTarget`, `PublishResult`, `PackagePublishValidation`,
  `AuthSetupResult`, `PrePackedTarball`, and related types.

- **`types/shared-types.ts`** (69 lines) -- Shared interfaces used across
  modules: `ValidationResult` and `PackageValidationResult`.

- **`types/sbom-config.ts`** (328 lines) -- Type definitions for SBOM
  configuration: `SBOMConfig`, `EnhancedCycloneDXDocument`, NTIA compliance
  types, and supplier/copyright metadata types.

- **`types/global.d.ts`** (7 lines) -- Global type augmentations for the
  Vitest testing globals.

## Rationale

### Why Three Phases?

The three-phase approach separates concerns by execution context:

1. **Branch management** runs on every push to main. It is fast (no builds)
   and creates/updates the release PR as a staging area.
2. **Validation** runs on the release branch. Build compilation, dry-run
   publishing, and SBOM generation can be slow without blocking pushes to
   main. The release PR provides a visible gate for review.
3. **Publishing** only runs after the release PR is merged. This gating
   ensures human approval before packages reach registries.

This separation also means that validation failures never block development
on main, and publishing failures are isolated from the validation context.

### Why API Commits?

Using the GitHub REST API to create commits (blob, tree, commit, ref update)
instead of `git push` provides several benefits:

- **Automatic GPG signing**: Commits created by a GitHub App are
  automatically signed and marked as "verified" in the GitHub UI.
- **Atomic operations**: Branch creation and commit happen as API calls,
  avoiding race conditions with concurrent pushes.
- **No git credentials on runner**: The runner never needs git push
  access -- only the API token is used.
- **DCO compliance**: The commit message can include a
  `Signed-off-by` footer for Developer Certificate of Origin compliance.

### Why Recreate vs Rebase?

The `update-release-branch.ts` module recreates the release branch from main
instead of performing a `git rebase`:

- **Avoids merge conflicts entirely**: The release branch contains only
  machine-generated changes (changeset version bumps and CHANGELOG updates).
  There is never a reason to preserve manual commits on it.
- **Simpler error handling**: Rebase can fail partway through, leaving the
  branch in a broken state. Recreation is atomic -- it either succeeds
  completely or fails without side effects.
- **Deterministic output**: The branch always reflects the current state of
  main plus the version command output. No accumulated history.

### Why Pre-validate All Targets?

The `publish-packages.ts` module pre-validates ALL targets across ALL packages
before publishing any single package. This prevents partial publishes where
some packages succeed and others fail, leaving registries in an inconsistent
state. For monorepos with inter-package dependencies, a partial publish could
mean dependent packages reference versions that do not exist on some
registries.

### Why Topological Sorting?

Packages are published in dependency order (dependencies before dependents)
so that registries like JSR and npm can resolve inter-package dependencies
at publish time. Without topological sorting, a package referencing
`@org/dep@2.0.0` could be published before `@org/dep@2.0.0` exists on the
registry, causing the publish to fail or the package to be installed with
a stale dependency.

### Why a Silk-Specific Publishability Helper?

The vanilla `PublishabilityDetectorLive` exposed by `workspaces-effect`
treats `package.json#private: true` as "not publishable" full stop. Silk
convention extends that in two ways: private packages may opt back in by
declaring `publishConfig.access` (one default target) or
`publishConfig.targets` (one or more targets, possibly to private
registries). Encoding those rules in a small non-Effect helper
(`silk-publishability.ts`) gives the action three things:

- **Cross-action agreement** -- the same rules are encoded identically in
  `pnpm-config-dependency-action` and `changesets`, so all three tools
  agree on which packages count as publishable.
- **A clean swap path** -- when this repo eventually adopts the Effect
  service shape used elsewhere in silk, the helper can be replaced by
  the `PublishabilityDetector` Context.Tag without touching call sites.
- **A real bug fix** -- the previous implementation gated on
  `hasPublishConfig && publishConfig.access in {public, restricted}`,
  which silently misclassified private packages with
  `publishConfig.targets` as version-only (GitHub release only, no
  registry publish). Both `detect-publishable-changes.ts` and
  `release-summary-helpers.ts:getAllWorkspacePackages` now route
  through `silkDetect()` so the two phases agree on the target list.

## Key Design Patterns

### State Management

GitHub Actions state passes data between `pre`, `main`, and `post` lifecycle
hooks. The library's `ActionState.save(key, value, Schema)` encodes values via
`Schema.encode` then `JSON.stringify`; the runner exposes each entry as
`STATE_${KEY}` in subsequent phases. State schemas are defined in `src/state.ts`:

- **`StartTimeState`** -- Wall-clock timestamp captured by `pre.ts` for total-duration reporting in `post.ts`.
- **`GithubPackagesTokenState`** -- Optional workflow `github-token` written by `pre.ts` when the input is provided; read by `tokens.packagesToken()` in the publish chain.
- **`PackageManagerState`** -- Auto-detected package manager, written by `main.ts` Phase-0 boot.

The GitHub App installation token is no longer modelled in `src/state.ts` — it is persisted by `GitHubToken.provision` (from `@savvy-web/github-action-effects`) under an internal key and read back via `GitHubToken.client()` / `GitHubToken.read()`. `process.env.GITHUB_TOKEN` is never written by the action; publish chain utilities read tokens via `tokens.appToken()` and `tokens.packagesToken()`.

### Error Handling Strategy

Errors are handled differently depending on the execution context:

- **Pre-action**: Fatal. Calls `setFailed()` immediately because the token is
  required for all subsequent operations.
- **Post-action**: Non-fatal. Emits `warning()` so that token revocation
  failures never fail the overall workflow.
- **Phase handlers**: Each phase wraps its execution in try/catch. On failure,
  incomplete Check Runs are cleaned up via `cleanupValidationChecks()`, then
  `setFailed()` is called with context about which phase failed.
- **Network operations**: Retry logic with exponential backoff for transient
  API failures. The release commit detection retries 3 times with 5-second
  delays.
- **Non-critical operations**: Sticky comment updates and issue closing use
  try/catch with warnings. Their failure does not fail the workflow since the
  primary operations (validation or publishing) already succeeded.

### GitHub API Usage

The action uses three GitHub API communication patterns:

- **REST API** (`octokit.rest.*`): Standard CRUD operations -- Check Runs,
  branch queries, PR listing, file comparisons, release creation, asset
  uploads.
- **GraphQL API**: Complex queries requiring nested data that REST cannot
  efficiently provide. Used for `closingIssuesReferences` on PRs (linked
  issues) and branch protection mutations.
- **Check Runs**: Primary CI feedback mechanism. Each validation step and
  publishing step creates a Check Run with structured output (title, summary,
  annotations). Check Runs are created upfront in "queued" status and updated
  as steps progress, giving immediate visibility in the PR UI.
- **Attestations**: The Effect-based `Attest` service (`src/services/attest/`) for npm provenance (SLSA Provenance v1) and CycloneDX SBOM attestations. Signs via `@sigstore/sign` v4 (Fulcio + Rekor), uploads to `POST /repos/{owner}/{repo}/attestations`. No longer uses `@actions/attest`.

### Dry-Run Mode

When `dry-run: true` is set, the action executes a parallel path that
validates without mutations:

- Package manager commands run with `--dry-run` flags
- Git branch and commit operations are skipped
- Check Run names are prefixed with the test tube emoji
- Registry publish commands use `npm publish --dry-run`
- Output and summaries are clearly marked as dry-run results
- All validation logic runs identically to production mode

This allows testing the full workflow without creating branches, PRs, tags,
releases, or publishing to any registry.

## File Reference

| File | Description |
| :--- | :---------- |
| `src/pre.ts` | Pre-action: Effect program, App token provisioning via GitHubToken.provision |
| `src/main.ts` | Main orchestrator: phase detection, routing, ReleaseOutput emission |
| `src/post.ts` | Post-action: Effect program, duration reporting, token revocation |
| `src/state.ts` | Schema.Class state bundles shared across pre/main/post |
| `src/schema/release-output.ts` | ReleaseOutput Schema.Union, phase structs, ReleaseFlags, deriveStatus |
| `src/schema/projections.ts` | toBranchManagementOutput, toValidationOutput, toPublishingOutput |
| `src/services/attest/service.ts` | Attest Context.Tag and AttestError |
| `src/services/attest/live.ts` | AttestLive: in-toto build → Sigstore sign → GitHub upload |
| `src/services/attest/oidc.ts` | OidcTokenIssuer: GitHub Actions OIDC JWT via @effect/platform HttpClient |
| `src/services/attest/signer.ts` | SigstoreSigner: @sigstore/sign v4 (Fulcio + Rekor) |
| `src/services/attest/sbom.ts` | Sbom: CycloneDX 1.5 BOM generation via @cyclonedx/cyclonedx-library |
| `src/services/attest/intoto.ts` | Pure in-toto statement builder (buildStatement, subject, npmPurl) |
| `src/services/attest/slsa.ts` | SLSA Provenance v1 predicate builder |
| `src/services/attest/types.ts` | InTotoStatement, SigstoreBundle, AttestationRecord, predicate type constants |
| `src/services/attest/testing.ts` | AttestTest and SbomTest test layers (no crypto, records calls) |
| `src/types/global.d.ts` | Global type augmentations for Vitest |
| `src/types/shared-types.ts` | ValidationResult and PackageValidationResult interfaces |
| `src/types/publish-config.ts` | Multi-registry publishing type definitions |
| `src/types/sbom-config.ts` | SBOM configuration and CycloneDX types |
| `src/utils/_actions-compat.ts` | Shim replacing @actions/core/exec/github in the publish chain (no undici) |
| `src/utils/attest-runner.ts` | Promise shim around Attest service: runProvenanceAttestation, runSbomAttestation, runCreateStorageRecord |
| `src/utils/check-release-branch.ts` | Check if release branch and PR exist |
| `src/utils/cleanup-validation-checks.ts` | Mark incomplete Check Runs as failed on error |
| `src/utils/close-linked-issues.ts` | Close issues linked to merged release PR |
| `src/utils/commit-signoff.ts` | DCO Signed-off-by trailer via GitHubToken.botIdentity |
| `src/utils/create-api-commit.ts` | GitHub API commits (auto-signed by App) |
| `src/utils/create-attestation.ts` | npm provenance and CycloneDX SBOM attestation orchestration |
| `src/utils/create-github-releases.ts` | GitHub releases with tarball assets and attestations |
| `src/utils/create-release-branch.ts` | Create release branch, version, commit, and PR |
| `src/utils/create-validation-check.ts` | Unified Check Run aggregating all validations |
| `src/utils/detect-copyright-year.ts` | Copyright year detection from LICENSE/git history |
| `src/utils/detect-publishable-changes.ts` | Changeset detection and package discovery |
| `src/utils/detect-released-packages.ts` | Detect version bumps from PR diff or commit |
| `src/utils/detect-repo-type.ts` | Monorepo/single-repo and package manager detection (workspaces-effect) |
| `src/utils/detect-workflow-phase.ts` | Phase routing based on GitHub event context |
| `src/utils/determine-tag-strategy.ts` | Single vs per-package tag strategy selection |
| `src/utils/dry-run-publish.ts` | Dry-run publish validation per registry |
| `src/utils/enhance-sbom-metadata.ts` | Enrich CycloneDX SBOMs with supplier/copyright |
| `src/utils/find-package-path.ts` | Workspace package path resolution with caching (workspaces-effect) |
| `src/utils/generate-publish-summary.ts` | Markdown summaries for publish results |
| `src/utils/generate-release-notes-preview.ts` | CHANGELOG extraction and preview Check Run |
| `src/utils/generate-sbom-preview.ts` | SBOM preview generation and NTIA validation |
| `src/utils/get-changeset-status.ts` | Changeset status with merge-base fallback |
| `src/utils/infer-sbom-metadata.ts` | Infer SBOM metadata from package.json fields |
| `src/utils/link-issues-from-commits.ts` | Extract and cross-reference issues from commits |
| `src/utils/load-release-config.ts` | Load SBOM/release config from inputs and env |
| `src/utils/logger.ts` | Structured emoji-based workflow logging |
| `src/utils/parse-changesets.ts` | Changeset YAML frontmatter parsing |
| `src/utils/pre-validate-target.ts` | Pre-publication target validation |
| `src/utils/publish-packages.ts` | Core publishing engine with topological sort |
| `src/utils/publish-target.ts` | Single-package single-registry publish handler |
| `src/utils/registry-auth.ts` | Multi-registry auth setup (OIDC, token, .npmrc) |
| `src/utils/registry-utils.ts` | Registry URL utilities and display helpers |
| `src/utils/release-summary-helpers.ts` | Package discovery and workspace analysis |
| `src/utils/resolve-targets.ts` | publishConfig to ResolvedTarget resolution |
| `src/utils/run-close-linked-issues.ts` | Thin wrapper for close-linked-issues |
| `src/utils/silk-publishability.ts` | Silk publishability rules (private+targets, private+access, public default) |
| `src/utils/summary-writer.ts` | Type-safe markdown via ts-markdown |
| `src/utils/tokens.ts` | appToken() and packagesToken() helpers for publish chain |
| `src/utils/topological-sort.ts` | Kahn's algorithm for dependency ordering (workspaces-effect) |
| `src/utils/update-release-branch.ts` | Recreate release branch from main |
| `src/utils/update-sticky-comment.ts` | Idempotent PR comment management |
| `src/utils/validate-builds.ts` | Build validation with error annotation |
| `src/utils/validate-ntia-compliance.ts` | NTIA minimum elements SBOM validation |
| `src/utils/validate-publish.ts` | Multi-registry dry-run publish validation |
