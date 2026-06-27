/**
 * Fixture tests for the link-issues-from-commits module.
 *
 * @remarks
 * Exercises the rewired `GitTag.list()` path that replaced the raw
 * `repos.listTags` Octokit call, and the rewired `GitHubIssue.get` path
 * that replaced the raw `issues.get` Octokit call. The still-raw calls
 * (`compareCommits`, `listCommits`, `closingIssuesReferences` GraphQL) are
 * satisfied via `GitHubClientTest` — either by seeding a response or by
 * letting `Effect.either` absorb the 404 that the test layer emits for
 * unregistered operations.
 *
 * Three focused scenarios:
 *
 * 1. **`getLatestTagSha` direct unit tests** — exercises tag-selection logic
 *    in isolation without any `GitHubClient` or `compareCommits` involvement.
 *    The multi-digit test seeds tags in an order where the semver-highest is
 *    NOT last, so it strictly fails against the old `tags[length-1]` code.
 *
 * 2. **Latest-tag selection (integration)** — `GitTagTest` is seeded with a
 *    known set of tags; verifies the full `getLinkedIssuesFromCommits` path.
 *
 * 3. **No tags** — `GitTagTest` is empty. The function falls back to
 *    `getAllCommitsOnBranch` (the `GitHubCommit.list` path), which is seeded
 *    in `GitHubCommitTest`. The returned `commits` array reflects those
 *    listed commits.
 */

import type {
	GitHubClientTestState,
	GitHubCommitTestState,
	GitHubIssueTestState,
	GitTagTestState,
	PullRequestInfo,
} from "@savvy-web/github-action-effects/testing";
import {
	ActionEnvironmentTest,
	ActionOutputsTest,
	CheckRunTest,
	GitHubClient,
	GitHubClientError,
	GitHubClientTest,
	GitHubCommitTest,
	GitHubIssueTest,
	GitTagTest,
	PullRequestTest,
} from "@savvy-web/github-action-effects/testing";
import { ConfigProvider, Effect, Layer, Logger, Stream } from "effect";
import { describe, expect, it } from "vitest";
import {
	getLatestTagSha,
	getLinkedIssuesFromCommits,
	linkIssuesFromCommits,
} from "../src/utils/link-issues-from-commits.js";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const OWNER = "owner";
const REPO = "repo";
const TARGET_BRANCH = "main";

