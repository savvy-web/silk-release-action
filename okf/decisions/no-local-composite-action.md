---
type: Decision
title: Disable the persistLocal composite action and its act smoke loop
description: "action.config.ts sets persistLocal.enabled to false, so no `.github/actions/local` composite is emitted and act-test.yml is gone; re-enabling it is a deliberate decision to start using act, not a default to restore."
status: draft
tags:
  - ci
  - bundle
sources:
  - id: action-config
    resource: ../../action.config.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 532a7ee2a097bbfac5b5307488af6d331ba20ef8de0c0e8f235392daec7f4d2c
---

# Disable the persistLocal composite action and its act smoke loop

## Context

The build canon this action is generated through (`@savvy-web/github-action-builder`)
offers a `persistLocal` slot: enabled, it emits a `.github/actions/local`
composite action wired for smoke-testing the built action with `act` before
it ships. This repository does not use `act` for local verification, and
committing the emitted composite would add a second copy of the bundle to
every checkout of this action for a workflow nobody runs.

## Decision

`action.config.ts` sets `persistLocal: { enabled: false, path:
".github/actions/local" }`[^action-config]. No `.github/actions/` directory
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

[^action-config]: `../../action.config.ts`
