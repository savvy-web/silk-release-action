---
type: Decision
title: Version the output JSON Schema under its own path per release
description: Both JSON Schema documents live under a per-version path, schemas/5.2/silk-release-action.output-5.2.json and schemas/5.2/silk-release-action.input-5.2.json today, and the output one is referenced by $schema/$id in every payload, so an old payload's URL keeps resolving to the shape it was written against.
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
`schemas/<version>/silk-release-action.output-<version>.json` — today
`schemas/5.2/silk-release-action.output-5.2.json` — rather than at an
unversioned path. The input schema sits beside it under the same label,
`schemas/<version>/silk-release-action.input-<version>.json`: it describes
the action's own inputs, so it has no payload-replay problem of its own, but
one layout and one label for both documents keeps the config and the
constants that name them to a single version. Both derive from
`@effected/schemastore`'s `defineConfig`, which builds every path and `$id`
from one `outputDir`/`baseUrl` pair plus the label — nothing is spelled by
hand, so a document's identity cannot disagree with where it is written. The
base URL and label are the `OUTPUT_SCHEMA_URL`/`OUTPUT_SCHEMA_VERSION`
constants in `src/schema/silk-release-config.ts`, and `SCHEMA_URL` and
`INPUT_SCHEMA_URL` are template-literal derivations of the same two.

Generation is `@effected/schemastore-cli` over
`lib/scripts/schemastore.config.ts`[^schemastore-config]: `pnpm schema:build` writes,
`pnpm schema:check` is the identical walk with no writes and the CI gate.
Each entry carries `versions` (every label it advertises; all but the
`current` one are frozen files the CLI verifies exist but never regenerates)
and `published`. A label consumers depend on is `published: true`, and the
drift policy then refuses to rewrite its file in place when the change is a
contract change — a removed or renamed field, a changed type — failing with
a line that names the `$id`, the change and the suggested next label. The
response to a genuine contract break is bumping `OUTPUT_SCHEMA_VERSION`
(which moves `SCHEMA_URL`, `INPUT_SCHEMA_URL` and both entries' `current`
label together) while keeping the old label in `versions`, which writes new
files at the new version's path and leaves the published ones untouched. `published: false` — the state today, since the schema has never
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
pins the config-derived `$id`s to `SCHEMA_URL`[^release-output] and
`INPUT_SCHEMA_URL`. Bumping the version is one constant plus keeping the old
label in `versions`; a URL spelled by hand instead of derived would be the
only way the emitted payload's URL and the file the CLI actually wrote could
disagree, and the test exists to catch exactly that.

See [Bump the output schema version](../runbooks/bump-output-schema-version.md)
for the operational procedure and
[Release output interface](../interfaces/release-output.md) for the schema
v2 shape itself.

[^schemastore-config]: `../../lib/scripts/schemastore.config.ts`
[^release-output]: `../../src/schema/release-output.ts`
[^schemastore-config-test]: `../../__test__/schemastore-config.test.ts`
