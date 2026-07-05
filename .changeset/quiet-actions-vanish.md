---
"@savvy-web/silk-release-action": major
---

## Breaking Changes

### `version-command` input removed

Phase 1 (release-branch management) no longer shells out to a consumer `ci:version` script. The `version-command` input is gone from `action.yml`, `.github/actions/release/action.yml`, `.github/actions/local/action.yml`, and the docs.

**Migration:** delete any `version-command:` line from your workflow. Versioning is now applied natively — see below. If you relied on a custom version command for anything other than running `changeset version`, that behavior is no longer supported.

```diff
 - uses: savvy-web/silk-release-action@v3
   with:
     app-client-id: ${{ vars.APP_CLIENT_ID }}
     app-private-key: ${{ secrets.APP_PRIVATE_KEY }}
-    version-command: "pnpm changeset version"
```

## Features

### Native changeset versioning — no `node_modules` required

Phase 1 now applies pending changesets in-process using the bundled `@savvy-web/silk-effects` v3 `ReleasePlanner` — the same engine `savvy changeset version` runs — instead of invoking a package-manager script in the consumer's checkout. This means Phase 1 branch-management jobs no longer need a full dependency install to run.

The consumer's configured `.changeset/config.json` `changelog` id is mapped onto an action-shipped ESM module, so no consumer `node_modules` is read for changelog generation either:

| Configured changelog id | Bundled module |
| --- | --- |
| `@savvy-web/changelog`, `@savvy-web/silk/changesets/changelog`, `@savvy-web/changesets/changelog` | `dist/changelog-silk.js` |
| `@changesets/cli/changelog` | `dist/changelog-default.js` |

An unrecognized changelog id fails with a typed error naming the supported ids.

Transient network failures during the changelog's GitHub-info fetch retry once, after resetting the working tree; the `GITHUB_TOKEN` used for that fetch always comes from the App token, taking precedence over any ambient `GITHUB_TOKEN` already set in the job, and the ambient value is restored once the fetch completes.

### Conditional post-version formatting

When the repo has a `biome.json(c)` at its root, Phase 1 now runs `biome format --write .` after applying versions — replacing the `&& biome format` tail of the removed `ci:version` script. Phase 1 logs a warning and continues, rather than failing the phase, when the standalone `biome` binary isn't on `PATH`, or when the config extends a shareable preset (e.g. `@savvy-web/silk/biome`) that can't be resolved without an installed `node_modules`. Any other non-zero format exit still fails the phase.

## Dependencies

| Dependency | Type | Action | From | To |
| :--- | :--- | :--- | :--- | :--- |
| @savvy-web/silk-effects | dependency | updated | ^2.1.0 | ^3.0.0 |
| @savvy-web/github-action-builder | devDependency | updated | ^1.0.3 | ^1.1.0 |
| @changesets/changelog-git | devDependency | added | — | ^1.0.0-next.6 |
