---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

* Phase 1 now fails before committing to the release branch when the version step left a changeset in `.changeset/` that names a package it just released. The changeset would otherwise be committed into the release PR and release the same package again on the next run. The commit step also logs how many changed paths and deletions it commits. Closes #558
* The SBOM pointer for the `…meta.tgz` documentation bundle is written into `meta/bundle.json`, which is the manifest `effected package build` emits. A package built with the older bundler still gets its pointer in `meta/tsdoctor.json` when that is the only manifest present
* Snapshot publishing reads a package that the registry knows but that lists no versions as never published, rather than failing the target
