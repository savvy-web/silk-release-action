---
"@savvy-web/silk-release-action": patch
---

## Refactoring

- Source the bundled vanilla changesets changelog generator from silk-effects'
  `Changesets.vanillaChangelogFunctions` re-export instead of depending on
  `@changesets/changelog-git` directly. The action now carries a single
  changesets vendor surface — the same one backing the silk generator — and
  `@changesets/changelog-git` is no longer a direct dependency.

## Dependencies

Adopts the Silk changesets wave. `@savvy-web/silk-effects` moves to a `^7.1.0`
floor because `Changesets.vanillaChangelogFunctions` does not exist in `7.0.1`;
the `@effected/*` bumps ride the `@effected/pnpm-plugin-effect` config-dependency
pin, which is the kit's single version surface.

| Dependency                    | Type       | Action  | From    | To      |
| ----------------------------- | ---------- | ------- | ------- | ------- |
| @changesets/changelog-git     | dependency | removed | 1.0.0   | —       |
| @effected/markdown            | dependency | updated | ^0.6.2  | ^0.6.3  |
| @effected/pnpm-plugin-effect  | config     | updated | 0.6.3   | 0.6.4   |
| @effected/workspaces          | dependency | updated | ^0.17.2 | ^0.18.0 |
| @savvy-web/silk               | dependency | updated | ^3.10.0 | ^3.10.1 |
| @savvy-web/silk-effects       | dependency | updated | ^7.0.1  | ^7.1.0  |
