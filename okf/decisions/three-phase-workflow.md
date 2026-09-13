---
type: Decision
title: Three-phase workflow
description: Split the release into branch-management, validation, and publishing phases, each triggered by a distinct GitHub event, plus a 3a close-issues phase.
status: draft
tags:
  - architecture
  - release
sources:
  - id: detect-workflow-phase
    resource: ../../src/utils/detect-workflow-phase.ts
  - id: program-switch
    resource: ../../src/program.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 1d5238a618cf7ec911027f000c9fdf4c6c780a8d0fdaf3cb4f61bf2f3d760fea
---

# Three-phase workflow

## Context

A release needs three logically distinct kinds of work — deciding what
should release, verifying it builds and packs cleanly, and actually
publishing it — and those three kinds of work run at very different
speeds and need very different levels of human trust. Branch management
has to run on every push to `main` and stay fast, since it gates nothing
but creates the staging area. Validation (build compilation, publish
dry-runs, SBOM generation) can be slow, and slow work must not block
pushes to `main`. Publishing must never run without a human having
reviewed and merged the release PR first.

## Decision

The release is split into three triggers, detected by
`detectWorkflowPhase`[^detect-workflow-phase] and routed by a five-arm
switch in `program.ts`[^program-switch]:

1. **Phase 1 (branch management)** — push to `main` that is not a release
   commit. Fast, no builds; creates or updates the release branch and PR
   as a staging area.
2. **Phase 2 (validation)** — push to the release branch. Runs build
   compilation, publish dry-runs, and SBOM generation, slow work that
   would otherwise block `main`. The release PR is the visible gate for
   review.
3. **Phase 3 (publishing)** — push to `main` carrying a release commit,
   detected from a merged release PR. Runs only after human approval via
   the merge.
4. **Phase 3a (close-issues)** — a `pull_request` event where the release
   PR (`changeset-release/main` to `main`) was merged, detected from the
   event payload without API calls, closes issues the release resolves.

Detection runs in a fixed priority order: an explicit `phase` input
first (skipping detection entirely, for callers such as
`silk-router-action` that pre-determine phase), then Phase 3a, then
Phase 3 (two-strategy detection with retry: primary queries
`listPullRequestsAssociatedWithCommit`, fallback matches
`merge_commit_sha` against recently closed PRs from the release branch,
three attempts with five-second delays for GitHub API eventual
consistency), then Phase 2, then Phase 1, with any other branch or event
falling through to a logged no-op.

The `phase` input is decoded against the literal `WorkflowPhase` union
rather than cast. Under a cast, a typo such as `publshing` satisfied the
type, matched no arm of the switch, fell through to the `default:` no-op
arm, and the whole release silently did nothing while the job reported
green. The decode instead fails the run when the input does not match a
known phase.

## Alternatives rejected

**One monolithic job.** Folding branch management, validation and
publishing into a single job removes the release PR as a gate: there
would be no point at which a human reviews the plan before slow
validation work runs, and no point at which validation results are
visible before publishing proceeds. It also couples the fast, frequent
path (every push to `main`) to the slow, occasional one (build and
publish), so ordinary development pushes would pay for work they do not
need.

**Validation on `main`.** Running build validation and publish dry-runs
on every push to `main` would block ordinary development with slow work
that only matters once a release is actually being staged. Confining
validation to pushes on the release branch means it runs only when a
release is actually pending.

## Consequences

Validation failures never block development on `main`, since Phase 2
runs only on the release branch. Publishing failures are isolated from
the validation context, since Phase 3 is a separate trigger with its own
failure posture. Phase detection itself becomes a single, testable
decision point instead of logic embedded per-workflow, and a
mis-detected phase (such as the `phase`-input typo case above) now fails
loudly rather than silently no-op'ing a release.

[^detect-workflow-phase]: `../../src/utils/detect-workflow-phase.ts`
[^program-switch]: `../../src/program.ts`
