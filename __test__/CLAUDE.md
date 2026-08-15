# __test__/CLAUDE.md

Unit testing patterns and infrastructure for silk-release-action.

__See also:__ [Root CLAUDE.md](../CLAUDE.md) | [src/CLAUDE.md](../src/CLAUDE.md)

__For comprehensive testing documentation:__ `@../.claude/design/release-action/testing.md` -- test-layer patterns, silk-effects test factories, all specialized patterns (fake timers, filesystem, workspaces sync APIs, GitHub context, summaries), the `__test__/unit/` mirrored layout, the integration fixture harness, the 18 `CHARACTERIZATION` tests (issue #216), and the coverage map.

## Running Tests

```bash
pnpm test                                        # All tests with coverage
pnpm test --watch                                # Watch mode
pnpm ci:test                                     # CI mode
```

A CLI file argument does __not__ filter to a single file in this repo (vitest projects come from the vitest-agent plugin). To run specific files, use the vitest-agent MCP `run_tests` tool with a `files` array (e.g. `["__test__/native-version.test.ts"]`).

__Every test lives at or below `__test__/`.__ There are no co-located `src/**/*.test.ts`: unit
tests mirror the source layout under `__test__/unit/` (`unit/release/`, `unit/utilities/`,
`unit/program.test.ts`), the older flat suites stay directly in `__test__/`, and integration
tests live in `__test__/integration/` with fixture workspaces under `integration/fixtures/`.

## ⚠️ A directory named `utils` is NEVER collected — at ANY depth

__A `*.test.ts` file under a directory named `utils` does not run, and nothing reports that it
did not.__ The exclusion matches the directory __name anywhere in the path__, not one top-level
location. `utils/` is for helpers only — today, `github-mocks.ts` and `manifest.ts`.

Verified collection map (__2026-08-14__, by `vitest list` file-count parity):

| directory | collects? |
| --------- | --------- |
| `__test__/` (flat) | ✅ |
| `__test__/unit/`, `unit/release/` | ✅ |
| `__test__/unit/utilities/` | ✅ — this is where `src/utils` unit tests go |
| `__test__/unit/utils/` | ❌ __never__ |
| `__test__/utils/` | ❌ __never__ |

__This map was wrong once, and the wrongness was invisible for nine days.__ It previously stated
the exclusion was specific to the top-level `__test__/utils/` and that `__test__/unit/utils/`
collected. That was probe-verified on 2026-08-05 and false by 2026-08-14: the plugin's pattern
had widened to match `utils` at any depth, taking `__test__/unit/utils/` with it — __5 suites, 60
cases, silently not running__ ([#237](https://github.com/savvy-web/silk-release-action/issues/237)).
Treat any dated map here as evidence with a shelf life, and re-probe rather than trust it.

__Why this matters more than it looks.__ The obvious tidy-up — "mirror the source layout" — puts
`src/utils/*.test.ts` into a `utils/` directory and __silently deletes those suites' coverage__
while everything stays green. The only signal is the collected count going *down*, which is why
the gate for this repo is __the test count, never the exit code__. Note `pnpm test` passes
`--pass-with-no-tests`, so collecting __zero__ suites also exits 0. Use `utilities/`, never
`utils/`, for any directory holding tests.

__Placement is asserted two ways, and both must stay.__

- `__test__/test-placement.test.ts` fails if any `*.test.ts` sits under `src/**`, outside
  `__test__/`, or under a directory whose name is in its `UNCOLLECTED_DIR_NAMES` set
  (`utils`, `fixtures`, `snapshots`) __at any depth__. If it goes red, move the file to
  `__test__/unit/<mirrored-path>/`.
- `scripts/check-test-collection.mjs` (`pnpm check:collection`, and the first step of
  `pnpm ci:test`) compares test files __on disk__ against what `vitest list` reports
  __collecting__, and fails on any gap. This one needs no hardcoded name list, so it catches an
  exclusion rule nobody has learned about yet — which is exactly how #237 got through.

Both are mutation-checked: renaming `unit/utilities/` back to `unit/utils/` turns each red.

__Always state the count arithmetic__ when a move changes it — "N moved, N collected" — rather
than reporting "all green".

## Coverage Requirements

85% threshold for branches, functions, lines, and statements (`vitest.config.ts`).

## Test Utilities

`utils/github-mocks.ts` provides three environment helpers — there are no hand-rolled Octokit or
`@actions/*` mock factories: `setupTestEnvironment({ suppressOutput })` (call in `beforeEach`),
`cleanupTestEnvironment()` (`afterEach`), and `suppressConsoleOutput()`.

## Mocking Strategy

__Effect code__ (entry points, `src/steps/`, `src/release/`) -- use the in-memory `layerTest`
members the `@effected/*` kit ships on each service: `ActionEnvironment.layerTest`,
`ActionOutputs.layerTest`, `ActionState.layerTest` (`@effected/github-actions`);
`CheckRun.layerTest`, `PullRequest.layerTest`, `PullRequestComment.layerTest`,
`GitHubIssue.layerTest`, `GitHubCommit.layerTest`, `GitHubRelease.layerTest`
(`@effected/github`); `Git.layerTest` (`@effected/git`); `ToolDiscovery.layerTest`
(`@effected/commands`); `SigstoreSigner.layerTest` (`@effected/sbom`). Provide the layer to the
effect under test and inspect the recorded state. There is no
`@savvy-web/github-action-effects/testing` — that package is gone. For Phase-1 native
versioning use `Changesets.makeReleasePlannerTest` / `makeConfigInspectorTest` from
`@savvy-web/silk-effects` instead of exec mocks. Note the command-runner nuance: unregistered
commands default to success (exit 0); register the exact command string with a non-zero
`exitCode` to simulate failure.

__Imperative utility code__ (`src/utils/`) -- mock Node builtins (`vi.mock("node:fs")`, ...) with
`setupTestEnvironment` / `cleanupTestEnvironment`:

```typescript
import { afterEach, beforeEach, describe, it } from "vitest";
import { cleanupTestEnvironment, setupTestEnvironment } from "./utils/github-mocks.js";

describe("module-name", () => {
  beforeEach(() => setupTestEnvironment({ suppressOutput: true }));
  afterEach(() => cleanupTestEnvironment());
});
```

## `@effect/vitest` — `it.effect` vs plain `it()`

Ten files run Effects through `it.effect` from `@effect/vitest`; the rest is deliberately still on
plain `vitest`. __The split is a rule, not an accident of how far a migration got.__ Use
`it.effect` + `Effect.gen` when the test runs an Effect and the translation is one-for-one; keep
plain `it()` when the test has no Effect, observes the real console, restores a process global in
a `finally`, or asserts `rejects.toThrow()`. `it.effect` also always installs a virtual
`TestClock`, so suites driving real `Effect.sleep` backoffs stay on fake timers.

__For the four exceptions in full, the `TestConsole` trap, the silent-green shape, and the two
suites deliberately not migrated:__
→ `@./CLAUDE.effect-vitest.md`

Load before migrating any suite to `it.effect`.

## Key Testing Rules

- Never use `any` types; Arrange-Act-Assert
- __A test title states the observable behaviour — what happens, under what condition — in plain
  language.__ `"should X when Y"` is one acceptable shape, not a required template, and
  `"drops a write whose stamp is OLDER than what is already there"` is equally good: it carries
  the condition without the prefix. Rename a title only when it fails to communicate the
  behaviour. __Do not sweep a suite to fit the template__ — a mechanical rewrite adds length, not
  clarity, and churns diffs for no reader's benefit
- Cover all code paths (branches, switch cases, error handling)
- A test pinning known-wrong behaviour says `CHARACTERIZATION`, names the issue, and is written to
  fail when the fix lands — 18 exist for issue #216. Do not "fix" one to make it pass
- For retry logic in a __plain `it()`__ test, use `vi.useFakeTimers()` per-test (not globally) with
  `vi.advanceTimersByTimeAsync(60000)`, and always `vi.useRealTimers()` in `afterEach`. Do __not__
  combine fake timers with `it.effect`
- `vi.mock` must be imported from `"vitest"`, never through `@effect/vitest` — Vitest hoists it
  above all imports, so a re-exported binding is not yet initialized and the file dies at load with
  `Cannot access '__vi_import_1__' before initialization`, naming neither `vi` nor the package

## Common Issues

__Mock not called:__ ensure `vi.mock(...)` is hoisted above imports and the subject imports the
exact mocked path.

__Coverage below threshold:__ run `pnpm test`, check uncovered line numbers, add tests for those paths.
