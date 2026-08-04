# src/CLAUDE.md

Source code architecture and coding patterns for silk-release-action.

**See also:** [Root CLAUDE.md](../CLAUDE.md) | [**test**/CLAUDE.md](../__test__/CLAUDE.md)

**For full architecture documentation:** `@../.claude/design/release-action/architecture.md` -- covers all entry points, phase detection, Phase-1 native versioning (zero-install), module dependency graph, shared infrastructure, the per-byte-group prod layout (`dist/prod/<group>/pkg`), group-keyed release assets, Attest service, Schema layer, and token plumbing.

**For integration/publishing details:** `@../.claude/design/release-action/integration.md` -- covers registry infrastructure, native versioning and the changelog module map, token-auth publishing fallback, group-keyed release assets, SBOM generation, and publish summaries.

## Architecture Overview

TypeScript action implementing a three-phase release workflow using changesets:

- **Entry points** -- `main.ts` (phase routing), `pre.ts` (App token provisioning via `GitHubToken.provision()`), `post.ts` (cleanup/revocation via `GitHubToken.dispose()`), `state.ts` (shared action state)
- **Release module** -- `release/` (phase orchestration): `publish.ts` (Phase-3 publish chain, token-auth fallback), `releases.ts` (GitHub releases, group-keyed asset names), `validation.ts` (Phase-2 validation, check-summary byte-capping; records an `error` finding to block unpublishable artifacts when target resolution fails), `report.ts` (comment/summary renderers), `publishability.ts` (silkDetect logic), `changeset-config.ts` (ChangesetConfig service), `meta-archive.ts` (`tarMetaFolder` — packs the bundler `meta/` folder into the group `meta.tgz` API-docs bundle), `attest-helpers.ts`, `resolve-targets.ts` (delegates to `SilkPublishability.resolveTargets`; fails with `PublishTargetBindingError` when detection misses the `dist/prod/targets.json` binding), `types.ts`, `layers.ts` (includes `NativeVersioningLive` — silk-effects v4 `ReleasePlanner`/`ConfigInspector` layers for Phase-1 versioning; workspace layers via `@effected/workspaces` `Workspaces.layer()`), `errors.ts`; co-located `*.test.ts` for each module
- **Changelog workers** -- `changelog/silk.ts` and `changelog/default.ts` are bundled to `dist/changelog-silk.js` / `dist/changelog-default.js` via `action.config.ts` `workers` entries; `build.nativeDynamicImports` keeps the runtime dynamic import in `@changesets/apply-release-plan` native
- **Schema** -- `schema/release-output.ts` (`ReleaseOutput` union; release notes no longer carried in structured output), `schema/projections.ts` (scalar output projections), `schema/silk-release-config.ts` (`SilkReleaseConfig` for sbom-config input); JSON Schema artifacts at repo root
- **Utility modules** -- `utils/*.ts` for individual operations, including `native-version.ts` (`runNativeVersion` — in-process Phase-1 versioning: changelog id map, scoped GITHUB_TOKEN, reset-then-retry), `format-workspace.ts` (`formatWorkspaceWithBiome` — conditional post-version Biome format), `group-id.ts` (`getGroupId`, `insertGroupToken` — derive the byte-group id from a `dist/prod/<group>/pkg` directory for group-keyed asset names), `create-validation-check.ts` (check-summary byte-capping), `normalize-package-manager.ts` (narrow the `packageManager` input so Phase-2 dry-runs and Phase-3 publish dispatch through the same npm executor), `registry-label.ts` (`registryShortLabel`/`registryHost` for the publish and validation log-tree rows), `pr-body.ts` (`buildManagedPrBody`/`upsertManagedRegion` — the marker-delimited release-PR description; see the managed-region rules below) and `sort-releases-topologically.ts` (`sortReleasesTopologically` — shared topological-sort-with-fallback used by `main.ts` Phase-3 orchestration, `publish.ts`, and `validation.ts` so tag strategy, build/SBOM, publish, and GitHub releases all run dependency-first)
- **Type definitions** -- `types/*.ts` for shared interfaces
- **Attest/Sbom services** -- moved to `@savvy-web/github-action-effects`; no longer in this repo

## Coding Standards

### Type Safety

- Explicit return types on all exported functions
- Never use `any` -- use proper types or `unknown` with type guards
- Prefer `interface` over `type` for object shapes (Biome `useConsistentTypeDefinitions` enforces this); use `type` for unions and aliases
- Narrow error types: `(error as { status?: number }).status === 404`

### Import Conventions

- Use `.js` extensions: `import { fn } from "./utils/module.js"`
- Use `node:` protocol: `import { readFile } from "node:fs/promises"`
- Order: Node.js builtins > External packages > Internal modules > Type imports (Biome enforced)

### GitHub API

Obtain the Octokit client via `GitHubToken.client()` (from `@savvy-web/github-action-effects`) in the Effect layer — do not call `core.getInput("token")` directly. Use `context.repo` for `owner`/`repo`. Use check runs for CI feedback, `core.summary` for rich output.

### Managed PR Body Region

`pr-body.ts` owns a marker-delimited slice of the release PR description containing two nested regions (AI summary, closing references). Rules when touching it:

- Never rebuild a nested region from scratch when a prior body exists — carry it through (`extractSummary`, `extractReferences`), or an agent's edit is silently deleted on the next commit to the release branch.
- Locate the reference region with `REFERENCES_START_PREFIX`, never the plain `REFERENCES_START`: emitted markers carry an `owned="…"` attribute, so a match on the bare constant misses every region this action wrote.
- `owned` lists the ids this run emitted so the next run can subtract them and carry through only agent-added references. Without it, preserving an id absent from `linkedIssues` re-links (and on merge auto-closes) an issue the release deliberately dropped.
- The reference region is emitted unconditionally, empty or not, so it stays an addressable target.
- Closing references have two non-interchangeable spellings: comma-joined inside the squash fence (commitlint), bare one-per-line outside it (GitHub's linker). Neither consumer accepts the other's form.

Load `@../.claude/design/release-action/architecture.md` ("Release PR body") before changing marker syntax or the merge rule.

### Exec Patterns

Use `@actions/exec` with listeners for stdout/stderr capture. See design doc for detailed patterns.

### Error Handling

- Graceful degradation: log warnings with `core.warning()`, return meaningful defaults
- Fail fast for critical errors: `core.setFailed()` + rethrow
- Type-narrow errors: `error instanceof Error ? error.message : String(error)`

### Input Handling

Read and validate action inputs early in structured `getInputs()` functions. Pass dependencies as parameters (not `core.getInput()` inside utility functions).

## Code Organization

- **Single responsibility** -- Each utility module has one focused purpose
- **Dependency injection** -- Pass dependencies as parameters for testability
- **Structured returns** -- Return objects with named fields, not primitives

## TSDoc

Use TSDoc comments for all exported functions with `@param`, `@returns`, and `@remarks` tags.
