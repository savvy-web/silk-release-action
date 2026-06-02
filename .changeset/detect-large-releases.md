---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

Phase 3 now detects every released package even when a release commit changes more than 300 files. The commit-diff fallback previously used the GitHub compare endpoint, which caps a squash-merged (single-commit) comparison at its first 300 changed files — silently dropping packages whose `package.json` sorted past that limit. Detection now reads the merge commit's full file list via the paginated `changedFiles` API.

* `detectFromCommit` reads changed files via `GitHubCommit.changedFiles` instead of `compare`, so packages are no longer missed in large releases
