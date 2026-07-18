/**
 * Phase 2 utility: mark incomplete validation check runs as cancelled
 * when the workflow fails or is interrupted.
 */

import type { ActionOutputError } from "@savvy-web/github-action-effects";
import { ActionOutputs, CheckRun } from "@savvy-web/github-action-effects";
import { Effect } from "effect";
import { summaryWriter } from "./summary-writer.js";

export interface CleanupResult {
	cleanedUp: number;
	failed: number;
	errors: string[];
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
): Effect.Effect<CleanupResult, ActionOutputError, ActionOutputs | CheckRun> =>
	Effect.gen(function* () {
		const outputs = yield* ActionOutputs;
		const checks = yield* CheckRun;

		yield* Effect.logInfo(`Cleaning up ${checkIds.length} validation check(s)`);

		const result: CleanupResult = { cleanedUp: 0, failed: 0, errors: [] };

		for (const checkId of checkIds) {
			yield* Effect.logInfo(`Cleaning up check ID: ${checkId}`);
			if (dryRun) {
				yield* Effect.logInfo(`🧪 [Dry Run] Would mark check ${checkId} as cancelled`);
				result.cleanedUp++;
				continue;
			}

			const current = yield* Effect.result(checks.get(checkId));

			if (current._tag === "Failure") {
				yield* Effect.logWarning(`Failed to fetch check ${checkId}: ${current.failure.reason}`);
				result.failed++;
				result.errors.push(`Check ${checkId}: ${current.failure.reason}`);
				continue;
			}

			if (current.success.status === "completed") {
				yield* Effect.logInfo(
					`⏭️ Skipped check ${checkId} (${current.success.name}) - already ${current.success.conclusion}`,
				);
				continue;
			}

			const update = yield* Effect.result(
				checks.complete(checkId, "cancelled", {
					title: "Workflow Cancelled",
					summary: `This check was cancelled due to workflow interruption.\n\n**Reason**: ${reason}`,
				}),
			);

			if (update._tag === "Success") {
				yield* Effect.logInfo(`✓ Marked check ${checkId} (${current.success.name}) as cancelled`);
				result.cleanedUp++;
			} else {
				yield* Effect.logWarning(`Failed to cleanup check ${checkId}: ${update.failure.reason}`);
				result.failed++;
				result.errors.push(`Check ${checkId}: ${update.failure.reason}`);
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
