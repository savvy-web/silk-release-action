---
type: Decision
title: Phase 3 is six gated steps, target resolution ahead of the build gate
description: Phase-3 publishing runs detect, plan, build-and-SBOM, publish, releases and summary as six sequential gates, with target resolution deliberately placed before the build gate because it cannot fail.
status: draft
tags:
  - release
  - architecture
sources:
  - id: publishing-step
    resource: ../../src/steps/publishing.ts
  - id: publish-module
    resource: ../../src/release/publish.ts
  - id: releases-module
    resource: ../../src/release/releases.ts
  - id: sort-topo
    resource: ../../src/utils/sort-releases-topologically.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 480f24042287b998f1229abc9484f776acdf1584ee100f4aa02feabb39aff50d
---

# Phase 3 is six gated steps, target resolution ahead of the build gate

## Context

Phase 3 publishes packages, creates git tags and GitHub releases, and
attests build artifacts. Each of those stages can fail independently
(target resolution, the build, an individual registry publish, tag/release
creation) and a run that fails partway through still needs to report
something useful about the packages it never got to. An earlier
implementation returned a `PublishPackagesResult` on a partial publish
failure instead of raising, which let a run that published 4 of 8 targets
report a green job — the failure was recorded in the returned data but
nothing read it, so the workflow exited success.

## Decision

`steps/publishing.ts` runs Phase 3 as six sequential steps, each a
gate on the ones after it:[^publishing-step]

1. **`detectReleases`**[^publish-module] — detects released packages from
   the merged release PR's file diff, falling back to the commit diff, then
   drops changeset-ignored names via `ChangesetConfig.isIgnored`.
2. **`planWorkspaces`**[^publish-module] — resolves every detected
   workspace's publish targets via `resolvePublishTargetSpecs` (the same
   resolver the build gate uses) and classifies each as
   `github-with-packages` or `github-only`
   (`utils/release-kind.ts`). Placed **deliberately ahead of the Build &
   SBOM gate**: target resolution reads only package manifests, so it is
   cheap and cannot fail, and doing it before the first step that can fail
   means a run that aborts at the build still reports every workspace's
   kind and intended publication count. Resolving inside the publish step
   itself, as the predecessor did, left an aborted run with an empty
   package list and no way to say what it had intended — membership was
   derived from `publishResult.packages`, which is empty on an abort.
3. **`runBuildAndSbom`**[^publish-module] — runs `ci:build` once, then
   generates one CycloneDX SBOM per package that resolved a publish target
   (a `github-only` workspace has no tarball to describe, so it is named in
   `sbomSkipped` rather than given a stray, unattached SBOM). A failed
   build aborts the phase before any tarball is created.
4. **`runPublishTargets`**[^publish-module] — publishes packages. Sorts the
   detected set topologically via `sortReleasesTopologically` before
   publishing (idempotent here since ordering is already established at
   the source — see below), then calls `publishDirectoryGroup` once per
   unique build directory. `runPublishTargets` aborts the phase — via the
   step's own `PublishError` — when any package has a target that failed
   or mismatched; every package's targets must each report
   `success: true` (published or recovered as `skipped-identical`) for the
   step to proceed to releases.
5. **`runReleases`**[^releases-module] — creates git tags (sha-aware
   idempotency) and GitHub releases, uploads group-keyed tarball, SBOM,
   API-doc and `meta.tgz` assets, and creates SLSA provenance and SBOM
   attestations (idempotent: checks for an existing attestation before
   writing). Attestation failures are non-fatal — a single OIDC hiccup does
   not roll back the release.
6. **Summary** — `buildPublishSummary` generates the sticky-comment publish
   summary and Check Run output.

Ordering is established **once, at the source**: immediately after
`detectReleases`, `steps/publishing.ts` sorts the detected set
dependency-first via `sortReleasesTopologically`, so tag strategy, build &
SBOM, publish and GitHub releases all consume the same order. A prior
version sorted only inside `runPublishTargets`, so tag strategy and
`runReleases` still consumed the alphabetical detection order.
`sortReleasesTopologically` builds a `DependencyGraph.make({ packages })`
from `WorkspaceDiscovery.listPackages()` (there is no standalone
topological-sort service in `@effected/workspaces`), filters
`sortSubset`'s dependency closure back to the released subset, and falls
back to detection order on a cyclic graph.[^sort-topo]

Failures at any gate raise a typed error (`PublishError` from the build or
publish gate, `ReleasesError` from the release gate) rather than returning
a result the caller might not check; `setFailed` only annotates the run,
the exit code comes from whether the effect itself fails. A fully-recovered
publish run (every target `skipped-identical`) is not a failure — it
proceeds to release creation exactly as a fresh publish would.

## Alternatives rejected

**Resolving publish targets inside the publish step itself**, after the
build gate. Rejected because an aborted build then loses every workspace's
intended `kind` and target count — the output can only describe what
`publishResult.packages` recorded, which is empty on an abort.

**Returning a failure result instead of raising `PublishError`.** Rejected
because returning is exactly what let a 4-of-8-target publish report a
green run: nothing downstream was guaranteed to read the returned
`success: false` field, while a raised error is guaranteed to fail the
job.

**Sorting only inside `runPublishTargets`.** Rejected because tag strategy
and `runReleases` then consumed a different (alphabetical) order than the
publish step, so a reader comparing the publish log to the release log saw
packages in two different sequences for the same run.

## Consequences

An aborted Phase-3 run — at the build gate or the publish gate — still
reports every detected workspace's `kind` and intended target count via
`planWorkspaces`'s output, because that step ran and cannot itself have
failed. A publish failure on any target blocks release creation entirely,
so a GitHub release is never created that references a version not fully
on its registries. Attestation is the one non-fatal stage in the chain: a
release can complete successfully with `attestationUrl` left `undefined`
on some targets.

[^publishing-step]: ../../src/steps/publishing.ts
[^publish-module]: ../../src/release/publish.ts
[^releases-module]: ../../src/release/releases.ts
[^sort-topo]: ../../src/utils/sort-releases-topologically.ts
