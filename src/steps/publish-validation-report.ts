/**
 * Step: Phase 2's write to the release PR's sticky comment — the verdict, the
 * release table, and the detail, as three independently-stamped sections of the
 * ONE comment Phase 1 created.
 *
 * @remarks
 * Three sections rather than a second comment. The verdict and the detail used
 * to be a separate comment rendered wholesale on every run, so a reader met two
 * bot comments making overlapping statements about the same release and neither
 * could be updated without rewriting the other. As sections, each is stamped and
 * rewritten independently: the verdict can flip from ✅ to ❌ without touching
 * the table, and the table completes without disturbing the verdict.
 *
 * One of the three is Phase 1's own: `release-plan` is *completed* here rather
 * than left reading "pending validation" beside a finished validation run. That
 * is why this writes under Phase 1's marker key and not one of its own.
 *
 * The fold-and-post is `utils/write-sections.ts`, shared with Phase 1. What is
 * NOT shared is the bracket: Phase 1 writes `running` before the branch work and
 * a terminal state after, because there is a running operation to report around.
 * By the time this step runs there is not — every result it reports is already
 * decided — so it writes once, `complete`.
 *
 * Failure posture: **degrade-to-warning**, and the error channel says so —
 * `never`. A comment is how a result is *shown*; failing to show it must not
 * fail a release whose builds and publishes are fine.
 *
 * ⚠️ Consistent with the rest of Phase 2, that degradation is **invisible**: a
 * failed write contributes no finding, and a failed pull-request *lookup* is
 * reported with the same line as "there is no release PR". Both are pinned by
 * characterization tests; see savvy-web/silk-release-action#216.
 *
 * @module steps/publish-validation-report
 */

import type { PullRequestComment, Repo } from "@effected/github";
import { PullRequest } from "@effected/github";
import { ActionEnvironment } from "@effected/github-actions";
import { Effect, Option } from "effect";
import type { ValidationCommentOptions, ValidationPayload } from "../release/report.js";
import {
	buildReleaseTotals,
	buildValidationDetails,
	buildValidationHeader,
	validationStatusTitle,
} from "../release/report.js";
import type { ValidationPackageResult } from "../release/types.js";
import { resolveCommitLinker } from "../utils/github-urls.js";
import type { Section, SectionStamp } from "../utils/managed-sections.js";
import { RELEASE_TABLE_LEGEND, releaseTable, toValidatedReleaseRows } from "../utils/release-table.js";
import { readStickyComment, updateStickyComment } from "../utils/update-sticky-comment.js";
import { writeSections } from "../utils/write-sections.js";
import { RELEASE_PLAN_KEY, RELEASE_PLAN_TITLE } from "./publish-release-plan.js";

/**
 * The verdict section's key — the region Phase 1 seeded `pending` and this step
 * resolves.
 *
 * @remarks
 * A drift between this and `buildPendingVerdictSection`'s key does not fail
 * anything: it silently produces two verdicts in one comment instead of one
 * updated. Pinned by a test on both sides.
 *
 * @public
 */
export const VALIDATION_STATUS_KEY = "validation-status";

/**
 * The detail section's key.
 *
 * @public
 */
export const VALIDATION_DETAILS_KEY = "validation-details";

/**
 * Everything the rendered comment is a projection of.
 *
 * @public
 */
export interface ValidationReport {
	/** The canonical `ValidationOutput["validation"]` payload. */
	readonly validation: ValidationPayload;
	/** The per-package results the release table renders. */
	readonly validationPackages: ReadonlyArray<ValidationPackageResult>;
	/** Display options — the release-notes link and the rehearsal flag. */
	readonly options: ValidationCommentOptions;
}

/**
 * The three sections Phase 2 writes, in reader order.
 *
 * @remarks
 * Pure and service-free, so *what the comment claims* is assertable without
 * running the phase — which is the whole reason the rendering is separated from
 * the posting.
 *
 * All three carry the SAME stamp. They are one run's statement about one commit;
 * stamping them independently would let a reader see two shas in one comment
 * written by one job.
 *
 * The detail section is emitted only once the build has passed. Before that it
 * would be an empty shell under a heading promising substance.
 *
 * @param report - The validation payload and how to display it.
 * @param stamp - The state, sha, run id and timestamp for all three.
 * @returns The sections, verdict first.
 *
 * @public
 */
