/**
 * Main-action entry point.
 *
 * @remarks
 * Resolves the workflow phase via `detectWorkflowPhase` — which reads the
 * GitHub event context through `GitHubClient` + `ActionEnvironment`, honoring
 * an explicit `phase` input when set — and routes to the matching handler:
 *
 * - `branch-management` — create/update the release branch and PR (Phase 1)
 * - `validation` — build validation, publish dry-runs, release-notes preview (Phase 2)
 * - `publishing` — multi-registry publish, GitHub releases, SBOM/attestation (Phase 3)
 * - `close-issues` — close issues linked to the merged release PR
 *
 * An absent or unrecognized phase falls through to a no-op.
 */

import { NodeServices } from "@effect/platform-node";
import { LocalExec, Run, ToolDiscovery } from "@effected/commands";
import type { Repo } from "@effected/github";
import { CheckRun, CheckRunOutput, PullRequest } from "@effected/github";
import type { ActionOutputError, ActionOutputsShape } from "@effected/github-actions";
import {
	Action,
	ActionEnvironment,
	ActionInput,
	ActionLogger,
	ActionOutputs,
	GitHubToken,
	Secret,
} from "@effected/github-actions";
import type { SbomMetadata } from "@effected/sbom";
import { Changesets } from "@savvy-web/silk-effects";
import { Config, Effect, FileSystem, Layer, Option } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { makeAppLayer } from "./layers/app.js";
import { PublishError } from "./release/errors.js";
import { ReleaseLive } from "./release/layers.js";
import type { DetectedRelease } from "./release/publish.js";
import { detectReleases, runBuildAndSbom, runPublishTargets } from "./release/publish.js";
import { runReleases } from "./release/releases.js";
import {
	buildPendingChecksTable,
	buildPublishValidationSummary,
	buildReleaseNotesPreviewSummary,
	buildReleaseTotals,
	buildSbomPreviewSummary,
	buildValidationDetails,
	buildValidationHeader,
	validationStatusTitle,
} from "./release/report.js";
import type {
	PublishPackagesResult,
	ReleaseInfo,
	ValidationFinding,
	ValidationPackageResult,
} from "./release/types.js";
import { runValidation as runValidationEffect } from "./release/validation.js";
import { toBranchManagementOutput, toPublishingOutput, toValidationOutput } from "./schema/projections.js";
import type { ValidationOutput } from "./schema/release-output.js";
import { ReleaseOutput } from "./schema/release-output.js";
import { checkReleaseBranch } from "./utils/check-release-branch.js";
import { cleanupValidationChecks } from "./utils/cleanup-validation-checks.js";
import { closeLinkedIssues } from "./utils/close-linked-issues.js";
import { createReleaseBranch } from "./utils/create-release-branch.js";
import { createValidationCheck } from "./utils/create-validation-check.js";
import { deriveCheckConclusion } from "./utils/derive-check-conclusion.js";
import type { WorkflowPhase } from "./utils/detect-workflow-phase.js";
import { detectWorkflowPhase } from "./utils/detect-workflow-phase.js";
import type { TagInfo } from "./utils/determine-tag-strategy.js";
import { determineTagStrategy, isMonorepoForTagging } from "./utils/determine-tag-strategy.js";
import { readEventPullRequestNumber } from "./utils/event-payload.js";
import { resolveCommitLinker, resolveServerUrl } from "./utils/github-urls.js";
import { linkIssuesFromCommits } from "./utils/link-issues-from-commits.js";
import type { ConfigSource } from "./utils/load-release-config.js";
import type { Section } from "./utils/managed-sections.js";
import { refreshBanners, upsertSection, withSection } from "./utils/managed-sections.js";
import { toReleasePlanReport } from "./utils/release-plan.js";
import {
	RELEASE_TABLE_LEGEND,
	releaseTable,
	toPendingReleaseRows,
	toValidatedReleaseRows,
} from "./utils/release-table.js";
import { sortReleasesTopologically } from "./utils/sort-releases-topologically.js";
import { updateReleaseBranch } from "./utils/update-release-branch.js";
import { readStickyComment, updateStickyComment } from "./utils/update-sticky-comment.js";
import { validateBuilds } from "./utils/validate-builds.js";

// ---------------------------------------------------------------------------
// Phase handlers (stubs — populated as the migration progresses)
// ---------------------------------------------------------------------------

/**
 * Read `packageManager` from `./package.json` and reduce it to one of the
 * four package-manager names the release pipeline supports. Falls back to
 * `pnpm` when the field is missing or unrecognised.
 *
 * @internal
 */
// Detection order mirrors the shell helper the release pipeline used before
// this migration: prefer the explicit `packageManager` field in
// `package.json`, then fall back to a lockfile probe (pnpm > yarn > bun),
// and finally `"npm"`. Defaulting to `"npm"` on a no-signal repo is honest —
// the prior `"pnpm"` default risked invoking a manager the workspace does
// not actually use.
const detectPackageManager = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;

	// 1. Read `package.json`'s `packageManager` field if present.
	const readResult = yield* Effect.result(fs.readFileString("package.json"));
	if (readResult._tag === "Success") {
		try {
			const parsed = JSON.parse(readResult.success) as { packageManager?: string };
			const raw = parsed.packageManager ?? "";
			const name = raw.split("@")[0];
			if (name === "npm" || name === "pnpm" || name === "yarn" || name === "bun") return name;
		} catch {
			// fall through to lockfile detection
		}
	}

	// 2. Lockfile fallback. Probe in pnpm > yarn > bun order; first hit wins.
	// `fs.exists` returns `Effect<boolean, PlatformError>`; treat errors as
	// "doesn't exist" so a transient FS issue cannot flip the chosen manager.
	const exists = (path: string) => fs.exists(path).pipe(Effect.catch(() => Effect.succeed(false)));

	if (yield* exists("pnpm-lock.yaml")) return "pnpm" as const;
	if (yield* exists("yarn.lock")) return "yarn" as const;
	if (yield* exists("bun.lock")) return "bun" as const;

	return "npm" as const;
});

/**
 * Run an effect inside a collapsible log group, resolving `ActionLogger` itself.
 *
 * @remarks
 * The drop-in shape of the predecessor's `Step.groupStep`, minus the step
 * envelope. `Step.groupStep` wrapped its body in **both** a group and a step,
 * and the step existed to make a success line land inside the group; the kit's
 * `group` needs no such pairing, so the phase bodies emit their own summary
 * lines and there is nothing left for a step to add.
 */
