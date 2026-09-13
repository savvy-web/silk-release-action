---
type: Gotcha
title: An unrecognized changelog id silently degrades publishability to vanilla rules
description: "Phase 3 publishing a dev artifact with unresolved catalog: / workspace: specifiers looks like a broken build, but the real cause is a changeset changelog id the bundled silk-effects' silk-marker set does not recognize."
resource: ../../src/release/changeset-config.ts
tags:
  - release
  - deps
  - compat
stale_after: "2026-12-13T00:00:00Z"
sources:
  - id: changeset-config
    resource: ../../src/release/changeset-config.ts
  - id: issue-143
    resource: "https://github.com/savvy-web/silk-release-action/issues/143"
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: d73132d6a20e7ae130ebf3a126d73a16737018422ae93d970d5d3d0ceb6c9b5b
status: draft
---

# An unrecognized changelog id silently degrades publishability to vanilla rules

## What a reader sees

Phase 3 publishes a workspace's `dist/dev/pkg` byte group instead of a
prod byte group, or publishes a tarball carrying unresolved `catalog:` /
`workspace:` specifiers a consumer cannot install. The job itself is
green.

## Wrong conclusion

That the build is broken, or that native versioning wrote a bad package.

## What is true

`src/release/changeset-config.ts` re-exports the silk `ChangesetConfig`
service, composed with the bundled silk-effects `ChangesetConfigReader`.
[^changeset-config] `ChangesetConfig.mode` is decoded from the changelog
id in the consumer's `.changeset/config.json`, and that decode is
load-bearing for which publishability rules apply:
`SilkPublishability.layerAdaptive` dispatches to the silk override only
when `mode` decodes as silk. An id the bundled reader's silk-marker set
does not recognize decodes `mode` as vanilla instead, silently, with no
error — and under vanilla mode `@effected/workspaces`' default detector
resolves the single target at `publishConfig.directory`, which for a silk
workspace is the private `dist/dev/pkg` development artifact, not a prod
byte group.

This shipped once for real: silk-effects 3.0.0 recognized only two legacy
changelog ids and missed `@savvy-web/changelog` — the id current
`savvy init` writes — so every repo using that id had Phase 3 silently
publish its dev target with unresolved `catalog:` specifiers
([issue #143](https://github.com/savvy-web/silk-release-action/issues/143),
surfaced through `yaml-effect@0.7.1`).[^issue-143] silk-effects 3.0.1+
added `@savvy-web/changelog` to its silk-marker set, and the version
installed in this repository today is well past that fix. The trap is
not closed, though: it recurs for any *new* changelog id introduced to
this ecosystem until the bundled silk-effects library learns it too, so a
green Phase 3 that published the wrong byte group is reason to check the
changelog id in `.changeset/config.json` against the installed
`@savvy-web/silk-effects` version's silk-marker set before suspecting the
build.

[^changeset-config]: `../../src/release/changeset-config.ts`
[^issue-143]: `https://github.com/savvy-web/silk-release-action/issues/143`
</content>
