# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Repository Overview

Private repository for **shared GitHub Actions, reusable workflows, and GitHub project management automation** (`@savvy-web/silk-release-action`).

1. **Shared GitHub Actions** - Reusable composite actions for CI/CD
2. **Reusable Workflows** - Standardized templates for PR validation, releases
3. **GitHub Project Management** - Automation for GitHub Projects, issues, routing
4. **Internal Tooling** - Scripts and utilities for GitHub operations

## Design Documentation

Load design docs when working on the relevant subsystem:

- `@.claude/design/release-action/architecture.md` - Three-phase workflow, module dependency graph, entry points, shared infrastructure
- `@.claude/design/release-action/integration.md` - Multi-registry publishing, OIDC auth, SBOM/NTIA compliance, publish summaries
- `@.claude/design/release-action/testing.md` - Test strategy, mock factory patterns, coverage map, specialized testing patterns

## Silk Release Action

TypeScript-based GitHub Action for automated release management with changesets. Entry points: `pre.ts`, `main.ts`, `post.ts`. Source layout: `src/release/` (phase orchestration, publishability, reporting), `src/schema/` (output schema and projections), `src/utils/` (utility modules), `src/types/` (shared types). JSON Schema artifacts at `silk-release-action.input.schema.json` and `silk-release-action.output.schema.json`.

**Three-phase workflow:**

1. **Phase 1 (Branch Management)** - Push to `main` triggers changeset detection, creates/updates `changeset-release/main` branch and release PR
2. **Phase 2 (Validation)** - Push to release branch triggers build validation, publish dry-runs, release notes preview, and sticky comment updates
3. **Phase 3 (Publishing)** - Merge of release PR triggers multi-registry publishing, GitHub releases, and SBOM/attestation generation

For full architecture, module dependency graph, and per-module documentation: `@.claude/design/release-action/architecture.md`

### Action Inputs

| Input | Required | Default | Description |
| ----- | -------- | ------- | ----------- |
| `app-client-id` | Yes | - | GitHub App client ID |
| `app-private-key` | Yes | - | GitHub App private key (PEM) |
| `github-token` | No | `""` | GitHub token for GitHub Packages publishing |
| `release-branch` | No | `changeset-release/main` | Release branch name |
| `target-branch` | No | `main` | Target branch for release PR |
| `version-command` | No | auto | Custom version command |
| `pr-title-prefix` | No | `chore: release` | Release PR title prefix |
| `dry-run` | No | `false` | Dry-run mode |
| `phase` | No | `""` | Explicitly set phase (skips auto-detection) |
| `npm-token` | No | `""` | NPM token (OIDC fallback or first-time publish) |
| `strict-warnings` | No | `false` | Escalate warnings to failures (blocks auto-merge) |
| `sbom-config` | No | `""` | SBOM metadata JSON (schema-validated) |
| `custom-registries` | No | `""` | Custom registry auth (one per line) |
| `skip-token-revoke` | No | `false` | Skip App token revocation in post |

### Authentication Model

| Registry | Method | Notes |
| -------- | ------ | ----- |
| **npm** | OIDC | Trusted publishing; use `npm-token` for first publish or OIDC fallback |
| **JSR** | OIDC | Trusted publishing, no token needed |
| **GitHub Packages** | `github-token` input | Pass `secrets.GITHUB_TOKEN` with `packages: write` |
| **Custom registries** | `custom-registries` input | Format: `https://registry.example.com/_authToken=<TOKEN>` |

For full integration details, token plumbing, and `SILK_GITHUB_PACKAGES_TOKEN`: `@.claude/design/release-action/integration.md`

### Integration Testing

Use `savvy-web/silk-integration` to test from feature branches:

1. Make changes and run tests: `pnpm ci:test`
2. Build: `pnpm build` (updates `dist/main.js`)
3. Push to feature branch
4. Trigger: `gh workflow run release.yml --repo savvy-web/silk-integration --ref main`
5. Watch: `gh run list --repo savvy-web/silk-integration --limit 1`

### Dogfooding @savvy-web/github-action-effects

This action is BUILT WITH `@savvy-web/github-action-effects`, currently resolved from the registry at `^2.0.0` (no link active). Use this procedure to dogfood a future pre-release of that library through this action before it publishes:

