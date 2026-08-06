/**
 * Step: Phase 2's "Link issues from commits" — find the issues the release
 * closes, and report them as a check run.
 *
 * @remarks
 * Failure posture: **degrade-to-warning**, and the error channel says so —
 * `never`. Issue linking is reporting, not a gate: a GitHub API failure here
 * must not stop a release whose builds and publishes are fine.
 *
 * ⚠️ That degradation is currently **invisible downstream** — see
 * {@link LINK_ISSUES_FAILED} and the characterization tests. Preserved as-is;
 * fixing it is a behaviour change.
 *
 * @module steps/link-issues
 */

import type { CheckRun, GitHubCommit, GitHubIssue, PullRequest, Repo } from "@effected/github";
import type { ActionEnvironment, ActionLogger, ActionOutputs, DryRun } from "@effected/github-actions";
import { Effect } from "effect";
import type { BranchRefs } from "../schema/inputs.js";
import { grouped } from "../utils/grouped.js";
import type { LinkIssuesResult } from "../utils/link-issues-from-commits.js";
import { linkIssuesFromCommits } from "../utils/link-issues-from-commits.js";

/**
 * What Phase 2 reports when issue linking failed.
 *
 * @remarks
 * ⚠️ **Indistinguishable from a successful run that found nothing.**
 * `LinkIssuesResult` carries no failure signal, this step degrades any error to
 * this value, and the check derivation scopes no finding to
 * `"Link Issues from Commits"` — so a crash produces `✅ Link issues — 0
 * issue(s) linked` in the log, a `pass` row in the checks table, and a
 * `success` conclusion on the check run. The only trace is one `logWarning`.
 *
 * Same shape as savvy-web/silk-release-action#216, in a second place. Pinned by
 * the tests; not fixed here, because contributing a finding is a behaviour
 * change.
 *
 * @public
 */
export const LINK_ISSUES_FAILED: LinkIssuesResult = {
	linkedIssues: [],
	commits: [],
	/** Never read — see the `checkId is write-only` characterization test. */
	checkId: 0,
	/** `""` is the "no check run" sentinel the checks-table row turns into `null`. */
	htmlUrl: "",
};

/**
 * Everything this step needs provided.
 *
 * @public
 */
export type LinkIssuesServices =
	| ActionEnvironment
	| ActionLogger
	| ActionOutputs
	| CheckRun
	| DryRun
	| GitHubCommit
	| GitHubIssue
	| PullRequest
	| Repo;

/**
 * Link the issues this release closes, inside a collapsible log group.
 *
 * @param refs - The release and target branch names, from the one input decode.
 * @returns The linked issues, or {@link LINK_ISSUES_FAILED}. Never fails.
 *
 * @public
 */
export const linkIssues = (refs: BranchRefs): Effect.Effect<LinkIssuesResult, never, LinkIssuesServices> =>
	Effect.gen(function* () {
		const result = yield* grouped(
			"Link issues from commits",
			linkIssuesFromCommits(refs).pipe(
				Effect.catch((e) =>
					Effect.gen(function* () {
						yield* Effect.logWarning(`linkIssuesFromCommits failed: ${String(e)}`);
						return LINK_ISSUES_FAILED;
					}),
				),
			),
		);

		// ⚠️ Unconditionally ✅, even on the degraded path — unlike the build step
		// below it, which branches. So a failed run logs
		// `linkIssuesFromCommits failed: …` and then `✅ Link issues — 0 issue(s)
		// linked` two lines later. Preserved verbatim; pinned by a test.
		yield* Effect.logInfo(`✅ Link issues — ${result.linkedIssues.length} issue(s) linked`);

		return result;
	});
