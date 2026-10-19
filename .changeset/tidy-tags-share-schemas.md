---
"@savvy-web/silk-release-action": minor
---

## Bug Fixes

### Shared release tags in the publish `result`

* When several github-only workspaces share one release tag (the single tag strategy), each workspace now maps to the shared tag and reports `released`. Previously every one of them was reported `failed` with `tag: null` and `release: null` (#520)
* A package whose name is a prefix of another (`@s/app` and `@s/app-web`) is no longer associated with the other package's shared release

### Tighter JSON Schemas (label `6.0`)

* Counts, sizes and durations in the output schema are non-negative integers; the release PR number must be at least 1 and the release id is a non-negative integer (`0` in dry-run)
* `copyright.startYear` in the input schema is bounded to 1970 through 2100

### Stricter SBOM config validation

The SBOM config (`.github/silk-release.json`, the `sbom-config` input and `SILK_RELEASE_SBOM_TEMPLATE`) now rejects values it used to accept:

* empty supplier, publisher, holder or contact names
* `documentationUrl` and `supplier.url` values that are not `http` or `https` URLs
* contact emails without text on both sides of the `@`

A config that decoded before can now fail to load. Fix the offending value, or remove the field, before upgrading.
