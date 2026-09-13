---
type: Gotcha
title: A green suite says nothing about `runValidation`'s own wiring
description: High Phase-2 test coverage looks like proof the validation orchestration is tested, but no test executes steps/validation.ts's body — only the six modules it calls.
resource: ../../src/steps/validation.ts
tags:
  - testing
stale_after: "2026-12-13T00:00:00Z"
sources:
  - id: validation-step
    resource: ../../src/steps/validation.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 89fd3a6b23bc1ba80985951cf2cee2824d8efc77e07ce994c5e1247994b934e6
status: draft
---

# A green suite says nothing about `runValidation`'s own wiring

## What a reader sees

`pnpm ci:test` passes green with high coverage across the Phase-2 test
files — `link-issues-and-build-steps.test.ts`, `validate-builds.test.ts`,
`publish-validation.test.ts`, `validation-checks.test.ts`,
`per-step-checks.test.ts`, `publish-validation-report.test.ts` — every one
of them exercising a module `runValidation` in
`src/steps/validation.ts`[^validation-step] calls.

## Wrong conclusion

That the Phase-2 orchestration itself — the wiring in `runValidation`
that decides what those six modules are called with, in what order, and
how their results are folded together — is under test.

## What is true

No test imports or executes `runValidation` from
`src/steps/validation.ts` directly (confirmed against the tree: no
`__test__` file references `steps/validation` by path). The suite's
green, high-coverage result reflects only the six extracted modules the
body calls, never the orchestrating body itself. Replacing that body's
implementation wholesale with `Effect.die` would still leave the suite
green, because nothing calls it to notice. `steps/validation.ts` states
this uncovered-orchestration gap in its own module documentation.

[^validation-step]: `../../src/steps/validation.ts`
</content>
