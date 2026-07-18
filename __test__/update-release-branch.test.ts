/**
 * Fixture tests for the update-release-branch stage.
 *
 * @remarks
 * Exercises the paths rewired onto the `PullRequest` and `GitHubIssue` library
 * services: PR discovery (open/closed), creation, title/body updates, reopen,
 * and linked-issue harvesting. The still-raw `client.rest` calls (`git.getRef`)
 * are satisfied through `GitHubClientTest` recorded responses; issue details
 * are seeded via `GitHubIssueTest`.
 *
 * The no-version-change path closes any release PR and deletes the release
 * branch via the `GitBranch` library service, asserted through
 * `GitBranchTest`'s recorded `branches` map.
 */

import { PublishabilityDetector, WorkspaceDiscovery } from "@effected/workspaces";
import type {
	ActionOutputsTestState,
	ActionStateTestState,
	CheckRunTestState,
	GitBranchTestState,
	GitCommitTestState,
	GitHubClientTestState,
	GitHubIssueTestState,
	PullRequestTestState,
} from "@savvy-web/github-action-effects/testing";
import {
	ActionEnvironmentTest,
	ActionOutputsTest,
	ActionStateTest,
	CheckRunTest,
	CommandRunnerTest,
	GitBranchTest,
	GitCommitTest,
	GitHubClientTest,
	GitHubIssueTest,
	PullRequestTest,
} from "@savvy-web/github-action-effects/testing";
import { Changesets } from "@savvy-web/silk-effects";
import { ConfigProvider, Effect, FileSystem, Layer, Logger, Option } from "effect";
import { describe, expect, it } from "vitest";
import { ChangesetConfig } from "../src/release/changeset-config.js";
import type { LinkedIssue, UpdateReleaseBranchResult } from "../src/utils/update-release-branch.js";
import { updateReleaseBranch } from "../src/utils/update-release-branch.js";

/** Minimal WorkspaceDiscovery stub: no packages. */
const workspaceDiscoveryStub = Layer.succeed(WorkspaceDiscovery, {
	info: () => Effect.die("not implemented"),
	listPackages: () => Effect.succeed([]),
	getPackage: () => Effect.die("not implemented"),
	importerMap: () => Effect.succeed(new Map()),
	resolveFile: () => Effect.succeed(Option.none()),
	resolveFiles: () => Effect.succeed([]),
	refresh: () => Effect.void,
});

/** Minimal PublishabilityDetector stub: no publish targets for any package. */
const publishabilityDetectorStub = Layer.succeed(PublishabilityDetector, {
	detect: () => Effect.succeed([]),
});

/** Minimal ChangesetConfig stub: no ignore, no fixed. */
const changesetConfigStub = Layer.succeed(ChangesetConfig, {
	mode: () => Effect.succeed("silk" as const),
	versionPrivate: () => Effect.succeed(false),
	ignorePatterns: () => Effect.succeed([]),
	isIgnored: () => Effect.succeed(false),
	fixed: () => Effect.succeed([]),
	refresh: () => Effect.void,
});

const appliedRelease: Changesets.AppliedRelease = {
	dryRun: false,
	releases: [{ name: "@scope/a", type: "minor", oldVersion: "1.0.0", newVersion: "1.1.0" }],
	touchedFiles: ["package.json", "CHANGELOG.md"],
	versionFileUpdates: [],
};

const releasePlannerStub = Changesets.makeReleasePlannerTest({ apply: appliedRelease });

const configInspectorStub = Changesets.makeConfigInspectorTest({
	configPath: "/workspace/.changeset/config.json",
	projectDir: "/workspace",
	changelog: "@savvy-web/silk/changesets/changelog",
	baseBranch: "main",
	access: "restricted",
	ignore: [],
	packages: [],
	legacyVersionFilesUsed: false,
});

const RELEASE_BRANCH = "changeset-release/main";
const TARGET_BRANCH = "main";

interface Fixtures {
	outputsState: ActionOutputsTestState;
	stateState: ActionStateTestState;
	checkRunState: CheckRunTestState;
	commitState: GitCommitTestState;
	branchState: GitBranchTestState;
	prState: PullRequestTestState;
	issueState: GitHubIssueTestState;
	clientState: GitHubClientTestState;
}

