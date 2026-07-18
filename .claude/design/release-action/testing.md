---
title: Testing Strategy and Infrastructure
category: testing
status: current
completeness: 90
created: 2026-02-07
updated: 2026-07-17
last-synced: 2026-07-17
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
  - [Test Infrastructure](#test-infrastructure)
  - [Effect Service Test Layers](#effect-service-test-layers)
  - [Standard Test Patterns for Imperative Code](#standard-test-patterns-for-imperative-code)
  - [Specialized Testing Patterns](#specialized-testing-patterns)
  - [Test Coverage Map](#test-coverage-map)
  - [Coverage Gaps](#coverage-gaps)
  - [Test Best Practices](#test-best-practices)
  - [Test Commands](#test-commands)
- [Rationale](#rationale)
  - [Why 85% Coverage Threshold?](#why-85-coverage-threshold)
  - [Why Effect Test Layers for Phase-3 Code?](#why-effect-test-layers-for-phase-3-code)
  - [Why Factory Functions Over Direct Mocking?](#why-factory-functions-over-direct-mocking)
  - [Why 240s Test Timeout?](#why-240s-test-timeout)
  - [Why Exclude Certain Modules from Coverage?](#why-exclude-certain-modules-from-coverage)
- [File Reference](#file-reference)

## Overview

The project uses Vitest 4.0.8 with a comprehensive test suite covering Phase-3 Effect orchestration, the silk publishability rules, and all utility modules. Tests enforce type-safe mocking with zero `any` types and maintain 85%+ coverage per file via the V8 provider. All external dependencies (GitHub API, exec, file system, `@effected/workspaces`) are mocked or replaced with in-memory Effect test layers to ensure tests are fast, reliable, and isolated.

Phase-3 code (`src/release/`) is tested using Effect service test layers provided by `@savvy-web/github-action-effects/testing`. There are no hand-rolled Octokit factories; the old `createMockOctokit()` / `MockOctokit` patterns from `__test__/utils/test-types.ts` were removed in the migration. For imperative utility modules (Phase 1/2), tests use `vi.mock()` for external dependencies and the environment helpers from `__test__/utils/github-mocks.ts`.

The publishability rules have dedicated integration tests in `__test__/integration/publishability.int.test.ts` backed by the fixture workspaces in `__test__/integration/fixtures/`.

## Current State

### Test Framework Configuration

Vitest is configured via `@savvy-web/vitest`'s `VitestConfig.create()` in `vitest.config.ts`. Key effective values:

- **Test directory:** `__test__/` (singular — not `__tests__/`) for non-co-located tests; `src/release/*.test.ts` for co-located Phase-3 unit tests
- **Test timeout:** 240,000ms (4 minutes) to accommodate retry-logic and fake-timer tests
- **Coverage provider:** V8
- **Coverage thresholds (per file):** lines 85%, functions 85%, branches 85%, statements 85%

Coverage exclusions (documented reasons):

| Excluded Module | Reason |
| --------------- | ------ |
| `__test__/utils/**/*.ts` | Test utilities themselves |
| `src/utils/create-api-commit.ts` | Complex fs/exec mocking for GitHub API commits |

Test scripts defined in `package.json`:

```bash
pnpm test          # vitest run --pass-with-no-tests
pnpm ci:test       # CI="true" vitest run --coverage
```

### Test Infrastructure

`__test__/utils/github-mocks.ts` provides three environment helpers — there are no hand-rolled Octokit or `@actions/*` mock factories:

| Function | Purpose |
| -------- | ------- |
| `setupTestEnvironment({ suppressOutput })` | Clear all mocks; optionally silence stdout/stderr. Call in `beforeEach()` |
| `cleanupTestEnvironment()` | Restore all mocks via `vi.restoreAllMocks()`. Call in `afterEach()` |
| `suppressConsoleOutput()` | Silence `process.stdout.write` and `process.stderr.write` directly |

The `__test__/utils/test-types.ts` file was removed during the migration. There is no `MockOctokit` type; tests that need Octokit-style mocking use `vi.mock()` with explicit return values, or use Effect test layers.

### Effect Service Test Layers

Phase-3 code in `src/release/` depends entirely on Effect service abstractions. Tests provide those services through in-memory layers from `@savvy-web/github-action-effects/testing`. No Octokit, npm, GitHub API, or Sigstore calls happen in unit tests.

Key test layers:

- **`ActionOutputsTest`** — records `setOutput` calls; inspect via `state.outputs`
- **`ActionStateTest`** — in-memory `ActionState`; inject pre-loaded state values
- **`GitHubClientTest`** — records REST API calls; inject canned responses
- **`GitHubAppTest`** — records App identity calls
- **`CheckRunTest`** — records check-run create/update calls
- **`GitBranchTest`** — records branch create/update/delete calls
- **`PullRequestTest`** — records PR list/update calls; inject canned PR lists
- **`CommandRunnerTest`** — records exec calls; inject exit codes and stdout/stderr
- **`PackagePublishTest`** — records pack/publish/setupAuth calls; inject pack results
- **`NpmRegistryTest`** — records getPublishedIntegrity calls; inject `Option.none()` or `Option.some(digest)`
- **`AttestTest`** / **`SbomTest`** — record attestation and SBOM generation calls; no cryptographic work

**`CommandRunnerTest` default-success nuance:** `CommandRunnerTest.layer(map)` returns a default success (exit 0) for any command key not registered in the map — an unregistered command does NOT fail. To simulate a failing command (e.g. "binary not on PATH" in the `format-workspace` tests), register the exact command string with a non-zero `exitCode`; `execCapture` turns that into a failed `CommandRunnerError`, which is what production `Effect.either` probes observe as a Left. Registering must-not-run commands with non-zero exits is also the way to pin that a code path does not execute them.

**silk-effects test factories:** `@savvy-web/silk-effects` ships `Changesets.makeReleasePlannerTest` and `Changesets.makeConfigInspectorTest`, in-memory factories for the native-versioning services. The `create-release-branch` and `update-release-branch` tests provide these layers for the version step instead of the exec mocks they used when versioning shelled out to `ci:version`; `native-version.test.ts` uses them to exercise the id map, config gate, token scoping and reset-then-retry directly. `runNativeVersion` invokes `planner.apply` through a thunk so a stateful test double actually runs again on the retry.

The canonical test pattern for Phase-3 Effect code:

```typescript
import { Effect, Layer } from "effect";
import { ActionStateTest, PackagePublishTest, NpmRegistryTest } from "@savvy-web/github-action-effects/testing";
import { runPublishTargets } from "../../src/release/publish.js";

const testLayer = Layer.mergeAll(
  ActionStateTest.layer({ /* pre-loaded state */ }),
  PackagePublishTest.layer({ /* canned responses */ }),
  NpmRegistryTest.layer({ getPublishedIntegrity: () => Effect.succeed(Option.none()) }),
  // ... other services
);

const result = await Effect.runPromise(
  runPublishTargets(detected, args).pipe(Effect.provide(testLayer))
);
```

### Standard Test Patterns for Imperative Code

Phase-1 and Phase-2 utility modules (still imperative) use `vi.mock()` for external dependencies. The standard setup:

```typescript
import { afterEach, beforeEach, describe, it } from "vitest";
import { cleanupTestEnvironment, setupTestEnvironment } from "./utils/github-mocks.js";

describe("module-name", () => {
  beforeEach(() => setupTestEnvironment({ suppressOutput: true }));
  afterEach(() => cleanupTestEnvironment());
});
```

External dependencies are mocked at the top of each file using `vi.mock()`:

```typescript
vi.mock("@actions/core");
vi.mock("@actions/exec");
vi.mock("node:fs");
```

### Specialized Testing Patterns

#### Effect v4 Log Silencing and Log-Level Wiring

The Effect v3 log-silencing idioms were both removed in v4, so tests were rewired:

- **Silence logs** — `Logger.replace(Logger.defaultLogger, Logger.none)` → `Effect.provide(Logger.layer([]))`. An empty logger array installs no loggers, so log output is dropped. This is the standard tail on nearly every effect-under-test in `__test__/*.test.ts` (e.g. `.pipe(Effect.provide(layer), Effect.provide(Logger.layer([])))`).
- **Raise the minimum log level** — `Logger.withMinimumLogLevel(LogLevel.All)` → `Effect.provideService(References.MinimumLogLevel, "All")`. Log levels are plain string literals in v4 (`"All"`, `"Debug"`, …); `releases.test.ts` uses this to assert debug-level output.
- **`SchemaError` bracket notation** — a v4 `SchemaError` renders the failing path in bracket notation, so path assertions match `["field"]` rather than the v3 dotted form. `load-release-config.test.ts` asserts against the bracketed message.

#### Exec Mocking with Listeners (stdout/stderr Capture)

Tests that mock `@actions/exec` capture output via listener callbacks. Used extensively in tests for modules that shell out to CLI tools:

```typescript
vi.mocked(exec.exec).mockImplementation(
  async (cmd, args, options) => {
    if (cmd === "pnpm" && args?.[0] === "ci:build") {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from("M package.json\n"));
      }
    }
    return 0;
  }
);
```

#### Fake Timers for Retry Logic

Tests for retry-enabled operations use Vitest fake timers to avoid real delays. Fake timers are enabled per-test (not globally in `beforeEach`) because global fake timers affect all async operations:

```typescript
it("should retry on ECONNRESET errors", async () => {
  vi.useFakeTimers();
  mockFn.mockRejectedValueOnce(new Error("ECONNRESET"));
  mockFn.mockResolvedValueOnce({ data: "success" });

  const actionPromise = retryableAction();
  await vi.advanceTimersByTimeAsync(60000);
  const result = await actionPromise;

  expect(mockFn).toHaveBeenCalledTimes(2);
});

afterEach(() => {
  vi.useRealTimers(); // Critical: always reset after each test
});
```

#### File System Mocking with Dynamic Paths

File system operations are mocked with path-based routing:

```typescript
vi.mocked(readFile).mockImplementation(async (path) => {
  const pathStr = String(path);
  if (pathStr.includes("changeset-status")) return changesetStatusContent;
  if (pathStr.includes("package.json")) return JSON.stringify({ name: "@test/pkg" });
  return "{}";
});
```

#### Workspace Mocking (`@effected/workspaces`)

Workspace-related tests mock `@effected/workspaces`'s sync API via `WorkspaceDiscovery` or direct `vi.mock`. The sync helpers now take `nodeSyncOps` from `@effected/workspaces/node-sync` in production, but the test still mocks the top-level `findWorkspaceRootSync` / `getWorkspacePackagesSync` exports:

```typescript
import { findWorkspaceRootSync, getWorkspacePackagesSync } from "@effected/workspaces";
vi.mock("@effected/workspaces");

vi.mocked(findWorkspaceRootSync).mockReturnValue("/test/workspace");
vi.mocked(getWorkspacePackagesSync).mockReturnValue([
  {
    name: "@test/pkg-a",
    version: "0.0.0",
    path: "/test/workspace/packages/pkg-a",
    packageJsonPath: "/test/workspace/packages/pkg-a/package.json",
    relativePath: "packages/pkg-a",
    private: false,
    dependencies: {},
    devDependencies: {},
    peerDependencies: {},
    optionalDependencies: {},
    publishConfig: { access: "public" },
  },
]);
```

`@effected/workspaces` services that have no `/testing` layer are stubbed inline with `Layer.succeed`. The `WorkspaceDiscovery` shape grew across the v4 migration, so the in-memory doubles stub more methods — `info`, `resolveFile`, and `resolveFiles` alongside `listPackages`, `getPackage`, `importerMap`, and `refresh` (unexercised methods return `Effect.die(...)` so an accidental call fails loudly).

The standalone `TopologicalSorter` service is gone. `runValidation` (and the Phase-3 orchestration) order released packages via `sortReleasesTopologically`, which builds a real `DependencyGraph.make({ packages })` from `WorkspaceDiscovery.listPackages()` and calls `sortSubset` — there is no sorter to stub. The dedicated "dependency order, not workspace glob order" test in `validation.test.ts` therefore declares a real `workspace:*` dependency edge on a `WorkspacePackage` fixture (alpha depends on beta) and asserts both the report order and the `dryRunCalls` order follow the graph's dependency-first sort, rather than injecting a reordering sorter stub.

#### Publishability Integration Tests

`__test__/integration/publishability.int.test.ts` uses real fixture workspaces to verify the full silk publishability matrix against the `SilkPublishabilityDetectorLive` layer without any mocking. Each fixture is a minimal workspace with a real `package.json` in `__test__/integration/fixtures/`:

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

#### GitHub Context Mocking

The `@actions/github` context object is mocked using `Object.defineProperty` to set read-only properties:

```typescript
Object.defineProperty(vi.mocked(context), "repo", {
  value: { owner: "test-owner", repo: "test-repo" },
  writable: true,
});
```

### Test Coverage Map

Co-located tests live in `src/release/*.test.ts`. Integration tests live in `__test__/integration/`. All other unit tests live in `__test__/`.

| Test File | Source Module | Category |
| --------- | ------------ | -------- |
| `src/release/publish.test.ts` | `src/release/publish.ts` | Phase 3 |
| `src/release/releases.test.ts` | `src/release/releases.ts` | Phase 3 |
| `src/release/meta-archive.test.ts` | `src/release/meta-archive.ts` | Phase 3 |
| `src/utils/group-id.test.ts` | `src/utils/group-id.ts` | Phase 3 |
| `src/release/validation.test.ts` | `src/release/validation.ts` | Phase 2 |
| `src/release/report.test.ts` | `src/release/report.ts` | Phase 2/3 |
| `src/release/publishability.test.ts` | `src/release/publishability.ts` | Phase 2/3 |
| `src/release/changeset-config.test.ts` | `src/release/changeset-config.ts` | Phase 2/3 |
| `src/release/errors.test.ts` | `src/release/errors.ts` | Phase 2/3 |
| `__test__/integration/publishability.int.test.ts` | `src/release/publishability.ts` | Integration |
| `__test__/pre.test.ts` | `src/pre.ts` | Entry points |
| `__test__/post.test.ts` | `src/post.ts` | Entry points |
| `__test__/check-release-branch.test.ts` | `check-release-branch.ts` | Phase 1 |
| `__test__/create-release-branch.test.ts` | `create-release-branch.ts` | Phase 1 |
| `__test__/update-release-branch.test.ts` | `update-release-branch.ts` | Phase 1 |
| `__test__/native-version.test.ts` | `src/utils/native-version.ts` | Phase 1 |
| `__test__/format-workspace.test.ts` | `src/utils/format-workspace.ts` | Phase 1 |
| `__test__/close-linked-issues.test.ts` | `close-linked-issues.ts` | Phase 3a |
| `__test__/cleanup-validation-checks.test.ts` | `cleanup-validation-checks.ts` | Infra |
| `__test__/create-validation-check.test.ts` | `create-validation-check.ts` | Phase 2 |
| `__test__/derive-check-conclusion.test.ts` | `derive-check-conclusion.ts` | Phase 2 |
| `__test__/determine-tag-strategy.test.ts` | `determine-tag-strategy.ts` | Phase 3 |
| `__test__/detect-workflow-phase.test.ts` | `detect-workflow-phase.ts` | Routing |
| `__test__/extract-release-notes.test.ts` | `extract-release-notes.ts` | Infra |
| `__test__/generate-schema.test.ts` | `lib/scripts/generate-schema.ts` (drift guard over both committed JSON Schemas) | Schema |
| `__test__/infer-sbom-metadata.test.ts` | `infer-sbom-metadata.ts` | SBOM |
| `__test__/link-issues-from-commits.test.ts` | `link-issues-from-commits.ts` | Phase 2 |
| `__test__/load-release-config.test.ts` | `load-release-config.ts` | Infra |
| `__test__/parse-changesets.test.ts` | `parse-changesets.ts` | Infra |
| `__test__/projections.test.ts` | `src/schema/projections.ts` | Schema |
| `__test__/release-output.test.ts` | `src/schema/release-output.ts` | Schema |
| `__test__/summary-writer.test.ts` | `summary-writer.ts` | Infra |
| `__test__/tokens.test.ts` | `tokens.ts` | Infra |
| `__test__/validate-builds.test.ts` | `validate-builds.ts` | Phase 2 |
| `__test__/validate-ntia-compliance.test.ts` | `validate-ntia-compliance.ts` | SBOM |
| `__test__/detect-repo-type.test.ts` | `detect-repo-type.ts` | Infra |
| `__test__/commit-signoff.test.ts` | `commit-signoff.ts` | Infra |

### Coverage Gaps

Source modules without dedicated test files:

| Module | Reason for Gap |
| ------ | -------------- |
| `src/main.ts` | Main action entry point; orchestrates phases |
| `src/types/*.ts` | Type definitions with no runtime behavior |
| `src/utils/create-api-commit.ts` | GitHub API commit (excluded from coverage) |
| `src/changelog/*.ts` | Re-export shims for the bundled changelog generators; no logic |
| `src/release/resolve-targets.ts` | Covered indirectly via validation and publishability tests |
| `src/utils/normalize-package-manager.ts` | Single-branch narrowing helper; exercised via publish and validation tests |
| `src/utils/registry-label.ts` | Label helpers; exercised via publish and validation log-tree assertions |

### Test Best Practices

1. **Type Safety** — No `any` types anywhere in test code. Use Effect service test layers for Effect code; use explicit `as unknown as Type` casts for imperative mocks.
2. **Arrange-Act-Assert** — Every test follows the AAA pattern with clear separation between setup, execution, and verification.
3. **Descriptive Names** — Tests use the "should X when Y" naming format.
4. **Nested Describe Blocks** — Related scenarios are grouped with nested `describe` blocks.
5. **Top-Level Mocking** — `vi.mock()` calls are placed at the top of each file before imports to ensure proper hoisting.
6. **Timer Cleanup** — Any test using `vi.useFakeTimers()` must call `vi.useRealTimers()` in its `afterEach`.
7. **Error Path Coverage** — Tests cover both `Error` and non-`Error` throw scenarios, along with specific HTTP error codes.
8. **Effect Layer Isolation** — Each test provides its own Layer composition; shared layers are composed in the test file's `beforeEach` or per-test.

### Test Commands

```bash
pnpm test                        # Run all tests (pass with no tests)
pnpm ci:test                     # CI mode with coverage enforcement
pnpm test --watch                # Watch mode for development
pnpm test path/to/test.test.ts   # Run specific test file
```

## Rationale

### Why 85% Coverage Threshold?

The 85% per-file threshold balances thorough testing with pragmatism. Some modules (API commit creation, direct publishing) are difficult to unit test due to complex I/O dependencies involving multiple interacting external systems. These are validated through integration testing in the `savvy-web/silk-integration` repository.

The per-file enforcement (`perFile: true`) prevents high-coverage modules from masking low-coverage ones, which is a common problem with global thresholds in projects with many small utility modules.

### Why Effect Test Layers for Phase-3 Code?

The Phase-3 orchestration depends on `PackagePublish` (npm publish), `NpmRegistry` (npm view), `Attest` (Sigstore/Fulcio), `GitHubRelease`, `GitTag` and similar services — none of which can be satisfied in unit tests without live credentials or complex mocking. Effect's `Layer` system lets tests substitute in-memory implementations that record calls and return canned responses. The test suite asserts that the right calls happened with the right arguments without any actual cryptographic or network work. This is the same pattern used by `GitHubClientTest` in `@savvy-web/github-action-effects`.

### Why Factory Functions Over Direct Mocking?

Factory functions like those provided by `@savvy-web/github-action-effects/testing` provide four key benefits:

1. **Consistent initialization** — Every test starts with the same service shape.
2. **Proper typing** — No `any` escape hatches needed.
3. **Single update point** — When a service interface changes, only the test layer implementation needs updating.
4. **Default values** — Test layers provide sensible defaults (e.g. pack succeeds, registry returns absent) that reduce boilerplate in individual tests.

### Why 240s Test Timeout?

Some tests involve complex async operations with multiple retries and fake timer advances. The detect-workflow-phase tests, for example, simulate the release-commit detection retries (3 attempts with 5-second delays) via fake time advancement. The generous 240-second timeout prevents flaky failures in CI environments.

### Why Exclude Certain Modules from Coverage?

**`create-api-commit.ts`** — Requires simultaneously mocking the file system, `@actions/exec`, and the GitHub API's tree/blob/commit creation flow. The resulting tests would be tightly coupled to implementation details. Validated indirectly through `create-release-branch` tests and integration testing.

## File Reference

Test infrastructure files:

| File | Purpose |
| ---- | ------- |
| `vitest.config.ts` | Vitest configuration with coverage thresholds |
| `vitest.setup.ts` | Global setup hook |
| `__test__/utils/github-mocks.ts` | Environment helpers: setupTestEnvironment, cleanupTestEnvironment, suppressConsoleOutput |
| `__test__/CLAUDE.md` | Testing documentation for Claude Code context |

Source entry points:

| File | Status |
| ---- | ------ |
| `src/main.ts` | No dedicated test; integration-tested |
| `src/pre.ts` | `__test__/pre.test.ts` covers Effect program |
| `src/post.ts` | `__test__/post.test.ts` covers Effect program |

Type definition files (no runtime behavior):

| File | Purpose |
| ---- | ------- |
| `src/types/global.d.ts` | Global type augmentations |
| `src/types/shared-types.ts` | Shared type definitions across modules |
| `src/types/publish-config.ts` | Publishing configuration types |
| `src/types/sbom-config.ts` | SBOM configuration types |
