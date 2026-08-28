---
"@savvy-web/silk-release-action": major
---

## Breaking Changes

### The structured output is workspace-centric (`schemaVersion: "2"`)

All three phases' `result` output was package-centric with a workspace facade, joined by nullable string keys. The unit is now the **workspace** — the thing a changeset names, that gets a version, a git tag and a GitHub release. `publish.workspaces` and `validation.workspaces` are maps **keyed by workspace name**, each with an `order` array preserving the dependency-first sequence a JSON object cannot. Each workspace carries `kind` (`"github-only"` | `"github-with-packages"`), `success`, `outcome`, `summary`, and a `packages` array — one entry per (package, registry) publication, the unit both a publish and a validation dry-run actually produce. A package carries the registry it targets, plus the build metadata (`directory`, sizes, `sbom`) that rides on it, since several publications can share one tarball packed once. A `github-only` workspace has `packages: []`. The publish phase's discriminator is `phase: "publish"`, not `"publishing"` (the `phase` *input* vocabulary is unchanged).

### `status`, `noop`, `succeeded` and `hasFailures` are replaced by `success` + `outcome`

These overlapping fields are gone from every phase and every level (`deriveStatus` and `ReleaseFlags` are gone with them) in favour of two orthogonal fields: `success` is the boolean gate, `outcome` is the taxonomy. A recovered publish and a fresh upload are both `success: true`, told apart by `outcome` — so a consumer filtering on `success` keeps working when a new outcome member is added. `summary`, `failure` and `totals` sit alongside at the phase level; a `summary` also sits on each workspace. Every summary is derived from the structured fields beside it and never authored independently, so the prose on the wire cannot drift from the data.

Each phase has its own outcome enum, because the interesting states differ:

- **Branch management:** `nothing-to-release`, `branch-created`, `branch-updated`, `branch-unchanged`, `conflicted`.
- **Validation (phase):** `validated`, `nothing-to-release`, `build-failed`, `checks-failed`. **Validation (workspace):** `validated`, `nothing-to-validate`, `skipped`, `partial`, `failed`.
- **Publish (phase):** `released`, `nothing-to-release`, `partial`, `failed`, `blocked`. **Publish (workspace):** `published`, `recovered`, `failed`, `blocked`.

`nothing-to-release`/`nothing-to-validate` cover the previous `noop` — an empty run, or a `github-only` workspace, is a success because nothing failed, not an absence of one. A package's `success` + `outcome` pair (renamed from `ready` + `status`) works the same way on both phases even though the outcome *values* differ, since a dry-run probe and an upload have genuinely different outcomes.

The scalar `status` action output now carries the phase's own outcome label rather than one of four shared ones, and `succeeded` mirrors `success`.

### The output schema is versioned at `schemas/5.0.0/`

The emitted document moved from `silk-release-action.output.schema.json` at the repo root to `schemas/5.0.0/silk-release-action-5.0.0.json`, and `$schema` in every payload points at the new path, so an emitted payload keeps resolving to the shape it was written against instead of silently re-pointing at a newer contract.

## Features

### An aborted publish now reports what it was going to do

Publish-target resolution moved ahead of the build and SBOM gate, so every workspace's `kind` is known before the first step that can fail. A run that dies mid-build now emits the full workspace map with each entry `outcome: "blocked"` — never attempted, deliberately not `failed`, because the workspace did nothing wrong — plus a `failure` object recording **where** (`stage`) and **why** (`reason`). This is the first time a build error reaches the output at all.

### `pnpm generate-schema` refuses to break a published schema

It now checks the diff against the currently published version before writing anything. A `contract`-level change (which includes `default`, `examples`, `readOnly` and `writeOnly`, since consumers act on them even though the JSON Schema spec calls them annotations) against an already-published version fails the run, names every affected document, and says to bump — writing nothing, so the published file is never clobbered on the way to reporting that it would have been.

### Phase 1 resolves the publish-target shape before the build

The release plan's `Targets` column used to read `pending` for every package. Publishability is declared in `package.json`, so what a package publishes to is knowable before anything builds — only *how many* targets are ready needs the build. The column now renders `N target(s)`, or `🏷️ GitHub release only` for a package that publishes nowhere.

## Bug Fixes

- A wave of private tracking packages reported `npm: ✅` and `GitHub Packages: ✅` in the Publish Validation check, because both readiness flags were "nothing failed" booleans that started `true`. Each registry now renders `— none` when the wave has no target for it.
- The Build & SBOM gate generated an SBOM for every detected package, including packages with no publish target — writing a document into the package directory and attaching it to nothing, since release-asset upload is per-target. Such packages are now skipped and named in `sbomSkipped`, distinct from `sbomFailures`.
- The release PR title read `release: 31 packages` for a wave of two private tracking packages, because detection's publishable-package fallback claimed the entire publishable set was releasing when narrowing found nothing. Detection now runs over every workspace package with no fallback. A later widening of that basis then re-broke shared-scope stripping by pulling in changeset-ignored workspaces; the scope basis is now the release-eligible set specifically.
- Phase 2 reported `0 check(s) passed` for five passing checks, because the totals counted the human-readable `outcome` sentence instead of `status`. `checksPassed`, `checksFailed` and a new `checksWarning` now read `status` and sum to the number of checks.
- A validation run with nothing to validate reported `succeeded: false`. It is now `success: true` with `outcome: "nothing-to-release"` — nothing failed, so nothing is reported as failing.
