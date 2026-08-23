/**
 * Step: Phase 2 — build validation, publish dry-runs, release-notes preview
 * and the unified validation check run.
 *
 * @remarks
 * Failure posture: **fail-the-job**, with cleanup. The body's errors are
 * caught only to tear down in-flight check runs before being re-raised
 * untouched.
 *
 * Decomposition status: **complete**. Every I/O-shaped region has its own
 * module and its own tests — `steps/link-issues.ts`,
 * `steps/build-validation.ts`, `steps/publish-validation.ts`,
 * `release/validation-checks.ts`, `steps/per-step-checks.ts` and
 * `steps/publish-validation-report.ts`. What is left here is the ORDER they run
 * in and the values that flow between them.
 *
 * ⚠️ That order is still uncovered: no test executes `runValidation` itself, so
 * a green suite says nothing about the wiring in this body — only about the six
 * modules it calls. Replacing this body with `Effect.die` would still leave the
 * suite green.
 *
 * @module steps/validation
 */

import { ActionEnvironment, ActionLogger, ActionOutputs, DryRun } from "@effected/github-actions";
import { Effect } from "effect";
import {
	buildPublishValidationSummary,
	buildReleaseNotesPreviewSummary,
	buildSbomPreviewSummary,
} from "../release/report.js";
import { applyCheckUrls, deriveValidationChecks } from "../release/validation-checks.js";
import type { Inputs } from "../schema/inputs.js";
import { emitReleaseOutput } from "../schema/outputs.js";
import { toValidationOutput } from "../schema/projections.js";
import type { ValidationOutput } from "../schema/release-output.js";
import { cleanupValidationChecks } from "../utils/cleanup-validation-checks.js";
import { createValidationCheck } from "../utils/create-validation-check.js";
import { detectPackageManager } from "../utils/detect-package-manager.js";
import { ensureFullHistory } from "../utils/ensure-full-history.js";
import { grouped } from "../utils/grouped.js";
import { buildValidation } from "./build-validation.js";
import { linkIssues } from "./link-issues.js";
import { createPerStepChecks } from "./per-step-checks.js";
import { publishValidation } from "./publish-validation.js";
import { publishValidationReport } from "./publish-validation-report.js";

/**
 * Return a copy of a {@link ValidationOutput} with per-package `releaseNotes`
 * omitted. Release-notes CHANGELOG content is rendered in the dedicated Release
 * Notes Preview check; the machine-readable structured output (the `result`
 * action output and the embedded JSON block) does not carry it — the full notes
 * for every package otherwise dominate the payload and can push the unified
 * check summary past GitHub's 65535-byte limit.
 */
const stripReleaseNotes = (output: ValidationOutput): ValidationOutput => ({
	...output,
	validation: {
		...output.validation,
		publish: {
			...output.validation.publish,
			packages: output.validation.publish.packages.map(({ releaseNotes: _omit, ...rest }) => rest),
		},
	},
});
/**
 * Phase 2 validation orchestrator.
 *
 * @public
 */
