import { InstallationToken } from "@effected/github";
import { ActionState } from "@effected/github-actions";
import type { Layer } from "effect";
import { DateTime, Effect, Redacted } from "effect";
import { vi } from "vitest";

/**
 * An `ActionState` holding the App installation token `pre` persisted.
 *
 * @remarks
 * Anything that reaches `GitHubToken.read()` needs this — `runNativeVersion`
 * now does, because the `process.env.STATE_token` bridge it used to read is
 * gone. Injecting the token as a service rather than as an environment variable
 * is the point: a stale `process.env` value silently survives between tests and
 * turns an expected-to-fail case green.
 *
 * The token carries **no `appSlug`**, so `InstallationToken.botIdentity()`
 * returns `BotIdentity.githubActions` — the same identity the no-token fallback
 * produced, which keeps the DCO trailer these fixtures assert on unchanged.
 *
 * @param token - The raw token the double hands back.
 * @returns A `Layer` providing `ActionState` whose `get` answers with the token.
 */
export const actionStateWithAppToken = (token = "app-token-value"): Layer.Layer<ActionState> =>
	ActionState.layerTest({
		get: (() =>
			Effect.succeed(
				InstallationToken.make({
					token: Redacted.make(token),
					// An hour out, so `GitHubToken.read`'s expiry check passes.
					expiresAt: DateTime.addDuration(DateTime.nowUnsafe(), "1 hour"),
					installationId: 1,
					permissions: { contents: "write" },
				}),
			)) as ActionState["Service"]["get"],
	});

/**
 * Suppresses console output during tests.
 *
 * Mocks `process.stdout.write` and `process.stderr.write` to prevent test
 * output noise.
 *
 * @remarks
 * Call this in `beforeEach()`; the mocks are restored by `vi.restoreAllMocks()`
 * in `afterEach()` (see {@link cleanupTestEnvironment}).
 */
export function suppressConsoleOutput(): void {
	vi.spyOn(process.stdout, "write").mockImplementation(() => true);
	vi.spyOn(process.stderr, "write").mockImplementation(() => true);
}

/**
 * Sets up a clean test environment.
 *
 * Clears all mocks and optionally suppresses console output.
 *
 * @param options - Configuration options.
 * @param options.suppressOutput - Whether to suppress console output (default: false).
 */
export function setupTestEnvironment(options: { suppressOutput?: boolean } = {}): void {
	vi.clearAllMocks();

	if (options.suppressOutput) {
		suppressConsoleOutput();
	}
}

/**
 * Cleans up the test environment by restoring all mocked functions.
 *
 * @remarks
 * Call this in `afterEach()` to ensure clean state between tests.
 */
export function cleanupTestEnvironment(): void {
	vi.restoreAllMocks();
}
