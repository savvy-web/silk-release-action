/**
 * Step: Phase 1 — create or update the release branch and its pull request.
 *
 * @remarks
 * Failure posture: **fail-the-job**. Every callee's typed error propagates
 * uncaught. This module constructs no error of its own, so it declares none —
 * an error class exists only where there is a constructor site, and wrapping a
 * callee's error to re-raise it adds a name and no information. The reporting
 * writes are the one degrading path, and they degrade inside
 * `steps/publish-release-plan.ts` rather than here.
 *
 * **No injected seams.** The branch flows, the branch probe and the history
 * fetch are called directly. What used to make them injectable — observing what
 * the phase publishes to the pull request under a failing, dying or interrupted
 * flow — is `withReleasePlanSection`'s job now, and that takes the flow as a
 * single effect parameter.
 *
 * @module steps/branch-management
 */

import type { CommandFailedError, CommandOutputError, ToolDiscovery } from "@effected/commands";
import type { Git, GitCommandError, NotARepositoryError, UnknownRefError } from "@effected/git";
import type {
	CheckRun,
	GitBranch,
	GitCommit,
	GitHubCommit,
	GitHubError,
	GitHubIssue,
	GitHubRepository,
	GitTag,
	PullRequest,
	PullRequestComment,
	Repo,
} from "@effected/github";
import type {
	ActionEnvironmentError,
	ActionLogger,
	ActionOutputError,
	ActionState,
	ActionStateError,
	GitHubTokenError,
} from "@effected/github-actions";
import { ActionEnvironment, ActionOutputs, DryRun } from "@effected/github-actions";
import type { PackageManagerDetector, PublishabilityDetector, WorkspaceDiscovery } from "@effected/workspaces";
import { Changesets } from "@savvy-web/silk-effects";
import type { Config, FileSystem } from "effect";
import { Effect, Option } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { ChangesetConfig } from "../release/changeset-config.js";
import type { Inputs } from "../schema/inputs.js";
import { emitReleaseOutput } from "../schema/outputs.js";
import { toBranchManagementOutput } from "../schema/projections.js";
import { checkReleaseBranch } from "../utils/check-release-branch.js";
import { createReleaseBranch } from "../utils/create-release-branch.js";
import { detectPackageManager } from "../utils/detect-package-manager.js";
import { ensureFullHistory } from "../utils/ensure-full-history.js";
import { resolveCommitLinker, resolveServerUrl } from "../utils/github-urls.js";
import { grouped } from "../utils/grouped.js";
import type { FileReadError } from "../utils/porcelain-changes.js";
import type { PlannedPackage } from "../utils/release-plan.js";
import { toReleasePlanReport } from "../utils/release-plan.js";
import { listPublishablePackages } from "../utils/release-summary-helpers.js";
import { updateReleaseBranch } from "../utils/update-release-branch.js";
import { readStickyComment, updateStickyComment } from "../utils/update-sticky-comment.js";
import type { BranchFlowOutcome } from "./publish-release-plan.js";
import { buildPendingVerdictSection, buildReleasePlanBody, withReleasePlanSection } from "./publish-release-plan.js";

/**
 * What Phase 1 decided about the release branch.
 *
 * @public
 */
export interface BranchManagementResult {
	/** The release branch this run acted on. */
	readonly releaseBranch: string;
	/** Whether the branch already existed when the phase started. */
	readonly existed: boolean;
	readonly created: boolean;
	readonly updated: boolean;
	readonly hasConflicts: boolean;
	/** The release pull request, or `null` when there is none. */
	readonly prNumber: number | null;
	/** The packages the plan will release, dependency-driven ones included. */
	readonly packages: ReadonlyArray<PlannedPackage>;
	/**
	 * The number of changeset **files**, which is deliberately not
	 * `packages.length` — one file may name several packages, and a package may
	 * release with no file of its own.
	 */
	readonly changesetFileCount: number;
	readonly dryRun: boolean;
}

/**
 * Everything the phase fails with. Every member is raised by a callee; this
 * module constructs none of them.
 *
 * @public
 */
