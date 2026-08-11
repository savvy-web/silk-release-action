/**
 * Fixture tests for the link-issues-from-commits module.
 *
 * @remarks
 * Everything runs through kit seams: `GitHubCommit`, `GitHubIssue`,
 * `PullRequest` and `CheckRun` `layerTest` doubles over one mutable fixture.
 * The three hand-written GraphQL documents the predecessor carried are gone —
 * `GitHubIssue.linkedIssues`, `GitHubIssue.isCrossReferencedBy` and
 * `GitHubIssue.comment` own them — so there is no `GitHubClient` here at all.
 *
 * What is pinned here is what this module decides, none of it visible to the
 * typechecker:
 *
 * 1. **The release boundary is the last merged release PR, not a tag.** The
 *    version-ordering test below is the regression guard for the production
 *    defect: a tag lookup ordered monorepo tags by version, which is not the
 *    same as by recency, and pinned the boundary behind the actual last
 *    release for as long as one package held the highest version.
 * 2. **No merged release PR takes the list path**, rather than comparing
 *    against nothing.
 * 3. **A `PullRequest.list` failure degrades to the list path**, rather than
 *    failing the stage.
 * 4. **`isCrossReferencedBy` gates the comment.** Without the guard a re-run
 *    comments a second time on every linked issue.
 */

import type { CheckRunOutput, IssueInfo, PullRequestInfo } from "@effected/github";
import {
	CheckRun,
	CheckRunRef,
	CommitComparison,
	CommitSummary,
	GitHubCommit,
	GitHubError,
	GitHubIssue,
	LinkedIssue as KitLinkedIssue,
	PullRequest,
	Repo,
	RepoRef,
} from "@effected/github";
import { ActionEnvironment, ActionOutputs, DryRun } from "@effected/github-actions";
import { Effect, Layer, Logger, Option } from "effect";
import { beforeEach, describe, expect, it } from "vitest";
import type { LinkIssuesResult } from "../src/utils/link-issues-from-commits.js";
import { getLinkedIssuesFromCommits, linkIssuesFromCommits } from "../src/utils/link-issues-from-commits.js";

const OWNER = "owner";
const REPO = "repo";
const TARGET_BRANCH = "main";
const RELEASE_BRANCH = "changeset-release/main";
const HEAD_SHA = "headsha123";

// --- fixture builders ----------------------------------------------------

const commit = (sha: string, message: string, author = "Test Author"): CommitSummary =>
	CommitSummary.make({
		sha,
		message,
		author,
		url: `https://github.com/${OWNER}/${REPO}/commit/${sha}`,
		// Required field now. Nothing here reads it, so an empty list — a root
		// commit — is the honest value rather than an invented parent.
		parents: [],
	});

/**
 * A closed pull request as `PullRequest.list` would return it.
 *
 * @remarks
 * Defaults describe a **merged release PR** — the shape the boundary lookup is
 * looking for — so each test overrides only the one field it is about.
 */
const releasePr = (
	number: number,
	mergeCommitSha: string | undefined,
	overrides: { head?: string; merged?: boolean } = {},
): PullRequestInfo =>
	({
		number,
		nodeId: `PR_${number}`,
		url: `https://github.com/${OWNER}/${REPO}/pull/${number}`,
		title: `chore: release #${number}`,
		state: "closed",
		head: overrides.head ?? RELEASE_BRANCH,
		headSha: `head-${number}`,
		base: TARGET_BRANCH,
		baseSha: `base-${number}`,
		draft: false,
		merged: overrides.merged ?? true,
		mergedAt: Option.none(),
		...(mergeCommitSha === undefined ? {} : { mergeCommitSha }),
	}) as unknown as PullRequestInfo;

/** The open release pull request, as `PullRequest.list({ state: "open" })` sees it. */
const openReleasePr = (number: number): PullRequestInfo =>
	({
		number,
		nodeId: `PR_${number}`,
		url: `https://github.com/${OWNER}/${REPO}/pull/${number}`,
		title: `chore: release #${number}`,
		state: "open",
		head: RELEASE_BRANCH,
		headSha: `head-${number}`,
		base: TARGET_BRANCH,
		baseSha: `base-${number}`,
		draft: false,
		merged: false,
		mergedAt: Option.none(),
	}) as unknown as PullRequestInfo;

