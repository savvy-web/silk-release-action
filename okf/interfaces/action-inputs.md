---
type: Interface
title: Action inputs and outputs
description: "The `action.yml` inputs a workflow author sets and the outputs a workflow reads, decoded exactly once on each side."
kind: config
resource: ../../action.yml
tags: [release, security]
sources:
  - id: action-yml
    resource: ../../action.yml
  - id: inputs-ts
    resource: ../../src/schema/inputs.ts
  - id: outputs-ts
    resource: ../../src/schema/outputs.ts
  - id: custom-registries-ts
    resource: ../../src/utils/custom-registries.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 16a4dbf28389f64afa2f99b64a303632a863053ab8536def22c10ee0ada8df0e
---

# Action inputs and outputs

This action's `action.yml` is the single source of truth for every input and
output NAME and DEFAULT.[^action-yml] `src/schema/inputs.ts` and
`src/schema/outputs.ts` mirror both, and a three-way sync test parses the
manifest, scans what `src/` actually reads and writes, and holds all three
against the `INPUT_NAMES` / `PRE_OUTPUT_NAMES` / `MAIN_SCALAR_OUTPUT_NAMES` /
`OUTPUT_NAMES` tuples.[^inputs-ts][^outputs-ts] A consumer can rely on the
manifest's names and defaults staying honest against the code that reads
them.

## Inputs

| Input | Required | Default | What it controls |
| --- | --- | --- | --- |
| `app-client-id` | yes | — | GitHub App client ID for authentication. |
| `app-private-key` | yes | — | GitHub App private key (PEM). A missing credential fails the decode rather than proceeding unauthenticated. |
| `github-token` | no | `""` | `secrets.GITHUB_TOKEN`, required for GitHub Packages — see Authentication model below. |
| `release-branch` | no | `changeset-release/main` | The release branch name. |
| `target-branch` | no | `main` | The branch the release PR targets. |
| `auto-merge` | no | `""` | `merge`, `squash`, `rebase`, or empty to disable auto-merge on the release PR. |
| `dry-run` | no | `"false"` | Rehearse without mutating — see Dry-run semantics below. |
| `phase` | no | `""` | Explicit phase override, skipping auto-detection: `branch-management`, `validation`, `publishing`, `close-issues`, or `none`. |
| `npm-token` | no | `""` | npm token for a first publish or an OIDC fallback. |
| `strict-warnings` | no | `"false"` | Escalates warning-severity validation findings to check-run failures, blocking branch-protection-gated auto-merge. |
| `sbom-config` | no | `""` | SBOM metadata JSON — see `../interfaces/sbom-config.md`. |
| `custom-registries` | no | `""` | Custom registry auth, one registry per line — see format below. |
| `on-build` | no | `""` | Command run after the validation build; a non-zero exit fails Phase 2. Gate only: stderr is not inspected, and it must not mutate the repository. Skipped in dry-run along with the build it gates; unset is a total no-op. |

Every input is decoded exactly once, in `src/schema/inputs.ts`, against typed
literal unions rather than cast — the convention this contract depends on is
`../conventions/single-input-decode-point.md`.

### `phase` accepts `publishing`; the output discriminator is `publish`

The `phase` input's accepted values are `branch-management`, `validation`,
`publishing`, `close-issues`, and `none`.[^action-yml] The structured `result`
output for that same run discriminates on `phase: "publish"`, not
`"publishing"`.[^outputs-ts] A consumer that branches on the *input* spelling
and reuses it to filter the *output* union will never match — the two
vocabularies are related but not identical, and the mismatch is deliberate
rather than a typo to "fix" on either side.

## Authentication model

| Registry | Method | Notes |
| --- | --- | --- |
| npm | OIDC | Trusted publishing; `npm-token` covers a first publish or an OIDC fallback. |
| JSR | OIDC | Trusted publishing, no token needed. |
| GitHub Packages | `github-token` input | **Required.** Pass `secrets.GITHUB_TOKEN` with workflow permissions `packages: write`. |
| Custom registries | `custom-registries` input | One `<url>/_authToken=<token>` line per registry. |

