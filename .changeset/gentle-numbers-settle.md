---
"@savvy-web/silk-release-action": minor
---

## Bug Fixes

* Numeric output fields in the published output JSON Schema (`releasePr.number`, `changesets.count`, `changesetCount`, `packageCount`, `componentCount`, `packedBytes`, `unpackedBytes`, `fileCount`, `totalTargets`, `readyTargets`, and release `id`) no longer accept the strings `"NaN"`, `"Infinity"`, or `"-Infinity"` as valid values. Those values were never legitimately produced by this action; the schema now correctly reflects that only real numbers are possible.
* Restored the `title`/`description` documentation on those same fields in the generated schema. The annotations had been silently dropped as a side effect of an internal Effect upgrade.
