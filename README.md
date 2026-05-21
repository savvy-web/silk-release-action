# workflow-release-action

[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)

Automated release management for GitHub repositories using changesets. Handles the full release lifecycle — detecting changes, creating release PRs, validating builds, publishing to multiple registries, and creating GitHub releases — in a single action.

## Features

- Three-phase release workflow: branch management, validation, and publishing
- Multi-registry publishing with OIDC support (npm, JSR, GitHub Packages, custom)
- Automatic release PR creation and rebasing with conflict detection
- Build validation and dry-run publish checks before releasing
- SBOM generation and artifact attestation for supply chain security

## Install

```yaml
- uses: savvy-web/workflow-release-action@main
  with:
    app-client-id: ${{ vars.APP_CLIENT_ID }}
    app-private-key: ${{ secrets.APP_PRIVATE_KEY }}
```

## Quick start

```yaml
name: Release

on:
  push:
    branches:
      - main
      - changeset-release/main

permissions:
  contents: write
  pull-requests: write
  checks: write
  id-token: write
  packages: write
  issues: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: savvy-web/workflow-release-action@main
        with:
          app-client-id: ${{ vars.APP_CLIENT_ID }}
          app-private-key: ${{ secrets.APP_PRIVATE_KEY }}
```

## Documentation

- [Getting started](./docs/01-getting-started.md) — Installation, prerequisites, and first workflow setup
- [How it works](./docs/02-how-it-works.md) — The three-phase release lifecycle explained
- [Configuration reference](./docs/03-configuration.md) — All inputs, outputs, and authentication options
- [Troubleshooting](./docs/04-troubleshooting.md) — Common issues and solutions

## License

[MIT](LICENSE)
