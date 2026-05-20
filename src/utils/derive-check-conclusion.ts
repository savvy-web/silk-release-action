/**
 * Pure helper: derive a Phase-2 per-step check-run conclusion from the
 * findings the check produced, the upstream build state, and the
 * `strict-warnings` mode.
 *
 * @remarks
 * The Phase-2 validation orchestrator emits structured findings keyed by
 * `check` (one of the five row names in the checks-table). The check-run
 * conclusion for each row is derived from those findings:
 *
 * - `failure` — at least one error-severity finding is scoped to this check,
 *   or `buildSuccess` is false and this check is one of the build-dependent
 *   ones (anything except `Build Validation` and `Link Issues from Commits`,
 *   which run independently of the build).
 * - `neutral` — at least one warning-severity finding is scoped to this
 *   check, and `strictWarnings` is `false`. The check ran and produced
 *   advisory output but no errors.
 * - `success` — no findings of either severity are scoped to this check.
 *
 * Under `strictWarnings: true`, the `neutral` arm escalates to `failure` —
 * the contract every other consumer (the JSON `findings[].severity`, the
 * checks-table icon) is unchanged, but the GitHub check-run conclusion
 * flips so branch-protection gates can act on warnings.
 *
 * @module utils/derive-check-conclusion
 */

import type { ValidationFinding } from "../release/types.js";

/**
 * The set of check names whose conclusion is independent of `Build Validation`.
 *
 * @remarks
 * These checks run before or alongside the build itself. A failed build does
 * not implicitly fail them — they have their own success criteria.
 *
 * @internal
 */
const BUILD_INDEPENDENT_CHECKS = new Set<string>(["Build Validation", "Link Issues from Commits"]);

/**
 * Derive the per-step check-run conclusion for one check.
 *
 * @param checkName - The check-table row name (e.g. `"Publish Validation"`).
 * @param findings - Every finding produced by the validation phase. Filtered
 *   internally to entries whose `check` equals `checkName`.
 * @param buildSuccess - Whether the upstream Build Validation step passed.
 * @param strictWarnings - When `true`, warning findings escalate to `failure`.
 * @returns The GitHub check-run conclusion for this check.
 *
 * @public
 */
export function deriveCheckConclusion(
	checkName: string,
	findings: ReadonlyArray<ValidationFinding>,
	buildSuccess: boolean,
	strictWarnings: boolean,
): "success" | "failure" | "neutral" {
	// Build-failed cascade — every build-dependent check reports failure when
	// the build itself failed, even if no findings are scoped to it (no
	// downstream step ran).
	if (!buildSuccess && !BUILD_INDEPENDENT_CHECKS.has(checkName)) {
		return "failure";
	}

	const own = findings.filter((f) => f.check === checkName);
	if (own.some((f) => f.severity === "error")) {
		return "failure";
	}
	if (own.some((f) => f.severity === "warning")) {
		return strictWarnings ? "failure" : "neutral";
	}
	return "success";
}