const makeFixtures = (
	params: {
		prs?: Array<{
			number: number;
			head: string;
			base: string;
			state: "open" | "closed";
			title?: string;
			body?: string;
			merged?: boolean;
		}>;
		/** Branches to seed into GitBranchTest (name → sha). Defaults to the release branch. */
		branches?: Array<[string, string]>;
		linkedIssues?: Array<[number, Array<{ number: number; title: string }>]>;
		issueDetails?: Array<{ number: number; title: string; state: string; htmlUrl?: string; nodeId?: string }>;
		restResponses?: Array<[string, unknown]>;
	} = {},
): Fixtures => {
	const prState = PullRequestTest.empty();
	let nextNumber = 1;
	for (const pr of params.prs ?? []) {
		prState.prs.push({
			number: pr.number,
			nodeId: `node-${pr.number}`,
			url: `https://github.com/owner/repo/pull/${pr.number}`,
			title: pr.title ?? `PR #${pr.number}`,
			body: pr.body ?? "",
			state: pr.state,
			head: pr.head,
			base: pr.base,
			draft: false,
			merged: pr.merged ?? false,
			mergedAt: pr.merged ? "2026-01-01T00:00:00Z" : null,
			labels: [],
			reviewers: [],
			teamReviewers: [],
			autoMerge: undefined,
		});
		nextNumber = Math.max(nextNumber, pr.number + 1);
	}
	prState.nextNumber = nextNumber;

	const issue = GitHubIssueTest.empty();
	for (const [prNumber, linked] of params.linkedIssues ?? []) {
		issue.state.linkedIssues.set(prNumber, linked);
	}
	for (const detail of params.issueDetails ?? []) {
		issue.state.issues.set(detail.number, {
			number: detail.number,
			title: detail.title,
			state: detail.state,
			labels: [],
			...(detail.htmlUrl !== undefined ? { htmlUrl: detail.htmlUrl } : {}),
			...(detail.nodeId !== undefined ? { nodeId: detail.nodeId } : {}),
		});
	}

	const clientState: GitHubClientTestState = {
		restResponses: new Map((params.restResponses ?? []).map(([op, data]) => [op, { data }])),
		graphqlResponses: new Map(),
		paginateResponses: new Map(),
		repo: { owner: "owner", repo: "repo" },
	};

	const branchState = GitBranchTest.empty();
	for (const [name, sha] of params.branches ?? [[RELEASE_BRANCH, "deadbeef"]]) {
		branchState.branches.set(name, sha);
	}

	return {
		outputsState: ActionOutputsTest.empty(),
		stateState: ActionStateTest.empty(),
		checkRunState: CheckRunTest.empty(),
		commitState: GitCommitTest.empty(),
		branchState,
		prState,
		issueState: issue.state,
		clientState,
	};
};

/**
 * Run `updateReleaseBranch` against the given fixtures.
 *
 * @remarks
 * `commandResponses` keys are `"<command> <args...>"`; unrecorded commands
 * succeed with empty output. A `git status --porcelain` of empty stdout drives
 * the no-version-change branch (close PR + delete branch). A non-empty status
 * drives the version-change branch; an empty `git status --porcelain -z` keeps
 * the API-commit path a no-op (`files.length === 0`), so only the `git.getRef`
 * REST response is needed to reach the PR reopen/title/create steps.
 */
const runStage = (
	f: Fixtures,
	commandResponses: Array<[string, string]> = [],
	changesetFiles: ReadonlyArray<string> = [],
	plannerLayer: Layer.Layer<Changesets.ReleasePlanner> = releasePlannerStub,
): Promise<UpdateReleaseBranchResult> => {
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
		ActionStateTest.layer(f.stateState),
		CheckRunTest.layer(f.checkRunState),
		CommandRunnerTest.layer(
			new Map(commandResponses.map(([key, stdout]) => [key, { exitCode: 0, stdout, stderr: "" }])),
		),
		GitBranchTest.layer(f.branchState),
		GitCommitTest.layer(f.commitState),
		GitHubClientTest.layer(f.clientState),
		GitHubIssueTest.layer(f.issueState),
		PullRequestTest.layer(f.prState),
		FileSystem.layerNoop({
			exists: () => Effect.succeed(false),
			readDirectory: () => Effect.succeed([...changesetFiles]),
		}),
		workspaceDiscoveryStub,
		publishabilityDetectorStub,
		changesetConfigStub,
		plannerLayer,
		configInspectorStub,
	);
	const config = ConfigProvider.fromUnknown({
		"release-branch": RELEASE_BRANCH,
		"target-branch": TARGET_BRANCH,
		"pr-title-prefix": "chore: release",
		"dry-run": "false",
	});
	return Effect.runPromise(
		updateReleaseBranch().pipe(
			Effect.provide(layer),
			Effect.provide(Logger.layer([])),
			Effect.provide(ConfigProvider.layer(config)),
		),
	);
};

/** A `git status --porcelain` with empty stdout drives the no-change (cleanup) branch. */
const noVersionChange: Array<[string, string]> = [["git status --porcelain", ""]];

/**
 * Commands that drive the version-change branch: a non-empty porcelain status
 * plus an empty `-z` status so the API-commit path is a no-op and control
 * reaches the PR reopen/title/create steps.
 */
const versionChange: Array<[string, string]> = [
	["git status --porcelain", "M package.json\nM CHANGELOG.md"],
	["git status --porcelain -z", ""],
];

/** `git.getRef` REST response consumed by `commitChangesOntoTarget` on the version-change path. */
const refResponse: Array<[string, unknown]> = [["git.getRef", { object: { sha: "deadbeef" } }]];

