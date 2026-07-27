---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

Restores the npm cache redirect for GitHub-hosted macOS runners, lost when npm execution moved onto `@effected/npm` in the v4 rebuild. macOS runner images ship a partially root-owned `~/.npm/_cacache`, which made every `npm pack` / `npm publish` / `npm view` call hard-fail with `EACCES` (errno -13, exit 243, "Your cache folder contains root-owned files") before doing any work — including a live Phase 3 publish that failed all 11 targets.

- `ensureNpmCacheEnv()` runs as the first statement in `main.ts`, setting `npm_config_cache` to a runner-writable directory (`<RUNNER_TEMP ?? os.tmpdir()>/silk-npm-cache`) whenever it isn't already set, so every spawned npm process — `pnpm dlx npm@11` pack/publish/view and Phase 2 dry-runs — inherits the redirect through the environment
- An explicitly configured `npm_config_cache` is always respected and left untouched
