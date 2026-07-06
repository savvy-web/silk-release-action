import { FileSystem } from "@effect/platform";
import { CommandRunnerTest } from "@savvy-web/github-action-effects/testing";
import { Effect, Exit, Layer, Logger } from "effect";
import { describe, expect, it } from "vitest";
import { formatWorkspaceWithBiome } from "../src/utils/format-workspace.js";

const run = (
	fsLayer: Layer.Layer<FileSystem.FileSystem>,
	commands: Map<string, { exitCode: number; stdout: string; stderr: string }>,
) =>
	Effect.runPromiseExit(
		formatWorkspaceWithBiome().pipe(
			Effect.provide(Layer.mergeAll(fsLayer, CommandRunnerTest.layer(commands))),
			Effect.provide(Logger.replace(Logger.defaultLogger, Logger.none)),
		),
	);

const fsWith = (files: string[]) =>
	FileSystem.layerNoop({ exists: (path) => Effect.succeed(files.some((f) => path.endsWith(f))) });

describe("formatWorkspaceWithBiome", () => {
	it("is a no-op when no biome config exists", async () => {
		// Any CommandRunner call in the no-op path would now fail the effect, so the success
		// assertion genuinely pins that no commands are run when no biome config exists.
		const commands = new Map([
			["biome --version", { exitCode: 1, stdout: "", stderr: "must not run" }],
			["biome format --write .", { exitCode: 1, stdout: "", stderr: "must not run" }],
		]);
		const exit = await run(fsWith([]), commands);
		expect(Exit.isSuccess(exit)).toBe(true);
	});

	it("runs biome format when biome.jsonc exists and biome is on PATH", async () => {
		const commands = new Map([
			["biome --version", { exitCode: 0, stdout: "Version: 2.3.14", stderr: "" }],
			["biome format --write .", { exitCode: 0, stdout: "", stderr: "" }],
		]);
		const exit = await run(fsWith(["biome.jsonc"]), commands);
		expect(Exit.isSuccess(exit)).toBe(true);
	});

	it("warns and continues when config exists but biome is not on PATH", async () => {
		// CommandRunnerTest.layer falls back to a default SUCCESS response
		// (exitCode 0) for any command key not registered in the Map — an
		// unregistered command does NOT fail. To genuinely simulate "biome not
		// on PATH" we register `biome --version` itself with a non-zero
		// exitCode: `execCapture` turns a registered non-zero exitCode into a
		// failed `CommandRunnerError`, which is exactly what the production
		// probe's `Effect.either` needs to observe as a Left.
		const commands = new Map([
			["biome --version", { exitCode: 127, stdout: "", stderr: "command not found: biome" }],
			// If production erroneously proceeded past the failed probe and ran the format command,
			// the registered non-zero exit would fail the effect, flipping the success assertion to false.
			["biome format --write .", { exitCode: 1, stdout: "", stderr: "must not run" }],
		]);
		const exit = await run(fsWith(["biome.json"]), commands);
		expect(Exit.isSuccess(exit)).toBe(true);
	});

	it("fails when biome format exits non-zero", async () => {
		const commands = new Map([
			["biome --version", { exitCode: 0, stdout: "Version: 2.3.14", stderr: "" }],
			["biome format --write .", { exitCode: 1, stdout: "", stderr: "format error" }],
		]);
		const exit = await run(fsWith(["biome.jsonc"]), commands);
		expect(Exit.isFailure(exit)).toBe(true);
	});

	it("warns and continues when the biome config cannot be resolved without node_modules", async () => {
		// silk-suite repos `extends` the @savvy-web/silk/biome package, which the
		// standalone binary cannot resolve in a zero-install checkout. That exact
		// failure must warn and continue rather than fail the phase.
		const commands = new Map([
			["biome --version", { exitCode: 0, stdout: "Version: 2.5.1", stderr: "" }],
			[
				"biome format --write .",
				{ exitCode: 1, stdout: "", stderr: "Could not resolve @savvy-web/silk/biome: module not found" },
			],
		]);
		const exit = await run(fsWith(["biome.jsonc"]), commands);
		expect(Exit.isSuccess(exit)).toBe(true);
	});
});
