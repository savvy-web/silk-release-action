// Tests for the Phase-3 orchestrator's DEFERRED FAILURE posture.
//
// The subject is `steps/publishing.ts`'s ordering contract, not the publish or
// release work itself — `release/publish.ts` and `release/releases.ts` are
// mocked at the module boundary and separately tested.
//
// What is proven here is the one thing a type cannot state: that when
// `runReleases` fails, the phase
//
//   1. keeps going (close-linked-issues still runs),
//   2. still EMITS OUTPUTS describing what actually published, and only THEN
//   3. fails the effect, with a message carrying the re-run contract.
//
// Ordering is the whole design: failing at the failure site would skip (3), and
// a consumer reading `result` could not tell which packages reached a registry.
// Every assertion below is written so that reverting the failure to a swallow,
// or hoisting it above `emitPublishing`, turns a test red.

import { Repo, RepoRef } from "@effected/github";
import { NpmRegistry, PublishedVersion } from "@effected/npm";
import { Effect, Layer, Logger, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReleasesError } from "../src/release/errors.js";
import type { PublishPackagesResult } from "../src/release/types.js";
import type { Inputs } from "../src/schema/inputs.js";

const detectReleasesMock = vi.hoisted(() => vi.fn());
const planWorkspacesMock = vi.hoisted(() => vi.fn());
const runBuildAndSbomMock = vi.hoisted(() => vi.fn());
const runPublishTargetsMock = vi.hoisted(() => vi.fn());
const runReleasesMock = vi.hoisted(() => vi.fn());
const closeLinkedIssuesMock = vi.hoisted(() => vi.fn());

vi.mock("../src/release/publish.js", () => ({
	detectReleases: detectReleasesMock,
	planWorkspaces: planWorkspacesMock,
	runBuildAndSbom: runBuildAndSbomMock,
	runPublishTargets: runPublishTargetsMock,
}));
vi.mock("../src/release/releases.js", () => ({ runReleases: runReleasesMock }));
vi.mock("../src/utils/close-linked-issues.js", () => ({ closeLinkedIssues: closeLinkedIssuesMock }));
vi.mock("../src/utils/ensure-full-history.js", () => ({ ensureFullHistory: () => Effect.void }));
vi.mock("../src/utils/detect-package-manager.js", () => ({ detectPackageManager: Effect.succeed("pnpm") }));
vi.mock("../src/utils/sort-releases-topologically.js", () => ({
	// Identity: ordering is `sort-releases-topologically`'s contract, not this
	// step's, and it is tested in its own suite.
	sortReleasesTopologically: (names: ReadonlyArray<string>) => Effect.succeed(names),
}));
// Partial mock: `isMonorepoForTagging` probes the filesystem, but
// `determineTagStrategy` is pure and stays REAL, so the tag list the failure
// message counts against is the one production would compute.
vi.mock("../src/utils/determine-tag-strategy.js", async (importOriginal) => ({
	...(await importOriginal<typeof import("../src/utils/determine-tag-strategy.js")>()),
	isMonorepoForTagging: () => Effect.succeed(false),
}));

const { ActionLogger, ActionOutputs, ActionState, DryRun } = await import("@effected/github-actions");
const { runPublishing } = await import("../src/steps/publishing.js");

/** One package, one target, published — the "what actually published" fact. */
const PUBLISH_RESULT: PublishPackagesResult = {
	success: true,
	packages: [
		{
			name: "@scope/alpha",
			version: "1.2.3",
			targets: [
				{
					target: {
						name: "@test/pkg",
						protocol: "npm",
						registry: "https://registry.npmjs.org",
						directory: "/tmp/alpha",
						access: "public",
						provenance: true,
						tag: "latest",
						tokenEnv: null,
					},
					success: true,
					status: "published",
				},
			],
		},
	],
	totalPackages: 1,
	successfulPackages: 1,
	totalTargets: 1,
	successfulTargets: 1,
};

// `registryConfirmTimeout: 0` keeps every test here off the registry probe
// (→ `skipped`); the one test that exercises the probe overrides it.
const INPUTS = { targetBranch: "main", npmToken: "", registryConfirmTimeout: 0 } as unknown as Inputs;

/** A registry that already serves every version asked of it, and counts the asks. */
const seededRegistry = () => {
	let calls = 0;
	const layer = NpmRegistry.layerTest({
		version: (name, version) =>
			Effect.sync(() => {
				calls += 1;
				return Option.some(
					PublishedVersion.make({ name, version, tarball: `https://registry.npmjs.org/${name}/-/pkg-${version}.tgz` }),
				);
			}),
	});
	return { layer, calls: () => calls };
};

