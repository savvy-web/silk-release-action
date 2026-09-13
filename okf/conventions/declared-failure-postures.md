---
type: Convention
title: State a steps/ module's failure posture in its docs and its error channel
description: Every steps/ module must declare its failure posture in its module docs and encode it in its error channel; never state one without the other.
tags:
  - architecture
  - observability
stale_after: "2026-12-13T00:00:00Z"
sources:
  - id: steps-dir
    resource: ../../src/steps
  - id: write-sections
    resource: ../../src/utils/write-sections.ts
  - id: managed-sections-test
    resource: ../../__test__/managed-sections.test.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: b8b161e674b3ddac233d503f29dfb5f3f31e332c729e1201259d9c3baffc2535
status: draft
---

# State a steps/ module's failure posture in its docs and its error channel

Give every module under `src/steps/` a `@remarks` block in its module doc
comment that names its failure posture as one of **fail-the-job** or a
degrading posture, and make the error channel say the same thing: `never`
in the error channel means the step degrades, and anything else means an
uncaught error propagates and fails the job. State the posture in only one
place and it drifts from the other; state it in both and a reviewer can
check them against each other.[^steps-dir]

`never` alone is not a posture. A degrading step must also say whether it
**contributes a finding** — visible in the Phase-2 verdict, because
`deriveCheckConclusion` reads findings and nothing else — or degrades to a
warning that nothing downstream reads. Where the degradation is invisible
(the effect is silently absorbed with no reporting trace), say so
explicitly in the module doc and link the characterization test that pins
it, so a reader does not have to rediscover the gap by reading the test
suite.

Never widen `Effect.catch` to `catchCause` in a `steps/` module. A defect
killing the phase is the last honest failure signal available; catching a
defect the same way as a typed error turns a crash into a silent
degradation with no distinguishing trace.

Reporting writes are never gates. `withSection`'s `publish` callback is
typed as infallible for exactly this reason: a finalizer that could fail
on the way out of a write would replace the caller's real error with a
reporting error, hiding the failure that actually mattered.[^write-sections]

## Current posture table

| Module | Phase | Failure posture |
| --- | --- | --- |
| `steps/branch-management.ts` | 1 | fail-the-job; constructs no error of its own |
| `steps/publish-release-plan.ts` | 1 | degrade-to-warning (`withReleasePlanSection` combinator) |
| `steps/validation.ts` | 2 | fail-the-job, with check-run cleanup; errors re-raised untouched |
| `steps/link-issues.ts` | 2 | degrade-to-warning — invisible downstream |
| `steps/build-validation.ts` | 2 | degrade-to-warning — visible; a failed build reports `success: false` and cascades onto every dependent row |
| `steps/publish-validation.ts` | 2 | degrade-with-a-finding — visible; a quiet skip when the build already failed, an `error` finding per affected check when the dry-run itself crashes |
| `steps/per-step-checks.ts` | 2 | degrade-to-warning — invisible downstream |
| `steps/publish-validation-report.ts` | 2 | degrade-to-warning — invisible downstream |
| `steps/publishing.ts` | 3 | fail-the-job; raises a typed error rather than returning |
| `steps/close-issues.ts` | 3a | fail-the-job; a missing PR number in the event payload is a skip, not a failure |

`steps/publish-validation.ts` is the fixed example: a crash during the
publish dry-run now returns a result carrying an `error` finding per
affected check, rather than reporting a green ✅ 5/5 for validation that
never ran. `steps/link-issues.ts`, `steps/per-step-checks.ts` and
`steps/publish-validation-report.ts` remain outstanding: each degrades to
a warning that contributes no finding, so a failure inside any of the
three is currently invisible in the phase's verdict.

See [Degraded steps contribute findings, not booleans](../decisions/degraded-steps-contribute-findings.md)
for why a finding rather than a boolean flip is the fix, and
[Phase-2 degradation is silent for issue-linking, check creation, and comment/PR-lookup writes](../gotchas/phase-2-silent-degradation.md)
for what a reader currently sees on each of the three outstanding paths.

[^steps-dir]: `../../src/steps`
[^write-sections]: `../../src/utils/write-sections.ts`
