/**
 * Tests for the DCO sign-off trailer resolver.
 *
 * @remarks
 * `resolveSignoff` derives a `Signed-off-by` line from the GitHub App bot
 * identity persisted by `GitHubToken.provision`.
 *
 * There are **two** fallbacks at different depths, and both are covered here
 * because they produce the same string for different reasons:
 *
 * 1. `InstallationToken.botIdentity()` returns `BotIdentity.githubActions` when
 *    a token *is* persisted but carries no `appSlug` (the `GET /app` lookup
 *    failed during `provision`).
 * 2. `resolveSignoff`'s own `Effect.catch` covers the state read failing
 *    outright — no token persisted at all.
 *
 * The token fixtures are real `InstallationToken.make(...)` values, not plain
 * objects: `botIdentity()` is a method on the class, so a structurally-correct
 * literal typechecks through the double and then fails at runtime.
 */

import { InstallationToken } from "@effected/github";
import { ActionState, ActionStateError } from "@effected/github-actions";
import type { Layer } from "effect";
import { DateTime, Effect, Redacted } from "effect";
import { describe, expect, it } from "vitest";
import { resolveSignoff } from "../src/utils/commit-signoff.js";

const FALLBACK_TRAILER = "Signed-off-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>";

/** An `ActionState` whose `get` answers with the supplied token envelope. */
const stateWith = (token: InstallationToken): Layer.Layer<ActionState> =>
	ActionState.layerTest({ get: (() => Effect.succeed(token)) as ActionState["Service"]["get"] });

/** An `ActionState` whose `get` fails, standing in for "no token persisted". */
const stateMissing: Layer.Layer<ActionState> = ActionState.layerTest({
	get: ((key: string) =>
		Effect.fail(new ActionStateError({ reason: "missing", key }))) as ActionState["Service"]["get"],
});

const run = (layer: Layer.Layer<ActionState>): Promise<string> =>
	Effect.runPromise(resolveSignoff().pipe(Effect.provide(layer)));

describe("resolveSignoff", () => {
	it("builds the trailer from the persisted App bot identity", async () => {
		const signoff = await run(
			stateWith(
				InstallationToken.make({
					token: Redacted.make("ghs_test_token_123"),
					expiresAt: DateTime.makeUnsafe("2030-01-01T01:00:00Z"),
					installationId: 4242,
					permissions: {},
					appSlug: "test-app",
					appName: "Test App",
					appUserId: 99,
				}),
			),
		);

		expect(signoff).toMatch(/^Signed-off-by: .+ <[^<>]+@[^<>]+>$/);
		expect(signoff).toBe("Signed-off-by: test-app[bot] <99+test-app[bot]@users.noreply.github.com>");
	});

	it("omits the numeric prefix from the email when the app user id is unknown", async () => {
		const signoff = await run(
			stateWith(
				InstallationToken.make({
					token: Redacted.make("ghs_test_token_123"),
					expiresAt: DateTime.makeUnsafe("2030-01-01T01:00:00Z"),
					installationId: 4242,
					permissions: {},
					appSlug: "test-app",
					appName: "Test App",
				}),
			),
		);

		expect(signoff).toBe("Signed-off-by: test-app[bot] <test-app[bot]@users.noreply.github.com>");
	});

	it("falls back to github-actions[bot] when the persisted token carries no app slug", async () => {
		// Inner fallback: the token IS readable, but `provision`'s identity
		// lookup failed, so `botIdentity()` itself returns the well-known bot.
		const signoff = await run(
			stateWith(
				InstallationToken.make({
					token: Redacted.make("ghs_test_token_123"),
					expiresAt: DateTime.makeUnsafe("2030-01-01T01:00:00Z"),
					installationId: 4242,
					permissions: {},
				}),
			),
		);

		expect(signoff).toBe(FALLBACK_TRAILER);
	});

	it("falls back to github-actions[bot] when no token is persisted", async () => {
		// Outer fallback: the state read fails, caught by `resolveSignoff`.
		expect(await run(stateMissing)).toBe(FALLBACK_TRAILER);
	});

	it("never fails, whatever the state layer does", async () => {
		// The declared error channel is `never`; a failing read must not escape.
		const exit = await Effect.runPromiseExit(resolveSignoff().pipe(Effect.provide(stateMissing)));

		expect(exit._tag).toBe("Success");
	});
});
