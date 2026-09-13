---
type: Decision
title: main.ts as guard, program.ts as composition, steps/ per phase body
description: main.ts is a 19-line entry guard, program.ts holds only composition, and each phase body is one module under steps/ with a declared failure posture.
status: draft
tags:
  - architecture
  - testing
  - dx
sources:
  - id: main-ts
    resource: ../../src/main.ts
  - id: program-ts
    resource: ../../src/program.ts
  - id: steps-dir
    resource: ../../src/steps
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: c3a7bb8f888d891e5a74e06ae7e790f57c7c1eea77c296f025835d01a219be8f
---

# main.ts as guard, program.ts as composition, steps/ per phase body

## Context

A prior single-file `main.ts` mixed three separable concerns — layer
construction, composition, and the phase bodies themselves — in one
module, and paid for that mixing in three concrete ways. The module
executed on import, so importing it in a test *ran the action*: nothing
in it could be exercised without actually triggering a release. Its step
bodies were consequently unreachable by any test; the extractions that
later became `steps/validation.ts`'s six modules
(`validation-checks.ts`, `publish-validation.ts`, `link-issues.ts`,
`build-validation.ts`, `per-step-checks.ts`,
`publish-validation-report.ts`) had never received coverage before the
split, which is how the green-on-crash degradation chain (issue #216)
survived undetected: no assertion had ever run the code path. And with
eleven `ActionInput` reads scattered through one file, plus more at call
sites, inputs drifted — the release-branch default string
`"changeset-release/main"` was restated six times, a dead input
(`build-command`) and an unimplemented one (`custom-registries`) both
survived undetected for months.

## Decision

`src/main.ts` is a 19-line entry guard only: a `GITHUB_ACTIONS` check and
`Action.run(main, { layer: MainLive })`, nothing else[^main-ts].
Composition lives in `src/program.ts`, which does nothing but read every
`action.yml` input once via `readInputs`, call `detectWorkflowPhase`, and
route through a five-arm switch (`branch-management`, `validation`,
`publishing`, `close-issues`, and a default no-op) to the matching step
function[^program-ts]. `program.ts` performs no I/O beyond those three
things, no formatting, and contains no step bodies itself; it is exported
so tests can drive the whole pipeline against test layers with no
module-level execution.

Each phase body is one module under `src/steps/`, and each module states
its failure posture in its own module docs next to its declared error
channel: an error channel of `never` means the step degrades rather than
failing the phase, and the docs must say what that degradation looks
like downstream — specifically, whether the step contributes a
*finding*, since findings are the only thing the Phase-2 verdict
reads[^steps-dir]. Pure derivations (values computed from already-decided
facts, with no I/O and no requirement channel) live outside `steps/`
rather than inside it — `steps/` is reserved for orchestration units that
do I/O.

Every `action.yml` input is decoded exactly once, in `schema/inputs.ts`;
phase bodies take the decoded values as parameters rather than reading
inputs themselves.

## Alternatives rejected

**Leaving phase bodies inline in `main.ts`.** This was the prior state,
and it is the thing being rejected: module-level execution on import made
the bodies untestable in principle, not just untested in practice, since
merely importing the module for a unit test would run the action.

**Reading inputs at each call site as needed.** This was also the prior
state (eleven scattered `ActionInput` reads plus more at call sites) and
is what produced six independent restatements of the release-branch
default and the two drifted, undetected inputs. A single decode point
that hands values down as parameters makes drift a type error or a test
failure instead of a silent divergence.

## Consequences

Issue #216 (the degraded-step-reports-green problem) became visible only
because the split gave the six `steps/validation.ts` extractions their
first-ever test coverage — see
[Degraded steps contribute findings, not booleans](degraded-steps-contribute-findings.md).
The single decode point in `schema/inputs.ts` plus a three-legged sync
test is what turns an input drift (a restated default, a dead or
unimplemented input) into a test failure instead of months of silent
divergence — see [Single input decode point](../conventions/single-input-decode-point.md).
The failure-posture-in-module-docs convention that `steps/` modules now
follow is stated in full in
[Declared failure postures](../conventions/declared-failure-postures.md).

[^main-ts]: `../../src/main.ts`
[^program-ts]: `../../src/program.ts`
[^steps-dir]: `../../src/steps`
