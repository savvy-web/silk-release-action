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

- `@./.claude/design/release-action/architecture.md` - Three-phase workflow, native versioning (zero-install Phase 1), module dependency graph, entry points, shared infrastructure
- `@./.claude/design/release-action/integration.md` - Multi-registry publishing, OIDC auth, native versioning/changelog module map, token plumbing, SBOM/NTIA compliance, publish summaries
- `@./.claude/design/release-action/testing.md` - Test strategy, test-layer patterns, silk-effects test factories, coverage map, specialized testing patterns

## Silk Release Action

TypeScript-based GitHub Action for automated release management with changesets. Entry points: `pre.ts`, `main.ts`, `post.ts`. Source layout: `src/release/` (phase orchestration, publishability, reporting), `src/schema/` (output schema and projections), `src/utils/` (utility modules), `src/types/` (shared types). JSON Schema artifacts at `silk-release-action.input.schema.json` and `silk-release-action.output.schema.json`.

**Three-phase workflow:**

1. **Phase 1 (Branch Management)** - Push to `main` triggers changeset detection, creates/updates `changeset-release/main` branch and release PR. Versioning runs in-process (zero-install) via the bundled silk-effects v3 `ReleasePlanner` — no consumer `ci:version` script, no `version-command` input
2. **Phase 2 (Validation)** - Push to release branch triggers build validation, publish dry-runs, release notes preview, and sticky comment updates
3. **Phase 3 (Publishing)** - Merge of release PR triggers multi-registry publishing, GitHub releases, and SBOM/attestation generation

For full architecture, module dependency graph, and per-module documentation: `@./.claude/design/release-action/architecture.md`

### Action Inputs

| Input | Required | Default | Description |
| ----- | -------- | ------- | ----------- |
| `app-client-id` | Yes | - | GitHub App client ID |
| `app-private-key` | Yes | - | GitHub App private key (PEM) |
| `github-token` | No | `""` | GitHub token for GitHub Packages publishing |
| `release-branch` | No | `changeset-release/main` | Release branch name |
| `target-branch` | No | `main` | Target branch for release PR |
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

For full integration details, token plumbing, and `SILK_GITHUB_PACKAGES_TOKEN`: `@./.claude/design/release-action/integration.md`

### Integration Testing

Use `savvy-web/silk-integration` to test from feature branches:

1. Make changes and run tests: `pnpm ci:test`
2. Build: `pnpm build` (updates `dist/main.js`)
3. Push to feature branch
4. Trigger: `gh workflow run release.yml --repo savvy-web/silk-integration --ref main`
5. Watch: `gh run list --repo savvy-web/silk-integration --limit 1`

### Dogfooding First-Party Dependencies

We author every dependency in the table below, so a bug or missing API in one can be fixed **in its own repo** and dogfooded through this action before publishing. The action is a **bundled** artifact — `pnpm build` inlines every dependency into `dist/{main,pre,post}.js` — so once a local library build is linked and this repo is rebuilt, the change is baked into the committed `dist`. The integration repo runs that committed `dist`, **not** `node_modules`.

| Package | Repo | Local checkout |
| ------- | ---- | -------------- |
| `@savvy-web/github-action-effects` | `savvy-web/systems` (monorepo) | `../systems/packages/github-action-effects` |
| `@savvy-web/github-action-builder` | `savvy-web/systems` (monorepo) | `../systems/packages/github-action-builder` |
| `@savvy-web/silk-effects` | `savvy-web/systems` (monorepo) | `../systems/packages/silk-effects` |
| `workspaces-effect` | `spencerbeggs/workspaces-effect` | `../../spencerbeggs/workspaces-effect` |
| `json-schema-effect` | `spencerbeggs/json-schema-effect` | `../../spencerbeggs/json-schema-effect` |

`@savvy-web/silk-effects` itself depends on `workspaces-effect` and `json-schema-effect`, so those resolve **both directly and transitively** — which decides the linking mechanism below.

**Two ways to link a local library build:**

- **Direct-only dependency → `pnpm link`.** e.g. `pnpm link ../systems/packages/github-action-effects` symlinks `node_modules/@savvy-web/github-action-effects` to the local build. Verify the linked `package.json` via `node:fs` (NOT `require(...package.json)` — the `exports` map does not expose `./package.json`), or `pnpm why <pkg>`.
- **Also a transitive dependency → `pnpm-workspace.yaml` override.** A bare `pnpm link` redirects only the direct import, leaving the transitive copy (e.g. `workspaces-effect` pulled in by `silk-effects`) on the registry version and bundling **two** copies. A `link:` override forces every resolution to one local copy:

  ```yaml
  # pnpm-workspace.yaml
  overrides:
    workspaces-effect: "link:../../spencerbeggs/workspaces-effect/dist/dev"
  ```

  then `pnpm install`. `dist/dev` is the rslib-builder link target (`publishConfig.directory` + `linkDirectory: true`). Effect resolves services by the tag's string id, so the one provided layer is shared even across duplicate copies — but the override keeps the bundle to a single copy. Verify every resolution points at the link: `find node_modules -name workspaces-effect`.

**Procedure (either mechanism):**

1. **Build the library:** in its repo run `pnpm ci:build` (produces `dist/dev` link target plus `dist/npm` / `dist/github`).
2. **Link it** (link or override) and `pnpm install`.
3. **Keep the declared range correct** in this repo's `package.json` for the eventual unlinked install — the link/override overrides resolution only while in place.
4. **Iterate:** edit library source → `pnpm ci:build` there → `pnpm typecheck` + `pnpm test` here → `pnpm build` here (bundles the linked lib into `dist/`) → commit the full state (`src` + `dist` + changeset + the `pnpm-workspace.yaml` override + `pnpm-lock.yaml`) → push `dev`.
5. **Library edits ship separately:** they land on the library's own branch and release with its next published version — call them out.
6. **Run the integration repo:** the `dev` action is consumed by `savvy-web/silk-integration` (pins `@dev`). Spencer triggers release runs there; follow with `gh run list --repo savvy-web/silk-integration` / `gh run watch`, diagnose, fix, rebuild, re-push.
7. **Final step, only AFTER the dogfooded version publishes:** remove the link/override, pin the published range, `pnpm install`.

