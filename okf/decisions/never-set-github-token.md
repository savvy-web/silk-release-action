---
type: Decision
title: Never write process.env.GITHUB_TOKEN persistently
description: Credentials travel as Redacted values through ActionState and pickToken rather than through the process environment; the one scoped, restored exception is Phase-1 native versioning, which never touches a registry or OIDC.
status: draft
tags:
  - security
sources:
  - id: pre-entry
    resource: ../../src/pre.ts
  - id: state-module
    resource: ../../src/state.ts
  - id: native-version-module
    resource: ../../src/utils/native-version.ts
  - id: resolve-targets-module
    resource: ../../src/release/resolve-targets.ts
  - id: publish-module
    resource: ../../src/release/publish.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: ca7c162c3ef2beda1dfc749e972df2132f81c20a107ad055ccc1074052d1f3b1
---

# Never write process.env.GITHUB_TOKEN persistently

## Context

The runner's own `GITHUB_TOKEN` backs GitHub Actions' OIDC subsystem and
Actions' own trust mechanisms — overwriting it persistently would break
OIDC token fetches for npm and JSR trusted publishing for the rest of the
job. A prior implementation carried a workflow token across the process
environment through two bridges, `STATE_token` and `STATE_githubToken`.
`STATE_githubToken` in particular wrote the workflow packages token into
`process.env` as **plaintext** — no `Secret`/`Redacted` wrapper anywhere on
that path — to serve `tokens.packagesToken()`, whose only production
caller (`registry-auth.setupRegistryAuth`) had already been deleted in
issue #90. The bridge was an unmasked secret sitting in the environment of
every subsequent operation in the process, serving a function nobody
called anymore; its own test file was the last thing still importing it.

## Decision

The action never writes `process.env.GITHUB_TOKEN` persistently. Instead,
credentials travel as **values**:

- **The App installation token** is provisioned by `pre.ts` via
  `GitHubToken.provision()` and stored in `ActionState` under the kit's
  internal key.[^pre-entry] `layers/app.ts` builds the GitHub client from
  it with `GitHubToken.clientLayer()`; anything needing the raw token calls
  `GitHubToken.read()` itself rather than reading it back out of the
  environment.
- **The workflow packages token** — the `github-token` action input
  (`secrets.GITHUB_TOKEN` with `permissions: packages: write`) — is
  persisted by `pre.ts` to `GithubPackagesTokenState`[^state-module] and
  masked with `setSecret`. `runPublishTargets` reads it back from
  `ActionState` and hands it to `pickToken`[^resolve-targets-module],
  which resolves each target registry's credential from one
  `classifyRegistry` call. There is no process-environment bridge on this
  path at all.
- **OIDC tokens** are short-lived JWTs fetched on demand by
  `OidcTokenIssuer` for Sigstore/Fulcio signing and for npm/JSR trusted
  publishing — never stored in state, fetched fresh per attestation run.

The **one scoped exception** is Phase-1 native versioning. The upstream
changelog GitHub-info fetch (`@changesets/get-github-info`) reads
`process.env.GITHUB_TOKEN` directly, so `runNativeVersion` sets it from the
App token for the duration of `ReleasePlanner.apply` — taking precedence
over any ambient `GITHUB_TOKEN` the job already exports, so the changelog
fetch always uses the action's own identity — and restores the prior value
(or deletes the key if there was none) immediately after.[^native-version-module]
This exception is safe specifically because Phase 1 never touches a
registry or OIDC: by the time any publish or OIDC work runs in Phase 3, the
mutation has long since been undone. The env mutation is not parallel-safe,
which is acceptable because Phase 1 is strictly sequential by design.

Every secret-bearing API on these paths takes or decodes to
`Redacted<string>` — `GitHubApp.generateToken` / `revokeToken`, the client
constructors, `PackagePublish.setupAuth`, and the decoded
`InstallationToken.token` — which keeps credentials out of logs and error
renders. Registry tokens taken from `custom-registries` stay `Redacted`
from the decode in `schema/inputs.ts` down to `runPublishTargets`, which
declassifies each one, once, through `Secret.forSigning`[^publish-module]
— mask-first, so the token is registered with the runner's log filter
before any plaintext of it exists — immediately before handing it to
`setupAuth`'s npmrc write.

## Alternatives rejected

**Carrying tokens across `pre`/`main`/`post` via a plaintext environment
bridge** (the deleted `STATE_token` / `STATE_githubToken` shape). Rejected
because a plaintext copy of a credential sitting in `process.env` is
visible to every subsequent operation in the process regardless of whether
that operation needs it, with no `Secret`/`Redacted` boundary and no
masking guarantee.

**Setting `process.env.GITHUB_TOKEN` once, globally, for the whole run**
instead of scoping the Phase-1 exception to the `ReleasePlanner.apply`
call. Rejected because it would leave the App token substituted for the
ambient `GITHUB_TOKEN` during Phase-3 OIDC and registry work, which is
exactly the token substitution that breaks trusted-publishing OIDC
exchanges.

## Consequences

Three token identities — the App installation token, the workflow packages
token, and OIDC tokens — never mix: each travels through its own typed
carrier (`ActionState`, `GithubPackagesTokenState`, or a fresh OIDC fetch)
and none of them sits in the process environment outside the one, scoped,
restored Phase-1 exception. GitHub Packages targets are the one place a
missing credential is unrecoverable within this design: the App
installation token cannot access GitHub Packages at all — the sole
exception being the default GitHub Actions token, which is itself a
special-cased App token — so omitting the `github-token` input fails every
GitHub Packages target and, per the [six-step Phase-3
gate](six-step-phase-3.md), aborts before any GitHub release is created.

[^pre-entry]: ../../src/pre.ts
[^state-module]: ../../src/state.ts
[^native-version-module]: ../../src/utils/native-version.ts
[^resolve-targets-module]: ../../src/release/resolve-targets.ts
[^publish-module]: ../../src/release/publish.ts
