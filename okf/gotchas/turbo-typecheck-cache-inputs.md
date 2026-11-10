---
type: Gotcha
title: A FULL TURBO green typecheck can mean no typecheck ran
description: "pnpm typecheck reporting FULL TURBO and green looks like tsc --noEmit passed; if types:check's inputs list had drifted from the tsconfig's include list, a test-only change would hit the cache and no check would have run at all."
resource: ../../turbo.json
tags:
  - ci
  - dx
stale_after: "2026-12-13T00:00:00Z"
sources:
  - id: turbo-json
    resource: ../../turbo.json
  - id: tsconfig-root
    resource: ../../tsconfig.json
  - id: tsconfig-action
    resource: ../../node_modules/@effected/plugin/tsconfig/action.json
generated:
  by: okfit/claude-code
  at: 2026-11-10T18:07:09Z
status: draft
integrity:
  generated:
    body: 5e857739875d5fdf
---

# A FULL TURBO green typecheck can mean no typecheck ran

## What a reader sees

`pnpm typecheck` (Turbo's `types:check` task) reports `FULL TURBO` and
exits green after a change that touched only a test file under
`__test__/`.

## Wrong conclusion

"The types were checked, and they're fine" — because Turbo reported a
cache hit rather than a cache miss, the reader assumes the cached result
still reflects the current tree.

## What is true

`tsc --noEmit`, the command `types:check` wraps, resolves its file set from
the root `tsconfig.json`[^tsconfig-root], which only extends
`@effected/plugin/tsconfig/action.json`. That preset's `include` array
covers root `${configDir}/*.ts`, `*.mts` and `*.cts`; `src/**`, `lib/**`
and `__test__/**` in each of `.ts`, `.mts` and `.cts`; and
`types/**/*.d.ts`.[^tsconfig-action] Turbo's own cache key for
`types:check` is independent of that `include` list — it is whatever
`turbo.json` declares under `tasks.types:check.inputs`. If that `inputs`
list omits a glob `tsc` still checks — `__test__/**/*.ts` was the one that
bit — a change confined to those files does not invalidate Turbo's cache:
Turbo replays the last cached result, reports `FULL TURBO`, and the type
error the change introduced is never caught, because `tsc` itself never
ran against the new tree.

`turbo.json`'s `types:check.inputs` mirrors that list glob for glob:
root, `src/**`, `lib/**` and `__test__/**` in each of `.ts`, `.mts` and
`.cts`, plus `types/**/*.d.ts`. Until the move to the effected preset it
did not — root `*.mts`/`*.cts`, `src/**/*.mts`/`*.cts`, `lib/**/*.cts` and
`types/**/*.d.ts` were absent, so an edit to `types/global.d.ts` could hit
the cache. `turbo.json` carries no inline comment recording this; this concept is the record of
the drift history and the rule.[^turbo-json] Keeping the two lists
synchronized is the load-bearing fact, not the specific paths listed
today: the preset's `include` is the authority, and Turbo's `inputs` must
mirror it, or a future drift silently repeats the same gap.

To get an unconditionally real result rather than trust a cache hit, run
`pnpm types:check` (`tsc --noEmit` directly, uncached) instead of `pnpm
typecheck`.

[^turbo-json]: `../../turbo.json`
[^tsconfig-root]: `../../tsconfig.json`
[^tsconfig-action]: `../../node_modules/@effected/plugin/tsconfig/action.json`
