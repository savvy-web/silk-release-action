import { ScriptedSpawner } from "@effected/commands";
import { Git } from "@effected/git";
import { ActionOutputs, ActionState, ActionStateError } from "@effected/github-actions";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Exit, FileSystem, Layer, Logger } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect, it } from "vitest";
import { CHANGELOG_MODULES, runNativeVersion } from "../src/utils/native-version.js";
import { actionStateWithAppToken } from "./utils/github-mocks.js";

const applied: Changesets.AppliedRelease = {
	dryRun: false,
	releases: [{ name: "@scope/a", type: "minor", oldVersion: "1.0.0", newVersion: "1.1.0" }],
	touchedFiles: ["/repo/package.json", "/repo/CHANGELOG.md"],
	versionFileUpdates: [],
};

const inspectorValid = Changesets.makeConfigInspectorTest({
	configPath: "/repo/.changeset/config.json",
	projectDir: "/repo",
	changelog: "@savvy-web/silk/changesets/changelog",
	baseBranch: "main",
	access: "restricted",
	ignore: [],
	packages: [],
	legacyVersionFilesUsed: false,
});

const fsWithConfig = FileSystem.layerNoop({
	exists: (path) => Effect.succeed(path.endsWith(".changeset/config.json")),
});

/**
 * A spawner that FAILS any spawn. The predecessor's `CommandRunnerTest`
 * defaulted every unregistered command to exit 0, so a test could not tell
 * whether a command ran. Here an unexpected spawn fails the effect, and
 * `spawner.spawns` records exactly what was attempted.
 */
const noSpawns = (): ScriptedSpawner => ScriptedSpawner.make((command) => ScriptedSpawner.notFound(command));

/**
 * The REAL `Git` service over a scripted spawner.
 *
 * @remarks
 * `runNativeVersion` now resets the tree through `@effected/git`'s `restore`
 * and `clean` members rather than raw `ChildProcess` commands. Providing the
 * real `Git.layer` on top of the same `ScriptedSpawner` keeps these tests
 * asserting on the ACTUAL argv the kit emits — a `Git.layerTest` double would
 * assert only that a method was called, and would not catch the kit changing
 * what it spawns.
 */
const gitOver = (spawner: Layer.Layer<ChildProcessSpawner.ChildProcessSpawner>): Layer.Layer<Git> =>
	Git.layer.pipe(Layer.provide(spawner));

/**
 * Records every `setSecret` the run performs.
 *
 * @remarks
 * `withGithubTokenEnv` declassifies the App token through `Secret.forProcessEnv`,
 * which masks it with the runner on the way out. Capturing the masks lets the
 * suite assert that the token written into `process.env.GITHUB_TOKEN` was
 * registered with the log filter first — the property the bare `Redacted.value`
 * this replaced did not have.
 */
const maskRecorder = (): { masked: Array<string>; layer: Layer.Layer<ActionOutputs> } => {
	const masked: Array<string> = [];
	return {
		masked,
		layer: ActionOutputs.layerTest({
			setSecret: (value: string) =>
				Effect.sync(() => {
					masked.push(value);
				}),
		}),
	};
};

/**
 * `ActionState` holding the App token `pre` persisted.
 *
 * @remarks
 * `native-version.ts` reads it with `GitHubToken.read()` — the same kit member
 * `main.ts` uses. It used to read `process.env.STATE_token`, a plaintext bridge
 * `main.ts` wrote, and these tests set that variable directly: exactly the
 * env-snapshot hazard where a value left behind by one test silently turns an
 * expected-to-fail case in another green. The token is a service now.
 */
const stateWithToken = actionStateWithAppToken;

/** An `ActionState` with nothing persisted — `pre` never ran, or its state was lost. */
const stateWithoutToken: Layer.Layer<ActionState> = ActionState.layerTest({
	get: ((key: string) =>
		Effect.fail(new ActionStateError({ reason: "missing", key }))) as ActionState["Service"]["get"],
});

const run = <A, E>(
	effect: Effect.Effect<A, E, ActionOutputs | ActionState>,
	outputs = maskRecorder().layer,
	state = stateWithToken("app-token-value"),
) =>
	Effect.runPromiseExit(effect.pipe(Effect.provide(outputs), Effect.provide(state), Effect.provide(Logger.layer([]))));

describe("CHANGELOG_MODULES", () => {
	it("maps all four known ids onto the two bundled modules", () => {
		expect(Object.keys(CHANGELOG_MODULES).sort()).toEqual([
			"@changesets/cli/changelog",
			"@savvy-web/changelog",
			"@savvy-web/changesets/changelog",
			"@savvy-web/silk/changesets/changelog",
		]);
		expect(CHANGELOG_MODULES["@savvy-web/changelog"]).toMatch(/changelog-silk\.js$/);
		expect(CHANGELOG_MODULES["@changesets/cli/changelog"]).toMatch(/changelog-default\.js$/);
	});
});

