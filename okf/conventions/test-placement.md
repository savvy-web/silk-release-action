---
type: Convention
title: Keep every test at or below __test__/, mirrored, never under a utils/ directory
description: Every *.test.ts lives at or below __test__/, unit suites mirror their source path under __test__/unit/, helpers live only under __test__/utils/, and no test file sits under any directory named utils, fixtures, or snapshots.
tags:
  - testing
  - dx
stale_after: "2026-12-13T00:00:00Z"
sources:
  - id: test-placement-test
    resource: ../../__test__/test-placement.test.ts
  - id: check-test-collection
    resource: ../../scripts/check-test-collection.mjs
  - id: test-claude-md
    resource: ../../__test__/CLAUDE.md
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: daea808036f18776085db9ecc854bede39d6a508842b6e6a91b2729aa29ceb41
status: draft
---

# Keep every test at or below __test__/, mirrored, never under a utils/ directory

Place no `*.test.ts` under `src/`; tests are not co-located with source in
this repository. Place every `*.test.ts` file at or below `__test__/`.
Mirror a unit suite's source path under `__test__/unit/` — verified
against the tree, current subdirectories are `unit/changelog/`,
`unit/release/`, and `unit/utilities/`, alongside `unit/program.test.ts`
and the older flat suites that stay directly under `__test__/`; integration
suites live under `__test__/integration/` with fixtures under
`integration/fixtures/`.[^test-placement-test] Put test helpers only under
`__test__/utils/` (today: `github-mocks.ts`, `manifest.ts`) — never a test
file itself.

Never name a test-holding directory `utils`, `fixtures`, or `snapshots`,
at any depth, including under `unit/`. A directory with one of those names
is excluded from vitest-agent's project discovery entirely: a `*.test.ts`
dropped there does not run, and nothing reports that it did not — the only
visible signal is the collected test count going down, which no green run
surfaces on its own. This is why `src/utils/*.test.ts` suites moved to
`__test__/unit/utilities/`, not `__test__/unit/utils/`.

Two independent guards enforce this, and both must keep passing:

- `__test__/test-placement.test.ts` walks the repository tree and fails
  if any `*.test.ts` sits under `src/**`, outside `__test__/`, or under a
  directory named `utils`, `fixtures`, or `snapshots` at any depth — the
  name check applies at every depth, not just a top-level prefix, because
  checking only the literal `__test__/utils/` prefix once let a widened
  exclusion pattern silently take `__test__/unit/utils/` with it.[^test-placement-test]
- `scripts/check-test-collection.mjs` — run as the first step of
  `pnpm ci:test`, and standalone via `pnpm check:collection` — asks
  Vitest what it actually collected (`vitest list --json`) and diffs that
  against every `*.test.ts` on disk under `__test__/`, needing no
  hardcoded exclusion list, so it also catches a discovery rule nobody
  has learned about yet.[^check-test-collection]

`pnpm ci:test` runs the collection gate before the suite; `pnpm test`
alone does not, and passes `--pass-with-no-tests`, so collecting zero
suites from a misplaced file still exits `0`. State the count arithmetic
("N moved, N collected") whenever a move changes the collected total,
rather than reporting "all green".

## Test best-practice rules

- Never use `any` types.
- Structure a test as Arrange-Act-Assert, or the equivalent Given/When/Then.
- Write a test title that states the observable behaviour and the
  condition it happens under, in plain language; `"should X when Y"` is
  one acceptable shape, not a mandatory template.
- Cover every code path: branches, switch cases, and error handling.
- Label a test pinning known-wrong behaviour `CHARACTERIZATION`, name the
  issue it pins, and write it to fail the moment the fix lands. Count
  `it("CHARACTERIZATION` titles, not grep lines, when stating how many
  exist — a raw grep also matches block comments and unrelated prose that
  discuss the marker. Ten such cases exist across four files today:
  `link-issues-and-build-steps.test.ts` (2), `per-step-checks.test.ts`
  (2), `publish-validation-report.test.ts` (3), and
  `validation-checks.test.ts` (3, pinning adjacent reporting oddities
  rather than the issue #216 degradation paths themselves). Never "fix" a
  characterization test to make it pass; fix the behaviour it pins and let
  the test fail, then rewrite it.
- Import `vi.mock(...)` above the imports it mocks, and import `vi` itself
  from `"vitest"` directly — never through `@effect/vitest`, whose
  re-exported binding is not yet initialized when Vitest hoists the mock
  call.
- Call `vi.useRealTimers()` in `afterEach` whenever a test used
  `vi.useFakeTimers()`, so a leaked fake clock cannot poison the next
  test.
- Provide a test double as an Effect `Layer` — `Layer.succeed` for a
  fixed value, an `Effect.die` stub for a dependency a flow must not
  reach — rather than a hand-rolled mock object, for layer isolation. See
  [Effect service doubles](../conventions/effect-service-doubles.md).

See [Move the co-located tests](../decisions/move-colocated-tests.md) for
why tests no longer live beside their source, and
[A vitest CLI file argument does not filter the run](../gotchas/vitest-file-argument.md)
for the companion trap in how a single file is selected for a run.

[^test-placement-test]: `../../__test__/test-placement.test.ts`
[^check-test-collection]: `../../scripts/check-test-collection.mjs`
