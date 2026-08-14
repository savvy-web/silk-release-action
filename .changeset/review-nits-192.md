---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

* Release-PR section stamps are now validated when read back: a stamp whose state is not one of the known six is dropped instead of rendering a garbled value as "Up to date". An unreadable region no longer blocks a fresh write, so it recovers on the next run.
* Phase 2's sticky-comment stamp carries the same commit sha the validation run resolved, instead of a second `GITHUB_SHA` read whose `""` fallback could stamp an empty sha.
* The `result` output schema's changeset-packages description no longer references an `explicit` field that does not exist; dependency-only bumps are identified by `changesetCount: 0`.

## Documentation

* Completed TSDoc (`@param`/`@returns`) on exported release and PR-body helpers, and reattached the doc comment that had drifted off `resolveReleasePrTitle`.
* De-duplicated the `github-token` input description so the REQUIRED-for-GitHub-Packages sentence leads.

## Maintenance

* Explicit types on exported declarations (`makeAppLayer`, `MainLive`, PR-body markers, and friends); `AutoMergeMethod` is now derived from its schema instead of restating the literals.
* Exported `ValidatedPackage`, the parameter type of `toValidatedReleaseRows`.
* Token-auth publish retries now say provenance is disabled for the retry attempt; empty-registry display naming is explicit; loop-invariant SBOM options are computed once.
