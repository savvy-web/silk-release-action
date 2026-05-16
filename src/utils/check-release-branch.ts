/**
 * Check whether the release branch exists and has an open PR.
 *
 * @remarks
 * Uses `GitBranch.exists` and `PullRequest.list` to gather the two facts
 * Phase 1 needs to decide between creating or updating the release branch.
 * Emits a Check Run for PR feedback.
 */

import type {
	ActionEnvironmentError,
	ActionOutputError,
	CheckRunError,
	GitBranchError,
	PullRequestError,
} from "@savvy-web/github-action-effects";
import { ActionEnvironment, ActionOutputs, CheckRun, GitBranch, PullRequest } from "@savvy-web/github-action-effects";
import { Effect } from "effect";
import { summaryWriter } from "./summary-writer.js";

/** Result of checking the release branch state. */
export interface ReleaseBranchCheckResult {
	exists: boolean;
	hasOpenPr: boolean;
	prNumber: number | null;
	checkId: number;
}

/**
 * Check the release-branch state and report it.
 *
 * @param releaseBranch - Release branch name (e.g. `changeset-release/main`)
 * @param targetBranch - Target branch the release PR targets (e.g. `main`)
 * @param dryRun - When true, prefixes the Check Run title with `🧪 Dry Run`
 */
export const checkReleaseBranch = (
	releaseBranch: string,
	targetBranch: string,
	dryRun: boolean,
): Effect.Effect<
	ReleaseBranchCheckResult,
	ActionEnvironmentError | ActionOutputError | CheckRunError | GitBranchError | PullRequestError,
	ActionEnvironment | ActionOutputs | CheckRun | GitBranch | PullRequest
> =>
	Effect.gen(function* () {
		const env = yield* ActionEnvironment;
		const outputs = yield* ActionOutputs;
		const checks = yield* CheckRun;
		const branches = yield* GitBranch;
		const prs = yield* PullRequest;

		const { sha, repository } = yield* env.github;
		const [owner] = repository.split("/");

		// 1. Does the branch exist?
		const branchExists = yield* branches.exists(releaseBranch).pipe(
			Effect.catchAll((e) =>
				Effect.gen(function* () {
					yield* Effect.logWarning(`Failed to check if branch '${releaseBranch}' exists: ${e.reason}`);
					return false;
				}),
			),
		);

		if (branchExists) {
			yield* Effect.logInfo(`✓ Release branch '${releaseBranch}' exists`);
		} else {
			yield* Effect.logInfo(`Release branch '${releaseBranch}' does not exist`);
		}

		// 2. Is there an open PR?
		let hasOpenPr = false;
		let prNumber: number | null = null;
		if (branchExists) {
			const found = yield* prs.list({ state: "open", head: `${owner}:${releaseBranch}`, base: targetBranch }).pipe(
				Effect.catchAll((e) =>
					Effect.gen(function* () {
						yield* Effect.logWarning(`Failed to check for open PRs: ${e.reason}`);
						return [] as ReadonlyArray<{ number: number; url: string }>;
					}),
				),
			);
			if (found.length > 0) {
				hasOpenPr = true;
				prNumber = found[0].number;
				yield* Effect.logInfo(`✓ Open PR found: #${prNumber} (${found[0].url})`);
			} else {
				yield* Effect.logInfo(`No open PR found from '${releaseBranch}' to '${targetBranch}'`);
			}
		}

		// 3. Build summary content.
		const checkTitle = dryRun ? "🧪 Check Release Branch (Dry Run)" : "Check Release Branch";
		const checkSummary = branchExists
			? hasOpenPr
				? `Release branch exists with open PR #${prNumber}`
				: "Release branch exists without open PR"
			: "Release branch does not exist";

		const statusTable = summaryWriter.keyValueTable([
			{ key: "Branch", value: `\`${releaseBranch}\`` },
			{ key: "Target", value: `\`${targetBranch}\`` },
			{ key: "Exists", value: branchExists ? "✅ Yes" : "❌ No" },
			{ key: "Open PR", value: hasOpenPr ? `✅ Yes (#${prNumber})` : "❌ No" },
		]);

		const nextSteps = hasOpenPr
			? `An open release PR already exists. The workflow will update it with the latest changes from \`${targetBranch}\`.`
			: branchExists
				? "The release branch exists but has no open PR. A new PR will be created."
				: "No release branch exists. A new branch and PR will be created.";

		const checkDetails = summaryWriter.build([
			{ heading: "Release Branch Status", content: statusTable },
			{ heading: "Next Steps", level: 3, content: nextSteps },
		]);

		const checkId = yield* checks.create(checkTitle, sha);
		yield* checks.complete(checkId, "success", { title: checkSummary, summary: checkDetails });

		// 4. Job summary.
		yield* outputs.summary(
			summaryWriter.build([
				{ heading: checkTitle, content: checkSummary },
				{ heading: "Release Branch Status", level: 3, content: statusTable },
			]),
		);

		return {
			exists: branchExists,
			hasOpenPr,
			prNumber,
			checkId,
		} satisfies ReleaseBranchCheckResult;
	});
