---
type: Gotcha
title: A Schema.isPattern check without the u flag publishes no pattern
description: "A string field checked with Schema.isPattern(/…/) rejects bad values at decode, so it looks constrained; the generated JSON Schema carries no pattern at all unless the RegExp has the u flag, so editors and validators accept anything."
resource: ../../src/schema/silk-release-config.ts
tags:
  - compat
  - dx
stale_after: "2027-01-19T00:00:00Z"
sources:
  - id: silk-release-config-ts
    resource: ../../src/schema/silk-release-config.ts
  - id: effect-schema-ts
    resource: ../../.repos/effect/packages/effect/src/Schema.ts
status: draft
generated:
  by: okfit/claude-code
  at: 2026-10-19T21:40:37Z
integrity:
  generated:
    body: bffd8f5ec0db5310
---

# A Schema.isPattern check without the u flag publishes no pattern

## What a reader sees

A field declared `Schema.String.check(Schema.isPattern(/^https?:\/\/\S+$/))`
rejects `docs.example` at decode, and its test goes red without the check.
`pnpm schema:check` reports the generated documents current.

## Wrong conclusion

The published JSON Schema constrains the field the same way the decoder
does, so an editor or a consumer's validator flags the bad value before the
action ever runs.

## What is actually true

`Schema.isPattern` exports a `pattern` keyword only when the RegExp's flags
match `^[dg]*uy?$` — in practice, only when it carries the `u`
flag.[^effect-schema-ts] An unflagged RegExp lowers to a bare
`{"type":"string"}`: the runtime check still runs, and the published
contract silently says nothing. Nothing fails, because the decoder and the
schema generator are both behaving as written.

Write every pattern as `/…/u`. The SBOM field shapes in
`src/schema/silk-release-config.ts` (`SbomUrl`, `SbomEmail`) and the
`snapshot-tag` check in `src/schema/inputs.ts` all do.[^silk-release-config-ts]
To confirm a new one, read the field back out of
`schemas/<version>/input.json` and check that `pattern` is present.

[^effect-schema-ts]: `../../.repos/effect/packages/effect/src/Schema.ts` (`isPattern`, `canExport`)
[^silk-release-config-ts]: `../../src/schema/silk-release-config.ts`
