---
type: Module
title: Test Harness
description: The vitest suite under __test__ that exercises the built action's phase steps, Effect orchestration, and utility modules.
kind: harness
resource: ../../__test__
tags:
  - testing
  - dx
generated:
  by: okfit/claude-code
  at: 2026-09-15T03:42:33Z
  body_sha256: 357e3cb53196aee61250c7743967a8ad16a3c9794006cce37fc6c68fa3e8cce9
sources:
  - id: vitest-config
    resource: ../../vitest.config.ts
  - id: test-claude
    resource: ../../__test__/CLAUDE.md
  - id: github-mocks
    resource: ../../__test__/utils/github-mocks.ts
  - id: manifest-utils
    resource: ../../__test__/utils/manifest.ts
  - id: publishing-test
    resource: ../../__test__/publishing.test.ts
  - id: check-collection-script
    resource: ../../scripts/check-test-collection.mjs
---

# Test Harness

`__test__/` is a private, never-published harness package group: a Vitest
suite of just under 900 tests over ~60 files exercising the phase steps, the
Phase-3 Effect orchestration, the check derivation, the silk publishability
rules, and the utility modules under `src/`.[^vitest-config][^test-claude]

## Framework configuration

`vitest.config.ts` builds its config through `@vitest-agent/plugin`'s
`AgentPlugin.discover()`, which supplies `projects` and `tags` rather than
having either enumerated by hand in the config file.[^vitest-config] The
effective values:

- **Pool:** `forks`.
- **Global setup:** `vitest.setup.ts`.
- **Coverage provider:** V8, always enabled.
- **Coverage thresholds:** `AgentPlugin.COVERAGE_LEVELS.standard.thresholds`
  for pass/fail, while the plugin's own `coverageTargets` are set to the
  `strict` level.
- **Coverage include/exclude:** `include: ["src/**/*.ts"]` with a
  deliberately **empty** `exclude: []`. A source file nothing ever imports
  scores 0% instead of being silently omitted from the report — an empty
  exclude list is the thing that makes a never-imported module visible as a
  gap rather than invisible.[^vitest-config]

Because projects are plugin-discovered rather than config-enumerated, a CLI
file argument does not filter the run to a single file. Running one file
requires the vitest-agent MCP `run_tests` tool with a `files` array (for
example `["__test__/native-version.test.ts"]`).[^vitest-config][^test-claude]

## Layout and the placement guard

```text
__test__/
  *.test.ts               flat unit suites (the majority)
  unit/
    program.test.ts
    changelog/*.test.ts
    release/*.test.ts
    utilities/*.test.ts
  integration/
    publishability.int.test.ts
    fixtures/             real minimal workspaces
  utils/                  HELPERS ONLY — never collected
    github-mocks.ts
    manifest.ts
  CLAUDE.md
  CLAUDE.effect-vitest.md
```

No test is co-located under `src/`: every `src/**/*.test.ts` moved to
`__test__/unit/**`, mirroring its source path. The mirrored subtree is
`__test__/unit/utilities/` (holding, among others,
`release-kind.test.ts`, `custom-registries.test.ts`, `group-id.test.ts`,
`sort-releases-topologically.test.ts`, `turbo-summary.test.ts`,
`count-changesets.test.ts`, and `npm-cache.test.ts`) — **never**
`__test__/unit/utils/`, which is one of the excluded directory names below.

A directory named `utils` is never collected by the vitest-agent plugin's
project discovery, at any depth in the path, not only at the top level. A
`*.test.ts` file dropped there does not run, and nothing reports that it did
not — the only signal is the collected test count going down, which no green
run surfaces on its own. This bit the repo once for nine days: a map that
claimed the exclusion was specific to the top-level `__test__/utils/` was
probe-verified true on one date and false nine days later, when the
plugin's pattern widened to match `utils` at any depth and took
`__test__/unit/utils/` with it — 5 suites, 60 cases, silently not
running.[^test-claude]

