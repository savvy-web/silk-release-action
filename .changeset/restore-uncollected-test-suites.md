---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

### 60 test cases that were never running now run

Five suites under `__test__/unit/utils/` were silently excluded from every test run (#237). The vitest-agent project discovery drops any directory named `utils`, and its pattern had widened to match that name at **any** depth rather than only at the top level — so `__test__/unit/utils/` began matching and its suites stopped being collected. Nothing failed and nothing warned; the run simply reported a smaller total.

The directory is renamed to `__test__/unit/utilities/`, restoring **60 cases** across `turbo-summary` (31), `count-changesets` (14), `group-id` (8), `npm-cache` (4) and `sort-releases-topologically` (3). The suite total goes 792 → 852 across 56 → 61 files.

No product code changed. These tests cover changeset counting, group-id derivation, npm cache behaviour, topological release ordering and turbo summary parsing, none of which was being verified.

## Maintenance

### Two guards so this cannot recur silently

* `__test__/test-placement.test.ts` now rejects a `*.test.ts` under an excluded directory **name at any depth**, rather than checking one hardcoded top-level prefix — the narrowness is precisely why the widened pattern slipped past it
* `scripts/check-test-collection.mjs` (`pnpm check:collection`, and now the first step of `pnpm ci:test`) compares test files on disk against what `vitest list` reports collecting and fails on any gap. It hardcodes no directory names, so it catches an exclusion rule that nobody has learned about yet

Both are mutation-verified: renaming the directory back turns each red.

`__test__/unit/utilities/custom-registries.test.ts` moves to its mirrored home from the flat path it was parked at to dodge this bug.

### Corrected the collection map in `__test__/CLAUDE.md`

The map asserted that `__test__/unit/utils/` collected. That was probe-verified on 2026-08-05 and false by 2026-08-14 — nine days in which a document intended to prevent this exact mistake was instead endorsing it. It now records the any-depth rule, carries its verification date, and notes that `pnpm test` runs with `--pass-with-no-tests`, so collecting zero suites also exits 0.
