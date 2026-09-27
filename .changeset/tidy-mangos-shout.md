---
"@savvy-web/silk-release-action": minor
---

## Features

### An explicit-only `snapshot` phase

`phase: snapshot`, paired with a new `snapshot-tag` input, publishes
already-published packages as prerelease versions under a non-`latest`
dist-tag, without waiting for a real release. Useful for pulling an
in-progress change into a consumer's CI before it ships.

```yaml
- uses: savvy-web/silk-release-action@v5
  with:
    phase: snapshot
    snapshot-tag: next
    app-client-id: ${{ secrets.APP_CLIENT_ID }}
    app-private-key: ${{ secrets.APP_PRIVATE_KEY }}
```

`snapshot` is never auto-detected — it only runs when a workflow sets
`phase: snapshot` explicitly. It refuses to run on the release branch, the
target branch, or any non-branch ref (a tag or PR ref).

Versions are calculated the same way Phase 1 calculates them, but as
`<next>-<snapshot-tag>-<datetime>` prereleases (e.g.
`1.4.0-next-20260927051500`) computed only in the job's working tree —
nothing is committed or pushed. Publishing reuses the same target-resolution
and publish machinery as Phase 3, and every upload goes out under the
`snapshot-tag` dist-tag instead of `latest`.

A package the registry has never published is **skipped**, not published —
claiming `latest` on a first publish under a non-latest tag would be wrong,
and a first publish belongs to a real release. A registry error other than
"package not found" fails the run rather than being treated as
never-published.

No git tag, GitHub release, release PR, issue-closing, SBOM, or GitHub
attestation is produced for a snapshot run (npm provenance still applies
wherever a target already configures it). `dry-run` packs each package and
reads the registry without uploading.

A snapshot run's `result` output carries a new `phase: "snapshot"` variant,
and the job summary includes a ready-to-paste `overrides:` block for pinning
the exact published versions — pin those versions, not the tag, since a
partial or re-run snapshot is not a stable set.

## Bug Fixes

* The `result` and `phase` output descriptions in `action.yml` now point at
  the current `schemas/6.0/` output schema instead of a stale `5.2` URL