export const runValidation = (inputs: Inputs) =>
	Effect.gen(function* () {
		const logger = yield* ActionLogger;
		const outputs = yield* ActionOutputs;
		const env = yield* ActionEnvironment;

		const { releaseBranch, targetBranch } = inputs;
		const dryRun = yield* (yield* DryRun).isDryRun;
		// `strict-warnings` escalates warning-severity findings to `failure` on
		// the per-step AND unified check-run conclusions, letting auto-merge gates
		// (branch protection, Mergify, …) hold on warnings. Default `false`
		// preserves the existing advisory-warning semantics.
		const strictWarnings = inputs.strictWarnings;
		const packageManager = yield* detectPackageManager;
		const { repositoryOwner: owner, sha } = yield* env.github;

		yield* grouped(
			"Phase 2: Validation",
			Effect.gen(function* () {
				yield* Effect.logDebug(`Detected package manager: ${packageManager}`);

				// Changesets needs full history + a LOCAL ref for the target branch
				// to compute the diff between the release branch and main. The
				// checkout step in the wrapping workflow may only have shallow
				// history of changesets-release/main and an origin/main remote
				// ref; fetch+set up a local ref before any changeset-aware step
				// runs.
				yield* Effect.logDebug("Fetching git history for changeset comparison");
				yield* ensureFullHistory(targetBranch);
				yield* Effect.logDebug(`Fetched ${targetBranch} as a local ref`);

				// Steps 1-2 — issue linking and build validation. Both degrade to a
				// named fallback rather than failing; only the build one is visible
				// downstream. See each module.
				const issuesResult = yield* linkIssues(inputs);
				const buildResult = yield* buildValidation(packageManager, inputs.onBuild);

				// Steps 3-5 — publish / release-notes / SBOM validation.
				//
				// This one call replaces the twelve mutable `let` bindings that used to
				// span the next sixty-four lines. They were never twelve independent
				// variables: every one was assigned in a single `if (report !== null)`
				// block from one `ValidationReport`, and their initialisers were the
				// defaults for the two paths that never reach it — now
				// `SKIPPED_PUBLISH_VALIDATION`, named and asserted on.
				const publish = yield* publishValidation({
					buildsPassed: buildResult.success,
					packageManager,
					targetBranch,
					dryRun,
				});

				// Step 6 — the check derivation. Pure, and extracted to
				// `release/validation-checks.ts` where it is tested directly: findings,
				// per-check conclusions, the unified check rows, the 3-state checks-table
				// rows and the closing summary line all fall out of five decided facts.
				const checks = deriveValidationChecks({
					linkedIssueCount: issuesResult.linkedIssues.length,
					linkIssuesUrl: issuesResult.htmlUrl,
					buildPassed: buildResult.success,
					buildErrors: buildResult.errors,
					buildCheckId: buildResult.checkId,
					buildUrl: buildResult.htmlUrl,
					publish,
					strictWarnings,
				});
				const { findings, conclusionFor, results: checkResults } = checks;

				// Project the canonical ValidationOutput. The unified Release Validation
				// Summary check is created at the end (after the per-step checks and the
				// final `validationOutput`) so its body can carry the full structured
				// `result` JSON in a collapsed block. `checkRun` is `null` here — the
				// unified URL is not yet known, and the body JSON should not self-
				// reference the very page it lives on. The emitted `result` is shallow-
				// patched below once the unified check exists, so consumers see the
				// real `{url, conclusion}` in the action output.
				const projectValidation = (
					checks: ReadonlyArray<ValidationOutput["validation"]["checks"][number]>,
				): ValidationOutput =>
					toValidationOutput({
						buildsPassed: buildResult.success,
						packageCount: publish.packages.length,
						npmReady: publish.npmReady,
						githubPackagesReady: publish.githubPackagesReady,
						totalTargets: publish.totalTargets,
						readyTargets: publish.readyTargets,
						checks,
						findings,
						validationPackages: publish.validationPackages,
						checkRun: null,
						dryRun,
					});

				// Draft projection over the placeholder rows — feeds the per-step
				// summary builders below. The per-step URLs for Publish / Release
				// Notes / SBOM are filled in further down.
				const summaryDraftOutput = projectValidation(checks.rows);

				// Create the three per-step check runs after the canonical object is
				// known — each summary is rendered from `summaryDraftOutput.validation`.
				// Rendering stays here (report.ts owns it); publishing is the step's.
				const perStepUrls = yield* createPerStepChecks({
					sha,
					dryRun,
					conclusionFor,
					summaries: {
						publish: buildPublishValidationSummary(summaryDraftOutput.validation),
						releaseNotes: buildReleaseNotesPreviewSummary(summaryDraftOutput.validation),
						sbom: buildSbomPreviewSummary(
							summaryDraftOutput.validation,
							publish.resolvedSbomConfig,
							publish.sbomConfigSource,
						),
					},
				});

				// Fill in the Publish / Release Notes / SBOM rows with each check's real
				// url, now that those check runs exist. Build / Link keep theirs.
				const checkRows = applyCheckUrls(checks.rows, perStepUrls);

				yield* Effect.logInfo(checks.summaryLine);

				// Provisional projection over the final per-step URLs — used to build
				// the JSON block in the check-run body. `checkRun` is `null` here so
				// the body JSON does not self-reference the very page it lives on; the
				// emitted `result` is patched below with the now-known unified URL.
				const provisionalOutput = projectValidation(checkRows);

				// Build the collapsed JSON block surfacing the full structured `result`
				// action output inside the unified check-run page — the downstream-
				// consumer artifact is no longer hidden behind the action's outputs.
				const jsonBlock = [
					"",
					"<details>",
					"<summary>📦 Full structured output (<code>result</code> action output)</summary>",
					"",
					"```json",
					JSON.stringify(stripReleaseNotes(provisionalOutput), null, 2),
					"```",
					"",
					"</details>",
				].join("\n");

				const unified = yield* logger.group("Validation check", createValidationCheck(checkResults, dryRun, jsonBlock));
				yield* Effect.logInfo(`✅ Validation check — conclusion: ${unified.success ? "success" : "failure"}`);
				const unifiedUrl = unified.htmlUrl !== "" ? unified.htmlUrl : undefined;

				// Patch the emitted result with the now-known unified check URL /
				// conclusion. The one-line divergence between the body JSON
				// (`checkRun: null`) and the emitted `result` (`checkRun: { url,
				// conclusion }`) is intentional — the body JSON should not self-
				// reference the very page it lives on, but the `result` action output
				// must carry the unified check URL for downstream consumers.
				const validationOutput: ValidationOutput = {
					...provisionalOutput,
					validation: {
						...provisionalOutput.validation,
						checkRun:
							unified.htmlUrl !== ""
								? { url: unified.htmlUrl, conclusion: unified.success ? "success" : "failure" }
								: null,
					},
				};

				// Step 7 — the sticky comment on the release PR. The lookup, the three
				// sections and the folded read-modify-write are
				// `steps/publish-validation-report.ts`, where they are tested; what is
				// decided here is only what the comment is a projection OF — the
				// canonical `ValidationOutput` payload and the same per-package results
				// the checks were derived from, so the comment cannot disagree with the
				// check run above it.
				yield* publishValidationReport({
					owner,
					releaseBranch,
					targetBranch,
					// The one `env.github` read above — the report step no longer
					// re-reads GITHUB_SHA with a `""` fallback that could stamp an
					// empty sha.
					headSha: sha,
					report: {
						validation: validationOutput.validation,
						validationPackages: publish.validationPackages,
						options: {
							...(unifiedUrl !== undefined && { releaseNotesUrl: unifiedUrl }),
							dryRun,
						},
					},
				});

				// Emit the structured `result` action output for Phase 2. Release notes are
				// stripped here — they live in the Release Notes Preview check, not the
				// machine-readable payload (see stripReleaseNotes).
				yield* emitReleaseOutput(outputs, stripReleaseNotes(validationOutput), {
					packageCount: publish.packages.length,
					// Phase 2 runs on a push to the release branch; the release PR number is not
					// in the event payload and resolving it would need an extra API lookup, so
					// the release-pr-number scalar is left empty for the validation phase.
					releasePrNumber: null,
				});
			}).pipe(
				Effect.catch((e) =>
					Effect.gen(function* () {
						yield* Effect.logError(`Phase 2 failed: ${String(e)}`);
						yield* cleanupValidationChecks([], `Phase 2 failed: ${String(e)}`, dryRun).pipe(
							Effect.catch(() => Effect.succeed({ cleanedUp: 0, failed: 0, errors: [] })),
						);
						return yield* Effect.fail(e);
					}),
				),
			),
		);
	});
