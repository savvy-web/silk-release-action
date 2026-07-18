/**
 * Fixture tests for the check-release-branch stage.
 */

import type {
	ActionOutputsTestState,
	CheckRunTestState,
	GitBranchTestState,
	PullRequestTestState,
} from "@savvy-web/github-action-effects/testing";
import {
	ActionEnvironmentTest,
	ActionOutputsTest,
	CheckRunTest,
	GitBranchTest,
	PullRequestTest,
} from "@savvy-web/github-action-effects/testing";
import { Effect, Layer, Logger } from "effect";
import { describe, expect, it } from "vitest";
import type { ReleaseBranchCheckResult } from "../src/utils/check-release-branch.js";
import { checkReleaseBranch } from "../src/utils/check-release-branch.js";

interface Fixtures {
	outputsState: ActionOutputsTestState;
	checkRunState: CheckRunTestState;
	branchState: GitBranchTestState;
	prState: PullRequestTestState;
}

const makeFixtures = (
	params: {
		branches?: Array<[string, string]>;
		prs?: Array<{ number: number; url: string; head: string; base: string; state: "open" | "closed" }>;
	} = {},
): Fixtures => {
	const branchState = GitBranchTest.empty();
	for (const [name, sha] of params.branches ?? []) {
		branchState.branches.set(name, sha);
	}
	const prState = PullRequestTest.empty();
	let nextNumber = 1;
	for (const pr of params.prs ?? []) {
		prState.prs.push({
			number: pr.number,
			nodeId: `node-${pr.number}`,
			url: pr.url,
			title: `PR #${pr.number}`,
			body: "",
			state: pr.state,
			head: pr.head,
			base: pr.base,
			draft: false,
			merged: false,
			labels: [],
			// biome-ignore lint/suspicious/noExplicitAny: minimal PullRequestRecord fixture
		} as any);
		nextNumber = Math.max(nextNumber, pr.number + 1);
	}
	prState.nextNumber = nextNumber;

	return {
		outputsState: ActionOutputsTest.empty(),
		checkRunState: CheckRunTest.empty(),
		branchState,
		prState,
	};
};

const runStage = (
	releaseBranch: string,
	targetBranch: string,
	dryRun: boolean,
	f: Fixtures,
): Promise<ReleaseBranchCheckResult> => {
	const layer = Layer.mergeAll(
		ActionOutputsTest.layer(f.outputsState),
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
		CheckRunTest.layer(f.checkRunState),
		GitBranchTest.layer(f.branchState),
		PullRequestTest.layer(f.prState),
	);
	return Effect.runPromise(
		checkReleaseBranch(releaseBranch, targetBranch, dryRun).pipe(
			Effect.provide(layer),
			Effect.provide(Logger.layer([])),
		),
	);
};

describe("checkReleaseBranch", () => {
	it("reports branch exists + open PR found", async () => {
		// Note: the PullRequestTest list filter strips an `owner:` prefix from
		// the query head before comparing. PR records are stored with the bare
		// branch name.
		const f = makeFixtures({
			branches: [["changeset-release/main", "abc123"]],
			prs: [
				{
					number: 42,
					url: "https://github.com/owner/repo/pull/42",
					head: "changeset-release/main",
					base: "main",
					state: "open",
				},
			],
		});

		const result = await runStage("changeset-release/main", "main", false, f);

		expect(result.exists).toBe(true);
		expect(result.hasOpenPr).toBe(true);
		expect(result.prNumber).toBe(42);
		expect(typeof result.checkId).toBe("number");
	});

	it("reports branch exists without open PR", async () => {
		const f = makeFixtures({
			branches: [["changeset-release/main", "abc123"]],
		});

		const result = await runStage("changeset-release/main", "main", false, f);

		expect(result.exists).toBe(true);
		expect(result.hasOpenPr).toBe(false);
		expect(result.prNumber).toBeNull();
	});

	it("reports branch does not exist", async () => {
		const f = makeFixtures();

		const result = await runStage("changeset-release/main", "main", false, f);

		expect(result.exists).toBe(false);
		expect(result.hasOpenPr).toBe(false);
		expect(result.prNumber).toBeNull();
	});

	it("flags dry-run in the Check Run title", async () => {
		const f = makeFixtures();

		await runStage("changeset-release/main", "main", true, f);

		expect(f.checkRunState.runs[0].name).toContain("Dry Run");
	});

	it("creates a Check Run reporting the result", async () => {
		const f = makeFixtures({ branches: [["changeset-release/main", "abc123"]] });

		await runStage("changeset-release/main", "main", false, f);

		expect(f.checkRunState.runs).toHaveLength(1);
		expect(f.checkRunState.runs[0].name).toBe("Check Release Branch");
	});
});
