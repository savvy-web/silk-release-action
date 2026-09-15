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
 * `GitHubToken.provision` (from `@effected/github-actions`) persists
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
 * The structured `result` output as emitted — the encoded JSON document,
 * pretty-printed — saved by `emitReleaseOutput` so `post.ts` can print it and
 * append it to the job summary once every step of the run has finished.
 *
 * @remarks
 * Stored as text rather than re-decoded through `ReleaseOutput`: `post` only
 * displays it, and the document is exactly what the runner holds in
 * `steps.<id>.outputs.result`, so a second decode could only disagree.
 */
export class ReleaseResultState extends Schema.Class<ReleaseResultState>("ReleaseResultState")({
	json: Schema.String,
}) {}

/**
 * String constants for the keys used with `ActionState.save/get`. Centralised
 * here so a typo in one phase doesn't silently miss state from another.
 */
export const STATE_KEYS = {
	startTime: "startTime",
	githubPackagesToken: "githubPackagesToken",
	releaseResult: "releaseResult",
} as const;