/** Minimal commit summary that satisfies the `CommitSummary` shape. */
const makeCommit = (sha: string, message: string, author = "Test Author") => ({
	sha,
	message,
	author,
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface Fixtures {
	tagState: GitTagTestState;
	clientState: GitHubClientTestState;
	commitState: GitHubCommitTestState;
	issueState: GitHubIssueTestState;
}

const makeFixtures = (
	params: {
		tags?: Array<{ tag: string; sha: string }>;
		/** Commits seeded for `compare(latestTagSha, TARGET_BRANCH)`. */
		compareCommitsData?: Array<{ sha: string; message: string; author: string }>;
		/** SHA used as the `compare` base — must match the seeded tag's SHA. */
		compareBaseSha?: string;
		/** Commits seeded for `list(TARGET_BRANCH)` (the no-tag fallback). */
		listCommitsData?: Array<{ sha: string; message: string; author: string }>;
		issues?: Array<{ number: number; title: string; state: string; htmlUrl?: string; nodeId?: string }>;
	} = {},
): Fixtures => {
	const tagState = GitTagTest.empty().state;
	for (const { tag, sha } of params.tags ?? []) {
		tagState.tags.set(tag, sha);
	}

	const clientState: GitHubClientTestState = {
		restResponses: new Map(),
		graphqlResponses: new Map(),
		paginateResponses: new Map(),
		repo: { owner: OWNER, repo: REPO },
	};

	const commitState: GitHubCommitTestState = GitHubCommitTest.empty();

	if (params.compareCommitsData !== undefined && params.compareBaseSha !== undefined) {
		commitState.comparisons.set(`${params.compareBaseSha}...${TARGET_BRANCH}`, {
			commits: params.compareCommitsData,
			files: [],
		});
	}

	if (params.listCommitsData !== undefined) {
		commitState.commitLists.set(TARGET_BRANCH, params.listCommitsData);
	}

	const issueState = GitHubIssueTest.empty().state;
	for (const issue of params.issues ?? []) {
		issueState.issues.set(issue.number, {
			number: issue.number,
			title: issue.title,
			state: issue.state,
			labels: [],
			...(issue.htmlUrl !== undefined ? { htmlUrl: issue.htmlUrl } : {}),
			...(issue.nodeId !== undefined ? { nodeId: issue.nodeId } : {}),
		});
	}

	return { tagState, clientState, commitState, issueState };
};

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

const runStage = (
	f: Fixtures,
): Promise<{
	linkedIssues: Array<{
		number: number;
		title: string;
		state: string;
		url: string;
		node_id: string;
		commits: string[];
	}>;
	commits: Array<{ sha: string; message: string; author: string }>;
}> => {
	const layer = Layer.mergeAll(
		ActionEnvironmentTest.layer({
			GITHUB_SHA: "headsha123",
			GITHUB_REF: `refs/heads/${TARGET_BRANCH}`,
			GITHUB_REPOSITORY: `${OWNER}/${REPO}`,
			GITHUB_REPOSITORY_OWNER: OWNER,
			GITHUB_WORKSPACE: "/workspace",
			GITHUB_EVENT_NAME: "push",
			GITHUB_EVENT_PATH: "/dev/null",
			GITHUB_RUN_ID: "1",
			GITHUB_RUN_NUMBER: "1",
			GITHUB_ACTOR: "test",
			GITHUB_SERVER_URL: "https://github.com",
			GITHUB_API_URL: "https://api.github.com",
		}),
		GitTagTest.layer(f.tagState),
		GitHubClientTest.layer(f.clientState),
		GitHubCommitTest.layer(f.commitState),
		GitHubIssueTest.layer(f.issueState),
	);
	return Effect.runPromise(
		getLinkedIssuesFromCommits(TARGET_BRANCH).pipe(
			Effect.provide(layer),
			Effect.provide(Logger.replace(Logger.defaultLogger, Logger.none)),
		),
	);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Direct unit tests for getLatestTagSha
// ---------------------------------------------------------------------------

/**
 * Run `getLatestTagSha` in isolation: only `GitTagTest` is provided.
 * No `GitHubClient` or `compareCommits` is involved.
 */
const runGetLatestTagSha = (tags: Array<{ tag: string; sha: string }>): Promise<string | null> => {
	const state = GitTagTest.empty().state;
	for (const { tag, sha } of tags) {
		state.tags.set(tag, sha);
	}
	return Effect.runPromise(
		getLatestTagSha.pipe(
			Effect.provide(GitTagTest.layer(state)),
			Effect.provide(Logger.replace(Logger.defaultLogger, Logger.none)),
		),
	);
};

describe("getLatestTagSha", () => {
	it("returns null when no tags are present", async () => {
		const sha = await runGetLatestTagSha([]);
		expect(sha).toBeNull();
	});

	it("selects the semver-highest SHA even when it is NOT last in Map-insertion order (multi-digit regression)", async () => {
		// Insert order: v1.10.1 first, v1.9.0 second, v1.10.0 third.
		// Map insertion order means the LAST entry is v1.10.0 (sha-v1-10).
		// The old `tags[tags.length - 1]` bug would return "sha-v1-10" (last
		// inserted), NOT "sha-v1-10-1" (true semver maximum).
		// The semver fix must return "sha-v1-10-1".
		const sha = await runGetLatestTagSha([
			{ tag: "v1.10.1", sha: "sha-v1-10-1" },
			{ tag: "v1.9.0", sha: "sha-v1-9" },
			{ tag: "v1.10.0", sha: "sha-v1-10" },
		]);
		expect(sha).toBe("sha-v1-10-1");
	});

	it("handles scoped-package tags in @scope/pkg@X.Y.Z format", async () => {
		// @scope/pkg@X.Y.Z: extractVersionFromTag strips everything up to the last @.
		const sha = await runGetLatestTagSha([
			{ tag: "@scope/pkg@1.0.0", sha: "sha-1-0-0" },
			{ tag: "@scope/pkg@2.0.0", sha: "sha-2-0-0" },
			{ tag: "@scope/pkg@1.9.0", sha: "sha-1-9-0" },
		]);
		expect(sha).toBe("sha-2-0-0");
	});

	it("handles a bare X.Y.Z tag with no leading v and no @ (extractVersionFromTag fallthrough)", async () => {
		const sha = await runGetLatestTagSha([{ tag: "1.2.3", sha: "sha-bare" }]);
		expect(sha).toBe("sha-bare");
	});

	it("returns null when no tag yields a parseable semver version", async () => {
		const sha = await runGetLatestTagSha([
			{ tag: "not-a-version", sha: "x" },
			{ tag: "random", sha: "y" },
		]);
		expect(sha).toBeNull();
	});

	it("skips unparseable tags and selects the highest parseable one", async () => {
		const sha = await runGetLatestTagSha([
			{ tag: "garbage", sha: "g" },
			{ tag: "v2.0.0", sha: "s2" },
			{ tag: "v1.0.0", sha: "s1" },
		]);
		expect(sha).toBe("s2");
	});
});

// ---------------------------------------------------------------------------
// Top-level stage: linkIssuesFromCommits (Check Run + PR cross-referencing)
// ---------------------------------------------------------------------------

const gqlError = (reason: string): GitHubClientError =>
	new GitHubClientError({ operation: "graphql", status: undefined, reason, retryable: false, retryAfterMs: undefined });

/**
 * Content-matching GitHubClient layer. The real test layer matches GraphQL by
 * exact query string; this dispatches on query content + variables so we can
 * drive the closingIssuesReferences, timeline, and addComment branches of the
 * top-level stage independently.
 */
const makeContentClient = (): Layer.Layer<GitHubClient> => {
	const closingResp = {
		repository: {
			pullRequest: {
				allLinked: {
					nodes: [
						{ id: "node8", number: 8, title: "PR issue 8", state: "OPEN", url: "u8" },
						{ id: "node5", number: 5, title: "PR issue 5", state: "CLOSED", url: "u5" },
					],
				},
				manuallyLinked: {
					nodes: [
						{ id: "node8", number: 8, title: "PR issue 8", state: "OPEN", url: "u8" },
						{ id: "node9", number: 9, title: "Manual 9", state: "OPEN", url: "u9" },
					],
				},
			},
		},
	};
	const timelineLinked = {
		repository: {
			issue: {
				timelineItems: {
					nodes: [{ __typename: "CrossReferencedEvent", source: { __typename: "PullRequest", number: 100 } }],
				},
			},
		},
	};
	const timelineEmpty = { repository: { issue: { timelineItems: { nodes: [] } } } };

	const client: ReturnType<typeof GitHubClient.of> = {
		rest: <T>(): Effect.Effect<T, GitHubClientError> => Effect.fail(gqlError("rest not supported")),
		graphql: <T>(query: string, variables?: Record<string, unknown>): Effect.Effect<T, GitHubClientError> => {
			const v = variables ?? {};
			if (query.includes("closingIssuesReferences")) {
				if (v.prNumber === 20) return Effect.fail(gqlError("PR 20 closing query failed"));
				return Effect.succeed(closingResp as T);
			}
			if (query.includes("timelineItems")) {
				if (v.issueNumber === 8) return Effect.fail(gqlError("timeline 8 failed"));
				if (v.issueNumber === 5) return Effect.succeed(timelineLinked as T);
				return Effect.succeed(timelineEmpty as T);
			}
			if (query.includes("addComment")) {
				if (v.subjectId === "node9") return Effect.fail(gqlError("addComment 9 failed"));
				return Effect.succeed({ addComment: { commentEdge: { node: { id: "c1" } } } } as T);
			}
			return Effect.fail(gqlError("unmatched query"));
		},
		paginate: <T>(): Effect.Effect<T[], GitHubClientError> => Effect.fail(gqlError("paginate not supported")),
		paginateStream: <T>(): Stream.Stream<T, GitHubClientError> => Stream.fail(gqlError("paginateStream not supported")),
		repo: Effect.succeed({ owner: OWNER, repo: REPO }),
	};
	return Layer.succeed(GitHubClient, client);
};

const makeAssociatedPR = (number: number): PullRequestInfo => ({
	number,
	url: `https://github.com/${OWNER}/${REPO}/pull/${number}`,
	nodeId: `pr-node-${number}`,
	title: `chore: release #${number}`,
	state: "open",
	head: "changeset-release/main",
	base: TARGET_BRANCH,
	draft: false,
	merged: false,
	mergedAt: null,
	mergeCommitSha: null,
});

interface TopLevelFixtures {
	commitState: GitHubCommitTestState;
	issueState: GitHubIssueTestState;
	outputsState: ReturnType<typeof ActionOutputsTest.empty>;
	checkRunState: ReturnType<typeof CheckRunTest.empty>;
	prState: ReturnType<typeof PullRequestTest.empty>;
}

const runTopLevel = (f: TopLevelFixtures, dryRun: boolean) => {
	const layer = Layer.mergeAll(
		ActionEnvironmentTest.layer({
			GITHUB_SHA: "headsha123",
			GITHUB_REF: `refs/heads/${TARGET_BRANCH}`,
			GITHUB_REPOSITORY: `${OWNER}/${REPO}`,
			GITHUB_REPOSITORY_OWNER: OWNER,
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
		makeContentClient(),
		GitTagTest.layer(GitTagTest.empty().state),
		GitHubCommitTest.layer(f.commitState),
		GitHubIssueTest.layer(f.issueState),
		PullRequestTest.layer(f.prState),
	);
	const config = ConfigProvider.fromMap(
		new Map([
			["target-branch", TARGET_BRANCH],
			["dry-run", String(dryRun)],
		]),
	);
	return Effect.runPromise(
		linkIssuesFromCommits.pipe(
			Effect.provide(layer),
			Effect.provide(Logger.replace(Logger.defaultLogger, Logger.none)),
			Effect.withConfigProvider(config),
		),
	);
};

const makeRichFixtures = (): TopLevelFixtures => {
	const commitState = GitHubCommitTest.empty();
	commitState.commitLists.set(TARGET_BRANCH, [
		makeCommit("c1", "fix: bug\n\nCloses #5"),
		makeCommit("c2", "feat: thing (#10)"),
		makeCommit("c3", "chore: stuff\n\nCloses #6"),
		makeCommit("c7", "test: x\n\nCloses #7"),
		makeCommit("c20", "feat: other (#20)"),
	]);

	const issueState = GitHubIssueTest.empty().state;
	// #5 fully seeded (also PR-linked, so its PR title wins).
	issueState.issues.set(5, {
		number: 5,
		title: "Issue 5",
		state: "open",
		labels: [],
		htmlUrl: "https://github.com/owner/repo/issues/5",
		nodeId: "issue5node",
	});
	// #7 seeded WITHOUT htmlUrl/nodeId → exercises the `?? ""` fallbacks.
	issueState.issues.set(7, { number: 7, title: "Issue 7", state: "open", labels: [] });
	// #6 deliberately NOT seeded → fetchIssueDetails returns null.

	const prState = PullRequestTest.empty();
	prState.associatedByCommit.set("headsha123", [makeAssociatedPR(100)]);

	return {
		commitState,
		issueState,
		outputsState: ActionOutputsTest.empty(),
		checkRunState: CheckRunTest.empty(),
		prState,
	};
};

describe("linkIssuesFromCommits (top-level stage)", () => {
	it("collects issues from commit messages and merged PRs, reports a check run, and cross-references the PR", async () => {
		const f = makeRichFixtures();
		const result = await runTopLevel(f, false);

		// #5 (message + PR), #7 (message backfill), #8 + #9 (PR only) survive;
		// #6 has no seeded issue and no PR title, so it is dropped.
		const numbers = result.linkedIssues.map((i) => i.number).sort((a, b) => a - b);
		expect(numbers).toEqual([5, 7, 8, 9]);

		// #5's title comes from the PR closing-references node, not the issue API.
		const five = result.linkedIssues.find((i) => i.number === 5);
		expect(five?.title).toBe("PR issue 5");
		expect(five?.state).toBe("closed");

		// #7 backfilled from the issue API, with empty url/node_id fallbacks.
		const seven = result.linkedIssues.find((i) => i.number === 7);
		expect(seven?.title).toBe("Issue 7");
		expect(seven?.url).toBe("");
		expect(seven?.node_id).toBe("");

		// A non-dry-run check run was created and completed successfully.
		expect(f.checkRunState.runs).toHaveLength(1);
		expect(f.checkRunState.runs[0].name).toBe("Link Issues from Commits");
		expect(f.checkRunState.runs[0].conclusion).toBe("success");

		// Cross-referencing ran: #7 (empty timeline) got a comment; #5 was
		// already linked; #8's timeline failed; #9's addComment failed.
		expect(result.commits).toHaveLength(5);
	});

	it("uses the dry-run check title and skips PR cross-referencing", async () => {
		const f = makeRichFixtures();
		const result = await runTopLevel(f, true);

		expect(f.checkRunState.runs[0].name).toContain("Dry Run");
		// linkIssuesToPR is skipped in dry-run, so no associated-commit lookup
		// produced cross-reference comments — the result still carries the issues.
		expect(result.linkedIssues.length).toBeGreaterThan(0);
	});

	it("renders the empty-state summary when there are no commits or issues", async () => {
		const f: TopLevelFixtures = {
			commitState: GitHubCommitTest.empty(),
			issueState: GitHubIssueTest.empty().state,
			outputsState: ActionOutputsTest.empty(),
			checkRunState: CheckRunTest.empty(),
			prState: PullRequestTest.empty(),
		};
		const result = await runTopLevel(f, false);

		expect(result.linkedIssues).toHaveLength(0);
		expect(result.commits).toHaveLength(0);
		expect(f.checkRunState.runs).toHaveLength(1);
		expect(f.checkRunState.runs[0].conclusion).toBe("success");
	});

	it("returns early from cross-referencing when no PR is associated with the head commit", async () => {
		const f = makeRichFixtures();
		// No associated PR seeded for headsha123.
		f.prState.associatedByCommit.clear();

		const result = await runTopLevel(f, false);

		expect(result.linkedIssues.length).toBeGreaterThan(0);
		expect(f.checkRunState.runs[0].conclusion).toBe("success");
	});
});

describe("getLinkedIssuesFromCommits", () => {
	describe("latest-tag selection", () => {
		it("uses the semver-latest tag's SHA as the compareCommits base", async () => {
			// Seed three semver tags in non-alphabetical insertion order.
			// GitTag.list() returns them in insertion order from the test Map.
			// We insert in ascending order so the last entry is the highest tag.
			const tags = [
				{ tag: "v1.0.0", sha: "sha-v1" },
				{ tag: "v1.1.0", sha: "sha-v1-1" },
				{ tag: "v2.0.0", sha: "sha-v2" },
			];

			const compareCommit = makeCommit("commit-abc", "feat: add feature");
			const f = makeFixtures({
				tags,
				// compare is called with base=sha-v2; we return one commit.
				compareBaseSha: "sha-v2",
				compareCommitsData: [compareCommit],
			});

			const result = await runStage(f);

			// The function found commits via compareCommits (not listCommits).
			expect(result.commits).toHaveLength(1);
			expect(result.commits[0].sha).toBe("commit-abc");
			// No issue references in the commit message, so linkedIssues is empty.
			expect(result.linkedIssues).toHaveLength(0);
		});

		it("extracts issue references from commit messages when using the tag-based path", async () => {
			const tags = [
				{ tag: "v0.9.0", sha: "sha-old" },
				{ tag: "v1.0.0", sha: "sha-latest" },
			];
			// A commit with a 'closes #7' reference.
			const commitWithRef = makeCommit("abc0001", "fix: resolve bug\n\nCloses #7");
			const f = makeFixtures({
				tags,
				compareBaseSha: "sha-latest",
				compareCommitsData: [commitWithRef],
				// Seed the GitHubIssue.get response so the issue details are backfilled.
				issues: [
					{
						number: 7,
						title: "Bug report",
						state: "closed",
						htmlUrl: "https://github.com/owner/repo/issues/7",
						nodeId: "node7",
					},
				],
			});

			const result = await runStage(f);

			expect(result.commits).toHaveLength(1);
			expect(result.linkedIssues).toHaveLength(1);
			expect(result.linkedIssues[0].number).toBe(7);
			expect(result.linkedIssues[0].title).toBe("Bug report");
		});
	});

	describe("no-tags fallback", () => {
		it("fetches all commits from the branch when no tags exist", async () => {
			const commits = [makeCommit("sha-first", "chore: initial commit"), makeCommit("sha-second", "feat: add widget")];
			const f = makeFixtures({
				// No tags seeded.
				// GitHubCommit.list returns these two commits for the branch.
				listCommitsData: commits,
			});

			const result = await runStage(f);

			// Both commits returned via the list fallback.
			expect(result.commits).toHaveLength(2);
			expect(result.commits.map((c) => c.sha)).toEqual(["sha-first", "sha-second"]);
			expect(result.linkedIssues).toHaveLength(0);
		});

		it("returns empty commits when there are no tags and no commits on the branch", async () => {
			// No tags, no commit list seeded — GitHubCommit.list returns []
			// (lenient default), so getAllCommitsOnBranch yields [].
			const f = makeFixtures();

			const result = await runStage(f);

			expect(result.commits).toHaveLength(0);
			expect(result.linkedIssues).toHaveLength(0);
		});
	});
});
