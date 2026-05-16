/**
 * Phase 2 utility: mark incomplete validation check runs as cancelled
 * when the workflow fails or is interrupted.
 */

import type { ActionEnvironmentError, ActionOutputError, GitHubClientError } from "@savvy-web/github-action-effects";
import { ActionEnvironment, ActionOutputs, GitHubClient } from "@savvy-web/github-action-effects";
import { Effect } from "effect";
import { summaryWriter } from "./summary-writer.js";

export interface CleanupResult {
	cleanedUp: number;
	failed: number;
	errors: string[];
}

interface CheckGetResponse {
	status: string;
	conclusion: string | null;
	name: string;
}

/**
 * Cancel any incomplete validation Check Runs.
 *
 * @public
 */
export const cleanupValidationChecks = (
	checkIds: ReadonlyArray<number>,
	reason: string,
	dryRun: boolean,
): Effect.Effect<
	CleanupResult,
	ActionEnvironmentError | ActionOutputError | GitHubClientError,
	ActionEnvironment | ActionOutputs | GitHubClient
> =>
	Effect.gen(function* () {
		const env = yield* ActionEnvironment;
		const outputs = yield* ActionOutputs;
		const client = yield* GitHubClient;

		const { repository } = yield* env.github;
		const [owner, repo] = repository.split("/");

		yield* Effect.logInfo(`Cleaning up ${checkIds.length} validation check(s)`);

		const result: CleanupResult = { cleanedUp: 0, failed: 0, errors: [] };

		for (const checkId of checkIds) {
			yield* Effect.logInfo(`Cleaning up check ID: ${checkId}`);
			if (dryRun) {
				yield* Effect.logInfo(`🧪 [Dry Run] Would mark check ${checkId} as cancelled`);
				result.cleanedUp++;
				continue;
			}

			const current = yield* Effect.either(
				client.rest<CheckGetResponse>("checks.get", (octokit) =>
					(
						octokit as {
							rest: {
								checks: {
									get: (params: { owner: string; repo: string; check_run_id: number }) => Promise<{
										data: CheckGetResponse;
									}>;
								};
							};
						}
					).rest.checks.get({ owner, repo, check_run_id: checkId }),
				),
			);

			if (current._tag === "Left") {
				yield* Effect.logWarning(`Failed to fetch check ${checkId}: ${current.left.reason}`);
				result.failed++;
				result.errors.push(`Check ${checkId}: ${current.left.reason}`);
				continue;
			}

			if (current.right.status === "completed") {
				yield* Effect.logInfo(
					`⏭️ Skipped check ${checkId} (${current.right.name}) - already ${current.right.conclusion}`,
				);
				continue;
			}

			const update = yield* Effect.either(
				client.rest<undefined>("checks.update.cancel", (octokit) =>
					(
						octokit as {
							rest: {
								checks: {
									update: (params: {
										owner: string;
										repo: string;
										check_run_id: number;
										status: "completed";
										conclusion: "cancelled";
										output: { title: string; summary: string };
									}) => Promise<{ data: undefined }>;
								};
							};
						}
					).rest.checks.update({
						owner,
						repo,
						check_run_id: checkId,
						status: "completed",
						conclusion: "cancelled",
						output: {
							title: "Workflow Cancelled",
							summary: `This check was cancelled due to workflow interruption.\n\n**Reason**: ${reason}`,
						},
					}),
				),
			);

			if (update._tag === "Right") {
				yield* Effect.logInfo(`✓ Marked check ${checkId} (${current.right.name}) as cancelled`);
				result.cleanedUp++;
			} else {
				yield* Effect.logWarning(`Failed to cleanup check ${checkId}: ${update.left.reason}`);
				result.failed++;
				result.errors.push(`Check ${checkId}: ${update.left.reason}`);
			}
		}

		const resultsTable = summaryWriter.table(
			["Status", "Count"],
			[
				["Cleaned Up", result.cleanedUp.toString()],
				["Failed", result.failed.toString()],
				["Total", checkIds.length.toString()],
			],
		);

		const sections: Array<{ heading?: string; level?: 2 | 3; content: string }> = [
			{ heading: "Validation Check Cleanup", content: "" },
			{ content: `**Reason**: ${reason}` },
			{ heading: "Results", level: 3, content: resultsTable },
		];
		if (result.errors.length > 0) {
			sections.push({ heading: "Errors", level: 3, content: summaryWriter.list(result.errors) });
		}
		yield* outputs.summary(summaryWriter.build(sections));

		return result;
	});
