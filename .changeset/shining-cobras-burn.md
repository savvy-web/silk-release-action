---
"@savvy-web/workflow-release-action": major
---

## Breaking Changes

- Action inputs renamed: `app-id` → `app-client-id`, `private-key` → `app-private-key`. Update your workflow `with:` blocks accordingly.
- Action outputs restructured: ~22 ad-hoc outputs replaced by a schema-defined `result` JSON output (validated by `silk-release-action.schema.json`) plus five scalar convenience outputs (`phase`, `status`, `succeeded`, `package-count`, `release-pr-number`). Callers reading removed output names receive empty strings.

## Features

- `result` output carries machine-readable release outcome across all three phases with three orthogonal flags (`noop`, `succeeded`, `hasFailures`) and a phase-specific payload block.
- Effect-based Attest service generates SLSA Provenance v1 and CycloneDX SBOM attestations without `@actions/attest`. Attestations are linked to org packages via the artifact-metadata storage-record API.
- Release-branch commits include a DCO `Signed-off-by` trailer via the App bot identity.
- SBOM workspace-dep resolution covers all workspace packages, fixing `npm install` 404s for non-released sibling dependencies.
- SBOM preview reflects real publish-validation results.

## Bug Fixes

- Publishing is idempotent: re-runs correctly skip already-published packages.
- Token plumbing is explicit: `process.env.GITHUB_TOKEN` is never written; each subsystem uses the correct token.