**Committing while a link/override is active:** commit the **full dogfood state** to `dev` — `src` + rebuilt `dist` + changeset **and** the `pnpm-workspace.yaml` override + `pnpm-lock.yaml`. The override holds a machine-specific link path, so `dev` only installs cleanly with the sibling repos checked out at the paths in the table above; that is the accepted dogfooding trade-off, and the cleanup in step 7 reverts it. No CI runs on a plain `dev` push, so the committed `dev` source may reference an unpublished library API until it publishes — expected during dogfooding. Commits must be GPG-signed with the GitHub-verified key for `C. Spencer Beggs <spencer@savvyweb.systems>` or the signature ruleset rejects them.

**Currently active:** `pnpm-workspace.yaml` overrides link **`@savvy-web/github-action-effects`** and **`@savvy-web/silk-effects`** to `../systems/packages/<pkg>/dist/dev/pkg`, dogfooding the npm-12 `pack --json` fix (pinned `npm@11` executor) and the three publish guards from #144 before those versions publish. Both are also transitive deps, hence overrides rather than `pnpm link`. Remove both overrides and pin the published ranges once the fixed `github-action-effects` and `silk-effects` release (step 7). The remaining first-party dependencies are pinned to published registry versions: `@savvy-web/github-action-builder ^1.1.1` (dev), `workspaces-effect ^2.0.2`, and `json-schema-effect ^0.3.0`. Unlike the earlier dependency-only major bumps, the silk-effects v3 and github-action-builder 1.1 upgrades are actively consumed: Phase-1 native versioning drives the v3 changesets `ReleasePlanner`/`ConfigInspector` engine and its `changelogModules` seam, and the builder's `build.nativeDynamicImports` keeps the changesets/workspaces-effect runtime dynamic imports native in the bundle.

## Development & Release Cycle

### The `dev` branch convention

All in-progress feature work lands on a long-lived **`dev`** branch, never directly on `main`. `main` always reflects the last released state.

The shared release workflow at `savvy-web/.github/.github/workflows/release.yml` has a matching **`dev` branch**. Consumer repos pin their calling workflow to it (`uses: savvy-web/.github/.github/workflows/release.yml@dev`) so they exercise in-progress workflow changes before they reach `main`. This repo's own `release.yml` and the end-to-end test repo `savvy-web/silk-integration` both pin `@dev` (see [Integration Testing](#integration-testing) and the dogfooding procedure above — Spencer initiates the integration runs).

### Flow: `dev` → `main` → release

1. Feature work accumulates on `dev`; merge it into `main` when ready.
2. The push to `main` triggers **Phase 1** — changeset detection creates/updates `changeset-release/main` and the release PR.
3. Pushes to the release branch trigger **Phase 2** validation (build, publish dry-runs, release-notes preview, sticky comment).
4. Merging the release PR triggers **Phase 3** — publishing, Git tags, and a published GitHub release.
5. The published release fires `release-sync.yml` (below), which closes the loop by resetting `dev` back to `main`.

### `release-sync.yml` — post-release housekeeping

Triggered by `release: [published]` (and `workflow_dispatch` with a `tag` input + `dry-run` for rehearsal). Runs as the GitHub App bot so its pushes can bypass protection and won't recurse (no workflow triggers on tag/`dev` pushes). On a **stable SemVer 2.0.0 release `>= 1.0.0`** (bare `MAJOR.MINOR.PATCH` — no leading `v`, no `-prerelease`, no `+build`) it:

1. Moves (or creates) the **`v<major>`** alias tag (e.g. `v1`) at the released commit.
2. **Hard-resets `dev` to `main` HEAD** — a genuine clobber, so any `dev` commit not yet in `main` is discarded. This is safe by design: `dev` work always lands in `main` before a release.

Each push is guarded: if the remote `v<major>` tag or `dev` already points at its target commit, that push is skipped, so no ref-update events fire for listeners when there is nothing to change. Sub-`1.0.0`, prerelease, build-metadata, and non-SemVer tags are ignored (no-op).

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
pnpm test --watch                      # Watch mode
pnpm test --coverage                   # With coverage report
pnpm ci:test                           # CI mode with coverage
```

A CLI file argument does **not** filter to a single file here (vitest projects are discovered via the vitest-agent plugin) — to run specific files, use the vitest-agent MCP `run_tests` tool with a `files` array.

### Git Workflow

```bash
pnpm ci:version        # savvy changeset version && biome format --write . (this repo's own versioning)
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
- Prefer `interface` over `type` for object shapes (Biome `useConsistentTypeDefinitions` rewrites `type X = {…}` to `interface`); use `type` for unions and aliases
- Explicit types required for exports (except tests/scripts)
- No import cycles | No unused variables (`ignoreRestSiblings: true`)

### TypeScript Configuration

- Module: ESNext with bundler resolution | Target: ES2022 | Strict mode
- `resolveJsonModule` enabled | tests import Vitest APIs explicitly (`import { describe, it, expect } from "vitest"`) — globals are not enabled

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
| **Release Sync** | `release-sync.yml` | On a published stable release (`>= 1.0.0`): moves the `v<major>` alias tag and hard-resets `dev` to `main` |

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
