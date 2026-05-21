/**
 * Pre-action entry point.
 *
 * @remarks
 * Runs before the main action. Responsibilities:
 *
 * 1. Record the start time for `post.ts` duration reporting.
 * 2. Provision a GitHub App installation token via `GitHubToken.provision`,
 *    which reads `app-client-id` / `app-private-key`, generates the token,
 *    resolves the App identity (slug, bot user ID, name), and persists the
 *    whole envelope to `ActionState` for `main.ts` and `post.ts`.
 * 3. Persist the optional `github-token` input for GitHub Packages auth.
 *
 * State is grouped into Schema.Class bundles defined in `./state.ts`.
 */

import { NodeFileSystem } from "@effect/platform-node";
import {
	Action,
	ActionOutputs,
	ActionState,
	GitHubAppLive,
	GitHubToken,
	OctokitAuthAppLive,
} from "@savvy-web/github-action-effects";
import { Config, Effect, Layer } from "effect";
import { GithubPackagesTokenState, STATE_KEYS, StartTimeState } from "./state.js";

/**
 * Pre-action Effect program.
 */
export const pre = Effect.gen(function* () {
	const outputs = yield* ActionOutputs;
	const state = yield* ActionState;

	yield* Effect.logDebug("Running pre-action script");

	// 1. Initial state: start time.
	yield* state.save(STATE_KEYS.startTime, new StartTimeState({ startedAt: Date.now() }), StartTimeState);

	// 2. Optional GitHub Packages token (workflow `secrets.GITHUB_TOKEN`,
	//    passed as the `github-token` input). registry-auth prefers it over
	//    the App token for GitHub Packages because it carries org-level
	//    `packages:write` from the workflow's own permissions.
	const githubToken = yield* Config.string("github-token").pipe(Config.withDefault(""));

	// 3. Provision the GitHub App installation token. `provision` reads the
	//    `app-client-id` + `app-private-key` inputs, generates the token,
	//    resolves the App identity best-effort, and persists the envelope to
	//    `ActionState` under its own internal key.
	yield* Effect.logInfo("Generating GitHub App installation token...");
	const token = yield* GitHubToken.provision();

	// 4. Persist the optional GitHub Packages token for `main.ts`.
	if (githubToken !== "") {
		yield* state.save(
			STATE_KEYS.githubPackagesToken,
			new GithubPackagesTokenState({ token: githubToken }),
			GithubPackagesTokenState,
		);
		yield* outputs.setSecret(githubToken);
		yield* Effect.logInfo("GitHub token provided for GitHub Packages authentication");
	}

	// 5. Action outputs (exposed for subsequent workflow steps).
	yield* outputs.set("token", token.token);
	yield* outputs.set("installation-id", String(token.installationId));
	if (token.appSlug !== undefined) {
		yield* outputs.set("app-slug", token.appSlug);
	}

	yield* Effect.logInfo(
		`Token generated${token.appName !== undefined ? ` for app "${token.appName}"` : ""} (expires: ${token.expiresAt})`,
	);
	yield* Effect.logDebug("Pre-action completed");
});

// ---------------------------------------------------------------------------
// Layer composition and execution
// ---------------------------------------------------------------------------

/**
 * Domain layers for pre-action. `Action.run` provides core services
 * (`ActionLogger`, `ActionOutputs`, `ActionEnvironment`, `ActionState`,
 * `ActionsConfigProvider`).
 *
 * `GitHubToken.provision` needs a `GitHubApp` layer — composed here from
 * `GitHubAppLive` over `OctokitAuthAppLive`. `NodeFileSystem.layer` backs
 * `ActionStateLive`.
 */
export const PreLive = Layer.mergeAll(GitHubAppLive.pipe(Layer.provide(OctokitAuthAppLive)), NodeFileSystem.layer);

/* v8 ignore next 3 -- entry-point guard, only runs in GitHub Actions */
if (process.env.GITHUB_ACTIONS) {
	await Action.run(pre, { layer: PreLive });
}
