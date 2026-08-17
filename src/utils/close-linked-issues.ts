/**
 * Close issues linked to a merged release PR.
 *
 * @remarks
 * Uses `GitHubIssue.getLinkedIssues` (closingIssuesReferences) to find
 * issues that should close when the PR merges, then closes and comments on
 * each one. The whole flow is wrapped in `CheckRun.withCheckRun` for PR
 * feedback.
 *
 * **Re-running this stage is safe, and now also *recovers*** (issue #259). The
 * close precedes the comment so a failed close leaves no comment to duplicate —
 * see {@link closeOne} for why that ordering is the mechanism rather than a
 * detail. An already-closed issue is no longer skipped *outright*: it is skipped
 * unless GitHub attributes its closure to **this** release PR, in which case the
 * run reconciles the comment it may have failed to post. `commentOnce`'s marker
 * makes that fall-through a no-op on the ordinary re-run.
 */

import type { GitHubClient, GitHubError, LinkedIssue, Repo } from "@effected/github";
import { CheckRun, CheckRunOutput, CommentMarker, GitHubIssue } from "@effected/github";
import { ActionEnvironment, ActionOutputs } from "@effected/github-actions";
import { Effect } from "effect";
import { issueUrl, resolveServerUrl } from "./github-urls.js";
import { wasClosedByPullRequestOrFalse } from "./issue-close-attribution.js";
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
 * Is this issue already closed, per the state GraphQL reported?
 *
 * @remarks
 * GraphQL's `IssueState` is the upper-case enum `OPEN` / `CLOSED`; the
 * comparison is case-insensitive so a lower-cased fixture (or a future REST
 * spelling) reads the same.
 *
 * @internal
 */
const isAlreadyClosed = (state: string): boolean => state.toUpperCase() === "CLOSED";

/**
 * Post the release's courtesy comment, once, never fatally.
 *
 * @remarks
 * Extracted so the two paths that reach it — a close this run performed, and
 * the issue #259 reconciliation of a close a previous run performed but never
 * commented on — write the **same** comment under the **same** marker. Two
 * spellings of the marker would defeat the idempotence they both depend on.
 *
 * The marker carries the release PR number, so it is unique per release and a
 * later release's comment never suppresses an earlier one's.
 *
 * A failure is logged and swallowed: the issue is closed, which is the point;
 * the comment is a courtesy, and failing the phase over it would abort a
 * release that had already succeeded.
 *
 * @internal
 */
const commentOnClosure = (
	issues: typeof GitHubIssue.Service,
	issueNumber: number,
	prNumber: number,
): Effect.Effect<void, never, Repo> =>
	Effect.gen(function* () {
		const marker = CommentMarker.make({ namespace: "savvy-web", key: `closed-by-release-${prNumber}` });
		const commented = yield* Effect.result(
			issues.commentOnce(
				issueNumber,
				marker,
				`Closed by release PR #${prNumber} merge.\n\n🤖 _Automated by silk-release-action_`,
			),
		);
		if (commented._tag !== "Success") {
			const reason = (commented.failure as GitHubError).reason ?? String(commented.failure);
			yield* Effect.logWarning(`Closed issue #${issueNumber} but failed to comment on it: ${reason}`);
		} else if (!commented.success.wrote) {
			yield* Effect.logInfo(`✓ Issue #${issueNumber} already carried the release comment — skipped posting`);
		}
	});

/**
 * Close a single linked issue (close + comment) and capture per-issue success.
 *
 * @remarks
 * **Idempotent across a re-run, by construction.** Two properties make it so,
 * and both are load-bearing now that a failure here fails Phase 3 and therefore
 * *invites* a re-run:
 *
 * 1. **An already-closed issue is skipped unless this release closed it.**
 *    Without any skip, every re-run posted a second "Closed by release PR #N
 *    merge." comment on every linked issue, because `linkedIssues` returns an
 *    issue regardless of its state — and worse, posted that claim on issues
 *    closed manually or by an earlier release, which the merge did not close.
 *
 *    An *unconditional* skip has its own defect (issue #259): a close that
 *    succeeded while its comment failed persistently is unrecoverable, because
 *    the re-run exits here before reaching the comment. So the skip is
 *    conditioned on attribution — `wasClosedByPullRequestOrFalse` asks GitHub
 *    which pull requests closed the issue — and only an issue **this** release
 *    PR closed falls through to `commentOnClosure`. Attribution that cannot be
 *    established degrades to a skip, never to a claim.
 * 2. **Close happens BEFORE the comment.** This is the ordering, not an
 *    accident. Comment-first leaves a window — comment posted, close failed —
 *    that a re-run cannot detect from `state` alone; closing first collapses
 *    it: a failed close posted no comment, and a successful close is visible
 *    to the next run as `CLOSED`.
 * 3. **The comment itself is `commentOnce`, keyed by a marker carrying the
 *    release PR number.** Even on a path that reaches the comment twice —
 *    close raced by another run, a partial failure between close and
 *    comment — the marker lookup finds the existing comment and skips.
 *    The lookup is not atomic (two runs can both see "absent" and both
 *    post), so the ordering above stays load-bearing rather than replaced.
 *
 * A failed *comment* after a successful close is deliberately **not** an
 * error — the issue is closed, which is the point; the comment is a courtesy.
 * Reporting it as a failure would fail the phase over a cosmetic call and, on
 * the re-run, skip the issue anyway.
 *
 * `GitHubIssue.isCrossReferencedBy` is **not** the guard here, despite naming
 * itself an idempotence guard. It asks whether the issue's timeline carries a
 * cross-reference from the PR — which is exactly what *creates* the
 * `closingIssuesReferences` link we found the issue through, so it answers
 * `true` before the first comment is ever posted. It is the right guard for a
 * different question.
 *
 * @internal
 */
