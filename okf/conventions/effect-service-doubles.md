---
type: Convention
title: Double Effect services with layers, never with mocks
description: Substitute every Effect service under test with a Layer or a kit makeTest static, stub unexercised members with Effect.die, and use the real seams (ChildProcessSpawner, @effected/memfs) instead of a plausible-default stub.
tags:
  - testing
stale_after: "2026-12-13T00:00:00Z"
sources:
  - id: effect-service-doubles
    resource: ../../__test__/CLAUDE.md
  - id: native-version-test
    resource: ../../__test__/native-version.test.ts
  - id: validate-builds-test
    resource: ../../__test__/validate-builds.test.ts
  - id: detect-workflow-phase-test
    resource: ../../__test__/detect-workflow-phase.test.ts
  - id: releases-test
    resource: ../../__test__/unit/release/releases.test.ts
  - id: load-release-config-test
    resource: ../../__test__/load-release-config.test.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 870f6a6871ffe71b7ef5805051465204e3005f5699d4721c6c5c96ec0fe91b5d
status: draft
---

# Double Effect services with layers, never with mocks

Every service the action depends on is an Effect service, so a test
substitutes an in-memory implementation rather than mocking a transport.
Follow these rules when writing or reviewing a test double.

Double a service with `Layer.succeed(Service, { … })` for the common
case — `Repo`, `WorkspaceDiscovery`, `ChangesetConfig`,
`PublishabilityDetector`, `Changesets.ReleasePlanner` and
`Changesets.ConfigInspector` are the services most often doubled this
way — or with one of the kit's `*.makeTest` statics
(`ActionEnvironment.makeTest`, `ActionOutputs.makeTest`,
`SigstoreSigner.makeTest`, and silk-effects'
`Changesets.makeReleasePlannerTest` / `makeConfigInspectorTest`) when one
exists.[^effect-service-doubles] Stub every member the test does not
exercise with `Effect.die(...)` rather than a plausible return value, so
an accidental call fails loudly instead of passing silently.

Treat the subprocess seam as a `ChildProcessSpawner`, never a default-success
command map. A spawner that answers exit 0 for any unregistered command
lets a code path that shells out to something the test never anticipated
pass silently. Provide a spawner that fails any spawn when the path under
test must not run a command (`native-version.test.ts`), or one that
asserts on the exact argv when it must run *this* command
(`validate-builds.test.ts`'s `ScriptedSpawner`, asserting
`spawner.spawns[0].command`/`.args`).[^native-version-test][^validate-builds-test]

Treat the filesystem seam as `@effected/memfs`, never a `FileSystem.layerNoop`
stub and never the host filesystem. Provide `MemoryFileSystem.layer` for
an empty volume or `MemoryFileSystem.layerWith({ … })` seeded with only
the paths the flow genuinely reads, rooted at `/` (a relative read such as
`"package.json"` resolves from the volume root, so seed that same name
rooted at `/`). A `layerNoop`-style stub answers plausibly for paths the
code should never have asked for and hides mutants that a real filesystem
seam kills; `detect-workflow-phase.test.ts` uses `MemoryFileSystem` even
to seed `GITHUB_EVENT_PATH`, because `ActionEnvironment.makeTest` reads it
through a genuine `FileSystem` and a stubbed one would never read the
seeded payload at all.[^detect-workflow-phase-test] Where a volume must be
shared across two provisions — for example under `ActionEnvironment` and
again for the program — provide it as one layer value so both provisions
memoize onto the same volume instead of building two that could drift.

Silence logs in a test with `Effect.provide(Logger.layer([]))`; an empty
logger array installs no loggers. `suppressOutput` cannot catch a leak
from the default logger, because console leaks in Effect suites come from
the default logger writing through `console.log`, not from
`process.stdout.write`. To raise the minimum log level instead of
silencing it, provide the log-level reference directly:
`Effect.provideService(References.MinimumLogLevel, "All")` — log levels
are plain string literals in Effect v4 (`"All"`, `"Debug"`, …).
`releases.test.ts` uses this to assert debug output in its "BOTH SHAs"
case.[^releases-test] A `SchemaError` under v4 renders its failing path in
bracket notation (`["sbom"]["supplier"]["name"]`), not the v3 dotted form;
match assertions against the bracketed shape, as
`load-release-config.test.ts` does.[^load-release-config-test]

Inject action inputs through the `ActionInput` layer, never by mutating
`process.env` between reads. The environment is snapshotted at first
read, so a mid-test mutation reuses the value from the first read and
silently turns an expected-to-fail test green.

Enable fake timers per test, not globally in `beforeEach`, and reset them
in `afterEach` with `vi.useRealTimers()`. Never combine fake timers with
`it.effect`: its virtual `TestClock` already owns time, and the two do
not compose.

Do not stub a topological sorter — there is no `TopologicalSorter`
service to stub. `runValidation` and the Phase-3 orchestration order
released packages via `sortReleasesTopologically`, which builds a real
`DependencyGraph.make({ packages })` from
`WorkspaceDiscovery.listPackages()`. An order-sensitive test declares a
real `workspace:*` dependency edge on a `WorkspacePackage` fixture and
asserts that both the report order and the recorded call order follow the
graph.

See [Effect layers, not mocks](../decisions/effect-layers-not-mocks.md)
for why this replaced mocking, and
[`it.effect` vs plain `it()`](../conventions/it-effect-vs-plain-it.md) for
the companion rule on which runner a test using these doubles should use.

[^effect-service-doubles]: `../../__test__/CLAUDE.md`
[^native-version-test]: `../../__test__/native-version.test.ts`
[^validate-builds-test]: `../../__test__/validate-builds.test.ts`
[^detect-workflow-phase-test]: `../../__test__/detect-workflow-phase.test.ts`
[^releases-test]: `../../__test__/unit/release/releases.test.ts`
[^load-release-config-test]: `../../__test__/load-release-config.test.ts`
</content>
