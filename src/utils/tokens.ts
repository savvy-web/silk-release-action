/**
 * Token resolution for the imperative publish-chain code.
 *
 * @remarks
 * `pre.ts` provisions the GitHub App installation token and `main.ts` bridges
 * both it and the optional workflow `github-token` into `STATE_*` env vars.
 * These helpers read them back directly from `process.env` so no consumer has
 * to touch `process.env.GITHUB_TOKEN` — which the action deliberately never sets.
 */

import { Redacted } from "effect";

/**
 * The GitHub App installation token — the action's primary GitHub identity,
 * used for repository and issue operations.
 *
 * @remarks
 * Returned as a `Redacted<string>` so the secret stays wrapped at the boundary;
 * the library's `GitHubClientLive.fromToken` takes `Redacted<string>` directly.
 * Unwrap with `Redacted.value` only at the point a plain string is required.
 *
 * @returns The App installation token (empty `Redacted` when unavailable).
 */
export const appToken = (): Redacted.Redacted<string> => Redacted.make(process.env.STATE_token ?? "");

/**
 * The token for GitHub Packages and attestation operations.
 *
 * @remarks
 * The App installation token, same as {@link appToken} — returned as a plain
 * string because the imperative publish chain needs one.
 *
 * A `github-token` input used to take precedence, carrying the workflow's own
 * `secrets.GITHUB_TOKEN` for an App lacking org-level `packages:write`. The App
 * carries it, so the input shadowed a working credential and is gone.
 *
 * @returns The packages/attestation token, or an empty string if unavailable.
 */
export const packagesToken = (): string => process.env.STATE_token ?? "";
