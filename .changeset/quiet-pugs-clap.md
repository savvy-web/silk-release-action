---
"@savvy-web/silk-release-action": patch
---

## Refactoring

* Adopt `registryShortLabel`, `registryDisplayName` and `registryHost` from `@effected/npm` (effected#196) and delete the local `src/utils/registry-label.ts`. The kit carries this repo's vocabulary verbatim — `npm`/`github`/`jsr` short labels, `npm`/`GitHub Packages`/`JSR` display names, hostname fallback for a custom registry — so log-tree rows, publish summaries and report prose render identically to before.
* `__test__/registry-label.test.ts` now targets `@effected/npm` and serves as an adoption guard against upstream string drift.
