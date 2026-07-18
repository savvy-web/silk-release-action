/**
 * DCO sign-off trailer for action-created commits.
 *
 * @remarks
 * The release action creates verified commits through the Git Data API. Those
 * commits need a Developer Certificate of Origin `Signed-off-by` trailer to
 * pass DCO checks on the repositories it releases. The identity comes from
 * `GitHubToken.botIdentity()` so the trailer matches the GitHub App bot that
 * authors the commit; if the persisted token cannot be read it falls back to
 * the well-known `github-actions[bot]` identity.
 */

import type { ActionState } from "@savvy-web/github-action-effects";
import { GitHubToken } from "@savvy-web/github-action-effects";
import { Effect } from "effect";

/** Well-known `github-actions[bot]` identity, used when the App identity is unavailable. */
const FALLBACK_IDENTITY = {
	name: "github-actions[bot]",
	email: "41898282+github-actions[bot]@users.noreply.github.com",
} as const;

/**
 * Resolve the DCO `Signed-off-by` trailer line for an action-created commit.
 *
 * @returns A `Signed-off-by: Name <email>` line built from the GitHub App bot
 *   identity, or the `github-actions[bot]` fallback when the persisted token
 *   cannot be read.
 */
export const resolveSignoff = (): Effect.Effect<string, never, ActionState> =>
	GitHubToken.botIdentity().pipe(
		Effect.catch(() => Effect.succeed(FALLBACK_IDENTITY)),
		Effect.map((identity) => `Signed-off-by: ${identity.name} <${identity.email}>`),
	);
