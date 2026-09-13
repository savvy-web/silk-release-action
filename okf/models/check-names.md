---
type: DataModel
title: Check names
description: The five Phase-2 check names, used as a join key across findings, conclusions, and check-run rows.
resource: ../../src/release/validation-checks.ts
tags:
  - release
  - observability
sources:
  - id: validation-checks
    resource: ../../src/release/validation-checks.ts
  - id: derive-check-conclusion
    resource: ../../src/utils/derive-check-conclusion.ts
  - id: per-step-checks
    resource: ../../src/steps/per-step-checks.ts
  - id: publish-validation
    resource: ../../src/steps/publish-validation.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 26ef27629d8ad869443a3afe1f157cb216465cf54141f2c49eacdbece40ab593
status: draft
---

# Check names

`CHECK_NAMES` (`../../src/release/validation-checks.ts:50-56`) is the array
of five string literals Phase 2 reports about, in report order:

1. `Link Issues from Commits`
2. `Build Validation`
3. `Publish Validation`
4. `Release Notes Preview`
5. `SBOM Preview`

## What an entry is

An entry is not a display label — it is a **join key**. A
`ValidationFinding` carries a `check` field that must equal one of these five
strings exactly for the finding to be associated with its row.
`deriveCheckConclusion`[^derive-check-conclusion] filters findings with
`findings.filter((f) => f.check === checkName)`
(`../../src/utils/derive-check-conclusion.ts:61`), and
`BUILD_INDEPENDENT_CHECKS` (`../../src/utils/derive-check-conclusion.ts:34`,
the set `{"Build Validation", "Link Issues from Commits"}`) matches on the
same literal strings to decide which two checks are exempt from the
build-failed cascade.

A second, narrower copy of the vocabulary exists in `per-step-checks.ts`:
`PER_STEP_CHECK_NAMES = ["Publish Validation", "Release Notes Preview",
"SBOM Preview"]` (`../../src/steps/per-step-checks.ts:73`) — the three
checks that get their own per-step check run, matched against `CHECK_NAMES`
by module-doc comment rather than by import.

## What derives from an entry

Everything Phase 2 reports about release health reads off these five names:

- **Per-check conclusions.** `deriveValidationChecks`'s `conclusionFor`
  closure (`../../src/release/validation-checks.ts:135-136`) calls
  `deriveCheckConclusion(checkName, findings, buildPassed, strictWarnings)`
  for each name to produce a `"success" | "failure" | "neutral"` verdict.
- **Checks-table rows.** The `rows` array
  (`../../src/release/validation-checks.ts:208-239`) has one row per name,
  each carrying a `status` computed by `statusFor` from findings scoped to
  that name.
- **`results` / `summaryLine`.** The per-check `results` array
  (`../../src/release/validation-checks.ts:154-183`) and the closing
  `summaryLine` (`../../src/release/validation-checks.ts:242-248`, e.g.
  `Release validation: ✅ 5/5 checks passed`) are both keyed off the same
  five names and their derived `success` booleans.
- **The per-step check runs.** `per-step-checks.ts` creates one GitHub check
  run per entry in `PER_STEP_CHECK_NAMES`, so the check run's title must
  match the name a finding targets or the run's conclusion and the finding
  it should reflect fall out of step.
- **`crashedPublishValidation` findings.** When `runValidation` throws inside
  the publish-validation step, `crashedPublishValidation(message)`
  (`../../src/steps/publish-validation.ts:158-161`) synthesizes one
  `error`-severity finding per name in `PER_STEP_CHECK_NAMES`, each carrying
  `check: <name>` copied verbatim from the constant — never a re-typed
  literal.

## What breaks if an entry is wrong

**A name renamed in `CHECK_NAMES` without renaming the finding that targets
it silently detaches the finding from its check.** The row's `statusFor`
lookup finds no findings scoped to the now-mismatched name, so the
checks-table icon and `conclusionFor` both report `pass`/`success` — while
the finding itself, carrying the old name, still appears in the structured
JSON output. The release verdict goes green for a check that actually
failed, and the only trace is a finding whose `check` field no longer
matches any row. This is the same class of bug `deriveCheckConclusion`'s
build-failed cascade exists to guard against for the crash case: the
conclusion and the findings must stay joined on the same literal strings, or
whichever one nobody is reading wins silently.

[^derive-check-conclusion]: `../../src/utils/derive-check-conclusion.ts`
