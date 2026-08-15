---
"@savvy-web/silk-release-action": minor
---

## Bug Fixes

### A crashed publish validation now fails the release PR instead of reporting ✅ 5/5

When Phase 2's `runValidation` threw, the release PR reported **`Release validation: ✅ 5/5 checks passed`** — with no publish dry-run, no SBOM check and no release-notes preview having run ([#216](https://github.com/savvy-web/silk-release-action/issues/216)). The only trace was a single warning in the job log, and `strict-warnings` did not help, because there was no warning to escalate.

The crash degraded into the same quiet result the build-failed path uses. That baseline is correct *there* — a failed build already raises its own finding, and `deriveCheckConclusion`'s build-failed cascade already reports every downstream row red. But the cascade is gated on the build having failed, so on a crash, where the build genuinely **passed**, nothing fired and nothing spoke.

A crash now returns a distinct result carrying an `error` finding for each check it took down — `Publish Validation`, `Release Notes Preview` and `SBOM Preview` — so those rows report red and the check runs conclude `failure`. The crash message travels with the findings, so the reason is visible on the release PR rather than only in the job log. The three summary lines say `did not run (crashed)` instead of printing a ✅ derived from an unset default.

Two things deliberately unchanged:

* **The shared baseline keeps `publishOk: true`.** Flipping it would have fixed this path and broken the other one, double-counting the build failure on every failed-build run. The fix adds a finding instead, because findings are the only input the verdict reads.
* **A defect still kills the phase.** `Effect.catch` was not widened to `catchCause` — that remains the one path where a broken validation fails the run outright, rather than being routed into a degraded result.

Only the crash path changed. A build-failed run, and a validation that runs and passes or fails normally, all behave exactly as before.

## Maintenance

### The characterization tests for this path now assert the fix

The suite carried `CHARACTERIZATION` tests that pinned the green-on-crash behaviour deliberately, written to fail when the fix landed. They did, and were converted to assert the true behaviour per their own instructions rather than deleted.

One block in `validation-checks.test.ts` had been exercising the quiet baseline together with a passing build — a combination that is now unreachable in production — so it was re-pointed at the real crash result. A new test pins that the fix does not touch `Build Validation` or `Link Issues from Commits`, which degrade on their own terms.

Both directions are mutation-verified: removing the findings turns four tests red, and removing the crash log branch turns one red.

**The remaining Phase-2 degradation paths are still live** and still pinned: a crashed issue-linking step, a check run that could not be created, a failed comment write, and a failed pull-request lookup. `CLAUDE.md` and the design docs now say which path is fixed and which are not, rather than describing the whole family as an open defect.
