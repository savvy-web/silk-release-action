---
type: Decision
title: Replace @actions/attest with the kit's sign/store split, assembled locally
description: "@actions/attest was dropped for a bundler-incompatible dependency chain, an opaque failure surface, and a private coupling to the @actions/ environment; the kit splits signing from storage and this repo owns the one-place assembly in attest-helpers.ts."
status: draft
tags:
  - security
  - bundle
  - deps
sources:
  - id: attest-helpers-module
    resource: ../../src/release/attest-helpers.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 589ba74464caba1438c6d777736248cc9580ed7d82a0bd78f37a67ff50c0166e
---

# Replace @actions/attest with the kit's sign/store split, assembled locally

## Context

`@actions/attest` had three structural problems for this action:

1. **Bundler incompatibility.** `@actions/core`'s barrel statically imports
   `oidc-utils.js` → `@actions/http-client` → `undici`. rspack (and webpack)
   cannot emit `undici` as CJS without producing `Class extends value
   [object Module] is not a constructor` at the `Dispatcher` class
   definition, which breaks the action's bundled build entirely.
2. **Opaque failure surface.** `@actions/attest` error messages did not
   surface the root cause from Fulcio or Rekor, leaving a failed
   attestation with no actionable diagnostic.
3. **Private to the `@actions/` environment.** The package is tightly
   coupled to the `@actions/` ecosystem, with signing and storage bundled
   together rather than separable, reusable pieces.

## Decision

The kit splits attestation deliberately across three packages, and this
repository owns assembling them into one pipeline:

- **Sign** — `@effected/sbom` builds and signs the statement:
  `InTotoStatement`, `SlsaProvenance`, `Sha256Digest`, `SigstoreSigner`.
- **Identity** — `@effected/github-actions` supplies the OIDC identity
  (`ActionsProvenance`, the OIDC-to-`IdentityToken` adapter) that
  `SigstoreSigner` requires.
- **Store** — `@effected/github` stores the signed bundle: `Attestation`,
  `ArtifactMetadata`.

Assembling the sign and store halves into a pipeline is explicitly the
consumer's job — `AttestationShape`'s own remarks say so — and
`src/release/attest-helpers.ts` is that assembly, kept in **one
place**[^attest-helpers-module] so `publish.ts` and `releases.ts` do not
each grow their own copy of the same wiring. `buildProvenancePredicate`
calls `ActionsProvenance.capture` for the twelve-field
`GitHubWorkflowProvenance` predicate and, deliberately, keeps the `catch →
null` arm local: attestation is not a publish gate for this action, so a
workflow without `permissions: id-token: write` publishes and simply skips
attestation rather than failing the release — a consumer that wants
mandatory attestation would keep the `OidcTokenError` instead of catching
it. The predecessor's `src/services/attest/` directory, which held a
hand-rolled equivalent of this split, no longer exists.

## Alternatives rejected

**Keeping `@actions/attest` and working around the bundler
incompatibility** (e.g. externalizing `undici`, patching the CJS output).
Rejected because it treats the symptom rather than the cause, still leaves
the opaque Fulcio/Rekor failure surface unaddressed, and keeps the
dependency coupled to the `@actions/` ecosystem this action has otherwise
moved off of entirely.

**Hand-rolling the Sigstore sign-and-store flow from scratch** instead of
using the kit's split packages. Rejected because `@effected/sbom` and
`@effected/github` already provide the sign and store halves as separately
reusable, typed services — reimplementing them locally would duplicate
work the kit already does and lose the shared, tested implementation other
`@effected/*`-based actions also depend on.

## Consequences

Attestation failures now carry a `cause` chain traceable to the actual
Fulcio/Rekor error instead of an opaque `@actions/attest` message. The
bundled action build no longer fails on the `undici`/CJS incompatibility.
Because the assembly point is one file, a future change to how signing and
storage compose (for example, adding a second predicate type) touches
`attest-helpers.ts` once rather than two call sites that could drift. See
[Check for an existing attestation before writing a new
one](idempotent-attestation.md) for the idempotency check that sits inside
this same assembly.

[^attest-helpers-module]: ../../src/release/attest-helpers.ts
