/**
 * Link issues to a release from commit history.
 *
 * @remarks
 * Walks commits since the last release tag (or all commits when there is
 * no tag) and harvests linked issues from two sources:
 *
 * 1. Conventional close-keyword references in commit messages
 *    (`closes #N`, `fixes #N`, `resolves #N`, plus their variants).
 * 2. GitHub's `closingIssuesReferences` GraphQL field on merged PRs —
 *    covers both keyword-linked and manually-linked-via-sidebar issues.
 *    `GitHubIssue.linkedIssues` owns that document.
 *
 * Top-level entry point `linkIssuesFromCommits` reports through a Check
 * Run and cross-references the linked issues on the active PR. The
 * helper `getLinkedIssuesFromCommits` returns just the data (used by
 * `create-release-branch`).
 */

import type { GitHubError, Repo } from "@effected/github";
import { CheckRun, CheckRunOutput, GitHubCommit, GitHubIssue, PullRequest } from "@effected/github";
import type { ActionEnvironmentError, ActionOutputError } from "@effected/github-actions";
import { ActionEnvironment, ActionInput, ActionOutputs } from "@effected/github-actions";
import { Config, Effect, Option } from "effect";
import { commitUrl, resolveServerUrl } from "./github-urls.js";
import { summaryWriter } from "./summary-writer.js";

/** Linked issue, with the SHA(s) of the commits that reference it. */
export interface LinkedIssue {
	number: number;
	title: string;
	state: string;
	url: string;
	node_id: string;
	commits: string[];
}

/** Commit info captured from the listing or comparison API. */
export interface CommitInfo {
	sha: string;
	message: string;
	author: string;
}

/** Aggregate result of the linkIssuesFromCommits stage. */
export interface LinkIssuesResult {
	linkedIssues: LinkedIssue[];
	commits: CommitInfo[];
	checkId: number;
	/** Web URL of the Link Issues check run, for the checks-table link. */
	htmlUrl: string;
}

