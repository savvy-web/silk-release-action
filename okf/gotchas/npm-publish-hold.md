---
type: Gotcha
title: A green publish can still 404 for minutes on npm
description: "`npm view name@version` returning E404 minutes after a green Phase-3 run, or a downstream workflow failing with ERR_PNPM_NO_MATCHING_VERSION, looks like the publish failed or the action lied — it did not; npm is holding the version for publish-time malware scanning."
resource: ../../src/steps/confirm-availability.ts
tags:
  - release
  - github
  - ci
  - observability
stale_after: "2026-12-18T00:00:00Z"
sources:
  - id: confirm-availability-ts
    resource: ../../src/steps/confirm-availability.ts
  - id: confirm-availability-test
    resource: ../../__test__/confirm-availability.test.ts
  - id: issue-301
    resource: "https://github.com/savvy-web/silk-release-action/issues/301"
  - id: silk-update-retry-unmatched
    resource: "https://github.com/savvy-web/silk-update-action"
  - id: npm-malware-scanning-changelog
    resource: "https://github.blog/changelog/2026-07-28-npm-publish-time-malware-scanning-and-dual-use-metadata/"
  - id: silk-runtime-run-105244177242
    resource: "https://github.com/savvy-web/silk-runtime-action/actions/runs/35233728336/job/105244177242"
generated:
  by: okfit/claude-code
  at: 2026-09-19T01:03:58Z
  body_sha256: 2d00ba68057a988884e36c17f0c67801be3498dd8002b1920f88f178a03c0e76
status: draft
---

# A green publish can still 404 for minutes on npm

## What a reader sees

Phase 3 finished green: the GitHub release is published, the check run is
✅, and `result.success` is `true`. Minutes later, `npm view
name@version` on that exact version returns `E404`, or a downstream
workflow triggered right after the release fails with
`ERR_PNPM_NO_MATCHING_VERSION No matching version found for
name@^x.y.z`.[^silk-runtime-run-105244177242]

## Wrong conclusion

That the publish silently failed despite the green run, that the action
reported success it did not earn, or that the downstream consumer's
lockfile or version range is broken.

## What is true

npm's publish-time malware scan, announced 2026-07-28, holds a newly
published version back from being served for some window after the
`200` response `npm publish` receives.[^npm-malware-scanning-changelog]
The hold is observed bimodal: usually resolved in under three minutes
when it triggers at all, but at least once over twelve hours. Most
publishes are not held at all. A downstream job dispatched immediately
after the release — exactly the shape of `silk-update-action` reacting
to a new version — lands inside that window and gets
`ERR_PNPM_NO_MATCHING_VERSION` even though the version is genuinely
published and will resolve shortly.[^silk-runtime-run-105244177242]

This action's guard is `src/steps/confirm-availability.ts`: after
`runReleases`, every successfully published npm target is polled for its
exact `name@version` until it resolves or the `registry-confirm-timeout`
input's ceiling elapses (default 180s, `0`
disables).[^confirm-availability-ts] The result is reported, never
hidden and never used to fail the run — a hold does not change `success`
or `outcome`, because the package genuinely is published. Per package,
`available: boolean` and `availability.status` distinguish `confirmed`
from `held` (and `skipped` for non-npm targets, dry-run, or ceiling `0`);
at the top level, `totals.packagesHeld` counts them and a non-zero count
appends `· N package(s) held by the registry` to the phase
summary.[^confirm-availability-ts] A green run with
`totals.packagesHeld > 0` is still a real release — it means the bytes
landed and the registry has not started serving them yet, not that
anything needs to be redone.

A consumer wiring a follow-on dispatch on this action's output — notably
the shared release workflow's `packages-released` trigger — should gate
on `totals.packagesHeld === 0` rather than on `success` alone, to avoid
firing into the same window this action's own probe exists to detect.
`silk-update-action` mitigates the same failure mode from the consumer
side with a `retry-unmatched` input rather than waiting on the
publisher.[^silk-update-retry-unmatched] Issue
[#301](https://github.com/savvy-web/silk-release-action/issues/301)
tracks this end to end.

[^confirm-availability-ts]: `../../src/steps/confirm-availability.ts`
[^silk-update-retry-unmatched]: `https://github.com/savvy-web/silk-update-action`
[^npm-malware-scanning-changelog]: `https://github.blog/changelog/2026-07-28-npm-publish-time-malware-scanning-and-dual-use-metadata/`
[^silk-runtime-run-105244177242]: `https://github.com/savvy-web/silk-runtime-action/actions/runs/35233728336/job/105244177242`
