/**
 * Step: Phase 2's publish / release-notes / SBOM validation — the "Steps 3-5"
 * region of the old `runValidation` body.
 *
 * @remarks
 * This module exists to give the twelve mutable `let` bindings that used to
 * coordinate that region a name and a type. They were never twelve independent
 * variables: every one was assigned in a single `if (report !== null)` block
 * from one `ValidationReport`, and their twelve initialisers were the defaults
 * for the two paths that never reach it. So the region is one optional record
 * plus a default — {@link PublishValidationResult} and
 * {@link SKIPPED_PUBLISH_VALIDATION} — not a state machine.
 *
 * Making the default a named constant is the point as much as the extraction
 * is. "What does Phase 2 report when the build failed?" was previously
 * answerable only by reading twelve separate initialiser expressions, and
 * nothing asserted on it.
 *
 * Failure posture: **degrade-with-a-finding**, and the error channel says so —
 * `never`. The step never fails its own effect; what it returns is what decides
 * the verdict, because `deriveCheckConclusion` reads *findings* and nothing
 * else. The two non-running paths are therefore not interchangeable:
 *
 * - **Build failed** — an ordinary outcome. Returns {@link SKIPPED_PUBLISH_VALIDATION}
 *   and stays quiet, because the caller's build finding already fails the phase
 *   and the build-failed cascade already covers every downstream row.
 * - **`runValidation` threw** — a FAILURE, and reported as one. Returns
 *   {@link crashedPublishValidation}, which carries an `error` finding per
 *   affected check so the release PR shows the failure instead of ✅ 5/5. Before
 *   [#216](https://github.com/savvy-web/silk-release-action/issues/216) this
 *   path shared the quiet baseline, and a crashed validation passed.
 *
 * A **defect** (as opposed to an error) still propagates and kills the phase.
 * That is deliberate and load-bearing: it is the one path where a broken
 * validation fails the run outright, so the `Effect.catch` below must never be
 * widened to `catchCause`.
 *
 * @module steps/publish-validation
 */

import type { Git } from "@effected/git";
import type { ActionLogger } from "@effected/github-actions";
import type { PackagePublish } from "@effected/npm";
import type { SbomMetadata } from "@effected/sbom";
import type { PublishabilityDetector, WorkspaceDiscovery, WorkspaceSnapshots } from "@effected/workspaces";
import type { FileSystem } from "effect";
import { Effect } from "effect";
import type { ChangesetConfig } from "../release/changeset-config.js";
import type { ValidationFinding, ValidationPackageResult } from "../release/types.js";
import { runValidation as runValidationEffect } from "../release/validation.js";
import type { ConfigSource } from "../utils/load-release-config.js";
import { PER_STEP_CHECK_NAMES } from "./per-step-checks.js";

/**
 * What Phase 2 learned from the publish dry-runs, the release-notes pass and
 * the SBOM/NTIA checks.
 *
 * @remarks
 * Field-for-field the subset of `ValidationReport` the phase body consumes,
 * with one deliberate widening: `resolvedSbomConfig` is nullable here where the
 * report's is not. `null` means **the validation never ran** — a distinct fact
 * from an empty map, which means it ran and resolved no config. The SBOM
 * Preview check summary renders the two differently.
 *
 * @public
 */
export interface PublishValidationResult {
	readonly publishOk: boolean;
	readonly npmReady: boolean;
	readonly githubPackagesReady: boolean;
	readonly totalTargets: number;
	readonly readyTargets: number;
	/** Per-package publish summary, for the release output. */
	readonly packages: ReadonlyArray<{ readonly name: string; readonly version: string; readonly ready: boolean }>;
	/** Build-centric per-package results — the input to the `ValidationOutput` projection. */
	readonly validationPackages: ReadonlyArray<ValidationPackageResult>;
	readonly sbomOk: boolean;
	/** Human-readable SBOM status line, shown on the check and in the log. */
	readonly sbomSummary: string;
	/** Structured findings from the publish dry-run and SBOM/NTIA checks. */
	readonly findings: ReadonlyArray<ValidationFinding>;
	/** Debug-only per-build resolved metadata; `null` when validation never ran. */
	readonly resolvedSbomConfig: ReadonlyMap<string, SbomMetadata> | null;
	/** Where the `sbom-config` came from; `null` when validation never ran. */
	readonly sbomConfigSource: ConfigSource | null;
}

