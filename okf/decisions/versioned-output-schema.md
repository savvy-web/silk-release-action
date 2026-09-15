---
type: Decision
title: Version the output JSON Schema under its own path per release
description: The output document lives under a per-version path, schemas/5.2.0/silk-release-action-5.2.0.json today, and is referenced by $schema/$id in every payload, so an old payload's URL keeps resolving to the shape it was written against; the input schema stays unversioned beside it under schemas/.
status: draft
tags:
  - compat
  - release
sources:
  - id: schemastore-config
    resource: ../../lib/scripts/schemastore.config.ts
  - id: release-output
    resource: ../../src/schema/release-output.ts
  - id: schemastore-config-test
    resource: ../../__test__/schemastore-config.test.ts
generated:
  by: okfit/claude-code
---

# Version the output JSON Schema under its own path per release

## Context

The action emits a structured `result` output on every run, and every
payload carries a `$schema`/`$id` pointing at the document that describes
its shape (`SCHEMA_URL` in `src/schema/release-output.ts`[^release-output]).
A consumer that stores or replays an old payload relies on that URL
continuing to resolve to the schema the payload was actually written
against — a URL that a later, incompatible schema silently took over would
misdescribe every payload emitted before the change.

## Decision

The output JSON Schema lives at
`schemas/<version>/silk-release-action-<version>.json` — today
`schemas/5.2.0/silk-release-action-5.2.0.json` — rather than at an
unversioned path. The input schema
(`schemas/silk-release-action.input.schema.json`) stays unversioned: it
describes the action's own inputs, which this repository controls directly
and versions alongside the action's own releases, not a payload a consumer
might store independently. Both sit under `schemas/` because
`@effected/schemastore`'s `defineConfig` derives every path and `$id` from
one `outputDir`/`baseUrl` pair — nothing is spelled by hand, so a document's
identity cannot disagree with where it is written.

Generation is `@effected/schemastore-cli` over
`lib/scripts/schemastore.config.ts`[^schemastore-config]: `pnpm schema:build` writes,
`pnpm schema:check` is the identical walk with no writes and the CI gate.
The output entry carries `versions` (every label it advertises; all but the
`current` one are frozen files the CLI verifies exist but never regenerates)
and `published`. A label consumers depend on is `published: true`, and the
drift policy then refuses to rewrite its file in place when the change is a
contract change — a removed or renamed field, a changed type — failing with
a line that names the `$id`, the change and the suggested next label. The
response to a genuine contract break is appending a new label to `versions`
and moving `SCHEMA_URL` in `src/schema/release-output.ts` with it, which
writes a new file at the new version's path and leaves the published one
untouched. `published: false` — the state today, since the schema has never
been published — lets the current label iterate in place.

`--force` (sugar for `--drift=allow`) rewrites a published document in place
after a loud warning — correct only when repairing a document whose text no
longer parses, since using it on a version consumers already depend on is
exactly the silent re-pointing this decision exists to prevent.

## Alternatives rejected

**An unversioned root output file**, the arrangement before this decision.
A schema change under that scheme silently re-points every previously
emitted payload's `$schema`/`$id` at a shape it was never actually written
against, with no way for a consumer to detect the mismatch from the URL
alone.

**A repository-owned generation script.** `lib/scripts/generate-schema.ts`
used to hand-roll a preflight, then flag parsing, the contract gate and a
drift test around `SchemaPipeline`; every consumer of the package wrote the
same plumbing. `@effected/schemastore-cli` ships it once, and the repository
now owns only the target manifest (`lib/scripts/schemastore.config.ts`). The one thing
the CLI cannot see — that the derived `$id` equals the `SCHEMA_URL` payloads
carry — is pinned by a test instead.

## Consequences

An old payload's `$schema`/`$id` continues to resolve to the exact shape it
was written against indefinitely, because a contract change never
overwrites a published version's file — it always lands at a new path.
`pnpm schema:check` is the drift guard verifying both the input and the
output document stay in the committed, up-to-date state the CLI would
itself produce; `__test__/schemastore-config.test.ts`[^schemastore-config-test]
pins the config-derived `$id` to `SCHEMA_URL`[^release-output]. Bumping the
version is a two-file, matched change (`versions` in the config and
`SCHEMA_URL`); letting the two drift apart would mean the emitted payload's
URL and the file the CLI actually wrote disagree.

See [Bump the output schema version](../runbooks/bump-output-schema-version.md)
for the operational procedure and
[Release output interface](../interfaces/release-output.md) for the schema
v2 shape itself.

[^schemastore-config]: `../../lib/scripts/schemastore.config.ts`
[^release-output]: `../../src/schema/release-output.ts`
[^schemastore-config-test]: `../../__test__/schemastore-config.test.ts`
