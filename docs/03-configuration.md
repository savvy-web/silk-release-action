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
| `version-command` | No | `""` | Custom version command (defaults to auto-detected `{package-manager} ci:version`) |
| `pr-title-prefix` | No | `chore: release` | Prefix for the release PR title |
| `dry-run` | No | `"false"` | Run in dry-run mode (preview only, no actual changes) |
| `phase` | No | `""` | Explicitly set the workflow phase, skipping automatic detection. Values: `branch-management`, `validation`, `publishing`, `close-issues`, `none` |
| `npm-token` | No | `""` | NPM access token for publishing to npmjs.org. Only needed for first-time publish or when OIDC is not configured |
| `sbom-config` | No | `""` | SBOM metadata configuration (JSON) for NTIA-compliant SBOM generation |
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
`https://json.schemastore.org/silk-release-action.schema.json`. It carries the
machine-readable contract: the three orthogonal flags (`noop`, `succeeded`,
`hasFailures`), a `dryRun` marker, and exactly one phase payload block. Read fields with the `fromJSON()` expression function — e.g.
`${{ fromJSON(steps.release.outputs.result).status }}` — and branch on
`schemaVersion` for forward compatibility.

## Authentication model

The action uses a tiered approach for multi-registry publishing:

| Registry | Method | Configuration |
| --- | --- | --- |
| npm | OIDC trusted publishing | No token needed (requires package to exist). Fallback: `npm-token` input |
| JSR | OIDC trusted publishing | No configuration needed |
| GitHub Packages | GitHub App token | Uses the generated token automatically |
| Custom registries | `custom-registries` input | Format: `https://registry.example.com/_authToken=<token>` |

### npm OIDC setup

For OIDC trusted publishing to npm, your workflow needs `id-token: write` permission and the package must already exist on npmjs.com with your repository trusted. For first-time publishes, use the `npm-token` input.

### Custom registry format

Pass one registry per line in the `custom-registries` input:

```yaml
custom-registries: |
  https://registry.example.com/_authToken=${{ secrets.CUSTOM_NPM_TOKEN }}
  https://other-registry.com/_authToken=${{ secrets.OTHER_TOKEN }}
```

## SBOM configuration

Provide SBOM metadata as a JSON string:

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
