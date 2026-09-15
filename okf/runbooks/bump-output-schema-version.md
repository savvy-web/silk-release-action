---
type: Runbook
title: Bump the output schema version
description: Respond to a contract change in the versioned ReleaseOutput JSON Schema by bumping OUTPUT_SCHEMA_VERSION, keeping the old label frozen in lib/scripts/schemastore.config.ts, and regenerating with the schemastore CLI.
resource: ../../lib/scripts/schemastore.config.ts
tags:
  - release
  - compat
sources:
  - id: schemastore-config
    resource: ../../lib/scripts/schemastore.config.ts
  - id: release-output
    resource: ../../src/schema/release-output.ts
  - id: silk-release-config
    resource: ../../src/schema/silk-release-config.ts
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
2. If the output schema reports drift, bump the label to the one the error
   suggested (or a higher one — the suggestion is a minor bump, and
   `DocumentDiff` cannot tell an additive change from a breaking one, so bump
   major by hand when you know it is breaking):
   - `OUTPUT_SCHEMA_VERSION` in
     `../../src/schema/silk-release-config.ts`[^silk-release-config] — a
     `major.minor` label such as `5.3` (three components are also accepted).
     `SCHEMA_URL`, `INPUT_SCHEMA_URL` and both entries' `current` label in
     `../../lib/scripts/schemastore.config.ts` are derived from it and move
     with it.
   - `versions` on **both** entries in
     `../../lib/scripts/schemastore.config.ts`: keep the old label in the
     array alongside `OUTPUT_SCHEMA_VERSION`. The old label becomes a
     **frozen** version whose file the CLI verifies still exists but never
     regenerates; advertising a label with nothing on disk fails the build.
     Set `published: false` on the entries until the new label ships, or
     leave `published: true` — a new label has no predecessor on disk, so
     its first write is `created`, never drift.
3. Run `pnpm schema:build`. The new label writes
   `schemas/<version>/silk-release-action.output-<version>.json` and
   `schemas/<version>/silk-release-action.input-<version>.json`; the previous
   version's files under `schemas/<old-version>/` are untouched — the CLI
   writes only the current label and only when content changed.
4. Run the identity guard test (`../../__test__/schemastore-config.test.ts`[^schemastore-config-test]),
   which asserts the config-derived `$id`s equal `SCHEMA_URL` and
   `INPUT_SCHEMA_URL`, that both entries sit at `OUTPUT_SCHEMA_VERSION`, and
   that every derived document is committed on disk. `pnpm schema:check` is
   the content-drift gate; the two together are the guard the old drift test
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
`schemas/<version>/` pair committed alongside the previous version's files,
which are unchanged and now listed as a frozen label in
`lib/scripts/schemastore.config.ts`. The changeset for the bump is in place.

See also: [Versioned output schema decision](../decisions/versioned-output-schema.md),
[Release output interface](../interfaces/release-output.md).

[^schemastore-config]: `../../lib/scripts/schemastore.config.ts`
[^release-output]: `../../src/schema/release-output.ts`
[^silk-release-config]: `../../src/schema/silk-release-config.ts`
[^schemastore-config-test]: `../../__test__/schemastore-config.test.ts`
[^schemastore-cli-readme]: `npm:@effected/schemastore-cli`
