---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

When Phase 1 runs on a push to `main` and `changeset version` produces no changes (no pending changesets), the action previously attempted to open or update a release PR against an identical branch, causing GitHub to reject it with `Validation Failed: No commits between main and changeset-release/main`. The run would fail.

The action now detects the no-op case in the update flow and treats it the same as the existing create-flow cleanup: it closes any open release PR and deletes the release branch, then finishes with a neutral status rather than an error.
