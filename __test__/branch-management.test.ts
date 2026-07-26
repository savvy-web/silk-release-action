// Tests for Phase 1's orchestration — specifically, what it publishes to the
// pull request and in what state.
//
// The construct doing the state machine (`withSection`) is proven on its own in
// `managed-sections.test.ts`, including the defect and interrupt paths. What is
// proven HERE is that `runBranchManagement` wires it correctly: which arm gets
// bracketed, what body survives a failure, and whether anything is written at
// all in a dry run.
//
// That is only observable by varying the branch flow's OUTCOME, so the flows are
// injected rather than assembled from stubbed services. A flow that fails,
// dies, or is interrupted is one line here; reaching the same three outcomes
// through the real flows would mean scripting twenty services to break at a
// chosen moment.

import { NodeFileSystem } from "@effect/platform-node";
import { ActionEnvironment, ActionInput, ActionLogger, ActionOutputs } from "@effected/github-actions";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import type { BranchManagementSeams } from "../src/main.js";
import { runBranchManagement } from "../src/main.js";
import type { ReleaseBranchCheckResult } from "../src/utils/check-release-branch.js";

const HEAD_SHA = "abc1234def5678";

/** Every comment write the phase made, in order. */
interface Published {
	readonly prNumber: number;
	readonly body: string;
}

const planFixture = {
	preState: undefined,
	releases: [
		{
			name: "@scope/zulu",
			type: "minor" as const,
			oldVersion: "1.4.0",
			newVersion: "1.5.0",
			changesets: ["brave-cats"],
		},
		{
			name: "@scope/alpha",
			type: "patch" as const,
			oldVersion: "2.0.3",
			newVersion: "2.0.4",
			changesets: [],
		},
	],
	changesets: [{ id: "brave-cats", summary: "a change", releases: [{ name: "@scope/zulu", type: "minor" as const }] }],
};

const branchCheck = (over: Partial<ReleaseBranchCheckResult> = {}): ReleaseBranchCheckResult => ({
	exists: true,
	hasOpenPr: true,
	prNumber: 243,
	checkId: 1,
	...over,
});

/**
 * Drive the phase with chosen seams, recording what it published.
 *
 * @remarks
 * `dryRun` is spelled as the runner's own mangled key. Deriving it from the
 * input name in the test would let a wrong mangling rule agree with itself.
 */
const run = async (
	seams: Partial<BranchManagementSeams>,
	options: { readonly dryRun?: boolean; readonly existingComment?: string } = {},
): Promise<{ published: Array<Published>; exit: "ok" | "failed" | "died" }> => {
	const published: Array<Published> = [];
	let commentBody = options.existingComment ?? "";

	const full: BranchManagementSeams = {
		checkBranch: () => Effect.succeed(branchCheck()),
		ensureHistory: () => Effect.void,
		updateFlow: () =>
			Effect.succeed({
				success: true,
				hadConflicts: false,
				deleted: false,
				prNumber: 243,
				checkId: 1,
				versionSummary: "",
				linkedIssues: [],
			}),
		createFlow: () => Effect.succeed({ created: true, prNumber: 900, checkId: 1, versionSummary: "" }),
		readComment: () => Effect.succeed(commentBody),
		publishComment: (prNumber, body) => {
			published.push({ prNumber, body });
			// A real comment retains what was written last; the double must too, or
			// the preserve-neighbours behaviour is untestable.
			commentBody = body;
			return Effect.succeed({ commentId: 1 });
		},
		...seams,
	} as BranchManagementSeams;

	const layer = Layer.mergeAll(
		ActionInput.layer({
			"INPUT_RELEASE-BRANCH": "changeset-release/main",
			"INPUT_TARGET-BRANCH": "main",
			"INPUT_DRY-RUN": options.dryRun === true ? "true" : "false",
		}),
		ActionLogger.layerTest(),
		ActionOutputs.layerTest({ setJson: () => Effect.void, set: () => Effect.void, summary: () => Effect.void }),
		Layer.effect(ActionEnvironment)(
			ActionEnvironment.makeTest({
				GITHUB_SHA: HEAD_SHA,
				GITHUB_REPOSITORY: "acme/widgets",
				GITHUB_REPOSITORY_OWNER: "acme",
				GITHUB_REF: "refs/heads/main",
				GITHUB_REF_NAME: "main",
				GITHUB_WORKFLOW: "release",
				GITHUB_JOB: "branch",
				GITHUB_RUN_ID: "77",
				GITHUB_RUN_ATTEMPT: "1",
				GITHUB_EVENT_NAME: "push",
				GITHUB_ACTOR: "bot",
				GITHUB_SERVER_URL: "https://github.example.com",
				GITHUB_API_URL: "https://api.github.example.com",
				GITHUB_GRAPHQL_URL: "https://api.github.example.com/graphql",
				GITHUB_WORKSPACE: "/workspace",
			}),
		).pipe(Layer.provide(NodeFileSystem.layer)),
		Changesets.makeReleasePlannerTest({ plan: planFixture }),
		// `detectPackageManager` reads `package.json` off disk; the repo's own
		// manifest is a fine fixture and keeps the harness honest about what the
		// phase actually touches.
		NodeFileSystem.layer,
	);

	const exit = await Effect.runPromiseExit(runBranchManagement(full).pipe(Effect.provide(layer)));

	return {
		published,
		exit: exit._tag === "Success" ? "ok" : "failed",
	};
};

