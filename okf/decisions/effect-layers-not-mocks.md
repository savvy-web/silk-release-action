---
type: Decision
title: Effect layers, not mocks, as the test-double mechanism
description: Substitute in-memory Effect layers for every service dependency, stub unexercised members with Effect.die, and use a spawner seam plus @effected/memfs rather than a permissive command map or a stubbed filesystem noop.
status: draft
tags:
  - testing
sources:
  - id: native-version-test
    resource: ../../__test__/native-version.test.ts
  - id: validate-builds-test
    resource: ../../__test__/validate-builds.test.ts
  - id: format-workspace-test
    resource: ../../__test__/format-workspace.test.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: bb85d9225ed6fb3d664145a6c5c3dfeb4fcd6d52a323b2835fc3421be00f5b5c
---

# Effect layers, not mocks, as the test-double mechanism

## Context

The orchestration depends on services with no unit-testable transport —
`PackagePublish` (npm publish), `NpmRegistry` (registry HTTP),
`SigstoreSigner` / `Attestation` (Sigstore/Fulcio), `GitHubRelease`,
`GitTag`, `Git`, and similar — none of which can be exercised without
live credentials or elaborate transport mocking. A predecessor mechanism,
`CommandRunnerTest`, answered any unregistered subprocess command with a
default success (exit 0), which meant a code path that shelled out to
something the test never anticipated silently passed rather than failing.
A parallel problem existed on the filesystem side: a `FileSystem.layerNoop({ … })`
stub answered *plausibly* for any path, so a whole class of mutant that
read the wrong path survived undetected. `format-workspace`'s
`exists: (path) => files.some((f) => path.endsWith(f))` is the worked
example — a suffix match cannot tell a root config from a nested one, so
seeding a file at `/nested/<file>` should distinguish "found the nested
copy" from "found the root copy" and could not, under that stub. Reseeding
the volume at `/nested/<file>` under the real double kills 4 tests that
the suffix match let pass silently.[^format-workspace-test]

## Decision

Every service the action depends on is an Effect service, and tests
substitute in-memory Effect layers rather than mocking a transport.
`Layer.succeed(Service, { … })` is the common case for services doubled
directly (`Repo`, `WorkspaceDiscovery`, `ChangesetConfig`,
`PublishabilityDetector`, `Changesets.ReleasePlanner`,
`Changesets.ConfigInspector`); unexercised members on that double are
stubbed with `Effect.die(...)` so an accidental call fails loudly instead
of returning a plausible default, rather than the `CommandRunnerTest`
pattern of a quiet, wrong success.

The subprocess seam is a `ChildProcessSpawner`, not a command map. A
suite either provides a spawner that fails any spawn — used where a test
asserts a code path must not shell out at all (`native-version.test.ts`
provides exactly this) — or one that asserts on the exact argv attempted,
used where a test asserts a path runs *this* command and no other
(`validate-builds.test.ts`'s `ScriptedSpawner` records every spawn and
the suite asserts `spawner.spawns[0].command` / `.args` directly, plus
that a dry run spawns nothing).[^native-version-test][^validate-builds-test]

The filesystem seam is `@effected/memfs`, never a stubbed
`FileSystem.layerNoop`. Every volume-modelling double provides
`MemoryFileSystem.layer` (an empty volume) or
`MemoryFileSystem.layerWith({ … })` seeded with exactly the files the
flow genuinely reads; `MemoryFileSystem.file(content, { mode })` carries
an exec bit and `MemoryFileSystem.directory()` seeds a directory.
Relative reads (`"package.json"`, `"biome.jsonc"`) resolve from the
volume root, so a seed is that same name rooted at `/`.[^format-workspace-test]

## Alternatives rejected

**A permissive command map defaulting to success.** The predecessor
`CommandRunnerTest`'s default exit-0 for any unregistered command meant
an unanticipated subprocess call silently passed instead of failing the
test that should have caught it — the same class of problem the memfs
seam fixes on the filesystem side.

**A stubbed `FileSystem.layerNoop` answering any path plausibly.** A
blanket `readFileString: () => "file contents"` or a suffix-matching
`exists` cannot distinguish a call to the right path from a call to the
wrong one, and cannot distinguish "never called" from "called and
answered" — an empty `MemoryFileSystem` volume passing a test is now
positive evidence that nothing in that flow reads a file, which a
`layerNoop` stub could never provide.

## Consequences

Replacing `FileSystem.layerNoop` stubs with `@effected/memfs` volumes was
load-bearing rather than cosmetic: `format-workspace`'s suffix-matching
`exists` mutant is killed by reseeding at `/nested/<file>` (4 tests);
`create-release-branch` / `update-release-branch`'s blanket
`readFileString: () => "file contents"` mutant is killed by reseeding
`/package.json` as `/nope.json`, producing the real `NotFound` production
sees (12 tests); and `detect-workflow-phase`'s `readFileString: () => "{}"`
mutant, which could not distinguish "never called" from "called and
answered", is killed by an empty volume that now passes as positive
evidence nothing reads a file. No host-filesystem double remains:
`detect-workflow-phase.test.ts` used to build a real temp directory
because `ActionEnvironment.makeTest` reads `GITHUB_EVENT_PATH` through a
genuine `FileSystem`, and the constraint the suite needs satisfied is
that the implementation be *real*, not that it be the host's —
`MemoryFileSystem` satisfies it, provided as one layer value in both
places it is needed so the two provisions memoize onto the same volume
rather than building two that could drift.

The mechanics of the two seams — how to construct and provide each
double — are documented in
[Effect service doubles](../conventions/effect-service-doubles.md).

[^native-version-test]: `../../__test__/native-version.test.ts`
[^validate-builds-test]: `../../__test__/validate-builds.test.ts`
[^format-workspace-test]: `../../__test__/format-workspace.test.ts`
