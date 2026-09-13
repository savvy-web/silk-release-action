---
type: Interface
title: The `result` output document
description: "The phase-discriminated JSON document the action emits as the `result` output, and the version contract it carries."
kind: wire
resource: ../../src/schema/release-output.ts
tags: [release, compat]
sources:
  - id: release-output-ts
    resource: ../../src/schema/release-output.ts
  - id: projections-ts
    resource: ../../src/schema/projections.ts
  - id: schema-5-0-0
    resource: ../../schemas/5.0.0/silk-release-action-5.0.0.json
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 1418fd75c63aa811150ddbdbc9c437adb64be946b7771d9303a9175dd0d3f01d
---

# The `result` output document

`ReleaseOutput` is a `Schema.Union` of three phase structs, discriminated by
a `phase` literal, and it is the single source of truth for the wire
contract: the committed, version-labelled JSON Schema document at
`schemas/<version>/silk-release-action-<version>.json` is generated from
it.[^release-output-ts] A consumer decoding the `result` output against that
committed document is decoding against the same shape the action itself
encodes with — there is no second, hand-maintained copy of the contract to
drift from the first.

## Identity: `schemaVersion`, `$schema`, `$id`

Every emitted document carries `schemaVersion: "2"` and a `$schema` field
equal to the hosted `SCHEMA_URL`, which points at the versioned document
under `schemas/<version>/` — currently
`https://raw.githubusercontent.com/savvy-web/silk-release-action/main/schemas/5.0.0/silk-release-action-5.0.0.json`.[^release-output-ts]
That same URL is the committed document's own `$id`.[^schema-5-0-0] The
version is **in the URL**, deliberately: an unversioned URL would silently
re-point an old payload at whatever contract the URL happens to resolve to
next, long after that payload was written. `schemaVersion` bumps only on a
breaking JSON-shape change — a removed or renamed field, or a changed type;
additive fields do not bump it. The full runbook for bumping it is
`../runbooks/bump-output-schema-version.md`, and the decision behind keeping
the schema versioned under its own path rather than one root file is
`../decisions/versioned-output-schema.md`.

## The three-phase union

`ReleaseOutput` discriminates on `phase` into `BranchManagementOutput`
(`phase: "branch-management"`), `ValidationOutput` (`phase: "validation"`),
and `PublishOutput` (`phase: "publish"`).[^release-output-ts] Every variant
shares the same top-level fields — `$schema`, `schemaVersion`, `phase`,
`success`, `outcome`, `summary`, `dryRun`, `failure`, `totals` — plus a
phase-specific payload (`branchManagement`, `validation`, or `publish`).

`success` and `outcome` are orthogonal by design, and this is the whole
point of the v2 shape: `success` is the one boolean a consumer should gate
on — true when the phase completed with nothing failed, including a run that
had nothing to do — and `outcome` is the taxonomy of *what specifically
happened*, drawn from a per-phase enum. A filter written against `success`
keeps working when a new `outcome` member is added later; a filter against
the old four-flag set (`status`/`noop`/`succeeded`/`hasFailures`) could not
make that promise, because those four had already drifted from their own
documentation by the time v2 replaced them. `summary` is one sentence
derived from the structured fields beside it and never authored
independently, so it cannot say something the data does not. `failure` is
null unless the phase failed, and names both the stage it stopped at and the
reason; it is never duplicated onto individual workspace or package entries,
which report only that they were blocked.

## The workspace is the unit, not the package

Both `publish.workspaces` and `validation.workspaces` are maps keyed by
workspace name, each carrying a parallel `order` array so a consumer
recovers the sequence a JSON object's keys cannot guarantee.[^release-output-ts]
Every workspace entry carries `kind`: `github-only` (resolved no publish
target — a version bump, a git tag, and a GitHub release; the steady state
for a private tracking package, not a degraded case) or
`github-with-packages` (resolved at least one publish target). `kind` is
classified once, from `../../src/utils/release-kind.js`, and both phases
report it in the same vocabulary so one word means one thing across the
whole run — see `../glossary/github-only.md`.

Beneath a workspace, `packages` is an array with **one entry per (package,
registry) pair**, not one entry per package — a workspace publishing the
same version to three registries produces three entries, and they may not
all share a name.[^release-output-ts] Validation's `ValidationPackage` and
publish's `PublishedPackage` describe the same unit deliberately: validation
dry-runs exactly what publish uploads, so one entry in
`validation.workspaces[name].packages` corresponds to one entry in
`publish.workspaces[name].packages`, and both carry a `registry` field typed
as the shared `PublishRegistry` struct (`name`, `type`, `url`) so a consumer
never has to reconcile two different registry shapes across the two
phases.[^release-output-ts]

## `releaseNotes` is absent from the emitted payload

The validation phase's internal `ValidationWorkspace` type carries an
optional `releaseNotes` field, and the schema declares it, but it is
populated only in-memory for the Release Notes Preview check and stripped
before the `result` output is serialized — the full CHANGELOG content is
rendered in the dedicated check row instead of being duplicated into the
JSON payload or the check-run summary's embedded JSON block, where it would
dominate the size and risk the check-summary byte cap.[^release-output-ts] A
consumer reading `result` for the extracted release notes will not find them
there by design; they are rendered, not carried.

## Every numeric field is an integer

All numeric fields across the union — component counts, byte sizes, file
counts, tag SHAs excluded — are declared `Schema.Int`, never bare
`Schema.Number`.[^release-output-ts] `Schema.Number` is a lossless JSON codec
that round-trips `Infinity`/`NaN` as string sentinels, so it lowers to a JSON
Schema `anyOf` including those literal strings instead of a plain
`{"type":"integer"}` — a shape a consumer's JSON Schema validator would
reject or mis-type against. The convention this generalizes to is
`../conventions/schema-numeric-fields.md`.

[^release-output-ts]: `../../src/schema/release-output.ts`
[^schema-5-0-0]: `../../schemas/5.0.0/silk-release-action-5.0.0.json`
