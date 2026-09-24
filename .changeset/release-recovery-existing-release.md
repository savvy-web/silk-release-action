---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

- Fixed Phase 3 recovery runs failing when the GitHub releases already exist. GitHub answers a duplicate release with a `422` that the GitHub client classified as a rejection rather than "already exists", so each existing release was reported as an error. The action now looks up the release by tag and reuses it. If no release is found, it reports the original error.
