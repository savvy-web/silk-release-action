/**
 * The release-plan comment section: what Phase 1 publishes to the release pull
 * request, and in what state, while the branch work runs.
 *
 * @remarks
 * Separated from `steps/branch-management.ts` because the two answer different
 * questions. Branch management decides *what the release is*; this decides
 * *what a reader of the pull request sees about it, and when*. The split is
 * what let the hand-rolled `BranchManagementSeams` record — six injected
 * functions and a `SeamError` union derived through
 * `Effect.Error<ReturnType<typeof …>>` — collapse into one higher-order effect
 * parameter plus two concretely-typed writers.
 *
 * The state machine itself is `withSection`, proven independently (including
 * the defect and interrupt paths) in `managed-sections.test.ts`, and the
 * read-modify-write is `utils/write-sections.ts`, shared with Phase 2's
 * `steps/publish-validation-report.ts`. What is proven *here* is the wiring:
 * which arm gets bracketed, what sections go in and in what order, what body
 * survives a failure, and whether anything is written at all in a rehearsal.
 *
 * Failure posture: **degrade-to-warning**, and the error channel says so —
 * every write goes through `Effect.result` and a failed one becomes a logged
 * warning. A reporting write is not a release gate: `withSection` types
 * `publish` as infallible for exactly that reason, because a finalizer that
 * could fail on the way out would replace the caller's real error with a
 * reporting one.
 *
 * @module steps/publish-release-plan
 */

import type { GitHubError, PullRequestComment, Repo } from "@effected/github";
import { Effect } from "effect";
import { buildPendingChecksTable, validationStatusTitle } from "../release/report.js";
import type { Section } from "../utils/managed-sections.js";
import { withSection } from "../utils/managed-sections.js";
import type { PlannedPackage } from "../utils/release-plan.js";
import { RELEASE_TABLE_LEGEND, releaseTable, toPendingReleaseRows } from "../utils/release-table.js";
import type { StickyCommentResult } from "../utils/update-sticky-comment.js";
import { writeSections } from "../utils/write-sections.js";

/**
 * The marker key the release-plan comment is found again by across runs.
 *
 * @remarks
 * Both the plan section and the seeded verdict live in the comment under this
 * one key — they are two marker-delimited *sections* of a single comment, not
 * two comments. Changing it orphans every existing sticky comment on every open
 * release PR.
 *
 * @public
 */
export const RELEASE_PLAN_KEY = "release-plan";

/**
 * The release-plan section's heading.
 *
 * @public
 */
export const RELEASE_PLAN_TITLE = "🚀 What will be released";

/**
 * What Phase 1 learned about the release branch, however it learned it.
 *
 * @remarks
 * Both branch flows are normalised to this before the reporting sees them, so
 * the reporting is written once rather than per-arm. Declared here rather than
 * in `steps/branch-management.ts` because {@link withReleasePlanSection} is
 * generic over it and branch management imports *this* module — the edge runs
 * one way, and the reverse would be an import cycle.
 *
 * @public
 */
export interface BranchFlowOutcome {
	readonly created: boolean;
	readonly updated: boolean;
	readonly hasConflicts: boolean;
	readonly prNumber: number | null;
}

/**
 * Render the release-plan table body.
 *
 * @remarks
 * Pure and service-free, so the *content* of the plan is assertable without
 * running the phase. Every column but `targets` comes from the plan, so a
 * reader sees what will be published — versions included — while the build is
 * still running. `targets` renders pending: blank is indistinguishable from
 * "no targets", and a tick would claim a result validation has not produced.
 *
 * @param packages - The planned packages, projected by `toReleasePlanReport`.
 *
 * @public
 */
export const buildReleasePlanBody = (packages: ReadonlyArray<PlannedPackage>): string =>
	`${releaseTable.render(toPendingReleaseRows(packages))}\n\n${RELEASE_TABLE_LEGEND}`;

/**
 * The validation verdict, seeded pending, that sits above the plan.
 *
 * @remarks
 * Pure and service-free, for the same reason as {@link buildReleasePlanBody}:
 * what the seeded verdict *claims* is assertable without running the phase.
 *
 * `pending` rather than a tick, and a real table with every row pending rather
 * than a sentence. Phase 1 has no validation result and must not appear to
 * claim one; and a table lets validation resolve rows in place rather than
 * replacing the shape of what is there.
 *
 * @param headSha - The commit the section is stamped against.
 * @param runId - The run that wrote it.
 * @param at - The stamp timestamp, ISO-8601.
 *
 * @public
 */
export const buildPendingVerdictSection = (headSha: string, runId: string, at: string): Section => ({
	key: "validation-status",
	title: validationStatusTitle(null),
	stamp: { state: "pending", sha: headSha, runId, at },
	body: buildPendingChecksTable(),
});

/**
 * Everything {@link withReleasePlanSection} needs to publish the plan.
 *
 * @remarks
 * `read` and `publish` are concretely typed — `readStickyComment` and
 * `updateStickyComment`'s real signatures, written out — rather than derived
 * from their implementations. That is the difference between a parameter and
 * the `Effect.Error<ReturnType<typeof …>>` machinery it replaces: a caller
 * (or a test) supplying one gets told what shape it must have, instead of
 * having to widen to an opaque union.
 *
 * @public
 */
