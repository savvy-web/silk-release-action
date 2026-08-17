---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

* The "Closed by release PR #N merge." comment posted on a linked issue during Phase 3 publishing is now written through the kit's `commentOnce`, keyed by a hidden marker scoped to the release PR. A re-run of the publishing phase can no longer post the comment twice, even in the partial-failure window between closing the issue and commenting on it — the close-before-comment ordering is retained as a second line of defense, not replaced.

## Refactoring

* Closing-keyword reference parsing (`closes/fixes/resolves #N` in commit messages) now uses the shared `harvestIssueReferences` grammar from `@effected/github` instead of a local regular expression. Behavior is unchanged.
