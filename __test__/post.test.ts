/**
 * Fixture tests for the post-action Effect program.
 *
 * @remarks
 * Drives `post` against the in-memory `@savvy-web/github-action-effects` test
 * layers and asserts:
 *
 *   - The GitHub App installation token provisioned by `pre` is revoked via
 *     `GitHubToken.dispose` (unless `skip-token-revoke` is set).
 *   - Revocation is skipped when the `skip-token-revoke` input is `true`.
 *   - `post` completes cleanly when no token was ever provisioned.
 *
 * The provisioned-token scenarios run `GitHubToken.provision` first against a
 * shared `ActionState` to populate the token envelope `dispose` reads back.
 */

import { GitHubToken } from "@savvy-web/github-action-effects";
import type {
	ActionOutputs,
	ActionState,
	ActionStateTestState,
	GitHubApp,
	GitHubAppTestState,
} from "@savvy-web/github-action-effects/testing";
import { ActionOutputsTest, ActionStateTest, GitHubAppTest } from "@savvy-web/github-action-effects/testing";
import { ConfigProvider, Effect, Layer, Redacted } from "effect";
import { describe, expect, it } from "vitest";
import { post } from "../src/post.js";

interface Fixtures {
	stateState: ActionStateTestState;
	appState: GitHubAppTestState;
	layer: Layer.Layer<ActionState | GitHubApp | ActionOutputs>;
}

const makeFixtures = (): Fixtures => {
	const stateState = ActionStateTest.empty();
	const appState = GitHubAppTest.empty();
	// 2.0: GitHubToken.provision masks the minted token via ActionOutputs.setSecret,
	// so the shared fixture layer must satisfy ActionOutputs as well.
	const layer = Layer.mergeAll(
		ActionStateTest.layer(stateState),
		GitHubAppTest.layer(appState),
		ActionOutputsTest.layer(ActionOutputsTest.empty()),
	);
	return { stateState, appState, layer };
};

/** Provision a token into the shared `ActionState`, simulating the pre phase. */
const provisionToken = (fixtures: Fixtures): Promise<void> =>
	GitHubToken.provision({ clientId: "test-client-id", privateKey: "test-private-key" }).pipe(
		Effect.provide(fixtures.layer),
		Effect.asVoid,
		Effect.runPromise,
	);

/** Run `post` with a `ConfigProvider` controlling the `skip-token-revoke` input. */
const runPost = (fixtures: Fixtures, skipTokenRevoke = false): Promise<void> => {
	const config = ConfigProvider.fromUnknown({ "skip-token-revoke": String(skipTokenRevoke) });
	return post.pipe(Effect.provide(fixtures.layer), Effect.provide(ConfigProvider.layer(config)), Effect.runPromise);
};

describe("post", () => {
	it("revokes the installation token provisioned by pre", async () => {
		const fixtures = makeFixtures();
		await provisionToken(fixtures);
		await runPost(fixtures);

		// 2.0: revokeToken takes Redacted<string>, so the test layer records
		// Redacted values — unwrap before asserting the token string.
		expect(fixtures.appState.revokeCalls.map(Redacted.value)).toContain("ghs_test_token_123");
	});

	it("skips revocation when skip-token-revoke is true", async () => {
		const fixtures = makeFixtures();
		await provisionToken(fixtures);
		await runPost(fixtures, true);

		expect(fixtures.appState.revokeCalls).toHaveLength(0);
	});

	it("completes cleanly when no token was provisioned", async () => {
		const fixtures = makeFixtures();
		await runPost(fixtures);

		expect(fixtures.appState.revokeCalls).toHaveLength(0);
	});

	it("reports duration when pre recorded a start time", async () => {
		const fixtures = makeFixtures();
		fixtures.stateState.entries.set("startTime", JSON.stringify({ startedAt: Date.now() - 1000 }));
		await provisionToken(fixtures);

		// The duration log path runs without throwing; revocation still happens.
		await runPost(fixtures);
		expect(fixtures.appState.revokeCalls.map(Redacted.value)).toContain("ghs_test_token_123");
	});
});
