/**
 * Step: Phase 3 — multi-registry publish, git tags, GitHub releases and
 * SBOM/attestation.
 *
 * @remarks
 * Failure posture: **fail-the-job**. A failed build/SBOM gate or a partial
 * publish raises {@link PublishError} rather than returning — `setFailed`
 * only annotates, and returning here is what once let a 4-of-8-target publish
 * report a green run. The follow-on close-linked-issues work degrades to a
 * warning: it is housekeeping after a successful release.
 *
 * @module steps/publishing
 */

import { Git } from "@effected/git";
import { ActionLogger, ActionOutputs, DryRun } from "@effected/github-actions";
import { Effect } from "effect";
import { PublishError } from "../release/errors.js";
import type { DetectedRelease } from "../release/publish.js";
import { detectReleases, runBuildAndSbom, runPublishTargets } from "../release/publish.js";
import { runReleases } from "../release/releases.js";
import type { PublishPackagesResult, ReleaseInfo } from "../release/types.js";
import type { Inputs } from "../schema/inputs.js";
import { emitReleaseOutput } from "../schema/outputs.js";
import { toPublishingOutput } from "../schema/projections.js";
import { closeLinkedIssues } from "../utils/close-linked-issues.js";
import { detectPackageManager } from "../utils/detect-package-manager.js";
import type { TagInfo } from "../utils/determine-tag-strategy.js";
import { determineTagStrategy, isMonorepoForTagging } from "../utils/determine-tag-strategy.js";
import { ensureFullHistory } from "../utils/ensure-full-history.js";
import { grouped } from "../utils/grouped.js";
import { sortReleasesTopologically } from "../utils/sort-releases-topologically.js";

/**
 * Phase 3 publishing orchestrator. Delegates to the Effect-based
 * {@link detectReleases}, {@link runBuildAndSbom}, and {@link runPublishTargets}
 * programs from `src/release/publish.ts` and the {@link runReleases} program
 * from `src/release/releases.ts`.
 */
/**
 * Phase 3 publishing orchestrator.
 *
 * @public
 */
