---
"@savvy-web/workflow-release-action": major
---

## Breaking Changes

- Action inputs renamed: `app-id` → `app-client-id`, `private-key` → `app-private-key`. Update your workflow `with:` blocks accordingly.
- Action outputs restructured: ~22 ad-hoc outputs replaced by a schema-defined `result` JSON output plus five scalar convenience outputs (`phase`, `status`, `succeeded`, `package-count`, `release-pr-number`). Callers reading removed output names receive empty strings. The output schema is published as `silk-release-action.output.schema.json`.

## Features

- **`strict-warnings` input** (boolean, default `false`) — escalates warning-level findings to check failures, allowing teams to enforce zero-warnings policies.
- **`result` output** carries machine-readable release outcome across all three phases with three orthogonal flags (`noop`, `succeeded`, `hasFailures`) and a phase-specific payload block.
- **Self-recovering publish chain** — if a registry publish fails mid-run, a re-run detects already-published packages and marks them `skipped-identical (recovery)`, then completes the remaining registries without duplicating work.
- **Step-buffered publish logging** — each package/registry step emits `✅ pack …: 122 kB · 10 files` on success or `❌ … : publish-failed` on failure. Failures are reported honestly; a failed step no longer shows a success marker.
- **Redesigned Phase-2 validation comment** — the sticky PR comment now shows a what-will-be-released table, a findings table, and an SBOM preview. Degraded states are rendered when the build fails or no packages have version diffs.
- **Input JSON Schema** (`silk-release-action.input.schema.json`) — full annotations, invariants, and examples for all action inputs.
- **Output JSON Schema** (`silk-release-action.output.schema.json`) — replaces the previous single-file schema; `$id` resolves to the canonical raw-content URL on `main`.
- SLSA Provenance v1 and CycloneDX SBOM attestations generated for every publish run and linked to org packages via the artifact-metadata storage-record API.
- Release-branch commits include a DCO `Signed-off-by` trailer via the App bot identity.
- SBOM workspace-dep resolution covers all workspace packages, fixing `npm install` 404s for non-released sibling dependencies.
- OIDC publish now routes through `pnpm dlx npm` to avoid incompatibilities with the npm 10.x bundled in Node 24.

## Bug Fixes

- **Single-root-workspace detection** — single-package repositories (no `packages/` glob) are now correctly detected as publishable rather than classified as monorepos with zero packages.
- **`sbom-config` input parsing** — the input is now read via the Actions config provider, preventing the hyphen-to-underscore env key mangling that caused SBOM metadata to be silently ignored.
- **SBOM attestation content** — attestations now attest the real SBOM document; previously the attested content was an empty dependency list.
- **Attestation deduplication** — one attestation is created per build directory; re-runs reuse existing attestations rather than creating duplicates.
- **SBOM and API-doc icons** in the publish summary now link to the correct artifact URLs.
- Publishing is idempotent: re-runs correctly skip already-published packages across all registries.
- Token plumbing is explicit: `process.env.GITHUB_TOKEN` is never written; each subsystem uses the correct token.
