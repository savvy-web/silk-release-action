---
type: Decision
title: Version natively via the bundled silk-effects ReleasePlanner
description: Phase 1 versions in-process through the bundled silk-effects ReleasePlanner instead of shelling out to a consumer ci:version script, making Phase 1 zero-install.
status: draft
tags:
  - release
  - performance
  - deps
sources:
  - id: native-version
    resource: ../../src/utils/native-version.ts
  - id: format-workspace
    resource: ../../src/utils/format-workspace.ts
  - id: release-layers
    resource: ../../src/release/layers.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 9333b848cf116b9123cf15fab36cb66f8191fbb88dbf436c05c3fb9d6327b30a
---

# Version natively via the bundled silk-effects ReleasePlanner

## Context

Shelling out to a consumer's `ci:version` script forced Phase 1 to run a
full dependency install just to bump versions and write changelogs — the
slowest part of an otherwise API-only phase. It also coupled the
action's versioning behavior to whatever each consumer's script happened
to do, so the version step could drift between repositories.

## Decision

Phase 1 versions in-process via the bundled silk-effects
`Changesets.ReleasePlanner`, the same engine `savvy changeset version`
runs, driven by `runNativeVersion(cwd)`[^native-version]. There is no
consumer `ci:version` script invocation, no `version-command` input, and
the shared workflow passes `install-deps: false` — Phase 1 genuinely
needs no `node_modules` install. `NativeVersioningLive` in
`src/release/layers.ts` wires `Changesets.ReleasePlanner.layer` over
`ConfigInspector.layer`, provided by `ChangesetConfigReader.layer` and
the shared `WorkspacesLive`, and is merged into `ReleaseLive`, piped
exactly once[^release-layers].

`runNativeVersion` first validates `.changeset/config.json` when one is
present via `Changesets.ConfigInspector` — an absent config proceeds,
matching the savvy CLI's own gate.

**Changelog id map.** The consumer's changeset config names a changelog
generator by module id. `CHANGELOG_MODULES` maps the known ids
(`@savvy-web/changelog`, `@savvy-web/silk/changesets/changelog`, and
`@savvy-web/changesets/changelog`, all onto the silk-effects
`changelogFunctions` bundle; `@changesets/cli/changelog` onto the
`@changesets/changelog-git` bundle) onto action-shipped ESM bundles
rather than packages a consumer would otherwise have to install. An
unmapped id fails inside `ReleasePlanner.apply` with a typed error naming
it. The bundles are emitted as `workers` entries in `action.config.ts`,
and `build.nativeDynamicImports` keeps the runtime dynamic imports inside
`@changesets/apply-release-plan` and `@effected/workspaces` native,
because rspack would otherwise compile them into context modules that
throw on on-disk paths. See
[Changelog module map](../models/changelog-module-map.md).

**Token scoping.** The changelog's GitHub-info fetch
(`@changesets/get-github-info`) reads `process.env.GITHUB_TOKEN`
directly, so `runNativeVersion` calls `GitHubToken.read()` itself and
sets that variable strictly around the `apply` call — the App token wins
over any ambient `GITHUB_TOKEN` the job exports — restoring the prior
value afterward. This mutates shared process environment and is
deliberately not parallel-safe; Phase 1 is strictly sequential by design,
so no concurrent apply is ever in flight while the variable is set. See
[Never set GITHUB_TOKEN persistently](never-set-github-token.md) for the
token landscape this sits inside.

**Reset-then-retry.** `apply` is not idempotent — it deletes the
changesets it consumes — so a bare retry on a half-applied tree would
corrupt the release. On a transient failure (matched against
`ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `EAI_AGAIN`, or `fetch failed`)
the flow resets the tree first (`Git.restore` + `Git.clean`, both pinned
to the same `cwd` the apply itself operates on), pauses one second, and
retries exactly once via a fresh invocation thunk rather than replaying
the first attempt's already-settled Effect.

**Format-preserving `versionFiles` writes.** The bundled silk-effects
engine applies changesets `versionFiles` bumps as in-place jsonc edits
rather than a `JSON.parse`/`JSON.stringify` round trip, so a version bump
produces a one-line diff with inline arrays, indentation, and JSONC
comments surviving byte-for-byte. This is what makes the post-version
Biome pass non-load-bearing for formatting integrity: `versionFiles`
correctness no longer depends on it.

**Post-version formatting.** `formatWorkspaceWithBiome`
(`src/utils/format-workspace.ts`) replaces the `&& biome format --write .`
tail of the removed consumer script, probing for the standalone `biome`
binary via `ToolDiscovery`[^format-workspace]. Its warn-vs-fail policy: a
missing binary with a `biome.json(c)` present warns and continues (Phase
1 is deliberately zero-install, so the binary may genuinely not be
installed); a present config the standalone binary cannot resolve
(matched on `could not resolve|module not found` — the case where a
silk-suite repo's config `extends` the `@savvy-web/silk/biome` package,
which only exists once `node_modules` is installed) also warns and
continues; any other non-zero format exit fails the phase, since that
signals a real formatting problem the repository asked to have caught.
Because `versionFiles` writes are already format-preserving, a skipped
format pass under either warn case no longer leaves serializer-reformatted
JSON sitting in the release PR the way it would have before the
format-preserving change.

## Alternatives rejected

**Shelling out with a full install.** This was the prior approach: invoke
the consumer's `ci:version` script, which required installing the full
dependency tree first just to run a version bump. It made Phase 1 the
slowest step for no benefit proportional to the cost, and it let each
consumer's script behave slightly differently, coupling this action's
correctness to scripts it does not own.

## Consequences

Phase 1 is genuinely zero-install: the shared workflow passes
`install-deps: false` and the versioning step never touches a consumer's
`node_modules`. The changelog id map removes the last `node_modules`
dependency the version step had — a consumer's changeset config still
names a changelog generator, but the name now resolves to an
action-shipped bundle. Versioning behavior no longer depends on
consumer-authored script content, so it behaves identically across every
repository that uses this action.

[^native-version]: `../../src/utils/native-version.ts`
[^format-workspace]: `../../src/utils/format-workspace.ts`
[^release-layers]: `../../src/release/layers.ts`