describe("runNativeVersion", () => {
	it("applies natively and returns the applied release", async () => {
		const layer = Layer.mergeAll(
			Changesets.makeReleasePlannerTest({ apply: applied }),
			inspectorValid,
			fsWithConfig,
			gitOver(noSpawns().layer),
		);
		const exit = await run(runNativeVersion("/repo").pipe(Effect.provide(layer)));
		expect(Exit.isSuccess(exit)).toBe(true);
		if (Exit.isSuccess(exit)) expect(exit.value.releases[0].newVersion).toBe("1.1.0");
	});

	it("sets GITHUB_TOKEN from the app token for the apply call and restores it after", async () => {
		const previousToken = process.env.GITHUB_TOKEN;
		delete process.env.GITHUB_TOKEN;
		let seenDuringApply: string | undefined;
		const planner = Layer.succeed(Changesets.ReleasePlanner, {
			plan: () => Effect.die("unused"),
			preview: () => Effect.die("unused"),
			apply: () =>
				Effect.sync(() => {
					seenDuringApply = process.env.GITHUB_TOKEN;
					return applied;
				}),
		});
		try {
			const layer = Layer.mergeAll(planner, inspectorValid, fsWithConfig, gitOver(noSpawns().layer));
			const recorder = maskRecorder();
			await run(runNativeVersion("/repo").pipe(Effect.provide(layer)), recorder.layer);
			expect(seenDuringApply).toBe("app-token-value");
			expect(process.env.GITHUB_TOKEN).toBeUndefined();
			// The property the bare `Redacted.value` did NOT have: the token is
			// registered with the runner's log filter before it is written into
			// the environment, so a later leak through a stack trace or a debug
			// dump of the child's env comes out redacted.
			expect(recorder.masked).toContain("app-token-value");
		} finally {
			if (previousToken !== undefined) process.env.GITHUB_TOKEN = previousToken;
		}
	});

	it("sets GITHUB_TOKEN from the app token even when an ambient GITHUB_TOKEN is already set, and restores the ambient value after", async () => {
		const previousToken = process.env.GITHUB_TOKEN;
		process.env.GITHUB_TOKEN = "ambient-value";
		let seenDuringApply: string | undefined;
		const planner = Layer.succeed(Changesets.ReleasePlanner, {
			plan: () => Effect.die("unused"),
			preview: () => Effect.die("unused"),
			apply: () =>
				Effect.sync(() => {
					seenDuringApply = process.env.GITHUB_TOKEN;
					return applied;
				}),
		});
		try {
			const layer = Layer.mergeAll(planner, inspectorValid, fsWithConfig, gitOver(noSpawns().layer));
			await run(runNativeVersion("/repo").pipe(Effect.provide(layer)));
			expect(seenDuringApply).toBe("app-token-value");
			expect(process.env.GITHUB_TOKEN).toBe("ambient-value");
		} finally {
			if (previousToken === undefined) delete process.env.GITHUB_TOKEN;
			else process.env.GITHUB_TOKEN = previousToken;
		}
	});

	it("FAILS when no App token was persisted, rather than applying unauthenticated", async () => {
		// The bridge this replaces answered a missing token with `""`, and the
		// apply then ran with no `GITHUB_TOKEN` at all: `@changesets/get-github-info`
		// degrades quietly, so the changelog lost its GitHub info on a GREEN run.
		// `GitHubToken.read()` fails typed instead.
		let applied_ = 0;
		const planner = Layer.succeed(Changesets.ReleasePlanner, {
			plan: () => Effect.die("unused"),
			preview: () => Effect.die("unused"),
			// Counted INSIDE the effect. Incrementing in the thunk would count the
			// effect being *constructed* — which `withGithubTokenEnv`'s
			// `acquireUseRelease` does before the acquire runs, so the assertion
			// would fire on a run that never applied anything.
			apply: () =>
				Effect.sync(() => {
					applied_ += 1;
					return applied;
				}),
		});
		const layer = Layer.mergeAll(planner, inspectorValid, fsWithConfig, gitOver(noSpawns().layer));

		const exit = await run(runNativeVersion("/repo").pipe(Effect.provide(layer)), undefined, stateWithoutToken);

		expect(Exit.isFailure(exit)).toBe(true);
		expect(applied_).toBe(0);
	});

	// NOTE: this case spends a real second in `runNativeVersion`'s retry backoff.
	// `vi.useFakeTimers()` does not help — `Effect.sleep` goes through Effect's
	// `Clock` service, not a bare `setTimeout`. The `TestClock` alternative needs
	// the forked effect to have reached the sleep before the clock is advanced,
	// and the filesystem and spawn work ahead of it makes that ordering racy. One
	// second per run is the cheaper trade until the backoff is injectable.
	it("resets the working tree and retries once on a transient network failure", async () => {
		let calls = 0;
		const planner = Layer.succeed(Changesets.ReleasePlanner, {
			plan: () => Effect.die("unused"),
			preview: () => Effect.die("unused"),
			apply: () => {
				calls += 1;
				return calls === 1
					? Effect.fail(
							new Changesets.ReleasePlanError({ phase: "apply", reason: "request to api failed: ECONNRESET" }),
						)
					: Effect.succeed(applied);
			},
		});
		// Records the reset commands instead of defaulting them to success, so the
		// assertion below proves the tree was ACTUALLY reset before the retry —
		// `apply` deletes the changesets it consumes, so retrying on a half-applied
		// tree would corrupt the release.
		const spawner = ScriptedSpawner.make(() => ({ exit: 0, stdout: "", stderr: "" }));
		const layer = Layer.mergeAll(planner, inspectorValid, fsWithConfig, gitOver(spawner.layer));
		const exit = await run(runNativeVersion("/repo").pipe(Effect.provide(layer)));
		expect(Exit.isSuccess(exit)).toBe(true);
		expect(calls).toBe(2);
		// Both halves of the reset, in order, as the ACTUAL argv `@effected/git`
		// emits — `restore` puts its paths behind a literal `--` (which is why it
		// is a separate member from `checkout`, whose option-injection guard
		// refuses `--`), and `clean` spells `--force` in full.
		expect(spawner.spawns.map((s) => [s.command, ...s.args].join(" "))).toEqual([
			"git restore -- .",
			"git clean --force -d",
		]);
	});

	it("runs the reset commands in the directory it was given, not the process cwd", async () => {
		// `git clean -fd` DELETES untracked files. Run in the ambient process CWD
		// instead of the directory under release, it cleans the wrong tree — and
		// the retry then re-applies onto a still half-applied one. The repo root is
		// a plausible ambient CWD here, so a regression is genuinely destructive.
		let calls = 0;
		const planner = Layer.succeed(Changesets.ReleasePlanner, {
			plan: () => Effect.die("unused"),
			preview: () => Effect.die("unused"),
			apply: () => {
				calls += 1;
				return calls === 1
					? Effect.fail(
							new Changesets.ReleasePlanError({ phase: "apply", reason: "request to api failed: ECONNRESET" }),
						)
					: Effect.succeed(applied);
			},
		});
		const spawner = ScriptedSpawner.make(() => ({ exit: 0, stdout: "", stderr: "" }));
		const layer = Layer.mergeAll(planner, inspectorValid, fsWithConfig, gitOver(spawner.layer));

		const exit = await run(runNativeVersion("/somewhere/else").pipe(Effect.provide(layer)));

		expect(Exit.isSuccess(exit)).toBe(true);
		expect(spawner.spawns).toHaveLength(2);
		for (const spawn of spawner.spawns) {
			expect(spawn.options?.cwd).toBe("/somewhere/else");
		}
	});

	it("fails without retry on a non-transient ReleasePlanError", async () => {
		let calls = 0;
		const planner = Layer.succeed(Changesets.ReleasePlanner, {
			plan: () => Effect.die("unused"),
			preview: () => Effect.die("unused"),
			apply: () => {
				calls += 1;
				return Effect.fail(
					new Changesets.ReleasePlanError({ phase: "apply", reason: 'changelog id "@custom/gen" is not supported' }),
				);
			},
		});
		const layer = Layer.mergeAll(planner, inspectorValid, fsWithConfig, gitOver(noSpawns().layer));
		const exit = await run(runNativeVersion("/repo").pipe(Effect.provide(layer)));
		expect(Exit.isFailure(exit)).toBe(true);
		expect(calls).toBe(1);
	});

	it("skips the config gate when no .changeset/config.json exists", async () => {
		const fsNoConfig = FileSystem.layerNoop({ exists: () => Effect.succeed(false) });
		// Inspector that would fail if consulted — proves the gate short-circuits.
		const inspectorUnused = Layer.succeed(Changesets.ConfigInspector, {
			inspect: () => Effect.die("inspect must not be called when config is absent"),
		} as unknown as Changesets.ConfigInspectorShape);
		const layer = Layer.mergeAll(
			Changesets.makeReleasePlannerTest({ apply: applied }),
			inspectorUnused,
			fsNoConfig,
			gitOver(noSpawns().layer),
		);
		const exit = await run(runNativeVersion("/repo").pipe(Effect.provide(layer)));
		expect(Exit.isSuccess(exit)).toBe(true);
	});
});