describe("runBranchManagement — what reaches the pull request", () => {
	it("publishes the plan while the branch work runs, before it finishes", async () => {
		const seen: Array<string> = [];
		await run({
			publishComment: (_pr, body) => {
				seen.push(body);
				return Effect.succeed({ commentId: 1 });
			},
			updateFlow: () =>
				Effect.sync(() => {
					// By now the `running` write must already have happened; a write
					// ordered after the work leaves the section blank for the whole run.
					expect(seen.length).toBeGreaterThan(0);
					return {
						success: true,
						hadConflicts: false,
						deleted: false,
						prNumber: 243,
						checkId: 1,
						versionSummary: "",
						linkedIssues: [],
					};
				}),
		});

		// Two writes: `running` before the work, then the terminal state after.
		expect(seen).toHaveLength(2);
		expect(seen[0]).toContain("running");
		expect(seen[1]).toContain("complete");
	});

	it("marks the section complete once the branch work succeeds", async () => {
		const { published } = await run({});
		const last = published.at(-1)?.body ?? "";

		expect(last).toContain("complete");
		expect(last).not.toContain('"state":"running"');
	});

	it("carries the release plan, including a dependency-driven package", async () => {
		const { published } = await run({});
		const last = published.at(-1)?.body ?? "";

		expect(last).toContain("@scope/zulu");
		// `@scope/alpha` has no changeset — invisible to a file-based report.
		expect(last).toContain("@scope/alpha");
		expect(last).toContain("1.4.0 → 1.5.0");
	});

	it("leaves the section FAILED, retaining the plan, when the branch work fails", async () => {
		const { published } = await run({ updateFlow: () => Effect.fail(new Error("push rejected") as never) });
		const last = published.at(-1)?.body ?? "";

		expect(last).toContain("failed");
		// Rule 2: the previous result is retained and marked, never blanked — a
		// reader still learns what the release was going to be.
		expect(last).toContain("@scope/zulu");
	});

	it("leaves the section FAILED, not running, when the branch work dies with a defect", async () => {
		const { published } = await run({ updateFlow: () => Effect.die(new Error("boom")) });
		const last = published.at(-1)?.body ?? "";

		// The case a tap/tapError pair misses. A section stuck at `running` reads
		// as a job still working, forever.
		expect(last).toContain("failed");
		expect(last).not.toContain('"state":"running"');
	});

	it("leaves the section CANCELLED when the branch work is interrupted", async () => {
		const { published } = await run({ updateFlow: () => Effect.interrupt });
		const last = published.at(-1)?.body ?? "";

		// Distinct from `failed`: "we were stopped" and "we broke" are different
		// facts about a release.
		expect(last).toContain("cancelled");
	});

	it("rewrites only its own section, leaving the rest of the comment intact", async () => {
		// The bug this replaces: every write started from an empty body, so a
		// comment carrying anything else — another phase's section, a human's
		// note — lost it on the next run.
		const { published } = await run(
			{},
			{
				existingComment:
					"A human wrote this.\n\n<!-- silk-release:section:other:start -->\nsomeone else's section\n<!-- silk-release:section:other:end -->",
			},
		);
		const last = published.at(-1)?.body ?? "";

		expect(last).toContain("A human wrote this.");
		expect(last).toContain("someone else's section");
		expect(last).toContain("@scope/zulu");
	});

	it("stamps the section with the head sha so staleness is detectable", async () => {
		const { published } = await run({});

		expect(published.at(-1)?.body).toContain(HEAD_SHA);
	});

	it("publishes nothing at all in a dry run", async () => {
		const { published } = await run({}, { dryRun: true });

		// A dry run must not write to the pull request; the phase still reports.
		expect(published).toEqual([]);
	});

	it("publishes nothing on the create path in a dry run either", async () => {
		// The bracket arm and the publish-once arm each carry their own dry-run
		// guard. Covering only the first leaves the second free to write to a real
		// pull request during a rehearsal.
		const { published } = await run(
			{ checkBranch: () => Effect.succeed(branchCheck({ exists: false, hasOpenPr: false, prNumber: null })) },
			{ dryRun: true },
		);

		expect(published).toEqual([]);
	});

	it("does not bracket when there is no pull request to write to yet", async () => {
		// The create path has nothing to comment on until it has created the PR,
		// so there is no `running` state — one write, after the fact.
		const { published } = await run({
			checkBranch: () => Effect.succeed(branchCheck({ exists: false, hasOpenPr: false, prNumber: null })),
		});

		expect(published).toHaveLength(1);
		expect(published[0]?.prNumber).toBe(900);
		expect(published[0]?.body).toContain("complete");
	});

	it("survives a comment write that fails, rather than failing the release", async () => {
		const { exit } = await run({
			publishComment: () => Effect.fail(new Error("comment API down") as never),
		});

		// A reporting write is not a release gate.
		expect(exit).toBe("ok");
	});
});
