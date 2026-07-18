/**
 * Close issues linked to a merged release PR.
 *
 * @remarks
 * Uses `GitHubIssue.getLinkedIssues` (closingIssuesReferences) to find
 * issues that should close when the PR merges, then comments and closes
 * each one. The whole flow is wrapped in `CheckRun.withCheckRun` for PR
 * feedback.
 */

import type { GitHubIssueError } from "@savvy-web/github-action-effects";
import { ActionEnvironment, ActionOutputs, CheckRun, GitHubIssue } from "@savvy-web/github-action-effects";
import { Effect } from "effect";
import { summaryWriter } from "./summary-writer.js";

/** Per-issue result. */
export interface ClosedIssue {
	readonly number: number;
	readonly title: string;
	readonly closed: boolean;
	readonly error?: string;
}

/** Aggregate result of the close-linked-issues stage. */
export interface CloseLinkedIssuesResult {
	readonly closedCount: number;
	readonly failedCount: number;
	readonly issues: ReadonlyArray<ClosedIssue>;
}

/**
 * Close a single linked issue (comment + close) and capture per-issue success.
 *
 * @internal
 */
const closeOne = (
	issueNumber: number,
	title: string,
	prNumber: number,
	dryRun: boolean,
): Effect.Effect<ClosedIssue, never, GitHubIssue> =>
	Effect.gen(function* () {
		if (dryRun) {
			yield* Effect.logInfo(`[DRY RUN] Would close issue #${issueNumber}: ${title}`);
			return { number: issueNumber, title, closed: true } satisfies ClosedIssue;
		}

		const issues = yield* GitHubIssue;
		const result = yield* Effect.result(
			issues
				.comment(issueNumber, `Closed by release PR #${prNumber} merge.\n\n🤖 _Automated by silk-release-action_`)
				.pipe(Effect.flatMap(() => issues.close(issueNumber, "completed"))),
		);

		if (result._tag === "Success") {
			yield* Effect.logInfo(`✓ Closed issue #${issueNumber}: ${title}`);
			return { number: issueNumber, title, closed: true } satisfies ClosedIssue;
		}

		const reason = (result.failure as GitHubIssueError).reason ?? String(result.failure);
		yield* Effect.logWarning(`Failed to close issue #${issueNumber}: ${reason}`);
		return { number: issueNumber, title, closed: false, error: reason } satisfies ClosedIssue;
	});

/**
 * Effect program that closes all issues linked to `prNumber`.
 *
 * Reports progress through a Check Run on the PR's head SHA. Uses
 * `CheckRun.create` + `CheckRun.complete` (rather than the `withCheckRun`
 * bracket) so the inner work can keep its service requirements visible
 * on the surrounding `Effect.gen` signature.
 */
export const closeLinkedIssues = (
	prNumber: number,
	dryRun: boolean,
): Effect.Effect<CloseLinkedIssuesResult, never, ActionEnvironment | ActionOutputs | CheckRun | GitHubIssue> =>
	Effect.gen(function* () {
		const env = yield* ActionEnvironment;
		const outputs = yield* ActionOutputs;
		const checks = yield* CheckRun;
		const ghIssues = yield* GitHubIssue;

		const { sha, repository } = yield* env.github;
		const [owner, repo] = repository.split("/");

		const checkName = dryRun ? "🧪 Close Linked Issues (Dry Run)" : "Close Linked Issues";
		const { id: checkId } = yield* checks.create(checkName, sha);

		yield* Effect.logInfo(`Querying linked issues for PR #${prNumber}`);

		const linked = yield* ghIssues.getLinkedIssues(prNumber).pipe(
			Effect.catch((e) =>
				Effect.gen(function* () {
					yield* Effect.logWarning(`Failed to query linked issues: ${e.reason}`);
					return [] as Array<{ number: number; title: string }>;
				}),
			),
		);

		yield* Effect.logInfo(`Found ${linked.length} linked issue(s) for PR #${prNumber}`);

		if (linked.length === 0) {
			yield* checks.complete(checkId, "success", {
				title: "No linked issues to close",
				summary: `PR #${prNumber} had no linked issues.`,
			});
			yield* outputs.set("closed_issues_count", "0");
			yield* outputs.set("failed_issues_count", "0");
			yield* outputs.set("closed_issues", JSON.stringify([]));
			return { closedCount: 0, failedCount: 0, issues: [] } satisfies CloseLinkedIssuesResult;
		}

		const issueResults: ClosedIssue[] = [];
		for (const linkedIssue of linked) {
			const result = yield* closeOne(linkedIssue.number, linkedIssue.title, prNumber, dryRun);
			issueResults.push(result);
		}

		const closedCount = issueResults.filter((r) => r.closed).length;
		const failedCount = issueResults.length - closedCount;

		const issuesTable = summaryWriter.table(
			["Issue", "Title", "Status"],
			issueResults.map((issue) => [
				`[#${issue.number}](https://github.com/${owner}/${repo}/issues/${issue.number})`,
				issue.title,
				issue.closed ? "✅ Closed" : `❌ ${issue.error ?? "Unknown error"}`,
			]),
		);

		const summary = summaryWriter.build([
			{
				heading: "Linked Issues Closed",
				content: `Closed ${closedCount} issue(s) from PR #${prNumber}${failedCount > 0 ? ` (${failedCount} failed)` : ""}`,
			},
			{ heading: "Issues", level: 3, content: issuesTable },
		]);

		const conclusion = failedCount > 0 ? "neutral" : "success";
		yield* checks.complete(checkId, conclusion, {
			title: `Closed ${closedCount} linked issue(s)`,
			summary,
		});

		yield* outputs.summary(summary);
		yield* outputs.set("closed_issues_count", String(closedCount));
		yield* outputs.set("failed_issues_count", String(failedCount));
		yield* outputs.set("closed_issues", JSON.stringify(issueResults));

		return { closedCount, failedCount, issues: issueResults } satisfies CloseLinkedIssuesResult;
	}).pipe(
		// Defense-in-depth: the check-run / output / issue services can fail;
		// we collapse to an empty result rather than propagating, since this
		// stage is best-effort.
		Effect.catch((e) =>
			Effect.gen(function* () {
				yield* Effect.logError(`close-linked-issues failed: ${String(e)}`);
				return { closedCount: 0, failedCount: 0, issues: [] } satisfies CloseLinkedIssuesResult;
			}),
		),
	);
