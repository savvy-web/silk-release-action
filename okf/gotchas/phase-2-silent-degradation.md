---
type: Gotcha
title: Phase 2 reports a green verdict for work that never ran
description: A release PR showing ✅ on every check and a green run does not mean issue linking, check-run creation, or the sticky comment write actually succeeded — three of the four Phase-2 degradation paths still degrade invisibly.
resource: ../../src/steps/link-issues.ts
tags:
  - observability
  - release
  - testing
stale_after: "2026-12-13T00:00:00Z"
sources:
  - id: link-issues-ts
    resource: ../../src/steps/link-issues.ts
  - id: per-step-checks-ts
    resource: ../../src/steps/per-step-checks.ts
  - id: publish-validation-report-ts
    resource: ../../src/steps/publish-validation-report.ts
  - id: link-issues-and-build-steps-test
    resource: ../../__test__/link-issues-and-build-steps.test.ts
  - id: per-step-checks-test
    resource: ../../__test__/per-step-checks.test.ts
  - id: publish-validation-report-test
    resource: ../../__test__/publish-validation-report.test.ts
  - id: issue-216
    resource: "https://github.com/savvy-web/silk-release-action/issues/216"
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 0b5bdb85cd23ce93a5fb7d1f5d4fa2433e8cb5a7160614889d7bf3d29d9167ab
status: draft
---

# Phase 2 reports a green verdict for work that never ran

## What a reader sees

A release PR with ✅ on every per-step check, a green unified check run,
and a job log that reads `✅ Link issues — 0 issue(s) linked`. Turning on
`strict-warnings`, the strictest available setting, changes nothing about
this picture.

## Wrong conclusion

That issue linking ran and found nothing to link, that every per-step
check run was created and is reachable at the URL shown (or absent
because there is genuinely no page yet), that the sticky comment on the
release PR was updated with the latest validation result, and that
`strict-warnings` would have caught it if any of that had actually
failed.

## What is true

When the build genuinely passed but a downstream Phase-2 step crashed,
several steps degrade to a default value that carries no failure signal
and contributes no *finding* — and findings are the only thing the
Phase-2 verdict reads. Three paths still do this, each pinned by its own
characterization tests, written to fail when their fix lands — do not
"fix" them by making them pass.

A crashed issue-linking step returns `LINK_ISSUES_FAILED`
(`linkedIssues: []`, `commits: []`, `checkId: 0`, `htmlUrl: ""`), which
`LinkIssuesResult` cannot distinguish from a successful run that
genuinely found zero issues to link. The log line is unconditionally
`✅ Link issues — 0 issue(s) linked`, printed two lines after a
`linkIssuesFailed: …` warning that only appears in the raw log, not in
any check or finding.[^link-issues-ts] Pinned by 2 cases in
`link-issues-and-build-steps.test.ts`.[^link-issues-and-build-steps-test]

A per-step check run that could not be created returns `""` from
`createPerStepCheck`, which the checks table turns into a `null` row
URL — indistinguishable from a row that legitimately has no page yet
because nothing failed.[^per-step-checks-ts] Pinned by 2 cases in
`per-step-checks.test.ts` — this same failure, plus a row that links to
a check stuck `in_progress` because its completion call failed
separately.[^per-step-checks-test]

A failed write to the release PR's sticky comment contributes no
finding at all, and a failed pull-request *lookup* is logged with the
exact same line — "Sticky comment update skipped — no open PR found for
release branch" — as the case where there genuinely is no open release
PR. `ValidationReportOutcome.lookupFailed` exists to make the two cases
distinguishable in code, but nothing downstream reads
it.[^publish-validation-report-ts] Pinned by cases in
`publish-validation-report.test.ts`.[^publish-validation-report-test]

`strict-warnings` cannot rescue any of this, because there is no warning
to escalate on these three paths — the degradation produces neither a
warning nor a finding, so the strictest available setting still reports
green. This is itself pinned as its own test, because "turn on
strict-warnings" is the obvious wrong fix to reach for. Symmetrically,
the one path that *is* fixed (a crashed publish-validation run) does not
depend on `strict-warnings` either: its `crashedPublishValidation`
findings are `error`-severity, which fails the row at any setting.

Issue [#216](https://github.com/savvy-web/silk-release-action/issues/216)
tracks all four Phase-2 degradation paths. The publish-validation crash
path is fixed; these three are not. The rule the fix established — a
degraded step must contribute a finding, since a finding is the only
thing the verdict reads — is
[Degraded steps contribute findings, not booleans](../decisions/degraded-steps-contribute-findings.md).
The pinning tests are
[Characterization tests](../glossary/characterization-test.md).

[^link-issues-ts]: `../../src/steps/link-issues.ts`
[^per-step-checks-ts]: `../../src/steps/per-step-checks.ts`
[^publish-validation-report-ts]: `../../src/steps/publish-validation-report.ts`
[^link-issues-and-build-steps-test]: `../../__test__/link-issues-and-build-steps.test.ts`
[^per-step-checks-test]: `../../__test__/per-step-checks.test.ts`
[^publish-validation-report-test]: `../../__test__/publish-validation-report.test.ts`