Placement is enforced two independent ways:

1. `__test__/test-placement.test.ts` walks the repo and asserts that no
   `*.test.ts` sits under `src/**`, outside `__test__/`, or under a
   directory named `utils`, `fixtures`, or `snapshots` at any depth, and
   that the walker itself sees more than 20 files so a broken walker cannot
   pass vacuously.[^test-claude]
2. `scripts/check-test-collection.mjs` (`pnpm check:collection`, and the
   first step of `pnpm ci:test`) asks vitest what it actually collected
   (`vitest list --json`) and diffs that against what is on disk, so it
   catches an exclusion rule nobody has learned about yet — which is exactly
   how the nine-day gap above got through.[^check-collection-script][^test-claude]

Full authoring rules for where a test file belongs live in
[Test placement](../conventions/test-placement.md); the CLI-argument and
`utils/`-collection traps are covered in
[Vitest file argument doesn't filter](../gotchas/vitest-file-argument.md).

## Test infrastructure

`__test__/utils/manifest.ts` and `__test__/utils/github-mocks.ts` are helper
modules only — by rule, never collected as tests themselves. `github-mocks.ts`
exports:[^github-mocks]

| Export | Purpose |
| --- | --- |
| `setupTestEnvironment({ suppressOutput })` | Clear all mocks; optionally silence stdout/stderr. Call in `beforeEach()` |
| `cleanupTestEnvironment()` | Restore all mocks via `vi.restoreAllMocks()`. Call in `afterEach()` |
| `suppressConsoleOutput()` | Silence `process.stdout.write` / `process.stderr.write` directly |
| `actionStateWithAppToken(token?)` | An `ActionState` layer pre-loaded with an installation token |

`__test__/utils/manifest.ts` provides the manifest parsing and `src/`
source-scanning behind the `action.yml` three-legged sync guards
(`schema-inputs.test.ts`, `schema-outputs.test.ts`).[^manifest-utils]

There is no `MockOctokit` type and no hand-rolled Octokit factory. Effect
code is doubled with the `@effected/*` kit's in-memory `layerTest`
statics, `Layer.succeed(Service, { … })`, or a kit `*.makeTest` factory —
never with a mocked transport — per
[Effect service doubles](../conventions/effect-service-doubles.md).

## Test coverage map

Re-verified against the tree on disk (`ls __test__ __test__/unit/**`), not
copied from the design doc that preceded this concept, which had drifted in
two places: it claimed `__test__/unit/utilities/` did not exist (it does,
and is the correct mirrored location) and that `src/steps/publishing.ts`
had no direct orchestration test (`__test__/publishing.test.ts` tests it
directly — see below).

| Test file | Source module | Category |
| --- | --- | --- |
| `__test__/unit/program.test.ts` | `src/program.ts` | Composition |
| `__test__/pre.test.ts` | `src/pre.ts` | Entry points |
| `__test__/post.test.ts` | `src/post.ts` | Entry points |
| `__test__/schema-inputs.test.ts` | `src/schema/inputs.ts` + `action.yml` | Manifest guard |
| `__test__/schema-outputs.test.ts` | `src/schema/outputs.ts` + `action.yml` | Manifest guard |
| `__test__/test-placement.test.ts` | the repo tree | Placement guard |
| `__test__/projections.test.ts` | `src/schema/projections.ts` | Schema |
| `__test__/release-output.test.ts` | `src/schema/release-output.ts` | Schema |
| `__test__/unit/utilities/release-kind.test.ts` | `src/utils/release-kind.ts` | Schema |
| `__test__/unit/utilities/custom-registries.test.ts` | `src/utils/custom-registries.ts` | Infra |
| `__test__/detect-workflow-phase.test.ts` | `src/utils/detect-workflow-phase.ts` | Routing |
| `__test__/event-payload.test.ts` | `src/utils/event-payload.ts` | Routing |
| `__test__/check-release-branch.test.ts` | `src/utils/check-release-branch.ts` | Phase 1 |
| `__test__/create-release-branch.test.ts` | `src/utils/create-release-branch.ts` | Phase 1 |
| `__test__/update-release-branch.test.ts` | `src/utils/update-release-branch.ts` | Phase 1 |
| `__test__/native-version.test.ts` | `src/utils/native-version.ts` | Phase 1 |
| `__test__/format-workspace.test.ts` | `src/utils/format-workspace.ts` | Phase 1 |
| `__test__/porcelain-changes.test.ts` | `src/utils/porcelain-changes.ts` | Phase 1 |
| `__test__/pr-body.test.ts` | `PrBody.ManagedPrBody` (silk-effects) — a contract smoke test, not a reimplementation of the upstream suite | Phase 1 |
| `__test__/release-pr-title.test.ts` | `src/utils/release-summary-helpers.ts` | Phase 1 |
| `__test__/release-plan.test.ts` | `src/utils/release-plan.ts` | Phase 1 |
| `__test__/publish-release-plan.test.ts` | `src/steps/publish-release-plan.ts` | Phase 1 |
| `__test__/managed-sections.test.ts` | `src/utils/managed-sections.ts` | Phase 1/2 |
| `__test__/write-sections.test.ts` | `src/utils/write-sections.ts` | Phase 1/2 |
| `__test__/release-table.test.ts` | `src/utils/release-table.ts` | Phase 1/2 |
| `__test__/auto-merge.test.ts` | `src/utils/auto-merge.ts` | Phase 1 |
| `__test__/link-issues-and-build-steps.test.ts` | `src/steps/link-issues.ts`, `src/steps/build-validation.ts` | Phase 2 |
| `__test__/link-issues-from-commits.test.ts` | `src/utils/link-issues-from-commits.ts` | Phase 2 |
| `__test__/validate-builds.test.ts` | `src/utils/validate-builds.ts` | Phase 2 |
| `__test__/publish-validation.test.ts` | `src/steps/publish-validation.ts` | Phase 2 |
| `__test__/validation-checks.test.ts` | `src/release/validation-checks.ts` | Phase 2 |
| `__test__/per-step-checks.test.ts` | `src/steps/per-step-checks.ts` | Phase 2 |
| `__test__/publish-validation-report.test.ts` | `src/steps/publish-validation-report.ts` | Phase 2 |
| `__test__/create-validation-check.test.ts` | `src/utils/create-validation-check.ts` | Phase 2 |
| `__test__/cleanup-validation-checks.test.ts` | `src/utils/cleanup-validation-checks.ts` | Phase 2 |
| `__test__/derive-check-conclusion.test.ts` | `src/utils/derive-check-conclusion.ts` | Phase 2 |
| `__test__/unit/release/validation.test.ts` | `src/release/validation.ts` | Phase 2 |
| `__test__/unit/utilities/turbo-summary.test.ts` | `src/utils/turbo-summary.ts` | Phase 2 |
| `__test__/unit/release/publish.test.ts` | `src/release/publish.ts` | Phase 3 |
| `__test__/unit/release/releases.test.ts` | `src/release/releases.ts` | Phase 3 |
| `__test__/unit/release/meta-archive.test.ts` | `src/release/meta-archive.ts` | Phase 3 |
| `__test__/unit/release/resolve-targets.test.ts` | `src/release/resolve-targets.ts` | Phase 2/3 |
| `__test__/unit/release/report.test.ts` | `src/release/report.ts` | Phase 2/3 |
| `__test__/unit/release/errors.test.ts` | `src/release/errors.ts` | Phase 2/3 |
| `__test__/unit/utilities/group-id.test.ts` | `src/utils/group-id.ts` | Phase 3 |
| `__test__/unit/utilities/sort-releases-topologically.test.ts` | `src/utils/sort-releases-topologically.ts` | Phase 2/3 |
| `__test__/attest-helpers.test.ts` | `src/release/attest-helpers.ts` | Phase 3 |
| `__test__/determine-tag-strategy.test.ts` | `src/utils/determine-tag-strategy.ts` | Phase 3 |
| `__test__/publishing.test.ts` | `src/steps/publishing.ts` — the Phase-3 orchestrator's deferred-failure ordering contract | Phase 3 |
| `__test__/close-linked-issues.test.ts` | `src/utils/close-linked-issues.ts` | Phase 3a |
| `__test__/detect-repo-type.test.ts` | `src/utils/detect-repo-type.ts` | Infra |
| `__test__/commit-signoff.test.ts` | `src/utils/commit-signoff.ts` | Infra |
| `__test__/extract-release-notes.test.ts` | `src/utils/extract-release-notes.ts` | Infra |
| `__test__/load-release-config.test.ts` | `src/utils/load-release-config.ts` | Infra |
| `__test__/summary-writer.test.ts` | `src/utils/summary-writer.ts` | Infra |
| `__test__/github-urls.test.ts` | `src/utils/github-urls.ts` | Infra |
| `__test__/registry-label.test.ts` | `@effected/npm` registry labels — an adoption guard, not a unit test of local code | Infra |
| `__test__/update-sticky-comment.test.ts` | `src/utils/update-sticky-comment.ts` | Infra |
| `__test__/unit/utilities/count-changesets.test.ts` | `src/utils/count-changesets.ts` | Infra |
| `__test__/unit/utilities/npm-cache.test.ts` | `src/utils/npm-cache.ts` | Infra |
| `__test__/unit/changelog/default.test.ts` | `src/changelog/default.ts` | Infra |
| `__test__/integration/publishability.int.test.ts` | `SilkPublishability` (silk-effects), backed by real minimal workspace fixtures under `__test__/integration/fixtures/` | Integration |

## Coverage gaps

| Module | Reason for gap |
| --- | --- |
| `src/main.ts` | 19 lines: a `GITHUB_ACTIONS` guard and `Action.run`, marked `/* v8 ignore */`. The program it runs is covered by `unit/program.test.ts` |
| `src/layers/app.ts` | Pure Layer wiring, marked `/* v8 ignore */`; exercised indirectly by the modules that consume it |
| `src/steps/validation.ts` | Uncovered orchestration — no test executes `runValidation`, so a green suite says nothing about the wiring in that body, only about the six modules it calls. See [Uncovered validation body](../gotchas/uncovered-validation-body.md) |
| `src/types/*.ts` | Type definitions with no runtime behavior |
| `src/changelog/silk.ts`, `src/changelog/default.ts` | Re-export shims for the bundled changelog generators; no logic beyond the shim |
| `src/steps/branch-management.ts`, `src/steps/close-issues.ts` | Phase bodies covered indirectly through their callees; no direct orchestration test |

`src/steps/publishing.ts` is **not** a gap: `__test__/publishing.test.ts`
exercises its ordering contract directly (mocking `release/publish.ts` and
`release/releases.ts` at the module boundary), proving that a failure in
`runReleases` still lets issue-closing run, still collects tag SHAs, still
emits outputs, and only then fails the effect.

## Test commands

```bash
pnpm test            # vitest run --pass-with-no-tests
pnpm test:coverage    # vitest run --coverage --pass-with-no-tests
pnpm test:watch       # watch mode
pnpm ci:test          # check:collection, then CI="true" vitest run --coverage
```

`pnpm test` and `pnpm test:watch` pass `--pass-with-no-tests`, so collecting
zero suites also exits 0 — the count, not the exit code, is the gate for
this repo. A CLI file argument never filters to a single file here; use the
vitest-agent MCP `run_tests` tool with a `files` array instead.

[^vitest-config]: `../../vitest.config.ts`
[^test-claude]: `../../__test__/CLAUDE.md`
[^github-mocks]: `../../__test__/utils/github-mocks.ts`
[^manifest-utils]: `../../__test__/utils/manifest.ts`
[^check-collection-script]: `../../scripts/check-test-collection.mjs`