**Never drop `github-token`.** A GitHub App installation token — including the
one this action provisions for itself — cannot access GitHub Packages at all;
the sole exception is the default Actions token, which is what `github-token`
carries. Omitting the input fails every GitHub Packages target and aborts
before any GitHub release is created, and the action names the missing input
rather than surfacing it as a bare 403.[^action-yml] This was confirmed the
hard way on `savvy-web/systems` run `30228332922`: the same App-derived token
that resolved the App identity and revoked itself against `api.github.com`
was rejected 403 by `npm.pkg.github.com` on a plain registry read, while
holding `packages:write`. The full edge this bounds is
`../limitations/github-packages-needs-workflow-token.md`. `custom-registries`
is not a substitute for `github-token` — GitHub Packages needs the dedicated
input.

## `custom-registries` line format

One registry per line, the URL immediately followed by the npmrc auth
string:

```text
https://registry.example.com/_authToken=<token>
```

Each token is masked in the workflow log and written to the npmrc npm
publishes through.[^action-yml] **A malformed line fails the run** rather
than being silently ignored or configuring nothing — this restores a
capability that spent four minor releases as a silent no-op after the
publish-chain migration (`#90`, issue `#215`).[^custom-registries-ts] Three
shapes are rejected, each naming the offending line number (never the
token):

- `_auth=<base64-credentials>` — basic auth is not accepted; supply a bearer
  token as `_authToken=<token>` instead.
- a bare registry URL with no token — the GitHub App token fallback was
  removed, so every custom registry needs an explicit token.
- two lines naming the same registry — two tokens for one registry is a
  misconfiguration, not a preference order.

For reusable workflows, the whole config can be stored in one repository
secret and passed through as `custom-registries: ${{ secrets.CUSTOM_REGISTRIES }}`.
For npm itself, use `npm-token`, not `custom-registries`; GitHub Packages
needs `github-token`, not `custom-registries`, because a GitHub App token
cannot reach it at all.

## Outputs, split by process

The manifest's twelve outputs are produced by two different processes, and no
single `emitOutputs` call can cover both — only the `pre` process holds a
freshly minted installation token.[^outputs-ts]

- **`pre` process:** `token`, `installation-id`, `app-slug` — the GitHub App
  installation token and identity, minted before `main` runs.
- **`main` process:** `result` (the Schema-encoded structured document — see
  `../interfaces/release-output.md`), `phase`, `status`, `succeeded`,
  `package-count`, `release-pr-number`, `closed-issues-count`,
  `failed-issues-count`, `closed-issues`.

`result` is emitted separately from the other `main`-phase outputs because it
is Schema-encoded through `setJson` and tolerates its own encode failure by
degrading to a logged warning, rather than being folded in with the scalar
outputs that a plain `set` call cannot fail on.[^outputs-ts] A run that
produced no phase output (`phase: "none"`) still populates every declared
output from an all-disabled baseline — `status: "no-op"`, `succeeded: true`,
every count `0` — so a workflow reading any declared output always gets a
value rather than an absence.

## Dry-run semantics

`dry-run: true` rehearses without mutating, but the meaning differs by phase.
Phase 3 (publishing) publishes nothing at all in dry-run. Phases 1 and 2
still observe and report — Phase 1 still computes what it would branch/PR,
Phase 2 still runs its dry-run publish probes — but the mutations each phase
would otherwise make (branch pushes, PR creation or updates) are suppressed.
Every phase's output carries its own `dryRun` boolean so a consumer never has
to infer the mode from the absence of a side effect.

## Removed inputs

`skip-token-revoke` and `pr-title-prefix` are gone from the manifest and must
not be reintroduced without a fresh decision — the rationale is
`../decisions/removed-inputs.md`. The three-legged sync test that keeps this
contract honest against `build-command`'s prior silent drift and
`custom-registries`'s prior silent no-op is
`../decisions/three-legged-manifest-guards.md`.

[^action-yml]: `action.yml`
[^inputs-ts]: `../../src/schema/inputs.ts`
[^outputs-ts]: `../../src/schema/outputs.ts`
[^custom-registries-ts]: `../../src/utils/custom-registries.ts`
