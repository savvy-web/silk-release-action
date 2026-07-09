---
"@savvy-web/silk-release-action": minor
---

Fix publishing under npm 12 and block unpublishable artifacts in Phase 2

Every publish began failing with `npm pack returned empty result` once npm 12.0.0 took the `latest` dist-tag on 2026-07-08. The action's npm executor (`pnpm dlx npm`) resolved npm unpinned, and npm 12 changed `pack --json` from an array of entries to an object keyed by package name. Phase-2 sticky comments showed the same bug as a package size of zero files.

Picked up from `@savvy-web/github-action-effects`:

- The dlx-fetched npm is pinned to `npm@11`, and `pack --json` is now read in both the npm 11 array form and the npm 12 object form. The pin stays on 11 because npm 12.0.0's `publish` throws `MODULE_NOT_FOUND: sigstore` (npm/cli#9722).
- `pack` and `dryRun` refuse a manifest carrying `catalog:` or `workspace:` specifiers, and refuse a tarball with zero files.

Picked up from `@savvy-web/silk-effects`, and surfaced here:

- Phase-2 validation records an **error** finding when a package's resolved publish directory is not one of the directories bound by its `dist/prod/targets.json`. The check fails and auto-merge is blocked, instead of packing a dev build. Remaining packages still validate and report.

Refs #143, #144.
