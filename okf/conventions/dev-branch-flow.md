---
type: Convention
title: Land feature work on dev, never directly on main
description: Merge feature work into dev first; main always reflects the last released state, and a push to main is what triggers a release.
tags:
  - ci
  - release
stale_after: "2026-12-13T00:00:00Z"
sources:
  - id: release-workflow
    resource: ../../.github/workflows/release.yml
  - id: branch-sync-workflow
    resource: ../../.github/workflows/branch-sync.yml
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: fb264e1d1b7be5e04402ddf2f3288eb67133ee90ae748bc9550c74fe0e6379f8
status: draft
---

# Land feature work on dev, never directly on main

Land all in-progress feature work on the long-lived `dev` branch, never
directly on `main`. Treat `main` as always reflecting the last released
state: merge `dev` into `main` only when the accumulated work is ready to
release, since that push is what triggers Phase 1 (changeset detection,
creating or updating `changeset-release/main` and the release PR).

Pin this repository's own `release.yml` to the shared workflow's `@main`
branch, not `@dev` — `uses:
savvy-web/.github/.github/workflows/release.yml@main`.[^release-workflow]
Every other consumer, including the end-to-end test repo
`savvy-web/silk-integration`, pins the shared workflow's matching `dev`
branch instead, so those repos exercise in-progress workflow changes
before they reach `main`. This repo is the exception because the action
under development is already the thing under test here: pinning the
caller to `@dev` as well would make a failed run ambiguous between a bug
in the action and a bug in the calling workflow.

After a release publishes, let `branch-sync.yml`'s `sync-dev` job even
`dev` out with `main` automatically.[^branch-sync-workflow] It keys off
*`main` moving*, not off a release being published, because a push to
`main` that produces no release — a dependency promotion with no
changeset, for example — still has to even the branches out, and a
release-triggered form would miss exactly that case. Merging
`changeset-release/main` is itself a push to `main`, so the release path
stays covered by the same trigger. Do not force-reset `dev` by hand: the
job force-resets `dev` only when git proves by patch-id that `dev` holds
nothing `main` lacks. A `dev` that is genuinely ahead is preparing a
release; the job rebases it instead, and if the rebase conflicts, the job
touches nothing at all.

See the [workspace module](../modules/workspace.md) for the rest of
`branch-sync.yml`'s job set, and the
[shared release workflow](../consumers/shared-release-workflow.md)
consumer for the `@dev`/`@main` pinning split from the shared workflow's
own side.

[^release-workflow]: `../../.github/workflows/release.yml`
[^branch-sync-workflow]: `../../.github/workflows/branch-sync.yml`
</content>
