---
type: Module
title: Workspace
description: The monorepo root — tooling, CI, branch-pair housekeeping, and shared config for silk-release-action.
kind: workspace
resource: ../..
tags:
  - ci
  - release
  - dx
status: draft
generated:
  by: okfit/claude-code
  at: 2026-11-10T18:07:09Z
sources:
  - id: branch-sync-workflow
    resource: ../../.github/workflows/branch-sync.yml
  - id: turbo-config
    resource: ../../turbo.json
  - id: package-json
    resource: ../../package.json
  - id: workflows-dir
    resource: ../../.github/workflows
  - id: effected-toml
    resource: ../../effected.toml
integrity:
  generated:
    body: e6733d30f3d6874a
---

# Workspace

The repository root: the `.github/workflows/` automation, `turbo.json`'s three
cached tasks, the Biome/lint-staged pipeline, and the `dev` → `main` →
release flow that everything else in this bundle assumes is in place.

## Workflows

| Workflow | Purpose |
| --- | --- |
| `release.yml` | This repo's own release; calls the shared workflow at `savvy-web/.github` pinned `@main` |
| `branch-sync.yml` | `dev`/`main` branch-pair housekeeping (below) |
| `silk-update.yml` | Config-dependency updates onto `pnpm/config-deps` (`workflow_dispatch` only) |
| `claude.yml` | `@claude` mentions |
| `project-listener.yml` | Reusable; adds items to GitHub Projects |
| `dco.yml` | Developer Certificate of Origin sign-off check |

There is deliberately no `.github/actions/` directory: `persistLocal`, the
canon slot that would emit a `.github/actions/local` composite for an `act`
smoke loop, is disabled in `effected.toml`'s `[action.persistLocal]` table
because this repo does not run `act` locally and a second copy of the bundle only adds weight to every
checkout. See
[No local composite action](../decisions/no-local-composite-action.md).

## `branch-sync.yml`

Replaces the former `release-sync.yml`. Three jobs, all running as the App
bot so pushes bypass branch protection without recursing, gated by `if:`
conditions on one workflow so they never race each other (a
`concurrency: { group: branch-sync }` guard covers all three):[^branch-sync-workflow]

- **`promote`** — fires when a `pnpm/config-deps` PR merges into `dev` (or
  on manual dispatch). Opens, or re-asserts auto-merge on, the `dev` → `main`
  PR.
- **`sync-dev`** — fires on **any push to `main`**, not on a release being
  published. It keys off `main` moving because a push to `main` that
  produces no release — a dependency promotion with no changeset, say —
  still has to even the branches out, and a release-triggered form would
  miss exactly that case. Merging `changeset-release/main` is itself a push
  to `main`, so the release path stays covered without a separate trigger.
- **`major-tag`** — fires on `release: [published]`. Moves the `v<major>`
  alias tag to the released commit for a stable SemVer `>= 1.0.0` tag; a
  prerelease or a `0.x` release is a deliberate no-op.

`sync-dev`'s force-reset rule: `dev` is reset to `main` only when
`git merge-tree --write-tree` proves the merge of `dev` into `main` is a
no-op — i.e. `dev` holds nothing `main` lacks, whether `dev` is even,
strictly behind, or was itself squash-merged into `main` already. Commit-
level comparisons (`git cherry` and similar patch-id tools) do not survive a
squash merge: N `dev` commits squashed into one commit on `main` match
nothing under a patch-id comparison and read as unmerged work, which is why
the job compares trees, not commits. When `dev` genuinely diverges it earns
a rebase attempt (`git rebase --empty=drop`); a conflicting rebase is
aborted and `dev` is left untouched rather than partially rewritten, with a
workflow warning telling a human to rebase it by hand.[^branch-sync-workflow] See
[Dev branch flow](../conventions/dev-branch-flow.md) for the `dev` → `main`
→ release cycle this job closes the loop on.

## Turborepo

Strict environment mode; `globalPassThroughEnv: ["GITHUB_ACTIONS", "CI"]`.
Three tasks, all cached:[^turbo-config]

- **`types:check`** — `tsc --noEmit`, no dependencies.
- **`schema:build`** — `effected schema build` → `schemas/**`,
  `dependsOn: ["types:check"]`.
- **`build:prod`** — `effected action build` → `dist/**`,
  `dependsOn: ["types:check", "schema:build"]`. Its `inputs` include
  `effected.toml`, the `[action]` table that declares the entries
  (`pre`/`main`/`post` plus the `changelog-silk`/`changelog-default`
  workers), `[action.build]` (`minify`, and the `ignore` list that stubs
  the unreachable optional `supports-color` and `kerberos`
  requires) and `[action.persistLocal]`.[^effected-toml] There is no
  separate `validate` script: validation runs inside the build.

`types:check`'s `inputs` list must mirror the `include` of the tsconfig
`tsc --noEmit` actually resolves (`@effected/plugin/tsconfig/action.json`,
which the root `tsconfig.json` extends), which covers `__test__/**` as well
as `src/**`. The two lists drifted apart once: a test-only change hit a
cached FULL TURBO and reported a green typecheck without a `tsc` invocation
ever running. `turbo.json` carries no comment recording the rule; see
[Turbo typecheck cache inputs](../gotchas/turbo-typecheck-cache-inputs.md).

## Common commands

```bash
pnpm lint              # Biome checks (no auto-fix)
pnpm lint:fix          # Biome with safe auto-fix
pnpm lint:fix:unsafe   # Biome with unsafe fixes
pnpm lint:md           # Markdown linting
pnpm lint:md:fix       # Markdown auto-fix
pnpm typecheck         # turbo run types:check (cached)
pnpm types:check       # tsc --noEmit directly, no cache
pnpm test              # vitest run --pass-with-no-tests
pnpm ci:test           # the collection gate, then the suite with coverage
pnpm ci:version        # savvy changeset version && biome format --write .
```

`tsc --noEmit` is the checker; Turbo wraps it as the `types:check` task
purely for caching.[^package-json]

## Pre-commit hooks

Husky runs lint-staged over staged files on every commit:

- `package.json` — sorted and formatted with Biome.
- TypeScript/JavaScript — checked and safe-autofixed with Biome.
- Markdown — linted (and autofixed) with `markdownlint-cli2`.
- Shell scripts — have their executable bit stripped (`chmod -x`); every
  shell script in the repo is invoked as `bash <script>`, so nothing needs
  the bit at runtime, and this is a deliberate normalization rather than
  mode drift.
- YAML — formatted with Prettier, validated with `yaml-lint`.
- TypeScript changes additionally trigger `tsc --noEmit`, blocking with no
  autofix.

Hooks skip entirely in CI (`GITHUB_ACTIONS=1`) and during a rebase or
squash, except on the final commit.

## Related concepts

[Dev branch flow](../conventions/dev-branch-flow.md) — the `dev` → `main` →
release cycle `branch-sync.yml` maintains.
[Integration testing](../runbooks/integration-testing.md) — the
`savvy-web/silk-integration` procedure for exercising a feature branch
end-to-end before it merges.
[Bump output schema version](../runbooks/bump-output-schema-version.md) —
the procedure `pnpm schema:build` gates when the output contract
changes at a published label.

[^branch-sync-workflow]: `../../.github/workflows/branch-sync.yml`
[^turbo-config]: `../../turbo.json`
[^package-json]: `../../package.json`
[^effected-toml]: `../../effected.toml`
