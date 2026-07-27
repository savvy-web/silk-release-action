// Pre-action entry point.
//
// Runs before the main action, in its own Node process. Three jobs:
//
// 1. Record the start time, for `post.ts` duration reporting.
// 2. Provision a GitHub App installation token. The kit's
//    `GitHubToken.provision` takes its credentials explicitly rather than
//    reading the inputs itself, so `app-client-id` / `app-private-key` are read
//    here. It mints the token, verifies the granted scopes, resolves the App
//    identity best-effort, masks the token, and persists the whole envelope to
//    `ActionState` for `main.ts` and `post.ts`.
// 3. Persist the optional `github-token` input for GitHub Packages auth.
//
// State bundles are `Schema.Class`es in `./state.ts`.

import { GitHubApp } from "@effected/github";
import {
	Action,
	ActionEnvironment,
	ActionInput,
	ActionOutputs,
	ActionState,
	GitHubToken,
	Secret,
} from "@effected/github-actions";
import type { Layer } from "effect";
import { Effect } from "effect";
import { STATE_KEYS, StartTimeState } from "./state.js";

/**
 * Pre-action program.
 *
 * @public
 */
export const pre = Effect.gen(function* () {
	const outputs = yield* ActionOutputs;
	const state = yield* ActionState;
	const env = yield* ActionEnvironment;

	yield* Effect.logDebug("Running pre-action script");

	// 1. Start time, for post-phase duration reporting.
	yield* state.save(STATE_KEYS.startTime, StartTimeState.make({ startedAt: Date.now() }), StartTimeState);

	// 2. Provision the installation token.
	//
	//    There was a `github-token` input here, carrying the workflow's own
	//    `secrets.GITHUB_TOKEN` so registry auth could prefer it for GitHub
	//    Packages. It existed for one case: a GitHub App without org-level
	//    `packages:write`. The App this action authenticates as carries it, so
	//    the input only ever shadowed a token that already worked, and every
	//    consumer had to remember to thread a secret that changed nothing.
	const appId = yield* ActionInput.string("app-client-id");
	const privateKey = yield* ActionInput.redacted("app-private-key");
	// `owner` preserves the predecessor's auto-resolution of the installation
	// from the repository owner when no explicit installation id is given.
	const { repositoryOwner } = yield* env.github;

	yield* Effect.logInfo("Generating GitHub App installation token...");
	const token = yield* GitHubToken.provision({ appId, privateKey, owner: repositoryOwner });

	// 3. Action outputs, for subsequent workflow steps.
	//    `InstallationToken.token` is a `Redacted<string>`. `Secret.forRunnerFile`
	//    is the declassification seam for a runner file: it masks and unwraps in
	//    one call, so plaintext cannot reach `GITHUB_OUTPUT` — which is plaintext
	//    by protocol — without the runner's log filter already knowing it.
	yield* outputs.set("token", yield* Secret.forRunnerFile(token.token));
	yield* outputs.set("installation-id", String(token.installationId));
	if (token.appSlug !== undefined) {
		yield* outputs.set("app-slug", token.appSlug);
	}

	yield* Effect.logInfo(
		`Token generated${token.appName !== undefined ? ` for app "${token.appName}"` : ""} (expires: ${token.expiresAt})`,
	);
	yield* Effect.logDebug("Pre-action completed");
});

/**
 * Domain layers for the pre-action.
 *
 * @remarks
 * `GitHubToken.provision` needs a `GitHubApp`, which in the kit is a
 * self-contained layer — the App JWT signer is internal to it, so there is no
 * octokit auth strategy to compose and no `HttpClient` to wire.
 * `ActionEnvironment`, `ActionOutputs` and `ActionState` all arrive from
 * `ActionRuntime` via `Action.run`.
 *
 * @public
 */
export const PreLive: Layer.Layer<GitHubApp> = GitHubApp.layer;

/* v8 ignore next 3 -- entry-point guard, only runs in GitHub Actions */
if (process.env.GITHUB_ACTIONS) {
	await Action.run(pre, { layer: PreLive });
}
