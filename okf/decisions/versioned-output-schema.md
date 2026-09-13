---
type: Decision
title: Version the output JSON Schema under its own path per release
description: The output document lives under a per-version path, schemas/5.0.0/silk-release-action-5.0.0.json today, and is referenced by $schema/$id in every payload, so an old payload's URL keeps resolving to the shape it was written against; the input schema stays unversioned at the repo root.
status: draft
tags:
  - compat
  - release
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
  body_sha256: 9efcc9cd149343c0412bf4062aa911c5be81f66eb12fdfcf3867692e10dbd9d0
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
`schemas/5.0.0/silk-release-action-5.0.0.json` — rather than at an
unversioned root path. The input schema
(`silk-release-action.input.schema.json`) stays unversioned at the repo
root: it describes the action's own inputs, which this repository controls
directly and version alongside the action's own releases, not a payload a
consumer might store independently.

Generation delegates its contract gate to `@effected/schemastore`'s
`SchemaPipeline`[^generate-schema], run with the `contractChanges:
"block-versioned"` policy. That policy refuses to rewrite an
already-published version's file in place when the change is a contract
change — a removed or renamed field, a changed type — and fails instead
with a `SchemaContractChangeError` naming every affected document and the
`nextVersion` it suggests. The response to a genuine contract break is
bumping `SCHEMA_SEMVER` in `lib/scripts/generate-schema.ts` and `SCHEMA_URL`
in `src/schema/release-output.ts` together, which writes a new file at the
new version's path and leaves the previously published one untouched.

Two flags cover the rest of the generation script's surface: `--check`
(alias `--dry-run`) runs the same walk, reads `contractBlocked` and
`wouldWrite` off the check result, and writes nothing; `--allow-contract-change`
(alias `--force`) sets the policy to `allow` and rewrites a published
document in place after a loud warning — correct only while the version at
that label is genuinely unpublished, since using it on a version consumers
already depend on is exactly the silent re-pointing this decision exists to
prevent.

## Alternatives rejected

**An unversioned root output file**, the arrangement before this decision.
A schema change under that scheme silently re-points every previously
emitted payload's `$schema`/`$id` at a shape it was never actually written
against, with no way for a consumer to detect the mismatch from the URL
alone.

**A hand-rolled preflight check duplicating the pipeline's own gate.** The
generation script used to run its own `SchemaPipeline.check` preflight,
filtering for `change === "contract"`, ahead of calling `.run`. It
duplicated logic the pipeline already enforces internally and has been
removed; the pipeline's own gate inside `.run` is now the single source of
that check.

## Consequences

An old payload's `$schema`/`$id` continues to resolve to the exact shape it
was written against indefinitely, because a contract change never
overwrites a published version's file — it always lands at a new path.
`__test__/generate-schema.test.ts`[^generate-schema-test] is the drift
guard verifying both the input and the output document stay in the
committed, up-to-date state the generator would itself produce. Bumping the
version is a two-file, matched change (`SCHEMA_SEMVER` and `SCHEMA_URL`);
letting the two drift apart would mean the emitted payload's URL and the
file the generator actually wrote disagree.

See [Bump the output schema version](../runbooks/bump-output-schema-version.md)
for the operational procedure and
[Release output interface](../interfaces/release-output.md) for the schema
v2 shape itself.

[^generate-schema]: ../../lib/scripts/generate-schema.ts
[^release-output]: ../../src/schema/release-output.ts
[^generate-schema-test]: `../../__test__/generate-schema.test.ts`
