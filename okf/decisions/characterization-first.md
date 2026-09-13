---
type: Decision
title: Pin known-wrong behaviour with characterization tests before fixing it
description: A test pinning a known bug is written to fail when the fix lands, named to the issue it pins, and converted rather than deleted once the fix ships.
status: draft
tags:
  - testing
sources:
  - id: link-issues-and-build-steps-test
    resource: ../../__test__/link-issues-and-build-steps.test.ts
  - id: per-step-checks-test
    resource: ../../__test__/per-step-checks.test.ts
  - id: publish-validation-report-test
    resource: ../../__test__/publish-validation-report.test.ts
  - id: validation-checks-test
    resource: ../../__test__/validation-checks.test.ts
  - id: publish-validation-test
    resource: ../../__test__/publish-validation.test.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 9638957d145091e70e59fbbd5e99829766e73743ab474a38931a71bfb484e196
---

# Pin known-wrong behaviour with characterization tests before fixing it

## Context

Issue #216 spans several degradation paths across five modules. These
paths received their first-ever coverage in the `main.ts` split: the
logic had lived inline in a large orchestrator no test executed, to the
point that replacing the whole body with `Effect.die` would have left
the suite green. Fixing every path and writing its tests in one change
would produce a diff where nobody could tell which assertions describe
the old behaviour and which describe the new.

## Decision

A test that pins known-wrong behaviour is marked `CHARACTERIZATION`,
names the issue it pins, states in a comment what it will look like once
fixed, and is written to fail — not pass — when that fix lands. It pins
what the code does today, never what it should do; where the two differ,
the test still asserts today's behaviour and says so.

Ten such cases exist across four files today, count taken as
`it("CHARACTERIZATION` titles rather than a raw grep (which also matches
each file's block comment and unrelated notes, roughly doubling the
count): `link-issues-and-build-steps.test.ts` pins 2 — a degrade-to-
warning invisible downstream (`LINK_ISSUES_FAILED`) beside build
validation's honest degradation;[^link-issues-and-build-steps-test]
`per-step-checks.test.ts` pins 2 — a check run that could not be created
yielding `""` → a `null` row URL indistinguishable from "no page yet",
and a row linking to a check stuck `in_progress`;[^per-step-checks-test]
`publish-validation-report.test.ts` pins 3 — a failed comment write
contributing no finding, a failed PR lookup reported identically to
"there is no release PR", and one unrelated pin that a rehearsal still
writes to the real pull request;[^publish-validation-report-test] and
`validation-checks.test.ts` pins 3 that are not about degradation at
all — the Build row bypassing the strict-warnings rule, `checkId` being
write-only, and the icon ignoring strict-warnings while the conclusion
honours it.[^validation-checks-test]

When the fix for a pinned path lands, its test is converted, not
deleted: the assertion becomes the one that describes the new, correct
behaviour, so a reviewer can read the old expectation and the new one in
the same test body.

## Alternatives rejected

**Fixing the behaviour and writing tests for it in the same change.**
This produces a diff where a reviewer cannot separate "this assertion
describes what used to happen" from "this assertion describes what
happens now" — exactly the ambiguity the decision avoids by pinning
first, in a separate, reviewable step.

**Deleting a characterization test once its bug is fixed, rather than
converting it.** Deleting would discard the regression coverage the pin
already represents. The publish-validation crash path's conversion is
the worked example: its `CHARACTERIZATION` test became the assertion it
was written to become when the fix landed, and `SKIPPED_PUBLISH_VALIDATION`'s
`publishOk: true` baseline is still asserted — re-aimed at the
build-failed path it is now only ever reached from, kept deliberately
quiet because flipping it would double-count the build-failed
finding.[^publish-validation-test]

## Consequences

The publish-validation fix proved this discipline works, and did so in
both directions: stripping the crash findings from the fixed code turns
4 tests red, and removing the crash-log branch (`❌ … did not run
(crashed)` in place of the `publishOk` ternary that would have printed
`✅` for a dry run that never happened) turns 1 test red.[^publish-validation-test]
More significantly, the exercise showed that issue #216 is **one
decision, not a patch per path**: a degraded step must contribute a
*finding*, because a finding is the only thing the Phase-2 verdict
reads — see
[Degraded steps contribute findings, not booleans](degraded-steps-contribute-findings.md).
The remaining 7 pins across `link-issues-and-build-steps.test.ts`,
`per-step-checks.test.ts`, and `publish-validation-report.test.ts` stay
unchanged and still name the issue; see
[Phase 2 reports a green verdict for work that never ran](../gotchas/phase-2-silent-degradation.md)
for what each one pins. The term this decision relies on is defined at
[Characterization test](../glossary/characterization-test.md).

[^link-issues-and-build-steps-test]: `../../__test__/link-issues-and-build-steps.test.ts`
[^per-step-checks-test]: `../../__test__/per-step-checks.test.ts`
[^publish-validation-report-test]: `../../__test__/publish-validation-report.test.ts`
[^validation-checks-test]: `../../__test__/validation-checks.test.ts`
[^publish-validation-test]: `../../__test__/publish-validation.test.ts`
