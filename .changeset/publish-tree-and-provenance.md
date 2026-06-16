---
"@savvy-web/silk-release-action": minor
---

## Bug Fixes

* The GitHub Packages link in a release's publish summary now uses the repository owner (`/orgs/<owner>/…`) instead of the literal `orgs/unknown`.

## Features

### Rich publish-phase log tree

The Phase-3 publish group renders an icon-led tree per build group: `📦 pack`, one `⬆ <registry>` row per target, and `🔏 provenance` / `📄 sbom` rows carrying their attestation URLs. Absolute paths and zero-count tallies are gone, and an attestation row appears only when its URL exists.

### npm-native provenance is captured and surfaced

npm's own trusted-publishing provenance URL — the Sigstore transparency-log entry npm prints when a tarball publishes with provenance — is parsed from the publish output and shown both in the log tree and in the release summary's Provenance column, alongside the action's own SLSA provenance, GitHub attestation, and SBOM links.
