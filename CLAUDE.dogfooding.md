# CLAUDE.dogfooding.md

Dogfooding first-party dependencies and the installed dependency line.

**See also:** [Root CLAUDE.md](./CLAUDE.md)

Load when linking a local library build, diagnosing a duplicate-copy bundle, or checking which dependency version a behaviour comes from.

## Why linking works here

We author nearly every runtime dependency, so a bug or missing API can be fixed **in its own repo** and dogfooded here before publishing. The action is a **bundled** artifact — `pnpm build` inlines every dependency into `dist/{main,pre,post}.js` — so once a local library build is linked and this repo is rebuilt, the change is baked into the committed `dist`. The integration repo runs that committed `dist`, **not** `node_modules`.

| Scope | Repo | Local checkout |
| ----- | ---- | -------------- |
| `@effected/*` (`github-actions`, `github`, `git`, `npm`, `commands`, `workspaces`, `sbom`, `markdown`, `package-json`, `jsonc`, `semver`, `yaml`, `schemastore`) | `spencerbeggs/effected` (monorepo) | `../../spencerbeggs/effected/packages/<name>` |
| `@savvy-web/silk-effects`, `@savvy-web/github-action-builder` (dev), `@savvy-web/silk` (dev) | `savvy-web/systems` (monorepo) | `../systems/packages/<name>` |