const CLOSE_KEYWORD_PATTERN = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi;
const MERGE_COMMIT_PR_PATTERN = /\(#(\d+)\)$/m;

/**
 * Extract `closes #N` / `fixes #N` / `resolves #N` references from a
 * commit message.
 *
 * @internal
 */
const extractIssueReferences = (message: string): number[] => {
	const issues = new Set<number>();
	for (const match of message.matchAll(CLOSE_KEYWORD_PATTERN)) {
		const n = Number.parseInt(match[1], 10);
		if (!Number.isNaN(n)) issues.add(n);
	}
	return Array.from(issues);
};

/**
 * Extract a PR number from a GitHub merge-commit message
 * (`Title (#123)`).
 *
 * @internal
 */
const extractPRNumber = (message: string): number | null => {
	const match = message.match(MERGE_COMMIT_PR_PATTERN);
	return match ? Number.parseInt(match[1], 10) : null;
};

/**
 * The merge commit of the most recently merged release pull request, or
 * `Option.none` when this repository has not released through one yet.
 *
 * @remarks
 * **A tag lookup is the wrong instrument here, and this is the bug it caused.**
 * The predecessor asked `GitTag.latestSemver` for "the last release", which
 * orders tags by version. In a monorepo the per-package version lines are not
 * comparable — `@scope/a@5.0.25` outranks `@scope/b@2.3.7` numerically while
 * being several releases older. On `savvy-web/silk-integration` that selected
 * release #244's tag as the boundary for a run whose previous release was
 * actually #245, so #245's own merge commit fell *inside* the range and the
 * issues it had already closed were harvested into the next release.
 *
 * The compounding part was worse than the double count: the boundary was
 * **stuck**. Nothing advances it until some package out-bumps the highest
 * version anywhere in the repository, so every subsequent release walked a
 * range one release longer than the last and re-harvested every release in
 * between.
 *
 * `GitTag.list` is not the repair — GitHub returns tags grouped by name rather
 * than by creation, so its first entry is the alphabetically-last package's
 * newest version. The release pull request is the only boundary that means
 * "everything after this is unreleased" no matter how packages are versioned
 * or tags are named.
 *
 * @internal
 */
const lastReleaseBoundary = (
	targetBranch: string,
	releaseBranch: string,
): Effect.Effect<Option.Option<string>, never, PullRequest | Repo> =>
	Effect.gen(function* () {
		const pulls = yield* PullRequest;
		const result = yield* Effect.result(pulls.list({ base: targetBranch, state: "closed" }));
		if (result._tag === "Failure") {
			yield* Effect.logWarning(`Failed to list release pull requests: ${result.failure.reason}`);
			return Option.none<string>();
		}

		// The head branch is matched here rather than through `list`'s own `head`
		// option: GitHub expects an `owner:ref` there, while the projection hands
		// back the bare ref (`raw.head.ref`), so filtering locally compares like
		// with like instead of guessing at the qualified spelling.
		//
		// Highest number wins rather than latest `mergedAt`. Only one release PR
		// is open against a given head branch at a time and they merge in order,
		// so the numbers are already the merge order — and an integer comparison
		// cannot go wrong the way an absent or unparsed timestamp can.
		// `flatMap` rather than `filter` so the merge SHA arrives as a plain
		// `string`: `mergeCommitSha` is an optional key, and a predicate that
		// rules out `undefined` does not narrow the element type.
		const released = result.success
			.filter((pr) => pr.merged && pr.head === releaseBranch)
			.flatMap((pr) => (pr.mergeCommitSha === undefined ? [] : [{ number: pr.number, sha: pr.mergeCommitSha }]))
			.sort((a, b) => b.number - a.number);

		const newest = released[0];
		if (newest === undefined) {
			yield* Effect.logInfo(`No merged '${releaseBranch}' pull request found`);
			return Option.none<string>();
		}

		yield* Effect.logInfo(`Last release: PR #${newest.number} (${newest.sha})`);
		return Option.some(newest.sha);
	});

/**
 * Fetch all commits on a branch, paginated.
 *
 * @internal
 */
const getAllCommitsOnBranch = (branch: string): Effect.Effect<CommitInfo[], never, GitHubCommit | Repo> =>
	Effect.gen(function* () {
		const commits = yield* GitHubCommit;
		yield* Effect.logInfo(`Fetching all commits from ${branch} branch...`);

		const all = yield* commits.list({ ref: branch }).pipe(
			Effect.catch((e) =>
				Effect.gen(function* () {
					yield* Effect.logWarning(`Failed to fetch commits: ${e.reason}`);
					return [] as ReadonlyArray<{ sha: string; message: string; author: string }>;
				}),
			),
		);

		yield* Effect.logInfo(`Fetched total of ${all.length} commit(s) from ${branch}`);
		return all.map((c) => ({ sha: c.sha, message: c.message, author: c.author }));
	});

/**
 * Fetch all issues linked to a merged PR.
 *
 * @internal
 */
const getLinkedIssuesFromPR = (
	prNumber: number,
): Effect.Effect<
	Array<{ number: number; title: string; state: string; url: string; node_id: string }>,
	never,
	GitHubIssue | Repo
> =>
	Effect.gen(function* () {
		const issues = yield* GitHubIssue;
		const result = yield* Effect.result(issues.linkedIssues(prNumber));
		if (result._tag === "Failure") {
			yield* Effect.logWarning(`Failed to get linked issues for PR #${prNumber}: ${result.failure.reason}`);
			return [];
		}

		// `linkedIssues` returns every closing reference once, with `userLinked`
		// distinguishing sidebar links from inferred ones. The document this
		// replaced aliased the same connection twice and merged the two node
		// lists by number to reach the identical set.
		return result.success.map((issue) => ({
			number: issue.number,
			title: issue.title,
			state: issue.state,
			url: issue.url,
			node_id: issue.nodeId,
		}));
	});

/**
 * Fetch issue details for an issue we only found in commit-message text.
 *
 * @internal
 */
const fetchIssueDetails = (
	issueNumber: number,
): Effect.Effect<{ title: string; state: string; url: string; nodeId: string } | null, never, GitHubIssue | Repo> =>
	Effect.gen(function* () {
		const issues = yield* GitHubIssue;
		const result = yield* Effect.result(issues.get(issueNumber));
		if (result._tag === "Failure") {
			yield* Effect.logWarning(`Failed to fetch issue #${issueNumber}: ${result.failure.reason}`);
			return null;
		}
		const issue = result.success;
		return { title: issue.title, state: issue.state, url: issue.url, nodeId: issue.nodeId };
	});

/**
 * Walk commits since the last release tag, collect linked issues from
 * both close-keyword references and PR `closingIssuesReferences`.
 *
 * @public
 */
export const getLinkedIssuesFromCommits = (
	targetBranch: string,
	releaseBranch: string,
): Effect.Effect<
	{ linkedIssues: LinkedIssue[]; commits: CommitInfo[] },
	never,
	GitHubCommit | GitHubIssue | PullRequest | Repo
> =>
	Effect.gen(function* () {
		const commitsSvc = yield* GitHubCommit;
		const boundary = yield* lastReleaseBoundary(targetBranch, releaseBranch);

		let commits: CommitInfo[];
		if (Option.isSome(boundary)) {
			yield* Effect.logInfo(`Comparing ${boundary.value}...${targetBranch}`);
			const compareResult = yield* Effect.result(commitsSvc.compare(boundary.value, targetBranch));
			if (compareResult._tag === "Failure") {
				yield* Effect.logWarning(`Failed to compare commits: ${compareResult.failure.reason}`);
				commits = [];
			} else {
				commits = compareResult.success.commits.map((c) => ({ sha: c.sha, message: c.message, author: c.author }));
				yield* Effect.logInfo(`Found ${commits.length} commit(s) since last release`);
			}
		} else {
			yield* Effect.logInfo("No previous release - fetching all commits from branch");
			commits = yield* getAllCommitsOnBranch(targetBranch);
		}

		const issueMap = new Map<number, LinkedIssue>();

		// Pass 1: extract from commit messages.
		for (const commit of commits) {
			const refs = extractIssueReferences(commit.message);
			yield* Effect.logDebug(`Commit ${commit.sha.slice(0, 7)}: found ${refs.length} issue reference(s) in message`);
			for (const issueNumber of refs) {
				if (!issueMap.has(issueNumber)) {
					issueMap.set(issueNumber, { number: issueNumber, title: "", state: "", url: "", node_id: "", commits: [] });
				}
				const existing = issueMap.get(issueNumber);
				if (existing) existing.commits.push(commit.sha);
			}
		}

		// Pass 2: for each merge commit, query the linked issues on its PR.
		//
		// The count is computed up front so it can be logged *before* the
		// per-commit lines it describes. Printed afterwards it read as a total
		// for whatever came next.
		const mergeCommits = commits.filter((commit) => extractPRNumber(commit.message) !== null);
		yield* Effect.logInfo(`Checking ${mergeCommits.length} merged PR(s) for linked issues...`);
		for (const commit of mergeCommits) {
			const prNumber = extractPRNumber(commit.message);
			if (prNumber === null) continue;
			yield* Effect.logInfo(
				`  Commit ${commit.sha.slice(0, 7)}: "${commit.message.split("\n")[0]}" -> PR #${prNumber}`,
			);
			const linked = yield* getLinkedIssuesFromPR(prNumber);
			yield* Effect.logInfo(`  PR #${prNumber} has ${linked.length} linked issue(s)`);
			for (const issue of linked) {
				yield* Effect.logInfo(`    - Issue #${issue.number}: ${issue.title}`);
				if (!issueMap.has(issue.number)) {
					issueMap.set(issue.number, {
						number: issue.number,
						title: issue.title,
						state: issue.state.toLowerCase(),
						url: issue.url,
						node_id: issue.node_id,
						commits: [commit.sha],
					});
				} else {
					const existing = issueMap.get(issue.number);
					if (existing) {
						existing.title = issue.title;
						existing.state = issue.state.toLowerCase();
						existing.url = issue.url;
						existing.node_id = issue.node_id;
						if (!existing.commits.includes(commit.sha)) existing.commits.push(commit.sha);
					}
				}
			}
		}
		yield* Effect.logInfo(`Found ${issueMap.size} unique issue reference(s)`);

		// Pass 3: backfill details for issues only found via commit-message text,
		// and drop anything already closed.
		//
		// A closed issue is not part of this release. It reaches the map honestly —
		// an earlier release's merge commit is a legitimate merge commit, and its
		// pull request still reports the issues it closed — but announcing it again
		// would claim this release closes work that already shipped. Filtering here
		// rather than at each renderer keeps the check run, the PR description and
		// the branch links describing the same set.
		const linkedIssues: LinkedIssue[] = [];
		for (const [issueNumber, issue] of issueMap) {
			const resolved =
				issue.title !== ""
					? issue
					: yield* fetchIssueDetails(issueNumber).pipe(
							Effect.map((details) =>
								details === null
									? null
									: {
											number: issueNumber,
											title: details.title,
											state: details.state,
											url: details.url,
											node_id: details.nodeId,
											commits: issue.commits,
										},
							),
						);
			if (resolved === null) continue;

			if (resolved.state.toLowerCase() === "closed") {
				yield* Effect.logInfo(`- Issue #${issueNumber}: ${resolved.title} (closed — already released, skipping)`);
				continue;
			}

			linkedIssues.push(resolved);
			yield* Effect.logInfo(`✓ Issue #${issueNumber}: ${resolved.title} (${resolved.state})`);
		}

		return { linkedIssues, commits };
	});

/**
 * Cross-reference linked issues against the current PR by adding a
 * comment to each issue.
 *
 * @remarks
 * `GitHubIssue.isCrossReferencedBy` is the idempotence guard — without it
 * a re-run comments a second time on every issue.
 *
 * @internal
 */
const linkIssuesToPR = (
	linkedIssues: ReadonlyArray<LinkedIssue>,
): Effect.Effect<void, ActionEnvironmentError, ActionEnvironment | GitHubIssue | PullRequest | Repo> =>
	Effect.gen(function* () {
		const env = yield* ActionEnvironment;
		const issues = yield* GitHubIssue;
		const prSvc = yield* PullRequest;
		const { sha } = yield* env.github;

		yield* Effect.logInfo(`Looking for PR associated with commit ${sha}`);

		const prsResult = yield* Effect.result(prSvc.listAssociatedWithCommit(sha));

		if (prsResult._tag === "Failure") {
			yield* Effect.logWarning(`Failed to look up PR for commit: ${prsResult.failure.reason}`);
			return;
		}
		if (prsResult.success.length === 0) {
			yield* Effect.logWarning("No PR found for current commit, skipping issue linking");
			return;
		}

		const pr = prsResult.success[0];
		yield* Effect.logInfo(`Found ${prsResult.success.length} PR(s) associated with commit`);
		yield* Effect.logInfo(`Found PR #${pr.number}: ${pr.title}`);

		let linkedCount = 0;
		for (const issue of linkedIssues) {
			const crossRefResult = yield* Effect.result(issues.isCrossReferencedBy(issue.number, pr.number));

			if (crossRefResult._tag === "Failure") {
				yield* Effect.logWarning(`Failed to inspect issue #${issue.number} timeline: ${crossRefResult.failure.reason}`);
				continue;
			}

			if (crossRefResult.success) {
				yield* Effect.logInfo(`  Issue #${issue.number} already linked to PR #${pr.number}`);
				continue;
			}

			const addCommentResult = yield* Effect.result(
				issues.comment(issue.number, `🔗 Linked to release PR #${pr.number}`),
			);

			if (addCommentResult._tag === "Failure") {
				yield* Effect.logWarning(`  Failed to link issue #${issue.number}: ${addCommentResult.failure.reason}`);
				continue;
			}

			yield* Effect.logInfo(`  ✓ Added cross-reference comment to issue #${issue.number}`);
			linkedCount++;
		}

		if (linkedCount > 0) {
			yield* Effect.logInfo(`✓ Successfully linked ${linkedCount} issue(s) to PR #${pr.number}`);
		} else {
			yield* Effect.logInfo("All issues already linked to PR");
		}
	});

/**
 * Top-level stage Effect — gathers linked issues, reports through a
 * Check Run, and cross-references each issue on the active PR.
 *
 * @public
 */
export const linkIssuesFromCommits: Effect.Effect<
	LinkIssuesResult,
	ActionEnvironmentError | ActionOutputError | Config.ConfigError | GitHubError,
	ActionEnvironment | ActionOutputs | CheckRun | GitHubCommit | GitHubIssue | PullRequest | Repo
> = Effect.gen(function* () {
	const serverUrl = yield* resolveServerUrl();
	const env = yield* ActionEnvironment;
	const outputs = yield* ActionOutputs;
	const checks = yield* CheckRun;

	const targetBranch = yield* ActionInput.string("target-branch").pipe(Config.withDefault("main"));
	const releaseBranch = yield* ActionInput.string("release-branch").pipe(Config.withDefault("changeset-release/main"));
	const dryRun = yield* ActionInput.boolean("dry-run").pipe(Config.withDefault(false));

	const { sha, repository } = yield* env.github;
	const [owner, repo] = repository.split("/");

	yield* Effect.logInfo("Linking issues from commits");
	const { linkedIssues, commits } = yield* getLinkedIssuesFromCommits(targetBranch, releaseBranch);

	const checkTitle = dryRun ? "🧪 Link Issues from Commits (Dry Run)" : "Link Issues from Commits";
	const checkSummary =
		linkedIssues.length > 0
			? `Found ${linkedIssues.length} linked issue(s) from ${commits.length} commit(s)`
			: `No issue references found in ${commits.length} commit(s)`;

	const issuesContent =
		linkedIssues.length > 0
			? linkedIssues
					.map((issue) => `- ${issue.state === "open" ? "🟢" : "🟣"} #${issue.number} — ${issue.title}`)
					.join("\n")
			: "_No issue references found in commits_";

	const commitsContent =
		commits.length > 0
			? commits
					.map((commit) => {
						const shortSha = commit.sha.slice(0, 7);
						const commitLink = commitUrl(serverUrl, owner, repo, commit.sha);
						const firstLine = commit.message.split("\n")[0];
						return `[\`${shortSha}\`](${commitLink})\n> ${firstLine}`;
					})
					.join("\n\n")
			: "_No commits found_";

	const checkDetails = summaryWriter.build([
		{ heading: "🔗 Linked Issues", level: 3, content: issuesContent },
		{ heading: "📝 Commits Analyzed", level: 3, content: commitsContent },
	]);

	const { id: checkId, url: htmlUrl } = yield* checks.create(checkTitle, sha);
	yield* checks.complete(checkId, "success", CheckRunOutput.make({ title: checkSummary, summary: checkDetails }));
	yield* outputs.summary(checkDetails);

	if (linkedIssues.length > 0 && !dryRun) {
		yield* linkIssuesToPR(linkedIssues);
	}

	return { linkedIssues, commits, checkId, htmlUrl } satisfies LinkIssuesResult;
});
