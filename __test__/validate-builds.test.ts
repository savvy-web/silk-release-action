/**
 * Fixture tests for the validate-builds stage.
 *
 * @remarks
 * Exercises the paths through `validateBuilds`: a successful build, a build
 * that exits 0 but emits TypeScript errors on stderr, a spawn failure, dry-run,
 * and the turbo-summary side path.
 *
 * The subprocess seam is `ScriptedSpawner`, which answers core's
 * `ChildProcessSpawner` from a script and records every spawn. Unlike the
 * predecessor's `CommandRunnerTest` — which silently returned `{ exitCode: 0 }`
 * for ANY unregistered command — an unexpected command here is visible: the
 * script decides, and `spawner.spawns` is asserted on directly, so the argv the
 * package-script table produces is actually pinned.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import type { ScriptResult } from "@effected/commands";
import { ScriptedSpawner } from "@effected/commands";
import type { CheckRunOutput } from "@effected/github";
import { CheckRun, CheckRunRef, Repo, RepoRef } from "@effected/github";
import { ActionEnvironment, ActionOutputs } from "@effected/github-actions";
import { ConfigProvider, Effect, Layer, Logger } from "effect";
import { describe, expect, it } from "vitest";
import type { BuildValidationResult } from "../src/utils/validate-builds.js";
import { validateBuilds } from "../src/utils/validate-builds.js";

interface CompletedCheck {
	conclusion: string;
	output: CheckRunOutput | undefined;
}

interface Fixtures {
	created: Array<{ name: string; headSha: string }>;
	completed: CompletedCheck[];
	summaries: string[];
}

const makeFixtures = (): Fixtures => ({ created: [], completed: [], summaries: [] });

const ENV = {
	GITHUB_SHA: "abc123",
	GITHUB_REF: "refs/heads/main",
	GITHUB_REPOSITORY: "owner/repo",
	GITHUB_REPOSITORY_OWNER: "owner",
	GITHUB_WORKSPACE: "/workspace",
	GITHUB_EVENT_NAME: "push",
	GITHUB_EVENT_PATH: "",
	GITHUB_RUN_ID: "1",
	GITHUB_RUN_NUMBER: "1",
	GITHUB_ACTOR: "test",
	GITHUB_SERVER_URL: "https://github.com",
	GITHUB_API_URL: "https://api.github.com",
};

const githubLayers = (f: Fixtures): Layer.Layer<ActionEnvironment | ActionOutputs | CheckRun | Repo> =>
	Layer.mergeAll(
		ActionEnvironment.layerTest(ENV),
		ActionOutputs.layerTest({
			summary: (content) =>
				Effect.sync(() => {
					f.summaries.push(content);
				}),
		}),
		CheckRun.layerTest({
			create: (name, headSha) =>
				Effect.sync(() => {
					f.created.push({ name, headSha });
					return CheckRunRef.make({
						id: 77,
						name,
						url: "https://github.com/owner/repo/runs/77",
						status: "in_progress",
					});
				}),
			complete: (_id, conclusion, output) =>
				Effect.sync(() => {
					f.completed.push({ conclusion, output });
				}),
		}),
		Layer.succeed(Repo, RepoRef.make({ owner: "owner", repo: "repo" })),
	);

interface RunOpts {
	/** Answers the build spawn. Defaults to a clean exit 0. */
	script?: (command: string, args: ReadonlyArray<string>) => ScriptResult;
	dryRun?: boolean;
}

const runStage = async (
	f: Fixtures,
	opts: RunOpts = {},
): Promise<{ result: BuildValidationResult; spawner: ScriptedSpawner }> => {
	const spawner = ScriptedSpawner.make(opts.script ?? (() => ({ exit: 0, stdout: "", stderr: "" })));
	const config = ConfigProvider.fromUnknown({
		"build-command": "",
		"dry-run": opts.dryRun === true ? "true" : "false",
	});
	const result = await Effect.runPromise(
		validateBuilds("pnpm").pipe(
			Effect.provide(Layer.mergeAll(githubLayers(f), spawner.layer, NodeFileSystem.layer)),
			Effect.provide(Logger.layer([])),
			Effect.provide(ConfigProvider.layer(config)),
		),
	);
	return { result, spawner };
};

