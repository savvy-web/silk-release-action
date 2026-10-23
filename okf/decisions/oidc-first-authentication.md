---
type: Decision
title: OIDC-first publishing, with token auth as bootstrap and fallback
description: npm and JSR publish over OIDC trusted publishing by default, and pnpr over a workload credential minted from the job's OIDC token; a token is used only to bootstrap a first-time npm publish, to retry once after an OIDC 404, or unconditionally for GitHub Packages, which cannot do OIDC at all.
status: draft
tags:
  - security
  - release
sources:
  - id: publish
    resource: ../../src/release/publish.ts
  - id: resolve-targets
    resource: ../../src/release/resolve-targets.ts
  - id: custom-registries
    resource: ../../src/utils/custom-registries.ts
  - id: validation
    resource: ../../src/release/validation.ts
generated:
  by: okfit/claude-code
  at: 2026-10-23T18:28:37Z
integrity:
  generated:
    body: 0339ad97b304792c
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
- **Custom registries** — also `tokenAuth: true` from the first attempt.
  Trusted publishing exists only on registry.npmjs.org, but npm attempts
  the exchange against any registry when the OIDC environment is present.
  A custom registry (pnpr) 404s it and npm silently falls back to the
  `custom-registries` token, so offering the environment cost a wasted
  round trip and made the run's `auth` record claim trusted publishing for
  an upload the token authenticated (silk-integration run 39974152493).
  No action-level retry applies: a token-first failure is final.
- **pnpr workload registries** — a `custom-registries` URL carrying a
  `_pnprWorkload=<audience>` line[^custom-registries] publishes with a
  credential the action mints itself: `pnpr_workload_<jwt>`, where `<jwt>`
  is the job's GitHub Actions OIDC ID token for that audience (exactly
  `https://registry.savvyweb.systems` for pnpr). It is minted once per
  target, after the target's reads and immediately before the PUT, masked
  in full, written by `setupAuth` as the npmrc's only token for that
  registry, and published with `tokenAuth: true`.[^publish] The auth record
  is `workload-oidc (custom-registries)`. pnpr accepts the credential only
  for `PUT /npm/~<registry>/<package>`, so it never authenticates a read:
  the integrity probe, the snapshot never-published probe and post-publish
  confirmation all use the `_authToken` paired on the same URL, a read-only
  `release-reader` token.[^resolve-targets] A workload line with no reader
  fails that target as `no-read-credential` before any read, rather than as
  the opaque 401 the integrity probe would otherwise produce, and Phase 2
  reports the same misconfiguration from configuration alone, minting
  nothing.[^validation] A mint failure (no `permissions: id-token: write`)
  fails only that target and names the permission; there is no fallback to
  the reader token, which pnpr refuses on a PUT anyway. The target declares
  the `/npm/~savvy/` URL itself; the action maps nothing.

  **The one read the action does not control.** Before its PUT, `npm
  publish` fetches the packument itself, using the npmrc token, so the
  workload credential does go out on one `GET` to pnpr. pnpr refuses it, and
  npm 12 catches every error from that fetch and carries on. All that's lost
  is npm's own "cannot publish over" and "cannot implicitly tag latest"
  checks; the action's integrity probe and its explicit `--tag` already
  cover both. Only `--force` would skip the fetch, and it drops more than
  that check, so the refused `GET` is accepted.

  **No npm retries.** A workload publish runs npm with `--fetch-retries=0`.
  npm's defaults retry a 5xx twice, with a 10s and then a 60s backoff, on
  both that `GET` and the PUT: about 140s per target, which read as a hung
  run when pnpr answered "OIDC provider unavailable" (silk-integration run
  40001523546). Other registries keep npm's retries.
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

**A long-lived pnpr publish token in `custom-registries`.** Works with the
existing token path, but keeps a standing publish secret for a registry that
can verify the workflow's own identity — the cost OIDC exists to remove.
The workload credential lives for one PUT and is bound to the repository by
the token's claims.

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
[^custom-registries]: ../../src/utils/custom-registries.ts
[^validation]: ../../src/release/validation.ts
