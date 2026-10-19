---
type: Convention
title: A numeric output-schema field is Schema.Int, never bare Schema.Number
description: Every numeric field in the output schema must be an integer bounded by its meaning (Schema.Natural for counts, at least 1 for a PR number), or Schema.Finite when it genuinely holds a fraction; never bare Schema.Number, and never an upper cap on an output field.
tags:
  - compat
  - dx
stale_after: "2026-12-13T00:00:00Z"
sources:
  - id: release-output-ts
    resource: ../../src/schema/release-output.ts
generated:
  by: okfit/claude-code
  at: 2026-10-19T21:34:10Z
status: draft
integrity:
  generated:
    body: b06ef0d93d3cced3
---

# A numeric output-schema field is Schema.Int, never bare Schema.Number

Declare a numeric field in `src/schema/release-output.ts` as `Schema.Int`
unless it genuinely holds a fraction, in which case use `Schema.Finite` as
the floor. Never declare a numeric field as bare `Schema.Number`.

Bound the integer by what it means. A count, a byte size or a duration is
`Schema.Natural` (an `Int` at least 0). The release PR `number` is
`Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))`, since GitHub never
issues 0. The release `id` stays `Schema.Natural`, because a dry-run emits
`0` for a release it did not create. Every other integer in
`release-output.ts` is `Schema.Natural`.[^release-output-ts]

Never put an upper cap on an output field. `result` is Schema-encoded at
emission and tolerates its own encode failure, so a value past the cap does
not fail the run: it drops the whole `result` document, and every consumer
reading it gets nothing. Caps belong on inputs, where a rejected decode is
the point. The input's `sbom.copyright.startYear` is bounded 1970–2100 for
that reason.

Since `effect` 4.0.5, a bare `Schema.Int` also emits `minimum` and `maximum`
at the safe-integer limits, so an unbounded field advertises negative values
as valid in the published JSON Schema.

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
