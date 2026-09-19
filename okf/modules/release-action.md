---
type: Module
title: release-action
description: The three-phase release orchestration under src/ — phase detection, layer graph, phase-body steps, schema, and reporting.
kind: action
resource: ../../src
status: draft
generated:
  by: okfit/claude-code
  at: 2026-09-19T01:42:17Z
  body_sha256: 4bea190b9aced6e0473f58bc0c4410cdff097472681aaf30e4eb2ae93fe81d78
sources:
  - id: src-main
    resource: ../../src/main.ts
  - id: src-program
    resource: ../../src/program.ts
  - id: src-layers-app
    resource: ../../src/layers/app.ts
  - id: src-release-layers
    resource: ../../src/release/layers.ts
  - id: src-steps
    resource: ../../src/steps
  - id: src-schema
    resource: ../../src/schema
  - id: src-release
    resource: ../../src/release
  - id: src-utils
    resource: ../../src/utils
tags:
  - architecture
  - release
  - security
  - observability
---

# release-action

## Entry points

Three lifecycle scripts correspond to the GitHub Actions `pre`, `main`, and `post` stages, each an Effect program run via `Action.run` from `@effected/github-actions`, guarded behind `process.env.GITHUB_ACTIONS` so importing the module in a test does not execute it[^src-main].

- **`src/pre.ts`** — records the start time to `StartTimeState`, persists the optional `github-token` input to `GithubPackagesTokenState`, and provisions a GitHub App installation token via `GitHubToken.provision()`. Failures here abort the workflow.
- **`src/main.ts`**[^src-main] — 19 lines: a `GITHUB_ACTIONS` guard plus `Action.run(main, { layer: MainLive })`. The program is `src/program.ts`; the layer graph is `src/layers/app.ts`.
- **`src/post.ts`** — reports total duration, then revokes the installation token via `GitHubToken.dispose()`. A belt-and-braces `Effect.catch` on revocation plus `Effect.catchDefect` around the whole program means a post failure never fails the workflow.

## Program composition and the `steps/` layer

`src/program.ts`[^src-program] is composition only: read the inputs once, read the installation token back for identity diagnostics, resolve the workflow phase, and run the one step that phase names — a five-arm switch (`branch-management`, `validation`, `publishing`, `close-issues`, default no-op). `inputs.phase` is an `Option<WorkflowPhase>` decoded against the literal union rather than cast, so a typo fails the run instead of silently falling through to the no-op arm.

`src/steps/`[^src-steps] holds one module per phase body. Each module states its failure posture in its own module docs and in its error channel — `never` in the error channel means "this degrades" — verified directly against the module docs:

| Module | Phase | Failure posture |
| ------ | ----- | ---------------- |
| `steps/branch-management.ts` | 1 | fail-the-job; constructs no error of its own |
| `steps/publish-release-plan.ts` | 1 | degrade-to-warning (`withReleasePlanSection` combinator) |
| `steps/validation.ts` | 2 | fail-the-job, with check-run cleanup; errors re-raised untouched |
| `steps/link-issues.ts` | 2 | degrade-to-warning — invisible downstream ([still-live](../gotchas/phase-2-silent-degradation.md)) |
| `steps/build-validation.ts` | 2 | degrade-to-warning — visible; `buildValidationFailed(cause)` reports `success: false` and cascades red |
| `steps/publish-validation.ts` | 2 | degrade-with-a-finding — visible; quiet `SKIPPED_PUBLISH_VALIDATION` when the build failed, `crashedPublishValidation(message)` when the dry-run threw ([fixed](../decisions/degraded-steps-contribute-findings.md)) |
| `steps/per-step-checks.ts` | 2 | degrade-to-warning — invisible (`""` URL becomes a `null` row) |
| `steps/publish-validation-report.ts` | 2 | degrade-to-warning — invisible |
| `steps/publishing.ts` | 3 | fail-the-job; raises `PublishError` rather than returning |
| `steps/close-issues.ts` | 3a | fail-the-job; a missing PR number is a skip, not a failure |

