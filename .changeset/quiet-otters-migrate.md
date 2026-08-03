---
"@savvy-web/silk-release-action": patch
---

## Refactoring

* Adopted `@savvy-web/silk-effects` 5.2.0's service-owned layer statics, replacing the removed standalone `*Live` exports with `static readonly layer` on each service class (`ChangesetConfig.layer`, `ChangesetConfigReader.layer`, `Changesets.ReleasePlanner.layer`, `Changesets.ConfigInspector.layer`, `SilkPublishability.layer` / `.layerAdaptive`). Layer composition, provided services, and runtime behavior are unchanged.
* Adapted to `@changesets/types` 7.0.0-next.8's discriminated `ComprehensiveRelease` union, where the `"none"` arm's `oldVersion`/`newVersion` are optional. The internal release-plan projection now models bumped and unbumped packages as distinct shapes; the reported release plan output is unchanged.
