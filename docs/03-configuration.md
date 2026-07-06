# Configuration reference

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `app-client-id` | Yes | -- | GitHub App client ID for authentication |
| `app-private-key` | Yes | -- | GitHub App private key (PEM format) |
| `github-token` | No | `""` | GitHub token for GitHub Packages publishing. Use when the GitHub App lacks `packages:write` permission. Typically `secrets.GITHUB_TOKEN` |
| `skip-token-revoke` | No | `"false"` | Skip token revocation in post-action (tokens expire after 1 hour anyway) |
| `release-branch` | No | `changeset-release/main` | Name of the release branch |
| `target-branch` | No | `main` | Target branch for the release PR |
| `pr-title-prefix` | No | `chore: release` | Fallback title for the release PR and commit subject. Used only when no releasable package or version can be determined; otherwise the title is derived as `release: <version>` (see [How it works](./02-how-it-works.md)) |
| `dry-run` | No | `"false"` | Run in dry-run mode (preview only, no actual changes) |
| `phase` | No | `""` | Explicitly set the workflow phase, skipping automatic detection. Values: `branch-management`, `validation`, `publishing`, `close-issues`, `none` |
| `npm-token` | No | `""` | NPM access token for publishing to npmjs.org. Only needed for first-time publish or when OIDC is not configured |
| `strict-warnings` | No | `"false"` | When `"true"`, warning-severity validation findings escalate the check run conclusion from `neutral` to `failure`, blocking auto-merge rules that gate on check status. Errors always fail regardless of this setting |
| `sbom-config` | No | `""` | SBOM metadata configuration (JSON string) for NTIA-compliant SBOM generation. Must conform to the `SilkReleaseConfig` schema |
| `custom-registries` | No | `""` | Custom registries with authentication (one per line). Format: `https://registry.example.com/_authToken=<token>` |

## Outputs

| Output | Description |
| --- | --- |
| `token` | Generated GitHub App installation token |
| `installation-id` | GitHub App installation ID |
| `app-slug` | GitHub App slug (URL-friendly name) |
| `result` | Structured JSON describing the run — see below |
| `phase` | Phase that ran: `branch-management`, `validation`, `publishing` |
| `status` | Run status: `no-op`, `success`, `partial`, `failed` |
| `succeeded` | Whether all intended work completed |
| `package-count` | Number of packages the phase touched |
| `release-pr-number` | Release PR number, when one is involved (empty otherwise) |

The `result` output is a phase-discriminated JSON object validated by
`https://raw.githubusercontent.com/savvy-web/silk-release-action/main/silk-release-action.output.schema.json`. It carries the
machine-readable contract: the three orthogonal flags (`noop`, `succeeded`,
`hasFailures`), a `dryRun` marker, and exactly one phase payload block. Read fields with the `fromJSON()` expression function — e.g.
`${{ fromJSON(steps.release.outputs.result).status }}` — and branch on
`schemaVersion` for forward compatibility.

The serialized payload does not include per-package release notes. The validation phase still computes the next CHANGELOG entries, but it surfaces them in the dedicated Release Notes Preview check rather than in `result`. To read release notes from a workflow, fetch the GitHub release body after Phase 3, or read the Release Notes Preview check on the release PR.

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
| GitHub Packages | Token auth | Uses the generated GitHub App token (or the `github-token` input) automatically |
| Custom registries | `custom-registries` input | Format: `https://registry.example.com/_authToken=<token>` |

### npm trusted publishing and token fallback

For OIDC trusted publishing to npm, your workflow needs `id-token: write` permission and the package must already exist on npmjs.com with your repository trusted. The action attempts trusted publishing first. When trusted publishing fails — which is always the case for a first-time publish, since npm cannot bootstrap a package that has no trusted publisher configured yet — and an `npm-token` is available, the action retries the same tarball with classic token auth. Provide the `npm-token` input for first-time publishes and for any package that has not yet been configured for trusted publishing.

### GitHub Packages auth

GitHub Packages does not support npm's tokenless OIDC trusted publishing, so the action authenticates with the GitHub App token (or the `github-token` input) from the first attempt rather than letting npm's auto-attempted OIDC exchange fail.

### Custom registry format

Pass one registry per line in the `custom-registries` input:

```yaml
custom-registries: |
  https://registry.example.com/_authToken=${{ secrets.CUSTOM_NPM_TOKEN }}
  https://other-registry.com/_authToken=${{ secrets.OTHER_TOKEN }}
```

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
