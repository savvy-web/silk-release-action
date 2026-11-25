---
type: Gotcha
title: "`Effect.logInfo` inside a group is buffered and discarded on success (no longer true)"
description: "Deprecated: under `@effected/github-actions` 0.36's `ActionLogger.step`, info logs inside a step are folded into the step's group on success, never dropped; the trap this described is gone."
tags:
  - observability
  - dx
sources:
  - id: action-logger
    resource: npm:@effected/github-actions
generated:
  by: okfit/claude-code
  at: 2026-11-21T22:19:59Z
status: deprecated
x-okfit-integrity:
  generated:
    body: 97e72f2e94a525af
---

# `Effect.logInfo` inside a group is buffered and discarded on success (no longer true)

## Status

Deprecated. The trap was fixed upstream: `@effected/github-actions` 0.36
removed `ActionLogger.withStep`, `withBuffer` and `heading`, and this
repository no longer calls `ActionLogger.group` anywhere in `src/`.[^action-logger]

## What used to be true

An `Effect.logInfo` line written inside a log group was buffered and
discarded when the group's effect succeeded, so a missing line did not
mean the code had not run, and phase bodies emitted their own summary
lines to stay visible.

## What is true now

Every unit of work runs under `ActionLogger.step(name, effect, options)`.
A step holds its detail (every log line below `Warn`, `Effect.logInfo`
included) and, on success, writes one folded `::group::` titled by its
result line (`✓ <summary or name> · <duration>`, or `⚠` when it logged a
warning or recovered from a nested failure) with the held detail inside
it. Nothing is discarded. A failing step writes `✗` and its detail
unfolded, then the failure propagates. A step that runs past its window
(30 seconds by default) streams its detail live instead. Warnings and
errors are never held: they go out at once as annotations.[^action-logger]

So a line missing from a successful step's output is inside the folded
group, not dropped. The current log model is described under Key
patterns in [release-action](../modules/release-action.md).

[^action-logger]: `npm:@effected/github-actions`
