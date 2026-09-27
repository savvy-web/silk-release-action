// Tests for the snapshot phase body (`steps/snapshot.ts`).
//
// Versioning, the build and the publish loop are mocked at their module
// boundaries (each is tested in its own suite: native-version, publish). What
// is proven here is what only this step owns: the refusals, the order of the
// three stages, what reaches each seam, and that EVERY exit path emits the
// `result` output and the job summary before failing. For a partial publish,
// that ordering is the whole point.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PackageNotFoundError, WorkspaceDiscovery, WorkspacePackage } from "@effected/workspaces";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SnapshotError } from "../src/release/errors.js";
import type { PublishPackagesResult } from "../src/release/types.js";
import type { Inputs } from "../src/schema/inputs.js";

const runNativeVersionMock = vi.hoisted(() => vi.fn());
const runCiBuildMock = vi.hoisted(() => vi.fn());
const runPublishTargetsMock = vi.hoisted(() => vi.fn());

vi.mock("../src/utils/native-version.js", () => ({ runNativeVersion: runNativeVersionMock }));
vi.mock("../src/release/publish.js", () => ({ runCiBuild: runCiBuildMock, runPublishTargets: runPublishTargetsMock }));
vi.mock("../src/utils/ensure-full-history.js", () => ({ ensureFullHistory: () => Effect.void }));
vi.mock("../src/utils/detect-package-manager.js", () => ({ detectPackageManager: Effect.succeed("pnpm") }));
vi.mock("../src/utils/sort-releases-topologically.js", () => ({
	sortReleasesTopologically: (names: ReadonlyArray<string>) => Effect.succeed(names),
}));

const { ActionEnvironment, ActionLogger, ActionOutputs, ActionState, DryRun } = await import(
	"@effected/github-actions"
);
const { runSnapshot } = await import("../src/steps/snapshot.js");

const VERSION = "1.3.0-next-20260927051500";
const INPUTS = {
	releaseBranch: "changeset-release/main",
	targetBranch: "main",
	snapshotTag: Option.some("next"),
	customRegistries: [],
	npmToken: "",
} as unknown as Inputs;

const APPLIED: Changesets.AppliedRelease = {
	dryRun: false,
	touchedFiles: [],
	versionFileUpdates: [],
	releases: [{ name: "@scope/alpha", type: "minor", oldVersion: "1.2.3", newVersion: VERSION }],
};

const npmTarget = (overrides: Record<string, unknown> = {}) => ({
	target: {
		name: "@scope/alpha",
		protocol: "npm" as const,
		registry: "https://registry.npmjs.org/",
		directory: join(process.cwd(), "packages/alpha/dist/npm"),
		access: "public" as const,
		provenance: true,
		tag: "next",
		tokenEnv: null,
	},
	success: true,
	status: "published" as const,
	...overrides,
});

const PUBLISHED: PublishPackagesResult = {
	success: true,
	packages: [{ name: "@scope/alpha", version: VERSION, targets: [npmTarget()] }],
	totalPackages: 1,
	successfulPackages: 1,
	totalTargets: 1,
	successfulTargets: 1,
};

type DepKind = "dependencies" | "devDependencies" | "peerDependencies" | "optionalDependencies";

/** WorkspaceDiscovery has no kit double (a gap); every member but getPackage dies. */
const discovery = (
	paths: Record<string, string>,
	manifests: Record<string, Partial<Record<DepKind, Record<string, string>>>> = {},
) =>
	Layer.succeed(WorkspaceDiscovery, {
		info: () => Effect.die(new Error("info() not stubbed")),
		listPackages: () => Effect.die(new Error("listPackages() not stubbed")),
		getPackage: (name: string) => {
			const path = paths[name];
			return path === undefined
				? Effect.fail(new PackageNotFoundError({ name, available: Object.keys(paths) }))
				: Effect.succeed(
						WorkspacePackage.make({
							name,
							version: "1.2.3",
							path,
							packageJsonPath: `${path}/package.json`,
							relativePath: name,
							workspaceRoot: "/repo",
							...manifests[name],
						}),
					);
		},
		importerMap: () => Effect.die(new Error("importerMap() not stubbed")),
		resolveFile: () => Effect.die(new Error("resolveFile() not stubbed")),
		resolveFiles: () => Effect.die(new Error("resolveFiles() not stubbed")),
		refresh: () => Effect.void,
		infoIn: () => Effect.die(new Error("infoIn() not stubbed")),
		listPackagesIn: () => Effect.die(new Error("listPackagesIn() not stubbed")),
		refreshIn: () => Effect.void,
	});

