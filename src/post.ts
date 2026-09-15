// Post-action entry point.
//
// Runs after the main action, **even when it failed**. Three jobs: surface the
// structured `result` the main phase emitted (in the log and in the job
// summary), report total duration, and revoke the GitHub App installation
// token `pre.ts` provisioned.
//
// A post-action failure must never fail the workflow — the run is often already
// failing for a reason the operator needs to see, and a second failure on the
// way out only obscures it. Hence the belt-and-braces `Effect.catch` on
// revocation plus `Effect.catchDefect` around the whole program.

import { GitHubApp } from "@effected/github";
import { Action, ActionOutputs, ActionState, GitHubToken } from "@effected/github-actions";
import type { Layer } from "effect";
import { Effect, Option } from "effect";
import { ReleaseResultState, STATE_KEYS, StartTimeState } from "./state.js";

/**
 * The job-summary block the structured `result` is appended as.
 *
 * @param json - The pretty-printed `result` document.
 * @returns A markdown fragment: a heading and a fenced JSON block.
 *
 * @public
 */
export const renderResultSummary = (json: string): string => `### JSON output\n\n\`\`\`json\n${json}\n\`\`\`\n`;

/**
 * Post-action program.
 *
 * @public
 */
export const post = Effect.gen(function* () {
	const state = yield* ActionState;

	yield* Effect.logDebug("Running post-action script");

	// The structured `result`, exactly as the main phase emitted it. Absent when
	// main failed before emitting one (or never ran) — nothing to show then.
	// Printed here rather than at emit time so it lands after every step's own
	// output, and appended to the job summary so it is readable without
	// opening the log at all. Neither may fail the run.
	const result = yield* state.getOptional(STATE_KEYS.releaseResult, ReleaseResultState);
	if (Option.isSome(result)) {
		const outputs = yield* ActionOutputs;
		yield* Effect.logInfo(`Structured result output:\n${result.value.json}`);
		yield* outputs
			.summary(renderResultSummary(result.value.json))
			.pipe(
				Effect.catch((e) =>
					Effect.logWarning(
						`Failed to append the result to the job summary: ${e instanceof Error ? e.message : String(e)}`,
					),
				),
			);
	}

	// Total duration. Absent start time is not an error: `pre` may have failed
	// before recording it.
	const startState = yield* state.getOptional(STATE_KEYS.startTime, StartTimeState);
	if (Option.isSome(startState)) {
		const duration = Date.now() - startState.value.startedAt;
		yield* Effect.logInfo(`Release action completed in ${(duration / 1000).toFixed(2)}s`);
	}

	// Revocation is unconditional. There was a `skip-token-revoke` input; it
	// bought nothing — the token expires in an hour either way — while leaving a
	// live credential in the runner's environment for whatever came after. An
	// opt-out of cleaning up a secret is not a feature.
	//
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
