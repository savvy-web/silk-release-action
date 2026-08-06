---
"@savvy-web/silk-release-action": minor
---

## Features

* Package-manager detection now also consults `devEngines.packageManager`, which corepack treats as authoritative over the top-level `packageManager` field. Previously the lockfile-based probe could disagree with corepack about which manager owned the workspace.
* `dlx` now detects the workspace's package manager instead of always assuming pnpm. In an npm workspace it uses npm's prefix instead of invoking a `pnpm dlx` that isn't there; outside any workspace it now fails with a typed error instead of shelling out to a launcher that doesn't exist.

## Bug Fixes

* An unrecognized `phase` input now fails typed, naming the accepted values. Previously an invalid value was cast unchecked, missed every switch arm, fell through to a no-op default, and **silently skipped the entire release on a green job.**
* Three outputs are renamed to match the manifest's kebab-case convention: `closed_issues_count` → `closed-issues-count`, `failed_issues_count` → `failed-issues-count`, `closed_issues` → `closed-issues`. All three were previously written but never declared in `action.yml`, so no documented output contract covered the old names.
* Removed a leftover unmasked plaintext token write to the process environment; its only consumer had already been deleted, so the token was being exposed to every subsequent operation for no purpose.
* Under CI, the test suite no longer runs the action itself as an import side effect.

## Documentation

* `custom-registries` is now explicitly labelled NOT WIRED UP in `action.yml` and the docs — it has been a silent no-op since v0.2.3, tracked in [#215](https://github.com/savvy-web/silk-release-action/issues/215).
