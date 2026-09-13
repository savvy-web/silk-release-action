---
type: Convention
title: A numeric output-schema field is Schema.Int, never bare Schema.Number
description: Every numeric field in the output schema must be Schema.Int, or Schema.Finite when it genuinely holds a fraction; never bare Schema.Number.
tags:
  - compat
  - dx
stale_after: "2026-12-13T00:00:00Z"
sources:
  - id: release-output-ts
    resource: ../../src/schema/release-output.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 76a2c722a5a15a8068e1ff6de128bb103da1df93bdcd87494e400ed394cb1908
status: draft
---

# A numeric output-schema field is Schema.Int, never bare Schema.Number

Declare a numeric field in `src/schema/release-output.ts` as `Schema.Int`
unless it genuinely holds a fraction, in which case use `Schema.Finite` as
the floor. Never declare a numeric field as bare `Schema.Number`. All 31
numeric fields in `release-output.ts` are `Schema.Int` today, verified
against the file.[^release-output-ts]

`Schema.Number` is a lossless JSON codec: it round-trips `Infinity`,
`-Infinity` and `NaN` by encoding them as string sentinels rather than
refusing them, so it lowers to a JSON Schema `anyOf` of `number` and those
sentinel-string literals instead of a plain `{"type": "integer"}` or
`{"type": "number"}`. That shape also drops any annotation set on the
field once the definition is hoisted into `$defs` for reuse. A field
declared this way silently changes the published contract's shape and
loses its documentation at the same time, which is why the choice matters
at the schema-generation boundary and not only at the type level.

Apply this at the point a field is first declared, not as a follow-up
pass: a bare `Schema.Number` typechecks identically to `Schema.Int` for
every value that stays inside safe-integer range, so nothing short of
inspecting the generated JSON Schema catches the drift.

See [Action inputs and outputs](../interfaces/action-inputs.md) and
[Release output](../interfaces/release-output.md) for the contracts this
schema publishes.

[^release-output-ts]: `../../src/schema/release-output.ts`
