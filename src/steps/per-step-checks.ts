/**
 * Step: Phase 2's three per-step check runs — Publish Validation, Release
 * Notes Preview and SBOM Preview.
 *
 * @remarks
 * Created *after* the canonical projection is known, because each one's summary
 * is rendered from it. That ordering is why the three checks-table rows carry a
 * `null` URL when they are first derived and are patched afterwards by
 * `applyCheckUrls` — the URLs do not exist until this step has run.
 *
 * Failure posture: **degrade-to-warning**, and the error channel says so —
 * `never`. A check run is how a result is *shown*; failing to show it must not
 * fail a release whose builds and publishes are fine. The verdict itself
 * travels on the unified check and the action outputs, neither of which depends
 * on these three existing.
 *
 * ⚠️ Consistent with the rest of Phase 2, that degradation is **invisible**: a
 * check run that could not be created yields `""`, which becomes a `null` row
 * URL — indistinguishable from a row that legitimately has no page yet. Pinned
 * by a test; see savvy-web/silk-release-action#216 for the general shape.
 *
 * @module steps/per-step-checks
 */

import type { Repo } from "@effected/github";
import { CheckRun, CheckRunOutput } from "@effected/github";
import { Effect } from "effect";
import type { CheckConclusion } from "../release/validation-checks.js";

/**
 * The three per-step check URLs, in the order they are created.
 *
 * @remarks
 * Each is `""` when that check run could not be created — the same sentinel
 * `CheckRunRef.url` uses (the kit builds it as `raw.html_url ?? ""`), and the
 * value `applyCheckUrls` keys on to leave a row's existing URL alone.
 *
 * @public
 */
export interface PerStepCheckUrls {
	readonly publish: string;
	readonly releaseNotes: string;
	readonly sbom: string;
}

/**
 * The rendered summary bodies, one per check.
 *
 * @remarks
 * Passed in rather than rendered here: `release/report.ts` owns rendering, and
 * this module owns publishing. That seam is what lets the publish behaviour —
 * titles, ordering, degradation — be tested without standing up a full
 * `ValidationOutput`.
 *
 * @public
 */
export interface PerStepCheckSummaries {
	readonly publish: string;
	readonly releaseNotes: string;
	readonly sbom: string;
}

/**
 * The base name of each per-step check, before any rehearsal prefix.
 *
 * @remarks
 * These match the corresponding {@link CHECK_NAMES} entries **exactly**,
 * because the same strings are the conclusion lookup key. A drift here detaches
 * a check run from the conclusion it is meant to report.
 *
 * @public
 */
export const PER_STEP_CHECK_NAMES = ["Publish Validation", "Release Notes Preview", "SBOM Preview"] as const;

/**
 * A check-run title, rehearsal-prefixed when this is a dry run.
 *
 * @remarks
 * The prefix is how a reader tells a rehearsal's checks from a real run's on
 * the same commit — GitHub keys check runs by name, so an unprefixed rehearsal
 * would overwrite the real one's result.
 *
 * @public
 */
export const perStepCheckTitle = (name: string, dryRun: boolean): string => (dryRun ? `🧪 ${name} (Dry Run)` : name);

/**
 * Create one per-step check run and complete it, returning its web URL.
 *
 * @remarks
 * Two independent degradations, and they are not the same:
 *
 * - **Create fails** → warn, return `""`, and do NOT attempt to complete. There
 *   is nothing to complete.
 * - **Complete fails** → warn, but still return the URL. The check run exists
 *   and is reachable; it is merely stuck `in_progress`. Dropping the URL would
 *   hide a page a reader could still use.
 *
 * @param sha - The head commit the check run is attached to.
 * @param title - The check-run name, which is also its output title.
 * @param conclusion - The verdict, from `deriveValidationChecks`.
 * @param summary - The rendered markdown body.
 * @returns The check run's web URL, or `""`.
 *
 * @public
 */
export const createPerStepCheck = (
	sha: string,
	title: string,
	conclusion: CheckConclusion,
	summary: string,
): Effect.Effect<string, never, CheckRun | Repo> =>
	Effect.gen(function* () {
		const checks = yield* CheckRun;
		const created = yield* checks.create(title, sha).pipe(
			Effect.catch((e) =>
				Effect.gen(function* () {
					yield* Effect.logWarning(`Failed to create check run "${title}": ${e.message}`);
					return null;
				}),
			),
		);
		if (created === null) {
			return "";
		}
		// `CheckRunOutput` is a `Schema.Class`; an object literal no longer
		// satisfies it. No `capCheckSummary` — `complete` pipes the output through
		// `wireOutput`, which truncates on every request.
		yield* checks
			.complete(created.id, conclusion, CheckRunOutput.make({ title, summary }))
			.pipe(Effect.catch((e) => Effect.logWarning(`Failed to complete check run "${title}": ${e.message}`)));
		// `CheckRunRef` exposes `url`, not `htmlUrl`. The kit builds it as
		// `raw.html_url ?? ""`, so the empty-string sentinel is preserved.
		return created.url;
	});

/**
 * Create all three per-step check runs, in order.
 *
 * @remarks
 * Sequential, not concurrent — the runner's checks list is ordered by creation,
 * and Publish → Release Notes → SBOM is the order the checks table reports
 * them in. Racing them would shuffle the list between runs.
 *
 * @param args - The head sha, the rehearsal flag, the conclusion lookup and the
 *   three rendered summaries.
 * @returns Each check's URL, or `""` where it could not be created.
 *
 * @public
 */
export const createPerStepChecks = (args: {
	readonly sha: string;
	readonly dryRun: boolean;
	readonly conclusionFor: (checkName: string) => CheckConclusion;
	readonly summaries: PerStepCheckSummaries;
}): Effect.Effect<PerStepCheckUrls, never, CheckRun | Repo> =>
	Effect.gen(function* () {
		const [publishName, releaseNotesName, sbomName] = PER_STEP_CHECK_NAMES;

		const publish = yield* createPerStepCheck(
			args.sha,
			perStepCheckTitle(publishName, args.dryRun),
			// The LOOKUP uses the unprefixed name; only the displayed title carries
			// the rehearsal prefix. Keying the conclusion off the prefixed title
			// would silently return `success` for every check in a dry run.
			args.conclusionFor(publishName),
			args.summaries.publish,
		);
		const releaseNotes = yield* createPerStepCheck(
			args.sha,
			perStepCheckTitle(releaseNotesName, args.dryRun),
			args.conclusionFor(releaseNotesName),
			args.summaries.releaseNotes,
		);
		const sbom = yield* createPerStepCheck(
			args.sha,
			perStepCheckTitle(sbomName, args.dryRun),
			args.conclusionFor(sbomName),
			args.summaries.sbom,
		);

		return { publish, releaseNotes, sbom };
	});
