# Action output schema — design

**Date:** 2026-05-15
**Status:** Approved — ready for implementation planning

## Problem

The release action runs three distinct phases (branch management, validation,
publishing) and each does very different work. Today it emits ~26 individual
declared outputs in `action.yml`, set ad-hoc with scattered `outputs.set(...)`
calls across `main.ts` — a mix of scalar strings and JSON-encoded strings, with
no coherent contract. Downstream consumers (notably the silk-router
`repository_dispatch` step, which currently reads `released_packages` as a
comma-joined string) have no clear, stable picture of what a run did.

We want a single, schema-defined JSON output that explains what happened —
what was published, what was skipped, what failed — stable enough for future
consumption and resilient to the action eventually being split into smaller
actions.

## Decisions

1. **One schema, phase-discriminated.** A single `ReleaseOutput` modeled as a
   `Schema.Union` of three phase structs, discriminated by a `phase` literal.
   The union narrows type-safely on the producer side; the emitted JSON is a
   plain object with exactly one phase block.
2. **`result` JSON output + a few convenience scalars.** The rich contract is a
   single `result` output carrying the JSON. A small set of top-level scalar
   outputs mirror the most-wanted facts so simple consumers need not parse JSON.
   The other ~22 declared outputs are removed.
3. **Three orthogonal machine flags, universal across phases.** `noop`,
   `succeeded`, `hasFailures` — each answers a genuinely independent question.
   A derived `status` string is a human label for logs/summaries only, never
   the machine contract.
4. **Curated projection (not promoted internals).** `ReleaseOutput` is a
   deliberate consumer contract. Internal result types (`PackagePublishResult`,
   `TargetPublishResult`, `TagInfo`, `ReleaseInfo`, `AttestationResult`, etc.)
   are projected into it through a small mapping layer, so internal refactors
   never break the published contract.
5. **Self-describing via JSON Schema.** The Effect `Schema` is the source of
   truth; `json-schema-effect` generates a SchemaStore-compatible
   `silk-release-action.schema.json`, and the emitted JSON carries a `$schema`
   key pointing at the hosted document.

## The envelope

Every phase struct shares this envelope:

```jsonc
{
  "$schema": "https://json.schemastore.org/silk-release-action.schema.json",
  "schemaVersion": "1",
  "phase": "publishing",            // "branch-management" | "validation" | "publishing"
  "status": "success",              // derived human label — NOT the machine contract
  "noop": false,
  "succeeded": true,
  "hasFailures": false,
  "dryRun": false,
  "publishing": { /* phase payload — field name matches `phase` */ }
}
```

- `$schema` — first key; lets editors / Ajv / any JSON Schema tooling validate
  the output against the hosted document.
- `schemaVersion` — in-band guard so a workflow consumer doing
  `fromJSON(result).schemaVersion` can branch without resolving the `$schema`
  URL. Bumped **only** on a breaking JSON-shape change (removed/renamed field,
  changed type). Additive fields do not bump it. Both `$schema` and
  `schemaVersion` are kept — they serve different audiences (tooling vs.
  in-band consumers).
- `dryRun` — lives in the envelope because all three phases can run in dry-run
  and a consumer always wants to know.
- Exactly one phase block (`branchManagement` / `validation` / `publishing`)
  is present, keyed to `phase`; each `Schema.Union` member declares only its
  own block.

## The three flags

| Flag | Question it answers |
| --- | --- |
| `noop` | Was there anything to do this run? |
| `succeeded` | Did all intended work complete (or correctly do nothing)? |
| `hasFailures` | Did anything fail? |

The flags are orthogonal — a consumer branches on the one it cares about. They
are the machine contract. `status` is derived purely for human-readable
logs/summary output:

- `noop` → `"no-op"`
- `succeeded` → `"success"`
- `hasFailures` with some work landed → `"partial"`
- otherwise → `"failed"`

### Flag derivation per phase

| Phase | `noop` | `succeeded` | `hasFailures` |
| --- | --- | --- | --- |
| branch-management | no changesets detected | release PR created/updated cleanly (or `noop`) | update produced merge conflicts |
| validation | release branch has no packages to validate | all builds passed + publish dry-runs clean | a build or dry-run failed |
| publishing | not a release commit / nothing to publish | every package published *or* correctly skipped, all tags + releases created | ≥1 package or registry target errored |

A publishing re-run that finds everything already-published is
`noop: false, succeeded: true, hasFailures: false` → `"success"`.
Already-published is **not** a failure — this preserves the idempotency work in
the publish/release path.

## Phase payloads

Curated projections — internal noise (`stdout`, `stderr`, `exitCode`, integrity
shasums) is dropped; `error` is a message string present only on failure.

### `branchManagement`

```jsonc
{
  "releaseBranch": {
    "name": "changeset-release/main",
    "existed": true,
    "created": false,
    "updated": true,
    "hasConflicts": false
  },
  "releasePr": { "number": 42, "url": "...", "action": "updated" },  // null when no PR
  "changesets": {
    "count": 3,
    "packages": [ { "name": "@savvy-web/foo", "bumpType": "minor" } ]
  }
}
```

`releasePr.action` is `"created" | "updated"`. `changesets.packages[].bumpType`
is `"major" | "minor" | "patch"`.

### `validation`

