---
type: Glossary
title: github-only
description: A workspace that resolved zero publish targets — versioned, tagged and released on GitHub, published nowhere, and the intended steady state, not a degraded release.
tags:
  - release
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 9d5eb5863cddb69199911e1bbcc2dc1e4663103f5a5964f91d3d7e25505e069a
sources:
  - id: release-kind-source
    resource: ../../src/utils/release-kind.ts
  - id: build-sbom-result
    resource: ../../src/release/publish.ts
---

# github-only

`github-only` is one of the two values of `ReleaseKind`
(`src/utils/release-kind.ts`), the classification `releaseKindOf(targetCount)`
assigns to a workspace based on how many publish targets it resolved: zero
targets is `github-only`, one or more is `github-with-packages`.[^release-kind-source]

A `github-only` workspace is fully versioned, changelogged, tagged, and given
a GitHub release — nothing about the release pipeline stops early for it —
and it is published to **no registry**, because it resolved no publish
target to upload to.[^release-kind-source]

## The trap

The obvious reading of "published nowhere" is that something failed or was
skipped. It is neither: `github-only` is the **intended steady state** for a
private tracking package — one that exists only to give changesets
something to version, carries no `publishConfig`, and produces no build
artifact — not a degraded `github-with-packages`. Before this
classification existed, the two cases were told apart ad hoc by asking
whether some array happened to be empty, and the old render was `⏭️ no
targets`, which reads as "something was skipped" precisely because the
"skip" emoji implies work that should have happened but didn't. The current
render, `🏷️ GitHub release only` (`releaseKindCell`), uses a tag icon
because a tag is literally what the package gets — nothing was
skipped.[^release-kind-source]

## Shared vocabulary

The classification and its rendering are shared across every phase rather
than reimplemented per surface:[^release-kind-source]

- `releaseKindOf(targetCount)` — classifies a single workspace.
- `releaseKindLabel(kind)` / `releaseKindIcon(kind)` / `releaseKindCell(kind)`
  — render a kind as a short label, an icon, or both together (e.g.
  `🏷️ GitHub release only`).
- `tallyReleaseKinds(targetCounts)` — counts a wave's packages by kind.
- `summarizeWorkspace`, `summarizeValidationWorkspace`,
  `summarizeReleaseWave`, `summarizeBranchManagement`, `summarizeValidation`
  — derive each phase's one-line `summary` field from the same structured
  facts, so the wire prose cannot drift from the data beside it.

Consumers of the vocabulary: the Phase-1 table (`utils/release-table.ts`'s
`targets` column), the Phase-2 comment and check-run summaries
(`release/report.ts`), and the Phase-3 log and output
(`release/publish.ts`, `schema/release-output.ts`).

## Downstream effect: SBOM generation is skipped

Phase 3 skips SBOM generation entirely for a `github-only` workspace. An SBOM
describes a distributed artifact; a `github-only` workspace packs no
tarball and has no release-asset upload to attach a BOM to, so generating
one anyway used to produce a stray, unattached `<unscoped>.sbom.json` and a
log line announcing an artifact that went nowhere. `runBuildAndSbom` names
every such skip in `BuildSbomResult.sbomSkipped`, kept distinct from
`sbomFailures` since a skip here is the correct outcome and a failure is
not.[^build-sbom-result]

[^release-kind-source]: `../../src/utils/release-kind.ts`
[^build-sbom-result]: `../../src/release/publish.ts`