interface RunCapture {
	readonly exit: { readonly _tag: string; readonly failure?: unknown };
	readonly result: Record<string, unknown> | undefined;
	readonly scalars: Record<string, string>;
	readonly failedWith: string[];
	readonly summaries: string[];
	/** Emission order across outputs, summary and failure, for ordering assertions. */
	readonly events: string[];
	/** Every `Warn`-level log line. */
	readonly warnings: string[];
}

const run = async (
	options: {
		inputs?: Inputs;
		ref?: string;
		dryRun?: boolean;
		paths?: Record<string, string>;
		manifests?: Record<string, Partial<Record<DepKind, Record<string, string>>>>;
	} = {},
): Promise<RunCapture> => {
	let result: Record<string, unknown> | undefined;
	const scalars: Record<string, string> = {};
	const failedWith: string[] = [];
	const summaries: string[] = [];
	const events: string[] = [];
	const warnings: string[] = [];

	const layers = Layer.mergeAll(
		Logger.layer([
			Logger.make(({ logLevel, message }) => {
				if (logLevel === "Warn") warnings.push(String(message));
			}),
		]),
		ActionEnvironment.layerTest({ GITHUB_REF: options.ref ?? "refs/heads/feat/lockfile-integrity" }),
		ActionLogger.layerTest({ group: (_name, effect) => effect }),
		ActionOutputs.layerTest({
			setJson: (name: string, value: unknown) =>
				Effect.sync(() => {
					if (name === "result") {
						result = value as Record<string, unknown>;
						events.push("result");
					}
				}),
			set: (name: string, value: string) =>
				Effect.sync(() => {
					scalars[name] = value;
				}),
			summary: (content: string) =>
				Effect.sync(() => {
					summaries.push(content);
					events.push("summary");
				}),
			setFailed: (message: string) =>
				Effect.sync(() => {
					failedWith.push(message);
					events.push("setFailed");
				}),
		}),
		ActionState.layerTest({ save: () => Effect.void }),
		DryRun.layerTest({ isDryRun: Effect.succeed(options.dryRun ?? false) }),
		discovery(options.paths ?? { "@scope/alpha": "/repo/packages/alpha" }, options.manifests),
	);

	// The mocked modules erase their real requirement channels at runtime only.
	// The cast sits at the harness boundary, as in publishing.test.ts; nothing
	// under test is cast.
	const effect = runSnapshot(options.inputs ?? INPUTS).pipe(Effect.provide(layers)) as unknown as Effect.Effect<
		void,
		unknown
	>;
	const exit = await Effect.runPromise(Effect.result(effect));
	return { exit, result, scalars, failedWith, summaries, events, warnings };
};

const failureOf = (capture: RunCapture): unknown => (capture.exit as { failure?: unknown }).failure;

beforeEach(() => {
	vi.clearAllMocks();
	runNativeVersionMock.mockReturnValue(Effect.succeed(APPLIED));
	runCiBuildMock.mockReturnValue(Effect.succeed({ ok: true }));
	runPublishTargetsMock.mockReturnValue(Effect.succeed(PUBLISHED));
});

describe("runSnapshot — refusals (nothing is versioned)", () => {
	it("refuses a run with no snapshot-tag", async () => {
		const c = await run({ inputs: { ...INPUTS, snapshotTag: Option.none() } as Inputs });

		expect(c.exit._tag).toBe("Failure");
		expect(failureOf(c)).toBeInstanceOf(SnapshotError);
		expect((failureOf(c) as SnapshotError).reason).toBe("missing-tag");
		expect(c.result?.outcome).toBe("blocked");
		expect(c.result?.failure).toEqual({ stage: "refused", reason: expect.stringMatching(/snapshot-tag is required/) });
		expect(runNativeVersionMock).not.toHaveBeenCalled();
	});

	it.each([["refs/tags/v1.0.0"], ["refs/heads/main"], ["refs/heads/changeset-release/main"], ["refs/pull/7/merge"]])(
		"refuses a dispatch on %s",
		async (ref) => {
			const c = await run({ ref });

			expect((failureOf(c) as SnapshotError).reason).toBe("ref");
			expect(c.result?.outcome).toBe("blocked");
			expect(c.scalars.succeeded).toBe("false");
			expect(runNativeVersionMock).not.toHaveBeenCalled();
		},
	);

	it("refuses, after emitting, when GITHUB_REF is not set", async () => {
		const c = await run({ ref: "" });

		expect((failureOf(c) as SnapshotError).reason).toBe("ref");
		expect(c.result?.outcome).toBe("blocked");
		expect(c.result?.failure).toEqual({ stage: "refused", reason: expect.stringMatching(/GITHUB_REF is not set/) });
		expect(c.events).toEqual(["result", "summary", "setFailed"]);
		expect(runNativeVersionMock).not.toHaveBeenCalled();
	});
});

