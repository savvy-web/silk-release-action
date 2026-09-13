---
type: Convention
title: Use it.effect for a one-for-one Effect test, plain it() for the four exceptions
description: Run an Effect test through it.effect + Effect.gen when the translation is one-for-one; keep plain it() when the test has no Effect, observes the real console, restores a global in a finally, uses fake timers, or asserts rejects.toThrow().
tags:
  - testing
stale_after: "2026-12-13T00:00:00Z"
sources:
  - id: auto-merge-test
    resource: ../../__test__/auto-merge.test.ts
  - id: effect-vitest-doc
    resource: ../../__test__/CLAUDE.effect-vitest.md
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 5700d0b7b93122ff809dc93e00f60435ac20489574ea7cd2f5e3838c9eeeafe2
status: draft
---

# Use it.effect for a one-for-one Effect test, plain it() for the four exceptions

Use `it.effect` with `Effect.gen` from `@effect/vitest` when a test runs
an Effect and the translation from a plain `it()` body is one-for-one —
`Effect.runPromiseExit(x)` becomes `yield* Effect.exit(x)`, the same
`Exit` value, so an assertion like `expect(exit._tag).toBe("Failure")`
carries over unchanged. `@effect/vitest` re-exports the rest of Vitest
(`describe`, `expect`, `vi`), so importing `it` from it does not force a
second import source.

Eleven files in this repository call `it.effect` today, verified by
grepping the tree rather than trusting a stated count:
`schema-outputs.test.ts`, `schema-inputs.test.ts`, `auto-merge.test.ts`,
`managed-sections.test.ts`, `update-sticky-comment.test.ts`,
`unit/release/publish.test.ts`, `unit/release/releases.test.ts`,
`unit/utilities/sort-releases-topologically.test.ts`,
`unit/release/validation.test.ts`, `unit/utilities/custom-registries.test.ts`,
and `integration/publishability.int.test.ts`. A single file may mix both
runners — `auto-merge.test.ts` calls `it.effect` for most of its cases and
plain `it()` for the two `rejects.toThrow()` assertions below, all
imported from the same `@effect/vitest` module.[^auto-merge-test]

Keep plain `it()`, deliberately, in four cases:

1. **The test has no Effect in it.** Rewriting a pure-assertion suite to
   route through `it.effect` is churn with no behavioral benefit, and
   churn in a large diff is exactly where a real regression hides.
2. **The test observes the real console.** `it.effect` installs
   `TestConsole`, which intercepts the same `ConsoleRef` that
   `ActionLogger` and Effect's default logger write through, so a
   `vi.spyOn(console, "log")` captures nothing under it. This fails
   loudly only when the assertion is positive (asserting output was
   captured); an assertion of "no output in quiet mode" would pass while
   capturing nothing regardless. `Logger.layer([])` is unaffected, since
   it stops the write before the `ConsoleRef` — a suite using that
   pattern migrates cleanly.
3. **Cleanup restores a process global in a `finally`.** An Effect that
   exits through its error channel does not run a `finally` clause the
   way the surrounding syntax suggests, so a `console.log` patch or a
   `process.chdir` call restored that way leaks into the next test.
   Converting a suite like this needs `Effect.acquireUseRelease` — a
   semantics change, not a mechanical runner swap.
4. **The assertion is `await expect(...).rejects.toThrow()`.** This
   asserts only that the promise rejected. Narrowing an `Exit` value
   instead — the `it.effect` equivalent — asserts something different
   (which failure, and why), so keep the original assertion rather than
   changing what is being tested under the guise of a runner migration.

`it.effect` always installs a virtual `TestClock`, so a suite driving a
real `Effect.sleep` backoff hangs to the Vitest timeout under it with no
message naming the clock; that is a fifth reason a specific suite may
stay on plain `it()` with fake timers, distinct from the four above.

Import `vi` from `"vitest"` directly, never through `@effect/vitest`.
Vitest hoists `vi.mock(...)` calls above all imports at the module level;
a binding re-exported through `@effect/vitest` is not yet initialized at
that point, and the file dies at load with
`Cannot access '__vi_import_1__' before initialization`, naming neither
`vi` nor the package that needs fixing.

A plain `it(() => Effect.gen(...))` — an Effect value returned from a
plain `it()` callback and never run — reports green with zero assertions
evaluated. This is the failure mode `it.effect` exists to prevent; write
`it.effect(() => Effect.gen(...))` whenever the body is an Effect.

[^auto-merge-test]: `../../__test__/auto-merge.test.ts`
