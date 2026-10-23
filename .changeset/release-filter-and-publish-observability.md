---
"@savvy-web/silk-release-action": minor
---

## Features

### Per-target release filter

A `publishConfig.targets` entry can declare `releases: "stable" | "prerelease" | "all"`. A target whose channel excludes the version being released is skipped as `filtered-by-releases`. Nothing is packed or uploaded for it, and the rest of the workspace still publishes. Phase 2 dry-runs only the targets that receive the version.

* Every publish now passes an explicit dist-tag: `latest` for a stable version, the prerelease channel (for example `beta`) otherwise. A prerelease no longer lands on `latest`.
* A `releases` value outside the three channels is a hard stop for that workspace, never a guess. Phase 3 fails only that workspace, and Phase 2 records an error finding.
* A `dist/prod/targets.json` written by a bundler older than the field keeps the channel declared in `package.json`.

### Registry confirmation beyond npm

`registry-confirm-timeout` now also confirms GitHub Packages and custom registries, reading each with the credential its publish used. They get a 20-second ceiling, since they have no publish-time hold. Each result reports one of these outcomes:

* `confirmed`
* `held`
* `skipped` with a reason:
  * `read-denied` (401/403)
  * `no-read-credential`
  * `not-probed` (JSR)

### A fuller `result` output

The `result` output now reports, for each registry publication:

* the `publishConfig.targets` key and `releases` channel
* the dist-tag used
* how the upload authenticated: `auth` with `method`, `credential` and any `fallback`, describing what the action set up
* why a confirmation was skipped
* npm's own provenance URL beside the GitHub attestation

For each workspace it now reports:

* its release-filtered targets under `skipped`
* `releaseType`, `baseVersion` and `bumpType`
* whether the GitHub release is a prerelease

### Clearer run log

* **Flat log groups.** Phase banners are header lines instead of groups that swallowed their contents, because GitHub Actions cannot nest groups.
* **Per-target publish lines.** Each line shows the target key, the host, the outcome, the dist-tag and the auth method with its credential source.
* **One vocabulary.** The summaries say "workspace" for the versioned unit and "registry target" for each upload.
* **Visible confirmation.** A confirmation line always states what was confirmed, held or skipped, and why.
* **Explained failures.** Auth-setup failures name the input that supplies the credential, a trusted-publishing fallback names its likely cause, and a 401/403 from a custom registry says a read credential is needed.

## Bug Fixes

* Phase 1 no longer fails in changesets pre mode with `FileSystem.readFile (.changeset/pre/)`. `changeset version` moves each consumed changeset into a new, untracked `.changeset/pre/` directory, which `git status` reports as a single directory entry; the release commit now carries the files inside it.
* Custom registries now publish with token auth from the first attempt. Trusted publishing exists only on registry.npmjs.org; offering the OIDC environment elsewhere cost a failed exchange, and npm then quietly fell back to the token.
* A release-filtered target is no longer counted as published, and the closing summary counts only uploads, not packages already on the registry.
* A release-filtered npm target is no longer polled for availability, which used to wait out the full ceiling and log a false "held" warning.
