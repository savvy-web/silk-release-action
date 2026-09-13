---
type: Consumer
title: The shared release workflow
description: The savvy-web/.github reusable workflow that every consumer, including this repository, calls to run the three-phase release process.
repository: savvy-web/.github
tags:
  - ci
  - release
sources:
  - id: release-yml
    resource: ../../.github/workflows/release.yml
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 43d44a9e5de0a2341f9cd2ac764f605cb7b0af36c70084d69d03f7933b6465e9
status: draft
---

# The shared release workflow

## Surfaces exercised

The shared workflow drives this action through its declared inputs — see
[Action inputs and outputs](../interfaces/action-inputs.md) — including
the `phase` input, which the workflow (or a caller sitting in front of
it, such as `silk-router-action`) can set explicitly to skip this
action's own phase auto-detection. It also owns the zero-install
contract for Phase 1: the workflow passes `install-deps: false` so branch
management runs without a consumer package install, relying entirely on
the bundled silk-effects `ReleasePlanner` — see
[Native versioning](../decisions/native-versioning.md).

## Edge

Workflow-level decisions — whether dependencies install, what job
permissions are granted (including `packages: write` for GitHub
Packages), and concurrency — live in the caller's workflow file and in
`savvy-web/.github`, not in this repository's `src/`. This repository's
own `.github/workflows/release.yml` shows the calling shape: a
`workflow_call` `uses:` line, a permissions block, and a `with:` block
passing `dry-run`, `auto-merge`, and `skip-claude-review`.[^release-yml]

## Version pinning

This repository uses the **simple release workflow** (private repository,
no npm packages). Consumer repositories generally pin the shared workflow
at `@dev` so they exercise in-progress workflow changes before those
changes reach `main`. This repository's own `.github/workflows/release.yml`
is the deliberate exception: it pins `@main`, not `@dev`.[^release-yml]
The action under development here is already the thing under test, and
pinning the caller to `@dev` too would make a failed run ambiguous
between an action bug and a workflow bug.

## Open questions

None currently open that this concept can verify independently of the
inputs interface and the native-versioning decision it links.

See also: [Action inputs and outputs](../interfaces/action-inputs.md),
[Native versioning](../decisions/native-versioning.md).

[^release-yml]: `../../.github/workflows/release.yml`
