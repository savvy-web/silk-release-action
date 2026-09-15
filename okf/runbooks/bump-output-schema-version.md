---
type: Runbook
title: Bump the output schema version
description: Respond to a contract change in the versioned ReleaseOutput JSON Schema by moving its version label in lib/scripts/schemastore.config.ts and SCHEMA_URL together, then regenerating with the schemastore CLI.
resource: ../../lib/scripts/schemastore.config.ts
tags:
  - release
  - compat
sources:
  - id: schemastore-config
    resource: ../../lib/scripts/schemastore.config.ts
  - id: release-output
    resource: ../../src/schema/release-output.ts
  - id: schemastore-config-test
    resource: ../../__test__/schemastore-config.test.ts
  - id: schemastore-cli-readme
    resource: npm:@effected/schemastore-cli
generated:
  by: okfit/claude-code
status: draft
---

# Bump the output schema version

## Trigger

Either of:

- `pnpm schema:build` (or `pnpm schema:check`) exits `1` reporting **drift**
  on `silk-release-action` — the entry is marked `published: true` in
  `lib/scripts/schemastore.config.ts`[^schemastore-config] and the regenerated document's
  contract differs from the committed one. The error line names the `$id`,
  the change class, the current label and the suggested next label.[^schemastore-cli-readme]
- You have made a contract-shaped change to `ReleaseOutput`
  (`../../src/schema/release-output.ts`[^release-output]) — adding/removing/retyping
  a field, changing an enum's members, or anything else `@effected/schemastore`'s
  `DocumentDiff` classifies as `"contract"` rather than `"annotations"` — at a
  label consumers already depend on.

While the current label is **unpublished** (`published: false`, the default,
and the state today — the schema has never been published), no bump is
needed: `pnpm schema:build` rewrites the document in place at the same
label. This runbook is for the moment a label has shipped.

## Steps

1. Run `pnpm schema:check`. It runs the identical walk with no writes and
   reports, per schema, `unchanged`, `would write (<change>)` or `drift`,
   and exits `1` when a build would write or refuse anything — the same
   information the enforcing run acts on, surfaced safely first.
2. If the output schema reports drift, move the version label in **both**
   places that must move together, to the label the error suggested (or a
   higher one — the suggestion is a minor bump, and `DocumentDiff` cannot
   tell an additive change from a breaking one, so bump major by hand when
   you know it is breaking):
   - `versions` on the `silk-release-action` entry in
     `../../lib/scripts/schemastore.config.ts`. Append the new label and keep the old
     one: the old label becomes a **frozen** version whose file the CLI
     verifies still exists but never regenerates. (A full
     three-component label such as `5.3.0` keeps the file names stable;
     `major.minor` is also accepted.) Set `published: false` on the entry
     until the new label ships, or leave `published: true` — a new label
     has no predecessor on disk, so its first write is `created`, never
     drift.
   - `SCHEMA_URL` in `../../src/schema/release-output.ts`, which is the
     `$schema` every emitted payload carries; it must equal the `$id` the
     config derives (`<baseUrl>/<version>/silk-release-action-<version>.json`).
3. Run `pnpm schema:build`. The new label writes a new
   `schemas/<version>/silk-release-action-<version>.json`; the previous
   version's file under `schemas/<old-version>/` is untouched — the CLI
   writes only the current label and only when content changed.
4. Run the identity guard test (`../../__test__/schemastore-config.test.ts`[^schemastore-config-test]),
   which asserts the config-derived `$id` equals `SCHEMA_URL` and that every
   derived document is committed on disk. A label moved in only one of the
   two files in step 2 fails it immediately. `pnpm schema:check` is the
   content-drift gate; the two together are the guard the old drift test
   used to be.
5. Add a changeset describing the schema version bump — the emitted
   `$schema` value changes, which consumers see.

**The `--force` escape hatch** (`pnpm schema:build --force`, sugar for
`--drift=allow`) rewrites a published document in place at the **same**
label instead of writing a new one — skip it unless the label is genuinely
unpublished (in which case `published: false` already does the same thing
permanently) or you are repairing a document whose committed text no longer
parses. Using it against a label consumers already depend on breaks every
consumer pinned to that version's `$schema` URL.

## End state

`pnpm schema:check` reports every schema `unchanged` and exits `0`, the test
suite is green, and the repository has a new
`schemas/<version>/silk-release-action-<version>.json` committed alongside
the previous version's file, which is unchanged and now listed as a frozen
label in `lib/scripts/schemastore.config.ts`. The changeset for the bump is in place.

See also: [Versioned output schema decision](../decisions/versioned-output-schema.md),
[Release output interface](../interfaces/release-output.md).

[^schemastore-config]: `../../lib/scripts/schemastore.config.ts`
[^release-output]: `../../src/schema/release-output.ts`
[^schemastore-config-test]: `../../__test__/schemastore-config.test.ts`
[^schemastore-cli-readme]: `npm:@effected/schemastore-cli`
