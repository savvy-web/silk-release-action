---
type: Decision
title: An explicit-only snapshot phase, never a publish-phase flag
description: "`phase: snapshot` plus `snapshot-tag` publishes unreleased versions under a non-latest dist-tag through the same target-resolution and publish machinery as Phase 3, gated by a full-ref branch guard and never auto-detected."
status: draft
tags: [release, security]
sources:
  - id: snapshot-step
    resource: ../../src/steps/snapshot.ts
  - id: snapshot-utils
    resource: ../../src/utils/snapshot.ts
  - id: publish
    resource: ../../src/release/publish.ts
  - id: release-output
    resource: ../../src/schema/release-output.ts
generated:
  by: okfit/claude-code
  at: 2026-09-27T16:16:05Z
  body_sha256: af1c0e7019eb5c823fccbf501b04bda911439ea22f827af69adba0a24f451b3d
---

# An explicit-only snapshot phase, never a publish-phase flag

## Context

effected's own interim shell job packed and published unreleased versions by
reading `publishConfig` a second time, independently of this action's own
target resolution — every consumer repository that wanted the same thing
would need its own copy of that reader, and a copy is exactly the kind of
duplication that drifts from the target-resolution rules this action already
centralizes. Separately, an unreleased kit change (a new
`Changesets.ReleasePlanner.apply` snapshot option) has to reach a consumer's
CI before it ships as a real release, and a `file:`/`link:` override cannot
install on a hosted runner — the dependency has to be resolvable from a
registry, under some dist-tag, for a workflow to pull it in.

## Decision

A dedicated `phase: snapshot`, paired with a required `snapshot-tag` input,
runs as a sixth arm of the program switch — never detected, only entered when
a workflow sets `phase: snapshot` explicitly.[^snapshot-step] `SnapshotTagSchema`
constrains the tag to a letter followed by lowercase letters, digits or
hyphens; `latest` is refused (a snapshot must never move it), and `x` or
`v<digit>…` are refused because npm rejects a dist-tag that parses as a
semver range. A malformed tag fails the run under **any** phase, since the
schema decode happens once for every run regardless of which phase reads the
value.

**The ref guard reads `GITHUB_REF`, never the short branch name.**
`checkSnapshotRef`[^snapshot-utils] requires a `refs/heads/*` ref and refuses
three cases: a non-branch ref (a tag or PR ref — a dispatch can target a tag,
and a tag literally named `main` would pass a short-name check that a full-ref
check catches), the configured target branch (a snapshot is for unmerged
work), and the configured release branch (its versions belong to the release,
not a snapshot).

