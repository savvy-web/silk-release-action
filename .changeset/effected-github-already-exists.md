---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

* A re-run of the publishing phase now recovers an existing GitHub release only when GitHub reports it as a duplicate. Other release-creation failures are reported as-is instead of triggering a lookup by tag.

## Dependencies

| Dependency | Type | Action | From | To |
| :--- | :--- | :--- | :--- | :--- |
| @effected/github | dependency | updated | 0.12.0 | 0.13.0 |
| @effected/github-actions | dependency | updated | 0.16.0 | 0.16.1 |
| @effected/markdown | dependency | updated | 0.12.0 | 0.12.1 |
| @effected/schemastore | dependency | updated | 0.15.0 | 0.15.1 |
| @effected/workspaces | dependency | updated | 0.25.0 | 0.26.0 |
| @effected/schemastore-cli | devDependency | updated | 0.15.0 | 0.15.1 |
| @effected/pnpm-plugin-effect | config | updated | 0.10.0 | 0.11.1 |
