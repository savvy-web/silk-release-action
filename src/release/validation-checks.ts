/**
 * The Phase-2 check derivation: findings → conclusions → the unified check
 * table and the checks-table rows.
 *
 * @remarks
 * Pure and service-free. Every value Phase 2 reports about *whether the release
 * is OK* is computed here from five already-decided facts, so the whole
 * decision surface is assertable without a runtime, a layer or a check-run
 * double.
 *
 * That matters more than the tidiness: this is the code path
 * savvy-web/silk-release-action#216 runs through. The green-on-crash chain is
 * {@link deriveValidationChecks}'s `conclusionFor` → `results` → `rows`, and
 * before C2 none of it had ever been executed by a test.
 *
 * **Not under `steps/`, deliberately.** `steps/` is for orchestration units —
 * things that do I/O and declare a requirement channel. This does neither. It
 * sits beside `release/report.ts` (which renders these values) and
 * `release/types.ts` (which types them), where the rest of the Phase-2 domain
 * logic already lives.
 *
 * @module release/validation-checks
 */

import type { ValidationOutput } from "../schema/release-output.js";
import type { PublishValidationResult } from "../steps/publish-validation.js";
import type { ValidationResult } from "../types/shared-types.js";
import { deriveCheckConclusion } from "../utils/derive-check-conclusion.js";
import type { ValidationFinding } from "./types.js";

/** One row of the checks table carried on `ValidationOutput`. */
export type CheckRow = ValidationOutput["validation"]["checks"][number];

/** A per-step check-run conclusion. */
export type CheckConclusion = "success" | "failure" | "neutral";

/**
 * The five Phase-2 check names, in the order they are reported.
 *
 * @remarks
 * These strings are a **join key**, not labels: `deriveCheckConclusion` filters
 * findings by `finding.check === name`, and `BUILD_INDEPENDENT_CHECKS` matches
 * on them too. A row renamed here without renaming the finding that targets it
 * silently detaches the finding from its check — the conclusion goes green and
 * the finding still appears in the JSON. They were previously written out
 * five times each across three separate literals.
 *
 * @public
 */
export const CHECK_NAMES = [
	"Link Issues from Commits",
	"Build Validation",
	"Publish Validation",
	"Release Notes Preview",
	"SBOM Preview",
] as const;

/**
 * The facts the check derivation runs on.
 *
 * @public
 */
export interface ValidationCheckInputs {
	readonly linkedIssueCount: number;
	/** The Link-Issues check-run URL, or `""` when it could not be created. */
	readonly linkIssuesUrl: string;
	readonly buildPassed: boolean;
	/** Raw build stderr, used as the build finding's message. */
	readonly buildErrors: string;
	readonly buildCheckId: number;
	/** The Build-Validation check-run URL, or `""` when it could not be created. */
	readonly buildUrl: string;
	readonly publish: PublishValidationResult;
	readonly strictWarnings: boolean;
}

/**
 * Everything Phase 2 derives about the checks, in one bundle.
 *
 * @public
 */
export interface ValidationCheckState {
	/** Every structured finding, build-first then the publish/SBOM ones. */
	readonly findings: ReadonlyArray<ValidationFinding>;
	/** The per-step check-run conclusion for a check name. */
	readonly conclusionFor: (checkName: string) => CheckConclusion;
	/** The rows the unified Release Validation Summary check consumes. */
	readonly results: ReadonlyArray<ValidationResult>;
	/** The 3-state checks-table rows, with the three later URLs still `null`. */
	readonly rows: ReadonlyArray<CheckRow>;
	/** The phase's closing log line. */
	readonly summaryLine: string;
}

/**
 * Derive every check verdict Phase 2 reports.
 *
 * @param inputs - The already-decided facts; nothing is read from a service.
 *
 * @public
 */
