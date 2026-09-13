---
type: Runbook
title: Bump the output schema version
description: Respond to a blocked contract change in the versioned ReleaseOutput JSON Schema by bumping its version label and regenerating.
resource: ../../lib/scripts/generate-schema.ts
tags:
  - release
  - compat
sources:
  - id: generate-schema
    resource: ../../lib/scripts/generate-schema.ts
  - id: release-output
    resource: ../../src/schema/release-output.ts
  - id: generate-schema-test
    resource: ../../__test__/generate-schema.test.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: f14268ae30781fbd7b159140df1cb0b23bb8635866d727fa9b52982862a23527
status: draft
---

# Bump the output schema version

## Trigger

Either of:

- `pnpm generate-schema` fails with `SchemaContractChangeError`, which names
  the affected document(s) and reports a suggested `nextVersion` for each
  (`../../lib/scripts/generate-schema.ts:241-258`).
- You have made a contract-shaped change to `ReleaseOutput`
  (`../../src/schema/release-output.ts`) — adding/removing/retyping a field,
  changing an enum's members, or anything else `@effected/schemastore`'s
  `DocumentDiff` classifies as `"contract"` rather than `"annotations"`.

## Steps

1. Run `pnpm generate-schema -- --check` (alias `--dry-run`). This runs the
   identical walk with no writes and reports, per target, whether the write
   `wouldWrite` or is `Unchanged`, and whether it is `contractBlocked` — the
   same information the enforcing run would refuse to write, surfaced
   safely first.
2. If the output target reports `contractBlocked`, bump the version label
   in **both** of the two places that must move together, to the value
   `SchemaContractChangeError` suggested:
   - `SCHEMA_SEMVER` in `../../lib/scripts/generate-schema.ts` (a full
     three-component SemVer string, parsed through
     `SchemaVersioning.parseResult` — a bare major like `"5"` is rejected).
   - `SCHEMA_URL` in `../../src/schema/release-output.ts`, which is the
     `$schema`/`$id` every emitted payload's document points at.
3. Run `pnpm generate-schema` (no flags). Under the default
   `"block-versioned"` policy this now writes the new version's document
   rather than refusing it, because the new label has no predecessor to
   break.
4. Confirm a new `schemas/<version>/silk-release-action-<version>.json`
   exists and that the previous version's file under its own
   `schemas/<old-version>/` directory is byte-for-byte untouched — the
   generator writes only the target whose content changed, at its own path.
5. Run the drift guard test (`../../__test__/generate-schema.test.ts`), which
   re-runs the same walk with `SchemaPipeline.checkOne` per target and
   asserts `blocked` is `false` and the reported `change` is clean. This is
   the same check `pnpm ci:test` runs, so a version bump missed in either of
   the two files in step 2 fails it immediately.
6. Add a changeset describing the schema version bump.

**The `--allow-contract-change` (alias `--force`) escape hatch** rewrites a
published document in place at the **same** version label instead of
writing a new one — skip it unless the label being changed is genuinely
unpublished yet (iterating before the first release at that version, or
repairing a document whose committed text no longer parses). Using it
against an already-consumed version label breaks every consumer pinned to
that version's `$schema` URL.

## End state

`pnpm generate-schema -- --check` reports every target `Unchanged`,
`pnpm ci:test` (which runs the drift guard test) is green, and the
repository has a new `schemas/<version>/silk-release-action-<version>.json`
committed alongside the previous version's file, which is unchanged. The
changeset for the bump is in place.

See also: [Versioned output schema decision](../decisions/versioned-output-schema.md),
[Release output interface](../interfaces/release-output.md).
