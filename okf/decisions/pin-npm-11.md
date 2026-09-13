---
type: Decision
title: Pin the npm publish CLI to 11.x via the package manager's dlx launcher
description: Run every npm publish/pack invocation through the detected package manager's dlx launcher pinned to npm@11 rather than the runner's bundled npm, so OIDC trusted publishing works and npm 12's pack/publish breakage is avoided.
status: draft
tags:
  - deps
  - compat
  - release
sources:
  - id: layers
    resource: ../../src/release/layers.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: cc8caf19aa90717bf38a090dcc035c084ff10460296d5f602b8ec43c5db176dc
---

# Pin the npm publish CLI to 11.x via the package manager's dlx launcher

## Context

Node 24, the runtime version this action ships on, bundles npm 10.x, which
lacks OIDC trusted publishing entirely — the feature this repository relies
on for npm and JSR (see
[OIDC-first authentication](oidc-first-authentication.md)). Moving to
`latest` instead of a fixed npm version is not a safe substitute: npm
12.0.0, which took the `latest` dist-tag on 2026-07-08, changed `npm pack
--json`'s output from an array of pack-result entries to a name-keyed
object, and every publish through the old array-shaped parsing failed with
"npm pack returned empty result." The same npm 12.0.0 release also throws
`MODULE_NOT_FOUND: sigstore` from `npm publish` (npm/cli#9722), an
unrelated regression that would break publishing outright even once the
`pack --json` shape were handled.

## Decision

`LocalExecLive` in `src/release/layers.ts`[^layers] is built from
`Workspaces.localExecLayer()`, which resolves its dlx executor from the
**detected** package manager rather than asserting one statically — so
`NpmExecutor.dlx` resolves to `pnpm dlx npm@11` in a pnpm workspace and the
equivalent dlx invocation for another manager elsewhere. Every npm
invocation in this action — `pack`, `publish`, `publish --dry-run` — runs
through this launcher pinned to the `npm@11` line, never the runner's
bundled npm and never an unpinned `latest`. A dlx executor with no
resolvable launcher fails typed rather than silently falling back to the
runner's own npm, which cannot do OIDC trusted publishing at all.

## Alternatives rejected

**A static `LocalExec.layerFor("pnpm", …)` asserting pnpm unconditionally.**
This was the predecessor's approach; it asserted pnpm regardless of which
package manager the workspace actually used, which breaks on any other
manager and does not resolve the npm-version problem this decision solves
on its own.

**Pinning to `npm@latest`.** Rejected because `latest` is a moving target
that already broke publishing once, with no warning, on 2026-07-08; a fixed
minor line is the only way a Phase-2 dry-run and a Phase-3 publish are
guaranteed to run the same npm binary indefinitely rather than by
coincidence of when each ran.

**Leaving Node's bundled npm 10.x in place.** Rejected outright: it lacks
OIDC trusted publishing, the mechanism this action's whole authentication
model depends on.

## Consequences

Phase-2 dry-run validation and the Phase-3 publish always run against the
identical npm binary, because both dispatch through the same launcher; a
dry-run passing is a real signal about what the publish will do. The
`@effected/npm` kit reads both the pre-12 array-shaped and the 12+
name-keyed `pack --json` output, so a future re-pin forward of npm 11 does
not require re-deriving the parsing logic from scratch, only re-verifying
which shape the new pinned version emits.

[^layers]: ../../src/release/layers.ts
