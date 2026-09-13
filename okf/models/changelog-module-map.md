---
type: DataModel
title: Changelog module map
description: The id-to-bundle map that lets Phase 1 resolve a consumer's changeset changelog generator without installing the consumer's node_modules.
resource: ../../src/utils/native-version.ts
tags:
  - release
  - bundle
sources:
  - id: native-version
    resource: ../../src/utils/native-version.ts
  - id: action-config
    resource: ../../action.config.ts
  - id: changelog-silk
    resource: ../../src/changelog/silk.ts
  - id: changelog-default
    resource: ../../src/changelog/default.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: a7acb6f8f1dea3a43a1959ef0c1699aabfa2d3ea4a57da3b9e1b1895304d6272
status: draft
---

# Changelog module map

`CHANGELOG_MODULES` (`../../src/utils/native-version.ts:34-39`) is a
`Record<string, string>` mapping a changeset config's `changelog` module id
onto the absolute path of an action-shipped ESM bundle. Phase 1 (branch
management) runs zero-install: it versions in-process through the bundled
silk-effects `ReleasePlanner`, and this map is what lets that engine resolve
a changelog generator without the consumer's own `node_modules` being
present.[^native-version]

## The id → bundle map

Four known ids resolve to two bundles:

| Consumer's `changelog` id | Bundle |
| --- | --- |
| `@savvy-web/changelog` | `dist/changelog-silk.js` |
| `@savvy-web/silk/changesets/changelog` | `dist/changelog-silk.js` |
| `@savvy-web/changesets/changelog` | `dist/changelog-silk.js` |
| `@changesets/cli/changelog` | `dist/changelog-default.js` |

`dist/changelog-silk.js` is built from `../../src/changelog/silk.ts`, which
re-exports silk-effects' `Changesets.changelogFunctions`.
`dist/changelog-default.js` is built from `../../src/changelog/default.ts`,
which re-exports silk-effects' `Changesets.vanillaChangelogFunctions` (a
re-export of `@changesets/changelog-git`, kept behind the same silk-effects
vendor surface as the silk generator rather than a second direct
dependency). Both source paths resolve at runtime relative to
`dirname(fileURLToPath(import.meta.url))` — `HERE` — which is `dist/` once
bundled, so `CHANGELOG_MODULES`'s values are computed as
`resolve(HERE, "changelog-silk.js")` / `resolve(HERE, "changelog-default.js")`
rather than written as literal strings.

## What breaks if an entry is wrong

**An id absent from the map fails inside `ReleasePlanner.apply` with a typed
error naming the unrecognized id** — Phase 1 fails outright rather than
silently falling back to a default generator. This is a fix, not the
failure mode to fear: the map's job is to fail loudly and by name on an
id it does not recognize. What actually breaks the release quietly is the
inverse mistake — pointing an id at the *wrong* bundle (for example
swapping the `changelog-silk.js` and `changelog-default.js` entries): the
apply step still succeeds, but the CHANGELOG entries it writes come from
the wrong changelog function, and nothing downstream re-validates that the
generated prose matches the format the consumer's config actually asked
for.

## Why `build.nativeDynamicImports` is load-bearing

Both bundles are emitted as `workers` entries in `action.config.ts`
(`../../action.config.ts:8-11`) rather than folded into the main bundle,
because the changesets engine resolves the changelog module path at
*runtime* and dynamic-imports it by that resolved absolute path. Without
`build.nativeDynamicImports` set, rspack compiles a dynamic `import()` whose
specifier it cannot statically resolve into a context module — and a
context module throws `Cannot find module` for an on-disk path handed to it
at runtime, since it only knows the finite set of specifiers rspack saw at
build time. `nativeDynamicImports` keeps that `import()` a native, unbundled
runtime import instead, so `CHANGELOG_MODULES`'s absolute `resolve(HERE,
…)` paths actually load.

See also: [Native versioning decision](../decisions/native-versioning.md),
[Unrecognized changelog id gotcha](../gotchas/unrecognized-changelog-id.md).

[^native-version]: `../../src/utils/native-version.ts`