**Versioning stays in the working tree.** The step calls
`ReleasePlanner.apply({ snapshot: { tag, useCalculatedVersion: true,
prereleaseTemplate: "{tag}-{datetime}" } })` — the same zero-install native
versioning Phase 1 uses, with `useCalculatedVersion: true` so the prerelease
keeps the real next version in front (`0.12.0-next-20260927051500`, not
changesets' bare `0.0.0-…` default). Nothing is committed or pushed; the bump
lives only in the job's working tree for the build and publish steps that
follow.

**The build is `runCiBuild` with no SBOM** — the same `ci:build` invocation
Phase 3 uses, minus SBOM generation, since a snapshot writes no GitHub release
or attestation for an SBOM to attach to.

**Publishing reuses Phase 3's own machinery**, not a parallel implementation:
`resolvePublishTargetSpecs` and `publishDirectoryGroup` run under a
`SnapshotPublishOptions` (`{ tag, dryRun }`) that is `undefined` for Phase 3
and present only here.[^publish] Present, it changes exactly five things:
tagging every `publishTarball` call (including the token-auth retry) with the
snapshot tag instead of letting npm apply `latest`; a never-published probe
per target, using that target's own resolved credential; a built-version
check (the packed tarball's version must equal the applied snapshot version,
catching a build that did not pick up the bump); no GitHub attestation
(npm's own `--provenance`, exactly as each target already configures it, is
the only attestation a snapshot carries); and, in dry-run, a real pack and a
real registry read with no upload, because the kit's `PackagePublish` has no
`npm publish --dry-run` member to call.

**The never-published rule.** Before publishing, each target's registry is
asked `versions(name)` with that target's own credential. An empty list
(`[]`, an HTTP 404) means the package was never published on this registry —
skipped, because a first publish under a non-latest tag would also claim
`latest`, and a first publish belongs to a real release. Any other read
failure fails the target outright rather than being read as never-published:
treating an unreadable registry the same as an empty one would silently skip
packages that already exist. A restricted (private) package probed with no
credential also answers 404 — indistinguishable, from the probe's point of
view, from never-published — so that case fails the target by name, telling
the caller to pass `npm-token` rather than silently skipping a package that
is in fact already published.

**Nothing else runs.** No git tag, no GitHub release, no release PR, no
issue-closing, no SBOM, no GitHub attestation. The step's own docs state the
posture directly: fail-the-job, after emitting — every exit path, refusal
through partial publish, first emits the `result` output and writes the job
summary, then raises `SnapshotError`. The one degrading member is the
job-summary write itself: a failure there is a logged warning, changing
neither `success` nor the exit code, matching `emitReleaseOutput`'s own
`setJson` posture.

The output's `SnapshotOutput.totals` reports `workspaces` (bumped),
`published`, `skipped`, `failed` — the unit is the **publication** (one
package to one registry), not the workspace, since nothing is tagged or
released at the workspace level for a workspace-level count to
describe.[^release-output]

## Alternatives rejected

**A `snapshot-tag` input on the publish phase**, branching Phase 3's own
code path on its presence. Rejected: it would thread snapshot conditionals
through the tag-strategy, GitHub-release, and attestation code that must
**never** run for a snapshot, turning every future Phase 3 change into a
change that also has to reason about a snapshot branch through the same
functions.

**Shelling out to `changeset version --snapshot`.** Rejected: it breaks the
zero-install model every other phase already relies on (Phase 1's native
versioning needs no consumer `node_modules`), and would require a
`version-command`-style input this action deliberately removed. The
snapshot option was added upstream in silk-effects's `ReleasePlanner`
instead, so the same zero-install call this action already makes gained one
more argument rather than gaining a second code path.

**Treating every registry error as "never published."** This was the
reference shell job's original defect: any failed registry read — a network
blip, a 5xx, a misconfigured credential — was read the same as "the package
does not exist yet," silently skipping packages that were, in fact, already
published. This action's never-published probe fails the target on any read
outcome other than a clean empty list.

## Consequences

A failed run can leave a **partial** set published under the tag — some
targets landed before one failed. Consumers must pin the exact versions the
job summary lists (a ready-to-paste pnpm `overrides:` block), never the tag
alone, since a re-run or a partial failure means the tag is not a consistent
set at any given moment.

The phase is reachable only after a release moves the `v5` alias tag forward
to a commit carrying it — a consumer pinned to an older major never sees
`phase: snapshot` in its `action.yml`.

npm trusted publishing working through nested reusable workflows (this
action, called from a consumer's own workflow, called in turn from the shared
release workflow) is a claim this decision has not independently verified;
effected's own dogfood dispatch against this phase is the evidence that will
confirm or refute it.

Phase 3's `dry-run` input appears not to gate every upload path the same way
the snapshot phase's dry-run does — tracked as
[#459](https://github.com/savvy-web/silk-release-action/issues/459) rather
than assumed identical here.

A published snapshot can carry a **dangling internal dependency**.
Changesets bumps the dependents of every bumped package and the build pins
each internal dependency to its exact snapshot version, so when a bumped
dependency is skipped (never published), fails, or is not uploaded, a
published dependent pins a version no registry holds and an `overrides:`
block naming it fails with `ETARGET`. `findDanglingDependencies`[^snapshot-utils]
names each such pair from the dependent's runtime dependencies (production,
peer, optional — never dev) as discovery reads them, against the applied
release set and the publish result. Each pair is a logged warning and a
"Dangling dependencies" job-summary section — a finding, never a verdict:
`success`, `outcome` and the output schema are unchanged, per the
degraded-steps rule.

[^snapshot-step]: ../../src/steps/snapshot.ts
[^snapshot-utils]: ../../src/utils/snapshot.ts
[^publish]: ../../src/release/publish.ts
[^release-output]: ../../src/schema/release-output.ts