export const buildValidationSections = (report: ValidationReport, stamp: SectionStamp): ReadonlyArray<Section> => [
	{
		key: VALIDATION_STATUS_KEY,
		title: validationStatusTitle(report.validation),
		stamp,
		body: buildValidationHeader(report.validation, report.options),
	},
	{
		key: RELEASE_PLAN_KEY,
		title: RELEASE_PLAN_TITLE,
		stamp,
		// Totals sit with the table they total, not two headings below it in the
		// detail section.
		body: [
			releaseTable.render(toValidatedReleaseRows(report.validationPackages)),
			RELEASE_TABLE_LEGEND,
			buildReleaseTotals(report.validation.publish),
		].join("\n\n"),
	},
	...(report.validation.buildValidation.passed
		? [
				{
					key: VALIDATION_DETAILS_KEY,
					title: "Details",
					stamp,
					body: buildValidationDetails(report.validation, report.options),
				} satisfies Section,
			]
		: []),
];

/**
 * What {@link publishValidationReport} did, for the caller's log line and for a
 * test to assert on.
 *
 * @remarks
 * A returned value rather than a `void`, because the three outcomes are NOT
 * interchangeable and today's log lines cannot tell two of them apart — see the
 * `lookupFailed` note.
 *
 * @public
 */
export interface ValidationReportOutcome {
	/** The pull request written to, or `null` when there was none to write to. */
	readonly prNumber: number | null;
	/** Whether the comment was actually posted. */
	readonly written: boolean;
	/**
	 * Whether the pull-request lookup itself failed.
	 *
	 * @remarks
	 * ⚠️ **Indistinguishable from "no open release PR" in the job log.** Both
	 * paths log the same "skipped — no open PR found" line and neither contributes
	 * a finding, so a GitHub outage during the lookup reports as a repository that
	 * simply has no release PR. Surfaced on this result so the difference at least
	 * EXISTS in the code; nothing reads it yet. Same shape as
	 * savvy-web/silk-release-action#216.
	 */
	readonly lookupFailed: boolean;
}

/**
 * Everything the step needs provided.
 *
 * @public
 */
export type ValidationReportServices = ActionEnvironment | PullRequest | PullRequestComment | Repo;

/**
 * Find the open release pull request and write the validation report to its
 * sticky comment.
 *
 * @remarks
 * The pull request is *looked up*, not passed in: Phase 2 runs on a push to the
 * release branch, so the PR number is not in the event payload.
 *
 * ⚠️ **A rehearsal still writes.** Unlike Phase 1, which publishes nothing at
 * all when `dryRun` is set, this step posts to the real pull request and lets
 * the rendered body say it was a dry run. Preserved verbatim and pinned by a
 * test; changing it is a behaviour change.
 *
 * @param args - The branch refs, the owner, the report, and the clock.
 * @returns What was written and where. Never fails.
 *
 * @public
 */
export const publishValidationReport = (args: {
	/** The repository owner, qualifying the head-branch filter. */
	readonly owner: string;
	readonly releaseBranch: string;
	readonly targetBranch: string;
	readonly report: ValidationReport;
	/** The stamp timestamp; injectable so a test is deterministic. */
	readonly now?: (() => string) | undefined;
}): Effect.Effect<ValidationReportOutcome, never, ValidationReportServices> =>
	Effect.gen(function* () {
		const pullRequests = yield* PullRequest;

		// `PullRequest.list` replaces a raw octokit callback that hand-wrote the
		// whole `rest.pulls.list` type — the only such callback left in `src`. The
		// route's params and response are typed by the service.
		const found = yield* Effect.result(
			pullRequests.list({ state: "open", head: `${args.owner}:${args.releaseBranch}`, base: args.targetBranch }),
		);
		const pr = found._tag === "Success" ? found.success[0] : undefined;
		if (pr === undefined) {
			// ⚠️ One line for two facts — see `lookupFailed`.
			yield* Effect.logInfo("Sticky comment update skipped — no open PR found for release branch");
			return { prNumber: null, written: false, lookupFailed: found._tag === "Failure" };
		}

		const environment = yield* ActionEnvironment;
		const headSha = Option.getOrElse(yield* environment.getOptional("GITHUB_SHA"), () => "");
		const runId = Option.getOrElse(yield* environment.getOptional("GITHUB_RUN_ID"), () => "");
		const commitLink = yield* resolveCommitLinker();
		const stamp: SectionStamp = {
			state: "complete",
			sha: headSha,
			runId,
			at: (args.now ?? (() => new Date().toISOString()))(),
		};

		const written = yield* writeSections({
			prNumber: pr.number,
			key: RELEASE_PLAN_KEY,
			sections: buildValidationSections(args.report, stamp),
			headSha,
			commitLink,
			warning: "Could not update the release comment",
			read: readStickyComment,
			publish: updateStickyComment,
		});
		if (written) {
			yield* Effect.logInfo(`✅ Release comment updated on PR #${pr.number}`);
		}

		return { prNumber: pr.number, written, lookupFailed: false };
	});
