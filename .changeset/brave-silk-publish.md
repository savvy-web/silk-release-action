---
"@savvy-web/workflow-release-action": patch
---

## Bug Fixes

Private packages that declare `publishConfig.targets` were misclassified as version-only (GitHub-release-only) and skipped during publish. They are now treated as publishable to each named target. The fix is codified in a new `src/utils/silk-publishability.ts` helper that implements the canonical silk publishability rules (private+targets → publish to targets; private+access → publish with that access level; public default → publish to npm).

## Refactoring

Replaced `workspace-tools` with `workspaces-effect`. Call sites use the sync APIs `findWorkspaceRootSync` and `getWorkspacePackagesSync` as drop-in replacements. Seven modules migrated: `detect-publishable-changes.ts`, `release-summary-helpers.ts`, `find-package-path.ts`, `topological-sort.ts`, `detect-repo-type.ts`, `create-github-releases.ts`, and `generate-release-notes-preview.ts`. Six existing test files updated to mock `workspaces-effect`; new `__test__/silk-publishability.test.ts` adds 12 cases covering the publishability rules.

## Dependencies

| Dependency | Type | Action | From | To |
| :--------- | :--- | :------ | :--- | :- |
| workspace-tools | dependency | removed | ^0.41.0 | — |
| workspaces-effect | dependency | added | — | ^1.0.0 |
| @effect/platform | dependency | added | — | ^0.96.0 |
| @effect/platform-node | dependency | added | — | ^0.96.0 |
