---
type: Gotcha
title: "`Effect.logInfo` inside a group is buffered and discarded on success"
description: An info log written inside `ActionLogger.group(...)` produces no line in the Actions log when the group succeeds, and that silence does not mean the code did not run.
tags:
  - observability
  - dx
stale_after: "2026-12-13T00:00:00Z"
sources:
  - id: action-logger
    resource: npm:@effected/github-actions
generated:
  by: okfit/claude-code
  at: 2026-11-06T01:10:37Z
status: draft
integrity:
  generated:
    body: f37a9f011fe6d6fd
---

# `Effect.logInfo` inside a group is buffered and discarded on success

## What a reader sees

A phase body calls the kit's `ActionLogger.group(name, effect)` and
the wrapped effect calls `Effect.logInfo` one or more times along its
success path. The collapsible Actions log group for `name` appears in
the run log, but the `Effect.logInfo` lines inside it are missing.

## Wrong conclusion

That the code path carrying the `Effect.logInfo` calls did not run, or
that logging was misconfigured for that group.

## What is true

The kit's `ActionLogger.group` member[^action-logger] needs no paired step envelope to make output land
inside the group — unlike the predecessor's `Step.groupStep`, which
wrapped a body in both a group and a step because the step was what made
a success line land inside the group.[^action-logger] `Effect.logInfo` calls
made through the default Effect logger inside that body are buffered and
discarded when the group's effect succeeds; they do not automatically
surface as live Actions-log output. Live output inside a group has to go
through the logger's own line-emitting members, not `Effect.logInfo`.
Phase bodies that want a visible line on success emit it themselves as a
summary line rather than relying on `Effect.logInfo` to appear.

[^action-logger]: `npm:@effected/github-actions`
