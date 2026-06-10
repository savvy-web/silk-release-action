# src/CLAUDE.md

Source code architecture and coding patterns for silk-release-action.

**See also:** [Root CLAUDE.md](../CLAUDE.md) | [**test**/CLAUDE.md](../__test__/CLAUDE.md)

**For full architecture documentation:** `@../.claude/design/release-action/architecture.md` -- covers all entry points, phase detection, module dependency graph, shared infrastructure, the per-byte-group prod layout (`dist/prod/<group>/pkg`), group-keyed release assets, Attest service, Schema layer, and token plumbing.

**For integration/publishing details:** `@../.claude/design/release-action/integration.md` -- covers registry infrastructure, token-auth publishing fallback, group-keyed release assets, SBOM generation, and publish summaries.

## Architecture Overview

TypeScript action implementing a three-phase release workflow using changesets:

- **Entry points** -- `main.ts` (phase routing), `pre.ts` (App token provisioning via `GitHubToken.provision()`), `post.ts` (cleanup/revocation via `GitHubToken.dispose()`), `state.ts` (shared action state)
- **Release module** -- `release/` (phase orchestration): `publish.ts` (Phase-3 publish chain, token-auth fallback), `releases.ts` (GitHub releases, group-keyed asset names), `validation.ts` (Phase-2 validation, check-summary byte-capping), `report.ts` (comment/summary renderers), `publishability.ts` (silkDetect logic), `changeset-config.ts` (ChangesetConfig service), `meta-archive.ts` (`tarMetaFolder` — packs the bundler `meta/` folder into the group `meta.tgz` API-docs bundle), `attest-helpers.ts`, `resolve-targets.ts` (resolves per-package targets from each `dist/prod/targets.json` binding), `types.ts`, `layers.ts`, `errors.ts`; co-located `*.test.ts` for each module
- **Schema** -- `schema/release-output.ts` (`ReleaseOutput` union; release notes no longer carried in structured output), `schema/projections.ts` (scalar output projections), `schema/silk-release-config.ts` (`SilkReleaseConfig` for sbom-config input); JSON Schema artifacts at repo root
- **Utility modules** -- `utils/*.ts` for individual operations, including `group-id.ts` (`getGroupId`, `insertGroupToken` — derive the byte-group id from a `dist/prod/<group>/pkg` directory for group-keyed asset names) and `create-validation-check.ts` (check-summary byte-capping)
- **Type definitions** -- `types/*.ts` for shared interfaces
- **Attest/Sbom services** -- moved to `@savvy-web/github-action-effects@^2.1.3`; no longer in this repo

## Coding Standards

### Type Safety

- Explicit return types on all exported functions
- Never use `any` -- use proper types or `unknown` with type guards
- Prefer `type` over `interface` (Biome enforced)
- Narrow error types: `(error as { status?: number }).status === 404`

### Import Conventions

- Use `.js` extensions: `import { fn } from "./utils/module.js"`
- Use `node:` protocol: `import { readFile } from "node:fs/promises"`
- Order: Node.js builtins > External packages > Internal modules > Type imports (Biome enforced)

### GitHub API

Obtain the Octokit client via `GitHubToken.client()` (from `@savvy-web/github-action-effects`) in the Effect layer — do not call `core.getInput("token")` directly. Use `context.repo` for `owner`/`repo`. Use check runs for CI feedback, `core.summary` for rich output.

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
