---
type: Decision
title: Recreate the release branch from main rather than rebase
description: update-release-branch.ts recreates the release branch from main on every update instead of rebasing it, and treats a no-op version as a terminal "nothing to release" state.
status: draft
tags:
  - release
sources:
  - id: update-release-branch
    resource: ../../src/utils/update-release-branch.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: c0127dbb221d1f032c3e3ee63bec92e2ac673df2425de095294a8d867fb879ce
---

# Recreate the release branch from main rather than rebase

## Context

The release branch contains only machine-generated content — version
bumps and CHANGELOG updates produced by native versioning — never manual
commits a human added directly on the branch. Updating it therefore never
needs to preserve branch-local history the way a rebase would.

A recreated branch that then applies the same pending changesets as
before can come out byte-identical to `main`, when nothing new needs to
release. GitHub rejects opening a pull request in that state with "No
commits between `main` and `changeset-release/main`", which previously
made the whole run fail.

## Decision

`update-release-branch.ts` recreates the release branch from `main` on
every update rather than rebasing it: it applies changesets natively
against a fresh branch from `main`'s HEAD and commits with that HEAD as
parent[^update-release-branch].

When versioning yields no changes — the recreated branch would be
identical to `main` — the flow treats this as an invalid "nothing to
release" state rather than attempting to open a no-op PR: it closes any
open release PR (`PullRequest.update`), deletes the branch
(`GitBranch.delete`), skips the reopen/title-update/create-PR steps
(guarded by an internal `branchDeleted` flag), and emits a `neutral`
check-run conclusion. `UpdateReleaseBranchResult.deleted` carries this
outcome back to the step, which reports `updated: false` and a null
release PR.

## Alternatives rejected

No alternative flow is exercised in code: rebasing was never adopted,
since the branch never carries manual commits worth preserving, and there
is no scenario in which recreation loses content a person put there.

## Consequences

Recreation is atomic and simple: there is never a merge conflict to
resolve against the branch's own prior state, because the branch is
rebuilt from `main` every time rather than incrementally advanced. The
"nothing to release" terminal state (closing the PR, deleting the branch,
`neutral` conclusion) turns what used to be a hard failure — GitHub's "No
commits between…" rejection — into an expected, reported outcome that
matches how the create flow already handles a no-op version.

[^update-release-branch]: `../../src/utils/update-release-branch.ts`
