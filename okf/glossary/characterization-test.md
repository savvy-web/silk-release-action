---
type: Glossary
title: characterization test
description: A test marked CHARACTERIZATION that pins what the code does today rather than what it should do, names the issue, and is written to fail — not to be deleted — when the fix lands.
tags:
  - testing
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 7e22a7315711c03525faeaa70795e7f5fd40876808a9377e86e28263ce0819c0
sources:
  - id: link-issues-test
    resource: ../../__test__/link-issues-and-build-steps.test.ts
  - id: per-step-checks-test
    resource: ../../__test__/per-step-checks.test.ts
  - id: publish-validation-report-test
    resource: ../../__test__/publish-validation-report.test.ts
  - id: validation-checks-test
    resource: ../../__test__/validation-checks.test.ts
  - id: publish-validation-test
    resource: ../../__test__/publish-validation.test.ts
---

# characterization test

As this repository uses the term, a characterization test is a test case
marked `CHARACTERIZATION` in its title or a comment beside it that pins
**what the code does today, not what it should do**. Where the two differ,
the test still asserts today's behaviour, says so in a comment naming the
issue it is pinning, and is deliberately written to fail the moment the fix
lands — the test is a tripwire for a regression fix, not a spec for correct
behaviour.

A characterization test is **converted, not deleted**, once its fix lands:
the assertion it pinned is rewritten to the new, correct expectation in
place, so a reviewer can read the old behaviour and the new one side by side
in the same test body. `publish-validation.test.ts` no longer carries a
`CHARACTERIZATION` test because the crash path it pinned (issue #216) was
fixed — its pins were rewritten to assert the fixed behaviour rather than
removed, and `validation-checks.test.ts`'s corresponding block is now a
true-behaviour block instead of a pin.[^publish-validation-test]

## Current inventory

10 test **cases**, across four files, carry the marker today (verified by
counting `it("CHARACTERIZATION` titles, not lines matched by a raw grep):

| File | Cases | What it pins |
| --- | --- | --- |
| `link-issues-and-build-steps.test.ts` | 2 | A degrade-to-warning that is invisible downstream (`LINK_ISSUES_FAILED`), beside build validation's honest degradation |
| `per-step-checks.test.ts` | 2 | A check run that could not be created yielding `""` → a `null` row URL, indistinguishable from "no page yet"; and a row linking to a check stuck `in_progress` |
| `publish-validation-report.test.ts` | 3 | A failed comment write contributing no finding; a failed PR *lookup* reported identically to "there is no release PR"; plus one unrelated pin, that a rehearsal still writes to the real pull request |
| `validation-checks.test.ts` | 3 | None of them degradation: the Build row bypassing the strict-warnings rule, `checkId` being write-only, and the icon ignoring strict-warnings while the conclusion honours it |

7 of the 10 pin the live degradation paths behind
[Phase-2 silent degradation](../gotchas/phase-2-silent-degradation.md)
(issue #216); the other 3, in `validation-checks.test.ts`, pin adjacent
reporting oddities unrelated to that issue.

## The counting trap

A raw `grep -c CHARACTERIZATION __test__/*.test.ts` returns roughly twice
the true count of 10, because it also matches:

- each file's own block comment introducing its `CHARACTERIZATION` section,
- the two historical `Was \`CHARACTERIZATION — …\`` conversion notes left in
  `publish-validation.test.ts` recording that its pins were fixed and
  converted, and
- this very guidance, wherever it is repeated (a `CLAUDE.md`, a design doc,
  this concept).

Counting `it("CHARACTERIZATION` **titles** rather than grep lines gives the
true figure. Never "fix" a characterization test to make a grep total drop
— a test carrying the marker is deliberately red-on-fix, and shrinking the
count by editing the marker away, rather than by landing the fix it names,
hides the very regression the test exists to catch.

See [Characterization-first](../decisions/characterization-first.md) for
why this repository writes the pinning test before changing the behaviour
it pins, rather than fixing and testing in the same change.

[^publish-validation-test]: `../../__test__/publish-validation.test.ts`