const issueInfo = (number: number, title: string, state: "open" | "closed" = "open"): IssueInfo =>
	({
		number,
		title,
		state,
		labels: [],
		url: `https://github.com/${OWNER}/${REPO}/issues/${number}`,
		nodeId: `I_${number}`,
	}) as unknown as IssueInfo;

const linkedIssue = (number: number, title: string, state = "OPEN"): KitLinkedIssue =>
	KitLinkedIssue.make({
		number,
		title,
		state,
		url: `https://github.com/${OWNER}/${REPO}/issues/${number}`,
		nodeId: `PRI_${number}`,
		userLinked: false,
	});

const associatedPr = (number: number): PullRequestInfo =>
	({
		number,
		nodeId: `PR_${number}`,
		url: `https://github.com/${OWNER}/${REPO}/pull/${number}`,
		title: `chore: release #${number}`,
		state: "open",
		head: "changeset-release/main",
		base: TARGET_BRANCH,
		draft: false,
		merged: false,
		mergedAt: Option.none(),
	}) as unknown as PullRequestInfo;

interface Fixtures {
	/** What `PullRequest.list` returns. `"fail"` makes the call fail instead. */
	releasePrs: PullRequestInfo[] | "fail";
	/** Keyed `${base}...${head}` for `GitHubCommit.compare`. */
	comparisons: Map<string, CommitSummary[]>;
	/** Keyed by ref for `GitHubCommit.list`. */
	commitLists: Map<string, CommitSummary[]>;
	issues: Map<number, IssueInfo>;
	linked: Map<number, KitLinkedIssue[]>;
	/** Issue numbers already cross-referenced by the PR. */
	crossReferenced: Set<number>;
	/** Issue numbers `isCrossReferencedBy` should fail for. */
	crossRefFailures: Set<number>;
	/** Issue numbers `comment` should fail for. */
	commentFailures: Set<number>;
	/** Every `GitHubIssue.comment` call, in order. */
	comments: Array<{ number: number; body: string }>;
	associated: Map<string, PullRequestInfo[]>;
	completed: Array<{ conclusion: string; output: CheckRunOutput | undefined }>;
	summaries: string[];
}

const makeFixtures = (params: Partial<Fixtures> = {}): Fixtures => ({
	releasePrs: params.releasePrs ?? [],
	comparisons: params.comparisons ?? new Map(),
	commitLists: params.commitLists ?? new Map(),
	issues: params.issues ?? new Map(),
	linked: params.linked ?? new Map(),
	crossReferenced: params.crossReferenced ?? new Set(),
	crossRefFailures: params.crossRefFailures ?? new Set(),
	commentFailures: params.commentFailures ?? new Set(),
	comments: [],
	associated: params.associated ?? new Map(),
	completed: [],
	summaries: [],
});

/** Every `GitHubCommit.compare` call, recorded so the base can be asserted. */
const compareCalls: Array<{ base: string; head: string }> = [];

/**
 * Every `PullRequest.list` call, recorded so the filter can be asserted.
 *
 * @remarks
 * `head` is expected to be **absent**: GitHub wants an `owner:ref` there while
 * the projection returns a bare ref, so the head branch is matched locally.
 * Passing it would silently return nothing.
 */
const listCalls: Array<{ base: string | undefined; state: string | undefined; head: string | undefined }> = [];

/** Clears both module-level recorders; installed as a `beforeEach` in each suite. */
const resetRecorders = (): void => {
	compareCalls.length = 0;
	listCalls.length = 0;
};