const grouped = <A, E, R>(name: string, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R | ActionLogger> =>
	Effect.flatMap(ActionLogger, (logger) => logger.group(name, effect));

/**
 * Give changesets the history it needs: full depth, and a **local** ref for the
 * target branch.
 *
 * @remarks
 * The checkout step in the wrapping workflow may have only shallow history of
 * the release branch plus an `origin/<target>` remote ref, while changesets
 * computes its diff against a local one.
 *
 * `Run.collect` for the probe, not `Run.text`: a non-zero exit is a **result**
 * here, not a failure — an old git without `--is-shallow-repository` answers
 * non-zero, and that means "not shallow", not "stop". Both fetches go through
 * `Effect.result` because neither is worth failing the phase over: a
 * `--unshallow` on an already-complete clone exits non-zero by design.
 *
 * Phases 2 and 3 both needed this and each carried its own copy; one drifting
 * from the other would silently change what changesets compares against.
 */
const ensureFullHistory = (targetBranch: string) =>
	Effect.gen(function* () {
		const probe = yield* Effect.result(Run.collect(ChildProcess.make("git", ["rev-parse", "--is-shallow-repository"])));
		const isShallow = probe._tag === "Success" && probe.success.stdout.trim() === "true";
		if (isShallow) {
			yield* Effect.logDebug("Repository is shallow, fetching full history");
			yield* Effect.result(Run.collect(ChildProcess.make("git", ["fetch", "--unshallow", "origin"])));
		}
		yield* Effect.result(Run.collect(ChildProcess.make("git", ["fetch", "origin", `${targetBranch}:${targetBranch}`])));
	});

/**
 * Return a copy of a {@link ValidationOutput} with per-package `releaseNotes`
 * omitted. Release-notes CHANGELOG content is rendered in the dedicated Release
 * Notes Preview check; the machine-readable structured output (the `result`
 * action output and the embedded JSON block) does not carry it — the full notes
 * for every package otherwise dominate the payload and can push the unified
 * check summary past GitHub's 65535-byte limit.
 */
const stripReleaseNotes = (output: ValidationOutput): ValidationOutput => ({
	...output,
	validation: {
		...output.validation,
		publish: {
			...output.validation.publish,
			packages: output.validation.publish.packages.map(({ releaseNotes: _omit, ...rest }) => rest),
		},
	},
});

/**
 * Emit a {@link ReleaseOutput} as the structured `result` action output plus
 * the five convenience scalars. `result` is Schema-encoded; the scalars mirror
 * the most-wanted facts so a consumer need not parse JSON.
 *
 * @param outputs - The `ActionOutputs` service instance.
 * @param output - The phase-projected release output to emit.
 * @param scalars - The convenience scalar values for this phase. `packageCount`
 *   is the count of packages relevant to this phase — the changeset count for
 *   branch-management, the validated-package count for validation, and the
 *   total published-package count for publishing — so its meaning differs per
 *   phase.
 * @internal
 */
const emitReleaseOutput = (
	outputs: ActionOutputsShape,
	output: ReleaseOutput,
	scalars: { readonly packageCount: number; readonly releasePrNumber: number | null },
): Effect.Effect<void, ActionOutputError> =>
	Effect.gen(function* () {
		yield* outputs
			.setJson("result", output, ReleaseOutput)
			.pipe(
				Effect.catch((e) =>
					Effect.logWarning(`Failed to emit structured "result" output: ${e instanceof Error ? e.message : String(e)}`),
				),
			);
		yield* outputs.set("phase", output.phase);
		yield* outputs.set("status", output.status);
		yield* outputs.set("succeeded", output.succeeded ? "true" : "false");
		yield* outputs.set("package-count", String(scalars.packageCount));
		yield* outputs.set("release-pr-number", scalars.releasePrNumber === null ? "" : String(scalars.releasePrNumber));
	});

/**
 * What Phase 1 learned about the release branch, however it learned it.
 *
 * @remarks
 * Both branch flows are normalised to this before the orchestrator sees them,
 * so the reporting below is written once rather than per-arm.
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
 * The seams {@link runBranchManagement} runs against.
 *
 * @remarks
 * Injected rather than imported so the orchestration can be driven directly.
 * What the phase decides — which arm brackets the reporting section, what is
 * published on a failure, whether anything is published at all in a dry run —
 * is only observable by varying the flow's *outcome*, and a flow that fails,
 * dies with a defect, or is interrupted is one line to supply here versus
 * twenty stubbed services scripted to break at the right moment.
 *
 * Every field defaults to the real implementation, so production behaviour is
 * whatever it was before this became injectable.
 *
 * @public
 */
export interface BranchManagementSeams<R = never> {
	/** Probe the release branch and any open PR. */
	readonly checkBranch: (
		releaseBranch: string,
		targetBranch: string,
		dryRun: boolean,
	) => Effect.Effect<Effect.Success<ReturnType<typeof checkReleaseBranch>>, SeamError, R>;
	/** Update an existing release branch. */
	readonly updateFlow: () => Effect.Effect<Effect.Success<ReturnType<typeof updateReleaseBranch>>, SeamError, R>;
	/** Cut a new release branch. */
	readonly createFlow: () => Effect.Effect<Effect.Success<ReturnType<typeof createReleaseBranch>>, SeamError, R>;
	/**
	 * Give changesets the history it needs before the plan is read.
	 *
	 * @remarks
	 * A seam for the same reason the flows are: it shells out to git, and a test
	 * that wanted to vary the phase's reporting should not have to script a
	 * subprocess to do it.
	 */
	readonly ensureHistory: (targetBranch: string) => Effect.Effect<void, SeamError, R>;
	/** Read a sticky comment's current body, so a rewrite preserves its neighbours. */
	readonly readComment: (
		prNumber: number,
		key: string,
	) => Effect.Effect<Effect.Success<ReturnType<typeof readStickyComment>>, SeamError, R>;
	/** Write a rendered section to a PR. Failures are the caller's to swallow. */
	readonly publishComment: (
		prNumber: number,
		body: string,
		key: string,
	) => Effect.Effect<Effect.Success<ReturnType<typeof updateStickyComment>>, SeamError, R>;
}

/**
 * The failures a seam may report.
 *
 * @remarks
 * The union the real implementations already raise. Named so a stub can widen
 * to it without restating the list, and so `R` is the only parameter a caller
 * has to think about.
 *
 * @public
 */
export type SeamError =
	| Effect.Error<ReturnType<typeof checkReleaseBranch>>
	| Effect.Error<ReturnType<typeof updateReleaseBranch>>
	| Effect.Error<ReturnType<typeof createReleaseBranch>>
	| Effect.Error<ReturnType<typeof updateStickyComment>>
	| Effect.Error<ReturnType<typeof readStickyComment>>;

const REAL_SEAMS: BranchManagementSeams<
	| Effect.Services<ReturnType<typeof checkReleaseBranch>>
	| Effect.Services<ReturnType<typeof updateReleaseBranch>>
	| Effect.Services<ReturnType<typeof createReleaseBranch>>
	| Effect.Services<ReturnType<typeof updateStickyComment>>
	| Effect.Services<ReturnType<typeof readStickyComment>>
> = {
	checkBranch: checkReleaseBranch,
	ensureHistory: ensureFullHistory,
	readComment: readStickyComment,
	updateFlow: updateReleaseBranch,
	createFlow: createReleaseBranch,
	publishComment: updateStickyComment,
};

/**
 * Phase 1 — create or update the release branch and its pull request.
 *
 * @param seams - Overrides for the operations this phase orchestrates. Defaults
 *   to the real implementations; tests supply flows with chosen outcomes.
 *
 * @public
 */
export const runBranchManagement = <R = never>(seams: BranchManagementSeams<R> = REAL_SEAMS as never) =>
	Effect.gen(function* () {
		const packageManager = yield* detectPackageManager;
		const planner = yield* Changesets.ReleasePlanner;

		yield* grouped(
			"Phase 1: Release Branch Management",
			Effect.gen(function* () {
				const releaseBranch = yield* ActionInput.string("release-branch").pipe(
					Config.withDefault("changeset-release/main"),
				);
				const targetBranch = yield* ActionInput.string("target-branch").pipe(Config.withDefault("main"));
				const dryRun = yield* ActionInput.boolean("dry-run").pipe(Config.withDefault(false));
				yield* Effect.logInfo(`Detected package manager: ${packageManager}`);
				const branchCheck = yield* seams.checkBranch(releaseBranch, targetBranch, dryRun);

				// Phase 1's job is to answer "what is about to be released" before the
				// next phase runs, so this reads the RELEASE PLAN — not the changeset
				// files, and not the applied result.
				//
				// `preview` must run before the branch flow, because `apply` deletes the
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
				yield* seams.ensureHistory(targetBranch);
				const plan = yield* planner.plan(process.cwd());
				// Projected in `release-plan`, where it is tested. A package's `changesets`
				// list is empty when it releases only because a dependency moved — the
				// `—` in the release table — and the file count is not the package count.
				const { packages: changesets, changesetFileCount } = toReleasePlanReport(plan);

				// The release plan, published to the PR as soon as it is known rather than
				// held back until validation has something to say about it.
				//
				// Every column but `targets` comes from the plan, so a reader sees what
				// will be published — versions included — while the build is still
				// running. `targets` renders pending: blank is indistinguishable from "no
				// targets", and a tick would claim a result validation has not produced.
				const planBody = `${releaseTable.render(toPendingReleaseRows(changesets))}\n\n${RELEASE_TABLE_LEGEND}`;
				const { sha: headSha, runId: planRunId } = yield* (yield* ActionEnvironment).github;

				// Read the comment before rewriting it, so only THIS section changes.
				//
				// `upsertSection` rewrites one marker-delimited region and leaves the
				// rest of the body alone — but only if it is given the rest of the body.
				// Starting from `""` replaced the whole comment on every write, so any
				// other section, and anything a human added, was lost on the next run.
				// The markers exist precisely so two phases can each own a region of one
				// comment.
				//
				// A failed read degrades to `""` rather than aborting: losing a
				// neighbour is bad, but refusing to report the release at all is worse.
				// The verdict, seeded pending. Validation replaces it in place.
				//
				// It exists at this point purely to settle the comment's ORDER — a
				// reader should meet the verdict, then the table, then the detail — and
				// `upsertSection` appends a key it has not seen, so a verdict first
				// written by validation would land beneath the table.
				//
				// `pending` rather than a tick: Phase 1 has no validation result and
				// must not appear to claim one.
				const pendingVerdict: Section = {
					key: "validation-status",
					title: validationStatusTitle(null),
					stamp: { state: "pending", sha: headSha, runId: String(planRunId), at: new Date().toISOString() },
					// A real table with every row pending, not a sentence. It says more,
					// and validation resolves rows in place rather than replacing the
					// shape of what is there.
					body: buildPendingChecksTable(),
				};

				// Links the stamped sha in every banner.
				const commitLink = yield* resolveCommitLinker();

				const publishPlan = (target: number) => (section: Section) =>
					seams.readComment(target, "release-plan").pipe(
						Effect.catch(() => Effect.succeed("")),
						Effect.flatMap((existing) =>
							Effect.result(
								seams.publishComment(
									target,
									// Verdict first, then the section being written. Seeding the
									// verdict here is what settles the comment's ORDER:
									// `upsertSection` appends a key it has not seen, so without
									// this, validation's header would land below the table.
									refreshBanners(
										upsertSection(
											upsertSection(existing, pendingVerdict, headSha, commitLink),
											section,
											headSha,
											commitLink,
										),
										headSha,
										commitLink,
									),
									"release-plan",
								),
							),
						),
						Effect.flatMap((posted) =>
							posted._tag === "Failure"
								? // A reporting write must never fail a release that otherwise
									// succeeded, and `withSection` types `publish` as infallible for
									// that reason: a finalizer that could fail on the way out would
									// replace the caller's real error with a reporting one.
									Effect.logWarning(`Could not publish the release plan comment: ${String(posted.failure)}`)
								: Effect.void,
						),
					);

				// The branch flow, normalised so both arms report the same four facts.
				const runBranchFlow = branchCheck.exists
					? Effect.gen(function* () {
							yield* Effect.logInfo("Release branch exists — running update flow");
							const result = yield* seams.updateFlow();
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
							const result = yield* seams.createFlow();
							return {
								created: result.created,
								updated: false,
								hasConflicts: false,
								prNumber: result.prNumber ?? branchCheck.prNumber,
							};
						});

				// Bracket the flow ONLY when a PR already exists to write to.
				//
				// The create path has nothing to comment on until it has created the PR,
				// so there is no `running` state to show and the plan is published once,
				// after. The update path does have one, so the section goes `running`
				// before the flow and reaches a terminal state on every exit — including
				// a defect or an interrupt, which is the case a `tap`/`tapError` pair
				// misses and which would otherwise leave the section reading `running`
				// forever.
				const flow =
					branchCheck.prNumber !== null && !dryRun
						? withSection(
								{
									key: "release-plan",
									title: "🚀 What will be released",
									sha: headSha,
									runId: String(planRunId),
									now: () => new Date().toISOString(),
									// Retained on every non-success exit: the plan stays readable,
									// marked, rather than being blanked to signal freshness.
									previousBody: planBody,
									render: () => planBody,
									publish: publishPlan(branchCheck.prNumber),
								},
								runBranchFlow,
							)
						: runBranchFlow;

				const { created, updated, hasConflicts, prNumber } = yield* flow;

				// The create path publishes once, after the fact — see above.
				if (branchCheck.prNumber === null && prNumber !== null && !dryRun) {
					yield* publishPlan(prNumber)({
						key: "release-plan",
						title: "🚀 What will be released",
						stamp: { state: "complete", sha: headSha, runId: String(planRunId), at: new Date().toISOString() },
						body: planBody,
					});
				}

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
					changesets,
					changesetFileCount,
					dryRun,
				});
				const outputs = yield* ActionOutputs;
				yield* emitReleaseOutput(outputs, output, { packageCount: changesets.length, releasePrNumber: prNumber });

				// Phase 1's own summary line. Phases 2 and 3 already ended with one;
				// Phase 1 relied on the `Step.groupStep` envelope to emit it, and
				// `logger.group` has no such envelope — so without this the phase now
				// closes its group silently.
				const verb = branchCheck.exists ? (updated ? "updated" : "unchanged") : created ? "created" : "not created";
				yield* Effect.logInfo(
					`Release branch management: ✅ ${releaseBranch} ${verb}` +
						`, ${changesets.length} package(s) with changesets` +
						(prNumber === null ? "" : `, PR #${prNumber}`),
				);
			}),
		);
	});