`@savvy-web/github-action-effects` is **dead** — its surface was replaced wholesale by the `@effected/*` kit in [#191](https://github.com/savvy-web/silk-release-action/pull/191). Do not reach for it.

## Two ways to link a local build

- **Direct-only dependency → `pnpm link`,** e.g. `pnpm link ../systems/packages/silk-effects`. Verify the linked `package.json` via `node:fs` (NOT `require(...package.json)` — the `exports` map does not expose `./package.json`), or `pnpm why <pkg>`.
- **Also a transitive dependency → `pnpm-workspace.yaml` `overrides`.** A bare `pnpm link` redirects only the direct import, leaving the transitive copy on the registry version and bundling **two** copies. Use `"<pkg>": "link:../../spencerbeggs/effected/packages/<name>/dist/dev/pkg"`, then `pnpm install`. `dist/dev/pkg` is the builder link target (`pnpm link` ignores `publishConfig.directory`, so target it explicitly). Verify every resolution points at the link: `find node_modules -name '<pkg-with-plus-signs>*'`. Most `@effected` packages are also pulled in transitively by another, so the override is usually the right mechanism.
- **Overriding a SIBLING REPO's build → the override must also be `injected`.** A plain `link:`/`file:` to a path inside another checkout leaves that package resolving `effect` (and its `@effected` siblings) from **that repo's** `node_modules`, putting a **second `effect` instance** in the process. The visible half is type identity (`LocalExec` "two different types with this name exist"); the invisible half is runtime — Schema codecs and class adapters fail across the seam (`Constructor adapter can only throw schema issues`, `value.replace is not a function` out of `tableFor`). In round 2 that was **93 of 871 tests failing where the unlinked tree passes**, and it survived a typecheck made green by linking each clashing sibling in turn. Add `dependenciesMeta.<pkg>.injected: true` in `package.json` so pnpm materializes a real copy whose deps resolve from OUR tree — one `effect`, one of everything. After changing an injected override run `pnpm clean --lockfile && pnpm install`; a plain install replays the stale resolution, and the first install can leave a dangling symlink that a second one materializes.
- **`dist/prod/npm/pkg` and `dist/dev/pkg` are not interchangeable.** `dev` maps to the sibling's live TypeScript source, so it carries unbuilt work and drags that repo's `node_modules` in; `prod` is the built artifact. Link `prod`.

## Procedure

1. Build the library: `pnpm ci:build` in its repo (produces the `dist/dev` link target plus `dist/npm` / `dist/github`).
2. Link or override, then `pnpm install`.
3. Keep the declared range in this repo's `package.json` correct for the eventual unlinked install — the link overrides resolution only while in place.
4. Iterate: edit library source → `pnpm ci:build` there → `pnpm typecheck` + `pnpm test` here → `pnpm build` here.
5. Run the integration repo: `savvy-web/silk-integration` pins `@dev`. Spencer triggers the runs; follow with `gh run list --repo savvy-web/silk-integration` / `gh run watch`.
6. **Only after the dogfooded version publishes:** remove the link/override, pin the published range, `pnpm install`.

Library edits ship separately on their own repo's branch and release with its next published version — call them out.

**Committing while a link/override is active:** commit the **full dogfood state** to `dev` — `src` + rebuilt `dist` + changeset + the override + `pnpm-lock.yaml`. The override holds a machine-specific path, so `dev` installs cleanly only with the sibling repos checked out at the paths above; that is the accepted trade-off and step 6 reverts it. No CI runs on a plain `dev` push, so committed `dev` source may reference an unpublished library API — expected during dogfooding. Commits must be GPG-signed with the GitHub-verified key for `C. Spencer Beggs <spencer@savvyweb.systems>` or the signature ruleset rejects them.

## Currently active

**No dogfood link or override is active.** Round 2 (effected #196/#365/#198) exited on 2026-08-24 when the wave published.

Every `@effected/*` and `@savvy-web/*` runtime dependency is declared as `catalog:effected` / `catalog:silk` in `package.json` — **the ranges are not written here and must not be hand-edited.** The catalogs are generated by the `@effected/pnpm-plugin-effect` and `@savvy-web/pnpm-plugin-silk` config dependencies pinned in `pnpm-workspace.yaml`, so bumping the whole line is bumping the plugin: `pnpm add --config @effected/pnpm-plugin-effect@<version>`, then `pnpm clean --lockfile && pnpm install`. As of 2026-08-24 (plugin `0.6.5`) that resolves `@effected/npm ^0.12.0`, `@effected/github-actions ^0.10.0`, `@effected/github ^0.8.0`, `@effected/git ^0.10.0`, `@effected/package-json ^0.11.0`, `@effected/workspaces ^0.18.0`, `@effected/commands ^0.5.0`, `@effected/sbom ^0.4.1`, `@effected/markdown ^0.6.3`, `@effected/semver ^0.5.0`, `@effected/yaml ^0.11.0`, `@effected/jsonc ^0.7.0`, `@effected/schemastore ^0.4.0`; `effect`, `@effect/platform-node` and `@effect/vitest` come from `catalog:effect` at **4.0.0-rc.109**.

**`pnpm add --config` strips the integrity pin from EVERY `configDependencies` entry, not just the one named.** Both lines come back as bare `<version>`; restore the `<version>+sha512-…` form by hand (`npm view <pkg>@<version> dist.integrity`) before committing — config dependencies are fetched before lockfile verification, so the inline hash is the only thing pinning them.

## What the dependency line buys

- **v4 Schema** (`Schema.Literals([…])`, `Schema.Union([…])`, `.annotate`) drives `src/schema/*`; schema generation uses core `effect/JsonSchema` (`Schema.toJsonSchemaDocument` → `JsonSchema.toDocumentDraft07`). Both `json-schema-effect` and `ajv` are gone — `@effected/schemastore` covers validation. As of the rc line there is no standalone `effect/SchemaError` module — `SchemaError` is exported from `effect/Schema`.
- **`NodeServices.layer`** (`@effect/platform-node`) replaces the old `NodeContext`/`NodeFileSystem`/`NodePath` stack; `@effect/platform` dissolved into core `effect` in v4.
- **`@effected/git`** answers every git operation — **all 17 raw `ChildProcess.make("git", …)` spawns are gone.** Do not add one back.
- **`@effected/workspaces`** provides `Workspaces.layerWithGit()`, `WorkspaceDiscovery`, `PublishabilityDetector`, `PackageManagerDetector` and `DependencyGraph` (`.sortSubset(...)`) for topological release ordering.
- **`@effected/commands`** provides `LocalExec` / `ToolDiscovery` — the subprocess and tool-probe seams. Use them instead of a raw spawn.
- **`@effected/github` 0.6** adds `GitHubIssue.commentOnce` + `CommentMarker` (marker-keyed create-or-skip comments — `close-linked-issues` uses marker `savvy-web:closed-by-release-<pr>`) and the pure `harvestIssueReferences` (the closing-keyword grammar; `link-issues-from-commits` no longer owns a local pattern).
- **silk-effects 5** exports `Changesets.ReleasePlanner`/`ConfigInspector` (Phase-1 native versioning, `changelogModules` seam), `ChangesetConfigReader`, and `SilkPublishability` with `PublishTargetBindingError` — Phase-2 validation catches it to fail the check when a resolved publish directory is not bound by `dist/prod/targets.json`.
- **github-action-builder 2** `build.nativeDynamicImports` keeps the `@changesets/apply-release-plan` runtime dynamic import native in the bundle; `workers` entries bundle `src/changelog/{silk,default}.ts` to `dist/changelog-*.js`.
