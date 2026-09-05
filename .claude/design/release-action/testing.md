---
title: Testing Strategy and Infrastructure
category: testing
status: current
completeness: 90
created: 2026-02-07
updated: 2026-09-04
last-synced: 2026-09-04
module: release-action
related:
  - architecture.md
  - integration.md
dependencies:
  - architecture.md
---

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
  - [Test Framework Configuration](#test-framework-configuration)
  - [Test Layout and the Placement Guard](#test-layout-and-the-placement-guard)
  - [Test Infrastructure](#test-infrastructure)
  - [Effect Service Doubles](#effect-service-doubles)
  - [`@effect/vitest` — `it.effect` vs plain `it()`](#effectvitest--iteffect-vs-plain-it)
  - [Manifest Sync Guards](#manifest-sync-guards)
  - [Characterization Tests](#characterization-tests)
  - [Specialized Testing Patterns](#specialized-testing-patterns)
  - [Test Coverage Map](#test-coverage-map)
  - [Coverage Gaps](#coverage-gaps)
  - [Test Best Practices](#test-best-practices)
  - [Test Commands](#test-commands)
- [Rationale](#rationale)
  - [Why Effect Layers Instead of Mocks?](#why-effect-layers-instead-of-mocks)
  - [Why Move the Co-located Tests?](#why-move-the-co-located-tests)
  - [Why Characterization Tests for a Known Bug?](#why-characterization-tests-for-a-known-bug)
  - [Why Three-Legged Manifest Guards?](#why-three-legged-manifest-guards)
- [File Reference](#file-reference)

## Overview

The project uses Vitest with a suite of **830 tests across 61 files** covering the phase steps, the Phase-3 Effect orchestration, the check derivation, the silk publishability rules, and the utility modules. Tests enforce type-safe mocking with zero `any` types. All external dependencies (GitHub API, subprocess execution, file system, `@effected/workspaces`) are replaced with in-memory Effect layers or `vi.mock()` so tests are fast, reliable, and isolated.

`@savvy-web/github-action-effects/testing` is gone with the library it belonged to. The `@effected/*` kit exposes no `/testing` entry point; service doubles are built with `Layer.succeed(Service, { … })` or the kit's own `*.makeTest` statics (`ActionEnvironment.makeTest`, `ActionOutputs.makeTest`, `SigstoreSigner.makeTest`). `@savvy-web/silk-effects` ships `Changesets.makeReleasePlannerTest` and `Changesets.makeConfigInspectorTest` for the native-versioning services.

The publishability rules have dedicated integration tests in `__test__/integration/publishability.int.test.ts` backed by the fixture workspaces in `__test__/integration/fixtures/`.

> `__test__/CLAUDE.md` is the operational companion to this document — it carries the runnable commands, the `it.effect` decision rules, and the gotchas. This doc covers strategy and structure.

## Current State

### Test Framework Configuration

Vitest is configured in `vitest.config.ts` through the **`@vitest-agent/plugin`** (`AgentPlugin`), which discovers projects and tags:

```typescript
const { projects, tags } = await AgentPlugin.discover();
```

Key effective values:

- **Projects:** discovered by the agent plugin, **not** enumerated in the config. A CLI file argument therefore does *not* filter to a single file — use the vitest-agent MCP `run_tests` tool with a `files` array.
- **Pool:** `forks`
- **Global setup:** `vitest.setup.ts`
- **Coverage provider:** V8, always enabled
- **Coverage thresholds:** `AgentPlugin.COVERAGE_LEVELS.standard.thresholds`; the plugin's `coverageTargets` use the `strict` level
- **Coverage include:** `src/**/*.ts` with an **empty** exclude list, deliberately — a never-imported source file scores 0% instead of being silently omitted

There are no per-module coverage exclusions. The old `src/utils/create-api-commit.ts` exclusion went away with the module itself (commits now go through `GitCommit` from `@effected/github`).

Test scripts in `package.json`:

```bash
pnpm test            # vitest run --pass-with-no-tests
pnpm test:coverage   # vitest run --coverage --pass-with-no-tests
pnpm test:watch      # watch mode
pnpm ci:test         # CI="true" vitest run --coverage
```

### Test Layout and the Placement Guard

```text
__test__/
  *.test.ts               flat unit suites (the majority)
  unit/                   the suites that used to be co-located under src/
    program.test.ts
    release/*.test.ts
    utils/*.test.ts
  integration/
    publishability.int.test.ts
    fixtures/             real minimal workspaces
  utils/                  HELPERS ONLY — never collected
    github-mocks.ts
    manifest.ts
  CLAUDE.md
```

**No test is co-located under `src/` any more.** Every `src/**/*.test.ts` moved to `__test__/unit/**`, mirroring its source path.

`__test__/test-placement.test.ts` makes the placement rules executable, because the failure mode is invisible: **`__test__/utils/` is never collected by the vitest-agent project discovery** — a `*.test.ts` dropped there does not run, and nothing reports that it did not. The only signal is the collected count going *down*, which no green run surfaces. The guard walks the repo and asserts:

1. no `*.test.ts` under `src/**`,
2. no `*.test.ts` under `__test__/utils/**`,
3. every `*.test.ts` in the repo lives at or below `__test__/`,
4. the walker itself sees more than 20 files (so a broken walker cannot pass vacuously).

### Test Infrastructure

`__test__/utils/github-mocks.ts`:

| Export | Purpose |
| ------ | ------- |
| `setupTestEnvironment({ suppressOutput })` | Clear all mocks; optionally silence stdout/stderr. Call in `beforeEach()` |
| `cleanupTestEnvironment()` | Restore all mocks via `vi.restoreAllMocks()`. Call in `afterEach()` |
| `suppressConsoleOutput()` | Silence `process.stdout.write` / `process.stderr.write` directly |
| `actionStateWithAppToken(token?)` | An `ActionState` layer pre-loaded with an installation token |

`__test__/utils/manifest.ts` provides the manifest parsing and source scanning behind the `action.yml` sync guards — see [Manifest Sync Guards](#manifest-sync-guards).

There is no `MockOctokit` type and no hand-rolled Octokit factory; `__test__/utils/test-types.ts` was removed.

> ⚠️ **Console leaks in Effect suites come from the default logger via `console.log`.** `suppressOutput` cannot catch those; `Effect.provide(Logger.layer([]))` can.

### Effect Service Doubles

Every service the action depends on is an Effect service, so tests substitute in-memory implementations rather than mocking transports. Two mechanisms:

**1. `Layer.succeed(Service, { … })`** — the common case. The services most often doubled are `Repo`, `WorkspaceDiscovery`, `ChangesetConfig`, `PublishabilityDetector`, `Changesets.ReleasePlanner` and `Changesets.ConfigInspector`.

```typescript
import { Effect, Layer } from "effect";
import { WorkspaceDiscovery } from "@effected/workspaces";

const testLayer = Layer.mergeAll(
  Layer.succeed(WorkspaceDiscovery, { listPackages: () => Effect.succeed(packages), /* … */ }),
  Layer.succeed(ChangesetConfig, changesetConfigDouble),
);

const result = await Effect.runPromise(subject(args).pipe(Effect.provide(testLayer)));
```

Unexercised members are stubbed with `Effect.die(...)` so an accidental call fails loudly rather than returning a plausible default.

**2. Kit `*.makeTest` statics** — `ActionEnvironment.makeTest`, `ActionOutputs.makeTest`, `SigstoreSigner.makeTest`, plus silk-effects' `Changesets.makeReleasePlannerTest` / `makeConfigInspectorTest`. `runNativeVersion` invokes `planner.apply` through a thunk so a stateful test double actually runs again on the retry.

**The subprocess seam is a `ChildProcessSpawner`, not a command map.** The predecessor's `CommandRunnerTest` returned a default success (exit 0) for any unregistered command, which meant a code path that shelled out to something the test never anticipated silently passed. Suites that care now provide a spawner that **fails any spawn** (`native-version.test.ts`) or one that asserts on the exact argv (`validate-builds.test.ts`), so "this path must not run a command" and "this path runs *this* command" are both assertable.

**The filesystem seam is `@effected/memfs`, not a stubbed `FileSystem.layerNoop`.** Every volume-modelling double provides `MemoryFileSystem.layer` (an empty volume) or `MemoryFileSystem.layerWith({ … })` seeded with the files the flow genuinely reads; `MemoryFileSystem.file(content, { mode })` carries an exec bit and `MemoryFileSystem.directory()` seeds a directory. Relative reads (`"package.json"`, `"biome.jsonc"`) resolve from the volume root, so a seed is that same name rooted at `/`.

This replaced seven `FileSystem.layerNoop({ … })` stubs, and the swap is load-bearing rather than cosmetic — each old stub answered *plausibly* for paths the code should never have asked for, so a whole class of mutant survived:

- `format-workspace`'s `exists: (path) => files.some((f) => path.endsWith(f))` could not tell a root config from a nested one. Reseeding the volume at `/nested/<file>` now kills 4 tests; under the suffix match that mutant survived.
- `create-release-branch` / `update-release-branch`'s blanket `readFileString: () => "file contents"` answered *any* path. Reseeding `/package.json` as `/nope.json` now kills 12 tests with the real `NotFound` production sees; before, a stage reading the wrong path was invisible.
- `detect-workflow-phase`'s `readFileString: () => "{}"` could not distinguish "never called" from "called and answered". An empty volume passing is now positive evidence that nothing in that flow reads a file.

Two `as never` casts in `porcelain-changes.test.ts` went with them: an absent file now fails with the typed `NotFound` rather than a hand-forged error shape.

**No host-filesystem double remains.** `detect-workflow-phase.test.ts`'s event-payload cases used to build a real temp directory, because `ActionEnvironment.makeTest` reads `GITHUB_EVENT_PATH` through a genuine `FileSystem` — `layerTest` stubs it out, so the payload would never be read and seeding the path would return empty. The constraint is that the implementation must be *real*, not that it must be the *host's*: `MemoryFileSystem` satisfies it. The volume is provided as one layer value in both places it is needed — under `ActionEnvironment` via `Layer.provide`, and merged for the program — so the two provisions memoize onto the same volume instead of building two that could drift.

Each case seeds exactly one of three shapes, which the old harness conflated behind a single `eventPathOverride`: a JSON payload, raw bytes that are deliberately not JSON, or a path deliberately left unseeded. Seeding the payload at a path `GITHUB_EVENT_PATH` does not name kills 3 tests — the check that the payload is genuinely read rather than the harness quietly returning empty.

### `@effect/vitest` — `it.effect` vs plain `it()`

Part of the suite runs Effects through `it.effect` from `@effect/vitest` (which re-exports all of Vitest, so `describe` / `expect` / `vi` come from the same import). The rest is deliberately still on plain `vitest`. **The split is a rule, not an accident of how far a migration got**; the full rules live in `__test__/CLAUDE.md`. In summary:

**Use `it.effect` + `Effect.gen`** when the test runs an Effect and the translation is one-for-one. `Effect.runPromiseExit(x)` becomes `yield* Effect.exit(x)` — same `Exit`, so `expect(exit._tag).toBe("Failure")` carries over unchanged.

**Keep plain `it()` in four cases**, each of which has bitten this repo:

1. **The test has no Effect in it.** Most of `report.test.ts`, `pr-body.test.ts`, `validation-checks.test.ts` and the other pure-assertion suites. Rewriting them is churn, and churn in a large diff is where a regression hides.
2. **The test observes the real console.** ⚠️ `it.effect` installs `TestConsole`, which intercepts the same `ConsoleRef` that `ActionLogger` and Effect's default logger write through. A `vi.spyOn(console, "log")` **captures nothing** under `it.effect`. Two tests hit this — `releases.test.ts` ("BOTH SHAs") and `publish.test.ts` ("rich publish tree") — and both are annotated in place.
3. **The test drives fake timers.** `it.effect`'s virtual `TestClock` already owns time and the two do not compose.
4. **`vi.mock` is involved at module scope.** `vi.mock` must be imported from `"vitest"`, never through `@effect/vitest` — Vitest hoists it above all imports, so a re-exported binding is not yet initialized and the file dies at load with `Cannot access '__vi_import_1__' before initialization`, naming neither `vi` nor the package.

Ten files are on `@effect/vitest` today: `auto-merge`, `managed-sections`, `post`, `schema-inputs`, `schema-outputs`, `update-sticky-comment`, `unit/release/publish`, `unit/release/releases`, `unit/release/validation`, `unit/utils/sort-releases-topologically`, plus the publishability integration suite.

### Manifest Sync Guards

`__test__/schema-inputs.test.ts` and `__test__/schema-outputs.test.ts` hold `action.yml` and the code to each other. Each guard has **three independent legs**:

1. the manifest — `declaredInputNames` / `declaredOutputNames`,
2. the `NAMES` tuples in `src/schema/inputs.ts` and `src/schema/outputs.ts`,
3. what `src/` actually reads and writes — `scanInputReads` / `scanOutputWrites`.

Two legs are not enough: any two agreeing while the third drifts is precisely how this repo shipped a `build-command` read no workflow could set, and a `custom-registries` input nothing implemented.

The input guard additionally enforces that each input is read in exactly one place (bar a short allowlist with stated reasons: `pre.ts` is a separate process, `auto-merge.ts` is a definition site) and that `dry-run` is decoded only to build the `DryRun` service. The output guard asserts that the pre-phase, main-scalar and `result` name sets **partition** `OUTPUT_NAMES` exactly, so `result` cannot go missing by falling between the sets.

### Characterization Tests

10 test **cases** across four files are marked `CHARACTERIZATION` (a raw grep for the word returns 18 lines — block comments and the two converted-pin notes in `publish-validation.test.ts` match as well; count `it("CHARACTERIZATION` titles, not lines). They pin **what the code does today, not what it should do**; where the two differ the test still pins today's behaviour, says so in a comment, and is written to fail when the fix lands.

They exist because these paths received their **first-ever coverage** in the `main.ts` split. The logic lived inline in a 624-line orchestrator that no test executed — replacing that whole body with `Effect.die` left the suite green. Writing characterization tests first, before changing behaviour, is what makes the eventual fix a reviewable diff rather than an unverifiable rewrite.

The main subject is [issue #216](https://github.com/savvy-web/silk-release-action/issues/216): a Phase-2 step that degrades without contributing a **finding** reports a green release verdict for work that never ran. See [Degradation semantics](architecture.md#degradation-semantics-issue-216) in the architecture doc for the mechanism, which path is fixed and which remain. The tests that remain pinned:

| File | What it pins |
| ---- | ------------ |
| `link-issues-and-build-steps.test.ts` | 2 — a degrade-to-warning that is invisible downstream (`LINK_ISSUES_FAILED`), beside build validation's honest degradation |
| `per-step-checks.test.ts` | 2 — a check run that could not be created yielding `""` → a `null` row URL, indistinguishable from "no page yet"; and a row linking to a check stuck `in_progress` |
| `publish-validation-report.test.ts` | 3 — a failed comment write contributing no finding; a failed PR *lookup* reported identically to "there is no release PR"; plus one unrelated pin, that a rehearsal still writes to the real pull request |
| `validation-checks.test.ts` | 3 — none of them degradation: the Build row bypassing the strict-warnings rule, `checkId` being write-only, and the icon ignoring strict-warnings while the conclusion honours it |

**Converted, not deleted, when the publish-validation crash path was fixed.** `publish-validation.test.ts` no longer has a `CHARACTERIZATION` test, and `validation-checks.test.ts`'s `#216` block is now a true-behaviour block. The pins were written to fail when the fix landed, and they did: each became the assertion it asked to become — a crashed validation failing every check it was responsible for, the crash log saying "did not run" instead of ✅, and the untouched rows (`Build Validation`, `Link Issues from Commits`) staying green. `SKIPPED_PUBLISH_VALIDATION`'s `publishOk: true` baseline is still asserted, re-aimed at the build-failed path it is now only ever reached from, because keeping it quiet is load-bearing: flipping it would double-count the build failure. That the fed combination (`SKIPPED_PUBLISH_VALIDATION` with `buildPassed: true`) is now **unreachable in production** is why those tests were re-pointed at `crashedPublishValidation(...)` rather than kept as-is.

Both directions of the conversion are mutation-verified: stripping the crash findings turns 4 tests red, and removing the crash log branch turns 1 red.

### Specialized Testing Patterns

#### Effect v4 log silencing and log-level wiring

The Effect v3 idioms were removed in v4:

- **Silence logs** — `Logger.replace(Logger.defaultLogger, Logger.none)` → `Effect.provide(Logger.layer([]))`. An empty logger array installs no loggers. This is the standard tail on most effects under test.
- **Raise the minimum log level** — `Logger.withMinimumLogLevel(LogLevel.All)` → `Effect.provideService(References.MinimumLogLevel, "All")`. Log levels are plain string literals in v4 (`"All"`, `"Debug"`, …); `unit/release/releases.test.ts` uses this to assert debug output.
- **`SchemaError` bracket notation** — a v4 `SchemaError` renders the failing path in bracket notation, so path assertions match `["field"]` rather than the v3 dotted form. `load-release-config.test.ts` asserts against the bracketed message.

#### Fake timers for retry logic

Enabled per-test (not globally in `beforeEach`), because global fake timers affect all async operations — and never combined with `it.effect`, whose `TestClock` already owns time:

```typescript
it("should retry on ECONNRESET errors", async () => {
  vi.useFakeTimers();
  mockFn.mockRejectedValueOnce(new Error("ECONNRESET"));
  mockFn.mockResolvedValueOnce({ data: "success" });

  const actionPromise = retryableAction();
  await vi.advanceTimersByTimeAsync(60000);
  await actionPromise;

  expect(mockFn).toHaveBeenCalledTimes(2);
});

afterEach(() => {
  vi.useRealTimers(); // Critical: always reset
});
```

#### Topological ordering without a sorter stub

There is no `TopologicalSorter` service to stub. `runValidation` and the Phase-3 orchestration order released packages via `sortReleasesTopologically`, which builds a real `DependencyGraph.make({ packages })` from `WorkspaceDiscovery.listPackages()` and calls `sortSubset`. The "dependency order, not workspace glob order" test therefore declares a real `workspace:*` dependency edge on a `WorkspacePackage` fixture (alpha depends on beta) and asserts both the report order and the `dryRunCalls` order follow the graph.

#### Publishability integration tests

`__test__/integration/publishability.int.test.ts` uses real fixture workspaces to verify the full silk publishability matrix against `SilkPublishability.layer` without any mocking. Each fixture is a minimal workspace with a real `package.json` in `__test__/integration/fixtures/`:

| Fixture | What it covers |
| ------- | -------------- |
| `public-package` | `private: false` — default npm target |
| `public-multi-target` | `private: false`, `publishConfig.targets` Record map (multiple) |
| `private-fully-private` | `private: true`, no publishConfig — not publishable |
| `private-versiononly` | `private: true`, no targets — version-only |
| `private-access-public` | `private: true`, `publishConfig.access: "public"` |
| `private-access-restricted` | `private: true`, `publishConfig.access: "restricted"` |
| `private-access-no-build` | `private: true`, `publishConfig.access` but no dist |
| `private-multi-target` | `private: true`, `publishConfig.targets` (multiple) |
| `private-shorthand-targets` | `private: true`, string shorthand targets (`"npm"`, `"github"`) |
| `private-target-built-private` | `private: true`, target with non-public access |
| `private-target-with-directory` | `private: true`, target with explicit `directory` |
| `private-mixed-access` | `private: true`, mix of targets with different access levels |
| `ignore-monorepo` | changeset-ignored package — excluded from detection entirely |

#### Contract smoke tests for upstreamed implementations

When an implementation moves out of this repo into a shared library, its exhaustive suite moves with it and what stays behind is a **contract smoke test**: only the properties this repo's call sites actually depend on, so an upstream change that breaks *us* is caught here rather than in a release. Duplicating the upstream suite would instead pin behaviour we do not own and fail on changes that never mattered to us.

`__test__/pr-body.test.ts` is the worked example. It shrank from 412 lines (43 cases over the local `utils/pr-body.ts`) to ~128 lines (8 cases) when `PrBody` moved into `@savvy-web/silk-effects` at [#209](https://github.com/savvy-web/silk-release-action/issues/209). What it keeps is the narrow, easy-to-lose behaviour: a bare `Closes #N` line outside every fenced block (the only spelling GitHub's linker counts, verified empirically against `savvy-web/silk-integration` #242/#232 — empty bodies, no links — and #243 — a bare line, linked), the two non-interchangeable reference spellings, closed issues being dropped, the `silk-release:*` markers the other modules match on, and the summary region surviving a regeneration. It asserts through the public `PrBody.ManagedPrBody` / `PrBody.Markers` surface only.

Before deleting the local module, both implementations were run side by side on the same inputs. That harness is what found the `state !== "closed"` defect — closed issues arriving from GraphQL as `"CLOSED"` were classified as open and re-linked — so the upstreaming was **not** byte-parity, and a "pure refactor" framing would have hidden a fix. See [Release PR body (managed region)](architecture.md#release-pr-body-managed-region).

#### `ActionInput` env snapshot

Inject inputs via the `ActionInput` layer, not by mutating `process.env` between reads. The environment is snapshotted at first read, so a mid-test mutation reuses the first value — which turns expected-to-fail tests green.

### Test Coverage Map

| Test file | Source module | Category |
| --------- | ------------- | -------- |
| `__test__/unit/program.test.ts` | `src/program.ts` | Composition |
| `__test__/pre.test.ts` | `src/pre.ts` | Entry points |
| `__test__/post.test.ts` | `src/post.ts` | Entry points |
| `__test__/schema-inputs.test.ts` | `src/schema/inputs.ts` + `action.yml` | Manifest guard |
| `__test__/schema-outputs.test.ts` | `src/schema/outputs.ts` + `action.yml` | Manifest guard |
| `__test__/test-placement.test.ts` | the repo tree | Placement guard |
| `__test__/generate-schema.test.ts` | `lib/scripts/generate-schema.ts` (drift guard over both committed JSON Schemas — the input document at the repo root, the versioned output document under `schemas/<version>/`) | Schema |
| `__test__/projections.test.ts` | `src/schema/projections.ts` (schema v2 — workspace-keyed `success`/`outcome`/`summary`) | Schema |
| `__test__/release-output.test.ts` | `src/schema/release-output.ts` | Schema |
| `__test__/unit/utilities/release-kind.test.ts` | `src/utils/release-kind.ts` | Schema |
| `__test__/detect-workflow-phase.test.ts` | `detect-workflow-phase.ts` | Routing |
| `__test__/event-payload.test.ts` | `utils/event-payload.ts` | Routing |
| `__test__/check-release-branch.test.ts` | `check-release-branch.ts` | Phase 1 |
| `__test__/create-release-branch.test.ts` | `create-release-branch.ts` | Phase 1 |
| `__test__/update-release-branch.test.ts` | `update-release-branch.ts` | Phase 1 |
| `__test__/native-version.test.ts` | `utils/native-version.ts` | Phase 1 |
| `__test__/format-workspace.test.ts` | `utils/format-workspace.ts` | Phase 1 |
| `__test__/porcelain-changes.test.ts` | `utils/porcelain-changes.ts` | Phase 1 |
| `__test__/pr-body.test.ts` | `PrBody.ManagedPrBody` (silk-effects) — **contract smoke test**, not a reimplementation of the upstream suite | Phase 1 |
| `__test__/release-pr-title.test.ts` | `utils/release-summary-helpers.ts` | Phase 1 |
| `__test__/release-plan.test.ts` | `utils/release-plan.ts` | Phase 1 |
| `__test__/publish-release-plan.test.ts` | `steps/publish-release-plan.ts` | Phase 1 |
| `__test__/managed-sections.test.ts` | `utils/managed-sections.ts` (incl. defect + interrupt paths) | Phase 1/2 |
| `__test__/write-sections.test.ts` | `utils/write-sections.ts` | Phase 1/2 |
| `__test__/release-table.test.ts` | `utils/release-table.ts` | Phase 1/2 |
| `__test__/auto-merge.test.ts` | `utils/auto-merge.ts` | Phase 1 |
| `__test__/link-issues-and-build-steps.test.ts` | `steps/link-issues.ts`, `steps/build-validation.ts` | Phase 2 |
| `__test__/link-issues-from-commits.test.ts` | `utils/link-issues-from-commits.ts` | Phase 2 |
| `__test__/validate-builds.test.ts` | `utils/validate-builds.ts` | Phase 2 |
| `__test__/publish-validation.test.ts` | `steps/publish-validation.ts` | Phase 2 |
| `__test__/validation-checks.test.ts` | `release/validation-checks.ts` | Phase 2 |
| `__test__/per-step-checks.test.ts` | `steps/per-step-checks.ts` | Phase 2 |
| `__test__/publish-validation-report.test.ts` | `steps/publish-validation-report.ts` | Phase 2 |
| `__test__/create-validation-check.test.ts` | `utils/create-validation-check.ts` | Phase 2 |
| `__test__/cleanup-validation-checks.test.ts` | `utils/cleanup-validation-checks.ts` | Phase 2 |
| `__test__/derive-check-conclusion.test.ts` | `utils/derive-check-conclusion.ts` | Phase 2 |
| `__test__/unit/release/validation.test.ts` | `release/validation.ts` | Phase 2 |
| `__test__/unit/utils/turbo-summary.test.ts` | `utils/turbo-summary.ts` | Phase 2 |
| `__test__/unit/release/publish.test.ts` | `release/publish.ts` | Phase 3 |
| `__test__/unit/release/releases.test.ts` | `release/releases.ts` | Phase 3 |
| `__test__/unit/release/meta-archive.test.ts` | `release/meta-archive.ts` | Phase 3 |
| `__test__/unit/release/resolve-targets.test.ts` | `release/resolve-targets.ts` | Phase 2/3 |
| `__test__/unit/release/report.test.ts` | `release/report.ts` | Phase 2/3 |
| `__test__/unit/release/errors.test.ts` | `release/errors.ts` | Phase 2/3 |
| `__test__/unit/utils/group-id.test.ts` | `utils/group-id.ts` | Phase 3 |
| `__test__/unit/utils/sort-releases-topologically.test.ts` | `utils/sort-releases-topologically.ts` | Phase 2/3 |
| `__test__/attest-helpers.test.ts` | `release/attest-helpers.ts` | Phase 3 |
| `__test__/determine-tag-strategy.test.ts` | `utils/determine-tag-strategy.ts` | Phase 3 |
| `__test__/close-linked-issues.test.ts` | `utils/close-linked-issues.ts` | Phase 3a |
| `__test__/detect-repo-type.test.ts` | `utils/detect-repo-type.ts` | Infra |
| `__test__/commit-signoff.test.ts` | `utils/commit-signoff.ts` | Infra |
| `__test__/extract-release-notes.test.ts` | `utils/extract-release-notes.ts` | Infra |
| `__test__/load-release-config.test.ts` | `utils/load-release-config.ts` | Infra |
| `__test__/summary-writer.test.ts` | `utils/summary-writer.ts` | Infra |
| `__test__/github-urls.test.ts` | `utils/github-urls.ts` | Infra |
| `__test__/registry-label.test.ts` | `@effected/npm` registry labels — **adoption guard**, not a unit test of local code; it pins the exact strings the kit must keep returning after effected#196 absorbed `src/utils/registry-label.ts` | Infra |
| `__test__/update-sticky-comment.test.ts` | `utils/update-sticky-comment.ts` | Infra |
| `__test__/unit/utils/count-changesets.test.ts` | `utils/count-changesets.ts` | Infra |
| `__test__/unit/utils/npm-cache.test.ts` | `utils/npm-cache.ts` | Infra |
| `__test__/integration/publishability.int.test.ts` | `SilkPublishability` (silk-effects) | Integration |

### Coverage Gaps

| Module | Reason for gap |
| ------ | -------------- |
| `src/main.ts` | 19 lines: a `GITHUB_ACTIONS` guard and `Action.run`, marked `/* v8 ignore */`. The program it runs is covered by `unit/program.test.ts` |
| `src/layers/app.ts` | Pure Layer wiring, marked `/* v8 ignore */`; exercised indirectly by the modules that consume it |
| **`src/steps/validation.ts`** | ⚠️ **Uncovered orchestration.** No test executes `runValidation`, so a green suite says nothing about the wiring in that body — only about the six modules it calls. Replacing the body with `Effect.die` would still leave the suite green. The module says so in its own docs |
| `src/types/*.ts` | Type definitions with no runtime behavior |
| `src/changelog/*.ts` | Re-export shims for the bundled changelog generators; no logic |
| `src/steps/branch-management.ts`, `src/steps/publishing.ts`, `src/steps/close-issues.ts` | Phase bodies covered indirectly through their callees; no direct orchestration test |

### Test Best Practices

1. **Type safety** — no `any` types in test code. Use Effect layers for Effect code; use explicit `as unknown as Type` casts for imperative mocks.
2. **Arrange-Act-Assert** — clear separation between setup, execution, and verification. Many suites annotate the phases as `// Given` / `// When` / `// Then`.
3. **Descriptive names** — state the observable behaviour, what happens under what condition, in plain language. `"should X when Y"` is one acceptable shape, not a required template; see `__test__/CLAUDE.md`.
4. **Nested `describe` blocks** — group related scenarios.
5. **Top-level mocking** — `vi.mock()` above imports, from `"vitest"`, never through `@effect/vitest`.
6. **Timer cleanup** — any test using `vi.useFakeTimers()` calls `vi.useRealTimers()` in its `afterEach`, and never combines fake timers with `it.effect`.
7. **Error path coverage** — cover both `Error` and non-`Error` throw scenarios, plus specific HTTP error codes.
8. **Layer isolation** — each test composes its own layers; stub unexercised service members with `Effect.die(...)`.
9. **Label the pins** — a test that pins known-wrong behaviour says `CHARACTERIZATION`, names the issue, and states what it will look like when fixed.

### Test Commands

```bash
pnpm test                        # Run all tests
pnpm ci:test                     # CI mode with coverage enforcement
pnpm test:watch                  # Watch mode
```

A CLI file argument does **not** filter to a single file — projects are discovered by the vitest-agent plugin. To run specific files, use the vitest-agent MCP `run_tests` tool with a `files` array.

## Rationale

### Why Effect Layers Instead of Mocks?

The orchestration depends on `PackagePublish` (npm publish), `NpmRegistry` (registry HTTP), `SigstoreSigner` / `Attestation` (Sigstore/Fulcio), `GitHubRelease`, `GitTag`, `Git` and similar services — none satisfiable in unit tests without live credentials or elaborate transport mocking. Effect's `Layer` system substitutes in-memory implementations that record calls and return canned responses, so the suite asserts that the right calls happened with the right arguments without any cryptographic or network work.

Stubbing unexercised members with `Effect.die(...)` is the part that makes this better than mocking: an accidental call fails loudly instead of returning a plausible default. That is exactly the failure the predecessor's `CommandRunnerTest` had — a default exit-0 for any unregistered command meant an unanticipated subprocess call silently passed.

### Why Move the Co-located Tests?

Co-located `src/**/*.test.ts` files were included in the same tree the coverage config scans and the schema-sync guard walks, and the split between "co-located Phase-3 tests" and "everything else in `__test__/`" was a historical accident nobody could state a rule for. One location plus a mirrored `unit/` subtree is a rule; `test-placement.test.ts` makes it executable, and also polices the `__test__/utils/` trap that silently drops suites.

### Why Characterization Tests for a Known Bug?

Issue #216 spans several degradation paths across five modules. Fixing them and writing the tests in one change would produce a diff where nobody could tell which assertions describe the old behaviour and which the new. Pinning current behaviour first, with the issue named in each test, makes the fix a diff that flips clearly-labelled expectations — and guarantees the paths cannot regress further in the meantime. Critically, it also proved the bug is **one decision, not a patch per path**: a degraded step must contribute a *finding*, since that is the only thing the verdict reads.

The publish-validation fix is the evidence that this worked. Its two pins were written to fail when it landed; the diff that fixed it flipped exactly those expectations and touched no boolean in the shared baseline, and the reviewer could read the old behaviour and the new one side by side in the same test bodies. The remaining pins are unchanged and still name the issue.

### Why Three-Legged Manifest Guards?

`action.yml`, the `NAMES` tuples, and what the code actually reads are three independent sources of truth for the same fact. A two-way check lets the third drift silently — which is how a `build-command` read no workflow could set, and a `custom-registries` input nothing implemented, both survived for months. Scanning `src/` for actual reads and writes is the leg that makes a dead read visible.

## File Reference

| File | Purpose |
| ---- | ------- |
| `vitest.config.ts` | Vitest configuration via `@vitest-agent/plugin` (`AgentPlugin.discover()`), V8 coverage, `src/**/*.ts` include with empty exclude |
| `vitest.setup.ts` | Global setup hook |
| `__test__/CLAUDE.md` | Operational testing guide: commands, `it.effect` rules, gotchas |
| `__test__/utils/github-mocks.ts` | `setupTestEnvironment`, `cleanupTestEnvironment`, `suppressConsoleOutput`, `actionStateWithAppToken` |
| `__test__/utils/manifest.ts` | Manifest parsing and `src/` scanning for the `action.yml` sync guards |
| `__test__/test-placement.test.ts` | Executable placement rules (no tests in `src/`, none in `__test__/utils/`) |
| `__test__/integration/fixtures/` | Real minimal workspaces for the publishability matrix |