const gitHubServices = (f: Fixtures): Layer.Layer<GitHubCommit | GitHubIssue | PullRequest | Repo> =>
	Layer.mergeAll(
		GitHubCommit.layerTest({
			compare: (base, head) =>
				Effect.sync(() => {
					compareCalls.push({ base, head });
					return CommitComparison.make({
						status: "ahead",
						aheadBy: 0,
						behindBy: 0,
						commits: f.comparisons.get(`${base}...${head}`) ?? [],
						files: [],
					});
				}),
			list: (options) => Effect.succeed(f.commitLists.get(options?.ref ?? "") ?? []),
		}),
		GitHubIssue.layerTest({
			get: (number) => {
				const found = f.issues.get(number);
				return found === undefined
					? Effect.fail(GitHubError.notFound("GitHubIssue.get", `issue ${number}`))
					: Effect.succeed(found);
			},
			linkedIssues: (prNumber) => Effect.succeed(f.linked.get(prNumber) ?? []),
			isCrossReferencedBy: (issueNumber) =>
				f.crossRefFailures.has(issueNumber)
					? Effect.fail(GitHubError.rejected("GitHubIssue.isCrossReferencedBy", 500, "boom") as never)
					: Effect.succeed(f.crossReferenced.has(issueNumber)),
			comment: (number, body) =>
				f.commentFailures.has(number)
					? Effect.fail(GitHubError.rejected("GitHubIssue.comment", 403, "forbidden"))
					: Effect.sync(() => {
							f.comments.push({ number, body });
							return f.comments.length;
						}),
		}),
		PullRequest.layerTest({
			list: (options) =>
				Effect.sync(() => {
					listCalls.push({ base: options?.base, state: options?.state, head: options?.head });
				}).pipe(
					Effect.andThen(
						f.releasePrs === "fail"
							? Effect.fail(GitHubError.rejected("PullRequest.list", 500, "boom"))
							: // Filtered by state, as GitHub does: the boundary lookup asks for
								// closed PRs, the release-PR lookup for open ones.
								Effect.succeed(f.releasePrs.filter((pr) => options?.state === undefined || pr.state === options.state)),
					),
				),
			listAssociatedWithCommit: (sha) => Effect.succeed(f.associated.get(sha) ?? []),
		}),
		Layer.succeed(Repo, RepoRef.make({ owner: OWNER, repo: REPO })),
	);

const runCollect = (
	f: Fixtures,
): Promise<{
	linkedIssues: ReadonlyArray<{
		number: number;
		title: string;
		state: string;
		url: string;
		commits: ReadonlyArray<string>;
	}>;
}> =>
	Effect.runPromise(
		getLinkedIssuesFromCommits(TARGET_BRANCH, RELEASE_BRANCH).pipe(
			Effect.provide(gitHubServices(f)),
			Effect.provide(Logger.layer([])),
		),
	);

const runStage = (f: Fixtures, dryRun = false): Promise<LinkIssuesResult> => {
	const layer = Layer.mergeAll(
		gitHubServices(f),
		ActionEnvironment.layerTest({
			GITHUB_SHA: HEAD_SHA,
			GITHUB_REF: `refs/heads/${TARGET_BRANCH}`,
			GITHUB_REPOSITORY: `${OWNER}/${REPO}`,
			GITHUB_REPOSITORY_OWNER: OWNER,
			GITHUB_WORKSPACE: "/workspace",
			GITHUB_EVENT_NAME: "push",
			GITHUB_EVENT_PATH: "",
			GITHUB_RUN_ID: "1",
			GITHUB_RUN_NUMBER: "1",
			GITHUB_ACTOR: "test",
			GITHUB_SERVER_URL: "https://github.com",
			GITHUB_API_URL: "https://api.github.com",
		}),
		ActionOutputs.layerTest({
			summary: (content) =>
				Effect.sync(() => {
					f.summaries.push(content);
				}),
		}),
		CheckRun.layerTest({
			create: (name) =>
				Effect.succeed(
					CheckRunRef.make({ id: 77, name, url: "https://github.com/owner/repo/runs/77", status: "in_progress" }),
				),
			complete: (_id, conclusion, output) =>
				Effect.sync(() => {
					f.completed.push({ conclusion, output });
				}),
		}),
	);
	// Runner-shaped input names. The bare-name provider this replaces only
	// worked because `Config.string` read the plain key; `target-branch` was
	// equally mis-keyed and stayed invisible because its default is also "main".
	// Branch names are arguments now; `dry-run` comes from the `DryRun` service.
	// The old arrangement set only `INPUT_TARGET-BRANCH`, leaving `releaseBranch`
	// to fall through to its default — so the release-branch value the stage used
	// was never actually stated by the test. It is explicit here.
	const refs = { releaseBranch: RELEASE_BRANCH, targetBranch: TARGET_BRANCH };
	return Effect.runPromise(
		linkIssuesFromCommits(refs).pipe(
			Effect.provide(layer),
			Effect.provide(Logger.layer([])),
			Effect.provide(DryRun.layerFrom(dryRun)),
		),
	);
};

// --- getLinkedIssuesFromCommits ------------------------------------------