Two supporting extractions sit outside `steps/` because they do no I/O and declare no requirement channel: `src/release/validation-checks.ts` (`deriveValidationChecks` and `applyCheckUrls`, pure) and `src/utils/write-sections.ts` (the shared read-fold-refresh-post used by both phases' managed-comment writes).

`steps/validation.ts`'s own body is uncovered by any test: nothing executes `runValidation` directly, so a green suite says nothing about the wiring, only about the six modules it calls — the module's own docs say so.

## Inputs and outputs

`src/schema/inputs.ts`[^src-schema] is the single decode point for every `action.yml` input — see [single-input-decode-point](../conventions/single-input-decode-point.md) and [action-inputs](../interfaces/action-inputs.md). `src/schema/outputs.ts` is the counterpart, split by phase because `token` / `installation-id` / `app-slug` can only be produced by the pre process.

## Layer graph

`src/layers/app.ts`[^src-layers-app] builds `MainLive`. `ActionEnvironment`, `ActionLogger`, `ActionOutputs`, `ActionState`, `NodeServices` and an `HttpClient` all arrive from `ActionRuntime` via `Action.run` and are deliberately **absent** from this layer, since `ActionRunOptions.layer` may require rather than rebuild them. `makeAppLayer(dryRun)` composes `GitHubToken.clientLayer()`, `Repo.layerFromConfig()`, the `@effected/github` resource layers, `NpmRegistry.layer` over `FetchHttpClient.layer`, `PackagePublish.layer` over `NodeServices.layer`, `OidcTokenIssuer.layer` / `SigstoreSigner.layer`, and `DryRun.layerFrom(dryRun)`.

**`LocalExec`, `Git` and `PackageManagerDetector` are required here, not built here.** They come from `src/release/layers.ts`[^src-release-layers], and `MainLive` satisfies the requirement with `Layer.provideMerge(releaseLive)`. Building them in the app layer minted a second `WorkspaceDiscovery` — two filesystem scans that could disagree between the publish path and the release path — and `Layer.mergeAll`'s later-wins merely hid the duplicate rather than preventing it.

`src/release/layers.ts` owns the workspace graph:

- `WorkspacesLive = Workspaces.layerWithGit()` — bound to a single `const` because the factory mints a fresh reference per call and layers memoize by reference; this is the load-bearing ONE-const rule the app layer's requirement depends on.
- `LocalExecLive = Workspaces.localExecLayer()` over that same const — asks the detected package manager what its run-a-local-tool argv looks like, so `NpmExecutor.dlx` resolves correctly per workspace rather than asserting one manager.
- `NativeVersioningLive` — `Changesets.ReleasePlanner.layer` over `ConfigInspector.layer`.
- `ReleaseLive = WorkspacesLive + LocalExecLive + ChangesetConfigLive + SilkPublishability.layerAdaptive + NativeVersioningLive`, piped exactly once in `layers/app.ts` — a differently-piped value is a different layer reference and would build a second workspace graph.

`toolDiscovery` is composed separately over `LocalExec.layerNone`: `formatWorkspaceWithBiome` asks "is biome on PATH", a different question from the workspace-aware launcher `PackagePublish` needs.

## Phase detection priority order

`src/utils/detect-workflow-phase.ts`[^src-utils] determines the phase from the GitHub event context:

1. **Explicit phase** — the `phase` input, when provided, skips detection (decoded against the literal union).
2. **Phase 3a (close-issues)** — a `pull_request` event where the release PR (`changeset-release/main` → `main`) was merged, detected from the event payload without API calls.
3. **Phase 3 (publishing)** — a push to `main` carrying a release commit, via two-strategy detection with retry: primary queries `listPullRequestsAssociatedWithCommit`, fallback matches `merge_commit_sha` against recently closed PRs from the release branch, 3 attempts at 5-second delays.
4. **Phase 2 (validation)** — a push to the release branch.
5. **Phase 1 (branch-management)** — a push to `main` that is not a release commit.
6. **None** — any other event; logs a skip and exits.

## Phase 1: release branch management

Triggers on a non-release push to `main`; `steps/branch-management.ts` is the phase body with no injected seams — publish-plan reporting is `withReleasePlanSection`'s job instead.

- **`check-release-branch.ts`** — whether the release branch and an open PR from it already exist.
- **`ensure-full-history.ts`** — full-depth history plus a local ref for the target branch, needed by all three phases; the `isShallow` probe uses `Effect.result` so a non-zero exit means "not shallow", not "stop".
- **`create-release-branch.ts`** — creates the branch from `origin/{targetBranch}`, applies pending changesets natively, runs the conditional Biome format step, commits via the Git Data API (auto-signed by the App), links issues found in changeset files via `GitBranch.createLinked`, and opens a PR (retried once on a network blip).
- **`update-release-branch.ts`** — recreates the branch from `main` rather than rebasing; when versioning produces no changes, closes any open release PR, deletes the branch, and emits a `neutral` conclusion rather than an invalid "nothing to release" state.
- **`porcelain-changes.ts`** — turns `git status --porcelain -z` into the `FileChange` set a Git Data API commit carries.
- **`auto-merge.ts`** — opt-in auto-merge, off unless a workflow explicitly asks.

**Native versioning (zero-install)** — both flows call `runNativeVersion(cwd)` (`src/utils/native-version.ts`), driving the bundled silk-effects `Changesets.ReleasePlanner.apply` after validating `.changeset/config.json` via `Changesets.ConfigInspector`. See [changelog-module-map](../models/changelog-module-map.md) for the id-to-bundle mapping. Key mechanics: **token scoping** — `runNativeVersion` reads the App token via `GitHubToken.read()` and sets `process.env.GITHUB_TOKEN` strictly around the apply, restoring the prior value after, because the upstream changelog GitHub-info fetch reads that variable directly; **reset-then-retry** — `apply` is not idempotent (it deletes consumed changesets), so a transient network failure (`ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `EAI_AGAIN`, `fetch failed`) triggers `Git.restore` + `Git.clean`, a one-second pause, and exactly one retry; **format policy** — `formatWorkspaceWithBiome` (`src/utils/format-workspace.ts`) runs `biome format --write .` when both a config and the standalone binary are present, warns and continues on a missing binary or an unresolvable config, and fails the phase on any other non-zero exit. `versionFiles` bumps are written as format-preserving in-place jsonc edits, so this pass is no longer load-bearing for that content.

**PR/commit titles** — both flows resolve the title from `listAllPackages` (**every** workspace package, publishable or not) → `getReleasingPackages` (the subset whose manifest changed) → `resolveReleasePrTitle`, with **no fallback**: detecting over the publishable subset alone could never name a `github-only` release's packages, and the old fallback then claimed the entire publishable set was releasing. An empty match falls through honestly to the nothing-to-release title rather than naming packages that did not release.

**Release-plan comment section** — `src/steps/publish-release-plan.ts` owns what Phase 1 publishes to the sticky comment while branch work runs, separately from `steps/branch-management.ts` because the two answer different questions (what the release is vs. what a reader sees about it, and when). `withReleasePlanSection` writes `running` before the work and a terminal state on every exit, through `Effect.result` so a failed write degrades to a logged warning rather than replacing the caller's real error.

## Phase 2: release validation

Triggers on a push to the release branch. `steps/validation.ts` holds only the order the six extractions run in and the values that flow between them; failure posture is fail-the-job, catching only to tear down in-flight check runs (`cleanupValidationChecks`) before re-raising untouched.

1. `steps/link-issues.ts` — finds closed issues via `linkIssuesFromCommits`, reports as a check run.
2. `steps/build-validation.ts` — runs every package's build (`validateBuilds`, `utils/validate-builds.ts`), reports as a check run. The build's verdict is its **exit code alone** — no grep for the word `error`, which over combined output would fire on a `0 errors` line or a package named `*-error-*`. Annotations and the check run's error excerpt are parsed from **stdout+stderr** (turbo puts task diagnostics on stdout); the finding message (`errors`) is stderr, falling back to that same error-line excerpt when stderr is empty. The `on-build` gate is exit-code-only too, with its output reproduced verbatim.
3. `steps/publish-validation.ts` — the publish / release-notes / SBOM region; names the twelve former mutable bindings as one optional `ValidationReport` plus a default.
4. `release/validation-checks.ts` — the pure derivation (below).
5. `steps/per-step-checks.ts` — three per-step check runs, created after the canonical projection so `applyCheckUrls` can patch URLs in afterward.
6. `steps/publish-validation-report.ts` — the write to the sticky comment.

The engine underneath is `src/release/validation.ts` (`runValidation`), a pure Effect program: it enumerates workspace packages, diffs versions against the target branch (`detectReleasedPackages` drops changeset-ignored names via `ChangesetConfig.isIgnored` and skips a package with no `version` at all), orders the released set dependency-first via `sortReleasesTopologically`, resolves publish targets, groups by build directory, runs `PackagePublish.dryRun` per group, generates one SBOM per group, and assembles a `ValidationReport`. `strict-warnings` escalates warning-severity findings to failure for auto-merge gating.

`runValidation` wraps target resolution in `Effect.either`: a `Left` carries `PublishTargetBindingError` — detection selected a directory the package's `dist/prod/targets.json` binding does not describe, meaning the bytes about to be packed are not the prod release artifact (issue #144). On that `Left` the flow logs, pushes a `severity: "error"` finding scoped to `{ package, directory }` under `Publish Validation`, records an empty `builds` list for that package, and continues — the finding fails the check-run conclusion without aborting the rest of the run.

Every check-run summary passes through `capCheckSummary` (`src/utils/create-validation-check.ts`) — see [check-summary-byte-cap](../limitations/check-summary-byte-cap.md).

**Check derivation** — `src/release/validation-checks.ts` is pure and service-free. `CHECK_NAMES` lists the five checks (`Link Issues from Commits`, `Build Validation`, `Publish Validation`, `Release Notes Preview`, `SBOM Preview`) as a **join key**, not labels: `deriveCheckConclusion` filters findings by `finding.check === name`, so a row renamed without renaming the finding that targets it silently detaches the finding from its row. `deriveValidationChecks(inputs)` returns findings, per-check results, table rows, and a `summaryLine`; `applyCheckUrls(rows, urls)` patches URLs in afterward without mutating its input.

**Degradation** — see [degraded-steps-contribute-findings](../decisions/degraded-steps-contribute-findings.md) for the fixed publish-validation crash path and its two rules, and [phase-2-silent-degradation](../gotchas/phase-2-silent-degradation.md) for the paths still live.

## Phase 3: release publishing

Triggers on merge of the release PR to `main`. `steps/publishing.ts` is the phase body; orchestration lives in `src/release/`. Failure posture is fail-the-job — a failed build/SBOM gate or a partial publish raises `PublishError` rather than returning, since returning is what once let a partial publish report a green run. A `runReleases` failure or a linked issue that could not be closed raises `ReleasesError` **deferred** to the end of the step, after the close-linked-issues follow-on, the availability probe and the output emission have run, so `result` still describes what published.

1. **`detectReleases`** (`release/publish.ts`) — detects released packages from the merged PR's file diff (PR-first) or commit diff (fallback), drops changeset-ignored names via `ChangesetConfig.isIgnored`.
2. **`planWorkspaces`** — deliberately ahead of the build/SBOM gate: resolves every detected workspace's publish targets before anything is built and classifies each as `github-with-packages` or [`github-only`](../glossary/github-only.md) via `utils/release-kind.ts`. Manifest-only resolution is cheap and cannot fail, so an aborted run still reports every workspace's kind and intended publication count.
3. **`runBuildAndSbom`** — runs `ci:build` once, then generates one CycloneDX SBOM per package that resolved a publish target; a `github-only` workspace is named in `sbomSkipped` rather than getting a stray unattached SBOM. Aborts the phase on a build failure.
4. **`runPublishTargets`** — publishes packages: resolves targets, sorts topologically (idempotent re-sort), and calls `publishDirectoryGroup` per unique build directory. Aborts before any releases unless every target published or recovered (`publishResult.success` is all-or-nothing).
5. **`runReleases`** (`release/releases.ts`) — creates Git tags (sha-aware idempotency) and GitHub releases, uploads group-keyed assets, creates SLSA provenance and SBOM attestations (idempotent: checks for an existing attestation first). One attestation per build directory, not per target.
6. **`confirmAvailability`** (`steps/confirm-availability.ts`) — after `runReleases` and the close-linked-issues follow-on, before `emitPublishing`, so a hold never delays tags or releases: polls every successful npm target's exact `name@version` on its registry until it resolves or `registry-confirm-timeout` elapses, concurrently, under its own `Confirm registry availability` log group (opened only when there is something to probe — not on dry-run, ceiling `0`, or a wave with no npm target). Requires `NpmRegistry | ActionLogger`; the `npm-token` arrives as an option from the decoded `Inputs`, not a second input read. Never fails the run and never flips `success`/`outcome` — a held package is published, just not yet resolvable. See [npm-publish-hold](../gotchas/npm-publish-hold.md).

Ordering is established **once, at the source**: immediately after `detectReleases`, `steps/publishing.ts` sorts the detected set dependency-first via `sortReleasesTopologically`, so tag strategy, build & SBOM, publish, and releases all run in the same order — previously only `runPublishTargets` sorted while the rest consumed alphabetical detection order.

**`publishDirectoryGroup`** probes then decides, per npm target in a directory group: pack once per group (same tarball for every target sharing the directory); resolve the token via `pickToken`, failing by name ("no github-token input") rather than by four identical 403 symptom lines when a GitHub Packages target has none; write auth via `setupAuth` (`Redacted<string>`); probe `NpmRegistry.version`; then decide — version absent → publish → `published`; version present with matching digest → `skipped-identical (recovery)`; digest mismatch → abort → `failed-mismatch`. After every target in the group resolves, existing attestations are checked for and fresh ones written only if absent — the assembly of "build and sign" (`@effected/sbom`) with "store the bundle" (`@effected/github`) lives in `src/release/attest-helpers.ts`, in one place so `publish.ts` and `releases.ts` do not each grow a copy.

**Abort-before-releases gate** — after `runPublishTargets`, `success` is true only when every package's every target either published or recovered as `skipped-identical` (`allSuccess = successfulPackages === targetsByPackage.size` in `src/release/publish.ts`); any single failed or mismatched target skips the release step and fails the workflow, while a fully-recovered run proceeds normally.

**Release kind** — see [github-only](../glossary/github-only.md).

**Per-byte-group layout** — see [byte-group](../glossary/byte-group.md). `src/utils/group-id.ts` derives the group id from a build directory for asset naming and step labels.

**Token resolution** — `pickToken(registry, npmToken, ghPkgsToken, customTokens)` in `src/release/resolve-targets.ts` resolves each target registry's credential from one `classifyRegistry` call, switched exhaustively: `npm` uses the `npm-token` input when present, OIDC otherwise; `github-packages` uses the `github-token` input read back from `GithubPackagesTokenState`; `jsr` publishes over OIDC with no token of its own; `custom` uses the `custom-registries` input (parsed by `src/utils/custom-registries.ts` into trailing-slash-normalized URL → `Redacted` token pairs) first, then an env var derived from the URL.

**Token-auth fallback** — GitHub Packages publishes with `tokenAuth: true` from the first attempt, because npm 11.5+ still attempts the OIDC exchange whenever Actions OIDC env is present, which GitHub Packages 404s and ignores; stripping that path avoids the failed exchange. The npm public registry prefers OIDC trusted publishing and retries once with `tokenAuth: true` on failure, since an unconfigured package (no trusted publisher yet) cannot bootstrap the OIDC exchange for its first-time publish.

**Attestation assembly** — `src/release/attest-helpers.ts` is the one place the kit's split (`@effected/sbom` builds and signs; `@effected/github` stores) is assembled into a pipeline, so `publish.ts` and `releases.ts` never grow their own copy.

**SBOM skip for `github-only`** — Phase 3 skips SBOM generation entirely for a workspace that resolved no publish target: an SBOM describes a distributed artifact, and a `github-only` workspace has no tarball or release-asset upload to attach one to. Skips are named in `BuildSbomResult.sbomSkipped`, distinct from `sbomFailures`.

**Group-keyed assets** — per byte-group, `runReleases` uploads `<name>-<version>.<group>.tgz`, `.sbom.json`, `.api.json`, and an unattested `.meta.tgz`; `insertGroupToken` inserts the group token before the final extension (or before a compound extension like `.meta.tgz`). All uploads are idempotent by asset name.

**`meta.tgz`** — `tarMetaFolder` (`src/release/meta-archive.ts`) packs the bundler's sibling `meta/` folder (`<unscoped>.api.json` + `tsconfig.json` + `package.json`) plus the copied SBOM, for downstream documentation builders; API-reference docs are read from that `meta/` folder, not the publish directory.

## Phase 3a: issue closing

`steps/close-issues.ts` runs `close-linked-issues.ts`, which queries the merged PR's `closingIssuesReferences` via `GitHubIssue.getLinkedIssues` (up to 50 issues). An event payload with no pull-request number is a **skip**, not a failure.

**Close-before-comment idempotence** — for each linked issue: an already-`CLOSED` issue is skipped rather than re-closed; the close happens before the comment, so a failed close posts no comment and a successful one is visible to the next run as `CLOSED`; the comment itself goes through `GitHubIssue.commentOnce` with a `CommentMarker` carrying the release PR number, so a re-run of the same release skips the comment while a later release closing a reopened issue still posts. **The marker lookup is create-or-skip and not atomic** — two racing runs can both post — which is why the close-before-comment ordering stays load-bearing rather than being replaced by the marker alone.

This phase exists separately from the close-linked-issues follow-on inside `steps/publishing.ts` (which runs after a successful publish and, like a `runReleases` failure, fails the phase with a deferred `ReleasesError` only after the output has been emitted — housekeeping that silently did not happen is what a re-run exists to fix) because a workflow may route the merge-that-publishes and the merge-that-only-closes-issues independently.

## Module dependency graph

```text
main.ts  (guard + Action.run only)
  |
  +-- layers/app.ts
  |     MainLive = mergeAll(makeAppLayer(dryRun), toolDiscovery)
  |                  .pipe(provideMerge(ReleaseLive))
  |     makeAppLayer requires LocalExec | Git | PackageManagerDetector
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
        |       +-- utils/porcelain-changes.ts (Git status -> FileChange)
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
        +-- steps/validation.ts  (Phase 2 -- order and value flow only)
        |     steps/link-issues.ts        -> utils/link-issues-from-commits.ts
        |     steps/build-validation.ts   -> utils/validate-builds.ts, utils/turbo-summary.ts
        |     steps/publish-validation.ts -> release/validation.ts (runValidation)
        |         +-- release/resolve-targets.ts (resolvePublishableTargets, pickToken)
        |         +-- release/changeset-config.ts (ChangesetConfig service)
        |         +-- utils/sort-releases-topologically.ts (DependencyGraph.sortSubset)
        |         +-- utils/count-changesets.ts
        |         +-- utils/extract-release-notes.ts, utils/load-release-config.ts
        |         +-- PackagePublish.dryRun (@effected/npm) + SBOM (@effected/sbom)
        |     release/validation-checks.ts (deriveValidationChecks, applyCheckUrls -- PURE)
        |       +-- utils/derive-check-conclusion.ts
        |     steps/per-step-checks.ts    -> CheckRun (@effected/github)
        |     steps/publish-validation-report.ts -> utils/write-sections.ts
        |     utils/create-validation-check.ts (unified check + capCheckSummary)
        |     utils/cleanup-validation-checks.ts (on failure)
        |     release/report.ts (buildValidationComment, buildChecksTable, ...)
        |
        +-- steps/publishing.ts  (Phase 3)
        |     utils/ensure-full-history.ts
        |     utils/sort-releases-topologically.ts  (ordering, ONCE at source)
        |     release/publish.ts
        |       detectReleases     -> GitHubContent / PullRequest / GitHubCommit
        |                            + ChangesetConfig.isIgnored
        |       runBuildAndSbom    -> LocalExec + @effected/sbom
        |       runPublishTargets  -> WorkspaceDiscovery + PublishabilityDetector
        |                            + PackagePublish + NpmRegistry
        |       release/attest-helpers.ts (sign via @effected/sbom, store via @effected/github)
        |     utils/determine-tag-strategy.ts (between publish and releases)
        |     release/releases.ts -> GitHubRelease + GitTag + ArtifactMetadata
        |                           + Attestation + OidcTokenIssuer
        |     steps/confirm-availability.ts -> NpmRegistry (post-publish probe, never fails)
        |     utils/package-urls.ts (per-registry package page URL; tarball URL comes from the probe)
        |     release/report.ts (getPackagePageUrl, for release notes)
        |     utils/close-linked-issues.ts (follow-on; a failed close fails the phase after emission)
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

## Shared infrastructure

- `src/release/layers.ts` — the workspace graph and the release-domain layer (see Layer graph, above).
- `src/layers/app.ts` — `MainLive`, `makeAppLayer(dryRun)`, `toolDiscovery` (see Layer graph, above).
- `src/utils/write-sections.ts` — the read-fold-refresh-post both phases perform on the sticky comment: read before writing (an `upsert` from `""` deletes every other section); a failed read degrades to `""` rather than aborting; one write, not one per section; banners are refreshed across the whole body afterward.
- `src/utils/managed-sections.ts` — per-section state for the release PR body and sticky comment, so a caller cannot get the `running`-transition write wrong.
- `src/utils/grouped.ts` — runs an effect inside a collapsible Actions log group, resolving `ActionLogger` itself.
- `src/utils/github-urls.ts` — web URLs into the GitHub instance the run executes against, so a new link cannot be added without confronting where the host comes from (GHES-correct rather than hardcoded `github.com`).
- `src/utils/npm-cache.ts` — redirects npm's cache off GitHub macOS runners' partially root-owned `~/.npm/_cacache`; called at the top of `program.ts` before any phase runs an npm command.
- `src/utils/detect-package-manager.ts` — delegates to `@effected/workspaces`' `PackageManagerDetector`, which additionally consults `devEngines.packageManager`; falls back to `"npm"` on detection failure.
- `src/utils/ensure-full-history.ts` — full-depth history plus a local ref for the target branch, needed by Phases 1, 2 and 3.
- `src/utils/porcelain-changes.ts` — `git status --porcelain -z` → the `FileChange` set a Git Data API commit carries.
- `src/utils/summary-writer.ts` — builders for job-summary markdown.
- `src/utils/commit-signoff.ts` — resolves the DCO `Signed-off-by` trailer for action-created commits, falling back to `github-actions[bot]` when the App identity is unavailable.
- `src/utils/turbo-summary.ts` — Turbo run-summary detection and rendering; strictly non-fatal.
- `src/utils/detect-repo-type.ts` — monorepo vs. single-package detection and changeset-config reads; exports `matchesIgnorePattern`, the shared matcher behind `ChangesetConfig.isIgnored`.
- `src/utils/release-summary-helpers.ts` — release-title and package-listing helpers over `PublishabilityDetector`; a package's `version` is optional, and consumers answer that absence rather than inventing a placeholder.
- `src/utils/determine-tag-strategy.ts` — `isMonorepoForTagging(root)` plus the pure `determineTagStrategy`.
- `src/utils/extract-release-notes.ts` — first-H2-to-second-H2 CHANGELOG section extraction, used by Phase 2 and Phase 3.
- `src/utils/derive-check-conclusion.ts` — check-run conclusion from structured `ValidationFinding` arrays, with `strict-warnings` escalation.
- `src/utils/load-release-config.ts` — layered config loading (repo file, action input, env var) for SBOM metadata, decoded through `SilkReleaseConfig`.
- `src/utils/custom-registries.ts` — parses the `custom-registries` input into trailing-slash-normalized URL → `Redacted` token pairs.

## Schema layer

`src/schema/` is the input decode point, the output declaration point, and the structured output contract. See [release-output](../interfaces/release-output.md) for the wire shape, [versioned-output-schema](../decisions/versioned-output-schema.md) for why the output document is versioned separately from the input document, and [schema-numeric-fields](../conventions/schema-numeric-fields.md) for the `Schema.Int` rule every numeric field follows.

## Key patterns

**Grouped logging** — phase bodies use `grouped(name, effect)` (`src/utils/grouped.ts`) for collapsible Actions log groups and emit their own summary lines; `Effect.logInfo` is buffered/discarded on success inside a group, so live log output must go through the logger's own line members.

**State management** — GitHub Actions state passes data between `pre`, `main`, and `post` via `Schema.Class`es in `src/state.ts`: `StartTimeState` (wall-clock timestamp for duration reporting) and `GithubPackagesTokenState` (the optional workflow `github-token`, written by `pre.ts`, read by the Phase-3 publish flow). The App installation token is a third identity, persisted by `GitHubToken.provision` under the kit's own internal key and read back via `GitHubToken.read()`. `process.env.GITHUB_TOKEN` is never written persistently; the one scoped exception is native versioning's bounded mutation around `ReleasePlanner.apply`. Every secret-bearing token API takes or decodes to `Redacted<string>` — `GitHubApp.generateToken` / `revokeToken`, the client constructors, `PackagePublish.setupAuth`, and the decoded `InstallationToken.token`.

**Error handling strategy** — pre-action is fatal (the token is required for everything after it); post-action is non-fatal (`Effect.catch` plus `Effect.catchDefect`, so a post failure never obscures a run already failing); phase bodies follow the posture declared per step, above; Phase 3 per-target failures are recorded rather than thrown, with the abort-before-releases gate checking aggregate results afterward; network operations (phase detection, PR creation, native-version apply) carry retry logic for transient API failures.

**GitHub API usage** — all GitHub interaction goes through `@effected/github` services. GraphQL is a **member of `GitHubClient`** — there is no separate `GitHubGraphQL` service to wire — and backs queries needing nested data (`closingIssuesReferences` on PRs, branch protection mutations). No raw Octokit calls remain in `src/`. Registry reads go through `NpmRegistry` over `FetchHttpClient`; publishing goes through `PackagePublish` over `LocalExec`.

**Dry-run mode** — `dry-run` is decoded once in `schema/inputs.ts` and used only to build the `DryRun` service; every consumer asks that service rather than re-reading the input. In dry-run mode, package-manager commands run with `--dry-run` flags, Git branch and commit operations are skipped, check-run titles are prefixed with the `🧪` marker (the only title decoration), and registry publish commands use the dry-run flag. All validation logic runs identically to production mode.

[^src-main]: src/main.ts
[^src-program]: src/program.ts
[^src-layers-app]: src/layers/app.ts
[^src-release-layers]: src/release/layers.ts
[^src-steps]: src/steps
[^src-schema]: src/schema
[^src-utils]: src/utils
</content>
