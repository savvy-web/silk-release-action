---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

### Pre-publish dry-runs no longer fail on the runner's npm cache

Phase-2 validation dry-runs were failing with `npm error code EACCES` ("Your cache folder contains root-owned files") on GitHub's macOS runners, where `~/.npm/_cacache` is partially root-owned and current npm refuses to use it. The dry-run now passes its `packageManager` through to `PackagePublish.dryRun`, which (via the updated `@savvy-web/github-action-effects`) runs npm against a runner-writable cache and dispatches through the same npm executor as the live publish. A dry-run therefore validates against the exact npm the publish will run instead of the runner's bundled one.
