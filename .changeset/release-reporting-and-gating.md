---
"@savvy-web/silk-release-action": minor
---

## Features

### Post-publish registry availability confirmation

New `registry-confirm-timeout` input (seconds, default `180`, `0` disables). After Phase 3 publishes and tags, the action polls each published npm package's exact `name@version` on its registry until it resolves or the ceiling elapses — npm's publish-time malware scan can hold a version back for a few minutes after a successful publish, and a downstream dispatch fired immediately can land inside that window.

* Per package: `available: boolean` and `availability: { status: "confirmed" | "held" | "skipped", waitedMs }`
* Totals: `packagesConfirmed`, `packagesHeld`; `summary` appends `· N package(s) held by the registry` when any package is held
* A hold never fails the run or changes `success`/`outcome` — the package is published, just not yet resolvable. Gate a follow-on dispatch on `totals.packagesHeld === 0` if it needs the registry to actually be serving the version

### Publish output: workspace path, tag SHA, and package URLs

* `publish.workspaces[name].path` — the repo-relative workspace directory
* `publish.workspaces[name].tag.sha` — now the SHA from the tag-creation call itself, empty only on dry-run or when the tag could be neither created nor resolved
* `publish.workspaces[name].packages[].url` — the human-facing package page (npmjs.com, jsr.io, or the GitHub Packages page; `null` for a custom registry)
* `publish.workspaces[name].packages[].tarballUrl` — the registry's own tarball download URL, read back by the confirmation probe; `null` when not confirmed or not probed

## Bug Fixes

* Phase-2 build validation now reads diagnostics from both stdout and stderr, so a build failure with output only on stdout reports its actual annotations and error summary instead of the bare `Build failed`. The exit code alone remains the pass/fail verdict — no substring match on the word "error" is ever consulted.
