# Configuration reference

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `app-client-id` | Yes | -- | GitHub App client ID for authentication |
| `app-private-key` | Yes | -- | GitHub App private key (PEM format) |
| `github-token` | For GitHub Packages | `""` | The workflow's `secrets.GITHUB_TOKEN`, with `packages: write` on the job. Required by every GitHub Packages target — the App token is not a fallback (see [GitHub Packages auth](#github-packages-auth)) |
| `release-branch` | No | `changeset-release/main` | Name of the release branch |
| `target-branch` | No | `main` | Target branch for the release PR |
| `auto-merge` | No | `""` | Enable auto-merge on the release PR: `merge`, `squash`, `rebase` or empty to disable. Requires branch protection with required status checks (see [Auto-merge](#auto-merge)) |
| `dry-run` | No | `"false"` | Run in dry-run mode (preview only, no actual changes) |
| `phase` | No | `""` | Explicitly set the workflow phase, skipping automatic detection. Values: `branch-management`, `validation`, `publishing`, `close-issues`, `none`. Any other value fails the run, naming the accepted set |
| `npm-token` | No | `""` | NPM access token for publishing to npmjs.org. Only needed for first-time publish or when OIDC is not configured |
| `strict-warnings` | No | `"false"` | When `"true"`, warning-severity validation findings escalate the per-step and unified check-run conclusions from `neutral` to `failure`, blocking anything that gates on check status — a branch-protection required check, and the auto-merge the `auto-merge` input enables. Errors always fail regardless of this setting |
| `sbom-config` | No | `""` | SBOM metadata configuration (JSON string) for NTIA-compliant SBOM generation. Must conform to the `SilkReleaseConfig` schema |
| `custom-registries` | No | `""` | Custom registries with authentication (one per line). Format: `https://registry.example.com/_authToken=<token>` — see [Custom registry format](#custom-registry-format) |

## Outputs

| Output | Description |
| --- | --- |
| `token` | Generated GitHub App installation token |
| `installation-id` | GitHub App installation ID |
| `app-slug` | GitHub App slug (URL-friendly name) |
| `result` | Structured JSON describing the run — see below |
| `phase` | Phase that ran: `branch-management`, `validation`, `publish`, `close-issues`, `none` |
| `status` | The phase's own outcome label. Branch management: `nothing-to-release`, `branch-created`, `branch-updated`, `branch-unchanged`, `conflicted`. Validation: `validated`, `nothing-to-release`, `build-failed`, `checks-failed`. Publish: `released`, `nothing-to-release`, `partial`, `failed`, `blocked` |
| `succeeded` | Whether all intended work completed (or correctly did nothing) |
| `package-count` | Number of packages the phase touched |
| `release-pr-number` | Release PR number, when one is involved (empty otherwise) |
| `closed-issues-count` | Number of linked issues closed by the close-issues phase (`"0"` in every other phase) |
| `failed-issues-count` | Number of linked issues the close-issues phase failed to close (`"0"` in every other phase) |
| `closed-issues` | JSON array describing each linked issue the close-issues phase handled — number, title, whether it closed, and the error when it did not (`"[]"` in every other phase) |

The `result` output is a phase-discriminated JSON object validated by `https://raw.githubusercontent.com/savvy-web/silk-release-action/main/schemas/5.0.0/silk-release-action-5.0.0.json`. It carries the machine-readable contract: a `success` boolean gate, a per-phase `outcome` enum (the same labels as the `status` scalar output above), a human-readable `summary`, a `failure` block (`null` on success), per-phase `totals`, a `dryRun` marker and exactly one phase payload block. Read fields with the `fromJSON()` expression function — `${{ fromJSON(steps.release.outputs.result).outcome }}` — and branch on `schemaVersion` for forward compatibility.

Publish and validation payloads key their `workspaces` by workspace name (with an `order` array giving publish order) rather than an array. Each workspace carries a `kind` of `github-only` or `github-with-packages` and a `packages` array of per-registry publications — a workspace with only private packages reports `github-only` and an honest `npm: — none` rather than a misleading green tick for a registry with no targets.

The serialized payload does not include per-package release notes. The validation phase still computes the next CHANGELOG entries, but it surfaces them in the dedicated Release Notes Preview check rather than in `result`. To read release notes from a workflow, fetch the GitHub release body after Phase 3, or read the Release Notes Preview check on the release PR.

## Auto-merge

The `auto-merge` input enables GitHub's auto-merge on the release PR, so the next green check publishes:

```yaml
auto-merge: squash
```

| Value | Effect |
| --- | --- |
| `""` (default) | Auto-merge is not enabled; merge the release PR yourself |
| `merge` | Auto-merge with a merge commit |
| `squash` | Auto-merge with a squash |
| `rebase` | Auto-merge with a rebase |
| anything else | Fails the run, naming the value and the accepted set |

Auto-merge is off by default because enabling it on a release PR means the next green check publishes packages, which is a call about a repository's release posture rather than one the action should make for you.

A typo fails rather than quietly disabling. A workflow that writes `auto-merge: sqush` wants auto-merge, and treating that as "off" leaves the release PR open indefinitely, looking like a defect in the action.

Two repository-level prerequisites sit outside the action: auto-merge has to be enabled on the repository, and branch protection has to define required status checks — without them there is nothing for auto-merge to gate on. When either is missing, the action logs a warning and continues, because the release has already succeeded and the PR is there to merge by hand.

`strict-warnings` composes with this. Escalating warnings to `failure` makes the validation check red, which blocks the auto-merge that the check gates.

## Changelog configuration

Phase 1 generates CHANGELOG entries with a changelog module bundled into the action, selected by the `changelog` id in your `.changeset/config.json`. No consumer `node_modules` is read, so the branch-management job runs without a dependency install. Supported ids:

| Configured changelog id | Generator |
| --- | --- |
| `@savvy-web/changelog` | Silk changelog format |
| `@savvy-web/silk/changesets/changelog` | Silk changelog format |
| `@savvy-web/changesets/changelog` | Silk changelog format |
| `@changesets/cli/changelog` | Standard changesets format |

Any other id fails Phase 1 with an error naming the supported ids. GitHub attribution in generated entries (PR, commit and user links) is fetched with the action's App token — no extra token configuration is needed.

### Post-version formatting

If the repository root contains `biome.json` or `biome.jsonc`, the action runs `biome format --write .` after applying versions:

| Condition | Behavior |
| --- | --- |
| Standalone `biome` binary not on `PATH` | Logs a warning, continues unformatted |
| Config cannot resolve without `node_modules` (e.g. `extends: ["@savvy-web/silk/biome"]`) | Logs a warning, continues unformatted |
| Any other formatting failure | Fails the phase |

## Authentication model

The action uses a tiered approach for multi-registry publishing:

| Registry | Method | Configuration |
| --- | --- | --- |
| npm | OIDC trusted publishing, with token-auth fallback | No token needed once trusted publishing is configured. Provide `npm-token` for first-time publishes or as a fallback |
| JSR | OIDC trusted publishing | No configuration needed |
| GitHub Packages | Token auth | Requires the `github-token` input, set to the workflow's `secrets.GITHUB_TOKEN`, with `packages: write` on the job |
| Custom registries | `custom-registries` input | One `_authToken` per registry, written to the npmrc npm publishes through. See [Custom registry format](#custom-registry-format) |

### npm trusted publishing and token fallback

For OIDC trusted publishing to npm, your workflow needs `id-token: write` permission and the package must already exist on npmjs.com with your repository trusted. The action attempts trusted publishing first. When trusted publishing fails — which is always the case for a first-time publish, since npm cannot bootstrap a package that has no trusted publisher configured yet — and an `npm-token` is available, the action retries the same tarball with classic token auth. Provide the `npm-token` input for first-time publishes and for any package that has not yet been configured for trusted publishing.

### GitHub Packages auth

GitHub Packages does not support npm's tokenless OIDC trusted publishing, so the action authenticates with a token from the first attempt rather than letting npm's auto-attempted OIDC exchange fail. That token has to be the workflow's own `secrets.GITHUB_TOKEN`, passed as `github-token`:

```yaml
permissions:
  packages: write

# ...

- uses: savvy-web/silk-release-action@v4
  with:
    app-client-id: ${{ vars.APP_CLIENT_ID }}
    app-private-key: ${{ secrets.APP_PRIVATE_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

The GitHub App installation token the action provisions is not an alternative and cannot be made into one. **GitHub App tokens cannot access GitHub Packages at all** — the sole exception is the default GitHub Actions token, which is a special kind of App token. Permissions do not change this: an installation token holding `packages: write` is rejected `403` on a plain read of `npm.pkg.github.com` while the same token resolves the App identity and revokes itself against `api.github.com`.

Omitting the input fails every GitHub Packages target immediately, naming the missing input, and aborts before any GitHub release is created. Granting the App a `Packages` permission to work around it accomplishes nothing.

### Custom registry format

Pass one registry per line in the `custom-registries` input — the registry URL immediately followed by its npmrc auth string:

```yaml
custom-registries: |
  https://registry.example.com/_authToken=${{ secrets.CUSTOM_NPM_TOKEN }}
  https://other-registry.com/_authToken=${{ secrets.OTHER_TOKEN }}
```

Each token is masked in the workflow log and written to the npmrc that `npm publish` reads; it is never exported into the process environment. A malformed line **fails the run** with a message naming the line — silence is how this input once regressed into a multi-release no-op ([#90](https://github.com/savvy-web/silk-release-action/pull/90), restored via [#215](https://github.com/savvy-web/silk-release-action/issues/215)).

Two shapes the pre-v0.2.3 implementation accepted are deliberately rejected now:

- `https://registry.example.com/_auth=<base64>` — basic auth is no longer supported; supply a bearer token as `_authToken=<token>`.
- `https://registry.example.com/` (a bare URL) — the GitHub App token fallback was removed; every custom registry needs an explicit token.

## SBOM configuration

Provide SBOM metadata as a JSON string conforming to the `SilkReleaseConfig` schema. The action validates the input at startup and exits immediately with a descriptive error if the value does not parse or fails schema validation.

```yaml
sbom-config: |
  {
    "sbom": {
      "supplier": {
        "name": "Your Company",
        "url": "https://company.com",
        "contact": { "email": "security@company.com" }
      },
      "copyright": { "holder": "Your Company LLC" }
    }
  }
```

This can also be set via the `SILK_RELEASE_SBOM_TEMPLATE` environment variable. The input takes precedence.
