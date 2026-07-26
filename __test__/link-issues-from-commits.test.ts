/**
 * Fixture tests for the link-issues-from-commits module.
 *
 * @remarks
 * Everything runs through kit seams: `GitTag`, `GitHubCommit`, `GitHubIssue`,
 * `PullRequest` and `CheckRun` `layerTest` doubles over one mutable fixture.
 * The three hand-written GraphQL documents the predecessor carried are gone —
 * `GitHubIssue.linkedIssues`, `GitHubIssue.isCrossReferencedBy` and
 * `GitHubIssue.comment` own them — so there is no `GitHubClient` here at all.
 *
 * The tag-selection unit tests are gone with `getLatestTagSha`: picking the
 * semver-highest tag is `GitTag.latestSemver`'s job now, and re-testing it here
 * would be testing the kit. What is pinned instead is what this module still
 * decides, none of it visible to the typechecker:
 *
 * 1. **`latestSemver` returning `Option.none` takes the list path.** The
 *    result is an `Option`, not a nullable — the branch is `Option.isSome`.
 * 2. **A `latestSemver` failure degrades to the list path**, rather than
 *    failing the stage.
 * 3. **`isCrossReferencedBy` gates the comment.** Without the guard a re-run
 *    comments a second time on every linked issue.
 */

import type { CheckRunOutput, IssueInfo, PullRequestInfo, SemverTag } from "@effected/github";
import {
	CheckRun,
	CheckRunRef,
	CommitComparison,
	CommitSummary,
	GitHubCommit,
	GitHubError,
	GitHubIssue,
	GitTag,
	LinkedIssue as KitLinkedIssue,
	SemverTag as KitSemverTag,
	PullRequest,
	Repo,
	RepoRef,
} from "@effected/github";
import { ActionEnvironment, ActionOutputs } from "@effected/github-actions";
import { SemVer } from "@effected/semver";
import { ConfigProvider, Effect, Layer, Logger, Option } from "effect";
import { describe, expect, it } from "vitest";
import type { LinkIssuesResult } from "../src/utils/link-issues-from-commits.js";
import { getLinkedIssuesFromCommits, linkIssuesFromCommits } from "../src/utils/link-issues-from-commits.js";

const OWNER = "owner";
const REPO = "repo";
const TARGET_BRANCH = "main";
const HEAD_SHA = "headsha123";

// --- fixture builders ----------------------------------------------------

const commit = (sha: string, message: string, author = "Test Author"): CommitSummary =>
	CommitSummary.make({ sha, message, author, url: `https://github.com/${OWNER}/${REPO}/commit/${sha}` });

const semverTag = (tag: string, sha: string, [major, minor, patch]: [number, number, number]): SemverTag =>
	KitSemverTag.make({
		tag,
		sha,
		version: SemVer.make({ major, minor, patch, prerelease: [], build: [] }),
	});

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
	/** `GitTag.latestSemver`'s answer. `null` makes the call fail instead. */
	latest: SemverTag | null | "fail";
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
	latest: params.latest ?? null,
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

const gitHubServices = (f: Fixtures): Layer.Layer<GitHubCommit | GitHubIssue | GitTag | PullRequest | Repo> =>
	Layer.mergeAll(
		GitTag.layerTest({
			latestSemver: () =>
				f.latest === "fail"
					? Effect.fail(GitHubError.rejected("GitTag.latestSemver", 500, "boom"))
					: Effect.succeed(Option.fromNullOr(f.latest)),
		}),
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
			listAssociatedWithCommit: (sha) => Effect.succeed(f.associated.get(sha) ?? []),
		}),
		Layer.succeed(Repo, RepoRef.make({ owner: OWNER, repo: REPO })),
	);