export const deriveValidationChecks = (inputs: ValidationCheckInputs): ValidationCheckState => {
	const { publish } = inputs;

	// Aggregate the structured findings across every Phase-2 check. The publish
	// dry-run + SBOM/NTIA findings come from the publish validation; the build
	// finding is derived here.
	//
	// Honesty note: Link-Issues and Release-Notes contribute no findings.
	// `LinkIssuesResult` exposes no failure signal (the step always completes its
	// check as `success` and the phase body degrades any thrown error to an empty
	// result), and there is no rich release-notes module — no missing-CHANGELOG /
	// notes-extraction signal exists.
	const findings: ValidationFinding[] = [];
	if (!inputs.buildPassed) {
		findings.push({
			severity: "error",
			check: "Build Validation",
			scope: null,
			message: inputs.buildErrors.trim() || "Build failed",
		});
	}
	findings.push(...publish.findings);

	// Conclusion-per-check rule used for the three per-step check runs AND
	// propagated into the unified summary's per-row `success` field — so the
	// unified conclusion and the per-step conclusions agree on strict-warnings
	// escalation.
	//
	// Build-failed cascade — when Build Validation fails, the publish validation
	// is skipped so the downstream rows emit no findings. The helper reports
	// `failure` for them so the conclusion does not lie about steps that never
	// ran. ⚠️ It is gated on `!buildPassed`, which is why #216's crash path —
	// where the build DID pass — slips through green.
	const conclusionFor = (checkName: string): CheckConclusion =>
		deriveCheckConclusion(checkName, findings, inputs.buildPassed, inputs.strictWarnings);

	// Translate a conclusion into the boolean shape the unified check run
	// consumes. `neutral` (warning, non-strict) counts as success for the unified
	// table — preserving the "warnings are advisory" semantics. `failure`
	// (errors, or warnings under strict mode) flips the row to failed.
	const successFor = (checkName: string): boolean => conclusionFor(checkName) !== "failure";

	const targetsMessage =
		publish.totalTargets === 0 ? "No targets" : `${publish.readyTargets}/${publish.totalTargets} target(s) ready`;
	const issuesMessage = `${inputs.linkedIssueCount} issue(s) linked`;
	const notesMessage = `${publish.packages.length} package(s) ready`;
	const buildMessage = inputs.buildPassed ? "Build passed" : "Build failed";

	// ⚠️ `checkId` is WRITE-ONLY. `createValidationCheck` reads only `name`,
	// `success` and `message` off these rows. Preserved verbatim — including the
	// hardcoded zeroes — because removing a field from a shared type is a change,
	// not a characterization.
	const results: ReadonlyArray<ValidationResult> = [
		{
			name: "Link Issues from Commits",
			success: successFor("Link Issues from Commits"),
			checkId: 0,
			message: issuesMessage,
		},
		{
			// NOT routed through `successFor`, unlike every other row. Unreachable
			// today: the only finding ever scoped to this check is the error pushed
			// above, and `buildPassed` is false whenever it exists. Preserved as-is.
			name: "Build Validation",
			success: inputs.buildPassed,
			checkId: inputs.buildCheckId,
			message: buildMessage,
		},
		{
			name: "Publish Validation",
			success: inputs.buildPassed && publish.publishOk && successFor("Publish Validation"),
			checkId: 0,
			message: targetsMessage,
		},
		{ name: "Release Notes Preview", success: successFor("Release Notes Preview"), checkId: 0, message: notesMessage },
		{
			name: "SBOM Preview",
			success: publish.sbomOk && successFor("SBOM Preview"),
			checkId: 0,
			message: publish.sbomSummary,
		},
	];

	// Derive the 3-state checks-table icon per row from the findings the check
	// produced: any error → error, else any warning → warning, else pass. The
	// `hardFailed` flag covers checks whose failure is not also a finding (e.g. a
	// publish failure when the build itself passed).
	//
	// ⚠️ Deliberately NOT strict-warnings-aware, unlike `conclusionFor`. Under
	// `strict-warnings` a warning row renders ⚠️ here while its check run
	// concludes `failure`. That is the documented contract — see
	// `derive-check-conclusion.ts`'s header: the checks-table icon and the JSON
	// severity are unchanged under strict mode, only the conclusion flips.
	const statusFor = (checkName: string, hardFailed: boolean): "pass" | "warning" | "error" => {
		const own = findings.filter((f) => f.check === checkName);
		if (hardFailed || own.some((f) => f.severity === "error")) return "error";
		if (own.some((f) => f.severity === "warning")) return "warning";
		return "pass";
	};

	// `""` is the kit's "no URL" sentinel — `CheckRunRef.url` is built as
	// `raw.html_url ?? ""` — and becomes `null` on the row.
	const orNull = (url: string): string | null => (url !== "" ? url : null);

	// Link and Build carry their own per-step URLs; the remaining three are
	// filled in by `applyCheckUrls` once those check runs exist.
	const rows: ReadonlyArray<CheckRow> = [
		{
			name: "Link Issues from Commits",
			status: statusFor("Link Issues from Commits", false),
			outcome: issuesMessage,
			url: orNull(inputs.linkIssuesUrl),
		},
		{
			name: "Build Validation",
			status: statusFor("Build Validation", !inputs.buildPassed),
			outcome: buildMessage,
			url: orNull(inputs.buildUrl),
		},
		{
			name: "Publish Validation",
			status: statusFor("Publish Validation", !inputs.buildPassed || !publish.publishOk),
			outcome: targetsMessage,
			url: null,
		},
		{
			name: "Release Notes Preview",
			status: statusFor("Release Notes Preview", false),
			outcome: notesMessage,
			url: null,
		},
		{
			name: "SBOM Preview",
			status: statusFor("SBOM Preview", !inputs.buildPassed || !publish.sbomOk),
			outcome: publish.sbomSummary,
			url: null,
		},
	];

	const passedCount = results.filter((r) => r.success).length;
	const summaryLine =
		passedCount === results.length
			? `Release validation: ✅ ${passedCount}/${results.length} checks passed`
			: `Release validation: ❌ ${passedCount}/${results.length} checks passed — failed: ${results
					.filter((r) => !r.success)
					.map((r) => r.name)
					.join(", ")}`;

	return { findings, conclusionFor, results, rows, summaryLine };
};

/**
 * Fill in the Publish / Release Notes / SBOM rows with their real check URLs.
 *
 * @remarks
 * Separate from {@link deriveValidationChecks} because those three check runs
 * are created *after* the draft projection they are rendered from — so the URLs
 * do not exist when the rows are first derived. Link and Build rows keep
 * whatever they already had.
 *
 * A `""` URL leaves the existing value in place rather than blanking it: `""`
 * means the check run could not be created, not that it has no page.
 *
 * @public
 */
export const applyCheckUrls = (
	rows: ReadonlyArray<CheckRow>,
	urls: { readonly publish: string; readonly releaseNotes: string; readonly sbom: string },
): ReadonlyArray<CheckRow> => {
	const urlFor = (placeholder: string | null, real: string): string | null => (real !== "" ? real : placeholder);
	return rows.map((row) => {
		if (row.name === "Publish Validation") return { ...row, url: urlFor(row.url, urls.publish) };
		if (row.name === "Release Notes Preview") return { ...row, url: urlFor(row.url, urls.releaseNotes) };
		if (row.name === "SBOM Preview") return { ...row, url: urlFor(row.url, urls.sbom) };
		return row;
	});
};
