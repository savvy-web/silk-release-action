/**
 * Step: Phase 2's "Validate builds" — run every package's build and report it
 * as a check run.
 *
 * @remarks
 * Failure posture: **degrade-to-warning**, and the error channel says so —
 * `never`. But unlike {@link linkIssues}, degrading here is *not* invisible:
 * the fallback reports `success: false`, which the check derivation turns into
 * an error-severity finding and then cascades onto every build-dependent row.
 * A crashed build validation fails the phase, exactly as a failed build does.
 *
 * That asymmetry is the point of the step being separate: the build is the
 * gate everything downstream is conditioned on, and issue linking is not.
 *
 * @module steps/build-validation
 */

import type { CheckRun, Repo } from "@effected/github";
import type { ActionEnvironment, ActionLogger, ActionOutputs, DryRun } from "@effected/github-actions";
import type { FileSystem, Option } from "effect";
import { Effect } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import { grouped } from "../utils/grouped.js";
import type { BuildValidationResult } from "../utils/validate-builds.js";
import { validateBuilds } from "../utils/validate-builds.js";

/**
 * What Phase 2 reports when the build validation itself crashed.
 *
 * @remarks
 * A function rather than a constant, because `errors` carries the rendered
 * cause — and `errors` is load-bearing: the check derivation uses it as the
 * build finding's message, falling back to `"Build failed"` only when it is
 * blank. Losing it would replace a real stack with a generic string on the one
 * path where the diagnosis matters most.
 *
 * `success: false` is what makes this degradation honest, and is the whole
 * difference from `LINK_ISSUES_FAILED`: it feeds an error finding and the
 * build-failed cascade, so a crashed build validation reports red.
 *
 * @param cause - The rendered failure.
 *
 * @public
 */
export const buildValidationFailed = (cause: string): BuildValidationResult => ({
	success: false,
	errors: cause,
	/** Never read — see the `checkId is write-only` characterization test. */
	checkId: 0,
	/** `""` is the "no check run" sentinel the checks-table row turns into `null`. */
	htmlUrl: "",
});

/**
 * Everything this step needs provided.
 *
 * @public
 */
export type BuildValidationServices =
	| ActionEnvironment
	| ActionLogger
	| ActionOutputs
	| CheckRun
	| ChildProcessSpawner.ChildProcessSpawner
	| DryRun
	| FileSystem.FileSystem
	| Repo;

/**
 * Run the build validation inside a collapsible log group.
 *
 * @param packageManager - The detected package manager, for the script argv.
 * @param onBuild - The optional `on-build` gate command; `None` is a no-op.
 * @returns The build result, or {@link buildValidationFailed}. Never fails.
 *
 * @public
 */
export const buildValidation = (
	packageManager: string,
	onBuild: Option.Option<string>,
): Effect.Effect<BuildValidationResult, never, BuildValidationServices> =>
	Effect.gen(function* () {
		const result = yield* grouped(
			"Validate builds",
			validateBuilds(packageManager, onBuild).pipe(
				Effect.catch((e) =>
					Effect.gen(function* () {
						// `logError`, not `logWarning` — the level matches the consequence.
						yield* Effect.logError(`validateBuilds failed: ${String(e)}`);
						return buildValidationFailed(String(e));
					}),
				),
			),
		);

		// Branches, unlike the link-issues line above it.
		yield* Effect.logInfo(result.success ? "✅ Build validation — passed" : "❌ Build validation — failed");

		return result;
	});
