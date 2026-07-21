---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

Adapt to `@effected/workspaces` 0.6.0 breaking changes: `findWorkspaceRootSync` is now path-first (`findWorkspaceRootSync(cwd, options)`), and `WorkspacePackage` requires a `workspaceRoot` field. Also bumps `@effected/jsonc` to 0.5.0 and pnpm to 11.15.1.
