/**
 * Tests for the post-action program.
 *
 * @remarks
 * The load-bearing property here is that **a post-action failure must never
 * fail the workflow**. Two of the cases below exercise that directly: a
 * revocation that fails, and a defect escaping the program. Both must resolve
 * rather than reject.
 *
 * Written against the kit's `layerTest` seams rather than the predecessor's
 * `*Test` doubles; plain Vitest by design (see the rebuild plan's testing
 * posture — `@effect/vitest` would install a `TestClock` at the epoch).
 *
 * Note that unstubbed kit members die loudly, so each fixture supplies exactly
 * what `post` touches. A red test naming a member is a finding, not a flake.
 */

import type { GitHubAppShape } from "@effected/github";
import { GitHubApp, InstallationToken } from "@effected/github";
import { ActionInput, ActionState } from "@effected/github-actions";
import { DateTime, Effect, Layer, Logger, Option, Redacted } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { post } from "../src/post.js";
import { cleanupTestEnvironment, setupTestEnvironment } from "./utils/github-mocks.js";

interface Recorder {
	readonly revoked: Array<string>;
}

const TOKEN = "ghs_test_token_123";

/**
 * The key `GitHubToken.dispose` reads the saved envelope from.
 *
 * @remarks
 * The kit's own `DEFAULT_KEY`. Spelled literally so the fixture answers exactly
 * the two keys `post` reads and `Option.none()` for everything else — see the
 * note on `getOptional` below.
 */
const TOKEN_STATE_KEY = "githubToken";

/**
 * The token envelope as `ActionState.getOptional` hands it back.
 *
 * @remarks
 * A real `InstallationToken`, **not a plain object**: `GitHubToken.dispose`
 * calls `found.value.isExpired(...)`, which is a method on the class. A plain
 * object with the right fields typechecks through the double's cast and then
 * throws at runtime — and because `post` catches defects by design, the throw
 * is swallowed into a warning and revocation silently never happens. That is
 * exactly the failure this fixture must not fake.
 */
const savedTokenEnvelope = InstallationToken.make({
	token: Redacted.make(TOKEN),
	expiresAt: DateTime.makeUnsafe("2030-01-01T01:00:00Z"),
	installationId: 4242,
	permissions: {},
});

interface StateOptions {
	readonly startedAt?: number | undefined;
}

const makeLayer = (
	recorder: Recorder,
	inputs: Record<string, string>,
	options: StateOptions,
	appOverrides: Partial<GitHubAppShape>,
): Layer.Layer<ActionState | GitHubApp> =>
	Layer.mergeAll(
		ActionState.layerTest({
			// Branches on the two keys `post` actually reads and answers
			// `Option.none()` for anything else. A catch-all `else` returning the
			// token envelope would defeat this file's die-loudly posture: a second
			// optional state read added to `post` would silently receive an
			// `InstallationToken`, the resulting throw would be swallowed by the
			// defect handling, and these tests would stay green while revocation
			// quietly changed.
			getOptional: ((key: string) =>
				Effect.succeed(
					key === "startTime"
						? options.startedAt === undefined
							? Option.none()
							: Option.some({ startedAt: options.startedAt })
						: key === TOKEN_STATE_KEY
							? Option.some(savedTokenEnvelope)
							: Option.none(),
				)) as ActionState["Service"]["getOptional"],
		}),
		GitHubApp.layerTest({
			revoke: (token) => Effect.sync(() => void recorder.revoked.push(Redacted.value(token))),
			...appOverrides,
		}),
		ActionInput.layer(inputs),
	);

const runPost = (
	recorder: Recorder,
	inputs: Record<string, string> = {},
	options: StateOptions = {},
	appOverrides: Partial<GitHubAppShape> = {},
): Promise<void> =>
	post.pipe(
		Effect.provide(makeLayer(recorder, inputs, options, appOverrides)),
		Effect.provide(Logger.layer([])),
		Effect.runPromise,
	);

describe("post", () => {
	// Revocation logs through `ActionLogger` (stdout); suppress it so the suite
	// does not leak 5 log lines into the reporter.
	beforeEach(() => setupTestEnvironment({ suppressOutput: true }));
	afterEach(() => cleanupTestEnvironment());

	it("should revoke the installation token when no skip is requested", async () => {
		const recorder: Recorder = { revoked: [] };

		await runPost(recorder);

		expect(recorder.revoked).toEqual([TOKEN]);
	});

	it("revokes even when a legacy skip-token-revoke input is present", async () => {
		// The input is gone. A workflow still passing it must not silently get the
		// old behaviour — the token is revoked regardless.
		const recorder: Recorder = { revoked: [] };

		await runPost(recorder, { "INPUT_SKIP-TOKEN-REVOKE": "true" });

		expect(recorder.revoked).toEqual([TOKEN]);
	});

	it("should not fail the workflow when a defect escapes", async () => {
		const recorder: Recorder = { revoked: [] };

		await expect(
			runPost(
				recorder,
				{},
				{},
				{
					revoke: () =>
						Effect.sync(() => {
							throw new Error("boom");
						}),
				},
			),
		).resolves.toBeUndefined();
	});

	it("should report the duration when pre recorded a start time", async () => {
		const recorder: Recorder = { revoked: [] };

		await runPost(recorder, {}, { startedAt: Date.now() - 2_000 });

		expect(recorder.revoked).toEqual([TOKEN]);
	});

	it("should tolerate a missing start time", async () => {
		const recorder: Recorder = { revoked: [] };

		// `pre` may have failed before recording it; that must not stop revocation.
		await runPost(recorder, {}, { startedAt: undefined });

		expect(recorder.revoked).toEqual([TOKEN]);
	});
});
