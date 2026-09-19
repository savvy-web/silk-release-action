---
type: Decision
title: Pin the npm publish CLI to 12.x via the package manager's dlx launcher
description: Run every npm publish/pack invocation through the detected package manager's dlx launcher pinned to npm@12, never the runner's bundled npm; the pin is a major line, not latest, and moves only with a real-npm pack probe against the installed @effected/npm.
status: draft
supersedes: pin-npm-11.md
tags:
  - deps
  - compat
  - release
sources:
  - id: publish
    resource: ../../src/release/publish.ts
  - id: pair-test
    resource: ../../__test__/unit/release/npm-pin-pack.test.ts
  - id: issue-424
    resource: https://github.com/savvy-web/silk-release-action/issues/424
generated:
  by: okfit/claude-code
  at: 2026-09-19T21:14:04Z
  body_sha256: 1b3ffeecaf4128f4d067b6d2ab481de589974d311fa59461bc4f5edfa8856f00
---

# Pin the npm publish CLI to 12.x via the package manager's dlx launcher

## Context

[Pin the npm publish CLI to 11.x](pin-npm-11.md) moved every `pack` and
`publish` off the runner's bundled npm (10.x on Node 22/24 images, which
cannot do OIDC trusted publishing) onto `pnpm dlx npm@11`. It held at 11
for two reasons that were both true of npm 12.0.0 on 2026-07-08 and are
both gone: `npm pack --json` changed from an array to a name-keyed object,
which `@effected/npm` < 0.14.2 could not decode, and 12.0.0 shipped without
its bundled `sigstore` so every `npm publish` threw `MODULE_NOT_FOUND`
(npm/cli#9722, closed 2026-07-10). `@effected/npm@0.14.2` decodes both
`pack --json` shapes and `npm@12.0.2` bundles `sigstore` again.

The break was never observed in this repo before the move: no hosted
runner ships npm 12 yet, and the two consumers that closed the npm 12 loop
(silk-update-action, silk-runtime-action) do not shell `npm pack`. It was
reproduced deliberately, once, before the fix — `PackagePublish.dryRun`
through `pnpm dlx npm@12.0.2` on `@effected/npm@0.14.1` fails every
package with `PublishError kind:"output"` ("npm produced unreadable
output") while npm 11.19.1 passes; on 0.14.2 both pass[^issue-424].

## Decision

`NPM_EXECUTOR` in `src/release/publish.ts`[^publish] is
`NpmExecutor.dlx("npm@12")`. Every npm invocation this action makes —
`pack`, `publish`, `publish --dry-run` — runs through the detected package
manager's dlx launcher pinned to the `npm@12` **major line**: never the
runner's bundled npm (a dlx executor with no launcher fails typed rather
than degrading), and never `latest`. The kit is `@effected/npm` ≥ 0.14.2
(via `@effected/pnpm-plugin-effect` ≥ 0.8.15).

The pin and the kit's `pack --json` parser are versioned independently
and only meet at runtime, so the pair is proven against the kit's real
decoder, not a hand-written shape:
`__test__/unit/release/npm-pin-pack.test.ts`[^pair-test] runs the real
`PackagePublish.layer` and the real pnpm `LocalExec` launcher with only the
spawner scripted, replaying `pack --dry-run --json` output recorded from
the actual npm 11.19.1 and 12.0.2 binaries
(`__test__/unit/release/fixtures/npm-pack-json/`). It asserts the argv is
`pnpm dlx npm@12 …`, that both shapes decode, and — as the positive
control — that unreadable output still fails typed with `kind: "output"`.
It reads the exported `NPM_EXECUTOR`, not a copy of the spec. A live
subprocess against the registry was rejected for CI: it would make the
suite depend on registry reachability for a property that only changes
when the pin moves. **Moving the pin again means re-recording the fixture
from the new binary**, and running the suite against the kit actually
installed.

## Alternatives rejected

**Staying on `npm@11`.** Works today, but the 11 line is what every
Node 26 runner image already bundles and it will stop receiving fixes
before 12 does; holding a pin behind the line the runners ship on is
borrowing time against the same jump later, with less warning.

**Pinning `npm@12.0.2` exactly.** A patch-exact pin freezes out npm's
own security releases; the major line is the boundary the shape changes
and the `engines` floor actually move on.

**Pinning `latest`.** Rejected for the same reason as before: it broke
publishing once with no warning on 2026-07-08.

## Consequences

`npm@12.0.2`'s `engines.node` is `^22.22.2 || ^24.15.0 || >=26.0.0`. The
pin moved with `devEngines.runtime` on Node 26.9.0. Whoever next lowers
that floor below 24.15 (or onto a 22 line below 22.22.2) buys an
`npm warn cli … does not support Node.js` on every invocation — a warning,
not a failure, but it is the signal to read this decision.

Phase-2 dry-run and Phase-3 publish still run the identical npm binary
through one launcher, so a dry-run passing remains a real signal about
what the publish will do.

[^publish]: `../../src/release/publish.ts`
[^pair-test]: `../../__test__/unit/release/npm-pin-pack.test.ts`
[^issue-424]: <https://github.com/savvy-web/silk-release-action/issues/424>