export const runPublishing = (inputs: Inputs, mergedReleasePRNumber: number | undefined) =>
	grouped(
		"Phase 3: Publishing",
		Effect.gen(function* () {
			const logger = yield* ActionLogger;
			const outputs = yield* ActionOutputs;

			const { targetBranch } = inputs;
			const dryRun = yield* (yield* DryRun).isDryRun;
			const packageManager = yield* detectPackageManager;

			const emitPublishing = (
				publishResult: PublishPackagesResult,
				tags: ReadonlyArray<TagInfo>,
				releases: ReadonlyArray<ReleaseInfo>,
				tagShas: Record<string, string>,
			) =>
				emitReleaseOutput(outputs, toPublishingOutput({ publishResult, tags, releases, tagShas, dryRun }), {
					packageCount: publishResult.totalPackages,
					releasePrNumber: mergedReleasePRNumber !== undefined ? mergedReleasePRNumber : null,
				});

			// ── Prelude (detail) ───────────────────────────────────────────────────
			yield* Effect.logDebug(`Detected package manager: ${packageManager}`);
			yield* ensureFullHistory(targetBranch);

			const args = { packageManager, targetBranch, dryRun, mergedReleasePRNumber };

			// ── Step 1: Detect released packages ───────────────────────────────────
			// `detectReleases` wraps itself in Step.withStep, which emits its own
			// success line on completion. No extra info line here.
			const detectedUnordered = yield* detectReleases(args);

			// Order the detected packages dependency-first once, at the source, so
			// every downstream step — tag strategy (Step 2), build & SBOM (Step 3),
			// publish (Step 4), and GitHub releases (Step 5) — surfaces packages in
			// the same topological order. Detection returns workspace glob order
			// (alphabetical); without this, releases/tags ran alphabetically while
			// publishing ran topologically. `runPublishTargets` re-sorts internally
			// (idempotent on an already-ordered list) as defence-in-depth.
			const detectedByName = new Map(detectedUnordered.map((d) => [d.name, d] as const));
			const detectedOrder = yield* sortReleasesTopologically(detectedUnordered.map((d) => d.name));
			const detected: ReadonlyArray<DetectedRelease> = detectedOrder
				.map((name) => detectedByName.get(name))
				.filter((d): d is DetectedRelease => d !== undefined);

			if (detected.length === 0) {
				const empty: PublishPackagesResult = {
					success: true,
					packages: [],
					totalPackages: 0,
					successfulPackages: 0,
					totalTargets: 0,
					successfulTargets: 0,
				};
				yield* emitPublishing(empty, [], [], {});
				yield* Effect.logInfo("Release publishing: ✅ nothing to publish");
				return;
			}

			// ── Step 2: Determine tag strategy ─────────────────────────────────────
			// `Step.groupStep` wraps the body in BOTH a GitHub Actions group and
			// a `Step.withStep` envelope, so the step's `Step.success` line lands
			// inside the group instead of leaving it empty (which produced the
			// gap-only `Tag strategy` block in the runner UI before).
			const tagStrategy = yield* grouped(
				"Tag strategy",
				Effect.gen(function* () {
					// `DetectedRelease` carries no `targets`, and `determineTagStrategy`
					// only reads `name`/`version` — so the empty `targets` array is safe.
					// Tag strategy (Step 2) runs on the full detected set before any
					// publishing, making every detected package a tag candidate; that is
					// correct because a publish failure (Step 4) aborts releases (Step 5)
					// before a single tag is ever created.
					const needsPerPackageTags = yield* isMonorepoForTagging(process.cwd());
					const strategy = determineTagStrategy(
						detected.map((d) => ({ name: d.name, version: d.version, targets: [] })),
						needsPerPackageTags,
					);
					yield* Effect.logDebug(`tag strategy: ${strategy.strategy}, ${strategy.tags.length} tag(s)`);
					const strategyLabel = strategy.strategy === "multiple" ? "per-package tags" : "single shared tag";
					yield* Effect.logInfo(`  \u2705 ${strategy.tags.length} tag(s), ${strategyLabel}`);
					return strategy;
				}),
			);

			// ── Step 3: Build & SBOM (fail-fast gate) ──────────────────────────────
			// `runBuildAndSbom` wraps itself in Step.withStep; its success line emits
			// from the step on completion.
			const buildSbom = yield* runBuildAndSbom(detected, args);
			if (!buildSbom.ok) {
				const detail =
					buildSbom.buildError !== undefined
						? `build failed — ${buildSbom.buildError}`
						: `SBOM generation failed for ${buildSbom.sbomFailures.join(", ")}`;
				yield* Effect.logError(`❌ Build & SBOM — ${detail}; aborting before publish`);
				const failed: PublishPackagesResult = {
					success: false,
					packages: [],
					totalPackages: detected.length,
					successfulPackages: 0,
					totalTargets: 0,
					successfulTargets: 0,
					...(buildSbom.buildError !== undefined ? { buildError: buildSbom.buildError } : {}),
				};
				yield* emitPublishing(failed, [], [], {});
				yield* Effect.logInfo("Release publishing: ❌ aborted at Build & SBOM — nothing published");
				yield* outputs.setFailed("Phase 3 aborted at Build & SBOM");
				// FAIL, do not return. `setFailed` only annotates; the exit code comes
				// from whether this effect fails.
				return yield* Effect.fail(new PublishError({ reason: "build", message: "Phase 3 aborted at Build & SBOM" }));
			}

			// ── Step 4: Publish to registries ──────────────────────────────────────
			const publishResult = yield* runPublishTargets(detected, buildSbom.sbomPaths);
			if (!publishResult.success) {
				yield* Effect.logError(
					`❌ Published ${publishResult.successfulTargets}/${publishResult.totalTargets} target(s) — aborting before releases`,
				);
				yield* emitPublishing(publishResult, [], [], {});
				yield* Effect.logInfo("Release publishing: ❌ failed at Publish");
				yield* outputs.setFailed("Publishing failed");
				// FAIL, do not return — see the note on `PublishError`. Returning here
				// is what let a 4-of-8-targets publish report a green run.
				return yield* Effect.fail(
					new PublishError({
						reason: "publish",
						message: `Published ${publishResult.successfulTargets}/${publishResult.totalTargets} target(s)`,
					}),
				);
			}
			yield* Effect.logInfo(`✅ Published ${publishResult.successfulTargets}/${publishResult.totalTargets} target(s)`);

			// ── Step 5: Create releases ────────────────────────────────────────────
			// `runReleases` wraps itself in Step.withStep.
			const releasesResult = yield* runReleases({
				tags: tagStrategy.tags,
				publishResult,
				packageManager,
				dryRun,
			}).pipe(
				Effect.catch((e) =>
					Effect.gen(function* () {
						yield* Effect.logWarning(`runReleases failed: ${String(e)}`);
						return { success: false, releases: [] as ReleaseInfo[], errors: [String(e)] };
					}),
				),
			);
			yield* Effect.logInfo(
				releasesResult.success
					? `✅ Created ${releasesResult.releases.length} release(s)`
					: `❌ Created ${releasesResult.releases.length} release(s) — ${releasesResult.errors.length} error(s)`,
			);

			// ── Follow-on: close linked issues ─────────────────────────────────────
			if (mergedReleasePRNumber !== undefined) {
				const closeResult = yield* logger.group(
					"Close linked issues",
					closeLinkedIssues(mergedReleasePRNumber, dryRun).pipe(
						Effect.catch((e) =>
							Effect.gen(function* () {
								yield* Effect.logWarning(`closeLinkedIssues failed: ${String(e)}`);
								return null;
							}),
						),
					),
				);
				yield* Effect.logInfo(
					closeResult === null ? "❌ Close linked issues — failed" : `✅ ${closeResult.closedCount} issue(s) closed`,
				);
			}

			// ── Emit outputs + final summary ───────────────────────────────────────
			const git = yield* Git;
			const tagShas: Record<string, string> = {};
			for (const tag of tagStrategy.tags) {
				// `Effect.result`, so a tag the local clone has not fetched reports an
				// empty sha instead of failing the phase after everything published.
				// `Git.revParse` fails typed (`UnknownRefError`) where the raw form
				// reported a non-zero exit code, and trims for us.
				const rev = yield* Effect.result(git.revParse(process.cwd(), tag.name));
				tagShas[tag.name] = rev._tag === "Success" ? rev.success : "";
			}
			yield* emitPublishing(publishResult, tagStrategy.tags, releasesResult.releases, tagShas);

			yield* Effect.logInfo(
				`Release publishing: ✅ ${publishResult.successfulPackages} package(s), ${releasesResult.releases.length} release(s)`,
			);
		}),
	);