export type BranchManagementError =
	| ActionEnvironmentError
	| ActionOutputError
	| ActionStateError
	| Changesets.ConfigurationError
	| Changesets.ReleasePlanError
	| CommandFailedError
	| CommandOutputError
	| Config.ConfigError
	| FileReadError
	| GitCommandError
	| GitHubError
	| GitHubTokenError
	| NotARepositoryError
	| UnknownRefError;

/**
 * Everything the phase needs provided. The union of its callees' channels, plus
 * `ActionLogger` for the group and `PackageManagerDetector` for the detection
 * line.
 *
 * @public
 */
export type BranchManagementServices =
	| ActionEnvironment
	| ActionLogger
	| ActionOutputs
	| ActionState
	| ChangesetConfig
	| Changesets.ConfigInspector
	| Changesets.ReleasePlanner
	| CheckRun
	| ChildProcessSpawner.ChildProcessSpawner
	| DryRun
	| FileSystem.FileSystem
	| Git
	| GitBranch
	| GitCommit
	| GitHubCommit
	| GitHubIssue
	| GitHubRepository
	| GitTag
	| PackageManagerDetector
	| PublishabilityDetector
	| PullRequest
	| PullRequestComment
	| Repo
	| ToolDiscovery
	| WorkspaceDiscovery;

/**
 * Phase 1 — create or update the release branch and its pull request.
 *
 * @param inputs - The decoded `action.yml` inputs, read once in `program`.
 *
 * @public
 */
