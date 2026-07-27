# silk-release-action documentation

Automated release management for GitHub repositories using changesets: detecting changes, creating release PRs, validating builds, publishing to multiple registries and creating GitHub releases, in a single action.

## Pages

- [Getting started](./01-getting-started.md) — Installation, prerequisites and first workflow setup
- [How it works](./02-how-it-works.md) — The three-phase release lifecycle explained
- [Configuration reference](./03-configuration.md) — All inputs, outputs and authentication options
- [Troubleshooting](./04-troubleshooting.md) — Common issues and solutions
- [Examples](./examples/) — Per-phase workflow files
  - [release-branch.yml](./examples/release-branch.yml) — Phase 1: Branch management
  - [release-validate.yml](./examples/release-validate.yml) — Phase 2: Validation
  - [release-publish.yml](./examples/release-publish.yml) — Phase 3: Publishing
