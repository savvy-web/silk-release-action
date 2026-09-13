---
type: Consumer
title: silk-integration
description: The end-to-end test repository that exercises this action's committed bundle against real registries and a real release PR.
repository: savvy-web/silk-integration
tags:
  - testing
  - release
sources:
  - id: silk-integration
    resource: "https://github.com/savvy-web/silk-integration"
  - id: pr-243
    resource: "https://github.com/savvy-web/silk-integration/pull/243"
  - id: pr-242
    resource: "https://github.com/savvy-web/silk-integration/pull/242"
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: cbb7dd13d849be63800898be046d6cf8155e6fdd04352bc23100907a42cf43e2
status: draft
---

# silk-integration

## Surfaces exercised

`silk-integration` runs all three phases end-to-end against a real
registry set: Phase 1 branch management and release-PR creation, Phase 2
build validation and publish dry-runs, and Phase 3 publishing, tags, and
GitHub releases. It is also the surface of record for the release PR body
and the sticky comment, and for the closing-reference linking those write
— see [Release PR surfaces](../interfaces/release-pr-surfaces.md).

## Edge

This consumer exercises the committed `dist` bundle through the shared
release workflow, not this repository's source — see
[Run an end-to-end integration test](../runbooks/integration-testing.md)
for how a change reaches it.

## Consumer of record for the closing-reference contract

The two spellings of the closing reference — a comma-joined
`Closes #1, #2` inside the proposed-squash-commit fence, and one bare
`Closes #N` per line outside every fence — were verified empirically against this
repository. Its PRs #242 and #232 shipped release PRs with empty bodies
that linked nothing;[^pr-242] PR #243 confirmed the bare-line spelling is
the one GitHub's linker actually counts.[^pr-243]

## Boundary

`silk-integration` pins the shared release workflow at
`savvy-web/.github/.github/workflows/release.yml@dev` rather than
`@main`, so it exercises in-progress workflow changes ahead of this
repository's own release workflow, which pins `@main`.

## Open questions

None currently open that this concept can verify independently of the
runbook and interface it links.

See also: [Run an end-to-end integration test](../runbooks/integration-testing.md),
[Release PR surfaces](../interfaces/release-pr-surfaces.md).

[^pr-243]: `https://github.com/savvy-web/silk-integration/pull/243`
[^pr-242]: `https://github.com/savvy-web/silk-integration/pull/242`
