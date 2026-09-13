---
type: Decision
title: A degraded Phase-2 step contributes a finding, never flips a boolean
description: Every degrading Phase-2 step must add a finding the verdict can read rather than silently reverting to a default, because findings are the only thing deriveCheckConclusion reads; the publish-validation crash path enforces this, the remaining steps do not yet.
status: draft
tags:
  - observability
  - release
  - testing
sources:
  - id: publish-validation
    resource: ../../src/steps/publish-validation.ts
  - id: validation-checks
    resource: ../../src/release/validation-checks.ts
  - id: derive-check-conclusion
    resource: ../../src/utils/derive-check-conclusion.ts
  - id: publish-validation-test
    resource: ../../__test__/publish-validation.test.ts
  - id: issue-216
    resource: https://github.com/savvy-web/silk-release-action/issues/216
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 8450c87424f8e97bb576f42191ae9b71cafebd52ee829c81489cd0ce6ee2e997
---

# A degraded Phase-2 step contributes a finding, never flips a boolean

## Context

`deriveCheckConclusion`[^derive-check-conclusion] derives every Phase-2
check-run conclusion purely from findings scoped to that check name, plus
one build-failed cascade: when `buildSuccess` is false, every
build-dependent check (everything except `Build Validation` and `Link
Issues from Commits`, which run independently of the build) reports
`failure` regardless of whether any finding names it. Outside that
cascade, a check with zero findings scoped to it reports `success` — full
stop. Findings are the only channel the verdict reads.

That makes a step's degradation path load-bearing: if a step that crashes
or is skipped simply falls back to a quiet default value — the shape it
would have produced on an ordinary, uneventful pass — the check reports
`success` for work that never ran. This is
[issue #216](https://github.com/savvy-web/silk-release-action/issues/216).
The publish-validation crash path is fixed; a crashed issue-linking step, a
check run that could not be created, a failed comment write, and a failed
pull-request lookup all still degrade silently, and remain pinned by ten
`CHARACTERIZATION` test cases across four files — 2 in
`link-issues-and-build-steps.test.ts`, 2 in `per-step-checks.test.ts`, 3 in
`publish-validation-report.test.ts`, and 3 adjacent reporting oddities in
`validation-checks.test.ts` — each written to fail when its own fix lands.

## Decision

Two rules, both load-bearing:

1. **A degraded step contributes a finding; it never flips a boolean.**
   `publish-validation.ts`'s fixed crash path is the worked example: on a
   build failure, `runValidation` never even runs, and the step returns
   `SKIPPED_PUBLISH_VALIDATION` quietly — the build's own finding already
   fails the phase, and the build-failed cascade in
   `deriveCheckConclusion` already covers every downstream row, so adding
   a second finding here would double-count the same failure. But when
   `runValidation` itself throws after the build succeeded, the step
   returns `crashedPublishValidation(message)`[^publish-validation]: the
   same `SKIPPED_PUBLISH_VALIDATION` baseline, spread untouched, plus one
   `error`-severity finding per name in
   `PER_STEP_CHECK_NAMES`[^validation-checks] (`"Publish Validation"`,
   `"Release Notes Preview"`, `"SBOM Preview"`), each carrying the crash
   message. Flipping a boolean like `publishOk` to `false` instead was
   considered and rejected: the build-failed path is already covered by
   its own cascade, so a boolean flip on the crash path would double-count
   a case the cascade does not even apply to, rather than adding the one
   new signal the crash path actually needs.
2. **Never widen `Effect.catch` to `catchCause`.** The crash path is
   reached by catching typed errors only; a genuine defect — as opposed to
   an error — still propagates and kills the phase outright. That is
   deliberate: a defect is the last honest failure signal available, and
   catching it to produce a tidy degraded finding would convert a
   currently-loud failure into a quiet one, the opposite direction issue
   #216 moves in.

## Alternatives rejected

**Flip `publishOk` (or an equivalent boolean) to `false` on every
degradation.** Rejected for the crash path specifically because the
build-failed path already has its own cascade in `deriveCheckConclusion`;
a boolean flip on the crash path would either duplicate that cascade's
effect where it already applies, or — worse — do nothing new where the
cascade does not apply, since nothing downstream reads `publishOk` as an
input to the per-check conclusion. Findings are the one channel the
verdict actually reads, so they are the one channel a fix can act through.

**Widening `Effect.catch` to `catchCause` so a defect also degrades to a
finding.** Rejected because it removes the one failure mode that still
fails loudly. A defect killing the phase outright is a stronger signal
than a finding buried in a checks table a reviewer might not open.

## Consequences

The crash path is fixed and its characterization tests were converted to
assert the fixed behavior rather than pin the bug
(`publish-validation.test.ts`[^publish-validation-test]); the crash log
line now reads "did not run (crashed)" rather than reusing the same
ternary that renders the build-failed case. `strict-warnings` neither
rescues the remaining silent-degradation paths nor is depended upon by this
fix — it escalates warning findings to failures, which only helps a step
that already contributes a finding at all.

The still-live paths — a crashed issue-linking step, an uncreatable check
run, a failed comment write, a failed pull-request lookup — remain
described in
[Phase-2 silent degradation](../gotchas/phase-2-silent-degradation.md),
each pinned by its own `CHARACTERIZATION` tests until it gets the same
treatment this decision documents for publish-validation. The general
imperative every `steps/` module now follows is stated in
[Declared failure postures](../conventions/declared-failure-postures.md);
the join-key discipline `PER_STEP_CHECK_NAMES` and `CHECK_NAMES` depend on
is described in [Check names](../models/check-names.md); the vocabulary for
what a `CHARACTERIZATION` test asserts and why it is written to fail on fix
is in [Characterization test](../glossary/characterization-test.md).

[^publish-validation]: ../../src/steps/publish-validation.ts
[^validation-checks]: ../../src/release/validation-checks.ts
[^derive-check-conclusion]: ../../src/utils/derive-check-conclusion.ts
[^publish-validation-test]: `../../__test__/publish-validation.test.ts`
