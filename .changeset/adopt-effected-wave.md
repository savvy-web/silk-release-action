---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

### Octokit deprecation warnings no longer clutter the Phase-3 log

Every issue closed during publishing emitted a deprecation warning into the workflow log, interleaved with the `✓ Closed issue #N` lines — a release closing four issues carried four of them (#190).

The cause was never the route. Octokit sends no `X-GitHub-Api-Version` header, so every request rode GitHub's deprecated `2022-11-28` calendar default. `@effected/github` 0.4.2 pins `2026-03-10` on `GitHubIssue`'s four REST calls, so the warnings stop.

Adoption only — no code changed on our side for this.

## Maintenance

### `Secret.forProcessEnv` replaces `forSigning` at the one process-env bridge

`@effected/github-actions` 0.7.0 adds a member named for exactly what the `withGithubTokenEnv` bridge in `native-version.ts` does: declassify a token bound for the **ambient** environment, as distinct from a child's environment (`forChildEnv`), a runner file (`forRunnerFile`), or a value that stays in-process (`forSigning`). Masking behaviour and signature are identical, so this is a rename at the call site plus honest audit vocabulary (#208).

The kit still declines to mutate `process.env` itself, so the assignment and the restore arm remain ours — which is the documented division for this member, and what `Effect.acquireUseRelease` here already implements.

`Secret.forSigning` correctly survives at the custom-registry site in `publish.ts`: that token is written to the npmrc in-process and never enters an environment.

### Dependencies

* `@effected/github` `^0.4.1` → `^0.4.2`
* `@effected/github-actions` `^0.6.1` → `^0.7.0`