/**
 * What Phase 2 reports when the publish validation did not run.
 *
 * @remarks
 * Reached two ways — the build failed, so there is nothing to dry-run; or
 * `runValidation` itself threw. Both are logged, neither fails the phase.
 *
 * The values are not arbitrary. `publishOk` and `sbomOk` start **true** because
 * a check that never ran has produced no failure of its own; what fails the run
 * in that case is the *build* finding, raised by the caller, and
 * `deriveCheckConclusion`'s build-failed cascade — which reports `failure` for
 * the downstream rows precisely so the conclusion does not lie about steps that
 * never ran. Starting them `false` here would double-count that.
 *
 * `sbomSummary` says "skipped" rather than describing a result, and both debug
 * fields are `null` rather than empty, so a reader of the SBOM Preview check
 * can tell "never ran" from "ran and found nothing".
 *
 * @public
 */
export const SKIPPED_PUBLISH_VALIDATION: PublishValidationResult = {
	publishOk: true,
	npmReady: false,
	githubPackagesReady: false,
	totalTargets: 0,
	readyTargets: 0,
	packages: [],
	validationPackages: [],
	sbomOk: true,
	sbomSummary: "SBOM Preview skipped",
	findings: [],
	resolvedSbomConfig: null,
	sbomConfigSource: null,
};

/**
 * What Phase 2 reports when `runValidation` threw.
 *
 * @remarks
 * Distinct from {@link SKIPPED_PUBLISH_VALIDATION}, and the distinction is the
 * fix for [#216](https://github.com/savvy-web/silk-release-action/issues/216).
 * Both describe "the dry-run did not happen", but only one of them has
 * something else reporting the failure: on the build-failed path the *build*
 * finding fails the phase and `deriveCheckConclusion`'s cascade covers every
 * downstream row, so the baseline must stay quiet to avoid double-counting. On
 * the crash path the build PASSED, so that cascade never fires and nothing else
 * speaks — which is how a crashed validation reported ✅ 5/5.
 *
 * So the baseline is reused **verbatim**, `publishOk: true` included, and the
 * only thing added is a finding per affected check. Findings are the sole input
 * the verdict reads, which is why this is one decision rather than six patches:
 * flipping `publishOk` instead would fix this path and break the other one.
 *
 * The three checks come from {@link PER_STEP_CHECK_NAMES} rather than a fourth
 * copy of the same literals. Those strings are a **join key**:
 * `deriveCheckConclusion` and `statusFor` both match findings by
 * `finding.check === name`, so a name that drifts from the constant detaches
 * the finding from its row and the conclusion silently returns to green — the
 * exact failure this fix exists to remove. `Build Validation` is deliberately
 * absent (it ran, and reported honestly), as is `Link Issues from Commits`
 * (a different step, with its own degradation).
 *
 * @param message - The rendered crash, already logged, repeated into each
 *   finding so the failure is legible on the release PR and not only in the
 *   job log.
 * @returns The skipped baseline carrying one `error` finding per check in
 *   {@link PER_STEP_CHECK_NAMES}.
 *
 * @public
 */
export const crashedPublishValidation = (message: string): PublishValidationResult => ({
	...SKIPPED_PUBLISH_VALIDATION,
	sbomSummary: "SBOM Preview did not run — publish validation crashed",
	findings: PER_STEP_CHECK_NAMES.map((check) => ({
		severity: "error" as const,
		check,
		scope: null,
		message: `Publish validation crashed before this check ran: ${message}`,
	})),
});

/**
 * What the step needs to decide whether to run, and how.
 *
 * @public
 */
export interface PublishValidationArgs {
	/**
	 * Whether the build step passed.
	 *
	 * @remarks
	 * The gate. A failed build means the artifacts a dry-run would inspect were
	 * never produced, so running the dry-run would report a failure caused by
	 * the build rather than by anything about publishing.
	 */
	readonly buildsPassed: boolean;
	readonly packageManager: string;
	readonly targetBranch: string;
	readonly dryRun: boolean;
}

