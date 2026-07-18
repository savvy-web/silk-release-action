/**
 * Post-action entry point.
 *
 * @remarks
 * Runs after the main action (even on failure). Responsibilities:
 *
 * - Report total action duration.
 * - Revoke the GitHub App installation token provisioned by `pre.ts`
 *   via `GitHubToken.dispose()` (unless `skip-token-revoke` is set).
 *
 * Post-action failures should never fail the workflow.
 */

import { NodeServices } from "@effect/platform-node";
import { Action, ActionState, GitHubAppLive, GitHubToken, OctokitAuthAppLive } from "@savvy-web/github-action-effects";
import { Config, Effect, Layer, Option } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { STATE_KEYS, StartTimeState } from "./state.js";

/**
 * Post-action Effect program.
 */
export const post = Effect.gen(function* () {
	const state = yield* ActionState;

	yield* Effect.logDebug("Running post-action script");

	// Total duration reporting.
	const startState = yield* state.getOptional(STATE_KEYS.startTime, StartTimeState);
	if (Option.isSome(startState)) {
		const duration = Date.now() - startState.value.startedAt;
		yield* Effect.logInfo(`Release action completed in ${(duration / 1000).toFixed(2)}s`);
	}

	// Token revocation. `skip-token-revoke` is read directly from the input
	// (available in every phase); `dispose` is a no-op if `pre.ts` never
	// provisioned a token.
	const skipTokenRevoke = yield* Config.boolean("skip-token-revoke").pipe(Config.withDefault(false));
	if (skipTokenRevoke) {
		yield* Effect.logInfo("Token revocation skipped (skip-token-revoke is true)");
		return;
	}

	yield* Effect.logInfo("Revoking GitHub App installation token...");
	yield* GitHubToken.dispose().pipe(
		Effect.catch((e) => Effect.logWarning(`Token revocation failed: ${e instanceof Error ? e.message : String(e)}`)),
	);
}).pipe(
	// Defense-in-depth: post-action failures should never fail the workflow.
	Effect.catchDefect((defect) =>
		Effect.logWarning(`Post-action warning: ${defect instanceof Error ? defect.message : String(defect)}`),
	),
);

// ---------------------------------------------------------------------------
// Layer composition and execution
// ---------------------------------------------------------------------------

/**
 * Domain layers for post-action. `GitHubToken.dispose` needs a `GitHubApp`
 * layer; in 2.0 `GitHubAppLive` also requires `HttpClient.HttpClient`, provided
 * here via `FetchHttpClient.layer`. `NodeServices.layer` backs `ActionStateLive`.
 */
export const PostLive = Layer.mergeAll(
	GitHubAppLive.pipe(Layer.provide(OctokitAuthAppLive), Layer.provide(FetchHttpClient.layer)),
	NodeServices.layer,
);

/* v8 ignore next 3 -- entry-point guard, only runs in GitHub Actions */
if (process.env.GITHUB_ACTIONS) {
	await Action.run(post, { layer: PostLive });
}