describe("updateReleaseBranch", () => {
	it("creates a release PR when none exists and applies the automated/release labels", async () => {
		const f = makeFixtures({ restResponses: refResponse });

		const result = await runStage(f, versionChange);

		expect(result.deleted).toBe(false);
		const created = f.prState.prs.find((pr) => pr.head === RELEASE_BRANCH);
		expect(created).toBeDefined();
		expect(result.prNumber).toBe(created?.number);
		expect(created?.base).toBe(TARGET_BRANCH);
		expect(created?.state).toBe("open");
		expect(created?.labels).toEqual(["automated", "release"]);
	});

	it("updates the existing open PR's title and does not create a new one", async () => {
		const f = makeFixtures({
			prs: [{ number: 42, head: RELEASE_BRANCH, base: TARGET_BRANCH, state: "open", title: "stale title" }],
			restResponses: refResponse,
		});

		const result = await runStage(f, versionChange);

		expect(result.prNumber).toBe(42);
		expect(f.prState.prs).toHaveLength(1); // no new PR created
		expect(f.prState.prs[0].title).toBe("chore: release");
	});

	it("reopens a closed, unmerged PR instead of creating a new one", async () => {
		const f = makeFixtures({
			prs: [{ number: 7, head: RELEASE_BRANCH, base: TARGET_BRANCH, state: "closed", merged: false }],
			restResponses: refResponse,
		});

		const result = await runStage(f, versionChange);

		expect(result.prNumber).toBe(7);
		expect(f.prState.prs).toHaveLength(1);
		expect(f.prState.prs[0].state).toBe("open");
	});

	it("surfaces linked issues harvested from changeset commits", async () => {
		const f = makeFixtures({
			prs: [{ number: 9, head: RELEASE_BRANCH, base: TARGET_BRANCH, state: "open" }],
			linkedIssues: [[123, [{ number: 55, title: "Linked bug" }]]],
			issueDetails: [{ number: 55, title: "Linked bug", state: "open", htmlUrl: "https://x/55", nodeId: "I_55" }],
			restResponses: [...refResponse],
		});

		// One changeset file whose harvested commit message references PR #123
		// via the `(#NNN)` merge-commit suffix; the git-log format is
		// `%H%n%B%n---END---`. `getLinkedIssues(123)` then yields issue #55,
		// whose details are seeded via `GitHubIssueTest` and resolved
		// through the `GitHubIssue.get` service method.
		const result = await runStage(
			f,
			[
				...versionChange,
				[
					"git log origin/main --diff-filter=A --follow --reverse --format=%H%n%B%n---END--- -- .changeset/feat.md",
					"sha111\nfeat: add thing (#123)\n---END---\n",
				],
			],
			["feat.md"],
		);

		expect(result.linkedIssues.map((i: LinkedIssue) => i.number)).toContain(55);
	});

	it("closes the open release PR and deletes the branch when there are no version changes", async () => {
		const f = makeFixtures({
			prs: [{ number: 42, head: RELEASE_BRANCH, base: TARGET_BRANCH, state: "open" }],
		});

		const result = await runStage(f, noVersionChange);

		expect(result.deleted).toBe(true);
		expect(result.prNumber).toBeNull();
		// The open PR is explicitly closed before the branch is removed.
		expect(f.prState.prs.find((pr) => pr.number === 42)?.state).toBe("closed");
		// The invalid release branch is deleted.
		expect(f.branchState.branches.has(RELEASE_BRANCH)).toBe(false);
	});

	it("leaves an already-closed PR closed and still deletes the branch when there are no version changes", async () => {
		const f = makeFixtures({
			prs: [{ number: 7, head: RELEASE_BRANCH, base: TARGET_BRANCH, state: "closed", merged: false }],
		});

		const result = await runStage(f, noVersionChange);

		expect(result.deleted).toBe(true);
		expect(result.prNumber).toBeNull();
		expect(f.prState.prs.find((pr) => pr.number === 7)?.state).toBe("closed");
		expect(f.branchState.branches.has(RELEASE_BRANCH)).toBe(false);
	});

	it("deletes the branch and creates no PR when there are no version changes and no PR exists", async () => {
		const f = makeFixtures();

		const result = await runStage(f, noVersionChange);

		expect(result.deleted).toBe(true);
		expect(result.prNumber).toBeNull();
		// No PR was created during cleanup.
		expect(f.prState.prs).toHaveLength(0);
		expect(f.branchState.branches.has(RELEASE_BRANCH)).toBe(false);
	});

	it("fails when native versioning fails", async () => {
		const f = makeFixtures({ restResponses: refResponse });
		// Planner test layer with no apply fixture → apply fails with ReleasePlanError.
		const failingPlanner = Changesets.makeReleasePlannerTest({});
		await expect(runStage(f, versionChange, [], failingPlanner)).rejects.toThrow(/ReleasePlanError|not provided/);
	});
});