/** Everything an assertion needs from one run of the step. */
interface RunCapture {
	readonly exit: { readonly _tag: string; readonly failure?: unknown };
	/** The structured `result` output, or `undefined` if it was never emitted. */
	readonly result: Record<string, unknown> | undefined;
	readonly scalars: Record<string, string>;
	readonly failedWith: string[];
	readonly text: string;
}

const run = async (
	inputs: Inputs = INPUTS,
	registry: Layer.Layer<NpmRegistry> = seededRegistry().layer,
): Promise<RunCapture> => {
	const lines: string[] = [];
	let result: Record<string, unknown> | undefined;
	const scalars: Record<string, string> = {};
	const failedWith: string[] = [];

	const capture = Logger.make<unknown, void>((options) => {
		lines.push(String(options.message));
	});

	const layers = Layer.mergeAll(
		Logger.layer([capture]),
		// `layerTest`'s `group` is a pass-through; record each opening so a test
		// can assert a group was — or was not — opened.
		ActionLogger.layerTest({
			group: (name, effect) => Effect.logInfo(`::group::${name}`).pipe(Effect.andThen(effect)),
		}),
		ActionOutputs.layerTest({
			setJson: (name: string, value: unknown) =>
				Effect.sync(() => {
					if (name === "result") result = value as Record<string, unknown>;
				}),
			set: (name: string, value: string) =>
				Effect.sync(() => {
					scalars[name] = value;
				}),
			setFailed: (message: string) =>
				Effect.sync(() => {
					failedWith.push(message);
				}),
		}),
		// `emitReleaseOutput` saves the encoded result for the post phase.
		ActionState.layerTest({ save: () => Effect.void }),
		DryRun.layerTest({ isDryRun: Effect.succeed(false) }),
		Layer.succeed(Repo, RepoRef.make({ owner: "savvy-web", repo: "silk-release-action" })),
		registry,
	);

	// The mocked modules erase their real requirement channels at RUNTIME only —
	// the types still name eight services apiece. The cast is at the harness
	// boundary and states exactly that, matching the precedent in
	// `publish-validation.test.ts`; nothing under test is cast.
	const effect = runPublishing(inputs, 42).pipe(Effect.provide(layers)) as unknown as Effect.Effect<void, unknown>;
	const exit = await Effect.runPromise(Effect.result(effect));

	return { exit, result, scalars, failedWith, text: lines.join("\n") };
};

beforeEach(() => {
	vi.clearAllMocks();
	detectReleasesMock.mockReturnValue(Effect.succeed([{ name: "@scope/alpha", version: "1.2.3", path: "/tmp/alpha" }]));
	planWorkspacesMock.mockReturnValue(
		Effect.succeed([
			{
				name: "@scope/alpha",
				version: "1.2.3",
				kind: "github-with-packages",
				resolvedPackages: 1,
				path: "packages/alpha",
			},
		]),
	);
	runBuildAndSbomMock.mockReturnValue(
		Effect.succeed({
			ok: true,
			sbomFailures: [],
			sbomSkipped: [],
			packageCount: 1,
			sbomPaths: new Map<string, string>(),
		}),
	);
	runPublishTargetsMock.mockReturnValue(Effect.succeed(PUBLISH_RESULT));
	runReleasesMock.mockReturnValue(Effect.succeed({ success: true, releases: [], errors: [], tagShas: {} }));
	closeLinkedIssuesMock.mockReturnValue(Effect.succeed({ closedCount: 2, failedCount: 0, issues: [] }));
});

