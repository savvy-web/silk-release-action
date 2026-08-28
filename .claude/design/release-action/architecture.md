---
title: Release Action Architecture
category: architecture
status: current
completeness: 95
created: 2026-02-07
updated: 2026-08-27
last-synced: 2026-08-27
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
  - [Program Composition and the `steps/` Layer](#program-composition-and-the-steps-layer)
  - [Inputs and Outputs (Single Decode Point)](#inputs-and-outputs-single-decode-point)
  - [Layer Graph](#layer-graph)
  - [Phase Detection](#phase-detection)
  - [Phase 1: Release Branch Management](#phase-1-release-branch-management)
    - [Native versioning (zero-install)](#native-versioning-zero-install)
    - [Release PR and commit titles](#release-pr-and-commit-titles)
    - [Release PR body (managed region)](#release-pr-body-managed-region)
    - [The release-plan comment section](#the-release-plan-comment-section)
  - [Phase 2: Release Validation](#phase-2-release-validation)
    - [Check derivation](#check-derivation)
    - [Degradation semantics (issue #216)](#degradation-semantics-issue-216)
  - [Phase 3: Release Publishing](#phase-3-release-publishing)
    - [Release kind — `github-with-packages` vs `github-only`](#release-kind--github-with-packages-vs-github-only-srcutilsrelease-kindts)
    - [Per-byte-group prod layout](#per-byte-group-prod-layout)
    - [Group-keyed release assets](#group-keyed-release-assets)
  - [Phase 3a: Issue Closing](#phase-3a-issue-closing)
  - [Post-Release Housekeeping (out of action)](#post-release-housekeeping-out-of-action)
  - [Module Dependency Graph](#module-dependency-graph)
  - [Shared Infrastructure](#shared-infrastructure)
  - [Schema Layer](#schema-layer)
  - [Type System](#type-system)
- [Rationale](#rationale)
  - [Why Three Phases?](#why-three-phases)
  - [Why a 19-line `main.ts`?](#why-a-19-line-maints)
  - [Why API Commits?](#why-api-commits)
  - [Why Recreate vs Rebase?](#why-recreate-vs-rebase)
  - [Why version natively?](#why-version-natively)
  - [Why a Six-Step Phase-3 Flow?](#why-a-six-step-phase-3-flow)
  - [Why Pack Once per Directory?](#why-pack-once-per-directory)
  - [Why a Silk-Specific Publishability Helper?](#why-a-silk-specific-publishability-helper)
- [Key Design Patterns](#key-design-patterns)
  - [Declared Failure Postures](#declared-failure-postures)
  - [Grouped Logging](#grouped-logging)
  - [Managed Sections](#managed-sections)
  - [State Management](#state-management)
  - [Error Handling Strategy](#error-handling-strategy)
  - [GitHub API Usage](#github-api-usage)
  - [Dry-Run Mode](#dry-run-mode)
- [File Reference](#file-reference)

## Overview

The `silk-release-action` is a TypeScript GitHub Action implementing a three-phase automated release workflow for monorepos and single-package repositories using changesets. It runs as a Node.js 24 action (`runs.using: node24`) with `pre`, `main`, and `post` lifecycle hooks, declared in `action.yml`.

The action automates the full release lifecycle: detecting pending changes, managing a release branch and PR, validating builds and registry readiness, publishing to multiple registries (npm, JSR, GitHub Packages, custom), creating Git tags and GitHub releases with attestations, and closing linked issues. All operations produce GitHub Check Runs for rich CI feedback and write managed sections into a sticky comment on the release PR for at-a-glance status.

**Every phase is now a pure Effect program.** The imperative `@actions/*` layer is gone; so is the single-package `@savvy-web/github-action-effects`, which was replaced wholesale by the `@effected/*` kit (see [#191](https://github.com/savvy-web/silk-release-action/pull/191)). The kit splits the old library's surface across focused packages:

| Package | What the action uses it for |
| ------- | --------------------------- |
| `@effected/github-actions` | `Action.run`, `ActionInput`, `ActionOutputs`, `ActionState`, `ActionEnvironment`, `ActionLogger`, `GitHubToken`, `OidcTokenIssuer`, `DryRun`, `GitHubMarkdown`, `ActionsProvenance`, `Secret` |
| `@effected/github` | `GitHubClient` (REST + GraphQL), `Repo`, `CheckRun`, `GitBranch`, `GitCommit`, `GitHubCommit`, `GitHubContent`, `GitHubIssue` (incl. `commentOnce` + `CommentMarker` for marker-keyed idempotent comments), `GitHubRelease`, `GitHubRepository`, `GitTag`, `PullRequest`, `PullRequestComment`, `ArtifactMetadata`, `Attestation`, `GitHubApp`, `harvestIssueReferences` (the closing-keyword issue-reference grammar) |
| `@effected/git` | Every git operation — `status`, `clean`, `restore`, `branchCreate`, `branchDelete`, `isShallow`, `fetchUnshallow`, log/diff reads |
| `@effected/npm` | `PackagePublish` (pack / publish / dry-run / auth), `NpmRegistry` (HTTP registry reads), `classifyRegistry`, the registry label helpers (`registryShortLabel` / `registryDisplayName` / `registryHost`, adopted from the deleted `src/utils/registry-label.ts` via effected#196) |
| `@effected/sbom` | SBOM generation, `SigstoreSigner` |
| `@effected/commands` | `LocalExec`, `ToolDiscovery` — the subprocess and tool-probe seams |
| `@effected/workspaces` | `Workspaces.layerWithGit()`, `WorkspaceDiscovery`, `PublishabilityDetector`, `DependencyGraph`, `PackageManagerDetector` |
| `@effected/markdown`, `@effected/package-json`, `@effected/jsonc` | Markdown assembly, manifest reads, JSONC parsing |
| `@savvy-web/silk-effects` | `Changesets.ReleasePlanner` / `ConfigInspector` (native versioning), `ChangesetConfigReader`, `SilkPublishability` (silk rules + `PublishTargetBindingError`), `PrBody` (the managed release-PR description) |

**All 17 raw `ChildProcess.make("git", …)` spawns are gone** — `@effected/git` answers every one of them (`clean`, `branchDelete`, `branchCreate`, `restore`, `isShallow`, `fetchUnshallow`).

Publish and release target the `@savvy-web/bundler` per-byte-group prod layout (via `@savvy-web/silk-effects`). Each package's `publishConfig.targets` is a Record map (binding-driven; the legacy array form is gone) and the build emits `dist/prod/<group>/pkg` directories, one per byte-variant group. `npm: true` + `github: true` collapse into a single tarball deployed to both. See [Per-byte-group prod layout](#per-byte-group-prod-layout).

Phase 1 versions in-process through the bundled silk-effects `ReleasePlanner`, so consumer `ci:version` scripts are never invoked and Phase 1 runs zero-install (the shared workflow passes `install-deps: false`). See [Native versioning (zero-install)](#native-versioning-zero-install).

## Current State

### Entry Points

Three lifecycle scripts correspond to the GitHub Actions `pre`, `main`, and `post` execution stages. All three are Effect programs run via `Action.run` from `@effected/github-actions`, each behind a `process.env.GITHUB_ACTIONS` guard so importing the module in a test does not execute the action.

- **`src/pre.ts`** — Pre-action setup. Records the start time to `StartTimeState`, persists the optional `github-token` input to `GithubPackagesTokenState`, and provisions a GitHub App installation token via `GitHubToken.provision()` from the `app-client-id` / `app-private-key` inputs. `provision` mints the token, verifies granted scopes, resolves the App identity best-effort, masks the token, and persists the whole `InstallationToken` envelope to `ActionState`. Failures here abort the workflow.
- **`src/main.ts`** — **19 lines.** A `GITHUB_ACTIONS` guard and `Action.run(main, { layer: MainLive })`, nothing else. The program is `src/program.ts`; the layer graph is `src/layers/app.ts`.
- **`src/post.ts`** — Post-action cleanup. Reports total duration, then revokes the installation token via `GitHubToken.dispose()`. Belt-and-braces `Effect.catch` on revocation plus `Effect.catchDefect` around the whole program, so a post failure never fails the workflow.

Input names: `app-client-id`, `app-private-key` (renamed from the pre-1.1.0 `app-id` / `private-key`).

### Program Composition and the `steps/` Layer

`src/main.ts` was 1481 lines and did everything: input reads, phase routing, and all four phase bodies inline. It is now three separated concerns.

**`src/program.ts` — composition only.** Read the inputs once (`readInputs`), read the installation token back for identity diagnostics, resolve the workflow phase, and run the one step that phase names. Nothing else: no formatting, no step bodies, no I/O beyond what those three require. The routing is a five-arm switch (`branch-management`, `validation`, `publishing`, `close-issues`, default no-op).

`inputs.phase` is an `Option<WorkflowPhase>` **decoded against the literal union**, not an `as WorkflowPhase` cast. Under the cast a typo (`publshing`) satisfied the type, missed every switch arm, fell through to `default:` and returned — the release silently did nothing and the job went green. The decode fails the run instead.

**`src/steps/` — one module per phase body.** Each declares its **failure posture** in its module docs *and* in its error channel, which is the load-bearing part: `never` in the error channel means "this degrades", and the docs say what that degradation looks like downstream.

| Module | Phase | Failure posture |
| ------ | ----- | --------------- |
| `steps/branch-management.ts` | 1 | fail-the-job; constructs no error of its own |
| `steps/publish-release-plan.ts` | 1 | degrade-to-warning (`withReleasePlanSection` combinator) |
| `steps/validation.ts` | 2 | fail-the-job, with check-run cleanup; errors re-raised untouched |
| `steps/link-issues.ts` | 2 | degrade-to-warning — **invisible** (`LINK_ISSUES_FAILED`) |
| `steps/build-validation.ts` | 2 | degrade-to-warning — **visible**; `buildValidationFailed(cause)` reports `success: false` and cascades red |
| `steps/publish-validation.ts` | 2 | degrade-with-a-finding — **visible**; quiet `SKIPPED_PUBLISH_VALIDATION` when the build failed, `crashedPublishValidation(message)` when the dry-run threw |
| `steps/per-step-checks.ts` | 2 | degrade-to-warning — **invisible** (`""` URL → `null` row) |
| `steps/publish-validation-report.ts` | 2 | degrade-to-warning — **invisible** |
| `steps/publishing.ts` | 3 | fail-the-job; raises `PublishError` rather than returning |
| `steps/close-issues.ts` | 3a | fail-the-job; a missing PR number is a skip, not a failure |

Two supporting extractions sit outside `steps/` because they do no I/O and declare no requirement channel:

- **`src/release/validation-checks.ts`** — `deriveValidationChecks` (pure) plus `applyCheckUrls`. See [Check derivation](#check-derivation).
- **`src/utils/write-sections.ts`** — the shared read-fold-refresh-post used by *both* phases' managed-comment writes. See [Managed Sections](#managed-sections).

`steps/validation.ts` fell from 624 to 278 lines across six such extractions. `steps/branch-management.ts`'s hand-rolled `BranchManagementSeams` record — six injected functions plus a `SeamError` union derived through `Effect.Error<ReturnType<typeof …>>` — collapsed into the single higher-order `withReleasePlanSection` combinator.

> ⚠️ `steps/validation.ts`'s own body is still uncovered: no test executes `runValidation`, so a green suite says nothing about the wiring — only about the six modules it calls. Replacing the body with `Effect.die` would leave the suite green. The module says so in its own docs.

### Inputs and Outputs (Single Decode Point)

**`src/schema/inputs.ts`** is the single decode point for every `action.yml` input. `action.yml` is the source of truth for names and defaults; this module mirrors both, exports `INPUT_NAMES` (a const tuple — names-as-data) and `readInputs`, and `__test__/schema-inputs.test.ts` asserts they never drift.

The sync check has **three legs**: the manifest, the `INPUT_NAMES` tuple, and what the code actually reads. Any two agreeing while the third drifts is exactly how a dead read (`build-command`) and an unimplemented input (`custom-registries`) both survived for months.

Two rules are enforced by that test:

1. An input is read here and nowhere else, bar a short allowlist with stated reasons (`pre.ts` is a separate process; `auto-merge.ts` is a definition site; `npm-token` is read at the publish boundary).
2. `dry-run` is decoded here **only** to build the `DryRun` service, which every consumer then asks instead of re-reading the input.

`main.ts` went from 11 `ActionInput` reads to zero. `release-branch` went from six call sites each restating `"changeset-release/main"` to one.

**`src/schema/outputs.ts`** is the counterpart, holding `PRE_OUTPUT_NAMES`, the MAIN-phase scalar names, `OUTPUT_NAMES`, and `emitReleaseOutput` (moved out of `main.ts`). The split by phase is deliberate: `token` / `installation-id` / `app-slug` can only be produced by the pre process, so one `emitOutputs` covering all twelve would have to lie about which process can produce which. `__test__/schema-outputs.test.ts` parses the manifest, scans what `src/` writes, and asserts the three name sets partition `OUTPUT_NAMES` exactly.

### Layer Graph

**`src/layers/app.ts`** builds `MainLive`. What is deliberately *absent* is as important as what is present: `ActionEnvironment`, `ActionLogger`, `ActionOutputs`, `ActionState`, `NodeServices` and an `HttpClient` all arrive from `ActionRuntime` via `Action.run`, and because `ActionRunOptions.layer` is `Layer<R, never, ActionServices>` this layer may **require** them rather than rebuild them.

`makeAppLayer(dryRun)` composes:

- `GitHubToken.clientLayer()` (`Layer.orDie`) — reads the installation token back from `ActionState`; no `process.env.GITHUB_TOKEN` bridge.
- `Repo.layerFromConfig()` — required per call rather than captured at construction, so a scoped `Repo.provide` is not silently a no-op.
- The `@effected/github` resource layers, provided over that client. GraphQL is a member of `GitHubClient`; there is no separate service to wire.
- `NpmRegistry.layer` over `FetchHttpClient.layer` — registry reads are HTTP, not `npm view` subprocesses.
- `PackagePublish.layer` over `NodeServices.layer`.
- `OidcTokenIssuer.layer` and `SigstoreSigner.layer` (over `ActionsIdentityToken.layer`).
- `DryRun.layerFrom(dryRun)`.

**`LocalExec`, `Git` and `PackageManagerDetector` are required here, not built here.** They come from `release/layers.ts`, and `MainLive` satisfies the requirement with `Layer.provideMerge(releaseLive)`. Building them in the app layer minted a *second* `WorkspaceDiscovery` — two filesystem scans and two answers that can disagree between the publish path and the release path — and `Layer.mergeAll`'s later-wins then shadowed the duplicates, which merely hid the second graph rather than preventing it.

`toolDiscovery` is composed separately over `LocalExec.layerNone`, self-contained on purpose: `formatWorkspaceWithBiome` asks "is biome on PATH", which is a different question from the workspace-aware launcher `PackagePublish` needs for `NpmExecutor.dlx`.

`dry-run` reaches `makeAppLayer` as a **value**, decoded by `readInputs` at layer construction, so the layer stays free of config reads and a test can drive both branches without a `ConfigProvider`.

**`src/release/layers.ts`** owns the workspace graph:

- `WorkspacesLive = Workspaces.layerWithGit()` — bound to a single `const` because the factory mints a fresh reference per call and layers memoize by reference. `layerWithGit` rather than `layer`: it adds `Git`, `WorkspaceSnapshots` and `ChangeDetector` for the same requirements the git-free form already had. `Git` is what Phase 2 reads the target branch's `.changeset` directory with instead of shelling out.
- `LocalExecLive = Workspaces.localExecLayer()` over that same const — asks the *detected* manager what its run-a-local-tool argv looks like, so `NpmExecutor.dlx` resolves to `pnpm dlx npm@11` in a pnpm workspace and the npm equivalent in an npm one. It replaced a static `LocalExec.layerFor("pnpm", …)` that asserted pnpm regardless of the workspace.
- `NativeVersioningLive` — `Changesets.ReleasePlanner.layer` over `ConfigInspector.layer`, provided by `ChangesetConfigReader.layer` and `WorkspacesLive`.
- `ReleaseLive = WorkspacesLive + LocalExecLive + ChangesetConfigLive + SilkPublishability.layerAdaptive + NativeVersioningLive`.

`ReleaseLive` is piped exactly **once**, in `layers/app.ts`. A differently-piped value is a different layer reference and would build a second workspace graph — which is why `LocalExec` is constructed inside `release/layers.ts` against the same const rather than derived from that pipe.

### Phase Detection

**`detect-workflow-phase.ts`**

The phase router determines which phase to execute from the GitHub event context, read through `GitHubClient` + `ActionEnvironment`.

Detection priority order:

1. **Explicit phase** — If the `phase` input is provided, skip detection and use it directly (decoded against the literal union). This supports the `silk-router-action` pattern where phase is pre-determined.
2. **Phase 3a (close-issues)** — `pull_request` event where the release PR (`changeset-release/main` to `main`) was merged. Detected from event payload without API calls.
3. **Phase 3 (publishing)** — Push to main with a release commit. Two-strategy detection with retry: primary queries `listPullRequestsAssociatedWithCommit`; fallback queries recently closed PRs from the release branch and matches `merge_commit_sha`. 3 attempts with 5-second delays handle GitHub API eventual consistency.
4. **Phase 2 (validation)** — Push to the release branch.
5. **Phase 1 (branch-management)** — Push to main that is not a release commit.
6. **None** — Any other branch or event. Logs a skip message and exits.

### Phase 1: Release Branch Management

Triggers on push to `main` (non-release commits). `steps/branch-management.ts` is the phase body. **No injected seams**: the branch flows, the branch probe and the history fetch are called directly, because what used to make them injectable — observing what the phase publishes to the PR under a failing, dying or interrupted flow — is now `withReleasePlanSection`'s job, and that takes the flow as a single effect parameter.

Publishability detection flows through `SilkPublishability.layerAdaptive` (silk rules in silk mode; see [Publishability Detection (Silk Rules)](integration.md#publishability-detection-silk-rules)). Supporting modules:

- **`check-release-branch.ts`** — Whether the release branch exists and whether an open PR exists from it to the target branch, via `GitBranch.exists` + `PullRequest.list`.
- **`ensure-full-history.ts`** — Gives changesets the git history it needs: full depth, and a **local** ref for the target branch. The `isShallow` probe goes through `Effect.result` (a non-zero exit means "not shallow", not "stop"), and it gates the `fetchUnshallow`. Phases 1, 2 and 3 all need this and each previously carried its own copy.
- **`create-release-branch.ts`** — Creates a branch from `origin/{targetBranch}`, applies pending changesets natively via `runNativeVersion`, runs the conditional Biome format step, creates a signed commit via `GitCommit` (Git Data API — auto-signed by the App), links the branch to issues found in changeset files via `GitBranch.createLinked` (the one operation with no REST equivalent), and opens a PR with standard labels. PR creation is retried once on a network blip.
- **`update-release-branch.ts`** — Recreates the branch from main rather than rebasing. Collects linked issues from changesets before versioning natively, then commits with the main branch HEAD as parent. Handles PR reopening if the branch was previously deleted. When versioning produces no changes the branch would be identical to main — an invalid "nothing to release" state — so the flow closes any open release PR (`PullRequest.update`), deletes the branch (`GitBranch.delete`), skips the reopen/title-update/create-PR steps (guarded by an internal `branchDeleted` flag) and emits a `neutral` check-run conclusion. `UpdateReleaseBranchResult.deleted` signals this to the step, which reports `updated: false` and a null release PR.
- **`porcelain-changes.ts`** — Turns a `git status --porcelain -z` listing (via `@effected/git`'s `StatusEntry`) into the `FileChange` set a Git Data API commit carries. This lived twice — once in each branch flow, byte for byte, with the same two defects in both copies.
- **`auto-merge.ts`** — Opt-in auto-merge for the release PR. Off unless a workflow asks: enabling auto-merge means the next green check publishes packages, which is a release-posture decision the action should not make on a consumer's behalf.

#### Native versioning (zero-install)

Phase 1 versions in-process — the action no longer shells out to the consumer's `ci:version` script and the `version-command` input is removed from `action.yml`. Both branch-management flows call `runNativeVersion(cwd)` (`src/utils/native-version.ts`), which drives the bundled silk-effects `Changesets.ReleasePlanner.apply` — the same engine `savvy changeset version` runs — after validating `.changeset/config.json` via `Changesets.ConfigInspector` (an absent config proceeds, matching the savvy CLI's gate).

Key mechanics:

- **Changelog id map** — `CHANGELOG_MODULES` maps the consumer config's changelog id onto action-shipped ESM bundles, so no consumer `node_modules` is required. The three silk ids resolve to `dist/changelog-silk.js` (silk-effects `changelogFunctions`) and `@changesets/cli/changelog` resolves to `dist/changelog-default.js` (`@changesets/changelog-git`). An unmapped id fails inside `ReleasePlanner.apply` with a typed error naming it. The bundles are emitted as worker entries in `action.config.ts`; `build.nativeDynamicImports` keeps the runtime dynamic imports inside `@changesets/apply-release-plan` and `@effected/workspaces` native, because rspack otherwise compiles them into context modules that throw on on-disk paths.
- **Token scoping** — the changelog GitHub-info fetch reads `process.env.GITHUB_TOKEN` directly, so `runNativeVersion` calls `GitHubToken.read()` itself and sets the variable strictly around the apply (the App token wins over any ambient `GITHUB_TOKEN` the job exports), restoring the prior state after. There is no `STATE_token` process-environment bridge and no `utils/tokens.ts`; both were deleted. See [Token Plumbing](integration.md#token-plumbing).
- **Reset-then-retry** — `apply` is not idempotent (it deletes consumed changesets), so on a transient failure (`ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `EAI_AGAIN`, `fetch failed`) the flow resets the tree (`Git.restore` + `Git.clean`), pauses one second and retries exactly once.
- **Format-preserving versionFiles writes** — the bundled silk-effects engine applies changesets `versionFiles` bumps as in-place jsonc edits rather than a `JSON.parse`/`JSON.stringify` round trip, so a version bump produces a one-line diff and inline arrays, indentation and JSONC comments survive byte-for-byte. Formatting integrity therefore no longer depends on the post-version Biome pass — which matters because that pass silently skips in zero-install runs when the consumer's biome config extends a `node_modules` package.
- **Post-version formatting** — `formatWorkspaceWithBiome` (`src/utils/format-workspace.ts`) replaces the `&& biome format --write .` tail of the removed consumer script, probing for the standalone binary through `ToolDiscovery`. See [the format policy](integration.md#native-versioning-and-zero-install-phase-1) for the warn-vs-fail rules.
- **Layer** — `NativeVersioningLive` in `src/release/layers.ts`, merged into `ReleaseLive`. The platform `FileSystem`/`Path` come from `NodeServices.layer`.

#### Release PR and commit titles

Both branch-management modules resolve the PR title and the commit subject from the packages that will release, using helpers in `release-summary-helpers.ts`. The flow is: `listAllPackages` (every workspace package, publishable or not — see below) → `getReleasingPackages` (the subset whose `package.json` changed in this version bump) → `resolveReleasePrTitle`. `formatReleasePackageList` renders the commit body. The per-package-versioning signal comes from `isMonorepoForTagging(process.cwd())` (Effect-based, resolved through the same detector plus `ChangesetConfig.fixed`).

**Detection runs over every workspace package, not the publishable subset, and has no fallback.** A private tracking package is not publishable, so titling from `listPublishablePackages` alone could never name the packages a `github-only` release consists of — detection over that narrower set found nothing, and the old fallback then claimed the *entire* publishable set was releasing, which is how a two-package private wave was titled `release: 31 packages`. `listAllPackages` (`utils/release-summary-helpers.ts`) is every workspace package from `WorkspaceDiscovery`, each carrying its resolved `targetCount` from the publishable set (`0` when absent — i.e. `github-only`). Detection over that full set has no "claim everything" fallback: an empty match honestly falls through to `NOTHING_TO_RELEASE_TITLE` or the single-package-repo branch, and a warning is logged rather than silently naming packages nothing actually released.

The title format keys off versioning topology rather than how many packages release this run, so the PR title and the git tag strategy stay aligned:

- `perPackageVersioning === false` (a single releasable package, or a fixed group sharing one version) → `release: <version>`, mirroring the commit title.
- `perPackageVersioning === true` (multiple packages on independent versions) → `release: name@version, …`, even when only one releases. The shared npm scope is omitted when every releasable package is under one scope (mixed scopes keep full names), and the list collapses to `release: <count> packages` past `RELEASE_TITLE_MAX_LENGTH` (100).
- Nothing releasing in a single-package repo → the root `package.json` version.

The commit subject matches the PR title; the commit body is a bullet list of full (scoped) `name@version` from `formatReleasePackageList`, so the commit is an unambiguous record even when the title omits a shared scope.

#### Release PR body (managed region)

**The implementation is upstream, not in this repo.** `PrBody` in `@savvy-web/silk-effects` (see `package.json` for the declared range) builds the slice of the release PR *description* this action owns, delimited by `<!-- silk-release:start -->` / `<!-- silk-release:end -->` so `ManagedPrBody.upsert` can regenerate it without disturbing prose a human wrote around it. Both branch-management flows call `PrBody.ManagedPrBody.build`; only `update-release-branch.ts` has a prior description to feed back in, via the optional `priorBody` argument.

The local `src/utils/pr-body.ts` was deleted in [#209](https://github.com/savvy-web/silk-release-action/issues/209) — the same contract was maintained twice, here and in `silk-update-action`, and the two copies had begun to drift. The names map one-for-one:

| Was (local `utils/pr-body.ts`) | Now (`PrBody` from `@savvy-web/silk-effects`) |
| :--- | :--- |
| `buildManagedPrBody(args)` | `PrBody.ManagedPrBody.build(args)` |
| `upsertManagedRegion(existing, managed)` | `PrBody.ManagedPrBody.upsert(existing, managed)` |
| `extractSummary(existing)` | `PrBody.ManagedPrBody.extractSummary(existing)` |
| `extractReferences(existing)` | `PrBody.ManagedPrBody.extractReferences(existing)` |
| module constants `MANAGED_START`, `REFERENCES_START_PREFIX`, … | `PrBody.Markers.*` |

The namespace also carries `PrBody.LinkedIssueRef` (a `Schema.Class` over `{ number, title, state }` with the static `isClosed`), `PrBody.ClosingReferences`, `PrBody.Region`, `PrBody.OwnedAttribute` and `PrBody.PrBodyDiagnostic.scan`; this action uses `ManagedPrBody`, `Markers` and `LinkedIssueRef`.

Four properties of the body are load-bearing:

- **Two spellings of the closing references, deliberately not deduplicated.** GitHub's linker only counts a bare `Closes #N` alone on a line and outside any fence; commitlint reads a single comma-joined `Closes #1, #2` trailer. The proposed-squash-commit fence therefore carries its own copy of the references and the plain lines are emitted separately. Empirically verified against `savvy-web/silk-integration` PR #243, after first release PRs shipped with an empty body and linked nothing (#242, #232).
- **Nested regions are reserved, never written by this action.** The summary region (`silk-release:summary:*`) is held open for an AI summariser that runs elsewhere, and the reference region (`silk-release:references:*`) is emitted whether or not there is anything to put in it — an empty region is still an addressable target. Because the managed region is rebuilt on every push to the release branch, content inside a nested region must be read out of the prior body and re-emitted or it is silently destroyed; `ManagedPrBody.extractSummary` and `ManagedPrBody.extractReferences` do that reading. Locate the reference region by `Markers.REFERENCES_START_PREFIX`, never the plain `REFERENCES_START`, because every region this action emits carries an `owned="…"` attribute on the opening marker.
- **An `owned` attribute on the reference marker decides the merge.** This action decides every issue in `linkedIssues` — emitted when open, dropped when closed — and records the ids it emitted on the opening marker (`owned="1,2,3"`). The next run subtracts them, so what carries through is exactly what this action never wrote. Without the attribute an id absent from `linkedIssues` is ambiguous between an agent's addition and a reference this action emitted before it stopped tracking that issue, and preserving both would re-link — and on merge auto-close — an issue the release deliberately dropped. A malformed or absent attribute degrades to "none owned", preserving rather than deleting.
- **Closedness is decided by `PrBody.LinkedIssueRef.isClosed`, never a bare `state === "closed"` comparison.** The local implementation compared `state !== "closed"` and was wrong: `GitHubIssue.linkedIssues` is a **GraphQL** read (`closingIssuesReferences`), which returns the enum spelling `CLOSED`, and `@effected/github` does not normalise it. Every closed issue therefore failed the lowercase comparison, was classified as open, and got both a bare `Closes #N` line and an entry in `owned="…"` — so the action re-linked issues the release had deliberately dropped and re-closed them on merge. `isClosed` lowercases before comparing, so REST (`"closed"`) and GraphQL (`"CLOSED"`) payloads both classify correctly. Adopting `PrBody` fixed that live defect; it is not a behaviour-neutral refactor.

#### The release-plan comment section

`src/steps/publish-release-plan.ts` owns what Phase 1 publishes to the release PR's **sticky comment**, and in what state, while the branch work runs. It is separate from `steps/branch-management.ts` because the two answer different questions: branch management decides *what the release is*; this decides *what a reader of the PR sees about it, and when*.

`withReleasePlanSection` brackets the branch flow: it writes `running` before the work and a terminal state on every exit — success, failure, defect or interrupt. The state machine itself is `withSection` in `utils/managed-sections.ts`; the read-modify-write is `utils/write-sections.ts`, shared with Phase 2. What this module proves is the *wiring*: which arm gets bracketed, what sections go in and in what order, what body survives a failure, and whether anything is written at all in a rehearsal.

Every write goes through `Effect.result` and a failed one becomes a logged warning — `withSection` types `publish` as infallible for exactly that reason, because a finalizer that could fail on the way out would replace the caller's real error with a reporting one.

The release table itself is `utils/release-table.ts`, shared between the phase that *plans* a release and the phase that *validates* it. Phase 1 knows the **shape** of every column, `targets` included — publishability is declared in `package.json`, so what a package will publish to needs no build to know. The `targets` cell therefore renders the resolved shape from the first render (`releaseKindCell("github-only")` or `N target(s)`), not a `pending` placeholder; only *readiness* needs the build, which is what Phase 2's `toValidatedReleaseRows` replaces the cell with (`n/m ready`). Rendering both facts as `pending` used to hide a decided one behind an undecided one. `utils/release-plan.ts` is the pure projection of `ReleasePlanner`'s plan into what Phase 1 reports (which packages a release covers, how many changesets asked for it, and each one's pre-build target count via `PlannedPackage.targetCount` — all three have been wrong in production).

### Phase 2: Release Validation

Triggers on push to the release branch. `steps/validation.ts` is the phase body and holds only the **order** the six extracted modules run in and the values that flow between them. Failure posture is fail-the-job; the body's errors are caught only to tear down in-flight check runs (`cleanupValidationChecks`) before being re-raised untouched.

The six extractions:

1. **`steps/link-issues.ts`** — finds the issues the release closes (`linkIssuesFromCommits`) and reports them as a check run.
2. **`steps/build-validation.ts`** — runs every package's build (`validateBuilds`) and reports it as a check run.
3. **`steps/publish-validation.ts`** — the publish / release-notes / SBOM region. This module exists to give the twelve mutable `let` bindings that used to coordinate it a name and a type: they were never twelve independent variables, but one optional `ValidationReport` plus a default. `PublishValidationResult` and `SKIPPED_PUBLISH_VALIDATION` are that record and that default. Naming the default is as much the point as the extraction — "what does Phase 2 report when the build failed?" was previously answerable only by reading twelve separate initialiser expressions. The two paths that reach the default are **not** interchangeable: the build-failed path keeps the quiet baseline, while a crashed `runValidation` returns `crashedPublishValidation(message)` — the same baseline plus an `error` finding per affected check. See [Degradation semantics](#degradation-semantics-issue-216).
4. **`release/validation-checks.ts`** — the pure derivation. See below.
5. **`steps/per-step-checks.ts`** — the three per-step check runs, created *after* the canonical projection is known because each summary renders from it. That ordering is why the three rows carry a `null` URL when first derived and are patched afterwards by `applyCheckUrls`.
6. **`steps/publish-validation-report.ts`** — the write to the release PR's sticky comment.

The publish/SBOM engine underneath is **`src/release/validation.ts`** (`runValidation`), a pure Effect program. It enumerates workspace packages, diffs versions against the target branch to discover which packages are being released (`detectReleasedPackages` drops changeset-ignored names entirely via `ChangesetConfig.isIgnored`, so they never appear, not even as version-only rows), orders the released set dependency-first through `sortReleasesTopologically` (matching Phase-3 order; a cyclic graph falls back to discovery order rather than aborting), resolves publish targets via `resolvePublishableTargets`, groups targets by build directory, runs `PackagePublish.dryRun` per build directory, generates one SBOM per build directory, applies `sbom-config` metadata, and assembles a `ValidationReport`. The report is build-centric: `ValidationPackageResult` carries builds, sizes, SBOMs, and registry targets. `strict-warnings` mode escalates warning-severity findings to `failure` for auto-merge gating.

`runValidation` wraps `resolvePublishableTargets` in `Effect.either`. A `Left` carries a `PublishTargetBindingError` — detection selected a directory the package's `dist/prod/targets.json` binding does not describe, so the bytes about to be packed are not the prod release artifact. On that `Left` the flow logs the error, pushes a `severity: "error"` finding scoped to `{ package, directory }` under `Publish Validation`, records an empty `builds` list for the package and continues. The error finding drives the check-run conclusion to failure (blocking auto-merge), yet the remaining packages still validate and report — the run does not abort. This is the Phase-2 guard against packing an unresolved dev build (issue #144).

The dry-run dispatches through the same npm executor as the live publish, via `LocalExecLive`'s workspace-aware launcher, so a dry-run validates against the exact npm the Phase-3 publish will run rather than the runner's bundled one. See [Authentication and publishing](integration.md#authentication-and-publishing).

Phase 2 emits three per-step Check Runs — `Publish Validation`, `Release Notes Preview` and `SBOM Preview` — plus a unified check. Their titles carry no decorative leading icons; the only title decoration is the `🧪` marker prepended in dry-run mode. The per-build log mirrors the Phase-3 publish tree: one collapsible group (`grouped("Validate · pkg@version[ · group]")`) per build directory containing a pack sizing line, per-registry `⬆ <registry> · ready/not-ready` rows and an SBOM line. The group title disambiguates by byte-group id (`getGroupId`) only when a package spans multiple builds.

Every check-run summary is passed through `capCheckSummary` (`src/utils/create-validation-check.ts`) before completion. This caps the summary at GitHub's 65535-**byte** limit (UTF-8 bytes, not characters — emoji and box-drawing glyphs each count as several bytes), truncating on a byte budget without splitting a multi-byte sequence and appending a truncation notice. Without it large monorepos 422'd the check completion. Release-notes CHANGELOG content is the main size driver, so per-package `releaseNotes` are stripped from the structured `result` output and the embedded JSON block — the full notes live only in the Release Notes Preview check.

#### Check derivation

`src/release/validation-checks.ts` is pure and service-free: every value Phase 2 reports about *whether the release is OK* is computed from five already-decided facts, so the whole decision surface is assertable without a runtime, a layer or a check-run double. It is not under `steps/` deliberately — `steps/` is for orchestration units that do I/O and declare a requirement channel, and this does neither.

`CHECK_NAMES` lists the five checks in report order:

```text
Link Issues from Commits
Build Validation
Publish Validation
Release Notes Preview
SBOM Preview
```

These strings are a **join key**, not labels: `deriveCheckConclusion` filters findings by `finding.check === name`, and `BUILD_INDEPENDENT_CHECKS` matches on them too. A row renamed here without renaming the finding that targets it silently detaches the finding from its check — the conclusion goes green and the finding still appears in the JSON. They were previously written out five times each across three separate literals.

`deriveValidationChecks(inputs)` returns findings, per-check `results`, checks-table `rows` and a `summaryLine`. `applyCheckUrls(rows, urls)` patches in the per-step check URLs afterwards, without mutating the rows it was given.

#### Degradation semantics (issue #216)

**A Phase-2 step that degrades without contributing a *finding* reports a green release verdict for work that never ran.** That is [issue #216](https://github.com/savvy-web/silk-release-action/issues/216). **The publish-validation crash path is fixed; the other paths are still live** and remain pinned by `CHARACTERIZATION` tests in `link-issues-and-build-steps.test.ts`, `per-step-checks.test.ts` and `publish-validation-report.test.ts`, written to fail when *their* fix lands.

The mechanism: `deriveCheckConclusion`'s cascade is gated on `!buildPassed`. When the build genuinely **passed** but a downstream step crashed, a step that degrades to a default value carrying no failure signal contributes **no finding** — and findings are the only thing the verdict reads.

**Fixed — a crashed publish validation.** It used to hand back `SKIPPED_PUBLISH_VALIDATION`, whose baseline is `publishOk: true`: no publish dry-run ran, no SBOM check ran, and the release PR got ✅ 5/5 with every row `pass`. The step now separates its two non-running paths:

- **Build failed** — still `SKIPPED_PUBLISH_VALIDATION`, still deliberately quiet. The caller's build finding already fails the phase and the build-failed cascade already covers every downstream row, so speaking here would double-count.
- **`runValidation` threw** — `crashedPublishValidation(message)`, which spreads that same baseline with **every boolean unchanged** (`publishOk: true` included) and adds one `error`-severity finding per check in `PER_STEP_CHECK_NAMES` (`Publish Validation`, `Release Notes Preview`, `SBOM Preview`), each carrying the rendered crash. The only other difference is `sbomSummary`, which says the preview did not run because publish validation crashed rather than "skipped". `Build Validation` and `Link Issues from Commits` are deliberately untouched — the build really did pass, and issue linking is a different step. The names come from the shared constant because they are a **join key**: a name that drifts from it detaches the finding from its row and the conclusion silently returns to green.

The crash arm also stops reusing the ok/not-ok ternary for its three log lines and prints `❌ … did not run (crashed)`. The ternary reads `publishOk`, which stays `true` on that path by design, so it printed `✅ Publish validation` for a dry-run that never happened — the log-shaped half of the same bug.

**Still live.** Each of these still degrades silently when the build passed:

- A crashed issue-linking step yields `LINK_ISSUES_FAILED`, which is indistinguishable from a successful run that found nothing (`✅ Link issues — 0`). `LinkIssuesResult` carries no failure signal and no finding is scoped to that check.
- A check run that could not be created yields `""`, which becomes a `null` row URL — indistinguishable from a row that legitimately has no page yet.
- A failed comment write contributes no finding, and a failed pull-request *lookup* is reported with the same line as "there is no release PR".

**`strict-warnings` does not rescue any of this** — there is no warning to escalate, so the strictest available setting still reports green on the remaining paths. That is pinned as its own test because "turn on strict-warnings" is the obvious wrong fix. Symmetrically, the fix does not *depend* on it either: `crashedPublishValidation`'s findings are errors, which fail the row at any setting.

**Build validation always degraded honestly.** `buildValidationFailed(cause)` reports `success: false` with the rendered cause in `errors`, which the derivation turns into an error-severity finding and then cascades onto every build-dependent row. A crashed build validation fails the phase exactly as a failed build does. That asymmetry is the *point* of the step being separate: the build is the gate everything downstream is conditioned on, and issue linking is not.

Two rules the publish-validation fix established, both load-bearing for the paths still to be fixed:

1. **Contribute a finding; do not flip a boolean.** Findings are the only input the verdict reads, which is what makes this one decision rather than a patch per path. Flipping `SKIPPED_PUBLISH_VALIDATION`'s `publishOk` to `false` is the wrong fix, and always was: the baseline is `true` precisely so the `buildPassed: false` path, where the cascade *does* cover every downstream row, reports correctly. `crashedPublishValidation` therefore reuses the baseline untouched and adds only findings.
2. **Never widen `Effect.catch` to `catchCause`.** A **defect** from `runValidation` still propagates and kills the phase. That is the one path where a broken validation fails the run outright, and catching it would route the last honest failure signal into the same degraded result the rest of the step builds.

### Phase 3: Release Publishing

Triggers on merge of the release PR to main. `steps/publishing.ts` is the phase body; the orchestration lives in `src/release/`. Failure posture is fail-the-job: a failed build/SBOM gate or a partial publish raises `PublishError` rather than returning — `setFailed` only annotates, and returning is what once let a 4-of-8-target publish report a green run.

The Phase-3 steps in sequence:

1. **`detectReleases`** (`src/release/publish.ts`) — Detects released packages from the merged PR's file diff (PR-first) or commit diff (fallback), then drops changeset-ignored names entirely via `ChangesetConfig.isIgnored`.
2. **`planWorkspaces`** (`src/release/publish.ts`) — **Deliberately ahead of the Build & SBOM gate.** Resolves every detected workspace's publish targets via `resolvePublishTargetSpecs` (shared with the Build & SBOM gate below) before anything is built, and classifies each as `github-with-packages` or `github-only` via `utils/release-kind.ts`. Target resolution reads manifests only, so it is cheap and cannot fail — which is what lets an aborted run still report every workspace's `kind` and intended publication count, rather than losing the wave's membership entirely (the old output derived membership from `publishResult.packages`, which is empty on an abort).
3. **`runBuildAndSbom`** (`src/release/publish.ts`) — Runs `ci:build` once, then generates one CycloneDX SBOM per package **that resolved a publish target**. A `github-only` workspace has no tarball to describe and no release asset to attach an SBOM to, so it is skipped and named in `BuildSbomResult.sbomSkipped` rather than getting a stray, unattached SBOM document. Aborts the phase if the build fails. Returns `BuildSbomResult` including per-package SBOM paths and the skip list.
4. **`runPublishTargets`** (`src/release/publish.ts`) — Publishes packages. Discovers workspace packages, resolves publish targets via the same `resolvePublishTargetSpecs`, sorts topologically via `sortReleasesTopologically` (idempotent — the step has already ordered the set), and calls `publishDirectoryGroup` for each unique build directory. Aborts before any releases if fewer than half the targets published.
5. **`runReleases`** (`src/release/releases.ts`) — Creates Git tags (sha-aware idempotency) and GitHub releases, uploads group-keyed tarball, SBOM, API-doc and `meta.tgz` assets, creates SLSA provenance and SBOM attestations (idempotent: checks for an existing attestation before writing). One attestation per build directory, not per target. Asset names are keyed by byte-group via `src/utils/group-id.ts`.
6. **`buildPublishSummary`** (`src/release/report.ts`) — Generates the sticky-comment publish summary and Check Run output.

Ordering is established **once, at the source**: immediately after `detectReleases`, `steps/publishing.ts` orders the detected set dependency-first via `sortReleasesTopologically`, so every downstream step — tag strategy, build & SBOM, publish and GitHub releases — runs in the same order. Previously only `runPublishTargets` sorted topologically while tag strategy and `runReleases` consumed the detection-order (alphabetical) set. The helper builds a `DependencyGraph.make({ packages })` from `WorkspaceDiscovery.listPackages()` (there is no standalone `TopologicalSorter` service in `@effected/workspaces`), filters `DependencyGraph.sortSubset`'s dependency closure back to the released subset, and falls back to detection order on a cyclic graph.

`determine-tag-strategy.ts` decides between single-tag and per-package tag strategies and runs between steps 4 and 5. The step resolves the per-package-tags boolean via `isMonorepoForTagging(process.cwd())` and passes it to the pure `determineTagStrategy(publishResults, needsPerPackageTags)`.

The close-linked-issues follow-on inside this step degrades to a warning: it is housekeeping after a successful release.

#### Release kind — `github-with-packages` vs `github-only` (`src/utils/release-kind.ts`)

A release wave is not assumed homogeneous. `utils/release-kind.ts` names the split every surface now shares: a workspace that resolved at least one publish target is `github-with-packages` (merging the release PR uploads a tarball somewhere); one that resolved none is `github-only` — versioned, changelogged, tagged and given a GitHub release, publishing to no registry. **This is the intended steady state for a private tracking package — one that exists only to give changesets something to version — not a degraded `github-with-packages`.** Before this module the two were told apart ad hoc by asking whether some array happened to be empty, rendered as `⏭️ no targets`, which reads as "something was skipped" when nothing was ever meant to happen; the render is now `🏷️ GitHub release only` (`releaseKindCell`).

The vocabulary is shared, not per-phase: `releaseKindOf(targetCount)` classifies, `releaseKindLabel`/`releaseKindIcon`/`releaseKindCell` render, `tallyReleaseKinds` counts a wave, and `summarizeWorkspace` / `summarizeValidationWorkspace` / `summarizeReleaseWave` / `summarizeBranchManagement` / `summarizeValidation` derive every phase's one-line `summary` field from the same structured facts — never authored independently, so the wire prose cannot drift from the data beside it. It is used by the Phase-1 table (`utils/release-table.ts`'s `targets` column), the Phase-2 comment and check-run summaries (`release/report.ts`), and the Phase-3 log and output (`release/publish.ts`, `schema/release-output.ts`).

#### `publishDirectoryGroup` three-way probe-then-decide

For each npm target in a directory group:

1. **Pack once** — `PackagePublish.pack(directory)` runs once for the group; the same tarball (same digest) is used for all targets.
2. **Token resolution** — `pickToken` resolves the registry's credential. A GitHub Packages target with no token fails *by name* ("no github-token input"), because the symptom otherwise is four identical 403 integrity-probe lines that read like a package permissions problem.
3. **Auth setup** — `PackagePublish.setupAuth` (taking a `Redacted<string>`) writes the token to the npmrc before the probe. The probe is now an HTTP read carrying its own token so it no longer needs an npmrc; the ordering is kept anyway rather than reordering a publish pipeline's authentication sequence for tidiness.
4. **Probe** — `NpmRegistry.version` checks whether the version is already on the registry.
5. **Decide** — Three outcomes: version absent → publish tarball → `published`; version present with matching digest → recovery skip → `skipped-identical (recovery)`; version present with digest mismatch → abort → `failed-mismatch`.
6. **Attestation** — After all targets in the group resolve, existing provenance and SBOM attestations are checked for and fresh ones written only if absent. The assembly of "build and sign a statement" (`@effected/sbom`) with "store the bundle" (`@effected/github`) is `src/release/attest-helpers.ts`, in one place so `publish.ts` and `releases.ts` do not each grow a copy.

#### Abort-before-releases gate

After `runPublishTargets`, the step checks whether the publish results warrant creating GitHub releases. The rule: if fewer than half the targets published (i.e., every target failed or was mismatched), the release step is skipped and the workflow fails. A fully-recovered run (all targets `skipped-identical`) proceeds to release creation normally.

#### Per-byte-group prod layout

Publish and release operate on the `@savvy-web/bundler` prod layout. Each package's `publishConfig.targets` is a Record map resolved through a `dist/prod/targets.json` binding (the resolution lives in `SilkPublishability` / `PublishabilityDetector`, not in this repo), and the build emits one `dist/prod/<group>/pkg` directory per byte-variant group with a sibling `dist/prod/<group>/meta` folder. Registries whose bytes are identical share one group. The orchestrators pack once per build directory; the per-group layout means a build directory corresponds to a byte-group rather than a single per-registry publish dir. `src/utils/group-id.ts` derives the group id from a build directory (`getGroupId("dist/prod/npm/pkg") === "npm"`) for asset naming and step labels.

#### Group-keyed release assets

Release assets are keyed by byte-group. For each group `runReleases` uploads `<name>-<version>.<group>.tgz`, `<name>-<version>.<group>.sbom.json`, `<name>-<version>.<group>.api.json` and an unattested `<name>-<version>.<group>.meta.tgz`. `insertGroupToken(fileName, group, ext?)` inserts the group token before the final extension or, given a compound `ext` (`.meta.tgz`, `.sbom.json`, `.api.json`), strips the trailing extension and appends `.<group><ext>`.

The `meta.tgz` doc bundle packs the bundler's `meta/` folder (`<unscoped>.api.json` + `tsconfig.json` + `package.json`) plus the copied SBOM via `tarMetaFolder` in `src/release/meta-archive.ts`, for downstream documentation builders. API-reference docs (`findApiDocFile`) read from the sibling `meta/` folder (`metaDirFor`), not the publish dir.

### Phase 3a: Issue Closing

`steps/close-issues.ts` runs `close-linked-issues.ts`, which queries the merged PR's `closingIssuesReferences` via `GitHubIssue.getLinkedIssues` (up to 50 issues). For each linked issue it **closes first, then comments**, and creates a Check Run summarizing results. An event payload with no pull-request number is a **skip**, not a failure, and says so on the log.

Three idempotence properties are load-bearing (the module docs in `src/utils/close-linked-issues.ts` carry the full rationale): an already-`CLOSED` issue is skipped rather than re-closed; the close happens *before* the comment, so a failed close posts no comment and a successful one is visible to the next run as `CLOSED`; and the comment itself goes through `GitHubIssue.commentOnce` with a `CommentMarker` carrying the release PR number (`savvy-web:closed-by-release-<pr>`), so a re-run of the same release skips the comment while a later release closing a reopened issue still posts. The marker lookup is create-or-skip and **not atomic** — two racing runs can both post — which is why the close-before-comment ordering stays load-bearing rather than being replaced by the marker.

The event payload is decoded once through a schema (`utils/event-payload.ts`) rather than parsed and cast at each call site — `ActionEnvironment` already exposes the parsed payload, so the file read and the parse are the kit's problem; what is left is deciding which fields to trust.

This phase exists separately from the close-linked-issues follow-on inside `steps/publishing.ts` because a workflow may route the two independently — the merge that publishes and the merge that only closes issues are different events.

### Post-Release Housekeeping (out of action)

The published GitHub release this phase creates is consumed by a **repo-local workflow**, not by the action itself: `.github/workflows/release-sync.yml` listens on `release: [published]` and, for stable SemVer `>= 1.0.0` tags, moves the `v<major>` alias tag to the released commit and hard-resets `dev` to `main`. See **CLAUDE.md → Development & Release Cycle** for the full `dev → main → release` loop.

### Module Dependency Graph

```text
main.ts  (guard + Action.run only)
  |
  +-- layers/app.ts
  |     MainLive = mergeAll(makeAppLayer(dryRun), toolDiscovery)
  |                  .pipe(provideMerge(ReleaseLive))
  |     makeAppLayer requires LocalExec | Git | PackageManagerDetector
  |     ActionsIdentityToken.layer (kit) → SigstoreSigner
  |
  +-- program.ts
        schema/inputs.ts (readInputs — the ONE decode point)
        utils/npm-cache.ts (ensureNpmCacheEnv, before any npm command)
        utils/detect-workflow-phase.ts (routing)
        |
        +-- steps/branch-management.ts  (Phase 1)
        |     utils/check-release-branch.ts
        |     utils/ensure-full-history.ts
        |     utils/create-release-branch.ts
        |       +-- utils/native-version.ts (ReleasePlanner + ConfigInspector)
        |       +-- utils/format-workspace.ts (ToolDiscovery probe)
        |       +-- utils/porcelain-changes.ts (Git status → FileChange)
        |       +-- GitCommit / GitBranch.createLinked / PullRequest (@effected/github)
        |       +-- utils/commit-signoff.ts (DCO trailer)
        |       +-- utils/release-summary-helpers.ts
        |       +-- PrBody.ManagedPrBody.build (@savvy-web/silk-effects)
        |       +-- utils/auto-merge.ts
        |       +-- utils/determine-tag-strategy.ts (isMonorepoForTagging)
        |     utils/update-release-branch.ts   (same chain + priorBody merge)
        |     steps/publish-release-plan.ts    (withReleasePlanSection)
        |       +-- utils/managed-sections.ts (withSection state machine)
        |       +-- utils/write-sections.ts   (shared read-fold-refresh-post)
        |       +-- utils/release-plan.ts / utils/release-table.ts
        |
        +-- steps/validation.ts  (Phase 2 — order and value flow only)
        |     steps/link-issues.ts        → utils/link-issues-from-commits.ts
        |     steps/build-validation.ts   → utils/validate-builds.ts, utils/turbo-summary.ts
        |     steps/publish-validation.ts → release/validation.ts (runValidation)
        |         +-- release/resolve-targets.ts (resolvePublishableTargets, pickToken)
        |         +-- release/changeset-config.ts (ChangesetConfig service)
        |         +-- utils/sort-releases-topologically.ts (DependencyGraph.sortSubset)
        |         +-- utils/count-changesets.ts
        |         +-- utils/extract-release-notes.ts, utils/load-release-config.ts
        |         +-- PackagePublish.dryRun (@effected/npm) + SBOM (@effected/sbom)
        |     release/validation-checks.ts (deriveValidationChecks, applyCheckUrls — PURE)
        |       +-- utils/derive-check-conclusion.ts
        |     steps/per-step-checks.ts    → CheckRun (@effected/github)
        |     steps/publish-validation-report.ts → utils/write-sections.ts
        |     utils/create-validation-check.ts (unified check + capCheckSummary)
        |     utils/cleanup-validation-checks.ts (on failure)
        |     release/report.ts (buildValidationComment, buildChecksTable, …)
        |
        +-- steps/publishing.ts  (Phase 3)
        |     utils/ensure-full-history.ts
        |     utils/sort-releases-topologically.ts  (ordering, ONCE at source)
        |     release/publish.ts
        |       detectReleases     → GitHubContent / PullRequest / GitHubCommit
        |                            + ChangesetConfig.isIgnored
        |       runBuildAndSbom    → LocalExec + @effected/sbom
        |       runPublishTargets  → WorkspaceDiscovery + PublishabilityDetector
        |                            + PackagePublish + NpmRegistry
        |       release/attest-helpers.ts (sign via @effected/sbom, store via @effected/github)
        |     utils/determine-tag-strategy.ts (between publish and releases)
        |     release/releases.ts → GitHubRelease + GitTag + ArtifactMetadata
        |                           + Attestation + OidcTokenIssuer
        |     release/report.ts (buildPublishSummary, …)
        |     utils/close-linked-issues.ts (follow-on, degrades to warning)
        |
        +-- steps/close-issues.ts  (Phase 3a)
              utils/event-payload.ts (schema-decoded webhook payload)
              utils/close-linked-issues.ts

  Cross-cutting:
    release/layers.ts     WorkspacesLive (layerWithGit, ONE const)
                          LocalExecLive (derived from the same const)
                          NativeVersioningLive
                          ReleaseLive = the four above + ChangesetConfigLive
                                        + SilkPublishability.layerAdaptive
    schema/outputs.ts     emitReleaseOutput (all phases)
    schema/projections.ts toBranchManagementOutput / toValidationOutput / toPublishOutput
    utils/grouped.ts      collapsible Actions log groups (all phases)
    utils/github-urls.ts  instance-aware web URLs (GHES-correct)
    utils/summary-writer.ts  job-summary markdown
```

### Shared Infrastructure

- **`src/release/layers.ts`** — the workspace graph and the release-domain layer. See [Layer Graph](#layer-graph).

- **`src/layers/app.ts`** — `MainLive`, `makeAppLayer(dryRun)`, `toolDiscovery`. See [Layer Graph](#layer-graph).

- **`src/utils/write-sections.ts`** — the read-fold-refresh-post both phases perform on the release PR's sticky comment. Four rules are load-bearing on every write and were previously spelled out twice: (1) **read before writing**, because `upsert` replaces the body wholesale and a rewrite starting from `""` deletes every other section and anything a human wrote — a bug that actually shipped; (2) **a failed read degrades to `""`** rather than aborting, because losing a neighbour is bad but refusing to report the release at all is worse; (3) **one write, not one per section**, so a reader never catches the comment mid-update with a stale verdict above a fresh table; (4) **banners are refreshed across the whole body afterwards**, because a banner is rendered into the text and freezes at write time. What is deliberately *not* here is the bracket — Phase 1 wraps its write in `withSection`, Phase 2 writes once at the end. That difference sits above this function; a caller composes it rather than the function growing a mode.

- **`src/utils/managed-sections.ts`** — per-section state for the release PR body and its sticky comments. It exists because both the sticky comment and the PR's managed region were written only on *completion*: from the moment a build validation starts until it finishes, the previous result was displayed as current with nothing to say otherwise. `withSection` exists so a caller cannot get the `running` transition wrong — the write is not the caller's to forget.

- **`src/utils/grouped.ts`** — runs an effect inside a collapsible GitHub Actions log group, resolving `ActionLogger` itself. The drop-in shape of the predecessor's `Step.groupStep`, minus the step envelope: `groupStep` wrapped its body in both a group *and* a step, and the step existed to make a success line land inside the group. The kit's `group` needs no such pairing, so phase bodies emit their own summary lines.

- **`src/utils/github-urls.ts`** — web URLs into the GitHub instance the run executes against. Every one of these was a hardcoded `https://github.com`, which is wrong on GitHub Enterprise Server. Gathered here so the host is decided once and a new link cannot be added without confronting where the host comes from. Pure, taking the host explicitly rather than reading the environment.

- **`src/utils/npm-cache.ts`** — redirects npm's cache off GitHub macOS runners' partially root-owned `~/.npm/_cacache`. Called at the very top of `program.ts`, before any phase runs an npm command.

- **`src/utils/detect-package-manager.ts`** — delegates to `@effected/workspaces`' `PackageManagerDetector`, which additionally consults `devEngines.packageManager` — authoritative for the name, since corepack *errors* when a top-level `packageManager` disagrees with it. The hand-rolled predecessor read only the top-level field through a bare `JSON.parse` in a `try`/`catch` and could disagree with corepack. A detection failure falls back to `"npm"`.

- **`src/utils/ensure-full-history.ts`** — full-depth history plus a local ref for the target branch, needed by Phases 1, 2 and 3. Each phase previously carried its own copy.

- **`src/utils/porcelain-changes.ts`** — `git status --porcelain -z` → the `FileChange` set a Git Data API commit carries. Deduplicated from the two branch flows, which carried the same two defects in both copies.

- **`src/utils/summary-writer.ts`** — builders for job-summary markdown.

- **`src/utils/commit-signoff.ts`** — resolves the DCO `Signed-off-by` trailer for action-created commits, falling back to `github-actions[bot]` when the App identity is unavailable.

- **`src/utils/turbo-summary.ts`** — Turbo run-summary detection, diagnostics and rendering, so the embedded remote cache's behaviour during a release is observable. Strictly non-fatal: callers demote any failure to a warning.

- **`src/utils/detect-repo-type.ts`** — monorepo vs single-package detection and changeset-config reads. Exports `matchesIgnorePattern(name, pattern)` (exact and `@scope/*` wildcard), the shared matcher behind `ChangesetConfig.isIgnored`.

- **`src/utils/release-summary-helpers.ts`** — release-title and package-listing helpers built on the single `PublishabilityDetector`. `listPublishablePackages(root)` is an Effect over `WorkspaceDiscovery` + `PublishabilityDetector`; `getReleasingPackages`, `resolveReleasePrTitle` and `formatReleasePackageList` are pure.

- **`src/utils/determine-tag-strategy.ts`** — `isMonorepoForTagging(root)` (Effect, resolving through the single detector plus `ChangesetConfig.fixed`) and the pure `determineTagStrategy(publishResults, needsPerPackageTags)`.

- **`src/utils/extract-release-notes.ts`** — first-H2-to-second-H2 CHANGELOG section extraction, used by Phase 2 and Phase 3.

- **`src/utils/derive-check-conclusion.ts`** — check-run conclusion (`success` | `failure` | `neutral`) from structured `ValidationFinding` arrays, with `strict-warnings` escalation.

- **`src/utils/load-release-config.ts`** — layered config loading (repo file, action input, env var) for SBOM metadata, decoding through `SilkReleaseConfig` and parsing JSONC via `@effected/jsonc`.

### Schema Layer

The `src/schema/` directory contains the input decode point, the output declaration point, and the structured output contract.

- **`src/schema/inputs.ts`** — `INPUT_NAMES`, `Inputs`, `BranchRefs`, `readInputs`. See [Inputs and Outputs](#inputs-and-outputs-single-decode-point).
- **`src/schema/outputs.ts`** — `PRE_OUTPUT_NAMES`, `OUTPUT_NAMES`, `emitReleaseOutput`.
- **`src/schema/release-output.ts`** — `ReleaseOutput` as a `Schema.Union` of three phase structs discriminated by the `phase` literal: `BranchManagementOutput`, `ValidationOutput`, `PublishOutput`. **Schema v2** (`SCHEMA_VERSION = "2"`, in-band as every payload's `schemaVersion` field): every phase now carries an orthogonal `success` (boolean gate) + `outcome` (per-phase taxonomy) pair, plus a derived `summary` (one sentence, computed from the structured fields beside it — never authored independently, so the prose cannot drift from the data), a `failure` record (`stage` + `reason`, null on success), and `totals`. The old four-flag set (`status`/`noop`/`succeeded`/`hasFailures`) and `deriveStatus` are gone; so are `ReleaseFlags` and `StatusLiteral`.

  The publish phase (Phase 3) is reshaped around the **workspace**, not the package: `PublishOutput.publish.workspaces` is a `Record<name, PublishWorkspace>` (plus an `order` array preserving the topological sequence a JSON object cannot), and each workspace publishes an array of `packages` — one entry per (package, registry) publication, carrying its own `success`/`outcome` (`published` | `recovered` | `failed` | `blocked`). A workspace's own `kind` (`github-only` | `github-with-packages`, from `utils/release-kind.ts`) is resolved before publishing begins, so it stays correct on an aborted run. `ValidationOutput.validation.workspaces` mirrors the same shape: `ValidationWorkspace.packages` is one entry per (package, registry) *dry-run* — the previous `builds[].targets[]` nesting is gone, flattened into the same `ValidationPackage` shape `PublishedPackage` carries, since validation dry-runs exactly what publish uploads and every consumer had to flatten the old nesting before it could be compared. Both phases share one `PublishRegistry` `$def` for exactly that reason.

  `ValidationPackage.releaseNotes` is `Schema.optional` on the workspace, not the package — populated in-memory for the Release Notes Preview check but stripped before serialization, so it is absent from the emitted `result` and from the committed schema's `required` list.

  Every numeric field in this module is `Schema.Finite`, not `Schema.Number`. Under the installed Effect version, `Schema.Number` lowers to `anyOf: [number, "NaN"|"Infinity"|"-Infinity"]` (v4 encodes non-finite values as strings) and that lowering silently drops any `title`/`description` annotation when it hoists the union into `$defs`; `Schema.Finite` lowers to a plain `{ type: "number" }` and keeps the annotation. All numeric fields this affects are counts, byte sizes, a PR number and a release ID — genuinely finite — so the fix is also a correctness tightening: those fields now reject `NaN`/`Infinity` at encode time instead of silently serializing them as strings. A future numeric field on this schema should default to `Schema.Finite` for the same reason.
- **`src/schema/projections.ts`** — three pure projection functions (`toBranchManagementOutput`, `toValidationOutput`, `toPublishOutput`), each taking an explicit input interface as the deliberate seam between internal pipeline types and the published contract.
- **`src/schema/silk-release-config.ts`** — `SilkReleaseConfig` Effect schema for the `sbom-config` action input (and `.github/silk-release.json`), plus `INPUT_SCHEMA_URL`.

Two JSON Schema artifacts are generated from these schemas. The input document stays at the repo root, `silk-release-action.input.schema.json`. **The output document is versioned and lives under `schemas/<version>/`** — `schemas/5.0.0/silk-release-action-5.0.0.json` today — because it is referenced by `$schema`/`$id` in every `result` payload the action emits (`SCHEMA_URL` in `src/schema/release-output.ts`), so the URL has to keep resolving to the shape a given payload was written against long after the schema has moved on; an unversioned URL would silently re-point old payloads at a newer contract. The unversioned `silk-release-action.output.schema.json` at the repo root is gone.

**Generation runs through `@effected/schemastore`'s `SchemaPipeline`**, which replaced the hand-rolled Draft-07 lowering plus the `biome` shell-out and the `ajv` dependency (`ajv` is gone from `package.json`). The pipeline handles the Draft 2020-12 → Draft-07 lowering, strict validation and drift-stable formatting; `__test__/generate-schema.test.ts` is the drift guard over both committed documents. `lib/scripts/generate-schema.ts` also runs a **contract gate before writing anything**: `SchemaPipeline.check` classifies what changed (`created` | `annotations` | `contract`) against the already-published version, and a `contract` change — a removed/renamed field, a changed type — fails the run, names every affected document, and writes nothing, rather than silently rewriting a version's file out from under consumers pinned to its URL. The response to a genuine contract break is bumping `SCHEMA_SEMVER` (and `SCHEMA_URL`) to a new label, which writes a new file and leaves the published one alone.

### Type System

- **`src/release/types.ts`** — stable type home for publish-chain result shapes: `TargetPublishResult`, `PackagePublishResult`, `PublishPackagesResult`, `ValidationFinding`, `ValidationFindingScope`, `ValidationPackageResult`, `PackageBuildResult`, `BuildTargetResult`, `BuildSbom`, `ReleaseInfo`, `AssetInfo`. The three-way `TargetPublishResult.status` (`"published" | "skipped" | "failed"`) is the canonical publish outcome; `success: boolean` is a backward-compat projection.
- **`src/types/publish-config.ts`** — multi-registry publishing types: `PublishTarget`, `ResolvedTarget`, `PublishResult`, `AuthSetupResult`, `PrePackedTarball`.
- **`src/types/shared-types.ts`** — `ValidationResult` and `PackageValidationResult`.
- **`src/types/sbom-config.ts`** — `SBOMConfig`, `EnhancedCycloneDXDocument`, NTIA compliance types, supplier/copyright metadata types.
- **`src/types/global.d.ts`** — global type augmentations for Vitest.

## Rationale

### Why Three Phases?

The three-phase approach separates concerns by execution context:

1. **Branch management** runs on every push to main. It is fast (no builds) and creates/updates the release PR as a staging area.
2. **Validation** runs on the release branch. Build compilation, dry-run publishing, and SBOM generation can be slow without blocking pushes to main. The release PR provides a visible gate for review.
3. **Publishing** only runs after the release PR is merged. This gating ensures human approval before packages reach registries.

Validation failures never block development on main, and publishing failures are isolated from the validation context.

### Why a 19-line `main.ts`?

The 1481-line `main.ts` mixed three separable concerns — layer construction, composition, and four phase bodies — and paid for it in three ways.

**Nothing could be tested.** The module executed on import, so importing it in a test *ran the action*. `program.ts` exists so the pipeline can be run against test layers with no module-level execution, and `__test__/unit/program.test.ts` does exactly that.

**The step bodies were unreachable by tests.** `steps/validation.ts`'s six extractions received their first-ever coverage in this split — `validation-checks.ts`, `publish-validation.ts`, `link-issues.ts`, `build-validation.ts`, `per-step-checks.ts` and `publish-validation-report.ts` were all previously inline in a body no test executed. That is how issue #216 survived: the green-on-crash chain had never been run by an assertion.

**Inputs drifted.** Eleven `ActionInput` reads scattered through one file, plus more at the call sites, meant `"changeset-release/main"` was restated six times and a dead input (`build-command`) and an unimplemented one (`custom-registries`) both survived for months. One decode point plus a three-legged sync test makes that a test failure instead.

### Why API Commits?

Creating commits through the Git Data API (`GitCommit`) instead of `git push` provides:

- **Automatic GPG signing**: commits created by a GitHub App are signed and marked "verified" in the GitHub UI.
- **Atomic operations**: branch creation and commit are API calls, avoiding races with concurrent pushes.
- **No git push credentials on the runner**: only the API token is used.
- **DCO compliance**: the commit message carries a `Signed-off-by` footer.

Branch-linking specifically uses `GitBranch.createLinked` — the one operation with no REST equivalent — because that is what preserves the issue↔branch link.

### Why Recreate vs Rebase?

`update-release-branch.ts` recreates the release branch from main instead of rebasing. The branch contains only machine-generated changes (version bumps and CHANGELOG updates); recreation is atomic and there is never a reason to preserve manual commits on it.

The corollary: if recreation followed by versioning yields no changes, the branch is byte-identical to main. There is no PR to open — GitHub rejects PR creation with "No commits between main and changeset-release/main", which previously failed the run. The update flow treats this as the "nothing to release" terminal state and tears the branch down (close PR, delete branch), matching how the create flow handles a no-op version.

### Why version natively?

Shelling out to the consumer's `ci:version` script forced Phase 1 to run a full dependency install just to bump versions and write changelogs — the slowest part of an otherwise API-only phase. Versioning in-process through the bundled silk-effects engine makes Phase 1 genuinely zero-install. The changelog id map removes the last `node_modules` dependency: the generator named in the consumer's changeset config resolves to an action-shipped bundle instead of a package the consumer would have to install. It also decouples the action from consumer script drift — the version step behaves identically in every repo.

### Why a Six-Step Phase-3 Flow?

Phase 3 is split into `detectReleases` → `planWorkspaces` → `runBuildAndSbom` → `runPublishTargets` → `runReleases` → summary to enforce fail-fast gating at each boundary:

- Target resolution (`planWorkspaces`) happens before the build gate precisely because it cannot fail — it only reads manifests — so a run that aborts at the build still reports every workspace's kind and intended publication count instead of losing the wave's membership.
- Build failure aborts before any tarball is created.
- Publish failure of more than half the targets aborts before GitHub releases are created, preventing a release that references versions which are not fully on registries.
- Attestation failures are non-fatal so a single OIDC hiccup does not roll back the entire release.

### Why Pack Once per Directory?

When publishing to multiple registries, the action packs the tarball once and reuses it for all targets, so every registry receives identical content with the same SHA-256 digest. This is critical for attestation — provenance attestations reference a specific digest, so all targets must share the same tarball.

### Why a Silk-Specific Publishability Helper?

The vanilla `PublishabilityDetectorLive` from `@effected/workspaces` treats `package.json#private: true` as "not publishable" full stop. Silk convention inverts that: in silk mode `private: true` is the norm on workspace `package.json` and publishability is derived from `publishConfig`, not the `private` flag. The silk rules therefore consult `publishConfig.targets` first, then `publishConfig.access`, and only fall back to `private` as a last-resort default (see [Publishability Detection (Silk Rules)](integration.md#publishability-detection-silk-rules)).

`SilkPublishability.layerAdaptive` short-circuits changeset-ignored packages to `[]` regardless of mode (via `ChangesetConfig.isIgnored`), then reads `ChangesetConfig.mode` per-call and dispatches to the silk override (silk mode), the library default (vanilla mode), or a no-op detector (none mode). This single ignore-aware detector is the only publishability path — Phase 1, Phase 2 and Phase 3 all resolve through it. The mode is decoded by the bundled silk-effects `ChangesetConfigReader` from the changelog id in `.changeset/config.json`, so the bundled library's silk-marker id set is load-bearing: an unrecognized id silently degrades the repo to vanilla rules and Phase 3 publishes the dev target — which happened on silk-effects 3.0.0 for the canonical `@savvy-web/changelog` id (issue #143; fixed in 3.0.1+). The same rules are encoded identically in `silk-update-action` and the silk `changesets` package.

## Key Design Patterns

### Declared Failure Postures

Every module under `steps/` states its failure posture in its module docs **and** encodes it in its error channel. `never` in the error channel means "this degrades"; anything else propagates and fails the job.

The pairing is the discipline: a posture stated only in prose drifts from the code, and an error channel alone does not say *what a reader sees* when the step degrades. `never` alone is not a posture — a step that degrades must also say whether it **contributes a finding** (visible in the verdict) or degrades to a warning nobody downstream reads. Where a degradation is invisible downstream, the module says so explicitly and links the characterization test; where it has been fixed, the module says what it now contributes. See [Degradation semantics (issue #216)](#degradation-semantics-issue-216) — `publish-validation.ts` is the fixed example, `link-issues.ts`, `per-step-checks.ts` and `publish-validation-report.ts` are the outstanding ones.

Reporting writes are never gates. `withSection` types its `publish` callback as infallible for exactly that reason: a finalizer that could fail on the way out would replace the caller's real error with a reporting one.

### Grouped Logging

The predecessor's `Step.*` primitives are gone with `@savvy-web/github-action-effects`. Phase bodies now use `grouped(name, effect)` (`src/utils/grouped.ts`) for collapsible Actions log groups and emit their own summary lines, because the kit's `logger.group` needs no paired step envelope to make a success line land inside the group.

> ⚠️ `Effect.logInfo` is buffered/discarded on success inside a group; live Actions-log output goes through the logger's own line members.

### Managed Sections

The release PR carries two managed surfaces, and they are separate mechanisms with separate owners: the PR **description** (built upstream by `PrBody.ManagedPrBody` in `@savvy-web/silk-effects`, marker-delimited so human prose around it survives) and a sticky **comment** written by both Phase 1 and Phase 2 under the same marker key (`utils/managed-sections.ts` + `utils/write-sections.ts`, both still local — the comment surface was not part of the [#209](https://github.com/savvy-web/silk-release-action/issues/209) migration).

Three rules make the comment safe for multiple writers: sections are stamped and rewritten independently, so the verdict can flip ✅→❌ without touching the table; the `running` transition is written *before* the work, so a reader never sees a stale result presented as current; and banners are refreshed across the whole body after every write, so a section nobody rewrote does not go on claiming it is current at a sha the branch has moved past.

Phase 2 completes Phase 1's `release-plan` section rather than leaving it reading "pending validation" beside a finished validation run — which is why it writes under Phase 1's marker key and not one of its own. Previously the verdict and detail were a *separate* comment rendered wholesale on every run, so a reader met two bot comments making overlapping statements about the same release and neither could be updated without rewriting the other.

### State Management

GitHub Actions state passes data between `pre`, `main`, and `post` lifecycle hooks. State schemas are `Schema.Class`es in `src/state.ts`:

- **`StartTimeState`** — wall-clock timestamp captured by `pre.ts` for total-duration reporting in `post.ts`.
- **`GithubPackagesTokenState`** — the optional workflow `github-token`, written by `pre.ts` when the input is provided; read by the Phase-3 publish flow.

The GitHub App installation token is persisted by `GitHubToken.provision` under the kit's own internal key and read back via `GitHubToken.read()`.

**`process.env.GITHUB_TOKEN` is never written persistently by the action, and the `STATE_token` / `STATE_githubToken` process-environment bridges are deleted, not moved.** The `STATE_githubToken` bridge wrote the workflow token into the environment as *plaintext* — no `Secret` member anywhere on that path — to serve `tokens.packagesToken()`, whose only production caller (`registry-auth.setupRegistryAuth`) was deleted at #90. It was an unmasked secret in every subsequent operation's environment, serving a function nobody called. The one remaining scoped exception is Phase-1 native versioning, which sets `GITHUB_TOKEN` from the App token around `ReleasePlanner.apply` and restores the prior value after.

Secret-bearing token APIs take or decode to `Redacted<string>` (`GitHubApp.generateToken` / `revokeToken`, the client constructors, `PackagePublish.setupAuth`, and the decoded `InstallationToken.token`), which keeps them out of logs and error renders.

### Error Handling Strategy

- **Pre-action**: fatal. The token is required for everything after it.
- **Post-action**: non-fatal. Belt-and-braces `Effect.catch` plus `Effect.catchDefect` — a post failure must never obscure the real failure of a run that is already failing.
- **Phase bodies**: posture declared per step (see [Declared Failure Postures](#declared-failure-postures)). Phase 2 catches only to tear down in-flight check runs before re-raising untouched.
- **Phase-3 per-target failures**: recorded rather than thrown; the batch continues and the abort-before-releases gate checks aggregate results afterward.
- **Network operations**: retry logic for transient API failures (phase detection, PR creation, native-version apply).

### GitHub API Usage

All GitHub interaction is through `@effected/github` services (`GitHubClient` and the resource services above it). GraphQL is a **member of `GitHubClient`** — there is no separate `GitHubGraphQL` service to wire — and it backs the queries needing nested data (`closingIssuesReferences` on PRs, branch protection mutations). No raw Octokit calls remain in `src/`.

Registry reads go through `NpmRegistry` over `FetchHttpClient` (HTTP, not `npm view` subprocesses); publishing goes through `PackagePublish` over `LocalExec`.

### Dry-Run Mode

`dry-run` is decoded once in `schema/inputs.ts` and used only to build the `DryRun` service. Every consumer asks that service rather than re-reading the input — one decode, one decision. In dry-run mode package-manager commands run with `--dry-run` flags, Git branch and commit operations are skipped, check-run titles are prefixed with the `🧪` marker (the only title decoration), and registry publish commands use the dry-run flag. All validation logic runs identically to production mode.

## File Reference

### Entry points and composition

| File | Description |
| :--- | :---------- |
| `src/main.ts` | 19 lines: `GITHUB_ACTIONS` guard + `Action.run(main, { layer: MainLive })` |
| `src/program.ts` | The main-phase program: read inputs once, resolve phase, run one step |
| `src/pre.ts` | Pre-action: start time, `github-token` state, App token provisioning |
| `src/post.ts` | Post-action: duration reporting, token revocation |
| `src/state.ts` | `Schema.Class` state bundles shared across pre/main/post |
| `src/layers/app.ts` | `MainLive`, `makeAppLayer(dryRun)`, `toolDiscovery` |

### Phase steps

| File | Description |
| :--- | :---------- |
| `src/steps/branch-management.ts` | Phase 1 body; no injected seams |
| `src/steps/publish-release-plan.ts` | `withReleasePlanSection` — the bracketed release-plan comment section |
| `src/steps/validation.ts` | Phase 2 body: order and value flow across six extractions |
| `src/steps/link-issues.ts` | Phase 2 issue linking; `LINK_ISSUES_FAILED` |
| `src/steps/build-validation.ts` | Phase 2 build validation; `buildValidationFailed(cause)` |
| `src/steps/publish-validation.ts` | Phase 2 publish/notes/SBOM region; `SKIPPED_PUBLISH_VALIDATION`, `crashedPublishValidation` |
| `src/steps/per-step-checks.ts` | The three per-step check runs |
| `src/steps/publish-validation-report.ts` | Phase 2 sticky-comment write |
| `src/steps/publishing.ts` | Phase 3 body; raises `PublishError` |
| `src/steps/close-issues.ts` | Phase 3a body |

### Schema

| File | Description |
| :--- | :---------- |
| `src/schema/inputs.ts` | `INPUT_NAMES`, `readInputs` — the single input decode point |
| `src/schema/outputs.ts` | `PRE_OUTPUT_NAMES`, `OUTPUT_NAMES`, `emitReleaseOutput` |
| `src/schema/release-output.ts` | `ReleaseOutput` union (schema v2), phase structs, `SCHEMA_URL`/`SCHEMA_VERSION` |
| `src/schema/projections.ts` | `toBranchManagementOutput`, `toValidationOutput`, `toPublishOutput` |
| `src/schema/silk-release-config.ts` | `SilkReleaseConfig` schema; `INPUT_SCHEMA_URL` |

### Release domain

| File | Description |
| :--- | :---------- |
| `src/release/layers.ts` | `WorkspacesLive`, `LocalExecLive`, `NativeVersioningLive`, `ReleaseLive` |
| `src/release/publish.ts` | `detectReleases`, `planWorkspaces`, `runBuildAndSbom`, `runPublishTargets`, `publishDirectoryGroup` |
| `src/release/releases.ts` | `runReleases`: tags, releases, group-keyed assets, attestations |
| `src/release/attest-helpers.ts` | Assembles sign (`@effected/sbom`) + store (`@effected/github`) into one pipeline |
| `src/release/meta-archive.ts` | `tarMetaFolder`: packs a bundler `meta/` folder into `…<group>.meta.tgz` |
| `src/release/validation.ts` | `runValidation`: Phase-2 dry-run + SBOM + `ValidationReport` |
| `src/release/validation-checks.ts` | `CHECK_NAMES`, `deriveValidationChecks`, `applyCheckUrls` — pure |
| `src/release/report.ts` | `buildValidationComment`, `buildPublishSummary`, `buildChecksTable`, `buildFindingsTable`, `buildPublishValidationSummary`, `buildReleaseNotesPreviewSummary`, `buildSbomPreviewSummary` |
| `src/release/resolve-targets.ts` | `resolvePublishableTargets`, `resolvePublishTargetSpecs` (the shared detect + JSR-filter + private-build-filter used by both the Build & SBOM gate and the publish step), `isTargetPrivate`, `pickToken` |
| `src/release/changeset-config.ts` | `ChangesetConfig` service: mode, versionPrivate, ignorePatterns, isIgnored, fixed |
| `src/release/types.ts` | `TargetPublishResult`, `ValidationFinding`, `ValidationPackageResult`, … |
| `src/release/errors.ts` | `ValidationError`, `ReleasesError`, `PublishError` tagged errors |
| `src/changelog/silk.ts` | Bundled silk changelog generator → `dist/changelog-silk.js` |
| `src/changelog/default.ts` | Bundled vanilla changelog generator → `dist/changelog-default.js` |

### Utilities

`src/utils/pr-body.ts` is **not** in this table because it no longer exists: the managed release-PR description is `PrBody.ManagedPrBody` in `@savvy-web/silk-effects` since [#209](https://github.com/savvy-web/silk-release-action/issues/209). See [Release PR body (managed region)](#release-pr-body-managed-region).

| File | Description |
| :--- | :---------- |
| `src/utils/auto-merge.ts` | Opt-in auto-merge on the release PR; `autoMergeMethodConfig` |
| `src/utils/check-release-branch.ts` | Whether the release branch and its PR exist |
| `src/utils/cleanup-validation-checks.ts` | Mark incomplete check runs as cancelled on error |
| `src/utils/close-linked-issues.ts` | Close issues linked to the merged release PR |
| `src/utils/commit-signoff.ts` | DCO `Signed-off-by` trailer |
| `src/utils/count-changesets.ts` | Changeset counts per package |
| `src/utils/create-release-branch.ts` | Cut the branch, version natively, commit, open the PR |
| `src/utils/create-validation-check.ts` | Unified check run; `capCheckSummary` (65535-byte UTF-8 cap) |
| `src/utils/derive-check-conclusion.ts` | Check-run conclusion from findings, with strict-warnings |
| `src/utils/detect-package-manager.ts` | `PackageManagerDetector` delegate; `devEngines`-aware |
| `src/utils/detect-repo-type.ts` | Monorepo/single detection; `matchesIgnorePattern` |
| `src/utils/detect-workflow-phase.ts` | Phase routing from event context |
| `src/utils/determine-tag-strategy.ts` | `isMonorepoForTagging` (Effect) + pure `determineTagStrategy` |
| `src/utils/ensure-full-history.ts` | Full depth + local target ref for changesets |
| `src/utils/event-payload.ts` | Schema-decoded webhook payload reads |
| `src/utils/extract-release-notes.ts` | First-H2-to-second-H2 CHANGELOG extraction |
| `src/utils/format-workspace.ts` | `formatWorkspaceWithBiome` via `ToolDiscovery` |
| `src/utils/github-urls.ts` | Instance-aware web URLs (GHES-correct) |
| `src/utils/group-id.ts` | `getGroupId`, `insertGroupToken` — byte-group asset naming |
| `src/utils/grouped.ts` | Collapsible Actions log groups |
| `src/utils/link-issues-from-commits.ts` | Issue references from commits since the last release tag; the closing-keyword grammar is the kit's `harvestIssueReferences`, deduped here |
| `src/utils/load-release-config.ts` | Layered SBOM config loading; `SilkReleaseConfig` decoding |
| `src/utils/managed-sections.ts` | `withSection` — per-section state for PR body and sticky comments |
| `src/utils/native-version.ts` | `runNativeVersion`, `CHANGELOG_MODULES`, token scoping, reset-then-retry |
| `src/utils/npm-cache.ts` | `ensureNpmCacheEnv` — runner-writable npm cache |
| `src/utils/porcelain-changes.ts` | `git status --porcelain -z` → Git Data API `FileChange` set |
| `src/utils/release-kind.ts` | `ReleaseKind` (`github-only` \| `github-with-packages`), `releaseKindOf`/`Label`/`Icon`/`Cell`, `tallyReleaseKinds`, the `summarize*` one-line derivations shared by every phase |
| `src/utils/release-plan.ts` | Pure projection of the release plan into Phase-1 reporting, incl. pre-build `targetCount` |
| `src/utils/release-summary-helpers.ts` | `listPublishablePackages`, `listAllPackages`, `getReleasingPackages`, `resolveReleasePrTitle`, `formatReleasePackageList` |
| `src/utils/release-table.ts` | The shared "what will be released" table (Phase 1 + Phase 2) |
| `src/utils/sort-releases-topologically.ts` | Dependency-first ordering via `DependencyGraph.sortSubset` |
| `src/utils/summary-writer.ts` | Job-summary markdown builders |
| `src/utils/turbo-summary.ts` | Turbo run-summary detection and rendering (non-fatal) |
| `src/utils/update-release-branch.ts` | Recreate the release branch from main; native version apply |
| `src/utils/update-sticky-comment.ts` | Idempotent PR comment management |
| `src/utils/validate-builds.ts` | Build validation with error annotation |
| `src/utils/write-sections.ts` | Shared read-fold-refresh-post for both phases' comment writes |

### Types

| File | Description |
| :--- | :---------- |
| `src/types/publish-config.ts` | Multi-registry publishing type definitions |
| `src/types/sbom-config.ts` | SBOM configuration and CycloneDX types |
| `src/types/shared-types.ts` | `ValidationResult`, `PackageValidationResult` |
| `src/types/global.d.ts` | Global type augmentations for Vitest |
