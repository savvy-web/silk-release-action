---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

### Silk-mode detection recognizes the `@savvy-web/changelog` changelog id

Repos whose `.changeset/config.json` declares the canonical `@savvy-web/changelog` changelog adapter (what the current `savvy init` writes) were decoded as plain vanilla-changesets workspaces, so publishability detection fell through to `publishConfig.directory` and Phase 3 packed the **dev target** (`dist/dev/pkg`) instead of the prod byte groups (`dist/prod/<group>/pkg`). Dev manifests intentionally keep `catalog:`/`workspace:` specifiers unresolved, so affected packages shipped uninstallable manifests to npm (`yaml-effect@0.7.1` was published this way). Only the two legacy changelog ids (`@savvy-web/changesets`, `@savvy-web/silk/changesets`) were recognized.

The bundled `@savvy-web/silk-effects` (3.0.1 and later) adds `@savvy-web/changelog` to the Silk changelog markers, so these repos are detected as Silk workspaces again: prod target groups, per-target renames, provenance, and group-keyed SBOM assets all apply. Fixes #143.

### Dependencies

The bundle ships the refreshed first-party dependency set: `@savvy-web/silk-effects` 3.0.2, `@savvy-web/github-action-effects` 2.3.6, `workspaces-effect` 2.0.2, and `yaml-effect` 0.7.2 (the corrected prod artifact; 0.7.1 is deprecated on npm). The build now uses `@savvy-web/github-action-builder` 1.1.1.
