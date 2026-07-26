import { ScriptedSpawner } from "@effected/commands";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Exit, FileSystem, Layer, Logger } from "effect";
import { describe, expect, it } from "vitest";
import { CHANGELOG_MODULES, runNativeVersion } from "../src/utils/native-version.js";

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

const run = <A, E>(effect: Effect.Effect<A, E, never>) =>
	Effect.runPromiseExit(effect.pipe(Effect.provide(Logger.layer([]))));

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
			noSpawns().layer,
		);
		const exit = await run(runNativeVersion("/repo").pipe(Effect.provide(layer)));
		expect(Exit.isSuccess(exit)).toBe(true);
		if (Exit.isSuccess(exit)) expect(exit.value.releases[0].newVersion).toBe("1.1.0");
	});

	it("sets GITHUB_TOKEN from the app token for the apply call and restores it after", async () => {
		const previousState = process.env.STATE_token;
		const previousToken = process.env.GITHUB_TOKEN;
		process.env.STATE_token = "app-token-value";
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
			const layer = Layer.mergeAll(planner, inspectorValid, fsWithConfig, noSpawns().layer);
			await run(runNativeVersion("/repo").pipe(Effect.provide(layer)));
			expect(seenDuringApply).toBe("app-token-value");
			expect(process.env.GITHUB_TOKEN).toBeUndefined();
		} finally {
			if (previousState === undefined) delete process.env.STATE_token;
			else process.env.STATE_token = previousState;
			if (previousToken !== undefined) process.env.GITHUB_TOKEN = previousToken;
		}
	});

	it("sets GITHUB_TOKEN from the app token even when an ambient GITHUB_TOKEN is already set, and restores the ambient value after", async () => {
		const previousState = process.env.STATE_token;
		const previousToken = process.env.GITHUB_TOKEN;
		process.env.STATE_token = "app-token-value";
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
			const layer = Layer.mergeAll(planner, inspectorValid, fsWithConfig, noSpawns().layer);
			await run(runNativeVersion("/repo").pipe(Effect.provide(layer)));
			expect(seenDuringApply).toBe("app-token-value");
			expect(process.env.GITHUB_TOKEN).toBe("ambient-value");
		} finally {
			if (previousState === undefined) delete process.env.STATE_token;
			else process.env.STATE_token = previousState;
			if (previousToken === undefined) delete process.env.GITHUB_TOKEN;
			else process.env.GITHUB_TOKEN = previousToken;
		}
	});

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
		const layer = Layer.mergeAll(planner, inspectorValid, fsWithConfig, spawner.layer);
		const exit = await run(runNativeVersion("/repo").pipe(Effect.provide(layer)));
		expect(Exit.isSuccess(exit)).toBe(true);
		expect(calls).toBe(2);
		// Both halves of the reset, in order. `@effected/git` ships neither, and
		// its `checkout` refuses `--`, so these are raw commands by necessity.
		expect(spawner.spawns.map((s) => [s.command, ...s.args].join(" "))).toEqual(["git checkout -- .", "git clean -fd"]);
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
		const layer = Layer.mergeAll(planner, inspectorValid, fsWithConfig, noSpawns().layer);
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
			noSpawns().layer,
		);
		const exit = await run(runNativeVersion("/repo").pipe(Effect.provide(layer)));
		expect(Exit.isSuccess(exit)).toBe(true);
	});
});
