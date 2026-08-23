---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

- Ship the `on-build` validation gate in the bundled artifact. Version 4.6.4 declared the input in `action.yml` but its committed `dist` predated the feature, so the gate was silently ignored at runtime; the bundle now reads and enforces it.