describe("runPublishing — happy path", () => {
	it("succeeds, and does not annotate a failure, when every step works", async () => {
		runReleasesMock.mockReturnValue(
			Effect.succeed({
				success: true,
				releases: [{ tag: "1.2.3", url: "https://example.test/r", id: 7, assets: [] }],
				errors: [],
				tagShas: { "1.2.3": "" },
			}),
		);

		const { exit, result, failedWith, text } = await run();

		// The regression guard for the deferred failure: a green run must stay
		// green. If the new `if (!releasesResult.success)` were inverted or made
		// unconditional, this is what catches it.
		expect(exit._tag).toBe("Success");
		expect(failedWith).toEqual([]);
		expect(result).toBeDefined();
		// The closing line reports versioning, registry publishing and GitHub
		// releases as three separate counts, so a wave that publishes nothing to a
		// registry is legible instead of reading as an empty run.
		expect(text).toContain(
			"Release publishing: ✅ 1 workspace(s) versioned · 1 package(s) published to a registry · 1 GitHub release(s) created",
		);
	});

	it("does not open the availability group when the ceiling is 0", async () => {
		// The default INPUTS ceiling is 0, so nothing is probed; the group would be
		// an empty heading over no work, and its absence is what proves the
		// skip happens before the group opens rather than inside it.
		const { exit, result, text } = await run();

		expect(exit._tag).toBe("Success");
		expect(text).not.toContain("::group::Confirm registry availability");
		expect(text).not.toContain("Confirming ");
		// The all-`skipped` map is still produced for every package.
		const totals = result?.totals as { packagesConfirmed: number; packagesHeld: number };
		expect(totals.packagesConfirmed).toBe(0);
		expect(totals.packagesHeld).toBe(0);
	});

	it("confirms each npm target on the registry with the configured ceiling (#301)", async () => {
		// The one test that lets the probe run: a positive ceiling and a registry
		// that already serves the version, so the probe confirms on its first
		// call and never waits.
		runReleasesMock.mockReturnValue(
			Effect.succeed({
				success: true,
				releases: [{ tag: "1.2.3", url: "https://example.test/r", id: 7, assets: [] }],
				errors: [],
				tagShas: { "1.2.3": "" },
			}),
		);
		const registry = seededRegistry();
		const { exit, result, text } = await run({ ...INPUTS, registryConfirmTimeout: 180 }, registry.layer);

		expect(exit._tag).toBe("Success");
		expect(registry.calls()).toBe(1);
		// The ceiling reaches the step from `inputs.registryConfirmTimeout`.
		expect(text).toContain("ceiling 180s");
		// Ordering is the design: the probe runs AFTER tags and releases, so a
		// scan hold never delays them.
		expect(text).toContain("Created 1 release(s)");
		expect(text).toContain("Confirming 1 npm version(s)");
		expect(text.indexOf("Created 1 release(s)")).toBeLessThan(text.indexOf("Confirming 1 npm version(s)"));
		const totals = result?.totals as { packagesConfirmed: number; packagesHeld: number };
		expect(totals.packagesConfirmed).toBe(1);
		expect(totals.packagesHeld).toBe(0);
		const payload = result?.publish as {
			workspaces: Record<
				string,
				{ packages: ReadonlyArray<{ available: boolean; availability: { status: string }; tarballUrl: string | null }> }
			>;
		};
		const pkg = payload.workspaces["@scope/alpha"]?.packages[0];
		expect(pkg?.available).toBe(true);
		expect(pkg?.availability.status).toBe("confirmed");
		expect(pkg?.tarballUrl).toBe("https://registry.npmjs.org/@test/pkg/-/pkg-1.2.3.tgz");
	});

	it("skips the probe, and reports every package as skipped, when the ceiling is 0", async () => {
		const registry = seededRegistry();
		const { result } = await run(INPUTS, registry.layer);

		expect(registry.calls()).toBe(0);
		const totals = result?.totals as { packagesConfirmed: number; packagesHeld: number };
		expect(totals.packagesConfirmed).toBe(0);
		expect(totals.packagesHeld).toBe(0);
		const payload = result?.publish as {
			workspaces: Record<string, { packages: ReadonlyArray<{ available: boolean; availability: { status: string } }> }>;
		};
		const pkg = payload.workspaces["@scope/alpha"]?.packages[0];
		expect(pkg?.available).toBe(false);
		expect(pkg?.availability).toEqual({ status: "skipped", waitedMs: 0 });
	});
});

