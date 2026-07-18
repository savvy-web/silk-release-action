/**
 * Fixture tests for the validate-builds stage.
 *
 * @remarks
 * Exercises the two main paths through `validateBuilds`: a successful build
 * (build command exits 0, no error text in stderr) and a failed build (exit 0
 * but stderr contains TypeScript error messages the parser turns into
 * annotations). Both paths are driven through the `CommandRunnerTest` layer
 * so no real build is executed.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import type { ActionOutputsTestState, CheckRunTestState } from "@savvy-web/github-action-effects/testing";
import {
	ActionEnvironmentTest,
	ActionOutputsTest,
	CheckRunTest,
	CommandRunnerTest,
} from "@savvy-web/github-action-effects/testing";
import { ConfigProvider, Effect, Layer, Logger } from "effect";
import { describe, expect, it } from "vitest";
import type { BuildValidationResult } from "../src/utils/validate-builds.js";
import { validateBuilds } from "../src/utils/validate-builds.js";

interface Fixtures {
	outputsState: ActionOutputsTestState;
	checkRunState: CheckRunTestState;
}

const makeFixtures = (): Fixtures => ({
	outputsState: ActionOutputsTest.empty(),
	checkRunState: CheckRunTest.empty(),
});

/**
 * Run `validateBuilds` against the given fixtures.
 *
 * @remarks
 * `commandResponses` keys are `"<command> <args...>"`. An unregistered command
 * falls back to exit 0 with empty output (the `CommandRunnerTest` default).
 * The `build-command` config defaults to `""` so the invocation key is
 * `"pnpm ci:build"` when package manager is `"pnpm"`.
 */
const runStage = (
	f: Fixtures,
	commandResponses: Array<[string, { exitCode: number; stdout: string; stderr: string }]> = [],
): Promise<BuildValidationResult> => {
	const layer = Layer.mergeAll(
		ActionEnvironmentTest.layer({
			GITHUB_SHA: "abc123",
			GITHUB_REF: "refs/heads/main",
			GITHUB_REPOSITORY: "owner/repo",
			GITHUB_REPOSITORY_OWNER: "owner",
			GITHUB_WORKSPACE: "/workspace",
			GITHUB_EVENT_NAME: "push",
			GITHUB_EVENT_PATH: "/dev/null",
			GITHUB_RUN_ID: "1",
			GITHUB_RUN_NUMBER: "1",
			GITHUB_ACTOR: "test",
			GITHUB_SERVER_URL: "https://github.com",
			GITHUB_API_URL: "https://api.github.com",
		}),
		ActionOutputsTest.layer(f.outputsState),
		CheckRunTest.layer(f.checkRunState),
		CommandRunnerTest.layer(new Map(commandResponses)),
		NodeFileSystem.layer,
	);
	const config = ConfigProvider.fromUnknown({
		"build-command": "",
		"dry-run": "false",
	});
	return Effect.runPromise(
		validateBuilds("pnpm").pipe(
			Effect.provide(layer),
			Effect.provide(Logger.layer([])),
			Effect.provide(ConfigProvider.layer(config)),
		),
	);
};

describe("validateBuilds", () => {
	it("records a success check run when the build command succeeds", async () => {
		const f = makeFixtures();

		// The `pnpm ci:build` command succeeds (exit 0, empty stderr) — the
		// CommandRunnerTest default applies when the key is not registered,
		// but we register explicitly for clarity.
		const result = await runStage(f, [["pnpm ci:build", { exitCode: 0, stdout: "Build complete\n", stderr: "" }]]);

		expect(result.success).toBe(true);
		expect(f.checkRunState.runs).toHaveLength(1);
		const run = f.checkRunState.runs[0];
		expect(run.name).toBe("Build Validation");
		expect(run.status).toBe("completed");
		expect(run.conclusion).toBe("success");
	});

	it("records a failure check run with annotations when the build emits TS errors", async () => {
		const f = makeFixtures();

		// Provide stderr that matches the TypeScript error pattern so
		// `parseAnnotations` produces at least one annotation entry.
		// Exit code 0 — `execCapture` succeeds, `success` flips to false
		// because `buildError.includes("error")` is true.
		const tsErrors =
			"src/foo.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'.\n" +
			"src/bar.ts:20:3 - error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.\n";

		const result = await runStage(f, [["pnpm ci:build", { exitCode: 0, stdout: "", stderr: tsErrors }]]);

		expect(result.success).toBe(false);
		expect(f.checkRunState.runs).toHaveLength(1);
		const run = f.checkRunState.runs[0];
		expect(run.name).toBe("Build Validation");
		expect(run.status).toBe("completed");
		expect(run.conclusion).toBe("failure");
		// The completed output should carry the parsed annotations.
		expect(run.outputs).toHaveLength(1);
		const output = run.outputs[0];
		expect(output.annotations).toBeDefined();
		expect((output.annotations ?? []).length).toBeGreaterThan(0);
	});

	it("records a dry-run check run with the dry-run title", async () => {
		const f = makeFixtures();

		const layer = Layer.mergeAll(
			ActionEnvironmentTest.layer({
				GITHUB_SHA: "abc123",
				GITHUB_REF: "refs/heads/main",
				GITHUB_REPOSITORY: "owner/repo",
				GITHUB_REPOSITORY_OWNER: "owner",
				GITHUB_WORKSPACE: "/workspace",
				GITHUB_EVENT_NAME: "push",
				GITHUB_EVENT_PATH: "/dev/null",
				GITHUB_RUN_ID: "1",
				GITHUB_RUN_NUMBER: "1",
				GITHUB_ACTOR: "test",
				GITHUB_SERVER_URL: "https://github.com",
				GITHUB_API_URL: "https://api.github.com",
			}),
			ActionOutputsTest.layer(f.outputsState),
			CheckRunTest.layer(f.checkRunState),
			CommandRunnerTest.empty(),
			NodeFileSystem.layer,
		);
		const config = ConfigProvider.fromUnknown({
			"build-command": "",
			"dry-run": "true",
		});

		await Effect.runPromise(
			validateBuilds("pnpm").pipe(
				Effect.provide(layer),
				Effect.provide(Logger.layer([])),
				Effect.provide(ConfigProvider.layer(config)),
			),
		);

		expect(f.checkRunState.runs).toHaveLength(1);
		expect(f.checkRunState.runs[0].name).toContain("Dry Run");
		expect(f.checkRunState.runs[0].conclusion).toBe("success");
	});

	it("includes a Turbo Cache section in the check summary and resolves non-fatally when turbo summaries exist", async () => {
		// Set up a scratch fixture directory with a turbo-summarize build and a
		// valid .turbo/runs/run.json summary so validateBuilds exercises the turbo
		// path all the way through emitConciseMarker → renderTurboCacheSection →
		// checkSections push.
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
			// chdir so process.cwd() in validateBuilds resolves to our scratch dir.
			process.chdir(scratchDir);

			const f = makeFixtures();
			const result = await runStage(f, [["pnpm ci:build", { exitCode: 0, stdout: "Build complete\n", stderr: "" }]]);

			// Build validation itself is unaffected.
			expect(result.success).toBe(true);

			// The completed check run summary should contain the "Turbo Cache" heading.
			expect(f.checkRunState.runs).toHaveLength(1);
			const output = f.checkRunState.runs[0].outputs[0];
			expect(output?.summary).toContain("Turbo Cache");
		} finally {
			process.chdir(originalCwd);
			rmSync(scratchDir, { recursive: true, force: true });
		}
	});
});