describe("getLinkedIssuesFromCommits", () => {
	// Both recorders are module-level and shared across the whole file. Resetting
	// them here rather than by hand at the top of individual cases means a new
	// test that asserts on them cannot silently inherit the previous test's
	// entries — a false green or a spurious failure depending on suite order.
	beforeEach(resetRecorders);

	it("compares against the merge commit of the last merged release PR", async () => {
		const f = makeFixtures({
			releasePrs: [releasePr(245, "sha-245")],
			comparisons: new Map([[`sha-245...${TARGET_BRANCH}`, [commit("commit-abc", "feat: add feature")]]]),
			// Seeded but must NOT be read — the release-PR path wins.
			commitLists: new Map([[TARGET_BRANCH, [commit("from-list", "chore: never read")]]]),
		});

		const result = await runCollect(f);

		expect(compareCalls).toEqual([{ base: "sha-245", head: TARGET_BRANCH }]);
		expect(result.linkedIssues).toHaveLength(0);
	});

	it("filters the head branch locally rather than through the list option", async () => {
		const f = makeFixtures({ releasePrs: [releasePr(245, "sha-245")] });

		await runCollect(f);

		// `head` must be absent on BOTH calls. GitHub expects `owner:ref` there
		// while the projection carries the bare ref, so passing it returns nothing
		// at all — the boundary would silently fall back to walking the whole
		// branch, and the release PR would never be found.
		expect(listCalls).toEqual([
			{ base: TARGET_BRANCH, state: "closed", head: undefined },
			{ base: TARGET_BRANCH, state: "open", head: undefined },
		]);
	});

	it("picks the newest release PR by number, not by any version ordering", async () => {
		const f = makeFixtures({
			// The regression guard. Release #244 published the package holding the
			// repository's numerically highest version, #245 published lower-versioned
			// ones. A tag lookup ordered by version chose #244 and pulled #245's own
			// merge commit into the range, re-harvesting issues it had already closed
			// — and stayed pinned there for every release afterwards.
			releasePrs: [releasePr(244, "sha-244"), releasePr(245, "sha-245")],
			comparisons: new Map([[`sha-245...${TARGET_BRANCH}`, [commit("commit-abc", "feat: add feature")]]]),
		});

		await runCollect(f);

		expect(compareCalls).toEqual([{ base: "sha-245", head: TARGET_BRANCH }]);
	});

	it("ignores closed-but-unmerged PRs and PRs from another head branch", async () => {
		const f = makeFixtures({
			releasePrs: [
				// Higher-numbered but abandoned: closed without merging.
				releasePr(250, "sha-250", { merged: false }),
				// Higher-numbered but not a release at all.
				releasePr(249, "sha-249", { head: "feat/something" }),
				releasePr(245, "sha-245"),
			],
			comparisons: new Map([[`sha-245...${TARGET_BRANCH}`, [commit("commit-abc", "feat: add feature")]]]),
		});

		await runCollect(f);

		expect(compareCalls).toEqual([{ base: "sha-245", head: TARGET_BRANCH }]);
	});

	it("skips a merged release PR carrying no merge commit SHA", async () => {
		const f = makeFixtures({
			releasePrs: [releasePr(246, undefined), releasePr(245, "sha-245")],
			comparisons: new Map([[`sha-245...${TARGET_BRANCH}`, [commit("commit-abc", "feat: add feature")]]]),
		});

		await runCollect(f);

		expect(compareCalls).toEqual([{ base: "sha-245", head: TARGET_BRANCH }]);
	});

	it("falls back to listing the branch when nothing has been released yet", async () => {
		const f = makeFixtures({
			releasePrs: [],
			commitLists: new Map([
				[TARGET_BRANCH, [commit("sha-first", "chore: initial"), commit("sha-second", "feat: widget")]],
			]),
		});

		const result = await runCollect(f);

		// No boundary, so `compare` was never reached.
		expect(compareCalls).toHaveLength(0);
		expect(result.linkedIssues).toHaveLength(0);
	});

	it("degrades to the list path when listing pull requests fails outright", async () => {
		const f = makeFixtures({
			releasePrs: "fail",
			commitLists: new Map([[TARGET_BRANCH, [commit("sha-only", "fix: bug\n\nCloses #5")]]]),
			issues: new Map([[5, issueInfo(5, "Issue 5")]]),
		});

		const result = await runCollect(f);

		expect(compareCalls).toHaveLength(0);
		expect(result.linkedIssues.map((i) => i.number)).toEqual([5]);
	});

	it("backfills a message-only issue reference from the issue API", async () => {
		const f = makeFixtures({
			releasePrs: [releasePr(240, "sha-latest")],
			comparisons: new Map([[`sha-latest...${TARGET_BRANCH}`, [commit("abc0001", "fix: resolve bug\n\nCloses #7")]]]),
			issues: new Map([[7, issueInfo(7, "Bug report")]]),
		});

		const result = await runCollect(f);

		expect(result.linkedIssues).toHaveLength(1);
		expect(result.linkedIssues[0]).toMatchObject({
			number: 7,
			title: "Bug report",
			state: "open",
			url: `https://github.com/${OWNER}/${REPO}/issues/7`,
		});
	});

	it("drops an issue that is already closed", async () => {
		const f = makeFixtures({
			releasePrs: [releasePr(240, "sha-latest")],
			comparisons: new Map([
				[
					`sha-latest...${TARGET_BRANCH}`,
					[commit("abc0001", "fix: resolve bug\n\nCloses #7"), commit("abc0002", "fix: other\n\nCloses #8")],
				],
			]),
			issues: new Map([
				[7, issueInfo(7, "Already shipped", "closed")],
				[8, issueInfo(8, "Still open")],
			]),
		});

		const result = await runCollect(f);

		// A closed issue reaches the map honestly — an earlier release's merge
		// commit is a real merge commit and its PR really did close it — but this
		// release does not close it again.
		expect(result.linkedIssues.map((i) => i.number)).toEqual([8]);
	});

	it("drops a closed issue reported through a merged PR's linked issues", async () => {
		const f = makeFixtures({
			releasePrs: [releasePr(240, "sha-latest")],
			comparisons: new Map([[`sha-latest...${TARGET_BRANCH}`, [commit("abc0001", "release: previous (#245)")]]]),
			linked: new Map([[245, [linkedIssue(170, "Shipped last time", "CLOSED"), linkedIssue(171, "Open work")]]]),
		});

		const result = await runCollect(f);

		// The production shape: a previous release PR inside the range still
		// reports what it closed. GraphQL hands back `CLOSED`; pass 2 lowercases it
		// on the way in, which is what makes the filter see it at all.
		expect(result.linkedIssues.map((i) => i.number)).toEqual([171]);
	});

	it("includes an issue attached to the release PR but reachable from no commit", async () => {
		const f = makeFixtures({
			releasePrs: [releasePr(245, "sha-245"), openReleasePr(251)],
			comparisons: new Map([[`sha-245...${TARGET_BRANCH}`, [commit("abc0001", "fix: bug\n\nCloses #7")]]]),
			issues: new Map([[7, issueInfo(7, "From a commit")]]),
			// #253 is on the release PR itself — attached by hand after the body was
			// written. No commit mentions it and no merge commit's PR reports it, so
			// only the release-PR lookup finds it. Phase 3 closes it either way.
			linked: new Map([[251, [linkedIssue(253, "Attached by hand")]]]),
		});

		const result = await runCollect(f);

		expect(result.linkedIssues.map((i) => i.number).sort((a, b) => a - b)).toEqual([7, 253]);
	});

	it("does not double-count an issue both attached to the release PR and found in a commit", async () => {
		const f = makeFixtures({
			releasePrs: [releasePr(245, "sha-245"), openReleasePr(251)],
			comparisons: new Map([[`sha-245...${TARGET_BRANCH}`, [commit("abc0001", "fix: bug\n\nCloses #7")]]]),
			issues: new Map([[7, issueInfo(7, "From a commit")]]),
			linked: new Map([[251, [linkedIssue(7, "Same issue, attached too")]]]),
		});

		const result = await runCollect(f);

		expect(result.linkedIssues.map((i) => i.number)).toEqual([7]);
		// The commit association is the richer one and must survive the union.
		expect(result.linkedIssues[0]?.commits).toEqual(["abc0001"]);
	});

	it("drops a closed issue attached to the release PR", async () => {
		const f = makeFixtures({
			releasePrs: [releasePr(245, "sha-245"), openReleasePr(251)],
			comparisons: new Map([[`sha-245...${TARGET_BRANCH}`, []]]),
			linked: new Map([[251, [linkedIssue(253, "Already shipped", "CLOSED")]]]),
		});

		const result = await runCollect(f);

		expect(result.linkedIssues).toHaveLength(0);
	});

	it("drops a message-only reference whose issue cannot be fetched", async () => {
		const f = makeFixtures({
			commitLists: new Map([[TARGET_BRANCH, [commit("c1", "chore: stuff\n\nCloses #6")]]]),
		});

		const result = await runCollect(f);

		expect(result.linkedIssues).toHaveLength(0);
	});

	it("prefers the PR's linked-issue title over the issue API's", async () => {
		const f = makeFixtures({
			commitLists: new Map([
				[TARGET_BRANCH, [commit("c1", "fix: bug\n\nCloses #5"), commit("c2", "feat: thing (#10)")]],
			]),
			linked: new Map([[10, [linkedIssue(5, "PR issue 5"), linkedIssue(8, "PR issue 8")]]]),
			issues: new Map([[5, issueInfo(5, "Issue 5 from the issue API")]]),
		});

		const result = await runCollect(f);

		const five = result.linkedIssues.find((i) => i.number === 5);
		expect(five?.title).toBe("PR issue 5");
		// `state` is lowercased from the GraphQL enum.
		expect(five?.state).toBe("open");
		expect(result.linkedIssues.map((i) => i.number).sort((a, b) => a - b)).toEqual([5, 8]);
	});
});

