// Post-action entry point.
//
// Runs after the main action, **even when it failed**. Two jobs: report total
// duration, and revoke the GitHub App installation token `pre.ts` provisioned.
//
// A post-action failure must never fail the workflow — the run is often already
// failing for a reason the operator needs to see, and a second failure on the
// way out only obscures it. Hence the belt-and-braces `Effect.catch` on
// revocation plus `Effect.catchDefect` around the whole program.

import { GitHubApp } from "@effected/github";
import { Action, ActionInput, ActionState, GitHubToken } from "@effected/github-actions";
import type { Layer } from "effect";
import { Config, Effect, Option } from "effect";
import { STATE_KEYS, StartTimeState } from "./state.js";

/**
 * Post-action program.
 *
 * @public
 */
export const post = Effect.gen(function* () {
	const state = yield* ActionState;

	yield* Effect.logDebug("Running post-action script");

	// Total duration. Absent start time is not an error: `pre` may have failed
	// before recording it.
	const startState = yield* state.getOptional(STATE_KEYS.startTime, StartTimeState);
	if (Option.isSome(startState)) {
		const duration = Date.now() - startState.value.startedAt;
		yield* Effect.logInfo(`Release action completed in ${(duration / 1000).toFixed(2)}s`);
	}

	// `skip-token-revoke` is available in every phase. Read through
	// `ActionInput`, never a bare `Config` — see the note in `pre.ts`.
	const skipTokenRevoke = yield* ActionInput.boolean("skip-token-revoke").pipe(Config.withDefault(false));
	if (skipTokenRevoke) {
		yield* Effect.logInfo("Token revocation skipped (skip-token-revoke is true)");
		return;
	}

	// `dispose` is a no-op when `pre` never provisioned a token, and skips an
	// already-expired one: GitHub has stopped accepting it, so the request could
	// only turn a successful run into a failed one.
	yield* Effect.logInfo("Revoking GitHub App installation token...");
	yield* GitHubToken.dispose().pipe(
		Effect.catch((e) => Effect.logWarning(`Token revocation failed: ${e instanceof Error ? e.message : String(e)}`)),
	);
}).pipe(
	Effect.catchDefect((defect) =>
		Effect.logWarning(`Post-action warning: ${defect instanceof Error ? defect.message : String(defect)}`),
	),
);

/**
 * Domain layers for the post-action.
 *
 * @remarks
 * `GitHubToken.dispose` needs a `GitHubApp`, which is self-contained.
 * `ActionState` arrives from `ActionRuntime` via `Action.run`.
 *
 * @public
 */
export const PostLive: Layer.Layer<GitHubApp> = GitHubApp.layer;

/* v8 ignore next 3 -- entry-point guard, only runs in GitHub Actions */
if (process.env.GITHUB_ACTIONS) {
	await Action.run(post, { layer: PostLive });
}