const runCollect = (
	f: Fixtures,
): Promise<{ linkedIssues: ReadonlyArray<{ number: number; title: string; state: string; url: string }> }> =>
	Effect.runPromise(
		getLinkedIssuesFromCommits(TARGET_BRANCH).pipe(Effect.provide(gitHubServices(f)), Effect.provide(Logger.layer([]))),
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
	const config = ConfigProvider.fromUnknown({ "target-branch": TARGET_BRANCH, "dry-run": String(dryRun) });
	return Effect.runPromise(
		linkIssuesFromCommits.pipe(
			Effect.provide(layer),
			Effect.provide(Logger.layer([])),
			Effect.provide(ConfigProvider.layer(config)),
		),
	);
};

// --- getLinkedIssuesFromCommits ------------------------------------------

describe("getLinkedIssuesFromCommits", () => {
	it("compares against the latest semver tag's SHA when there is one", async () => {
		compareCalls.length = 0;
		const f = makeFixtures({
			latest: semverTag("v2.0.0", "sha-v2", [2, 0, 0]),
			comparisons: new Map([[`sha-v2...${TARGET_BRANCH}`, [commit("commit-abc", "feat: add feature")]]]),
			// Seeded but must NOT be read — the tag path wins.
			commitLists: new Map([[TARGET_BRANCH, [commit("from-list", "chore: never read")]]]),
		});

		const result = await runCollect(f);

		expect(compareCalls).toEqual([{ base: "sha-v2", head: TARGET_BRANCH }]);
		expect(result.linkedIssues).toHaveLength(0);
	});

	it("falls back to listing the branch when latestSemver is None", async () => {
		compareCalls.length = 0;
		const f = makeFixtures({
			latest: null,
			commitLists: new Map([
				[TARGET_BRANCH, [commit("sha-first", "chore: initial"), commit("sha-second", "feat: widget")]],
			]),
		});

		const result = await runCollect(f);

		// `latestSemver` answered `Option.none`, so `compare` was never reached.
		expect(compareCalls).toHaveLength(0);
		expect(result.linkedIssues).toHaveLength(0);
	});

	it("degrades to the list path when latestSemver fails outright", async () => {
		compareCalls.length = 0;
		const f = makeFixtures({
			latest: "fail",
			commitLists: new Map([[TARGET_BRANCH, [commit("sha-only", "fix: bug\n\nCloses #5")]]]),
			issues: new Map([[5, issueInfo(5, "Issue 5")]]),
		});

		const result = await runCollect(f);

		expect(compareCalls).toHaveLength(0);
		expect(result.linkedIssues.map((i) => i.number)).toEqual([5]);
	});

	it("backfills a message-only issue reference from the issue API", async () => {
		const f = makeFixtures({
			latest: semverTag("v1.0.0", "sha-latest", [1, 0, 0]),
			comparisons: new Map([[`sha-latest...${TARGET_BRANCH}`, [commit("abc0001", "fix: resolve bug\n\nCloses #7")]]]),
			issues: new Map([[7, issueInfo(7, "Bug report", "closed")]]),
		});

		const result = await runCollect(f);

		expect(result.linkedIssues).toHaveLength(1);
		expect(result.linkedIssues[0]).toMatchObject({
			number: 7,
			title: "Bug report",
			state: "closed",
			url: `https://github.com/${OWNER}/${REPO}/issues/7`,
		});
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
			linked: new Map([[10, [linkedIssue(5, "PR issue 5", "CLOSED"), linkedIssue(8, "PR issue 8")]]]),
			issues: new Map([[5, issueInfo(5, "Issue 5 from the issue API")]]),
		});

		const result = await runCollect(f);

		const five = result.linkedIssues.find((i) => i.number === 5);
		expect(five?.title).toBe("PR issue 5");
		// `state` is lowercased from the GraphQL enum.
		expect(five?.state).toBe("closed");
		expect(result.linkedIssues.map((i) => i.number).sort((a, b) => a - b)).toEqual([5, 8]);
	});
});

// --- linkIssuesFromCommits (top-level stage) -----------------------------

describe("linkIssuesFromCommits", () => {
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