const outputOf = (f: Fixtures): CheckRunOutput => {
	const output = f.completed[0]?.output;
	if (output === undefined) throw new Error("no check run was completed");
	return output;
};

describe("validateBuilds", () => {
	it("records a success check run when the build command succeeds", async () => {
		const f = makeFixtures();

		const { result } = await runStage(f, { script: () => ({ exit: 0, stdout: "Build complete\n", stderr: "" }) });

		expect(result.success).toBe(true);
		expect(f.created).toHaveLength(1);
		expect(f.created[0].name).toBe("Build Validation");
		expect(f.created[0].headSha).toBe("abc123");
		expect(f.completed[0].conclusion).toBe("success");
	});

	it("spawns the package-script argv the package-manager table produces", async () => {
		// This is what `LocalExec.prefixes` does NOT give: `pnpm ci:build` is a
		// package SCRIPT, not `pnpm exec <binary>`.
		const f = makeFixtures();

		const { spawner } = await runStage(f, { script: () => ({ exit: 0 }) });

		expect(spawner.spawns).toHaveLength(1);
		expect(spawner.spawns[0].command).toBe("pnpm");
		expect(spawner.spawns[0].args).toEqual(["ci:build"]);
	});

	it("records a failure check run with annotations when the build emits TS errors", async () => {
		const f = makeFixtures();

		// Exit 0, but stderr matches the TypeScript error pattern — `success`
		// flips to false because `buildError.includes("error")` is true.
		const tsErrors =
			"src/foo.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'.\n" +
			"src/bar.ts:20:3 - error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.\n";

		const { result } = await runStage(f, { script: () => ({ exit: 0, stdout: "", stderr: tsErrors }) });

		expect(result.success).toBe(false);
		expect(f.completed[0].conclusion).toBe("failure");
		const output = outputOf(f);
		expect(output.annotations).toBeDefined();
		expect((output.annotations ?? []).length).toBe(2);
		// `Annotation` uses camelCase; the snake_case wire mapping is the kit's job.
		expect(output.annotations?.[0].path).toBe("src/foo.ts");
		expect(output.annotations?.[0].startLine).toBe(10);
		expect(output.annotations?.[0].endLine).toBe(10);
		expect(output.annotations?.[0].level).toBe("failure");
	});

	it("treats a non-zero exit as a result, not an error", async () => {
		const f = makeFixtures();

		// `Run.collect` returns a CommandOutput for a non-zero exit rather than
		// failing — the same split the predecessor's `execCapture` had.
		const { result } = await runStage(f, { script: () => ({ exit: 2, stdout: "", stderr: "" }) });

		expect(result.success).toBe(false);
		expect(f.completed[0].conclusion).toBe("failure");
	});

	it("reports a spawn failure as a failed build rather than propagating it", async () => {
		const f = makeFixtures();

		// The predecessor's CommandRunnerTest could not reach this path at all:
		// it defaulted every unregistered command to exit 0.
		const { result } = await runStage(f, { script: (command) => ScriptedSpawner.notFound(command) });

		expect(result.success).toBe(false);
		expect(result.errors).not.toBe("");
		expect(f.completed[0].conclusion).toBe("failure");
	});

	it("records a dry-run check run with the dry-run title and spawns nothing", async () => {
		const f = makeFixtures();

		const { spawner } = await runStage(f, { dryRun: true });

		expect(f.created).toHaveLength(1);
		expect(f.created[0].name).toContain("Dry Run");
		expect(f.completed[0].conclusion).toBe("success");
		expect(spawner.spawns).toHaveLength(0);
	});

	it("hands annotations to the kit unsliced, leaving the 50-cap to CheckRunOutput.truncated()", async () => {
		const f = makeFixtures();
		// 60 distinct TS errors — over `CheckRunOutput.MAX_ANNOTATIONS`.
		const many = Array.from(
			{ length: 60 },
			(_, i) => `src/f${i}.ts:${i + 1}:1 - error TS2322: bad thing number ${i}.`,
		).join("\n");

		const origWrite = process.stderr.write.bind(process.stderr);
		(process.stderr.write as unknown) = () => true;
		try {
			await runStage(f, { script: () => ({ exit: 0, stdout: "", stderr: `${many}\n` }) });
		} finally {
			process.stderr.write = origWrite;
		}

		// Slicing here would be redundant — the kit slices in `wireOutput`.
		expect((outputOf(f).annotations ?? []).length).toBe(60);
	});

	it("hands the summary to the kit uncapped", async () => {
		const f = makeFixtures();
		// The rendered summary has to clear GitHub's 65535-byte limit, and
		// `errorSummary` keeps only the first 20 matching lines — so the bulk must
		// come from line LENGTH as well as count.
		//
		// 20 medium lines rather than one enormous one, deliberately:
		// `parseAnnotations`' TypeScript pattern is QUADRATIC in the length of a
		// single line (`[^\s:]+\.tsx?` backtracks across the whole token at every
		// start offset), so one 90KB line costs ~5s while 20×3.4KB costs ~0.1s for
		// the same summary size. See the finding filed against `parseAnnotations`.
		const huge = Array.from({ length: 20 }, () => `error: ${"y".repeat(3_400)}`).join("\n");

		// `validateBuilds` echoes the build's stderr straight to the real stream;
		// swallow it here so the fixture does not dump 90KB into the test report.
		const origWrite = process.stderr.write.bind(process.stderr);
		(process.stderr.write as unknown) = () => true;
		try {
			await runStage(f, { script: () => ({ exit: 1, stdout: "", stderr: huge }) });
		} finally {
			process.stderr.write = origWrite;
		}

		const summary = outputOf(f).summary;
		expect(Buffer.byteLength(summary, "utf8")).toBeGreaterThan(65_535);
		expect(summary).not.toContain("truncated (exceeded GitHub's 65535-byte check limit)");
	});

	it("includes a Turbo Cache section in the check summary when turbo summaries exist", async () => {
		// Scratch fixture with a turbo-summarize build script and a valid
		// .turbo/runs/run.json, so validateBuilds exercises the turbo path all the
		// way through emitConciseMarker -> renderTurboCacheSection -> checkSections.
		const scratchDir = mkdtempSync(join(tmpdir(), "vb-turbo-"));
		const originalCwd = process.cwd();
		try {
			writeFileSync(
				join(scratchDir, "package.json"),
				JSON.stringify({ scripts: { "ci:build": "turbo run build --summarize" } }),
			);
			mkdirSync(join(scratchDir, ".turbo", "runs"), { recursive: true });
			writeFileSync(
				join(scratchDir, ".turbo", "runs", "run.json"),
				JSON.stringify({
					execution: { command: "turbo run build", attempted: 1, cached: 1, failed: 0 },
					tasks: [{ taskId: "a#build", cache: { status: "HIT", source: "REMOTE", timeSaved: 100 } }],
				}),
			);
			process.chdir(scratchDir);

			const f = makeFixtures();
			const { result } = await runStage(f, { script: () => ({ exit: 0, stdout: "Build complete\n", stderr: "" }) });

			// Build validation itself is unaffected — the turbo path is non-fatal.
			expect(result.success).toBe(true);
			expect(outputOf(f).summary).toContain("Turbo Cache");
		} finally {
			process.chdir(originalCwd);
			rmSync(scratchDir, { recursive: true, force: true });
		}
	});
});
