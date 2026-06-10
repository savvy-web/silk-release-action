/**
 * Unit tests for tarMetaFolder — the meta bundle archiver.
 *
 * @module release/meta-archive.test
 */

import { CommandRunner, CommandRunnerError } from "@savvy-web/github-action-effects";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { tarMetaFolder } from "./meta-archive.js";

describe("tarMetaFolder", () => {
	it("invokes tar -czf with the meta folder as the archive root", async () => {
		const calls: Array<{ cmd: string; args: string[] }> = [];

		const RunnerTest = Layer.succeed(
			CommandRunner,
			CommandRunner.of({
				exec: (command: string, args: ReadonlyArray<string> = []) =>
					Effect.fail(
						new CommandRunnerError({ command, args: [...args], exitCode: 1, stderr: "", reason: "not implemented" }),
					),
				execCapture: (command: string, args: ReadonlyArray<string> = []) =>
					Effect.sync(() => {
						calls.push({ cmd: command, args: [...args] });
						return { exitCode: 0, stdout: "", stderr: "" };
					}),
				execJson: <A, _I>(command: string, args: ReadonlyArray<string> = []) =>
					Effect.fail(
						new CommandRunnerError({ command, args: [...args], exitCode: 1, stderr: "", reason: "not implemented" }),
					) as Effect.Effect<A, CommandRunnerError>,
				execLines: (command: string, args: ReadonlyArray<string> = []) =>
					Effect.fail(
						new CommandRunnerError({ command, args: [...args], exitCode: 1, stderr: "", reason: "not implemented" }),
					),
			}),
		);

		await Effect.runPromise(
			tarMetaFolder("/repo/pkg/dist/prod/npm/meta", "/tmp/out.meta.tgz").pipe(Effect.provide(RunnerTest)),
		);
		expect(calls[0]?.cmd).toBe("tar");
		expect(calls[0]?.args).toEqual(["-czf", "/tmp/out.meta.tgz", "-C", "/repo/pkg/dist/prod/npm", "meta"]);
	});
});