export const branchManagement = (
	inputs: Inputs,
): Effect.Effect<BranchManagementResult, BranchManagementError, BranchManagementServices> =>
	Effect.gen(function* () {
		const packageManager = yield* detectPackageManager;
		const planner = yield* Changesets.ReleasePlanner;
		// The rehearsal decision comes from the `DryRun` SERVICE, not from a
		// re-read of the input or a threaded boolean. The service is built once
		// from `dry-run` in `MainLive`, so there is exactly one place that
		// decides what a rehearsal is.
		const dryRun = yield* (yield* DryRun).isDryRun;

		return yield* grouped(
			"Phase 1: Release Branch Management",
			Effect.gen(function* () {
				const { releaseBranch, targetBranch } = inputs;
				yield* Effect.logInfo(`Detected package manager: ${packageManager}`);
				const branchCheck = yield* checkReleaseBranch(releaseBranch, targetBranch, dryRun);

				// Phase 1's job is to answer "what is about to be released" before the
				// next phase runs, so this reads the RELEASE PLAN — not the changeset
				// files, and not the applied result.
				//
				// `plan` must run before the branch flow, because `apply` deletes the
				// `.changeset/*.md` files it consumes. It is read-only (one of
				// `ReleasePlannerShape`'s two non-mutating members), so running it first
				// costs nothing but the history it needs.
				//
				// **`plan`, never `preview`.** Both describe the same release, but
				// `preview` additionally renders each package's changelog entry, which
				// means resolving the configured changelog module — and Phase 1 is the
				// ZERO-INSTALL phase, so there is no `node_modules` to resolve it from.
				// `preview` therefore dies inside module resolution
				// (`expected to be defined`, from `import-meta-resolve`), which is what
				// failed integration runs 30212579721 and 30217825158. `apply` avoids it
				// with a `changelogModules` option mapping ids to bundled paths;
				// `preview` has no such option. `plan` renders nothing and needs nothing.
				//
				// The fetch below is kept as ordinary hygiene for the flows that follow,
				// not as a fix for the above — an earlier reading blamed the shallow
				// clone, and that was wrong.
				//
				// Reading the plan rather than the changeset files is what makes a
				// dependency-driven release visible: if a changeset names A and B depends
				// on A, both are versioned and both get changelogs, but only A has a
				// changeset.
				yield* ensureFullHistory(targetBranch);
				const plan = yield* planner.plan(process.cwd());
				// Projected in `release-plan`, where it is tested. A package's `changesets`
				// list is empty when it releases only because a dependency moved — the
				// `—` in the release table — and the file count is not the package count.
				// Resolve each planned package's publish-target count BEFORE the build.
				// Publishability is declared in `package.json`, so what a package will
				// publish to is knowable now; only how many targets are READY needs the
				// build, which is Phase 2's job. A package absent from the publishable
				// set has no targets — which is the correct reading for a private
				// tracking package, not a gap in the data.
				const publishable = yield* listPublishablePackages(process.cwd());
				const targetCounts = new Map(publishable.map((p) => [p.name, p.targetCount] as const));
				const { packages, changesetFileCount } = toReleasePlanReport(plan, targetCounts);

				const { sha: headSha, runId: planRunId } = yield* (yield* ActionEnvironment).github;
				// Links the stamped sha in every banner.
				const commitLink = yield* resolveCommitLinker();

				// The branch flow, normalised so both arms report the same four facts.
				const runBranchFlow: Effect.Effect<BranchFlowOutcome, BranchManagementError, BranchManagementServices> =
					branchCheck.exists
						? Effect.gen(function* () {
								yield* Effect.logInfo("Release branch exists — running update flow");
								const result = yield* updateReleaseBranch(inputs);
								return {
									created: false,
									// A deleted branch (nothing to release) is neither an update nor
									// a live PR — drop the stale PR number so the output reports none.
									updated: result.success && !result.deleted,
									hasConflicts: result.hadConflicts,
									prNumber: result.deleted ? null : (result.prNumber ?? branchCheck.prNumber),
								};
							})
						: Effect.gen(function* () {
								yield* Effect.logInfo("Release branch does not exist — running create flow");
								const result = yield* createReleaseBranch(inputs);
								return {
									created: result.created,
									updated: false,
									hasConflicts: false,
									prNumber: result.prNumber ?? branchCheck.prNumber,
								};
							});

				const { created, updated, hasConflicts, prNumber } = yield* withReleasePlanSection(
					{
						existingPrNumber: branchCheck.prNumber,
						dryRun,
						headSha,
						runId: String(planRunId),
						planBody: buildReleasePlanBody(packages),
						pendingVerdict: buildPendingVerdictSection(headSha, String(planRunId), new Date().toISOString()),
						commitLink,
						read: readStickyComment,
						publish: updateStickyComment,
					},
					runBranchFlow,
				);

				// The PR URL is built from the instance the run is executing against,
				// not a hardcoded host — see `github-urls`, which owns that decision for
				// every link this action emits.
				const environment = yield* ActionEnvironment;
				const serverUrl = yield* resolveServerUrl();
				const repositorySlug = Option.getOrElse(yield* environment.getOptional("GITHUB_REPOSITORY"), () => "");

				const output = toBranchManagementOutput({
					releaseBranchName: releaseBranch,
					existed: branchCheck.exists,
					created,
					updated,
					hasConflicts,
					releasePr:
						prNumber === null
							? null
							: {
									number: prNumber,
									url: `${serverUrl}/${repositorySlug}/pull/${prNumber}`,
									action: branchCheck.exists ? "updated" : "created",
								},
					changesets: packages,
					changesetFileCount,
					dryRun,
				});
				const outputs = yield* ActionOutputs;
				yield* emitReleaseOutput(outputs, output, { packageCount: packages.length, releasePrNumber: prNumber });

				// Phase 1's own summary line. Phases 2 and 3 already ended with one;
				// Phase 1 relied on the `Step.groupStep` envelope to emit it, and
				// `logger.group` has no such envelope — so without this the phase now
				// closes its group silently.
				const verb = branchCheck.exists ? (updated ? "updated" : "unchanged") : created ? "created" : "not created";
				yield* Effect.logInfo(
					`Release branch management: ✅ ${releaseBranch} ${verb}` +
						`, ${packages.length} package(s) with changesets` +
						(prNumber === null ? "" : `, PR #${prNumber}`),
				);

				return {
					releaseBranch,
					existed: branchCheck.exists,
					created,
					updated,
					hasConflicts,
					prNumber,
					packages,
					changesetFileCount,
					dryRun,
				} satisfies BranchManagementResult;
			}),
		);
	});