describe("runSnapshot — stages", () => {
	it("versions with the snapshot options, builds, then publishes under the tag", async () => {
		const c = await run();

		expect(c.exit._tag).toBe("Success");
		expect(runNativeVersionMock).toHaveBeenCalledWith(process.cwd(), {
			snapshot: { tag: "next", useCalculatedVersion: true, prereleaseTemplate: "{tag}-{datetime}" },
		});
		expect(runCiBuildMock).toHaveBeenCalledWith("pnpm");
		expect(runPublishTargetsMock).toHaveBeenCalledWith(
			[{ name: "@scope/alpha", version: VERSION, path: "/repo/packages/alpha" }],
			new Map(),
			[],
			{ tag: "next", dryRun: false },
		);
		expect(c.result).toMatchObject({
			phase: "snapshot",
			success: true,
			outcome: "published",
			tag: "next",
			published: [{ name: "@scope/alpha", version: VERSION, directory: "packages/alpha/dist/npm", tag: "next" }],
		});
		expect(c.scalars).toMatchObject({
			phase: "snapshot",
			status: "published",
			succeeded: "true",
			"package-count": "1",
		});
		expect(c.summaries.join("\n")).toContain(`"@scope/alpha": "${VERSION}"`);
	});

	it("reports nothing-to-snapshot, as a success, and neither builds nor publishes, when no changesets are pending", async () => {
		runNativeVersionMock.mockReturnValue(Effect.succeed({ ...APPLIED, releases: [] }));
		const c = await run();

		expect(c.exit._tag).toBe("Success");
		expect(c.result?.outcome).toBe("nothing-to-snapshot");
		expect(c.result?.success).toBe(true);
		expect(runCiBuildMock).not.toHaveBeenCalled();
		expect(runPublishTargetsMock).not.toHaveBeenCalled();
	});

	it("fails typed at version when changesets is in pre mode, and builds nothing", async () => {
		runNativeVersionMock.mockReturnValue(
			Effect.fail(
				new Changesets.ReleasePlanError({ phase: "apply", reason: "Snapshot release is not allowed in pre mode" }),
			),
		);
		const c = await run();

		expect((failureOf(c) as SnapshotError).reason).toBe("version");
		expect(c.result?.failure).toEqual({ stage: "version", reason: expect.stringMatching(/pre mode/) });
		expect(runCiBuildMock).not.toHaveBeenCalled();
	});

	it("fails at version when a versioned package is not in the workspace", async () => {
		const c = await run({ paths: {} });

		expect((failureOf(c) as SnapshotError).reason).toBe("version");
		expect(runCiBuildMock).not.toHaveBeenCalled();
	});

	it("fails at build and publishes nothing when ci:build fails", async () => {
		runCiBuildMock.mockReturnValue(Effect.succeed({ ok: false, error: "TS2345: nope" }));
		const c = await run();

		expect((failureOf(c) as SnapshotError).reason).toBe("build");
		expect(c.result?.failure).toEqual({ stage: "build", reason: "TS2345: nope" });
		expect(runPublishTargetsMock).not.toHaveBeenCalled();
	});

	it("on a partial publish, emits the result AND the summary (with the pin line) BEFORE failing", async () => {
		runPublishTargetsMock.mockReturnValue(
			Effect.succeed({
				...PUBLISHED,
				success: false,
				successfulPackages: 0,
				totalTargets: 2,
				packages: [
					{
						name: "@scope/alpha",
						version: VERSION,
						targets: [
							npmTarget(),
							npmTarget({
								target: { ...npmTarget().target, name: "@scope/alpha-gh", registry: "https://npm.pkg.github.com/" },
								success: false,
								status: "failed",
								error: "E403",
							}),
						],
					},
				],
			}),
		);
		const c = await run();

		expect((failureOf(c) as SnapshotError).reason).toBe("publish");
		expect(c.result?.outcome).toBe("partial");
		expect(c.result?.published).toHaveLength(1);
		expect(c.summaries.join("\n")).toMatch(/pin these exact versions/i);
		expect(c.events).toEqual(["result", "summary", "setFailed"]);
	});

	it("in dry-run, hands dryRun to the publish loop and reports rehearsed", async () => {
		runPublishTargetsMock.mockReturnValue(
			Effect.succeed({
				...PUBLISHED,
				packages: [
					{
						name: "@scope/alpha",
						version: VERSION,
						targets: [npmTarget({ status: "skipped", skipReason: "dry-run" })],
					},
				],
			}),
		);
		const c = await run({ dryRun: true });

		expect(runPublishTargetsMock.mock.calls[0]?.[3]).toEqual({ tag: "next", dryRun: true });
		expect(c.result).toMatchObject({ outcome: "rehearsed", dryRun: true, published: [] });
	});
});

