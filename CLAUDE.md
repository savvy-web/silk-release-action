# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Repository Overview

Private repository (`@savvy-web/silk-release-action`) holding the release action itself plus shared composite actions, reusable workflows, GitHub Projects automation, and internal GitHub tooling.

## Design Documentation

Load design docs when working on the relevant subsystem:

- `@./.claude/design/release-action/architecture.md` - Three-phase workflow, native versioning (zero-install Phase 1), the managed release-PR body region, module dependency graph, entry points, shared infrastructure
- `@./.claude/design/release-action/integration.md` - Multi-registry publishing, OIDC auth, native versioning/changelog module map, token plumbing, SBOM/NTIA compliance, publish summaries
- `@./.claude/design/release-action/testing.md` - Test strategy, test-layer patterns, silk-effects test factories, coverage map, specialized testing patterns, the remaining `CHARACTERIZATION` tests

**Phase-2 degradation — partly fixed, still partly live. Read before touching it.** A degraded step reports a green release verdict for work that never ran unless it **contributes a finding**, because findings are the only thing the verdict reads.

The **publish-validation crash path is fixed** ([issue #216](https://github.com/savvy-web/silk-release-action/issues/216)): a crash now returns `crashedPublishValidation`, carrying an `error` finding per affected check, so it reports red instead of ✅ 5/5. Its characterization tests were converted to assert the fixed behaviour.

The **other Phase-2 degradation paths are still live** — a crashed issue-linking step, a check run that could not be created, a failed comment write, and a failed pull-request lookup all still degrade silently. They remain pinned by **10 `CHARACTERIZATION` test cases across four files**, each written to fail when *their* fix lands — 7 pinning the degradation paths themselves (`link-issues-and-build-steps.test.ts`, `per-step-checks.test.ts`, `publish-validation-report.test.ts`) and 3 pinning adjacent reporting oddities in `validation-checks.test.ts`. Count test **cases**: grepping `CHARACTERIZATION` returns 18 lines across the test tree, because block comments and two historical `Was \`CHARACTERIZATION — …\`` notes in `publish-validation.test.ts` (whose own pins were fixed and converted) match too. Load *Degradation semantics (issue #216)* in `architecture.md` and its companion in `testing.md` before changing a `steps/*` failure posture, or you will "fix" a test that is deliberately pinning a bug.

Two rules the fix established, both load-bearing: a degraded step contributes a **finding** rather than flipping a boolean (flipping `publishOk` would double-count the build-failed path), and `Effect.catch` must never be widened to `catchCause` — a defect killing the phase is the last honest failure signal.

### Vendored reference repos (`.repos/`)

One read-only submodule, managed via `savvy repos` (config in `.repos/config.json`, wiring in `.gitmodules`). Consult it before assuming an API shape; do not edit it. `node_modules` wins on any disagreement.

- `.repos/effect` — `Effect-TS/effect` pinned to `effect@4.0.0-rc.109`, matching the `catalog:effect` version (sparse: `packages/effect`, `packages/vitest`, `migration`, `ai-docs`, `LLMS.md`, `MIGRATION.md`). The authority on what v4 exports, the v3→v4 migration notes, and the `@effect/vitest` reference. Services/tags live in `Context.ts` — there is no `ServiceMap.ts`. Note the rc line: the standalone `effect/SchemaError` module is gone; `SchemaError` is exported from `effect/Schema`.

(`.repos/effect-smol` and `.repos/effected` are gone — v4 development moved back to the main Effect monorepo, and the effected pin was dropped in 880cb45. For the `@effected/*` kit's surface, consult `node_modules` or the sibling checkout at `../../spencerbeggs/effected`.)

## Silk Release Action

TypeScript-based GitHub Action for automated release management with changesets. Entry points: `pre.ts`, `main.ts`, `post.ts`.

**Source layout.** `main.ts` is a 19-line entry guard only; composition lives in `src/program.ts` (read inputs → detect phase → five-arm switch) and the layer graph in `src/layers/`. Phase bodies are one module each under `src/steps/`. Also: `src/release/` (publish, releases, validation, reporting, publishability, `resolve-targets.ts`), `src/schema/` (`inputs.ts` and `outputs.ts` are the single decode/declare points, plus the output schema and projections), `src/utils/` (including `release-kind.ts`), `src/types/`, `src/changelog/` (bundled changelog workers). JSON Schema artifacts: `silk-release-action.input.schema.json` at the repo root (unchanged), and the **versioned** `schemas/5.0.0/silk-release-action-5.0.0.json` (the output document — kept under its own version label so a newer schema can't silently move underneath a root path). `pnpm generate-schema` gates on `SchemaPipeline.check` before writing: a contract change against an already-published version fails, names the documents, and writes nothing — bump `SCHEMA_SEMVER` (`lib/scripts/generate-schema.ts`) and `SCHEMA_URL` (`src/schema/release-output.ts`) together in response.

**Output schema v2 (`schemaVersion: "2"`).** The unit is the **workspace**, not the package: `publish.workspaces`/`validation.workspaces` are maps keyed by workspace name (plus an `order` array), each carrying `kind` (`github-only` | `github-with-packages`, from `utils/release-kind.ts`), `success`, `outcome`, `summary`, and a `packages` array. `status`/`noop`/`succeeded`/`hasFailures` are gone from every phase, replaced by `success` + `outcome` + `summary` + `failure` + `totals`. The publish phase's output discriminator is `phase: "publish"` — the `phase` *input* still accepts `publishing`; don't conflate the two. Details: `@./.claude/design/release-action/architecture.md`.

**Three-phase workflow:**

1. **Phase 1 (Branch Management)** - Push to `main` triggers changeset detection, creates/updates `changeset-release/main` branch and release PR. Versioning runs in-process (zero-install) via the bundled silk-effects `ReleasePlanner` — no consumer `ci:version` script, no `version-command` input
2. **Phase 2 (Validation)** - Push to release branch triggers build validation, publish dry-runs, release notes preview, and sticky comment updates
3. **Phase 3 (Publishing)** - Merge of release PR triggers multi-registry publishing, GitHub releases, and SBOM/attestation generation

For full architecture, module dependency graph, and per-module documentation: `@./.claude/design/release-action/architecture.md`

### Action Inputs

| Input | Required | Default | Description |
| ----- | -------- | ------- | ----------- |
| `app-client-id` | Yes | - | GitHub App client ID |
| `app-private-key` | Yes | - | GitHub App private key (PEM) |
| `github-token` | No | `""` | `secrets.GITHUB_TOKEN`; **required for GitHub Packages** (see below) |
| `release-branch` | No | `changeset-release/main` | Release branch name |
| `target-branch` | No | `main` | Target branch for release PR |
| `auto-merge` | No | `""` | Enable auto-merge on the release PR: `merge`, `squash`, `rebase`, or empty to disable |
| `dry-run` | No | `false` | Dry-run mode |
| `phase` | No | `""` | Explicitly set phase (skips auto-detection) |
| `npm-token` | No | `""` | NPM token (OIDC fallback or first-time publish) |
| `strict-warnings` | No | `false` | Escalate warnings to failures (blocks auto-merge) |
| `sbom-config` | No | `""` | SBOM metadata JSON (schema-validated) |
| `custom-registries` | No | `""` | Custom registry auth (one per line) |
| `on-build` | No | `""` | Command run after the validation build; a non-zero exit fails Phase 2. Gate only — exit code is read, stderr is not; must not mutate the repo. Skipped in dry-run along with the build it gates; unset is a total no-op |

### Authentication Model

| Registry | Method | Notes |
| -------- | ------ | ----- |
| **npm** | OIDC | Trusted publishing; use `npm-token` for first publish or OIDC fallback |
| **JSR** | OIDC | Trusted publishing, no token needed |
| **GitHub Packages** | `github-token` input | **Required.** Pass `secrets.GITHUB_TOKEN` with `permissions: packages: write` |
| **Custom registries** | `custom-registries` input | Format: `https://registry.example.com/_authToken=<TOKEN>` |

**Never drop `github-token`.** A GitHub App installation token — including the one this action provisions — cannot access GitHub Packages at all; the sole exception is the default Actions token, which is what `github-token` carries. Omit the input and every Packages publish fails. `custom-registries` is not a substitute. `pre.ts` persists it to `GithubPackagesTokenState` and masks it.

**Removed inputs.** `skip-token-revoke` (an opt-out of cleaning up a live secret, buying nothing the one-hour expiry did not) and `pr-title-prefix` (never reached a real title — every branch that names packages or a version builds its own `release: …` string).

For full integration details and token plumbing: `@./.claude/design/release-action/integration.md`

### Integration Testing

Use `savvy-web/silk-integration` to test from feature branches:

1. Make changes and run tests: `pnpm ci:test`
2. Build: `pnpm build` (updates `dist/main.js`)
3. Push to feature branch
4. Trigger: `gh workflow run release.yml --repo savvy-web/silk-integration --ref main`
5. Watch: `gh run list --repo savvy-web/silk-integration --limit 1`

### Dogfooding First-Party Dependencies

We author nearly every runtime dependency, so a bug or missing API can be fixed in its own repo and dogfooded here before publishing — the action is a **bundled** artifact, so a linked local build is baked into the committed `dist` the integration repo runs.

**For the link/override mechanisms, the full procedure, and the installed dependency line:**
→ `@./CLAUDE.dogfooding.md`

Load before linking a local library build, when a duplicate copy shows up in the bundle, or to check which dependency version a behaviour comes from. **Currently no link or override is active.** When one is, an override on a sibling repo's build must also be `injected` — otherwise a second `effect` instance enters the process and the failures are runtime, not type errors. `@savvy-web/github-action-effects` is **dead** — replaced wholesale by the `@effected/*` kit in [#191](https://github.com/savvy-web/silk-release-action/pull/191).

## Development & Release Cycle

### The `dev` branch convention

All in-progress feature work lands on a long-lived **`dev`** branch, never directly on `main`. `main` always reflects the last released state.

The shared release workflow at `savvy-web/.github/.github/workflows/release.yml` has a matching **`dev` branch**. Consumer repos pin their calling workflow to it (`uses: savvy-web/.github/.github/workflows/release.yml@dev`) so they exercise in-progress workflow changes before they reach `main`. The end-to-end test repo `savvy-web/silk-integration` pins `@dev`; **this repo's own `release.yml` pins `@main`** — the action under development is already the thing being tested here, and pinning the caller to `@dev` too would make a failed run ambiguous between the two. (See [Integration Testing](#integration-testing) and the dogfooding procedure above — Spencer initiates the integration runs.)

### Flow: `dev` → `main` → release

1. Feature work accumulates on `dev`; merge it into `main` when ready.
2. The push to `main` triggers **Phase 1** — changeset detection creates/updates `changeset-release/main` and the release PR.
3. Pushes to the release branch trigger **Phase 2** validation (build, publish dry-runs, release-notes preview, sticky comment).
4. Merging the release PR triggers **Phase 3** — publishing, Git tags, and a published GitHub release.
5. The push to `main` that merged the release PR fires `branch-sync.yml` (below), which closes the loop by evening `dev` out with `main`.

### `branch-sync.yml` — branch-pair housekeeping

Replaces the former `release-sync.yml`. Three concerns, three jobs, all running as the App bot so pushes bypass protection without recursing:

- **`promote`** — a `pnpm/config-deps` merge into `dev` opens or refreshes the `dev` → `main` PR with auto-merge.
- **`sync-dev`** — **any push to `main`** evens `dev` out with it. It keys off *`main` moving*, not off a release being published: a push to `main` that produces no release (a dependency promotion with no changeset) still has to even the branches out, and the old release-triggered form missed exactly that case. Merging `changeset-release/main` is itself a push to `main`, so the release path stays covered.
- **`major-tag`** — a published release moves the **`v<major>`** alias tag to the released commit.

`dev` is **force-reset only when git proves by patch-id that it holds nothing `main` lacks** — the unconditional hard reset the predecessor performed is gone. A `dev` that is genuinely ahead is preparing a release: it gets rebased, and if the rebase conflicts nothing is touched at all.

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
pnpm typecheck         # turbo run types:check (cached)
pnpm types:check       # tsc --noEmit directly, no cache
```

`tsc --noEmit` is the checker; Turbo wraps it as the `types:check` task for caching. (`tsgo`, the native preview build, is no longer used here.)

### Testing

```bash
pnpm test                              # Run all tests
pnpm test:watch                        # Watch mode
pnpm test:coverage                     # With coverage report
pnpm check:collection                  # Collection gate only
pnpm ci:test                           # The gate, then the suite with coverage
```

`ci:test` runs `scripts/check-test-collection.mjs` **before** vitest. A `*.test.ts` the runner's project discovery skips does not run, does not fail and does not appear in any report — the suite stays green over tests that never ran, and `--pass-with-no-tests` means collecting *nothing* also exits 0. The script asks vitest what it actually collected (`vitest list --json`) and diffs that against what is on disk, so it catches an exclusion rule nobody has learned about yet. `__test__/test-placement.test.ts` covers the same ground from the other side, against a known list of sanctioned directories.

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
- TypeScript changes trigger `tsc --noEmit`

Hooks skip in CI (`GITHUB_ACTIONS=1`) and during rebase/squash (except final commit).

## Code Quality Standards

### Biome Configuration

Strict rules enforced (see `biome.json`):

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

## Shared Actions and Workflows

**There is no `.github/actions/` directory.** The canon's `persistLocal` slot — which would emit a `.github/actions/local` composite for an `act` smoke loop — is **deliberately disabled** in `action.config.ts`: we do not run `act` locally, and committing a second copy of the bundle only adds weight to every checkout of the action. `act-test.yml` was removed with it rather than left pointing at a build that is never produced. Re-enabling `persistLocal` is a decision to start using `act`, not a default to restore.

Workflows in `.github/workflows/`:

| Workflow | Purpose |
| -------- | ------- |
| `release.yml` | This repo's own release; calls the shared workflow at `savvy-web/.github` pinned `@main` |
| `branch-sync.yml` | `dev`/`main` branch-pair housekeeping (above) |
| `silk-update.yml` | Config-dependency updates onto `pnpm/config-deps` (scheduled trigger currently commented out; `workflow_dispatch` only) |
| `claude.yml` | @claude mentions |
| `project-listener.yml` | Reusable; adds items to GitHub Projects |
| `dco.yml` | Developer Certificate of Origin sign-off check |

This repository uses the **simple release workflow** (private repo, no NPM packages).

## Project Structure

`src/` (see [Source layout](#silk-release-action) above and `src/CLAUDE.md`), `__test__/` (all tests — singular, see `__test__/CLAUDE.md`), `.claude/{design,plans,skills}/`, `.github/{workflows,instructions,scripts,ISSUE_TEMPLATE}/`, `lib/{configs,scripts,turbo}/`, `scripts/`, `types/`, `docs/`, `schemas/`, `.changeset/`, `.husky/`, and root configs (`biome.json`, `tsconfig.json`, `turbo.json`, `vitest.config.ts`, `action.yml`, `action.config.ts`).

## Adding New Workflows/Actions

### TypeScript Actions (Preferred)

Write action logic in TypeScript for type safety and testability. A new composite or TypeScript action gets its own `.github/actions/<action-name>/` directory with an `action.yml`; no such directory exists today (see [Shared Actions and Workflows](#shared-actions-and-workflows)).

### Reusable Workflows

Create in `.github/workflows/` with `workflow_call` trigger. Document required secrets and inputs.

**Path syntax:**

- **Within this repository:** `./.github/workflows/...`
- **From other repositories:** `savvy-web/silk-release-action/.github/workflows/...@main`

## Turborepo Configuration

- Strict environment mode | Global passthrough: `GITHUB_ACTIONS`, `CI`
- Two tasks, both cached: **`types:check`** (`tsc --noEmit`, no dependencies) and **`build:prod`** (`github-action-builder build` → `dist/**`, `dependsOn: ["types:check"]`)
- `types:check`'s `inputs` must mirror the `include` of the tsconfig `tsc` actually resolves (`@savvy-web/github-action-builder/tsconfig/action.json`), which covers `__test__/**` as well as `src/**`. When they drifted apart, a test-only change hit a cached FULL TURBO and reported a green typecheck without running one. The comment in `turbo.json` records this; keep the two lists in step.

## Environment Variables

Strict environment mode in Turbo. Declare new env vars in `turbo.json` under `globalPassThroughEnv` or task-specific `env`.

## Claude Code tooling

**There is no `.claude/commands/` directory.** Repo-specific commands were replaced by plugin skills and agents: the **silk** plugin (`/silk:*` skills, the `savvy-mcp` tools, `changeset-manager`/`turborepo`/`tsdoctor` agents), the **effected** plugin (the Effect v4 and GitHub-Actions skill suites plus the `action-engineer`, `effect-developer`, `effect-reviewer` and `effect-migrator` agents), **design-docs**, and **vitest-agent**. `pnpm claude` launches Claude Code with the local effected plugin directory linked (`--plugin-dir=../../spencerbeggs/effected/plugins/claude-code`), so plugin changes are dogfooded before release.

`.claude/` holds `design/` (the design docs above), `plans/`, `skills/effected-construct-index`, `cache/` and `dogfood/`.

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
