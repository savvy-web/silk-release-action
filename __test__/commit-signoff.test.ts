/**
 * Tests for the DCO sign-off trailer resolver.
 *
 * @remarks
 * `resolveSignoff` derives a `Signed-off-by` line from the GitHub App bot
 * identity persisted by `GitHubToken.provision`. With a provisioned token it
 * uses the App identity; with no token it falls back to `github-actions[bot]`.
 */

import { GitHubToken } from "@savvy-web/github-action-effects";
import { ActionOutputsTest, ActionStateTest, GitHubAppTest } from "@savvy-web/github-action-effects/testing";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { resolveSignoff } from "../src/utils/commit-signoff.js";

describe("resolveSignoff", () => {
	it("builds the trailer from the provisioned App bot identity", async () => {
		const appState = GitHubAppTest.empty();
		const stateState = ActionStateTest.empty();

		// pre phase: provision persists the token envelope (with App identity).
		await GitHubToken.provision({ clientId: "test-client-id", privateKey: "test-private-key" }).pipe(
			Effect.provide(
				Layer.mergeAll(
					GitHubAppTest.layer(appState),
					ActionStateTest.layer(stateState),
					// 2.0: provision masks the minted token via ActionOutputs.setSecret.
					ActionOutputsTest.layer(ActionOutputsTest.empty()),
				),
			),
			Effect.asVoid,
			Effect.runPromise,
		);

		const signoff = await resolveSignoff().pipe(Effect.provide(ActionStateTest.layer(stateState)), Effect.runPromise);

		expect(signoff).toMatch(/^Signed-off-by: .+ <[^<>]+@[^<>]+>$/);
		expect(signoff).toContain("test-app");
	});

	it("falls back to github-actions[bot] when no token is persisted", async () => {
		const signoff = await resolveSignoff().pipe(
			Effect.provide(ActionStateTest.layer(ActionStateTest.empty())),
			Effect.runPromise,
		);

		expect(signoff).toBe("Signed-off-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>");
	});
});
