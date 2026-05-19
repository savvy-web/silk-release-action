/**
 * Phase 2 utility: aggregate per-step validation results into a single
 * unified Check Run.
 */

import type { ActionEnvironmentError, ActionOutputError, CheckRunError } from "@savvy-web/github-action-effects";
import { ActionEnvironment, ActionOutputs, CheckRun } from "@savvy-web/github-action-effects";
import { Effect } from "effect";
import type { ValidationResult } from "../types/shared-types.js";
import { summaryWriter } from "./summary-writer.js";

export interface UnifiedValidationResult {
	success: boolean;
	validations: ValidationResult[];
	checkId: number;
	/** Web URL of the unified validation check run, for the checks-table links. */
	htmlUrl: string;
}

/**
 * Create the unified validation check.
 *
 * @public
 */
export const createValidationCheck = (
	validations: ReadonlyArray<ValidationResult>,
	dryRun: boolean,
): Effect.Effect<
	UnifiedValidationResult,
	ActionEnvironmentError | ActionOutputError | CheckRunError,
	ActionEnvironment | ActionOutputs | CheckRun
> =>
	Effect.gen(function* () {
		const env = yield* ActionEnvironment;
		const outputs = yield* ActionOutputs;
		const checks = yield* CheckRun;

		const { sha } = yield* env.github;

		const success = validations.every((v) => v.success);
		const failedChecks = validations.filter((v) => !v.success);

		yield* Effect.logInfo(`Processed ${validations.length} validation check(s)`);
		yield* Effect.logInfo(`Passed: ${validations.length - failedChecks.length}, Failed: ${failedChecks.length}`);

		const checkTitle = dryRun ? "🧪 Release Validation Summary (Dry Run)" : "Release Validation Summary";
		const checkSummary = success
			? `All ${validations.length} validation(s) passed`
			: `${failedChecks.length} of ${validations.length} validation(s) failed`;

		const resultsTable = summaryWriter.table(
			["Check", "Status", "Details"],
			validations.map((v) => {
				const status = v.success ? "✅ Passed" : "❌ Failed";
				const details = v.message ?? (v.success ? "All checks passed" : "Validation failed");
				return [v.name, status, details];
			}),
		);

		const sections: Array<{ heading?: string; level?: 2 | 3; content: string }> = [
			{ heading: "Validation Results", content: resultsTable },
		];
		if (failedChecks.length > 0) {
			sections.push({
				heading: "Failed Validations",
				level: 3,
				content: summaryWriter.list(failedChecks.map((v) => `**${v.name}**: ${v.message ?? "Validation failed"}`)),
			});
		}
		const checkDetails = summaryWriter.build(sections);

		const { id: checkId, htmlUrl } = yield* checks.create(checkTitle, sha);
		yield* checks.complete(checkId, success ? "success" : "failure", {
			title: checkSummary,
			summary: checkDetails,
		});

		const jobSections: Array<{ heading?: string; level?: 2 | 3; content: string }> = [
			{ heading: checkTitle, content: checkSummary },
			{ heading: "Validation Results", level: 3, content: resultsTable },
		];
		if (failedChecks.length > 0) {
			jobSections.push({
				heading: "Failed Validations",
				level: 3,
				content: summaryWriter.list(failedChecks.map((v) => `**${v.name}**: ${v.message ?? "Validation failed"}`)),
			});
		}
		yield* outputs.summary(summaryWriter.build(jobSections));

		return { success, validations: [...validations], checkId, htmlUrl };
	});
