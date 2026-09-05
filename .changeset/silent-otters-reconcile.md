---
"@savvy-web/silk-release-action": patch
---

## Maintenance

* Removed the hand-written `.github/silk-release.schema.json`, which had drifted from the generated `silk-release-action.input.schema.json` (its `SBOMMetadataConfig`/`SBOMContact` definitions no longer matched the generated `SbomConfig`/`SbomContact`). `.github/silk-release.example.json` now points its `$schema` at the generated document, which describes the same wire format — no runtime decoding changes. If your own `.github/silk-release.json` references the old raw-GitHub URL for editor completion, repoint it at `silk-release-action.input.schema.json`.
* Removed `.github/workflows/act-test.yml`, which exercised `.github/actions/local` — a path this action's `persistLocal: { enabled: false }` setting never produces.
* Removed a duplicate, empty `src/types/global.d.ts` left over alongside the root `types/global.d.ts`.
