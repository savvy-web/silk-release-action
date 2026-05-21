/**
 * Fixture tests for the close-linked-issues stage.
 *
 * @remarks
 * Drives `closeLinkedIssues` against the library's GitHubIssueTest /
 * CheckRunTest / ActionEnvironmentTest / ActionOutputsTest layers and
 * asserts on the recorded operations.
 */

import type {
	ActionOutputsTestState,
	CheckRunTestState,
	GitHubIssueTestState,
} from "@savvy-web/github-action-effects/testing";
import {
	ActionEnvironmentTest,
	ActionLoggerTest,
	ActionOutputsTest,
	CheckRunTest,
	GitHubIssueTest,
} from "@savvy-web/github-action-effects/testing";
import { Effect, Layer, Logger } from "effect";
import { describe, expect, it } from "vitest";
import { closeLinkedIssues } from "../src/utils/close-linked-issues.js";

interface Fixtures {
	issueState: GitHubIssueTestState;
	outputsState: ActionOutputsTestState;
	checkRunState: CheckRunTestState;
}

const makeFixtures = (linkedFor: Map<number, Array<{ number: number; title: string }>>): Fixtures => {
	const { state: issueState, layer: _ } = GitHubIssueTest.empty();
	for (const [prNumber, linked] of linkedFor) {
		issueState.linkedIssues.set(prNumber, linked);
		// Seed `issues` so the test layer's close/comment can find them.
		for (const issue of linked) {
			issueState.issues.set(issue.number, {
				number: issue.number,
				title: issue.title,
				state: "open",
				labels: [],
				body: "",
				// biome-ignore lint/suspicious/noExplicitAny: minimal IssueData fixture
			} as any);
		}
	}
	return {
		issueState,
		outputsState: ActionOutputsTest.empty(),
		checkRunState: CheckRunTest.empty(),
	};
};

const runStage = (prNumber: number, dryRun: boolean, f: Fixtures): Promise<unknown> => {
	const layer = Layer.mergeAll(
		ActionLoggerTest.layer(ActionLoggerTest.empty()),
		ActionOutputsTest.layer(f.outputsState),
		ActionEnvironmentTest.layer({
			GITHUB_SHA: "abc123",
			GITHUB_REF: "refs/heads/main",
			GITHUB_REPOSITORY: "test-owner/test-repo",
			GITHUB_REPOSITORY_OWNER: "test-owner",
			GITHUB_WORKSPACE: "/workspace",
			GITHUB_EVENT_NAME: "pull_request",
			GITHUB_EVENT_PATH: "/dev/null",
			GITHUB_RUN_ID: "1",
			GITHUB_RUN_NUMBER: "1",
			GITHUB_ACTOR: "test",
			GITHUB_SERVER_URL: "https://github.com",
			GITHUB_API_URL: "https://api.github.com",
		}),
		CheckRunTest.layer(f.checkRunState),
		GitHubIssueTest.layer(f.issueState),
	);
	return Effect.runPromise(
		closeLinkedIssues(prNumber, dryRun).pipe(
			Effect.provide(layer),
			Effect.provide(Logger.replace(Logger.defaultLogger, Logger.none)),
		),
	);
};

describe("closeLinkedIssues", () => {
	it("comments on and closes each linked issue", async () => {
		const fixtures = makeFixtures(
			new Map([
				[
					1,
					[
						{ number: 123, title: "Fix bug in auth" },
						{ number: 456, title: "Add new feature" },
					],
				],
			]),
		);

		const result = (await runStage(1, false, fixtures)) as {
			closedCount: number;
			failedCount: number;
			issues: ReadonlyArray<{ number: number; closed: boolean }>;
		};

		expect(result.closedCount).toBe(2);
		expect(result.failedCount).toBe(0);
		expect(result.issues.map((i) => i.number).sort()).toEqual([123, 456]);

		expect(fixtures.issueState.comments).toHaveLength(2);
		expect(fixtures.issueState.comments.map((c) => c.issueNumber).sort()).toEqual([123, 456]);
		expect(fixtures.issueState.closeCalls).toHaveLength(2);
		expect(fixtures.issueState.closeCalls.every((c) => c.reason === "completed")).toBe(true);
	});

	it("creates a check run reporting the result", async () => {
		const fixtures = makeFixtures(new Map([[1, [{ number: 123, title: "Test" }]]]));

		await runStage(1, false, fixtures);

		expect(fixtures.checkRunState.runs).toHaveLength(1);
		expect(fixtures.checkRunState.runs[0].name).toBe("Close Linked Issues");
	});

	it("emits a dry-run-flavored check name and skips real close calls", async () => {
		const fixtures = makeFixtures(new Map([[1, [{ number: 123, title: "Test" }]]]));

		const result = (await runStage(1, true, fixtures)) as {
			closedCount: number;
			failedCount: number;
		};

		expect(result.closedCount).toBe(1);
		expect(fixtures.issueState.comments).toEqual([]);
		expect(fixtures.issueState.closeCalls).toEqual([]);
		expect(fixtures.checkRunState.runs[0].name).toContain("Dry Run");
	});

	it("reports zero closures when the PR has no linked issues", async () => {
		const fixtures = makeFixtures(new Map([[1, []]]));

		const result = (await runStage(1, false, fixtures)) as {
			closedCount: number;
			issues: ReadonlyArray<unknown>;
		};

		expect(result.closedCount).toBe(0);
		expect(result.issues).toHaveLength(0);
		expect(fixtures.issueState.comments).toEqual([]);
		expect(fixtures.issueState.closeCalls).toEqual([]);
	});

	it("sets closed_issues_count and closed_issues outputs", async () => {
		const fixtures = makeFixtures(new Map([[1, [{ number: 123, title: "Test" }]]]));

		await runStage(1, false, fixtures);

		expect(fixtures.outputsState.outputs).toEqual(
			expect.arrayContaining([
				{ name: "closed_issues_count", value: "1" },
				{ name: "failed_issues_count", value: "0" },
			]),
		);
	});
});
