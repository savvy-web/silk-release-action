---
"@savvy-web/silk-release-action": major
---

## Breaking Changes

### All three phases share one outcome vocabulary

Phases 1 and 2 now carry the same `success` + `outcome` + `summary` + `failure` + `totals` shape the publish phase adopted. `status`, `noop`, `succeeded` and `hasFailures` are gone from every phase, along with `deriveStatus` and `ReleaseFlags`.

Each phase has its own outcome enum, because the interesting states differ. Branch management: `nothing-to-release`, `branch-created`, `branch-updated`, `branch-unchanged`, `conflicted`. Validation: `validated`, `nothing-to-release`, `build-failed`, `checks-failed`. Publish: `released`, `nothing-to-release`, `partial`, `failed`, `blocked`.

The scalar `status` action output now carries the phase's own outcome label rather than one of four shared ones, and `succeeded` mirrors `success`. Both are read with no per-phase branch.

### The output schema is versioned at `schemas/5.0.0/`

The emitted document moved from `silk-release-action.output.schema.json` at the repo root to `schemas/5.0.0/silk-release-action-5.0.0.json`, and `$schema` in every payload points at the new path. The URL has to stay versioned: an emitted payload must keep resolving to the shape it was written against, and an unversioned URL would silently re-point old payloads at a newer contract.

`@effected/schemastore` requires full three-component SemVer labels, so the directory and file name both carry `5.0.0` rather than `5.0`.

## Features

### The generator refuses to break a published schema

`pnpm generate-schema` now runs `SchemaPipeline.check` before writing anything. A `contract` change against an already-published version fails the run, names every affected document, and says to bump — and **writes nothing**, so the published file is not clobbered on the way to reporting that it would have been.

`DocumentDiff` classifies `default`, `examples`, `readOnly` and `writeOnly` as contract changes even though the JSON Schema spec calls them annotations: consumers act on them, and under-reporting ships a silent break while over-reporting only costs a version bump.

## Bug Fixes

- A validation run with nothing to validate reported `succeeded: false`, because the flag was `!noop && buildsPassed && publishOk`. It is now `success: true` with `outcome: "nothing-to-release"` — nothing failed, so nothing is reported as failing.