```jsonc
{
  "builds": { "passed": true, "packageCount": 5 },
  "publish": {
    "npmReady": true,
    "githubPackagesReady": true,
    "packages": [ { "name": "@savvy-web/foo", "version": "1.2.0", "ready": true } ]
  },
  "checkRun": { "url": "...", "conclusion": "success" }
}
```

`checkRun` is the unified validation check run.

### `publishing`

```jsonc
{
  "packages": [
    {
      "name": "@savvy-web/foo",
      "version": "1.2.0",
      "status": "published",                  // "published" | "skipped" | "failed"
      "skipReason": null,                      // "already-published-identical"
                                               // | "already-published-unknown" | null
      "targets": [
        {
          "registry": "https://npm.pkg.github.com/",
          "status": "published",               // "published" | "skipped" | "failed"
          "registryUrl": "https://github.com/.../pkgs/npm/foo",
          "error": null                        // message string, only when status === "failed"
        }
      ],
      "attestations": {
        "provenanceUrl": "https://github.com/.../attestations/123",
        "sbomUrl": "https://github.com/.../attestations/124",
        "githubAttestationUrl": "https://github.com/.../attestations/125"
      },
      "tarballDigest": "sha256:..."
    }
  ],
  "tags": [ { "name": "@savvy-web/foo@1.2.0", "sha": "abc123" } ],
  "releases": [ { "tag": "@savvy-web/foo@1.2.0", "url": "...", "id": 999 } ]
}
```

Rules:

1. **Content-mismatch is `failed`, not skipped.** The internal
   `alreadyPublishedReason` value `"different"` (local tarball differs from a
   published version) maps to `status: "failed"` — never `skipped`.
   `skipReason` covers only the genuine `identical` / `unknown` skips.
2. **Version-only packages** (GitHub release, no registry publish) appear in
   `packages[]` with `targets: []` and `status: "published"` — they still get a
   tag and a release. Empty `targets` is the signal; no separate list.
3. **No dispatch/notification field.** The silk-router `repository_dispatch` is
   a separate workflow step in the consuming reusable workflow — the action does
   not send it. This payload is precisely what that step should read to build
   its dispatch.
4. Roll-up counts (`publishedCount`, etc.) are intentionally omitted — they are
   derivable from `packages[]`.

## Schema generation pipeline

- **`src/schema/release-output.ts`** — the Effect `Schema` (`ReleaseOutput`),
  the single source of truth. Open-ended fields (the attestation `predicate`,
  any metadata blob) use `json-schema-effect`'s `Jsonifiable` instead of
  `Schema.Unknown`, so the generated JSON Schema is clean (`{}`, not the
  `/schemas/unknown` artifact Ajv rejects).
- **`lib/scripts/generate-schema.ts`** — uses `JsonSchemaExporter.generate(...)`
  with `$id: "https://json.schemastore.org/silk-release-action.schema.json"`,
  validates with `JsonSchemaValidator.validate(out, { strict: true, ajvStrict: true })`,
  and `write`s `silk-release-action.schema.json` to the repository root.
- **`package.json`** — a `generate-schema` script. CI regenerates and asserts
  no diff (the `write` `Written`/`Unchanged` result, or a test) so the committed
  schema can never drift from the Effect Schema.
- **devDependencies** — `json-schema-effect`, `ajv`.
- The generated `silk-release-action.schema.json` is uploaded to JSON Schema
  Store; the `$schema` constant in the action points at the canonical URL.

## Mapping layer

Three pure functions in `src/schema/` — the Approach-A seam:

- `toBranchManagementOutput(...)`
- `toValidationOutput(...)`
- `toPublishingOutput(...)`

Each takes the internal result types, returns its phase struct (envelope +
payload), and derives the three flags. Pure, no I/O, independently testable.
This is where curation happens — dropping internal noise, normalizing per-
package status into the clean `published | skipped | failed` enum, attaching the
attestation URLs.

## Emission

At each phase's exit in `main.ts`:

- Build the `ReleaseOutput` via the matching projection function.
- Emit `outputs.setJson("result", output)` (Schema-encoded).
- Emit the convenience scalar outputs: `phase`, `status`, `succeeded`,
  `package-count`, `release-pr-number`.

The ~22 scattered `outputs.set(...)` calls across `main.ts` are removed and
replaced by the single build-and-emit per phase. The `action.yml` outputs
section collapses from ~26 entries to `result` plus those five scalars.

## Error handling

The result is emitted even when `hasFailures: true`: the action calls
`outputs.setFailed(...)` **and** emits the structured result, so a consumer on
`if: always()` gets full failure detail. A hard uncaught crash means the step
fails with no `result` — consumers fall back to step status for that case. A
partial-result-from-`post` mechanism is intentionally not built (YAGNI).

## Testing

- Each projection function — unit tests against representative
  internal-result fixtures.
- Flag derivation — per phase, including the re-run / already-published case.
- Schema round-trip — `encode` → `decode` is identity.
- `generate-schema` — a test (or CI step) regenerates and asserts the committed
  `silk-release-action.schema.json` is unchanged.

## Out of scope

- Splitting the action into smaller per-phase actions. The phase-discriminated
  union is designed so a future split is clean (each smaller action emits its
  slice of the same union), but the split itself is not part of this work.
- Changes to the silk-router dispatch step in the consuming reusable workflow.
- Roll-up count fields in the publishing payload (derivable; can be added later
  without a `schemaVersion` bump).
