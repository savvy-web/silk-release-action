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
     Both `HostedSchema` identities (`OutputSchemaIdentity`,
     `InputSchemaIdentity`) are built from it, so `SCHEMA_URL`,
     `INPUT_SCHEMA_URL` and both config entries' current label move with it.
   - `versions` in the `hosted` helper in the same file (the identities own
     the labels; the config entries spell none): keep the old label in the
     array alongside `OUTPUT_SCHEMA_VERSION`. The old label becomes a
     **frozen** version whose file the CLI verifies still exists — and, since
     `@effected/schemastore-cli` 0.12, still declares exactly its derived
     `$id` — but never regenerates; advertising a label with nothing on disk,
     or with a file whose `$id` is absent, different or unparseable, fails
     the pre-flight before anything is written. A change to the hosting
     (`repo`, `branch` or `path` in `HostedSchema.github`) therefore moves
     every frozen label's `$id` and is a re-publish event for all of them,
     not a silent re-advertisement.
     Set `published: false` on the entries until the new label ships, or
     leave `published: true` — a new label has no predecessor on disk, so
     its first write is `created`, never drift.
3. Run `pnpm schema:build`. The new label writes
   `schemas/<version>/output.json` and
   `schemas/<version>/input.json`; the previous
   version's files under `schemas/<old-version>/` are untouched — the CLI
   writes only the current label and only when content changed.
4. Run `pnpm schema:check` again: it is the whole guard now. It fails on a
   stale or missing document, on a frozen file whose `$id` is absent or
   differs from the derived one, and on any gate failure; the identities
   themselves cannot disagree with the config because the config receives
   them as `hosted` (there is no separate test for the derivation — the
   former `__test__/schemastore-config.test.ts` pinned what the CLI now
   checks, or what holds by construction).
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
[^schemastore-cli-readme]: `npm:@effected/schemastore-cli`
