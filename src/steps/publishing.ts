/**
 * Step: Phase 3 — multi-registry publish, git tags, GitHub releases and
 * SBOM/attestation.
 *
 * @remarks
 * Failure posture: **fail-the-job**. A failed build/SBOM gate or a partial
 * publish raises {@link PublishError} rather than returning — `setFailed`
 * only annotates, and returning here is what once let a 4-of-8-target publish
 * report a green run. A failure inside {@link runReleases} (tags, GitHub
 * releases, assets) raises {@link ReleasesError}, but only **after** the
 * follow-on work and the output emission have run — see below. Linked issues
 * that could not be closed fail the phase the same way
 * (`reason: "linked-issues"`); that work is housekeeping, but housekeeping
 * that silently did not happen is what a re-run exists to fix, and it can only
 * be re-run if the job goes red.
 *
 * ## Deferred failure, and why the order is the design
 *
 * When `runReleases` fails, this step does **not** abort at the failure site.
 * It catches, keeps going, and fails at the very end. Three reasons, each of
 * which an early `Effect.fail` would break:
 *
 * 1. **Outputs must reflect what actually published.** Failing early skips
 *    `emitPublishing`, so a consumer reading the `result` output could not tell
 *    which packages made it to a registry. The packages that published are a
 *    fact regardless of whether the tag/release housekeeping then failed.
 * 2. **The packages are already on the registry.** By the time Step 5 runs,
 *    Step 4 has succeeded. The failure is about the *release/tag/issue*
 *    housekeeping, not the publish, and nothing is gained by abandoning the
 *    remaining housekeeping.
 * 3. **The close-linked-issues follow-on is independent** of whether a GitHub
 *    release object was created, so it still runs.
 *
 * ## The re-run contract
 *
 * Failing loudly here is only correct because **re-running the job is safe and
 * resumes where it stopped**. Every Phase-3 operation before this point is
 * idempotent on a second pass:
 *
 * - **Publishing** compares the registry's integrity digest against the packed
 *   tarball and records `skipped-identical (recovery)` for a version already
 *   published with identical bytes (`release/publish.ts`).
 * - **Git tags** are created with `GitTag.create`, never `upsert`; a tag already
 *   at the head SHA is an idempotent recovery, and a divergent tag is reported
 *   and left alone rather than force-moved (`release/releases.ts`).
 * - **GitHub releases** fall back to `getByTag` on `kind: "alreadyExists"`.
 * - **Release assets** are pre-fetched by name; an asset already attached is
 *   skipped and its existing URL reused.
 * - **Linked issues** already closed are skipped without a second comment, and
 *   the close precedes the comment so a failed close leaves nothing to
 *   duplicate (`utils/close-linked-issues.ts`).
 *
 * So the operator's recovery loop is: read the failure, fix the cause, re-run
 * the job. That sentence is the whole reason a red job is the right signal here
 * rather than an obstruction.
 *
 * @module steps/publishing
 */

import { Git } from "@effected/git";
import { ActionLogger, ActionOutputs, DryRun } from "@effected/github-actions";
import { Effect } from "effect";
import { PublishError, ReleasesError } from "../release/errors.js";
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
 * The recovery instruction appended to every deferred Phase-3 failure message.
 *
 * @remarks
 * Carried in the failure text rather than left to the module docs because the
 * person who needs it is reading a red job's annotation, not this file. See
 * "The re-run contract" in the module docs for what backs each claim.
 *
 * @internal
 */
const RERUN_CONTRACT =
	"Re-running this job is safe: already-published packages are skipped by integrity digest, " +
	"existing tags and releases are reused, already-uploaded assets are not re-uploaded, and " +
	"already-closed issues are not commented on again, so the re-run resumes from where it failed.";

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
			// `inputs.customRegistries` rides along so custom-registry targets get
			// their configured tokens (issue #215 — this hand-off is the wiring the
			// publish-chain migration lost).
			const publishResult = yield* runPublishTargets(detected, buildSbom.sbomPaths, inputs.customRegistries);
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
				// Catch, do NOT abort. The phase still has to emit outputs describing
				// what published and still has to close linked issues; failing here
				// would skip both. The failure is re-raised at the end of the step —
				// see "Deferred failure" in the module docs.
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
			// No `Effect.catch` here. `closeLinkedIssues` declares its error channel
			// as `never` — it collapses every service failure into an empty result
			// itself — so a catch could not fire, and the `null` branch it guarded
			// was unreachable code that read as coverage. The live failure signal is
			// `failedCount`, consumed by the deferred failure below.
			const closeResult =
				mergedReleasePRNumber !== undefined
					? yield* logger.group("Close linked issues", closeLinkedIssues(mergedReleasePRNumber, dryRun))
					: null;
			if (closeResult !== null) {
				yield* Effect.logInfo(
					closeResult.failedCount > 0
						? `❌ ${closeResult.closedCount} issue(s) closed — ${closeResult.failedCount} failed`
						: `✅ ${closeResult.closedCount} issue(s) closed`,
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

			// ── Deferred failure ───────────────────────────────────────────────────
			// Everything above has run: the follow-on close-linked-issues work, the
			// tag-SHA collection and the output emission. Only now is it safe to
			// fail, because `result` already describes the packages that DID publish.
			//
			// This is `ReleasesError`, not `PublishError`: the publish succeeded
			// (Step 4 gates Step 5), and `PublishError`'s reason union has no member
			// that honestly names tag/release/asset work.
			// Each failing surface contributes one clause naming itself and its
			// count, so the annotation says WHICH housekeeping failed and by how
			// much — a phase that fails for two reasons must not report only one.
			const failures: string[] = [];
			if (!releasesResult.success) {
				const detail = releasesResult.errors.length > 0 ? `: ${releasesResult.errors.join("; ")}` : "";
				failures.push(
					`GitHub releases — created ${releasesResult.releases.length} of ${tagStrategy.tags.length} release(s), ` +
						`${releasesResult.errors.length} error(s)${detail}`,
				);
			}
			if (closeResult !== null && closeResult.failedCount > 0) {
				failures.push(
					`Close linked issues — ${closeResult.failedCount} of ${closeResult.issues.length} issue(s) failed to close`,
				);
			}

			if (failures.length > 0) {
				// `reason` names the surface that actually failed. When only the
				// follow-on failed, calling it "release" would tell an operator the
				// GitHub release failed when it did not.
				const reason = !releasesResult.success ? "release" : "linked-issues";
				const message = `${failures.join(" | ")}. ${RERUN_CONTRACT}`;
				yield* Effect.logError(`Release publishing: ❌ ${message}`);
				yield* outputs.setFailed(message);
				return yield* Effect.fail(new ReleasesError({ reason, message }));
			}

			yield* Effect.logInfo(
				`Release publishing: ✅ ${publishResult.successfulPackages} package(s), ${releasesResult.releases.length} release(s)`,
			);
		}),
	);
