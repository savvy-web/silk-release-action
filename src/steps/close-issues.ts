/**
 * Step: Phase 3a — close the issues linked to a merged release pull request.
 *
 * @remarks
 * Failure posture: **fail-the-job**. `closeLinkedIssues`' own errors propagate;
 * an event payload with no pull-request number is not a failure but a skip, and
 * says so on the log.
 *
 * This phase exists separately from the close-linked-issues follow-on inside
 * `steps/publishing.ts` because a workflow may route the two independently —
 * the merge that publishes and the merge that only closes issues are different
 * events.
 *
 * @module steps/close-issues
 */

import { ActionLogger, DryRun } from "@effected/github-actions";
import { Effect, Option } from "effect";
import { closeLinkedIssues } from "../utils/close-linked-issues.js";
import { readEventPullRequestNumber } from "../utils/event-payload.js";

/**
 * Close the issues the merged release PR references.
 *
 * @public
 */
export const runCloseIssues = () =>
	Effect.gen(function* () {
		const logger = yield* ActionLogger;
		const dryRun = yield* (yield* DryRun).isDryRun;

		yield* logger.group(
			"Phase 3a: Close Linked Issues",
			Effect.gen(function* () {
				const prNumber = yield* readEventPullRequestNumber();
				if (Option.isNone(prNumber)) {
					yield* Effect.logWarning("No pull_request number in event payload; skipping close-issues phase");
					return;
				}
				yield* closeLinkedIssues(prNumber.value, dryRun);
			}),
		);
	});
