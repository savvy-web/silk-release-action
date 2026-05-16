/**
 * Fixture tests for the detect-publishable-changes stage.
 *
 * @remarks
 * Drives `detectPublishableChanges` end-to-end through library test
 * layers + a tmp working directory. The `changeset status` CommandRunner
 * mock writes a canned JSON file at the temp path the implementation
 * provides via `--output`; the production code then reads it through the
 * real NodeFileSystem layer.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import type { CommandRunnerError } from "@savvy-web/github-action-effects";
import { CommandRunner } from "@savvy-web/github-action-effects";
import type { ActionOutputsTestState, CheckRunTestState } from "@savvy-web/github-action-effects/testing";
import { ActionOutputsTest, CheckRunTest } from "@savvy-web/github-action-effects/testing";
import { Effect, Layer, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectPublishableChanges } from "../src/utils/detect-publishable-changes.js";

interface Fixtures {
	outputsState: ActionOutputsTestState;
	checkRunState: CheckRunTestState;
	tmpDir: string;
	originalCwd: string;
}

/**
 * CommandRunner mock that writes `statusContent` to the `--output` path
 * found in the args (matching the changeset CLI's contract).
 */
const makeCommandRunnerLayer = (statusContent: string | null, stderr = "", exitCode = 0): Layer.Layer<CommandRunner> =>
	Layer.succeed(CommandRunner, {
		exec: () => Effect.succeed(exitCode),
		execCapture: (_cmd: string, args: ReadonlyArray<string> = []) => {
			const outIdx = args.indexOf("--output");
			if (statusContent !== null && outIdx >= 0 && args[outIdx + 1]) {
				writeFileSync(args[outIdx + 1], statusContent);
			}
			if (exitCode === 0) {
				return Effect.succeed({ exitCode, stdout: "", stderr });
			}
			return Effect.fail({
				_tag: "CommandRunnerError",
				command: _cmd,
				args,
				exitCode,
				stdout: "",
				stderr,
				reason: "non-zero exit",
				retryable: false,
			} as unknown as CommandRunnerError);
		},
		execJson: () => Effect.die("execJson not used in detect-publishable-changes"),
		execLines: () => Effect.die("execLines not used in detect-publishable-changes"),
		// biome-ignore lint/suspicious/noExplicitAny: test stub type erasure
	} as any);

const writeRootPackageJson = (dir: string, contents: object): void => {
	writeFileSync(join(dir, "package.json"), JSON.stringify(contents, null, 2));
};

const setupFixtures = (): Fixtures => {
	const tmpDir = mkdtempSync(join(tmpdir(), "detect-publishable-"));
	const originalCwd = process.cwd();
	process.chdir(tmpDir);
	return {
		outputsState: ActionOutputsTest.empty(),
		checkRunState: CheckRunTest.empty(),
		tmpDir,
		originalCwd,
	};
};

const teardownFixtures = (f: Fixtures): void => {
	process.chdir(f.originalCwd);
	rmSync(f.tmpDir, { recursive: true, force: true });
};

const runStage = (
	packageManager: string,
	dryRun: boolean,
	f: Fixtures,
	commandLayer: Layer.Layer<CommandRunner>,
): Promise<{
	hasChanges: boolean;
	packages: ReadonlyArray<{ name: string; type: string }>;
	versionOnlyPackages: ReadonlyArray<{ name: string; type: string }>;
	checkId: number;
}> => {
	const layer = Layer.mergeAll(
		ActionOutputsTest.layer(f.outputsState),
		CheckRunTest.layer(f.checkRunState),
		commandLayer,
		NodeFileSystem.layer,
	);
	return Effect.runPromise(
		detectPublishableChanges(packageManager, dryRun).pipe(
			Effect.provide(layer),
			Effect.provide(Logger.replace(Logger.defaultLogger, Logger.none)),
		),
	) as Promise<{
		hasChanges: boolean;
		packages: ReadonlyArray<{ name: string; type: string }>;
		versionOnlyPackages: ReadonlyArray<{ name: string; type: string }>;
		checkId: number;
	}>;
};

