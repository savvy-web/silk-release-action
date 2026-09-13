---
type: Decision
title: Manifest sync guards need three independent legs, not two
description: The action.yml manifest, the NAMES tuples in src/schema/*, and what src/ actually reads and writes are three independent sources of truth; a two-way check lets the third drift silently.
status: draft
tags:
  - testing
  - dx
sources:
  - id: schema-inputs-test
    resource: ../../__test__/schema-inputs.test.ts
  - id: schema-outputs-test
    resource: ../../__test__/schema-outputs.test.ts
  - id: manifest-ts
    resource: ../../__test__/utils/manifest.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: b87b3f2b0b616a7ecbc73e0e579df0636bc96b9e733a1932c659c9036a2fd935
---

# Manifest sync guards need three independent legs, not two

## Context

`action.yml`, the `NAMES` tuples in `src/schema/inputs.ts` and
`src/schema/outputs.ts`, and what `src/` actually reads and writes are
three independent sources of truth for the same fact — which inputs and
outputs exist. A check comparing only two of the three lets the third
drift silently, which is exactly how this repo shipped a `build-command`
read no workflow could set, and a `custom-registries` input nothing
implemented, both surviving undetected for months (issue #215, since
rewired).[^manifest-ts]

## Decision

Each guard verifies three independent legs against each other: (1) the
manifest, read via `declaredInputNames` / `declaredOutputNames`, which
parse `action.yml`'s top-level `inputs:` / `outputs:` blocks directly by
indentation rather than pulling in a YAML dependency; (2) the `NAMES`
tuples declared in `src/schema/inputs.ts` and `src/schema/outputs.ts`;
and (3) what `src/` actually reads and writes, via `scanInputReads` /
`scanOutputWrites` scanning every non-test module under
`src/`.[^manifest-ts]

The input guard additionally enforces that each input is read in exactly
one place, bar a short allowlist with a stated reason per entry —
`pre.ts` reads `app-client-id`, `app-private-key`, and `github-token`
because it runs as a separate process before `main.ts`'s single decode
point exists, and `auto-merge.ts` is the definition site for
`auto-merge` — and that `dry-run` is decoded only to build the `DryRun`
service, never read a second time to make the same
decision.[^schema-inputs-test]

The output guard asserts that the pre-phase (`PRE_OUTPUT_NAMES`), the
structured (`STRUCTURED_OUTPUT_NAME`) and the main-scalar
(`MAIN_SCALAR_OUTPUT_NAMES`) name sets **partition** `OUTPUT_NAMES`
exactly — their concatenation sorts equal to `OUTPUT_NAMES` and contains
no duplicate — so an output cannot go missing by falling between the
three sets.[^schema-outputs-test]

## Alternatives rejected

**A two-way check between any pair of the three legs.** Any two legs
agreeing while the third drifts is precisely the failure mode this
repo already lived through twice: `build-command` and the manifest could
agree with each other while nothing in `src/` read it, and
`custom-registries` could be declared and even referenced without ever
being wired to a registry. A two-way check has no way to detect either
case; only scanning `src/` for actual reads and writes makes a dead read
or an unimplemented input visible.

## Consequences

The manifest, the `NAMES` tuples, and `src/`'s actual reads/writes must
be updated together whenever an input or output changes; the three-way
sync tests fail otherwise. This is the enforcement mechanism behind
[Single input decode point](../conventions/single-input-decode-point.md)
and the promise documented in
[Action inputs](../interfaces/action-inputs.md).

[^schema-inputs-test]: `../../__test__/schema-inputs.test.ts`
[^schema-outputs-test]: `../../__test__/schema-outputs.test.ts`
[^manifest-ts]: `../../__test__/utils/manifest.ts`