1. **Build the library:** in `../github-action-effects` (on its `changeset-release/main` branch at the staging version) run `pnpm build` — produces `dist/npm`.
2. **Link it:** from this repo run `pnpm link ../github-action-effects`. The `node_modules/@savvy-web/github-action-effects` symlink then resolves the local staging build. Verify the linked version by reading the symlinked `package.json` via `node:fs` (NOT `require(...package.json)` — the package's `exports` map does not expose `./package.json`), or with `pnpm why @savvy-web/github-action-effects`.
3. **Keep the declared range correct** for the eventual unlinked install: this repo's `package.json` must keep the `@savvy-web/github-action-effects` range that matches the pre-release line being dogfooded. The link overrides resolution while it is in place.
4. **Iterate:** edit source → `pnpm typecheck` → `pnpm build` (bundles the linked library into `dist/`) → commit → push to `dev`.
5. **Run the integration repo:** the `dev` action is consumed by the integration repo at local path `../workflow-integration` (GitHub `savvy-web/silk-integration`). Spencer initiates release runs there; follow them with `gh run list --repo savvy-web/silk-integration` / `gh run watch --repo savvy-web/silk-integration`, diagnose failures, fix, rebuild, re-push.
6. **Library-side failures:** if a failure traces to the LIBRARY, fix it in `../github-action-effects`, run `pnpm build` there, and the linked bundle picks up the change on the next `pnpm build` in this repo. Library edits land on `changeset-release/main` and ship with the next published version on merge — call them out.
7. **Final step, only AFTER the dogfooded version publishes:** remove the `pnpm link` and pin the published range from the registry (`pnpm install`). This is the current state for 2.0.0 — the link is already removed and the registry copy is in use. Re-apply steps 1–6 only when dogfooding a new pre-release.

## Common Commands

### Linting and Formatting

```bash
pnpm lint              # Biome checks (no auto-fix)
pnpm lint:fix          # Biome with safe auto-fix
pnpm lint:fix:unsafe   # Biome with unsafe fixes
pnpm lint:md           # Markdown linting
pnpm lint:md:fix       # Markdown auto-fix
```

### Type Checking

```bash
pnpm typecheck         # Run tsgo --noEmit via Turbo
```

`tsgo` is the TypeScript native preview build, invoked via Turbo for caching.

### Testing

```bash
pnpm test                              # Run all tests
pnpm test path/to/test.test.ts         # Specific test file
pnpm test --watch                      # Watch mode
pnpm test --coverage                   # With coverage report
pnpm ci:test                           # CI mode with coverage
```

### Git Workflow

```bash
pnpm ci:version        # changeset version && biome format --write .
```

### Pre-commit Hooks

Husky with lint-staged processes staged files on commit:

- `package.json` sorted and formatted with Biome
- TypeScript/JavaScript checked with Biome
- Markdown linted with `markdownlint-cli2`
- Shell scripts have executable bits removed
- YAML formatted with Prettier, validated with `yaml-lint`
- TypeScript changes trigger `tsgo --noEmit`

Hooks skip in CI (`GITHUB_ACTIONS=1`) and during rebase/squash (except final commit).

## Code Quality Standards

### Biome Configuration

Strict rules enforced (see `biome.jsonc`):

- Tabs, width 2 | Line width 120
- Lexicographic import ordering
- Forced `.js` extensions in imports
- Separated type imports (`separatedType` style)
- `node:` protocol required for Node.js imports
- Prefer `type` over `interface`
- Explicit types required for exports (except tests/scripts)
- No import cycles | No unused variables (`ignoreRestSiblings: true`)

### TypeScript Configuration

- Module: ESNext with bundler resolution | Target: ES2022 | Strict mode
- `resolveJsonModule` enabled | Vitest globals available

### Markdown Linting

Use `markdownlint-cli2` with config at `lib/configs/.markdownlint-cli2.jsonc`. Excludes `node_modules` and `dist`.

### Commit Messages

Conventional Commits format enforced via commitlint (`@commitlint/config-conventional`, 300 char body). PR titles and commit messages validated in CI.

## File Naming Conventions

- Lowercase filenames preferred
- Always use explicit `.js` extensions in imports
- `.jsonc` for JSON with comments
- `.ts` for source, `.test.ts` for tests

## Shared GitHub Actions

Reusable composite actions live in `.github/actions/`:

| Action | Description |
| ------ | ----------- |
| **release** | Release environment setup and orchestration |
| **local** | Local action variant for this repository |

## Reusable Workflows

Workflows live in `.github/workflows/`:

| Workflow | File | Purpose |
| -------- | ---- | ------- |
| **Claude Code** | `claude.yml` | Enables @claude mentions in issues/PRs |
| **Project Listener** | `project-listener.yml` | Reusable workflow for adding items to GitHub Projects |
| **Release** | `release.yml` | Release workflow for this repository |

This repository uses the **simple release workflow** (private repo, no NPM packages).

## Project Structure

```text
.
├── .changeset/              # Changeset configuration
├── .claude/                 # Claude Code configuration
│   ├── commands/            # Custom slash commands
│   └── design/              # Design documentation
├── .github/                 # GitHub workflows and actions
│   ├── actions/             # Reusable composite actions
│   ├── ISSUE_TEMPLATE/      # Issue templates
│   └── workflows/           # CI/CD workflows
├── .husky/                  # Git hooks
├── src/                     # Main action source code
│   ├── release/             # Phase orchestration, publishability, reporting (co-located tests)
│   ├── schema/              # ReleaseOutput schema, projections, SilkReleaseConfig
│   ├── types/               # Type definitions
│   └── utils/               # Utility modules
├── __test__/                # Test files and utilities (singular)
├── biome.jsonc              # Biome configuration
├── tsconfig.json            # TypeScript configuration
└── turbo.json               # Turborepo configuration
```

## Adding New Workflows/Actions

### TypeScript Actions (Preferred)

Write action logic in TypeScript for type safety and testability. Create in `.github/actions/action-name/` with `action.yml`.

### Reusable Workflows

Create in `.github/workflows/` with `workflow_call` trigger. Document required secrets and inputs.

**Path syntax:**

- **Within this repository:** `./.github/workflows/...`
- **From other repositories:** `savvy-web/silk-release-action/.github/workflows/...@main`

## Turborepo Configuration

- Daemon enabled | Strict environment mode
- Global passthrough: `GITHUB_ACTIONS`, `GITHUB_OUTPUT`
- `//#typecheck:all` (root, cached) | `typecheck` (package-level, depends on root)

## Environment Variables

Strict environment mode in Turbo. Declare new env vars in `turbo.json` under `globalPassThroughEnv` or task-specific `env`.

## Custom Claude Commands

Available in `.claude/commands/`:

- `/lint` - Fix linting errors
- `/typecheck` - Fix TypeScript errors
- `/tsdoc` - Add/update TSDoc documentation
- `/fix-issue` - Find issue, create branch, fix, test
- `/pr-review` - Review bot comments on PR
- `/build-fix` - Fix build errors
- `/test-fix` - Fix failing tests
- `/turbo-check` - Check Turbo configuration
- `/package-setup` - Set up new workspace package

## GitHub App Configuration

Use GitHub App tokens (not PATs) for workflows.

**Required App permissions:**

- Repository: Actions (read), Checks (read/write), Contents (read/write), Issues (read/write), Pull Requests (read/write)
- Organization: Projects (read/write)

**Required secrets:**

| Secret | Purpose |
| ------ | ------- |
| `APP_CLIENT_ID` | GitHub App client ID (maps to `app-client-id` input) |
| `APP_PRIVATE_KEY` | GitHub App private key PEM (maps to `app-private-key` input) |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code integration |
| `CLAUDE_REVIEW_PAT` | User context operations (thread resolution) |
| `NPM_TOKEN` | NPM publishing (standard workflow only) |

## Important Notes

1. Never commit secrets (`.env` and credentials excluded from git)
2. Shell scripts are not executable (`chmod -x` enforced via lint-staged)
3. Biome is authoritative for all formatting decisions
4. Use changesets for package version management
5. GitHub App tokens preferred over PATs
6. GraphQL required for ProjectsV2 (REST only supports legacy Projects)
7. Track active work in GitHub issues
