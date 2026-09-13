---
type: Gotcha
title: "`Effect.logInfo` inside a group is buffered and discarded on success"
description: An info log written inside `grouped(...)` produces no line in the Actions log when the group succeeds, and that silence does not mean the code did not run.
resource: ../../src/utils/grouped.ts
tags:
  - observability
  - dx
stale_after: "2026-12-13T00:00:00Z"
sources:
  - id: grouped
    resource: ../../src/utils/grouped.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 3df39482b659ba8d51795bb3f272f5c7319577f51c01deb2f8d7871221650d84
status: draft
---

# `Effect.logInfo` inside a group is buffered and discarded on success

## What a reader sees

A phase body calls `grouped(name, effect)` (`src/utils/grouped.ts`) and
the wrapped effect calls `Effect.logInfo` one or more times along its
success path. The collapsible Actions log group for `name` appears in
the run log, but the `Effect.logInfo` lines inside it are missing.

## Wrong conclusion

That the code path carrying the `Effect.logInfo` calls did not run, or
that logging was misconfigured for that group.

## What is true

`grouped` resolves the kit's `ActionLogger` and defers to its `group`
member,[^grouped] which needs no paired step envelope to make output land
inside the group — unlike the predecessor's `Step.groupStep`, which
wrapped a body in both a group and a step because the step was what made
a success line land inside the group.[^grouped] `Effect.logInfo` calls
made through the default Effect logger inside that body are buffered and
discarded when the group's effect succeeds; they do not automatically
surface as live Actions-log output. Live output inside a group has to go
through the logger's own line-emitting members, not `Effect.logInfo`.
Phase bodies that want a visible line on success emit it themselves as a
summary line rather than relying on `Effect.logInfo` to appear.

[^grouped]: `../../src/utils/grouped.ts`
