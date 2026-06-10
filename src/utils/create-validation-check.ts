/**
 * Phase 2 utility: aggregate per-step validation results into a single
 * unified Check Run.
 */

import type { ActionEnvironmentError, ActionOutputError, CheckRunError } from "@savvy-web/github-action-effects";
import { ActionEnvironment, ActionOutputs, CheckRun } from "@savvy-web/github-action-effects";
import { Effect } from "effect";
import type { ValidationResult } from "../types/shared-types.js";
import { summaryWriter } from "./summary-writer.js";

/**
 * GitHub Checks API hard limit on `output.summary` (and `output.text`), in
 * UTF-8 BYTES (the API rejects with "summary exceeds a maximum bytesize of
 * 65535" — note bytes, not characters; multi-byte chars like ✅/❌/🦋/│ count
 * as several bytes each).
 */
export const GITHUB_CHECK_SUMMARY_LIMIT = 65535;

/**
 * Cap a check-run summary to GitHub's 65535-BYTE limit (UTF-8). Over-limit
 * input is truncated on a byte budget — without splitting a multi-byte char —
 * with a trailing notice, so the check still posts instead of failing the whole
 * phase with a 422. Truncating by `string.length` (characters) is wrong: a
 * summary full of emoji/box-drawing glyphs can be under the char count yet over
 * the byte limit.
 */
export const capCheckSummary = (summary: string): string => {
	if (Buffer.byteLength(summary, "utf8") <= GITHUB_CHECK_SUMMARY_LIMIT) return summary;
	const notice = "\n\n_…summary truncated (exceeded GitHub's 65535-byte check limit)._";
	const budget = GITHUB_CHECK_SUMMARY_LIMIT - Buffer.byteLength(notice, "utf8");
	// Take the first `budget` bytes, then drop a trailing partial multi-byte
	// sequence (decoded as U+FFFD) so the output is valid UTF-8 within budget.
	let truncated = Buffer.from(summary, "utf8").subarray(0, budget).toString("utf8");
	if (truncated.endsWith("�")) truncated = truncated.slice(0, -1);
	return `${truncated}${notice}`;
};

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
 * @param validations - Per-step validation results that drive the checks
 *   table and overall conclusion.
 * @param dryRun - Whether this is a dry-run (changes the check-run title).
 * @param extraBody - Optional markdown appended to the check-run summary
 *   after the checks-table content. Used to surface the full structured
 *   `result` JSON in the check-run page; the job-step summary is not
 *   modified.
 *
 * @public
 */
export const createValidationCheck = (
	validations: ReadonlyArray<ValidationResult>,
	dryRun: boolean,
	extraBody?: string,
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
		const baseDetails = summaryWriter.build(sections);
		// Append the optional `extraBody` after the checks-table content. The
		// job-step summary is intentionally left without the extra body so the
		// terse job summary stays focused on the per-step results table.
		const checkDetails = extraBody !== undefined && extraBody !== "" ? `${baseDetails}\n${extraBody}` : baseDetails;

		const { id: checkId, htmlUrl } = yield* checks.create(checkTitle, sha);
		yield* checks.complete(checkId, success ? "success" : "failure", {
			title: checkSummary,
			summary: capCheckSummary(checkDetails),
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
