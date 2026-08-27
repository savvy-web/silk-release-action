---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

### The release PR title named every publishable package instead of the releasing ones

A wave of two private tracking packages was titled `release: 31 packages`. Detection narrowed the **publishable** set to the packages whose `package.json` changed — but a private tracking package is not publishable, so it was never in that set, detection found nothing, and a fallback then claimed the entire publishable set was releasing.

Detection now runs over every workspace package, and the fallback is gone: an empty detection means no `package.json` moved, which is honestly "nothing to release" rather than "everything". The same wave now reads `release: claude-code-plugin@0.14.0, copilot-plugin@0.1.0`.

### Phase 2 reported `0 check(s) passed` for five passing checks

The totals counted `outcome === "success"`, but `outcome` is the human sentence shown in the check table ("Build passed", "No targets") — the verdict is `status`. Nothing matched, so every check-count was zero. `checksPassed`, `checksFailed` and a new `checksWarning` now read `status`, and the three sum to the number of checks rather than losing warnings.

## Features

### Phase 1 resolves the publish-target shape before the build

The release plan's `Targets` column read `pending` for every package. Publishability is declared in `package.json`, so what a package publishes to is knowable without building anything — only how many targets are **ready** needs the build, which is what Phase 2 fills in.

The column now renders `N target(s)`, or `🏷️ GitHub release only` for a package that publishes nowhere, and the legend carries the new icon. Reporting both facts as `pending` hid a decided one behind an undecided one, and made a package that publishes nowhere indistinguishable from one nobody had looked at yet.

A pre-build count cannot apply the built-`package.json` private filter, which drops a target whose build output is marked private. Such a target is counted in Phase 1 and dropped in Phases 2 and 3, so this is the **declared** count and an upper bound.
