/**
 * Tests for the pre-action program.
 *
 * @remarks
 * Written against the kit's own test seams (`layerTest` / `makeTest`), not
 * ported from the predecessor's `*Test` doubles. Two properties of those seams
 * shape everything below:
 *
 * - **Unstubbed members die loudly, naming themselves.** There is no permissive
 *   default that quietly answers. So each fixture stubs exactly what `pre`
 *   touches, and a test that goes red because something was not stubbed is
 *   telling you the program reached a member you did not expect.
 * - **`ActionInput.layer` takes a `process.env`-shaped record**, so its keys are
 *   the runner's own `INPUT_<MANGLED>` variables, not the plain input names.
 *   The mangling is uppercase, spaces to underscores, **dashes left alone** —
 *   `app-client-id` becomes `INPUT_APP-CLIENT-ID`. The keys are spelled out
 *   literally below rather than derived by a local helper: re-deriving the
 *   mangling in the test would let a wrong rule agree with itself.
 *
 * Plain Vitest, deliberately — see the rebuild plan's testing posture.
 */

import { readFile } from "node:fs/promises";
import { AppIdentity, GitHubApp, GitHubAppError, InstallationToken } from "@effected/github";
import { ActionEnvironment, ActionInput, ActionOutputs, ActionState } from "@effected/github-actions";
import { DateTime, Effect, Layer, Redacted, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { pre } from "../src/pre.js";

/** What the fake runner recorded while `pre` ran. */
interface Recorder {
	readonly outputs: Array<{ name: string; value: string }>;
	readonly secrets: Array<string>;
	readonly state: Map<string, unknown>;
	readonly tokenRequests: Array<{ appId: string; owner: string | undefined }>;
	readonly revoked: Array<string>;
}

const makeRecorder = (): Recorder => ({
	outputs: [],
	secrets: [],
	state: new Map(),
	tokenRequests: [],
	revoked: [],
});

const TOKEN = "ghs_test_token_123";

/** A minted token an hour out, with the App identity resolved. */
const mintedToken = (): InstallationToken =>
	InstallationToken.make({
		token: Redacted.make(TOKEN),
		expiresAt: DateTime.makeUnsafe("2030-01-01T01:00:00Z"),
		installationId: 4242,
		permissions: { contents: "write" },
		appSlug: "test-app",
		appName: "Test App",
	});

/**
 * The layers `pre` needs beyond its own `PreLive`.
 *
 * @remarks
 * `ActionOutputs`, `ActionState` and `ActionEnvironment` are normally supplied
 * by `ActionRuntime`; here they are stubbed so nothing touches a real runner
 * file. `GitHubApp` is `pre`'s own domain layer.
 */
const makeLayer = (recorder: Recorder, inputs: Record<string, string>) =>
	Layer.mergeAll(
		ActionOutputs.layerTest({
			set: (name, value) => Effect.sync(() => void recorder.outputs.push({ name, value })),
			setSecret: (value) => Effect.sync(() => void recorder.secrets.push(value)),
		}),
		ActionState.layerTest({
			// The real `save` encodes through the schema before persisting, so the
			// double does too — otherwise a schema that cannot encode its value
			// would pass here and fail on a runner.
			save: <A, I>(key: string, value: A, schema: Schema.Codec<A, I>) =>
				Effect.sync(() => void recorder.state.set(key, Schema.encodeUnknownSync(schema)(value))),
		}),
		ActionEnvironment.layerTest({
			GITHUB_REPOSITORY: "savvy-web/silk-release-action",
			// Its own runner variable, NOT derived by splitting GITHUB_REPOSITORY —
			// the kit reads what the runner published rather than re-deriving it.
			GITHUB_REPOSITORY_OWNER: "savvy-web",
		}),
		GitHubApp.layerTest({
			token: (request) =>
				Effect.sync(() => {
					recorder.tokenRequests.push({ appId: request.appId, owner: request.owner });
					return mintedToken();
				}),
			// `provision` resolves the App identity so a commit is attributed to
			// `my-app[bot]` rather than `github-actions[bot]`. It is best-effort —
			// but the double must still answer, because an unstubbed member throws a
			// *defect*, which the degradation path (built on `Effect.result`) does
			// not catch.
			identity: () => Effect.succeed(AppIdentity.make({ slug: "test-app", name: "Test App", userId: 99 })),
			revoke: (token) => Effect.sync(() => void recorder.revoked.push(Redacted.value(token))),
		}),
		ActionInput.layer(inputs),
	);

const runPre = (recorder: Recorder, inputs: Record<string, string>): Promise<void> =>
	pre.pipe(Effect.provide(makeLayer(recorder, inputs)), Effect.runPromise);

const BASE_INPUTS = {
	"INPUT_APP-CLIENT-ID": "test-client-id",
	"INPUT_APP-PRIVATE-KEY": "test-private-key",
};

const outputValue = (recorder: Recorder, name: string): string | undefined =>
	recorder.outputs.find((o) => o.name === name)?.value;

describe("pre", () => {
	it("provisions a token and exposes it as action outputs", async () => {
		const recorder = makeRecorder();
		await runPre(recorder, BASE_INPUTS);

		expect(recorder.tokenRequests).toHaveLength(1);
		expect(outputValue(recorder, "token")).toBe(TOKEN);
		expect(outputValue(recorder, "installation-id")).toBe("4242");
		expect(outputValue(recorder, "app-slug")).toBe("test-app");
	});

	it("reads the app credentials from the action inputs", async () => {
		const recorder = makeRecorder();
		await runPre(recorder, BASE_INPUTS);

		// The kit's `provision` no longer reads the inputs itself, so this asserts
		// the wiring `pre` now owns.
		expect(recorder.tokenRequests[0]?.appId).toBe("test-client-id");
	});

	it("scopes the installation lookup to the repository owner", async () => {
		const recorder = makeRecorder();
		await runPre(recorder, BASE_INPUTS);

		// Preserves the predecessor's auto-resolution of the installation from the
		// repo owner when no explicit installation id is supplied.
		expect(recorder.tokenRequests[0]?.owner).toBe("savvy-web");
	});

	it("declassifies the installation token through the Secret seam", async () => {
		// A STRUCTURAL assertion, deliberately, and the reason is worth recording:
		// the obvious behavioural version of this test — "the token appears in
		// `setSecret`" — **cannot fail**. `GitHubToken.provision` already calls
		// `Secret.forRunnerFile` on the minted token internally, so the value is
		// masked before `pre` touches it, and swapping `Secret.forRunnerFile` for a
		// bare `Redacted.value` here still passes. Verified by mutation.
		//
		// What actually regresses is the *seam*: `Redacted.value` outside
		// `Secret.ts` is how a future declassification leaks. The kit enforces the
		// same invariant on itself the same way, by scanning its own source.
		const source = await readFile(new URL("../src/pre.ts", import.meta.url), "utf8");
		const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

		expect(withoutComments).not.toContain("Redacted.value");
		expect(withoutComments).toContain("Secret.forRunnerFile");
	});

	it("persists the start time for post-phase duration reporting", async () => {
		const recorder = makeRecorder();
		await runPre(recorder, BASE_INPUTS);

		const startTime = recorder.state.get("startTime") as { startedAt?: unknown } | undefined;
		expect(typeof startTime?.startedAt).toBe("number");
	});

	it("does not persist any GitHub Packages token state", async () => {
		// The `github-token` input is gone: GitHub Packages authenticates as the
		// App. A workflow still passing it must not resurrect the old state key,
		// which `main.ts` no longer bridges and nothing reads.
		const recorder = makeRecorder();

		await runPre(recorder, { ...BASE_INPUTS, "INPUT_GITHUB-TOKEN": "ghp_packages_token" });

		expect(recorder.state.has("githubPackagesToken")).toBe(false);
		expect(recorder.secrets).not.toContain("ghp_packages_token");
	});

	it("omits the app-slug output when identity could not be resolved", async () => {
		const recorder = makeRecorder();
		const layer = Layer.mergeAll(
			ActionOutputs.layerTest({
				set: (name, value) => Effect.sync(() => void recorder.outputs.push({ name, value })),
				setSecret: (value) => Effect.sync(() => void recorder.secrets.push(value)),
			}),
			ActionState.layerTest({ save: () => Effect.void }),
			ActionEnvironment.layerTest({
				GITHUB_REPOSITORY: "savvy-web/silk-release-action",
				// Its own runner variable, NOT derived by splitting GITHUB_REPOSITORY —
				// the kit reads what the runner published rather than re-deriving it.
				GITHUB_REPOSITORY_OWNER: "savvy-web",
			}),
			GitHubApp.layerTest({
				token: () =>
					Effect.succeed(
						InstallationToken.make({
							token: Redacted.make(TOKEN),
							expiresAt: DateTime.makeUnsafe("2030-01-01T01:00:00Z"),
							installationId: 4242,
							permissions: {},
						}),
					),
				// A *typed* failure, which is what a real `GET /app` hiccup produces.
				// `provision` degrades rather than failing — the token comes back
				// without identity fields and the action still succeeds. A `GET /app`
				// blip must never fail a release.
				identity: () => Effect.fail(new GitHubAppError({ kind: "identity", reason: "GET /app returned 503" })),
			}),
			ActionInput.layer(BASE_INPUTS),
		);

		await pre.pipe(Effect.provide(layer), Effect.runPromise);

		expect(outputValue(recorder, "token")).toBe(TOKEN);
		expect(outputValue(recorder, "app-slug")).toBeUndefined();
	});
});
