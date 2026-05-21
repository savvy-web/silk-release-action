/**
 * Cross-phase state schemas.
 *
 * @remarks
 * `pre.ts`, `main.ts`, and `post.ts` run as separate Node processes, with
 * GitHub Actions persisting state between them as `STATE_*` env vars
 * (sourced from the `GITHUB_STATE` file written by `core.saveState`).
 *
 * The library's `ActionState.save(key, value, Schema)` first applies
 * `Schema.encode`, then `JSON.stringify`s the result. The runner then
 * exposes each entry as `STATE_${KEY}` to subsequent phases; the library's
 * `ActionState.get(key, Schema)` `JSON.parse`s + `Schema.decode`s on the
 * way back out.
 *
 * Each schema below groups a logical bundle of fields written by one phase
 * and consumed by one or more later phases.
 */

import { Schema } from "effect";

/**
 * Wall-clock timestamp captured by `pre.ts` for total-duration reporting
 * in `post.ts`.
 */
export class StartTimeState extends Schema.Class<StartTimeState>("StartTimeState")({
	startedAt: Schema.Number,
}) {}

/**
 * The GitHub App installation token itself is no longer modelled here —
 * `GitHubToken.provision` (from `@savvy-web/github-action-effects`) persists
 * the `InstallationToken` envelope (token, expiry, installation id, and the
 * resolved App identity) to `ActionState` under its own internal key.
 * `main.ts` reads it back via `GitHubToken.read()` and `post.ts` revokes it
 * via `GitHubToken.dispose()`.
 */

/**
 * Optional secondary token used for publishing to GitHub Packages when the
 * GitHub App doesn't have `packages:write`. Written by `pre.ts` only when
 * the `github-token` input is provided.
 */
export class GithubPackagesTokenState extends Schema.Class<GithubPackagesTokenState>("GithubPackagesTokenState")({
	token: Schema.String,
}) {}

/**
 * Detected package manager (used by every command-running phase).
 * Written by `main.ts` Phase-0 boot.
 */
export class PackageManagerState extends Schema.Class<PackageManagerState>("PackageManagerState")({
	name: Schema.Literal("npm", "pnpm", "yarn", "bun"),
}) {}

/**
 * String constants for the keys used with `ActionState.save/get`. Centralised
 * here so a typo in one phase doesn't silently miss state from another.
 */
export const STATE_KEYS = {
	startTime: "startTime",
	githubPackagesToken: "githubPackagesToken",
	packageManager: "packageManager",
} as const;
