---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

Phase 3 GitHub releases and git tags are now created in the same topological (dependency-first) order as registry publishing. Previously, releases and tags were created in alphabetical workspace order while publishing ran dependency-first, so in multi-package repos the GitHub releases could appear out of order relative to the publish sequence.