describe("detectPublishableChanges", () => {
	let fixtures: Fixtures;

	beforeEach(() => {
		fixtures = setupFixtures();
	});

	afterEach(() => {
		teardownFixtures(fixtures);
	});

	it("returns no changes when changeset status reports no releases", async () => {
		writeRootPackageJson(fixtures.tmpDir, { name: "@test/pkg", private: true });
		const cmd = makeCommandRunnerLayer(JSON.stringify({ releases: [], changesets: [] }));

		const result = await runStage("pnpm", false, fixtures, cmd);

		expect(result.hasChanges).toBe(false);
		expect(result.packages).toEqual([]);
		expect(result.versionOnlyPackages).toEqual([]);
		expect(fixtures.checkRunState.runs).toHaveLength(1);
	});

	it("classifies a public package with changes as publishable", async () => {
		writeRootPackageJson(fixtures.tmpDir, { name: "@test/pkg", publishConfig: { access: "public" } });
		const status = {
			releases: [{ name: "@test/pkg", oldVersion: "0.0.0", newVersion: "0.1.0", type: "minor" }],
			changesets: [{ id: "c1", summary: "feat", releases: [{ name: "@test/pkg", type: "minor" }] }],
		};
		const cmd = makeCommandRunnerLayer(JSON.stringify(status));

		const result = await runStage("pnpm", false, fixtures, cmd);

		expect(result.hasChanges).toBe(true);
		expect(result.packages).toHaveLength(1);
		expect(result.packages[0].name).toBe("@test/pkg");
		expect(result.versionOnlyPackages).toEqual([]);
	});

	it("classifies private+no-publishConfig as version-only", async () => {
		writeRootPackageJson(fixtures.tmpDir, { name: "@test/pkg", private: true });
		const status = {
			releases: [],
			changesets: [{ id: "c1", summary: "feat", releases: [{ name: "@test/pkg", type: "minor" }] }],
		};
		const cmd = makeCommandRunnerLayer(JSON.stringify(status));

		const result = await runStage("pnpm", false, fixtures, cmd);

		expect(result.hasChanges).toBe(true);
		expect(result.packages).toEqual([]);
		expect(result.versionOnlyPackages).toHaveLength(1);
		expect(result.versionOnlyPackages[0].name).toBe("@test/pkg");
	});

	it("treats private+publishConfig.targets as publishable under silk rules", async () => {
		writeRootPackageJson(fixtures.tmpDir, {
			name: "@test/pkg",
			private: true,
			publishConfig: { access: "restricted", targets: ["npm", "github"] },
		});
		const status = {
			releases: [],
			changesets: [{ id: "c1", summary: "feat", releases: [{ name: "@test/pkg", type: "minor" }] }],
		};
		const cmd = makeCommandRunnerLayer(JSON.stringify(status));

		const result = await runStage("pnpm", false, fixtures, cmd);

		expect(result.hasChanges).toBe(true);
		expect(result.packages).toHaveLength(1);
		expect(result.versionOnlyPackages).toEqual([]);
	});

	it("skips releases with type 'none'", async () => {
		writeRootPackageJson(fixtures.tmpDir, { name: "@test/pkg", publishConfig: { access: "public" } });
		const status = {
			releases: [{ name: "@test/pkg", oldVersion: "1.0.0", newVersion: "1.0.0", type: "none" }],
			changesets: [],
		};
		const cmd = makeCommandRunnerLayer(JSON.stringify(status));

		const result = await runStage("pnpm", false, fixtures, cmd);

		expect(result.hasChanges).toBe(false);
		expect(result.packages).toEqual([]);
	});

	it("flags dry-run mode in the Check Run title", async () => {
		writeRootPackageJson(fixtures.tmpDir, { name: "@test/pkg", publishConfig: { access: "public" } });
		const cmd = makeCommandRunnerLayer(JSON.stringify({ releases: [], changesets: [] }));

		await runStage("pnpm", true, fixtures, cmd);

		expect(fixtures.checkRunState.runs[0].name).toContain("Dry Run");
	});

	it("fails on a Changeset ValidationError", async () => {
		writeRootPackageJson(fixtures.tmpDir, { name: "@test/pkg" });
		const stderr =
			'🦋  error The package "@test/pkg" depends on the ignored package "@scope/x", but "@test/pkg" is not being ignored.\nValidationError';
		const cmd = makeCommandRunnerLayer(null, stderr, 1);

		await expect(runStage("pnpm", false, fixtures, cmd)).rejects.toThrow(/Changeset configuration is invalid/);
	});
});
