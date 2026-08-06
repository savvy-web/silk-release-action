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
 * Failure posture: **degrade-to-warning**, and the error channel says so —
 * `never`. Both skip paths are ordinary outcomes, not failures: a failed build
 * means there is nothing to dry-run, and a validation run that throws is worth
 * a warning and a skipped report rather than a dead release branch. The
 * *findings* it returns are what make the run fail downstream, via
 * `deriveCheckConclusion`.
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
		const report = yield* runValidationEffect({
			packageManager: args.packageManager,
			targetBranch: args.targetBranch,
			dryRun: args.dryRun,
		}).pipe(
			Effect.catch((e) =>
				Effect.gen(function* () {
					// The stack matters here: this is the one place a validation crash is
					// visible at all, and the tagged error's message alone has repeatedly
					// been too thin to locate the cause.
					const message =
						e instanceof Error ? `${e.message}\n${String((e as Error & { stack?: string }).stack ?? "")}` : String(e);
					yield* Effect.logWarning(`runValidation failed: ${message}`);
					return null;
				}),
			),
		);

		const result: PublishValidationResult =
			report === null
				? SKIPPED_PUBLISH_VALIDATION
				: {
						publishOk: report.publishOk,
						npmReady: report.npmReady,
						githubPackagesReady: report.githubPackagesReady,
						totalTargets: report.totalTargets,
						readyTargets: report.readyTargets,
						packages: report.packages,
						validationPackages: report.validationPackages,
						sbomOk: report.sbomOk,
						sbomSummary: report.sbomSummary,
						findings: report.findings,
						resolvedSbomConfig: report.resolvedSbomConfig,
						sbomConfigSource: report.sbomConfigSource,
					};

		// The three log lines the region emitted, unchanged and in order. They are
		// emitted on the ran-but-failed path too: `publishOk === false` is a result
		// worth reporting, not a reason to say nothing.
		yield* Effect.logInfo(
			result.publishOk
				? `✅ Publish validation — ${result.readyTargets}/${result.totalTargets} target(s) ready`
				: `❌ Publish validation — ${result.readyTargets}/${result.totalTargets} target(s) ready`,
		);
		yield* Effect.logInfo(`✅ Release notes — ${result.packages.length} package(s) ready`);
		yield* Effect.logInfo(
			result.sbomOk ? `✅ SBOM preview — ${result.sbomSummary}` : `❌ SBOM preview — ${result.sbomSummary}`,
		);

		return result;
	});
