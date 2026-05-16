/**
 * Token resolution for the imperative publish-chain code.
 *
 * @remarks
 * `pre.ts` provisions the GitHub App installation token and `main.ts` bridges
 * both it and the optional workflow `github-token` into `STATE_*` env vars.
 * These helpers read them back through the `_actions-compat` `getState` shim
 * so no consumer has to touch `process.env.GITHUB_TOKEN` — which the action
 * deliberately never sets.
 */

import { getState } from "./_actions-compat.js";

/**
 * The GitHub App installation token — the action's primary GitHub identity,
 * used for repository and issue operations.
 *
 * @returns The App installation token, or an empty string if unavailable.
 */
export const appToken = (): string => getState("token");

/**
 * The token for GitHub Packages and attestation operations. Prefers the
 * workflow `github-token` input (it carries `packages:write` and
 * `attestations:write` from the workflow's permissions block) and falls back
 * to the App installation token when the input was not provided.
 *
 * @returns The packages/attestation token, or an empty string if unavailable.
 */
export const packagesToken = (): string => getState("githubToken") || getState("token");