export interface ReleasePlanSection<RWrite = PullRequestComment | Repo> {
	/**
	 * The pull request that already exists to write to, or `null` when the flow
	 * has to create one first.
	 *
	 * @remarks
	 * This is the whole bracket decision. A `number` means there is somewhere to
	 * show a `running` state; `null` means there is nothing to comment on until
	 * the flow has produced a PR, so the plan is published once, after the fact.
	 */
	readonly existingPrNumber: number | null;
	/** A rehearsal writes nothing to the pull request at all. */
	readonly dryRun: boolean;
	/** Stamped into every section so staleness is detectable. */
	readonly headSha: string;
	/** Stamped alongside the sha, identifying the run that wrote it. */
	readonly runId: string;
	/** The rendered plan table — see {@link buildReleasePlanBody}. */
	readonly planBody: string;
	/**
	 * The not-yet-run validation verdict, seeded above the plan.
	 *
	 * @remarks
	 * It exists at this point purely to settle the comment's ORDER — a reader
	 * should meet the verdict, then the table, then the detail — and
	 * `upsertSection` appends a key it has not seen, so a verdict first written
	 * by validation would land beneath the table.
	 */
	readonly pendingVerdict: Section;
	/** Links the stamped sha in every banner. */
	readonly commitLink: (sha: string) => string;
	/** Read a sticky comment's current body, so a rewrite preserves its neighbours. */
	readonly read: (prNumber: number, key: string) => Effect.Effect<string, GitHubError, RWrite>;
	/** Write a rendered body to a pull request. Failures are this module's to swallow. */
	readonly publish: (
		prNumber: number,
		body: string,
		key: string,
	) => Effect.Effect<StickyCommentResult, GitHubError, RWrite>;
}

/**
 * Publish the release plan around a branch flow, bracketing it when there is
 * already a pull request to bracket it on.
 *
 * @remarks
 * The flow is a single effect parameter, not an injected record: varying its
 * outcome — success, typed failure, defect, interrupt — is the only way to
 * observe what this module decides, and one effect is what a caller has to
 * supply to do it.
 *
 * The bracketed arm reaches a terminal state on **every** exit, including a
 * defect or an interrupt. That is the case a `tap`/`tapError` pair misses, and
 * which would otherwise leave the section reading `running` forever.
 *
 * @param section - The plan, the verdict, and how to read and write them.
 * @param flow - The branch work to run and report around.
 * @returns The flow's own outcome, untouched.
 *
 * @public
 */
export const withReleasePlanSection = <E, R, RWrite = PullRequestComment | Repo>(
	section: ReleasePlanSection<RWrite>,
	flow: Effect.Effect<BranchFlowOutcome, E, R>,
): Effect.Effect<BranchFlowOutcome, E, R | RWrite> => {
	const { headSha, runId, planBody, pendingVerdict, commitLink } = section;

	// The read-modify-write itself is `writeSections`, shared with Phase 2 — read
	// once, fold, refresh every banner, post once, warn on failure. What is
	// decided HERE is only what goes into it: the verdict first, then the section
	// being written (see `pendingVerdict`'s remarks for why that order is seeded
	// by Phase 1), and the plan's own marker key.
	//
	// The bracket below is what Phase 2 does not share, and it is why the fold is
	// a function rather than a mode: Phase 1 calls this twice, from inside
	// `withSection`; Phase 2 calls the same fold once, at the end.
	const publishPlan =
		(target: number) =>
		(rendered: Section): Effect.Effect<void, never, RWrite> =>
			writeSections({
				prNumber: target,
				key: RELEASE_PLAN_KEY,
				sections: [pendingVerdict, rendered],
				headSha,
				commitLink,
				warning: "Could not publish the release plan comment",
				read: section.read,
				publish: section.publish,
			}).pipe(Effect.asVoid);

	// Bracket the flow ONLY when a PR already exists to write to, and never in a
	// rehearsal. The create path has nothing to comment on until it has created
	// the PR, so there is no `running` state to show.
	const bracketed =
		section.existingPrNumber !== null && !section.dryRun
			? withSection(
					{
						key: RELEASE_PLAN_KEY,
						title: RELEASE_PLAN_TITLE,
						sha: headSha,
						runId,
						now: () => new Date().toISOString(),
						// Retained on every non-success exit: the plan stays readable,
						// marked, rather than being blanked to signal freshness.
						previousBody: planBody,
						render: () => planBody,
						publish: publishPlan(section.existingPrNumber),
					},
					flow,
				)
			: flow;

	return Effect.gen(function* () {
		const outcome = yield* bracketed;

		// The create path publishes once, after the fact — see above. Its own
		// dry-run guard is not redundant with the bracket arm's: covering only the
		// first leaves the second free to write to a real pull request during a
		// rehearsal.
		if (section.existingPrNumber === null && outcome.prNumber !== null && !section.dryRun) {
			yield* publishPlan(outcome.prNumber)({
				key: RELEASE_PLAN_KEY,
				title: RELEASE_PLAN_TITLE,
				stamp: { state: "complete", sha: headSha, runId, at: new Date().toISOString() },
				body: planBody,
			});
		}

		return outcome;
	});
};