// --- linkIssuesFromCommits (top-level stage) -----------------------------

describe("linkIssuesFromCommits", () => {
	beforeEach(resetRecorders);

	const richFixtures = (): Fixtures =>
		makeFixtures({
			commitLists: new Map([
				[
					TARGET_BRANCH,
					[
						commit("c1", "fix: bug\n\nCloses #5"),
						commit("c2", "feat: thing (#10)"),
						commit("c7", "test: x\n\nCloses #7"),
					],
				],
			]),
			linked: new Map([[10, [linkedIssue(8, "PR issue 8")]]]),
			issues: new Map([
				[5, issueInfo(5, "Issue 5")],
				[7, issueInfo(7, "Issue 7")],
			]),
			associated: new Map([[HEAD_SHA, [associatedPr(100)]]]),
		});

	it("reports a successful check run and comments on every not-yet-linked issue", async () => {
		const f = richFixtures();

		const result = await runStage(f);

		expect(result.linkedIssues.map((i) => i.number).sort((a, b) => a - b)).toEqual([5, 7, 8]);
		expect(result.checkId).toBe(77);
		expect(f.completed).toHaveLength(1);
		expect(f.completed[0].conclusion).toBe("success");
		expect(f.comments.map((c) => c.number).sort((a, b) => a - b)).toEqual([5, 7, 8]);
		expect(f.comments[0].body).toBe("🔗 Linked to release PR #100");
		expect(f.summaries).toHaveLength(1);
	});

	it("does not comment again on an issue already cross-referenced by the PR", async () => {
		// THE IDEMPOTENCE GUARD. Without `isCrossReferencedBy`, re-running the
		// workflow posts a duplicate "Linked to release PR" comment every time.
		const f = richFixtures();
		f.crossReferenced.add(5);
		f.crossReferenced.add(8);

		await runStage(f);

		expect(f.comments.map((c) => c.number)).toEqual([7]);
	});

	it("skips an issue whose cross-reference lookup fails, and keeps going", async () => {
		const f = richFixtures();
		f.crossRefFailures.add(5);

		await runStage(f);

		expect(f.comments.map((c) => c.number).sort((a, b) => a - b)).toEqual([7, 8]);
	});

	it("keeps going when one comment fails", async () => {
		const f = richFixtures();
		f.commentFailures.add(7);

		const result = await runStage(f);

		expect(f.comments.map((c) => c.number).sort((a, b) => a - b)).toEqual([5, 8]);
		expect(result.linkedIssues).toHaveLength(3);
	});

	it("uses the dry-run check title and posts no comments", async () => {
		const f = richFixtures();

		const result = await runStage(f, true);

		expect(result.linkedIssues.length).toBeGreaterThan(0);
		expect(f.comments).toHaveLength(0);
	});

	it("returns early from cross-referencing when no PR is associated with the head commit", async () => {
		const f = richFixtures();
		f.associated.clear();

		const result = await runStage(f);

		expect(result.linkedIssues.length).toBeGreaterThan(0);
		expect(f.comments).toHaveLength(0);
		expect(f.completed[0].conclusion).toBe("success");
	});

	it("renders the empty-state summary when there are no commits", async () => {
		const f = makeFixtures();

		const result = await runStage(f);

		expect(result.linkedIssues).toHaveLength(0);
		expect(result.commits).toHaveLength(0);
		expect(f.completed[0].conclusion).toBe("success");
		expect(f.summaries[0]).toContain("_No commits found_");
	});
});
