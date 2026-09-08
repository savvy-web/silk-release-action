---
"@savvy-web/silk-release-action": minor
---

## Features

* Every numeric field in the `result` output is now declared as a JSON `integer`. All 31 of them — counts, byte sizes, the release PR number and the GitHub release id — previously lowered to a union of `number` and the string sentinels `"Infinity"`, `"-Infinity"` and `"NaN"`, because Effect's default number codec round-trips non-finite values as strings. The action never emitted those values, so no payload changes shape, but the published schema is now accurate and the 34 `title`/`description` annotations the union was swallowing are present again. No field was added, removed or retyped: `schemaVersion` remains `"2"` and the document stays at `schemas/5.0.0/`.
* `pnpm generate-schema` gains two flags. `--check` (alias `--dry-run`) reports what a run would write and writes nothing; `--allow-contract-change` (alias `--force`) writes through the published-version contract gate after a warning, for a schema version that has not shipped yet. The gate itself now comes from `@effected/schemastore`'s `contractChanges` policy rather than a hand-rolled preflight, and names the version it suggests bumping to when it refuses.

## Bug Fixes

* A workspace that declares no `version` is handled rather than assumed away. Publishability is decided by `publishConfig`, so a version-less private package or monorepo root is an ordinary shape. Such a package is now skipped during released-package detection instead of being treated as brand new and released without a version, and a release PR title or commit body renders it as its bare name instead of the literal `name@undefined`.

## Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @vitest-agent/plugin | devDependency | updated | ^2.5.4 | ^3.0.1 |
| @effected/pnpm-plugin-effect | config | updated | 0.6.17 | 0.7.1 |
| @savvy-web/pnpm-plugin-silk | config | updated | 0.31.2 | 0.34.1 |
| pnpm | packageManager | updated | 11.25.0 | 11.26.0 |

The two config-dependency bumps move the catalog: `effect` `4.0.0-rc.109` to `4.0.0-rc.112`, `@savvy-web/silk-effects` to `7.5.1`, `@effected/workspaces` to `0.20.1` and `@effected/schemastore` to `0.6.0`.