const closeOne = (
	issue: LinkedIssue,
	prNumber: number,
	dryRun: boolean,
	// `GitHubClient` joins the requirements for the issue #259 attribution query;
	// `GraphQLDocument` is the kit's consumer extension point, so this is still
	// the one client the layer graph already builds, not a second one.
): Effect.Effect<ClosedIssue, never, GitHubClient | GitHubIssue | Repo> =>
	Effect.gen(function* () {
		const { number: issueNumber, title } = issue;

		if (dryRun) {
			yield* Effect.logInfo(`[DRY RUN] Would close issue #${issueNumber}: ${title}`);
			return { number: issueNumber, title, closed: true } satisfies ClosedIssue;
		}

		const issues = yield* GitHubIssue;

		if (isAlreadyClosed(issue.state)) {
			// **Issue #259.** A skip here used to be unconditional, which made the
			// close-succeeded-but-comment-failed window unrecoverable: the re-run
			// exited before reaching `commentOnce`. Dropping the skip outright is the
			// wrong repair — see `issue-close-attribution.ts` for why an unattributed
			// comment is a false claim rather than a harmless one — so the skip
			// stands for every issue this release did not close, and only an issue
			// GitHub attributes to THIS release PR falls through to the comment.
			//
			// `commentOnce` is what makes the fall-through safe on the ordinary
			// re-run path, where the comment already exists: the marker is found and
			// nothing is posted.
			const ours = yield* wasClosedByPullRequestOrFalse(issueNumber, prNumber);
			if (!ours) {
				yield* Effect.logInfo(`✓ Issue #${issueNumber} already closed — not by this release, leaving it: ${title}`);
				return { number: issueNumber, title, closed: true } satisfies ClosedIssue;
			}
			yield* Effect.logInfo(
				`✓ Issue #${issueNumber} already closed by this release — reconciling its comment: ${title}`,
			);
			yield* commentOnClosure(issues, issueNumber, prNumber);
			return { number: issueNumber, title, closed: true } satisfies ClosedIssue;
		}

		const closed = yield* Effect.result(issues.close(issueNumber, "completed"));

		if (closed._tag !== "Success") {
			// One `GitHubError` for every REST failure; `reason` is the human-readable
			// half, `kind` the routing surface (unused here — any failure to close is
			// reported the same way). Nothing was commented, so a re-run starts clean.
			const reason = (closed.failure as GitHubError).reason ?? String(closed.failure);
			yield* Effect.logWarning(`Failed to close issue #${issueNumber}: ${reason}`);
			return { number: issueNumber, title, closed: false, error: reason } satisfies ClosedIssue;
		}

		yield* commentOnClosure(issues, issueNumber, prNumber);

		yield* Effect.logInfo(`✓ Closed issue #${issueNumber}: ${title}`);
		return { number: issueNumber, title, closed: true } satisfies ClosedIssue;
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
): Effect.Effect<
	CloseLinkedIssuesResult,
	never,
	ActionEnvironment | ActionOutputs | CheckRun | GitHubClient | GitHubIssue | Repo
> =>
	Effect.gen(function* () {
		const serverUrl = yield* resolveServerUrl();
		const env = yield* ActionEnvironment;
		const outputs = yield* ActionOutputs;
		const checks = yield* CheckRun;
		const ghIssues = yield* GitHubIssue;

		const { sha, repository } = yield* env.github;
		const [owner, repo] = repository.split("/");

		const checkName = dryRun ? "🧪 Close Linked Issues (Dry Run)" : "Close Linked Issues";
		const { id: checkId } = yield* checks.create(checkName, sha);

		yield* Effect.logInfo(`Querying linked issues for PR #${prNumber}`);

		const linked = yield* ghIssues.linkedIssues(prNumber).pipe(
			Effect.catch((e) =>
				Effect.gen(function* () {
					yield* Effect.logWarning(`Failed to query linked issues: ${e.reason}`);
					return [] as ReadonlyArray<LinkedIssue>;
				}),
			),
		);

		yield* Effect.logInfo(`Found ${linked.length} linked issue(s) for PR #${prNumber}`);

		if (linked.length === 0) {
			yield* checks.complete(
				checkId,
				"success",
				CheckRunOutput.make({
					title: "No linked issues to close",
					summary: `PR #${prNumber} had no linked issues.`,
				}),
			);
			yield* outputs.set("closed-issues-count", "0");
			yield* outputs.set("failed-issues-count", "0");
			yield* outputs.set("closed-issues", JSON.stringify([]));
			return { closedCount: 0, failedCount: 0, issues: [] } satisfies CloseLinkedIssuesResult;
		}

		const issueResults: ClosedIssue[] = [];
		for (const linkedIssue of linked) {
			const result = yield* closeOne(linkedIssue, prNumber, dryRun);
			issueResults.push(result);
		}

		const closedCount = issueResults.filter((r) => r.closed).length;
		const failedCount = issueResults.length - closedCount;

		const issuesTable = summaryWriter.table(
			["Issue", "Title", "Status"],
			issueResults.map((issue) => [
				`[#${issue.number}](${issueUrl(serverUrl, owner, repo, issue.number)})`,
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
		yield* checks.complete(
			checkId,
			conclusion,
			CheckRunOutput.make({
				title: `Closed ${closedCount} linked issue(s)`,
				summary,
			}),
		);

		yield* outputs.summary(summary);
		yield* outputs.set("closed-issues-count", String(closedCount));
		yield* outputs.set("failed-issues-count", String(failedCount));
		yield* outputs.set("closed-issues", JSON.stringify(issueResults));

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
