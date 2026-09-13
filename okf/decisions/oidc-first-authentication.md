---
type: Decision
title: OIDC-first publishing, with token auth as bootstrap and fallback
description: npm and JSR publish over OIDC trusted publishing by default; a token is used only to bootstrap a first-time npm publish, to retry once after an OIDC 404, or unconditionally for GitHub Packages, which cannot do OIDC at all.
status: draft
tags:
  - security
  - release
sources:
  - id: publish
    resource: ../../src/release/publish.ts
  - id: resolve-targets
    resource: ../../src/release/resolve-targets.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 1b062bbb6f8b63da247a85f32f40f80efb10284bb79564a93a38c29b7be4a614
---

# OIDC-first publishing, with token auth as bootstrap and fallback

## Context

OIDC (OpenID Connect) trusted publishing lets npm and JSR issue short-lived,
workflow-scoped credentials instead of a long-lived token sitting in
repository secrets. Both registries support it natively from GitHub
Actions. It cannot cover every case unconditionally, though: a package with
no trusted publisher configured yet cannot bootstrap the OIDC exchange, and
GitHub Packages does not support OIDC trusted publishing at all — it 404s
the exchange attempt.

## Decision

`publishDirectoryGroup`[^publish] decides `tokenAuth` per registry:

- **npm public registry** — prefers OIDC on the first attempt. When that
  fails and a token is available, it retries once with `tokenAuth: true`.
  An unconfigured package (no trusted publisher yet) cannot bootstrap the
  OIDC exchange and 404s "package not found", so the first-ever publish
  needs the token; once the package exists and trusted publishing is
  configured, the first attempt succeeds and the retry never fires.
- **GitHub Packages** — always publishes with `tokenAuth: true`, from the
  first attempt, never OIDC-first. npm 11.5+ auto-attempts the OIDC
  `/-/npm/v1/oidc/token/exchange` POST whenever the Actions OIDC
  environment is present, even without `--provenance` requested, and
  GitHub Packages does not support that exchange — it 404s and ignores the
  configured `_authToken`. Authenticating with the token from the start
  avoids the failed exchange rather than working around its aftermath.
- **JSR** — publishes over OIDC and needs no token of its own. It shares
  the custom-registry token-resolution fall-through in
  `pickToken`[^resolve-targets] only because a predecessor's two
  independent booleans both answered false for it and it fell through by
  accident; the fall-through is preserved deliberately rather than
  redesigned, since JSR never actually reads the resolved token.

A GitHub Packages target with no `github-token` fails by name —
"no github-token input — GitHub Packages requires the workflow's
`secrets.GITHUB_TOKEN`" — rather than by the symptom four identical
"integrity probe failed — status 403" lines would otherwise produce (see
[GitHub Packages needs the workflow token](../limitations/github-packages-needs-workflow-token.md)).
Every other failure surfaces npm's actual error (`ENEEDAUTH`, `E404`, and
similar) rather than an opaque exit code; the resolved auth-token key and
the target npmrc path are logged for debugging, and the token value itself
never is.

**SBOM format.** The SBOM attached to each attestation is CycloneDX 1.5,
chosen because it is the most widely supported SBOM format for npm
packages and supports PURL (Package URL) identifiers natively — required
for the NTIA unique-identifier minimum element the compliance report
checks.

## Alternatives rejected

**Token auth as the default everywhere.** Would avoid the OIDC-vs-token
branching this decision describes, at the cost of every registry needing a
long-lived secret provisioned and rotated, which is exactly what OIDC
trusted publishing exists to remove.

**Treating GitHub Packages the same as npm (OIDC-first, token fallback).**
Tried and rejected: npm's own OIDC auto-attempt against GitHub Packages
always 404s, so an OIDC-first attempt there is not a fallback path that
sometimes fires — it is a guaranteed failure on every single publish,
worth skipping outright rather than working around after the fact.

## Consequences

npm and JSR carry no standing publish token once a package's first release
has landed and OIDC trusted publishing is configured on npmjs.com; the
`npm-token` input exists purely for that bootstrap case and as an OIDC
fallback. GitHub Packages requires `secrets.GITHUB_TOKEN` unconditionally,
which this decision's failure message states explicitly rather than
leaving a reader to infer it from a 403.

See also [Pin npm to the 11.x line](pin-npm-11.md) for why the dlx-fetched
npm the OIDC exchange runs through is pinned rather than left on `latest`.

[^publish]: ../../src/release/publish.ts
[^resolve-targets]: ../../src/release/resolve-targets.ts
