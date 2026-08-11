# __test__/CLAUDE.effect-vitest.md

Which test runner a suite uses, and why.

__See also:__ [__test__/CLAUDE.md](./CLAUDE.md)

Load when migrating a suite to `it.effect`, when a migrated test hangs to the Vitest timeout, or when a console/timer assertion stops observing anything.

## `@effect/vitest` — `it.effect` vs plain `it()`

Ten files run Effects through `it.effect` from `@effect/vitest` (which re-exports all of Vitest,
so `describe`/`expect`/`vi` come from the same import). The rest is deliberately still on plain
`vitest`. __The split is a rule, not an accident of how far a migration got.__

__Use `it.effect` + `Effect.gen` when the test runs an Effect__ and the translation is
one-for-one. `Effect.runPromiseExit(x)` becomes `yield* Effect.exit(x)` — same `Exit`, so
`expect(exit._tag).toBe("Failure")` carries over unchanged.

```typescript
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

it.effect("does the thing", () =>
  Effect.gen(function* () {
    const result = yield* subject().pipe(Effect.provide(testLayer));
    expect(result).toBe("expected");
  }),
);
```

__Keep plain `it()` in these four cases.__ Each has bitten this repo:

1. __The test has no Effect in it.__ Most of `report.test.ts`, `pr-body.test.ts`,
   `validation-checks.test.ts` and the other pure-assertion suites. Rewriting them is churn, and
   churn in a large diff is where a regression hides.

2. __The test observes the real console.__ ⚠️ `it.effect` installs `TestConsole`, which
   intercepts the same `ConsoleRef` that `ActionLogger` (and Effect's default logger) writes
   through, so a `vi.spyOn(console, "log")` __captures nothing__. Two tests hit this —
   `releases.test.ts` ("BOTH SHAs") and `publish.test.ts` ("rich publish tree") — and both are
   annotated in place. They went red rather than silently green only because they assert
   __positively__; a test asserting "no output in quiet mode" would pass while capturing nothing.
   __`Logger.layer([])` is NOT affected__ — it stops the write before the ConsoleRef, which is why
   `update-sticky-comment.test.ts` and `sort-releases-topologically.test.ts` migrate cleanly.

3. __Cleanup restores a process global in a `finally`.__ An Effect that exits through the error
   channel does not run a `finally` the way the syntax suggests, so a `console.log` patch or a
   `process.chdir` leaks and poisons the __next__ test. `publish.test.ts`'s `runInCwd` helper and
   the two console tests stay on `async`/`await` for this reason. Converting them needs
   `Effect.acquireUseRelease` — a semantics change, not a runner swap.

4. __The assertion is `await expect(...).rejects.toThrow()`.__ It asserts only that the promise
   rejected; narrowing an `Exit` instead changes *what* is asserted. See `auto-merge.test.ts`.

__`it.effect` with a non-Effect body is wrong but not silent__ — the body still runs and its
assertions still throw (probed 2026-08-05). The genuinely silent shape is the inverse,
`it("...", () => Effect.gen(...))` — an Effect returned and never run, reporting green with
__zero assertions evaluated__. There are none in this repo; keep it that way.

### Time and `it.effect` do not mix here

`it.effect` always installs a virtual `TestClock`, so a real `Effect.sleep` under the test stops
advancing and the test hangs to the Vitest timeout with no message naming the clock.

__`native-version.test.ts` and `detect-workflow-phase.test.ts` are deliberately NOT migrated.__
Both drive real `Effect.sleep` backoffs in `src` with fake timers and a fire-then-advance promise
dance. Moving them to `TestClock` needs a forked fiber that has reached the sleep before the clock
advances — the ordering raciness `native-version.test.ts` already documents as the reason it
spends a real second. Leave them.
