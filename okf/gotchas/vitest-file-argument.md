---
type: Gotcha
title: A vitest CLI file argument does not filter the run
description: "`vitest run some.test.ts` looks like it scoped the run to one file; it runs the whole suite instead, because projects come from a plugin, not the config's file list."
resource: ../../vitest.config.ts
tags:
  - testing
  - dx
stale_after: "2026-12-13T00:00:00Z"
sources:
  - id: vitest-config
    resource: ../../vitest.config.ts
  - id: test-placement
    resource: ../../__test__/test-placement.test.ts
  - id: check-test-collection
    resource: ../../scripts/check-test-collection.mjs
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: d6903694f731b575f89ed71f1f6f1b06527a4074135a37d8bc4dcc4766aaf475
status: draft
---

# A vitest CLI file argument does not filter the run

## What a reader sees

Running `vitest run some.test.ts` (or any positional file argument)
appears to scope the run to that one file, the way a plain Vitest project
would behave, and a `*.test.ts` file dropped into `__test__/utils/`
appears to be a normal addition to the suite.

## Wrong conclusion

"The filter worked — only my file ran" when a positional argument is
passed, or "my test passed" (or even "my test exists in the suite") for
anything placed under `__test__/utils/`.

## What is true

`vitest.config.ts` discovers its projects and tags through
`AgentPlugin.discover()` from `@vitest-agent/plugin`, not through an
enumerated file list in the config.[^vitest-config] A positional CLI file
argument does not filter that discovery to a single file — to scope a
run, use the vitest-agent MCP `run_tests` tool with a `files` array
instead.

Separately, and for a different reason, a directory named `utils`
anywhere in a test's path — including `__test__/utils/` — is never
collected by that same discovery, at any depth. A `*.test.ts` file placed
there does not run, and nothing reports that it did not; the only visible
signal is the collected test count going down, which a green run never
surfaces on its own. `--pass-with-no-tests` (set on `pnpm test`)
compounds this: collecting zero suites also exits `0`.

Two guards exist because neither alone would have caught every
regression: `__test__/test-placement.test.ts` walks the repository and
fails if any `*.test.ts` sits under `src/**`, outside `__test__/`, or
under a directory named `utils` (or `fixtures` or `snapshots`) at any
depth;[^test-placement] `scripts/check-test-collection.mjs`
(`pnpm check:collection`, run as the first step of `pnpm ci:test`) asks
Vitest what it actually collected and diffs that against what exists on
disk, so it needs no hardcoded exclusion list and catches a discovery
rule nobody has documented yet.[^check-test-collection]

[^vitest-config]: `../../vitest.config.ts`
[^test-placement]: `../../__test__/test-placement.test.ts`
[^check-test-collection]: `../../scripts/check-test-collection.mjs`
