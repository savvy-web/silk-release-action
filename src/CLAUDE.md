# src/CLAUDE.md

Source code architecture and coding patterns for workflow-release-action.

**See also:** [Root CLAUDE.md](../CLAUDE.md) | [**tests**/CLAUDE.md](../__tests__/CLAUDE.md)

**For full architecture documentation:** `@../.claude/design/release-action/architecture.md` -- covers all entry points, phase detection, module dependency graph, and shared infrastructure (46 source files documented, including `silk-publishability.ts` for silk publishability rules and `workspaces-effect` integration).

**For integration/publishing details:** `@../.claude/design/release-action/integration.md` -- covers registry infrastructure, SBOM generation, and publish summaries.

## Architecture Overview

TypeScript action implementing a three-phase release workflow using changesets:

- **Entry points** -- `main.ts` (phase routing, 1,043L), `pre.ts` (token setup, 79L), `post.ts` (cleanup, 50L)
- **Utility modules** -- `utils/*.ts` for individual operations
- **Type definitions** -- `types/*.ts` for shared interfaces

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

Get Octokit from `@actions/github`:

```typescript
const token = core.getInput("token", { required: true });
const github = getOctokit(token);
const { owner, repo } = context.repo;
```

Use check runs for CI feedback, `core.summary` for rich output.

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
