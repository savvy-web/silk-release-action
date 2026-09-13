---
type: Decision
title: Pack the tarball once per build directory, not once per target
description: publishDirectoryGroup packs a directory's tarball once and reuses it for every registry target in that byte-group, then probes each target's registry to decide publish, skip, or abort before attesting the group once.
status: draft
tags:
  - release
  - security
sources:
  - id: publish-module
    resource: ../../src/release/publish.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 6b7de5c0724397ba3f12d663f235560385195da3893d7c11fdb050ac720318e4
---

# Pack the tarball once per build directory, not once per target

## Context

A package can publish to more than one registry from the same built
output — npm and GitHub Packages sharing identical bytes collapse into one
[byte-group](../glossary/byte-group.md) and one `dist/prod/<group>/pkg`
build directory. Packing separately per registry target would run `npm
pack` multiple times against the same source tree. Nothing guarantees two
separate pack invocations produce byte-identical tarballs (timestamps,
file-ordering, or packer version drift could differ between runs), and a
provenance attestation asserts a specific SHA-256 digest — if each registry
in a group got its own pack, the same logical release could carry two
different attested digests.

## Decision

`publishDirectoryGroup`[^publish-module] packs once per build directory and
reuses that single tarball, and its digest, for every npm/GitHub-Packages
target sharing the directory. JSR targets are split off before packing and
recorded as skipped, since JSR publishing is not yet supported by this
orchestrator. For each remaining target the group runs a three-way
probe-then-decide:

1. **Pack once** — `PackagePublish.pack(directory)` runs a single time for
   the group; the same tarball and SHA-256 digest is used for every target.
2. **Token resolution** — `pickToken` resolves the registry's credential. A
   GitHub Packages target with no token fails *by name* — "no
   github-token input" — rather than by symptom, because the alternative is
   four identical 403 integrity-probe lines across the group's targets that
   read like a packages-permissions problem rather than a missing input.
3. **Auth setup** — `PackagePublish.setupAuth` (taking a `Redacted<string>`)
   writes the token to the npmrc before the probe. The probe itself is now
   an HTTP read carrying its own token and no longer needs the npmrc; the
   auth-before-probe ordering is kept anyway rather than reordering a
   publish pipeline's authentication sequence for tidiness.
4. **Probe** — `NpmRegistry.version` checks whether the package's version
   is already on the target registry, and if so, with what digest.
5. **Decide** — three outcomes per target: version absent → publish the
   tarball → `published`; version present with a matching digest →
   recovery skip → `skipped-identical (recovery)`; version present with a
   mismatched digest → abort that target → `failed-mismatch`.
6. **Attestation** — after every target in the group has resolved, existing
   provenance and CycloneDX SBOM attestations are checked for on the
   group's shared digest and a fresh one written only if absent — one
   provenance + SBOM attestation pair per build directory, not per target
   (see [Check for an existing attestation before writing a new
   one](idempotent-attestation.md)). The sign-and-store assembly is
   `src/release/attest-helpers.ts`.

## Alternatives rejected

**Packing once per target instead of once per directory.** Rejected
because it cannot guarantee every target in a byte-group receives
byte-identical content, which breaks the "one digest per attestation"
guarantee the group's provenance and SBOM attestations depend on, and
wastes a pack invocation per registry for content that is already
identical by construction.

## Consequences

Every registry in a byte-group receives content with the same SHA-256
digest, so one provenance attestation and one SBOM attestation correctly
describe every target in the group — there is no risk of a digest mismatch
between what was attested and what a given registry actually received. A
pack failure fails every target in the group at once (no partial packs to
reconcile), and the mismatch outcome exists specifically to catch a
registry that already holds a version under a *different* digest than the
one this run just packed, rather than silently republishing over it.

[^publish-module]: ../../src/release/publish.ts
