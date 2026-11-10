---
type: Decision
title: Disable the persistLocal composite action and its act smoke loop
description: "effected.toml sets `[action.persistLocal] enabled = false`, so no `.github/actions/local` composite is emitted and act-test.yml is gone; re-enabling it is a deliberate decision to start using act, not a default to restore."
status: stable
tags:
  - ci
  - bundle
sources:
  - id: effected-toml
    resource: ../../effected.toml
generated:
  by: okfit/claude-code
  at: 2026-11-10T18:07:09Z
integrity:
  generated:
    body: 114c44d8e051b52f
  verified:
    by: human:spencer
    at: 2026-10-23T18:01:04Z
    content: 0249eec274b9cd27
verified:
  - by: human:spencer
    at: 2026-10-23T18:01:04Z
---

# Disable the persistLocal composite action and its act smoke loop

## Context

The build canon this action is generated through (`effected action build`,
from `@effected/plugin`, configured by the `[action]` table in
`effected.toml`) offers a `persistLocal` slot: enabled, it emits a `.github/actions/local`
composite action wired for smoke-testing the built action with `act` before
it ships. This repository does not use `act` for local verification, and
committing the emitted composite would add a second copy of the bundle to
every checkout of this action for a workflow nobody runs.

## Decision

`effected.toml`'s `[action.persistLocal]` table sets `enabled = false`
(with `path = ".github/actions/local"`)[^effected-toml]. No `.github/actions/` directory
exists in this repository, and no composite action is generated at that
path. `act-test.yml`, the workflow that would have exercised the emitted
composite through `act`, was removed along with disabling the slot rather
than left pointing at a build artifact that is never produced.

## Alternatives rejected

**Leave `persistLocal` enabled but stop running `act-test.yml`.** Rejected:
an emitted `.github/actions/local` composite with no workflow consuming it
is dead weight in every checkout, indistinguishable from a copy someone
forgot to wire up rather than a deliberate absence.

## Consequences

A new composite or TypeScript action in this repository gets its own
`.github/actions/<action-name>/` directory with its own `action.yml`; no
such directory exists today. Re-enabling `persistLocal` is a decision to
start running `act` locally, not a default configuration to restore — it
should come with a reason to run `act` again, not a reflex flip of the flag.

[^effected-toml]: `../../effected.toml`
