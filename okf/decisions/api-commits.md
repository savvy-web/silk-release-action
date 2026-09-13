---
type: Decision
title: Commits via the Git Data API, branch linking via GitBranch.createLinked
description: Release-branch commits are created through the Git Data API rather than git push, and branch-to-issue linking uses GitBranch.createLinked, the one operation with no REST equivalent.
status: draft
tags:
  - security
  - release
sources:
  - id: create-release-branch
    resource: ../../src/utils/create-release-branch.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 042851d5391849613de38271a9173c3c95c7fb610264e0b74d931a23b9dfac73
---

# Commits via the Git Data API, branch linking via GitBranch.createLinked

## Context

The release branch needs a commit (the version bump and CHANGELOG
update) and, when changesets reference issues, a branch linked to those
issues so GitHub's UI shows the connection. Both could be done with a
plain `git push` from the runner, but that requires push credentials on
the runner and leaves commit provenance and atomicity to whatever the
git client happens to do.

## Decision

`create-release-branch.ts` creates the release-branch commit through the
Git Data API via the `GitCommit` service, and links the branch to issues
found in the applied changeset files via `GitBranch.createLinked` — the
one operation in this flow with no REST equivalent[^create-release-branch].

## Alternatives rejected

**`git push` from the runner.** Pushing directly would require the
runner to hold push-capable git credentials, would not be atomic with
branch creation (a push and a separate branch-creation step can race with
a concurrent push), and would not produce an auto-signed, "verified"
commit — signing would have to be arranged separately, if at all.

## Consequences

Commits created by a GitHub App through the Git Data API are automatically
GPG-signed and show as "verified" in the GitHub UI, with no signing key to
manage in this repository. Branch creation and the commit are both API
calls, so there is no race window with a concurrent push to the same ref.
No git push credentials are ever placed on the runner — only the API
token is used. The commit message carries a DCO `Signed-off-by` trailer
via `utils/commit-signoff.ts`, satisfying the DCO check the same way a
human-authored commit would.

[^create-release-branch]: `../../src/utils/create-release-branch.ts`
