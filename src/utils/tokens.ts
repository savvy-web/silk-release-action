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
 * The token for GitHub Packages and attestation operations. Prefers the
 * workflow `github-token` input (it carries `packages:write` and
 * `attestations:write` from the workflow's permissions block) and falls back
 * to the App installation token when the input was not provided.
 *
 * @returns The packages/attestation token, or an empty string if unavailable.
 */
export const packagesToken = (): string => process.env.STATE_githubToken || process.env.STATE_token || "";