/**
 * Phase 2 validation orchestrator. Runs the migrated Effect steps
 * inline; defers publish / release-notes / SBOM validation to the
 * existing imperative helpers.
 */
const runValidation = Effect.gen(function* () {
	const logger = yield* ActionLogger;
	const outputs = yield* ActionOutputs;
	const env = yield* ActionEnvironment;
	const pullRequests = yield* PullRequest;

	const releaseBranch = yield* ActionInput.string("release-branch").pipe(Config.withDefault("changeset-release/main"));
	const targetBranch = yield* ActionInput.string("target-branch").pipe(Config.withDefault("main"));
	const dryRun = yield* ActionInput.boolean("dry-run").pipe(Config.withDefault(false));
	// `strict-warnings` escalates warning-severity findings to `failure` on
	// the per-step AND unified check-run conclusions, letting auto-merge gates
	// (branch protection, Mergify, …) hold on warnings. Default `false`
	// preserves the existing advisory-warning semantics.
	const strictWarnings = yield* ActionInput.boolean("strict-warnings").pipe(Config.withDefault(false));
	const packageManager = yield* detectPackageManager;
	const { repositoryOwner: owner, sha } = yield* env.github;

	yield* grouped(
		"Phase 2: Validation",
		Effect.gen(function* () {
			yield* Effect.logDebug(`Detected package manager: ${packageManager}`);

			// Changesets needs full history + a LOCAL ref for the target branch
			// to compute the diff between the release branch and main. The
			// checkout step in the wrapping workflow may only have shallow
			// history of changesets-release/main and an origin/main remote
			// ref; fetch+set up a local ref before any changeset-aware step
			// runs.
			yield* Effect.logDebug("Fetching git history for changeset comparison");
			yield* ensureFullHistory(targetBranch);
			yield* Effect.logDebug(`Fetched ${targetBranch} as a local ref`);

			// Step 1 — link issues from commits (migrated).
			const issuesResult = yield* logger.group(
				"Link issues from commits",
				linkIssuesFromCommits.pipe(
					Effect.catch((e) =>
						Effect.gen(function* () {
							yield* Effect.logWarning(`linkIssuesFromCommits failed: ${String(e)}`);
							return {
								linkedIssues: [] as Array<{ number: number; title: string }>,
								commits: [],
								checkId: 0,
								htmlUrl: "",
							};
						}),
					),
				),
			);
			yield* Effect.logInfo(`✅ Link issues — ${issuesResult.linkedIssues.length} issue(s) linked`);

			// Step 2 — validate builds (migrated).
			const buildResult = yield* logger.group(
				"Validate builds",
				validateBuilds(packageManager).pipe(
					Effect.catch((e) =>
						Effect.gen(function* () {
							yield* Effect.logError(`validateBuilds failed: ${String(e)}`);
							return { success: false, errors: String(e), checkId: 0, htmlUrl: "" };
						}),
					),
				),
			);
			yield* Effect.logInfo(buildResult.success ? "✅ Build validation — passed" : "❌ Build validation — failed");

			// Steps 3-5 — publish / release-notes / SBOM validation via Effect.
			const publishCheckId = 0;
			let publishReadyTargets = 0;
			let publishTotalTargets = 0;
			let publishOk = true;
			let npmReady = false;
			let githubPackagesReady = false;
			let reportPackages: ReadonlyArray<{ name: string; version: string; ready: boolean }> = [];
			// Build-centric per-package validation results — the input to the
			// build-centric ValidationOutput projection.
			let validationPackages: ReadonlyArray<ValidationPackageResult> = [];
			let sbomOk = true;
			let sbomSummary = "SBOM Preview skipped";
			// Structured findings produced by the publish dry-run + SBOM/NTIA checks
			// inside `runValidationEffect`; the build finding is appended below.
			let reportFindings: ReadonlyArray<ValidationFinding> = [];
			// Per-build resolved sbom-config metadata, keyed by
			// `${pkg.name}:${build.directory}`. Debug-only; fed into the SBOM Preview
			// check-run summary so config-or-mapping bugs are immediately visible.
			// `null` indicates `runValidationEffect` was not reached (build failure).
			let resolvedSbomConfig: ReadonlyMap<string, SbomMetadata> | null = null;
			// The source the `sbom-config` was loaded from this run (`input` /
			// `local` / `variable` / `none`). Surfaced on the SBOM Preview
			// check-run summary; `null` until `runValidationEffect` reports it.
			let sbomConfigSource: ConfigSource | null = null;

			if (buildResult.success) {
				yield* Effect.logInfo("Validate publishing");
				const report = yield* runValidationEffect({ packageManager, targetBranch, dryRun }).pipe(
					Effect.catch((e) =>
						Effect.gen(function* () {
							const message =
								e instanceof Error
									? `${e.message}\n${String((e as Error & { stack?: string }).stack ?? "")}`
									: String(e);
							yield* Effect.logWarning(`runValidation failed: ${message}`);
							return null;
						}),
					),
				);
				if (report !== null) {
					publishReadyTargets = report.readyTargets;
					publishTotalTargets = report.totalTargets;
					publishOk = report.publishOk;
					npmReady = report.npmReady;
					githubPackagesReady = report.githubPackagesReady;
					reportPackages = report.packages;
					validationPackages = report.validationPackages;
					sbomOk = report.sbomOk;
					sbomSummary = report.sbomSummary;
					reportFindings = report.findings;
					resolvedSbomConfig = report.resolvedSbomConfig;
					sbomConfigSource = report.sbomConfigSource;
				}
				yield* Effect.logInfo(
					publishOk
						? `✅ Publish validation — ${publishReadyTargets}/${publishTotalTargets} target(s) ready`
						: `❌ Publish validation — ${publishReadyTargets}/${publishTotalTargets} target(s) ready`,
				);
				yield* Effect.logInfo(`✅ Release notes — ${reportPackages.length} package(s) ready`);
				yield* Effect.logInfo(sbomOk ? `✅ SBOM preview — ${sbomSummary}` : `❌ SBOM preview — ${sbomSummary}`);
			} else {
				yield* Effect.logWarning("Builds failed, skipping publish validation");
			}

			// Step 6 — unified validation check (migrated).
			// Aggregate the structured findings across every Phase-2 check. The
			// publish dry-run + SBOM/NTIA findings come from `runValidationEffect`;
			// the build finding is derived here from `buildResult`.
			//
			// Honesty note: Link-Issues and Release-Notes contribute no findings.
			// `LinkIssuesResult` exposes no failure signal (the step always
			// completes its check as `success` and `main.ts` degrades any thrown
			// error to an empty result), and there is no rich release-notes module
			// on `dev` — no missing-CHANGELOG / notes-extraction signal exists.
			const findings: ValidationFinding[] = [];
			if (!buildResult.success) {
				findings.push({
					severity: "error",
					check: "Build Validation",
					scope: null,
					message: buildResult.errors.trim() || "Build failed",
				});
			}
			findings.push(...reportFindings);

			// Conclusion-per-check rule used for the three new per-step check runs
			// AND propagated into the unified Release Validation Summary check's
			// per-row `success` field below — so the unified conclusion and the
			// per-step conclusions agree on strict-warnings escalation.
			//
			// Build-failed cascade — when Build Validation fails, `runValidation`
			// is skipped so the downstream Publish / Release Notes / SBOM checks
			// emit no findings. The helper reports `failure` for those rows so
			// the conclusion does not lie about steps that never ran.
			const conclusionFor = (checkName: string): "success" | "failure" | "neutral" =>
				deriveCheckConclusion(checkName, findings, buildResult.success, strictWarnings);

			// Translate a conclusion into the boolean shape the unified check
			// run consumes. `neutral` (warning, non-strict) counts as success for
			// the unified table — preserves the prior "warnings are advisory"
			// semantics. `failure` (errors, or warnings under strict mode) flips
			// the row to failed.
			const successFor = (checkName: string): boolean => conclusionFor(checkName) !== "failure";

			const checkResults = [
				{
					name: "Link Issues from Commits",
					success: successFor("Link Issues from Commits"),
					checkId: 0,
					message: `${issuesResult.linkedIssues.length} issue(s) linked`,
				},
				{
					name: "Build Validation",
					success: buildResult.success,
					checkId: buildResult.checkId,
					message: buildResult.success ? "Build passed" : "Build failed",
				},
				{
					name: "Publish Validation",
					success: buildResult.success && publishOk && successFor("Publish Validation"),
					checkId: publishCheckId,
					message:
						publishTotalTargets === 0 ? "No targets" : `${publishReadyTargets}/${publishTotalTargets} target(s) ready`,
				},
				{
					name: "Release Notes Preview",
					success: successFor("Release Notes Preview"),
					checkId: 0,
					message: `${reportPackages.length} package(s) ready`,
				},
				{
					name: "SBOM Preview",
					success: sbomOk && successFor("SBOM Preview"),
					checkId: 0,
					message: sbomSummary,
				},
			];

			// Derive the 3-state checks-table icon per row from the findings the
			// check produced: any error → ❌, else any warning → ⚠️, else ✅. The
			// `hardFailed` flag covers checks whose failure is not also a finding
			// (e.g. a publish failure when the build itself passed).
			const statusFor = (checkName: string, hardFailed: boolean): "pass" | "warning" | "error" => {
				const own = findings.filter((f) => f.check === checkName);
				if (hardFailed || own.some((f) => f.severity === "error")) return "error";
				if (own.some((f) => f.severity === "warning")) return "warning";
				return "pass";
			};
			const buildUrl = buildResult.htmlUrl !== "" ? buildResult.htmlUrl : null;
			const linkIssuesUrl = issuesResult.htmlUrl !== "" ? issuesResult.htmlUrl : null;

			// Project the canonical ValidationOutput. The unified Release Validation
			// Summary check is created at the end (after the per-step checks and the
			// final `validationOutput`) so its body can carry the full structured
			// `result` JSON in a collapsed block. `checkRun` is `null` here — the
			// unified URL is not yet known, and the body JSON should not self-
			// reference the very page it lives on. The emitted `result` is shallow-
			// patched below once the unified check exists, so consumers see the
			// real `{url, conclusion}` in the action output.
			const projectValidation = (
				checks: ReadonlyArray<ValidationOutput["validation"]["checks"][number]>,
			): ValidationOutput =>
				toValidationOutput({
					buildsPassed: buildResult.success,
					packageCount: reportPackages.length,
					npmReady,
					githubPackagesReady,
					totalTargets: publishTotalTargets,
					readyTargets: publishReadyTargets,
					checks,
					findings,
					validationPackages,
					checkRun: null,
					dryRun,
				});

			// Placeholder checks — `Link Issues from Commits` and `Build Validation`
			// carry their own per-step check URLs (or `null` when unavailable); the
			// remaining three rows are filled in once their per-step check runs
			// exist.
			const placeholderChecks: ReadonlyArray<ValidationOutput["validation"]["checks"][number]> = [
				{
					name: "Link Issues from Commits",
					status: statusFor("Link Issues from Commits", false),
					outcome: `${issuesResult.linkedIssues.length} issue(s) linked`,
					url: linkIssuesUrl,
				},
				{
					name: "Build Validation",
					status: statusFor("Build Validation", !buildResult.success),
					outcome: buildResult.success ? "Build passed" : "Build failed",
					url: buildUrl,
				},
				{
					name: "Publish Validation",
					status: statusFor("Publish Validation", !buildResult.success || !publishOk),
					outcome:
						publishTotalTargets === 0 ? "No targets" : `${publishReadyTargets}/${publishTotalTargets} target(s) ready`,
					url: null,
				},
				{
					name: "Release Notes Preview",
					status: statusFor("Release Notes Preview", false),
					outcome: `${reportPackages.length} package(s) ready`,
					url: null,
				},
				{
					name: "SBOM Preview",
					status: statusFor("SBOM Preview", !buildResult.success || !sbomOk),
					outcome: sbomSummary,
					url: null,
				},
			];

			// Draft projection over the placeholder rows — feeds the per-step
			// summary builders below. The per-step URLs for Publish / Release
			// Notes / SBOM are filled in further down.
			const summaryDraftOutput = projectValidation(placeholderChecks);

			// Create the three per-step check runs after the canonical object is
			// known — each summary is rendered from `summaryDraftOutput.validation`.
			// Converted to the kit's `CheckRun`, which `MainLive` already provides:
			// this was the last consumer of the hand-rolled `capCheckSummary`, and
			// the kit caps unconditionally in `wireOutput`.
			const checksSvc = yield* CheckRun;

			const createPerStepCheck = (
				title: string,
				conclusion: "success" | "failure" | "neutral",
				summary: string,
			): Effect.Effect<string, never, Repo> =>
				Effect.gen(function* () {
					const created = yield* checksSvc.create(title, sha).pipe(
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
					// satisfies it. No `capCheckSummary` — `complete` pipes the output
					// through `wireOutput`, which truncates on every request.
					yield* checksSvc
						.complete(created.id, conclusion, CheckRunOutput.make({ title, summary }))
						.pipe(Effect.catch((e) => Effect.logWarning(`Failed to complete check run "${title}": ${e.message}`)));
					// `CheckRunRef` exposes `url`, not `htmlUrl`. The kit builds it as
					// `raw.html_url ?? ""`, so the empty-string sentinel `urlFor` below
					// keys on is preserved.
					return created.url;
				});

			const publishSummary = buildPublishValidationSummary(summaryDraftOutput.validation);
			const releaseNotesSummary = buildReleaseNotesPreviewSummary(summaryDraftOutput.validation);
			const sbomSummaryMd = buildSbomPreviewSummary(
				summaryDraftOutput.validation,
				resolvedSbomConfig,
				sbomConfigSource,
			);

			const publishTitle = dryRun ? "🧪 Publish Validation (Dry Run)" : "Publish Validation";
			const releaseNotesTitle = dryRun ? "🧪 Release Notes Preview (Dry Run)" : "Release Notes Preview";
			const sbomTitle = dryRun ? "🧪 SBOM Preview (Dry Run)" : "SBOM Preview";

			const publishCheckUrl = yield* createPerStepCheck(
				publishTitle,
				conclusionFor("Publish Validation"),
				publishSummary,
			);
			const releaseNotesCheckUrl = yield* createPerStepCheck(
				releaseNotesTitle,
				conclusionFor("Release Notes Preview"),
				releaseNotesSummary,
			);
			const sbomCheckUrl = yield* createPerStepCheck(sbomTitle, conclusionFor("SBOM Preview"), sbomSummaryMd);

			// Fill in the Publish / Release Notes / SBOM rows with each check's
			// real htmlUrl. Build / Link rows keep their existing values (own
			// per-step URL or `null`).
			const urlFor = (placeholder: string | null, real: string): string | null => (real !== "" ? real : placeholder);
			const checkRows: ReadonlyArray<ValidationOutput["validation"]["checks"][number]> = placeholderChecks.map(
				(row) => {
					if (row.name === "Publish Validation") return { ...row, url: urlFor(row.url, publishCheckUrl) };
					if (row.name === "Release Notes Preview") return { ...row, url: urlFor(row.url, releaseNotesCheckUrl) };
					if (row.name === "SBOM Preview") return { ...row, url: urlFor(row.url, sbomCheckUrl) };
					return row;
				},
			);

			// Final summary line.
			const passedCount = checkResults.filter((r) => r.success).length;
			yield* Effect.logInfo(
				passedCount === checkResults.length
					? `Release validation: ✅ ${passedCount}/${checkResults.length} checks passed`
					: `Release validation: ❌ ${passedCount}/${checkResults.length} checks passed — failed: ${checkResults
							.filter((r) => !r.success)
							.map((r) => r.name)
							.join(", ")}`,
			);

			// Provisional projection over the final per-step URLs — used to build
			// the JSON block in the check-run body. `checkRun` is `null` here so
			// the body JSON does not self-reference the very page it lives on; the
			// emitted `result` is patched below with the now-known unified URL.
			const provisionalOutput = projectValidation(checkRows);

			// Build the collapsed JSON block surfacing the full structured `result`
			// action output inside the unified check-run page — the downstream-
			// consumer artifact is no longer hidden behind the action's outputs.
			const jsonBlock = [
				"",
				"<details>",
				"<summary>📦 Full structured output (<code>result</code> action output)</summary>",
				"",
				"```json",
				JSON.stringify(stripReleaseNotes(provisionalOutput), null, 2),
				"```",
				"",
				"</details>",
			].join("\n");

			const unified = yield* logger.group("Validation check", createValidationCheck(checkResults, dryRun, jsonBlock));
			yield* Effect.logInfo(`✅ Validation check — conclusion: ${unified.success ? "success" : "failure"}`);
			const unifiedUrl = unified.htmlUrl !== "" ? unified.htmlUrl : undefined;

			// Patch the emitted result with the now-known unified check URL /
			// conclusion. The one-line divergence between the body JSON
			// (`checkRun: null`) and the emitted `result` (`checkRun: { url,
			// conclusion }`) is intentional — the body JSON should not self-
			// reference the very page it lives on, but the `result` action output
			// must carry the unified check URL for downstream consumers.
			const validationOutput: ValidationOutput = {
				...provisionalOutput,
				validation: {
					...provisionalOutput.validation,
					checkRun:
						unified.htmlUrl !== ""
							? { url: unified.htmlUrl, conclusion: unified.success ? "success" : "failure" }
							: null,
				},
			};

			// Step 7 — sticky comment on the release PR (migrated).
			// `PullRequest.list` replaces a raw octokit callback that hand-wrote the
			// whole `rest.pulls.list` type — the only such callback left in `src`.
			// The route's params and response are typed by the service.
			const prsResult = yield* Effect.result(
				pullRequests.list({ state: "open", head: `${owner}:${releaseBranch}`, base: targetBranch }),
			);
			if (prsResult._tag === "Success" && prsResult.success.length > 0) {
				const pr = prsResult.success[0];
				// Redesigned Phase-2 comment: a worst-state header icon, the 3-state
				// checks table, the findings table (rendered only when non-empty),
				// the build-grouped "What will be released" forecast, and a
				// release-notes link. Rendered straight from the canonical
				// ValidationOutput's `validation` payload — no parallel comment input.
				// ONE comment, three sections — verdict, release table, detail.
				//
				// The verdict and the detail used to be a second comment rendered
				// wholesale on every run, which meant a reader saw two bot comments
				// making overlapping statements about the same release, and neither
				// could be updated without rewriting the other. As sections of the
				// comment Phase 1 already created, each is stamped and rewritten
				// independently: the verdict can flip from ✅ to ❌ without touching
				// the table, and the table completes without disturbing the verdict.
				const commentOptions = {
					...(unifiedUrl !== undefined && { releaseNotesUrl: unifiedUrl }),
					dryRun,
				};

				// Complete the release plan Phase 1 posted, rather than leaving it
				// reading "pending validation" beside a finished validation run.
				//
				// This writes Phase 1's section, not Phase 2's comment: the plan and
				// the validation report are different statements about the same
				// release, and a reader who scrolls to the plan should not find it
				// contradicting the report below it. The marker keeps the two
				// independent — updating one leaves the other untouched.
				const validationEnvironment = yield* ActionEnvironment;
				const validatedSha = Option.getOrElse(yield* validationEnvironment.getOptional("GITHUB_SHA"), () => "");
				const validatedRunId = Option.getOrElse(yield* validationEnvironment.getOptional("GITHUB_RUN_ID"), () => "");
				const stamp = {
					state: "complete" as const,
					sha: validatedSha,
					runId: validatedRunId,
					at: new Date().toISOString(),
				};
				const sections: ReadonlyArray<Section> = [
					{
						key: "validation-status",
						title: validationStatusTitle(validationOutput.validation),
						stamp,
						body: buildValidationHeader(validationOutput.validation, commentOptions),
					},
					{
						key: "release-plan",
						title: "🚀 What will be released",
						stamp,
						// Totals sit with the table they total, not two headings below it
						// in the detail section.
						body: [
							releaseTable.render(toValidatedReleaseRows(validationPackages)),
							RELEASE_TABLE_LEGEND,
							buildReleaseTotals(validationOutput.validation.publish),
						].join("\n\n"),
					},
					// Detail only once there is any: before the build completes it would
					// be an empty shell under a heading promising substance.
					...(validationOutput.validation.buildValidation.passed
						? [
								{
									key: "validation-details",
									title: "Details",
									stamp,
									body: buildValidationDetails(validationOutput.validation, commentOptions),
								} satisfies Section,
							]
						: []),
				];
				const validatedCommitLink = yield* resolveCommitLinker();

				// Read once, fold all three sections in, write once.
				//
				// Read-modify-write for the same reason as Phase 1 — the comment is not
				// ours alone — and a single write rather than three so a reader never
				// catches the comment mid-update with a stale verdict above a fresh
				// table. `upsertSection` appends a section it has not seen before, so
				// the order here is the order they first appear.
				const existing = yield* readStickyComment(pr.number, "release-plan").pipe(
					Effect.catch(() => Effect.succeed("")),
				);
				const merged = refreshBanners(
					sections.reduce((body, section) => upsertSection(body, section, validatedSha, validatedCommitLink), existing),
					validatedSha,
					validatedCommitLink,
				);
				const planUpdate = yield* Effect.result(updateStickyComment(pr.number, merged, "release-plan"));
				if (planUpdate._tag === "Failure") {
					yield* Effect.logWarning(`Could not update the release comment: ${String(planUpdate.failure)}`);
				} else {
					yield* Effect.logInfo(`✅ Release comment updated on PR #${pr.number}`);
				}
			} else {
				yield* Effect.logInfo("Sticky comment update skipped — no open PR found for release branch");
			}

			// Emit the structured `result` action output for Phase 2. Release notes are
			// stripped here — they live in the Release Notes Preview check, not the
			// machine-readable payload (see stripReleaseNotes).
			yield* emitReleaseOutput(outputs, stripReleaseNotes(validationOutput), {
				packageCount: reportPackages.length,
				// Phase 2 runs on a push to the release branch; the release PR number is not
				// in the event payload and resolving it would need an extra API lookup, so
				// the release-pr-number scalar is left empty for the validation phase.
				releasePrNumber: null,
			});
		}).pipe(
			Effect.catch((e) =>
				Effect.gen(function* () {
					yield* Effect.logError(`Phase 2 failed: ${String(e)}`);
					yield* cleanupValidationChecks([], `Phase 2 failed: ${String(e)}`, dryRun).pipe(
						Effect.catch(() => Effect.succeed({ cleanedUp: 0, failed: 0, errors: [] })),
					);
					return yield* Effect.fail(e);
				}),
			),
		),
	);
});

/**
 * Phase 3 publishing orchestrator. Delegates to the Effect-based
 * {@link detectReleases}, {@link runBuildAndSbom}, and {@link runPublishTargets}
 * programs from `src/release/publish.ts` and the {@link runReleases} program
 * from `src/release/releases.ts`.
 */
const runPublishing = (mergedReleasePRNumber: number | undefined) =>
	grouped(
		"Phase 3: Publishing",
		Effect.gen(function* () {
			const logger = yield* ActionLogger;
			const outputs = yield* ActionOutputs;

			const targetBranch = yield* ActionInput.string("target-branch").pipe(Config.withDefault("main"));
			const dryRun = yield* ActionInput.boolean("dry-run").pipe(Config.withDefault(false));
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
			const tagShas: Record<string, string> = {};
			for (const tag of tagStrategy.tags) {
				// `Run.collect`, so a tag the local clone has not fetched reports an
				// empty sha instead of failing the phase after everything published.
				const rev = yield* Effect.result(Run.collect(ChildProcess.make("git", ["rev-parse", tag.name])));
				tagShas[tag.name] = rev._tag === "Success" && rev.success.exitCode === 0 ? rev.success.stdout.trim() : "";
			}
			yield* emitPublishing(publishResult, tagStrategy.tags, releasesResult.releases, tagShas);

			yield* Effect.logInfo(
				`Release publishing: ✅ ${publishResult.successfulPackages} package(s), ${releasesResult.releases.length} release(s)`,
			);
		}),
	);

const runCloseIssues = Effect.gen(function* () {
	const logger = yield* ActionLogger;
	const dryRun = yield* ActionInput.boolean("dry-run").pipe(Config.withDefault(false));

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

// ---------------------------------------------------------------------------
// Main program
// ---------------------------------------------------------------------------

export const main = Effect.gen(function* () {
	// The installation token provisioned by pre.ts is read back here and
	// bridged into the `STATE_token` env var so the imperative publish helpers
	// (tokens.ts) can read it via `process.env.STATE_token`.
	// `process.env.GITHUB_TOKEN` is intentionally never set.
	const installationToken = yield* GitHubToken.read();
	// `Secret.forSigning`, not a bare `Redacted.value`. The kit keeps
	// declassification to one module and this is its "in-process use that needs
	// the raw bytes" member — which also **masks** the value in the runner log
	// on the way out, something the bare unwrap did not do. Called once here
	// rather than per read, as its own remarks instruct.
	//
	// The name is a poor fit (there is no `Secret.forProcessEnv`) but the
	// mechanism is exactly right, and `utils/tokens.ts` still reads
	// `process.env.STATE_token` for `native-version.ts`.
	process.env.STATE_token = yield* Secret.forSigning(installationToken.token);

	// Identity diagnostics — the App identity resolved by `provision`.
	if (installationToken.appName !== undefined || installationToken.appSlug !== undefined) {
		yield* Effect.logInfo(`Using GitHub App token (${installationToken.appName ?? installationToken.appSlug})`);
	}

	// Routing.
	const releaseBranch = yield* ActionInput.string("release-branch").pipe(Config.withDefault("changeset-release/main"));
	const targetBranch = yield* ActionInput.string("target-branch").pipe(Config.withDefault("main"));
	const explicitInput = yield* ActionInput.string("phase").pipe(Config.withDefault(""));
	const explicitPhase = explicitInput !== "" ? (explicitInput as WorkflowPhase) : undefined;

	const phaseResult = yield* detectWorkflowPhase({
		releaseBranch,
		targetBranch,
		...(explicitPhase !== undefined && { explicitPhase }),
	});

	yield* Effect.logInfo(`Phase: ${phaseResult.phase} — ${phaseResult.reason}`);

	switch (phaseResult.phase) {
		case "branch-management":
			yield* runBranchManagement();
			return;
		case "validation":
			yield* runValidation;
			return;
		case "publishing":
			yield* runPublishing(phaseResult.mergedReleasePRNumber);
			return;
		case "close-issues":
			yield* runCloseIssues;
			return;
		default:
			yield* Effect.logInfo(`No-op phase: ${phaseResult.reason}`);
			return;
	}
});

// ---------------------------------------------------------------------------
// Layer composition and execution
// ---------------------------------------------------------------------------

/**
 * The composite domain layer for the main action.
 *
 * @remarks
 * `ActionRuntime` — injected by `Action.run` — provides `ActionEnvironment`,
 * `ActionLogger`, `ActionOutputs`, `ActionState`, `NodeServices` and an
 * `HttpClient`. Because `ActionRunOptions.layer` is
 * `Layer<R, never, ActionServices>`, this layer may **require** any of them
 * rather than rebuild them, which is what collapsed the transitional
 * `kitRuntime` bridge: the predecessor's `Action.run` demanded a self-contained
 * `Layer<R, never, never>`, so every runtime service the GitHub client needed
 * had to be constructed a second time here.
 *
 * What remains is two things `ActionRuntime` does not know about:
 * {@link makeAppLayer} (the GitHub/npm/sbom graph) and the release-domain
 * layers below.
 *
 * `dry-run` is read here and passed to `makeAppLayer` as a value — the layer
 * stays free of config reads so a test can drive both branches without a
 * `ConfigProvider`. `ActionInput.boolean` — as everywhere else now: a
 * malformed `dry-run` fails instead of silently defaulting to a REAL run, and
 * `Layer.orDie` surfaces that at the boundary.
 */
const releaseLive = ReleaseLive.pipe(Layer.provide(NodeServices.layer), Layer.orDie);

/**
 * `formatWorkspaceWithBiome` probes for the standalone Biome binary through
 * `ToolDiscovery`. `LocalExec.layerNone` is the documented wiring for a GitHub
 * Action — every tool resolves globally on PATH, with no project-local
 * launcher. Deliberately NOT the `pnpm` launcher `makeAppLayer` gives
 * `PackagePublish`: that one exists so `NpmExecutor.dlx` can fetch a pinned
 * npm, which is a different question from "is biome installed".
 */
const toolDiscovery = ToolDiscovery.layer.pipe(Layer.provide(Layer.merge(NodeServices.layer, LocalExec.layerNone)));

/**
 * The main action's domain layer.
 *
 * @public
 */
export const MainLive = Layer.unwrap(
	Effect.map(ActionInput.boolean("dry-run").pipe(Config.withDefault(false)), (dryRun) =>
		Layer.mergeAll(makeAppLayer(dryRun), releaseLive, toolDiscovery),
	),
).pipe(Layer.orDie);

/* v8 ignore next 3 -- entry-point guard, only runs in GitHub Actions */
if (process.env.GITHUB_ACTIONS) {
	await Action.run(main, { layer: MainLive });
}
