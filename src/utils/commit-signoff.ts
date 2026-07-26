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

import { BotIdentity } from "@effected/github";
import type { ActionState } from "@effected/github-actions";
import { GitHubToken } from "@effected/github-actions";
import { Effect } from "effect";

/**
 * Resolve the DCO `Signed-off-by` trailer line for an action-created commit.
 *
 * @remarks
 * The hand-rolled `FALLBACK_IDENTITY` constant that lived here is gone: the kit
 * ships the same well-known identity as `BotIdentity.githubActions`, with
 * byte-identical `name` and `email`.
 *
 * Note the two fallbacks are at different depths and both are load-bearing.
 * `InstallationToken.botIdentity()` *already* returns `BotIdentity.githubActions`
 * when the persisted token carries no `appSlug`; the `Effect.catch` here covers
 * the outer case where the state read itself fails, i.e. no token was persisted
 * at all.
 *
 * @returns A `Signed-off-by: Name <email>` line built from the GitHub App bot
 *   identity, or the `github-actions[bot]` fallback when the persisted token
 *   cannot be read.
 */
export const resolveSignoff = (): Effect.Effect<string, never, ActionState> =>
	GitHubToken.botIdentity().pipe(
		Effect.catch(() => Effect.succeed(BotIdentity.githubActions)),
		Effect.map((identity) => `Signed-off-by: ${identity.name} <${identity.email}>`),
	);