/**
 * Everything this step needs provided — `runValidation`'s own channel.
 *
 * @public
 */
export type PublishValidationServices =
	| ActionLogger
	| ChangesetConfig
	| FileSystem.FileSystem
	| Git
	| PackagePublish
	| PublishabilityDetector
	| WorkspaceDiscovery
	| WorkspaceSnapshots;

/**
 * Run the publish / release-notes / SBOM validation, or report the skipped
 * baseline.
 *
 * @param args - The build gate and the validation inputs.
 * @returns The report, or {@link SKIPPED_PUBLISH_VALIDATION}. Never fails.
 *
 * @public
 */
export const publishValidation = (
	args: PublishValidationArgs,
): Effect.Effect<PublishValidationResult, never, PublishValidationServices> =>
	Effect.gen(function* () {
		if (!args.buildsPassed) {
			yield* Effect.logWarning("Builds failed, skipping publish validation");
			return SKIPPED_PUBLISH_VALIDATION;
		}

		yield* Effect.logInfo("Validate publishing");
		// `Effect.catch`, NOT `catchCause`. A DEFECT from `runValidation` is left to
		// propagate and kill the phase, which is the one path where a broken
		// validation fails the run outright. Widening this to catch defects would
		// route that last honest failure signal into the same degraded result the
		// rest of this function builds — see #216's "deliberately not touched".
		const outcome = yield* runValidationEffect({
			packageManager: args.packageManager,
			targetBranch: args.targetBranch,
			dryRun: args.dryRun,
		}).pipe(
			Effect.map((report) => ({ crashed: false as const, report })),
			Effect.catch((e) =>
				Effect.gen(function* () {
					// The stack matters here: this is the one place a validation crash is
					// visible at all, and the tagged error's message alone has repeatedly
					// been too thin to locate the cause.
					const message =
						e instanceof Error ? `${e.message}\n${String((e as Error & { stack?: string }).stack ?? "")}` : String(e);
					yield* Effect.logWarning(`runValidation failed: ${message}`);
					return { crashed: true as const, message };
				}),
			),
		);

		// The crash arm is only reachable as a crash: the build-failed path returned
		// above, so the two no longer share a result.
		const result: PublishValidationResult = outcome.crashed
			? crashedPublishValidation(outcome.message)
			: {
					publishOk: outcome.report.publishOk,
					npmReady: outcome.report.npmReady,
					githubPackagesReady: outcome.report.githubPackagesReady,
					totalTargets: outcome.report.totalTargets,
					readyTargets: outcome.report.readyTargets,
					packages: outcome.report.packages,
					validationPackages: outcome.report.validationPackages,
					sbomOk: outcome.report.sbomOk,
					sbomSummary: outcome.report.sbomSummary,
					findings: outcome.report.findings,
					resolvedSbomConfig: outcome.report.resolvedSbomConfig,
					sbomConfigSource: outcome.report.sbomConfigSource,
				};

		// The three log lines the region emitted, in order. They are emitted on the
		// ran-but-failed path too: `publishOk === false` is a result worth
		// reporting, not a reason to say nothing.
		//
		// The crash arm says "did not run" rather than reusing the ok/not-ok
		// ternary. `publishOk` stays TRUE on that path by design (see
		// `crashedPublishValidation`), so the ternary alone would print ✅ for a
		// dry-run that never happened — the log-shaped half of #216.
		if (outcome.crashed) {
			yield* Effect.logInfo("❌ Publish validation — did not run (crashed)");
			yield* Effect.logInfo("❌ Release notes — did not run (publish validation crashed)");
			yield* Effect.logInfo(`❌ SBOM preview — ${result.sbomSummary}`);
		} else {
			yield* Effect.logInfo(
				result.publishOk
					? `✅ Publish validation — ${result.readyTargets}/${result.totalTargets} target(s) ready`
					: `❌ Publish validation — ${result.readyTargets}/${result.totalTargets} target(s) ready`,
			);
			yield* Effect.logInfo(`✅ Release notes — ${result.packages.length} package(s) ready`);
			yield* Effect.logInfo(
				result.sbomOk ? `✅ SBOM preview — ${result.sbomSummary}` : `❌ SBOM preview — ${result.sbomSummary}`,
			);
		}

		return result;
	});