describe("runSnapshot — dangling internal dependencies", () => {
	const BETA_VERSION = "0.5.0-next-20260927051500";
	const twoPackages = (betaTarget: ReturnType<typeof npmTarget>): PublishPackagesResult => ({
		...PUBLISHED,
		totalPackages: 2,
		totalTargets: 2,
		packages: [
			{ name: "@scope/beta", version: BETA_VERSION, targets: [betaTarget] },
			{ name: "@scope/alpha", version: VERSION, targets: [npmTarget()] },
		],
	});
	const betaTarget = (overrides: Record<string, unknown> = {}) =>
		npmTarget({
			target: { ...npmTarget().target, name: "@scope/beta", directory: join(process.cwd(), "packages/beta/dist/npm") },
			...overrides,
		});
	const paths = { "@scope/alpha": "/repo/packages/alpha", "@scope/beta": "/repo/packages/beta" };

	beforeEach(() => {
		runNativeVersionMock.mockReturnValue(
			Effect.succeed({
				...APPLIED,
				releases: [
					...APPLIED.releases,
					{ name: "@scope/beta", type: "minor", oldVersion: "0.4.0", newVersion: BETA_VERSION },
				],
			}),
		);
	});

	it("warns and adds a summary section when a published package depends on a never-published sibling, without failing", async () => {
		runPublishTargetsMock.mockReturnValue(
			Effect.succeed(twoPackages(betaTarget({ status: "skipped", skipReason: "never-published" }))),
		);
		const c = await run({ paths, manifests: { "@scope/alpha": { dependencies: { "@scope/beta": "workspace:*" } } } });

		expect(c.exit._tag).toBe("Success");
		expect(c.result).toMatchObject({ success: true, outcome: "published" });
		expect(c.result).not.toHaveProperty("dangling");
		expect(c.warnings).toHaveLength(1);
		expect(c.warnings[0]).toContain(`@scope/alpha@${VERSION}`);
		expect(c.warnings[0]).toContain(`@scope/beta@${BETA_VERSION}`);
		const summary = c.summaries.join("\n");
		expect(summary).toContain("Dangling dependencies");
		expect(summary).toContain(`| \`@scope/alpha\` | \`@scope/beta\` | \`${BETA_VERSION}\` |`);
	});

	it("reports no dangling dependency when every bumped internal dependency was published", async () => {
		runPublishTargetsMock.mockReturnValue(Effect.succeed(twoPackages(betaTarget())));
		const c = await run({ paths, manifests: { "@scope/alpha": { dependencies: { "@scope/beta": "workspace:*" } } } });

		expect(c.exit._tag).toBe("Success");
		expect(c.warnings).toEqual([]);
		expect(c.summaries.join("\n")).not.toContain("Dangling dependencies");
	});

	it("ignores a devDependency on an unpublished sibling: a consumer never installs it", async () => {
		runPublishTargetsMock.mockReturnValue(
			Effect.succeed(twoPackages(betaTarget({ status: "skipped", skipReason: "never-published" }))),
		);
		const c = await run({
			paths,
			manifests: { "@scope/alpha": { devDependencies: { "@scope/beta": "workspace:*" } } },
		});

		expect(c.warnings).toEqual([]);
		expect(c.summaries.join("\n")).not.toContain("Dangling dependencies");
	});
});

describe("steps/snapshot.ts — what a snapshot never touches (source scan)", () => {
	it("imports no tag, release, PR, issue, SBOM, attestation or commit machinery", () => {
		const source = readFileSync(join(process.cwd(), "src", "steps", "snapshot.ts"), "utf8");
		for (const forbidden of [
			"releases.js",
			"close-linked-issues",
			"attest-helpers",
			"runBuildAndSbom",
			"GitTag",
			"GitHubRelease",
			"PullRequest",
			"GitCommit",
			"@effected/sbom",
			// Narrowed from `.push(`: the step pushes onto a local array
			// (`missing.push`), which is not a git push.
			"git.push(",
		]) {
			expect(source, `snapshot.ts must not reference ${forbidden}`).not.toContain(forbidden);
		}
	});
});
