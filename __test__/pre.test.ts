/**
 * Fixture tests for the pre-action Effect program.
 *
 * @remarks
 * Drives `pre` end-to-end against the in-memory `@savvy-web/github-action-effects`
 * test layers and asserts:
 *
 *   - A GitHub App installation token is provisioned via `GitHubToken.provision`
 *     and exposed as action outputs (`token`, `installation-id`, `app-slug`).
 *   - The start time is persisted to `ActionState` for `post.ts` duration
 *     reporting, alongside the token envelope `provision` writes internally.
 *   - The optional `github-token` input is persisted as a `GithubPackagesToken`
 *     state entry and registered as a masked secret.
 *
 * App credentials (`app-client-id` / `app-private-key`) and the optional
 * `github-token` input are supplied through a `ConfigProvider`.
 */

import type {
	ActionOutputs,
	ActionOutputsTestState,
	ActionState,
	ActionStateTestState,
	GitHubApp,
	GitHubAppTestState,
} from "@savvy-web/github-action-effects/testing";
import { ActionOutputsTest, ActionStateTest, GitHubAppTest } from "@savvy-web/github-action-effects/testing";
import { ConfigProvider, Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { pre } from "../src/pre.js";

interface Fixtures {
	outputsState: ActionOutputsTestState;
	stateState: ActionStateTestState;
	appState: GitHubAppTestState;
	layer: Layer.Layer<ActionOutputs | ActionState | GitHubApp>;
}

/** Build the three test layers `pre` needs, merged into one. */
const makeFixtures = (): Fixtures => {
	const outputsState = ActionOutputsTest.empty();
	const stateState = ActionStateTest.empty();
	const appState = GitHubAppTest.empty();
	const layer = Layer.mergeAll(
		ActionOutputsTest.layer(outputsState),
		ActionStateTest.layer(stateState),
		GitHubAppTest.layer(appState),
	);
	return { outputsState, stateState, appState, layer };
};

/**
 * Run `pre` against the given fixtures with a `ConfigProvider` that supplies
 * the App credentials and an optional `github-token` input.
 */
const runPre = (fixtures: Fixtures, githubToken = ""): Promise<void> => {
	const config = ConfigProvider.fromUnknown({
		"app-client-id": "test-client-id",
		"app-private-key": "test-private-key",
		"github-token": githubToken,
	});
	return pre.pipe(Effect.provide(fixtures.layer), Effect.provide(ConfigProvider.layer(config)), Effect.runPromise);
};

/** Look up an action output by name. */
const outputValue = (state: ActionOutputsTestState, name: string): string | undefined =>
	state.outputs.find((o) => o.name === name)?.value;

describe("pre", () => {
	it("provisions a token and exposes it as action outputs", async () => {
		const fixtures = makeFixtures();
		await runPre(fixtures);

		expect(fixtures.appState.generateCalls).toHaveLength(1);
		expect(outputValue(fixtures.outputsState, "token")).toBe("ghs_test_token_123");
		expect(outputValue(fixtures.outputsState, "installation-id")).toBeDefined();
		expect(outputValue(fixtures.outputsState, "app-slug")).toBe("test-app");
	});

	it("persists the start time and the token envelope to ActionState", async () => {
		const fixtures = makeFixtures();
		await runPre(fixtures);

		expect(fixtures.stateState.entries.has("startTime")).toBe(true);
		const startTime = JSON.parse(fixtures.stateState.entries.get("startTime") ?? "{}");
		expect(typeof startTime.startedAt).toBe("number");
		// startTime + the internal token envelope provision writes.
		expect(fixtures.stateState.entries.size).toBeGreaterThanOrEqual(2);
	});

	it("persists the github-token input and registers it as a secret", async () => {
		const fixtures = makeFixtures();
		await runPre(fixtures, "ghp_packages_token");

		expect(fixtures.stateState.entries.has("githubPackagesToken")).toBe(true);
		const pkg = JSON.parse(fixtures.stateState.entries.get("githubPackagesToken") ?? "{}");
		expect(pkg.token).toBe("ghp_packages_token");
		expect(fixtures.outputsState.secrets).toContain("ghp_packages_token");
	});

	it("skips the github-packages state when no github-token input is given", async () => {
		const fixtures = makeFixtures();
		await runPre(fixtures);

		expect(fixtures.stateState.entries.has("githubPackagesToken")).toBe(false);
		// 2.0: provision masks the minted installation token via setSecret, so it
		// is the only registered secret — no github-packages token is added.
		expect(fixtures.outputsState.secrets).toEqual(["ghs_test_token_123"]);
	});
});
