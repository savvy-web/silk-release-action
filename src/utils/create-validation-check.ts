/**
 * Phase 2 utility: aggregate per-step validation results into a single
 * unified Check Run.
 */

import type { GitHubError, Repo } from "@effected/github";
import { CheckRun, CheckRunOutput } from "@effected/github";
import type { ActionEnvironmentError, ActionOutputError } from "@effected/github-actions";
import { ActionEnvironment, ActionOutputs } from "@effected/github-actions";
import { Effect } from "effect";
import type { ValidationResult } from "../types/shared-types.js";
import { summaryWriter } from "./summary-writer.js";

// `capCheckSummary` and `GITHUB_CHECK_SUMMARY_LIMIT` lived here and are gone.
// GitHub's 65535-BYTE cap on `output.summary`/`output.text` is now enforced by
// the kit: `CheckRun.complete` and `CheckRun.update` both route their output
// through `wireOutput`, which calls `CheckRunOutput.truncated()` on EVERY
// request. Re-adding a consumer-side cap would truncate twice — and the kit's
// `capBytes` is strictly better anyway, because it *loops* while stripping
// trailing `U+FFFD` where the hand-rolled version dropped exactly one and could
// still emit invalid UTF-8 from a split four-byte code point. The limit itself
// is `CheckRunOutput.LIMIT_BYTES`.

export interface UnifiedValidationResult {
	success: boolean;
	validations: ValidationResult[];
	checkId: number;
	/**
	 * Web URL of the unified validation check run, for the checks-table links.
	 *
	 * @remarks
	 * Sourced from `CheckRunRef.url`, which the kit builds as `raw.html_url ?? ""`
	 * — so the empty-string sentinel `main.ts` branches on is preserved.
	 */
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
	ActionEnvironmentError | ActionOutputError | GitHubError,
	ActionEnvironment | ActionOutputs | CheckRun | Repo
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

		// `CheckRunRef` exposes `url`, not `htmlUrl`.
		const { id: checkId, url: htmlUrl } = yield* checks.create(checkTitle, sha);
		// `CheckRunOutput` is a `Schema.Class`; an object literal no longer
		// satisfies it. No `capCheckSummary` here — `CheckRun.complete` pipes the
		// output through `wireOutput`, which calls `CheckRunOutput.truncated()`
		// unconditionally. Capping first would truncate twice.
		yield* checks.complete(
			checkId,
			success ? "success" : "failure",
			CheckRunOutput.make({ title: checkSummary, summary: checkDetails }),
		);

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
