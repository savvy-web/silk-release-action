---
type: Convention
title: Decode every action.yml input in schema/inputs.ts, nowhere else
description: Read an action.yml input in src/schema/inputs.ts and nowhere else outside a short, stated allowlist; add a new input to action.yml, INPUT_NAMES, and the read in one change.
tags:
  - dx
  - testing
stale_after: "2026-12-13T00:00:00Z"
sources:
  - id: inputs-ts
    resource: ../../src/schema/inputs.ts
  - id: schema-inputs-test
    resource: ../../__test__/schema-inputs.test.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: f8eac66bfae2b9ec0adbb9d649dbdcbf09fc9309ab342294d982ab6a1bc3c14e
status: draft
---

# Decode every action.yml input in schema/inputs.ts, nowhere else

Read an `action.yml` input inside `src/schema/inputs.ts` and nowhere else,
bar a short allowlist of modules that each state a reason for the extra
read.[^inputs-ts] `__test__/schema-inputs.test.ts` scans the tree for
every other reader and fails the run on anything not in the
allowlist.[^schema-inputs-test] The allowlist, verified against the tree,
currently holds four entries:

- `app-client-id`, `app-private-key`, `github-token` — read in
  `src/pre.ts`, which runs as a **separate process** from `main` and
  cannot be handed `main`'s already-decoded record, so it decodes the
  three values it needs to mint the App token itself.
- `auto-merge` — read in `src/utils/auto-merge.ts`, the **definition
  site** of `autoMergeMethodConfig`, which `schema/inputs.ts` imports and
  composes rather than duplicates.
- `npm-token` — read in `src/release/publish.ts`, at the publish
  boundary, with `Config.option` semantics that differ from the `Inputs`
  field's `withDefault("")`.
- `sbom-config` — read in `src/utils/load-release-config.ts`, with a
  `.trim()` the `Inputs` field does not apply.

Everything absent from this list decodes in `schema/inputs.ts` alone.
Treat a new allowlist entry as a smell rather than a template: each
existing one is a single read with semantics the shared decode cannot
give it for free, not a shortcut to reach for by default.

Decode `dry-run` in `schema/inputs.ts` only to build the `DryRun` service.
Every other consumer asks `DryRun` rather than re-reading the `dry-run`
input, so there is exactly one place a caller can get the wrong answer.

Decode `phase` against the literal `WorkflowPhase` union via
`Schema.decodeUnknownEffect`, never through an `as WorkflowPhase` cast. A
cast lets a typo (`publshing`) satisfy the type, miss every switch arm,
fall through to the default no-op, and return with the job green while
the release did nothing; the decode fails the run at the point of the
typo instead.

When a new input is needed, add it to `action.yml`, to the `INPUT_NAMES`
const tuple, and to the read in `schema/inputs.ts` in the same change.
`__test__/schema-inputs.test.ts` checks all three legs of this sync — the
manifest, the tuple, and what the code actually reads — against each
other; a change to only two of the three is exactly how a dead input
(`build-command`) and an unimplemented one (`custom-registries`) both
survived undetected for months.

See [Three-legged manifest guards](../decisions/three-legged-manifest-guards.md)
for why the check is three-way rather than a simple diff, and
[Action inputs and outputs](../interfaces/action-inputs.md) for the
contract these decoded values honor.

[^inputs-ts]: `../../src/schema/inputs.ts`
[^schema-inputs-test]: `../../__test__/schema-inputs.test.ts`