describe("runPublishing — a runReleases failure fails the phase", () => {
	beforeEach(() => {
		runReleasesMock.mockReturnValue(Effect.fail(new ReleasesError({ reason: "release", message: "GitHub said 422" })));
	});

	it("fails the effect with a ReleasesError rather than reporting a green run", async () => {
		// THE requirement. Before this change the phase caught the failure, logged
		// `❌ Created 0 release(s)` and returned successfully — the job went green,
		// nobody re-ran it, and the GitHub release silently never existed.
		const { exit } = await run();

		expect(exit._tag).toBe("Failure");
		expect(exit.failure).toBeInstanceOf(ReleasesError);
		expect((exit.failure as ReleasesError).reason).toBe("release");
	});

	it("STILL emits outputs describing the packages that did publish", async () => {
		// The reason the failure is deferred rather than raised at the failure
		// site. Asserting on the emitted `result` payload — not merely that
		// something was emitted — is what makes hoisting the failure above
		// `emitPublishing` a red test instead of a silent behaviour change.
		const { result, scalars } = await run();

		expect(result).toBeDefined();
		// `PublishOutput` keys workspaces by name under a `publish` payload.
		const payload = result?.publish as {
			order: ReadonlyArray<string>;
			workspaces: Record<string, { version: string; outcome: string }>;
		};
		expect(payload.order).toEqual(["@scope/alpha"]);
		expect(payload.workspaces["@scope/alpha"]?.version).toBe("1.2.3");
		// The publish itself succeeded — only the release housekeeping failed —
		// so the workspace reports what actually landed on the registry.
		expect(payload.workspaces["@scope/alpha"]?.outcome).toBe("published");
		expect(scalars["package-count"]).toBe("1");
		expect(scalars["release-pr-number"]).toBe("42");
	});

	it("STILL runs the close-linked-issues follow-on", async () => {
		// Independent of whether a release object was created, so a release
		// failure must not strand the linked issues.
		const { text } = await run();

		expect(closeLinkedIssuesMock).toHaveBeenCalledWith(42, false);
		expect(text).toContain("✅ 2 issue(s) closed");
	});

	it("STILL reports the tag, with an empty sha, when runReleases fails outright", async () => {
		// `runReleasesMock` (this describe's `beforeEach`) rejects the whole
		// step, so `steps/publishing.ts`'s catch fallback substitutes
		// `tagShas: {}` — #402: the sha travels on `ReleasesReport.tagShas`,
		// resolved at tag-creation time inside `processOneTag`, so a run where
		// `runReleases` never got that far has nothing to read it from. The tag
		// rides on the workspace as a SIBLING of `release`, so a run whose
		// release creation failed — which is exactly this case — still reports
		// the tag it meant to cut.
		const { result } = await run();

		const payload = result?.publish as {
			workspaces: Record<string, { tag: { sha: string } | null; release: unknown }>;
		};
		expect(payload.workspaces["@scope/alpha"]?.tag?.sha).toBe("");
		expect(payload.workspaces["@scope/alpha"]?.release).toBeNull();
	});

	it("carries the re-run contract and the error detail in the annotation", async () => {
		// The failure message is the only thing the operator reads on a red job,
		// so the recovery instruction lives there and not just in the module docs.
		const { failedWith, exit } = await run();

		expect(failedWith).toHaveLength(1);
		const message = failedWith[0] ?? "";
		expect(message).toContain("GitHub said 422");
		expect(message).toContain("Re-running this job is safe");
		expect(message).toContain("integrity digest");
		expect(message).toContain("resumes from where it failed");
		// The annotation and the typed error say the same thing.
		expect((exit.failure as ReleasesError).message).toBe(message);
	});

	it("names BOTH surfaces when the releases and the issues both failed", async () => {
		closeLinkedIssuesMock.mockReturnValue(
			Effect.succeed({ closedCount: 0, failedCount: 1, issues: [{ number: 9, title: "n", closed: false }] }),
		);

		const { failedWith } = await run();

		// A phase that failed for two reasons must not report only one.
		expect(failedWith[0]).toContain("GitHub releases");
		expect(failedWith[0]).toContain("Close linked issues");
	});

	it("counts the releases it did create against the tags it meant to create", async () => {
		runReleasesMock.mockReturnValue(
			Effect.succeed({
				success: false,
				releases: [{ tag: "1.2.3", url: "https://example.test/r", id: 7, assets: [] }],
				errors: ["asset upload failed", "second failure"],
				tagShas: { "1.2.3": "" },
			}),
		);

		const { failedWith } = await run();

		// A partial failure reported BY runReleases (not thrown) takes the same
		// path — `success: false` is the discriminant, not the error channel.
		expect(failedWith[0]).toContain("GitHub releases — created 1 of 1 release(s), 2 error(s)");
		expect(failedWith[0]).toContain("asset upload failed; second failure");
	});
});

describe("runPublishing — a close-linked-issues failure fails the phase", () => {
	beforeEach(() => {
		// Releases succeed; only the follow-on fails. `closeLinkedIssues` has error
		// channel `never`, so `failedCount` — not a raised error — is the signal.
		closeLinkedIssuesMock.mockReturnValue(
			Effect.succeed({
				closedCount: 1,
				failedCount: 2,
				issues: [
					{ number: 9, title: "n", closed: false },
					{ number: 10, title: "t", closed: false },
					{ number: 11, title: "e", closed: true },
				],
			}),
		);
	});

	it("fails the effect, naming linked-issues rather than blaming the release", async () => {
		const { exit } = await run();

		expect(exit._tag).toBe("Failure");
		expect(exit.failure).toBeInstanceOf(ReleasesError);
		// The GitHub release succeeded. Reporting `reason: "release"` here would
		// send an operator to look at a release that is fine.
		expect((exit.failure as ReleasesError).reason).toBe("linked-issues");
	});

	it("still emits outputs, and reports how many issues failed", async () => {
		const { result, failedWith } = await run();

		expect(result).toBeDefined();
		expect(failedWith[0]).toContain("2 of 3 issue(s) failed to close");
		expect(failedWith[0]).toContain("Re-running this job is safe");
		expect(failedWith[0]).toContain("already-closed issues are not commented on again");
	});

	it("does not fail when every issue closed", async () => {
		closeLinkedIssuesMock.mockReturnValue(Effect.succeed({ closedCount: 3, failedCount: 0, issues: [] }));

		const { exit, failedWith } = await run();

		expect(exit._tag).toBe("Success");
		expect(failedWith).toEqual([]);
	});
});
