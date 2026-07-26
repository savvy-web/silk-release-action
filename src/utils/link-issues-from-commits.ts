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
import { CheckRun, CheckRunOutput, GitHubCommit, GitHubIssue, GitTag, PullRequest } from "@effected/github";
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
 * The commit SHA of the newest version-shaped tag, or `Option.none` when
 * there is no such tag or the listing failed.
 *
 * @remarks
 * `includePrerelease` is on because this answers "what did we last ship",
 * not "what is the current stable line" — a prerelease tag is still a
 * release boundary for the purposes of walking commits since it.
 *
 * @internal
 */
const latestReleaseTagSha = Effect.gen(function* () {
	const gitTag = yield* GitTag;
	const result = yield* Effect.result(gitTag.latestSemver({ includePrerelease: true }));
	if (result._tag === "Failure") {
		yield* Effect.logWarning(`Failed to get latest tag: ${result.failure.reason}`);
		return Option.none<string>();
	}
	return Option.map(result.success, (tag) => tag.sha);
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
): Effect.Effect<
	{ linkedIssues: LinkedIssue[]; commits: CommitInfo[] },
	never,
	GitHubCommit | GitHubIssue | GitTag | Repo
> =>
	Effect.gen(function* () {
		const commitsSvc = yield* GitHubCommit;
		const latestTagSha = yield* latestReleaseTagSha;

		let commits: CommitInfo[];
		if (Option.isSome(latestTagSha)) {
			yield* Effect.logInfo(`Comparing ${latestTagSha.value}...${targetBranch}`);
			const compareResult = yield* Effect.result(commitsSvc.compare(latestTagSha.value, targetBranch));
			if (compareResult._tag === "Failure") {
				yield* Effect.logWarning(`Failed to compare commits: ${compareResult.failure.reason}`);
				commits = [];
			} else {
				commits = compareResult.success.commits.map((c) => ({ sha: c.sha, message: c.message, author: c.author }));
				yield* Effect.logInfo(`Found ${commits.length} commit(s) since last release`);
			}
		} else {
			yield* Effect.logInfo("No tags found - fetching all commits from branch");
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
		yield* Effect.logInfo("Checking merged PRs for linked issues...");
		let prCount = 0;
		for (const commit of commits) {
			const prNumber = extractPRNumber(commit.message);
			if (prNumber === null) continue;
			prCount++;
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
		yield* Effect.logInfo(`Found ${prCount} PR merge commit(s) to check`);
		yield* Effect.logInfo(`Found ${issueMap.size} unique issue reference(s)`);

		// Pass 3: backfill details for issues only found via commit-message text.
		const linkedIssues: LinkedIssue[] = [];
		for (const [issueNumber, issue] of issueMap) {
			if (issue.title !== "") {
				linkedIssues.push(issue);
				yield* Effect.logInfo(`✓ Issue #${issueNumber}: ${issue.title} (${issue.state})`);
				continue;
			}
			const details = yield* fetchIssueDetails(issueNumber);
			if (details !== null) {
				linkedIssues.push({
					number: issueNumber,
					title: details.title,
					state: details.state,
					url: details.url,
					node_id: details.nodeId,
					commits: issue.commits,
				});
				yield* Effect.logInfo(`✓ Issue #${issueNumber}: ${details.title} (${details.state})`);
			}
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
	ActionEnvironment | ActionOutputs | CheckRun | GitHubCommit | GitHubIssue | GitTag | PullRequest | Repo
> = Effect.gen(function* () {
	const serverUrl = yield* resolveServerUrl();
	const env = yield* ActionEnvironment;
	const outputs = yield* ActionOutputs;
	const checks = yield* CheckRun;

	const targetBranch = yield* ActionInput.string("target-branch").pipe(Config.withDefault("main"));
	const dryRun = yield* ActionInput.boolean("dry-run").pipe(Config.withDefault(false));

	const { sha, repository } = yield* env.github;
	const [owner, repo] = repository.split("/");

	yield* Effect.logInfo("Linking issues from commits");
	const { linkedIssues, commits } = yield* getLinkedIssuesFromCommits(targetBranch);

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
