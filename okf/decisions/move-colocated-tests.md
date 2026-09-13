---
type: Decision
title: No test lives under src/ — one location plus a mirrored unit/ subtree
description: Every test lives at or below __test__/, mirroring source paths under __test__/unit/, with a placement guard making the rule executable instead of a convention nobody could state.
status: draft
tags:
  - testing
  - dx
sources:
  - id: test-placement-test
    resource: ../../__test__/test-placement.test.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 323662f2204670d406a296d6b21dfdc184b93bd1f724110d1cc1388ec63ed8f7
---

# No test lives under src/ — one location plus a mirrored unit/ subtree

## Context

Co-located `src/**/*.test.ts` files sat in the same tree the coverage
config scans and the schema-sync guard walks, and the split between
"co-located Phase-3 tests" and "everything else in `__test__/`" was a
historical accident nobody could state a rule for.

## Decision

No test lives under `src/`. Every `*.test.ts` in the repository lives at
or below `__test__/`: `__test__/unit/` mirrors the source layout
(`unit/release/`, `unit/utilities/`, `unit/program.test.ts`), older flat
suites stay directly in `__test__/`, and integration tests live in
`__test__/integration/` with fixture workspaces under
`integration/fixtures/`.

`__test__/test-placement.test.ts` makes this rule executable rather than
merely documented, because the failure mode it guards against is
invisible on its own: a directory named `utils` is never collected by
the project-discovery plugin, at any depth, so a `*.test.ts` file dropped
there does not run and nothing reports that it did not — the only signal
is the collected count going down, which no green run surfaces. The
guard asserts four things by walking the repository tree directly:
no `*.test.ts` sits under `src/**`; none sits under a directory named
`utils`, `fixtures`, or `snapshots` at any depth; every `*.test.ts` file
lives at or below `__test__/`; and the walker itself sees more than 20
files, so a broken walker cannot pass vacuously by finding
nothing.[^test-placement-test]

## Alternatives rejected

**Leaving the co-located/`__test__/` split as an unstated convention.**
This was the prior state, and it produced exactly the ambiguity the
decision closes: nobody could point to a rule that said which tests
belonged where, so the split drifted further with each new suite added
to either side.

**Trusting a written convention without an executable guard.** A
placement rule stated only in a CLAUDE.md or design doc would not have
caught the `utils`-directory exclusion regression this repo actually
hit: five suites and 60 cases stopped running with nothing red when the
discovery plugin's exclusion pattern widened from the literal prefix
`__test__/utils/` to the directory name `utils` at any depth, catching
`__test__/unit/utils/` with it (issue #237). A guard that walks the tree
and asserts on directory names at every depth is what survives that kind
of widening; a written rule alone would not have.

## Consequences

The placement guard is one of two independent checks, and both are
required because neither alone would catch every regression:
`test-placement.test.ts` walks the tree and asserts on names it already
knows about, while `scripts/check-test-collection.mjs`
(`pnpm check:collection`, the first step of `pnpm ci:test`) asks Vitest
what it actually collected and diffs that against what exists on disk —
needing no hardcoded exclusion list, so it catches an exclusion rule
nobody has learned about yet. The CLI-file-argument trap this guards
alongside is documented separately in
[A vitest CLI file argument does not filter the run](../gotchas/vitest-file-argument.md).
The convention itself — mirror `src/` under `__test__/unit/`, keep
helpers out of any directory named `utils` — is stated in full in
[Test placement](../conventions/test-placement.md).

[^test-placement-test]: `../../__test__/test-placement.test.ts`
