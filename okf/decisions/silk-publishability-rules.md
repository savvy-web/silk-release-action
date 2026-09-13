---
type: Decision
title: Silk publishability rules invert the private flag and live upstream
description: Silk-mode publishability is derived from publishConfig with the private flag as a last-resort default, inverting the @effected/workspaces vanilla default; the rules live in silk-effects and every phase resolves through one ignore-aware adaptive detector.
status: draft
tags:
  - release
  - architecture
sources:
  - id: layers-module
    resource: ../../src/release/layers.ts
  - id: changeset-config-module
    resource: ../../src/release/changeset-config.ts
  - id: detect-repo-type
    resource: ../../src/utils/detect-repo-type.ts
  - id: publishability-int-test
    resource: ../../__test__/integration/publishability.int.test.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 19491e76b3b4cae46eb25b5344bb27dbbbb152b51bf3484b2d6c22fdea7271b4
---

# Silk publishability rules invert the private flag and live upstream

## Context

`@effected/workspaces`' built-in `PublishabilityDetectorLive` treats
`package.json#private: true` as a hard "not publishable" stop. Silk's own
convention is the inverse of that default: in a silk-mode workspace,
`private: true` on the source `package.json` is the norm — it keeps a
package out of an accidental `npm publish` and out of a transitive public
install — and publishability instead comes from `publishConfig`. The silk
build pipeline rewrites `private: false` onto the real publish artifact
(e.g. `dist/prod/npm/pkg`) while leaving the dev/link artifact
(`publishConfig.directory`, e.g. `dist/dev/pkg`) private, so consulting the
vanilla detector's `private` flag on the source manifest would answer the
wrong question for a silk repo.

## Decision

The silk publishability rules live upstream, in `@savvy-web/silk-effects`
as `SilkPublishability`, not in this repository — the local
`src/release/publishability.ts` was retired when silk-effects 5.2 landed
service-owned layer statics. `src/release/layers.ts` composes the
ignore-aware adaptive layer over this repo's own `ChangesetConfigLive`:[^layers-module]

`SilkPublishability.layer` (the silk rules) resolves precedence in this
order, regardless of `private`:

1. `publishConfig.targets` non-empty → resolve each target (string
   shorthands `"npm"` / `"github"` / `"jsr"` / URL strings expand; object
   targets may override access and registry); targets whose resolved
   access is not `"public"` or `"restricted"` are dropped.
2. `publishConfig.access` set, no `targets` → one target using that access.
3. `private !== true` (no usable `publishConfig`) → one default target.
4. Otherwise (private, no usable `publishConfig`) → not publishable
   (empty array).

`SilkPublishability.layerAdaptive` is the single entry point every phase
resolves through. It short-circuits any package whose name matches the
changeset `ignore` globs to `[]` regardless of mode — via
`ChangesetConfig.isIgnored`, which uses the shared `matchesIgnorePattern`
matcher exported from `src/utils/detect-repo-type.ts`[^detect-repo-type] —
then reads `ChangesetConfig.mode` per call and dispatches to the silk
override (silk mode), the library's vanilla `PublishabilityDetectorLive`
(vanilla mode), or a no-op detector returning `[]` for every package (none
mode). `src/release/layers.ts` provides `SilkPublishability.layerAdaptive`
over `ChangesetConfigLive`, listing the config layer twice: once directly
for Phase-2/3 consumers that read `ChangesetConfig` themselves, and once as
the provider for the adaptive detector.[^layers-module] Every publishability
path — Phase 1's `listPublishablePackages`/`isMonorepoForTagging`, Phase
2's `runValidation` via `resolvePublishableTargets`, and Phase 3's
`runPublishTargets` via `PublishabilityDetector` — resolves through this
one layer, so ignored packages never appear even as version-only rows.

`ChangesetConfig.mode` is itself decoded by the bundled silk-effects
`ChangesetConfigReader` from the changelog id declared in the consumer's
`.changeset/config.json`.[^changeset-config-module] This makes the
bundled reader's silk-marker id set load bearing: an id the reader does not
recognize silently degrades the repo to vanilla rules, where the
`@effected/workspaces` default resolves the single target at
`publishConfig.directory` — the private `dist/dev/pkg` dev artifact —
instead of the prod byte groups (see [Unrecognized changelog id silently
degrades to vanilla
publishability](../gotchas/unrecognized-changelog-id.md)).

The `publishConfig`-first precedence (targets, then access, then `private`
as a last resort) fixed a regression: a public source package (`private:
false`) declaring `publishConfig.targets` was previously short-circuited to
a single default target at `publishConfig.directory` — the private
`dist/dev` artifact — which the build's private-artifact filter then
dropped, misclassifying a publishable package as version-only. Consulting
`publishConfig` before `private` is what lets a package with declared
targets resolve to those targets instead of collapsing to the dev
directory's default.

## Alternatives rejected

**Using `@effected/workspaces`'s vanilla `PublishabilityDetectorLive`
unconditionally.** Rejected because its `private: true` → not-publishable
rule is exactly backwards for a silk-mode workspace, where `private: true`
on the source manifest is the norm and says nothing about whether the
built artifact is publishable.

**Keeping the silk rules local to this repository.** Rejected once
silk-effects 5.2 added service-owned layer statics — the rules are
identical across `silk-release-action`, `silk-update-action`, and the silk
`changesets` package, so a repo-local copy would drift from the other two
the moment one changed.

**Answering `private` before `publishConfig`.** Rejected because it is the
precedence that produced the regression above: a public source package
whose real publish target lived outside `publishConfig.directory` was
misread as private-only.

## Consequences

Every phase of this action shares one detector, so a package classified as
publishable (or not) in Phase 1's release-PR table cannot disagree with
Phase 2's validation or Phase 3's actual publish — there is one place the
rule is encoded. Changeset-ignored packages are invisible to every phase,
not merely excluded from publishing, so they never generate a version-only
row a maintainer might mistake for an intended release. The
`ChangesetConfigReader`'s silk-marker id set becomes a repository-wide
dependency: bumping silk-effects without checking that set against a
consumer's changelog id can silently flip a whole workspace to vanilla
rules.

[^layers-module]: ../../src/release/layers.ts
[^changeset-config-module]: ../../src/release/changeset-config.ts
[^detect-repo-type]: ../../src/utils/detect-repo-type.ts
