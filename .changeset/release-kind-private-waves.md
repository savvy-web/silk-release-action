---
"@savvy-web/silk-release-action": minor
---

## Features

### A release wave now distinguishes registry packages from GitHub-release-only ones

A wave is no longer assumed to be homogeneous. Packages that resolve at least one publish target are `registry` kind; packages that resolve none — private tracking packages with no `publishConfig`, no build and no tarball, whose entire release is a git tag and a GitHub release — are `github-release` kind. `utils/release-kind.ts` names the distinction once, and the Phase-2 comment, the Publish Validation check and the Phase-3 log all describe a wave the same way.

The Phase-3 closing line now reports versioning, registry publishing and GitHub releases as three separate counts, so a wave that publishes nothing to a registry reads as a deliberate shape rather than an empty run.

## Bug Fixes

- The Publish Validation check reported `npm: ✅` and `GitHub Packages: ✅` for a wave with no targets for those registries. Both flags are "nothing of this kind failed" booleans that start `true`, so an all-private wave asserted a readiness that nothing had tested. Each registry now renders `— none` when the wave has no target for it, and a tick or a cross only when it does.
- The Build & SBOM gate generated an SBOM for every detected package, including packages with no publish target. There is no tarball to describe, and the release-asset upload is per-target, so the document was written into the package directory and then attached to nothing. Such packages are now skipped and named in a new `sbomSkipped` field, distinct from `sbomFailures` because a skip is the correct outcome and a failure is not.
- Target resolution — detection, the JSR filter and the private-built-`package.json` filter — moved into a single `resolvePublishTargetSpecs` shared by the Build & SBOM gate and the publish step, so the two cannot disagree about which packages publish anywhere.
- The release table rendered a package with no builds as `⏭️ no targets`, whose skip glyph reads as "this was passed over". Nothing is passed over: the cell now reads `🏷️ GitHub release only`, and the totals line names the wave's shape instead of reporting `0 B packed · 0 files · 0/0 targets ready`.
