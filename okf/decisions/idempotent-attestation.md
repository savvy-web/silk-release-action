---
type: Decision
title: Check for an existing attestation before writing a new one
description: Before signing a fresh SLSA provenance or CycloneDX SBOM attestation, probe the GitHub attestation store for the subject digest and reuse an existing URL rather than writing a duplicate.
status: draft
tags:
  - security
  - release
sources:
  - id: publish-attest
    resource: ../../src/release/publish.ts
  - id: types
    resource: ../../src/release/types.ts
  - id: attest-helpers
    resource: ../../src/release/attest-helpers.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 650967ef1152763f83588f048afe6108cbf5431d127ac9dfbb760f2d96c9fbf8
---

# Check for an existing attestation before writing a new one

## Context

A publish target can be recovered on a later run after a prior run failed
partway through — the tarball reaches the registry but the process dies
before attestation runs, or the orchestrator decides a publish is
already-identical and skips re-publishing but still needs the attestation
step to run again. Writing a fresh SLSA provenance or CycloneDX SBOM
attestation unconditionally on every such pass would accumulate duplicate
attestations against the same tarball digest, one per retry.

## Decision

`runAttestationsForBuild`[^publish-attest] probes the GitHub attestation
store with `Attestation.listForSubject(subjectSha256, { predicateType })`
before writing, once for the SLSA provenance predicate type
(`SlsaProvenance.predicateType`) and once for the CycloneDX BOM predicate
type (`CYCLONEDX_BOM_PREDICATE`). A 404 or 422 response from
`listForSubject` is read as "none exists yet" and falls through to a fresh
write; any other read failure is logged and also falls through to a fresh
write, on the reasoning that attempting the write is safer than silently
skipping attestation on an ambiguous read. When an existing attestation is
found, the existing URL is reused directly and no new attestation is
signed.

The outcome is recorded per attestation kind on
`TargetPublishResult.recovered`[^types]: `{ provenance: true }` when the
SLSA provenance attestation was reused, `{ sbom: true }` when the CycloneDX
SBOM attestation was reused, and `false` on either field when a fresh
attestation was written this run. The field is absent entirely when no
attestation step ran at all (every target in the build's group resolved
`provenance: false`). `subjectSha256` must be the tarball's SHA-256 hex
digest — the kit's `PackedTarball` also carries an `integrity` field in
npm's `sha512-<base64>` format, a different algorithm and a different
encoding, and the GitHub attestation API rejects the latter silently
(`attest-helpers.ts`[^attest-helpers] carries the sign + store assembly
this idempotency check sits inside).

## Alternatives rejected

Writing unconditionally on every publish run was the position before this
check existed. It works on a clean run but produces one duplicate
attestation per retry on any partial-failure recovery, and nothing in the
attestation store deduplicates by subject digest on its own.

## Consequences

Retrying a partially-failed publish is safe: re-running attestation for an
already-attested tarball reuses the existing URL rather than growing a pile
of duplicate attestations for the same subject. The publish summary can
render "attestation reused" distinctly from "attestation written this run"
by reading `recovered`, which is why the field is a per-kind record rather
than a single boolean — a build can recover provenance while still writing
a fresh SBOM attestation, or vice versa, if only one of the two existed
from a prior attempt.

[^publish-attest]: ../../src/release/publish.ts
[^types]: ../../src/release/types.ts
[^attest-helpers]: ../../src/release/attest-helpers.ts
