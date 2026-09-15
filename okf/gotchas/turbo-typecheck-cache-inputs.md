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
  - id: tsconfig-action
    resource: ../../node_modules/@savvy-web/github-action-builder/tsconfig/action.json
generated:
  by: okfit/claude-code
  at: 2026-09-15T03:42:33Z
  body_sha256: cb34bbca7be7473a46e84a094221cf85170013785bdfd45f18c4057f3c28677d
status: draft
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
`@savvy-web/github-action-builder/tsconfig/action.json`'s `include`
array, which covers `${configDir}/__test__/**/*.ts` (and `.mts`/`.cts`)
alongside `src/**`, `lib/**`, and root `*.ts`
files.[^tsconfig-action] Turbo's own cache key for `types:check` is
independent of that `include` list — it is whatever `turbo.json` declares
under `tasks.types:check.inputs`. If that `inputs` list omits
`__test__/**/*.ts` while `tsc` still type-checks those files, a change
confined to `__test__/` does not invalidate Turbo's cache: Turbo replays
the last cached result, reports `FULL TURBO`, and the type error a
test-only change introduced is never caught, because `tsc` itself never
ran against the new tree.

`turbo.json`'s `types:check.inputs` currently lists
`__test__/**/*.ts`, `__test__/**/*.mts`, and `__test__/**/*.cts` alongside
`src/**/*.ts`, `lib/**/*.ts`, and `lib/**/*.mts` specifically so the two
lists stay in step. `turbo.json` carries no inline comment recording this
any more — this concept is the record of the drift history and the
rule.[^turbo-json] Keeping the two lists synchronized is
the load-bearing fact, not the specific paths listed today: the tsconfig's
`include` is the authority, and Turbo's `inputs` must mirror it, or a
future drift silently repeats the same gap.

To get an unconditionally real result rather than trust a cache hit, run
`pnpm types:check` (`tsc --noEmit` directly, uncached) instead of `pnpm
typecheck`.

[^turbo-json]: `../../turbo.json`
[^tsconfig-action]: `../../node_modules/@savvy-web/github-action-builder/tsconfig/action.json`
