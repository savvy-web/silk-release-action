---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

Fix release PR titles and version-bump commits showing the previous version (e.g. `release: 0.20.5` for a release that publishes `0.20.6`). Phase 1 now refreshes workspace discovery after `changeset version` runs, so the title and commit report the version that will actually be released rather than a pre-bump snapshot cached by `WorkspaceDiscovery`.
