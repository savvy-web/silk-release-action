---
"@savvy-web/silk-release-action": patch
---

## Build System

* The action now builds with `effected action build` from `@effected/plugin`, configured by the `[action]` table in `effected.toml`; the deprecated `@savvy-web/github-action-builder` and its `action.config.ts` are gone
* The committed bundles are 11–16% smaller and keep the same `dist/` file names, so `action.yml` is unchanged
* The changelog modules are still bundled as `dist/changelog-silk.js` and `dist/changelog-default.js`, and Phase 1 still loads them with a native `import()`
