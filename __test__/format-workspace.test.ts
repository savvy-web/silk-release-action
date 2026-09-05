/**
 * Tests for the conditional post-version Biome format.
 *
 * @remarks
 * The binary-presence probe is now `ToolDiscovery.isAvailable`, which is a
 * separate seam from the format run itself — so "biome is absent" and "biome
 * ran and failed" are scripted independently here. The predecessor could not
 * express that: it probed with `biome --version` and read the probe's *failure*
 * as absence, conflating a missing binary with one that ran and errored.
 *
 * `ScriptedSpawner` answers the format run. Any command the script does not
 * expect fails the spawn, so a test cannot pass by accidentally running
 * something.
 */

import type { ScriptResult } from "@effected/commands";
import { ScriptedSpawner, ToolDiscovery } from "@effected/commands";
import { MemoryFileSystem } from "@effected/memfs";
import type { FileSystem } from "effect";
import { Effect, Exit, Layer, Logger } from "effect";
import { describe, expect, it } from "vitest";
import { formatWorkspaceWithBiome } from "../src/utils/format-workspace.js";

interface Options {
	/** What `ToolDiscovery.isAvailable` answers for `biome`. */
	readonly available?: boolean;
	/** How the `biome format` spawn behaves. */
	readonly format?: ScriptResult;
}

/**
 * A volume holding exactly the named config files at the repo root.
 *
 * @remarks
 * The predecessor answered `exists` with `path.endsWith(f)`, which is a
 * *suffix* match: it would have answered `true` for `nested/dir/biome.json`
 * just as readily as for the root config the module actually probes. A volume
 * seeded at the paths `formatWorkspaceWithBiome` reads (`biome.jsonc` /
 * `biome.json`, relative, so resolved from the volume's root) makes the probe
 * exact — nothing else on the volume can satisfy it.
 */
const fsWith = (files: string[]): Layer.Layer<FileSystem.FileSystem> =>
	MemoryFileSystem.layerWith(Object.fromEntries(files.map((file) => [`/${file}`, ""])));

const run = async (
	files: string[],
	options: Options = {},
): Promise<{ exit: Exit.Exit<void, unknown>; spawner: ScriptedSpawner }> => {
	const spawner = ScriptedSpawner.make((command, args) => {
		if (command === "biome" && args[0] === "format") {
			return options.format ?? { exit: 0, stdout: "", stderr: "" };
		}
		// Anything else is a test bug, not a pass.
		return ScriptedSpawner.notFound(command);
	});
	const exit = await Effect.runPromiseExit(
		formatWorkspaceWithBiome().pipe(
			Effect.provide(
				Layer.mergeAll(
					fsWith(files),
					spawner.layer,
					ToolDiscovery.layerTest({ isAvailable: () => Effect.succeed(options.available ?? true) }),
				),
			),
			Effect.provide(Logger.layer([])),
		),
	);
	return { exit, spawner };
};

describe("formatWorkspaceWithBiome", () => {
	it("is a no-op when no biome config exists", async () => {
		// No config: it must not probe and must not spawn. The unstubbed
		// `ToolDiscovery.layerTest()` below dies if `isAvailable` is called, so the
		// success assertion genuinely pins the early return.
		const spawner = ScriptedSpawner.make((command) => ScriptedSpawner.notFound(command));
		const exit = await Effect.runPromiseExit(
			formatWorkspaceWithBiome().pipe(
				Effect.provide(Layer.mergeAll(fsWith([]), spawner.layer, ToolDiscovery.layerTest())),
				Effect.provide(Logger.layer([])),
			),
		);

		expect(Exit.isSuccess(exit)).toBe(true);
		expect(spawner.spawns).toHaveLength(0);
	});

	it("runs biome format when biome.jsonc exists and biome is available", async () => {
		const { exit, spawner } = await run(["biome.jsonc"]);

		expect(Exit.isSuccess(exit)).toBe(true);
		expect(spawner.spawns).toHaveLength(1);
		expect(spawner.spawns[0].command).toBe("biome");
		expect(spawner.spawns[0].args).toEqual(["format", "--write", "."]);
	});

	it("also accepts biome.json as the config", async () => {
		const { exit, spawner } = await run(["biome.json"]);

		expect(Exit.isSuccess(exit)).toBe(true);
		expect(spawner.spawns).toHaveLength(1);
	});

	it("warns and continues when config exists but biome is not available", async () => {
		// Absence is now reported by the probe seam itself, not inferred from a
		// failed `--version` run. If the module wrongly proceeded, the format
		// spawn would be recorded — so the spawn count is the real assertion.
		const { exit, spawner } = await run(["biome.json"], { available: false });

		expect(Exit.isSuccess(exit)).toBe(true);
		expect(spawner.spawns).toHaveLength(0);
	});

	it("fails when biome format exits non-zero for an unrecognized reason", async () => {
		const { exit } = await run(["biome.jsonc"], { format: { exit: 1, stdout: "", stderr: "format error" } });

		expect(Exit.isFailure(exit)).toBe(true);
	});

	it("warns and continues when the biome config cannot be resolved without node_modules", async () => {
		// silk-suite repos `extends` the @savvy-web/silk/biome package, which the
		// standalone binary cannot resolve in a zero-install checkout. That exact
		// failure must warn and continue rather than fail the phase. The match is
		// on PROSE because Biome reports it no other way.
		const { exit } = await run(["biome.jsonc"], {
			format: { exit: 1, stdout: "", stderr: "Could not resolve @savvy-web/silk/biome: module not found" },
		});

		expect(Exit.isSuccess(exit)).toBe(true);
	});

	it("matches the unresolvable-config prose case-insensitively", async () => {
		const { exit } = await run(["biome.jsonc"], {
			format: { exit: 2, stdout: "", stderr: "ERROR: MODULE NOT FOUND while loading config" },
		});

		expect(Exit.isSuccess(exit)).toBe(true);
	});

	it("fails when biome cannot be spawned at all despite the probe reporting it available", async () => {
		// A disagreement between the probe and the run is a real failure, not a
		// skip: the prose test must not swallow a spawn error.
		const { exit } = await run(["biome.jsonc"], { format: ScriptedSpawner.notFound("biome") });

		expect(Exit.isFailure(exit)).toBe(true);
	});
});
