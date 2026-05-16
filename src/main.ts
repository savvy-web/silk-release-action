/**
 * Main-action entry point.
 *
 * @remarks
 * Skeleton state during the @actions/* → @savvy-web/github-action-effects
 * migration. Routes to one of four phase handlers — `branch-management`,
 * `validation`, `publishing`, `close-issues` — each currently stubbed.
 *
 * Phase detection that previously used `@actions/github`'s `context` and
 * `getOctokit` will move into a `detectWorkflowPhase` Effect that yields
 * `GitHubClient` + `ActionEnvironment`. Until that lands, the skeleton
 * trusts the `phase` input and falls through to a no-op when absent.
 */

import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import {
	Action,
	ActionEnvironment,
	ActionLogger,
	ActionOutputs,
	ActionState,
	ActionStateLive,
	CheckRunLive,
	CommandRunner,
	CommandRunnerLive,
	GitBranchLive,
	GitCommitLive,
	GitHubClient,
	GitHubGraphQLLive,
	GitHubIssueLive,
	GitHubReleaseLive,
	GitHubToken,
	GitTagLive,
	PullRequestCommentLive,
	PullRequestLive,
} from "@savvy-web/github-action-effects";
import { Config, Effect, Layer, Option } from "effect";
import { toBranchManagementOutput, toPublishingOutput, toValidationOutput } from "./schema/projections.js";
import { ReleaseOutput } from "./schema/release-output.js";
import { GithubPackagesTokenState, STATE_KEYS } from "./state.js";
import type { PackagePublishValidation } from "./types/publish-config.js";
import { checkReleaseBranch } from "./utils/check-release-branch.js";
import { cleanupValidationChecks } from "./utils/cleanup-validation-checks.js";
import { closeLinkedIssues } from "./utils/close-linked-issues.js";
import type { ReleaseInfo } from "./utils/create-github-releases.js";
import { createReleaseBranch } from "./utils/create-release-branch.js";
import { createValidationCheck } from "./utils/create-validation-check.js";
import type { WorkflowPhase } from "./utils/detect-workflow-phase.js";
import { detectWorkflowPhase } from "./utils/detect-workflow-phase.js";
import type { TagInfo } from "./utils/determine-tag-strategy.js";
import { linkIssuesFromCommits } from "./utils/link-issues-from-commits.js";
import type { PublishPackagesResult } from "./utils/publish-packages.js";
import { summaryWriter } from "./utils/summary-writer.js";
import { updateReleaseBranch } from "./utils/update-release-branch.js";
import { updateStickyComment } from "./utils/update-sticky-comment.js";
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
const detectPackageManager = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const readResult = yield* Effect.either(fs.readFileString("package.json"));
	if (readResult._tag === "Left") return "pnpm" as const;
	try {
		const parsed = JSON.parse(readResult.right) as { packageManager?: string };
		const raw = parsed.packageManager ?? "";
		const name = raw.split("@")[0];
		if (name === "npm" || name === "pnpm" || name === "yarn" || name === "bun") return name;
		return "pnpm" as const;
	} catch {
		return "pnpm" as const;
	}
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
	outputs: ActionOutputs["Type"],
	output: ReleaseOutput,
	scalars: { readonly packageCount: number; readonly releasePrNumber: number | null },
): Effect.Effect<void> =>
	Effect.gen(function* () {
		yield* outputs
			.setJson("result", output, ReleaseOutput)
			.pipe(
				Effect.catchAll((e) =>
					Effect.logWarning(`Failed to emit structured "result" output: ${e instanceof Error ? e.message : String(e)}`),
				),
			);
		yield* outputs.set("phase", output.phase);
		yield* outputs.set("status", output.status);
		yield* outputs.set("succeeded", output.succeeded ? "true" : "false");
		yield* outputs.set("package-count", String(scalars.packageCount));
		yield* outputs.set("release-pr-number", scalars.releasePrNumber === null ? "" : String(scalars.releasePrNumber));
	});

const runBranchManagement = Effect.gen(function* () {
	const logger = yield* ActionLogger;
	const packageManager = yield* detectPackageManager;

	yield* logger.group(
		"Phase 1: Release Branch Management",
		Effect.gen(function* () {
			const releaseBranch = yield* Config.string("release-branch").pipe(Config.withDefault("changeset-release/main"));
			const targetBranch = yield* Config.string("target-branch").pipe(Config.withDefault("main"));
			const dryRun = yield* Config.boolean("dry-run").pipe(Config.withDefault(false));
			yield* Effect.logInfo(`Detected package manager: ${packageManager}`);
			const branchCheck = yield* checkReleaseBranch(releaseBranch, targetBranch, dryRun);

			// Read changeset bump types before the version command consumes them.
			const changesetStatus = yield* Effect.tryPromise({
				try: async () => {
					const mod = await import("./utils/get-changeset-status.js");
					return await mod.getChangesetStatus(packageManager, targetBranch);
				},
				catch: (error) => (error instanceof Error ? error : new Error(String(error))),
			}).pipe(Effect.catchAll(() => Effect.succeed({ releases: [], changesets: [] })));

			const changesets = changesetStatus.releases.map((r) => ({
				name: r.name,
				bumpType: (r.type === "major" || r.type === "minor" ? r.type : "patch") as "major" | "minor" | "patch",
			}));

			let created = false;
			let updated = false;
			let hasConflicts = false;
			let prNumber: number | null = branchCheck.prNumber;

			if (branchCheck.exists) {
				yield* Effect.logInfo("Release branch exists — running update flow");
				const updateResult = yield* updateReleaseBranch(packageManager);
				updated = updateResult.success;
				hasConflicts = updateResult.hadConflicts;
				prNumber = updateResult.prNumber ?? prNumber;
			} else {
				yield* Effect.logInfo("Release branch does not exist — running create flow");
				const createResult = yield* createReleaseBranch(packageManager);
				created = createResult.created;
				prNumber = createResult.prNumber ?? prNumber;
			}

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
								// runBranchManagement does not yield ActionEnvironment, so the
								// repository slug is read straight from the env var here.
								url: `https://github.com/${process.env.GITHUB_REPOSITORY ?? ""}/pull/${prNumber}`,
								action: branchCheck.exists ? "updated" : "created",
							},
				changesets,
				dryRun,
			});
			const outputs = yield* ActionOutputs;
			yield* emitReleaseOutput(outputs, output, { packageCount: changesets.length, releasePrNumber: prNumber });
		}),
	);
});

/**
 * Phase 2 validation orchestrator. Runs the migrated Effect steps
 * inline; defers publish / release-notes / SBOM validation to the
 * existing imperative helpers via dynamic import so their @actions/*
 * dependencies stay out of the static bundle graph (which would
 * otherwise drag undici back into main.js — see commit efeb229 for
 * the original incident).
 */
const runValidation = Effect.gen(function* () {
	const logger = yield* ActionLogger;
	const outputs = yield* ActionOutputs;
	const env = yield* ActionEnvironment;
	const client = yield* GitHubClient;

	const releaseBranch = yield* Config.string("release-branch").pipe(Config.withDefault("changeset-release/main"));
	const targetBranch = yield* Config.string("target-branch").pipe(Config.withDefault("main"));
	const dryRun = yield* Config.boolean("dry-run").pipe(Config.withDefault(false));
	const packageManager = yield* detectPackageManager;
	const { repository } = yield* env.github;
	const [owner, repo] = repository.split("/");

	yield* logger.group(
		"Phase 2: Release Validation",
		Effect.gen(function* () {
			yield* Effect.logInfo(`Detected package manager: ${packageManager}`);

			// Changesets needs full history + a LOCAL ref for the target branch
			// to compute the diff between the release branch and main. The
			// checkout step in the wrapping workflow may only have shallow
			// history of changesets-release/main and an origin/main remote
			// ref; fetch+set up a local ref before any changeset-aware step
			// runs.
			yield* Effect.logInfo("Fetching git history for changeset comparison");
			const runner = yield* CommandRunner;
			const shallow = yield* runner
				.execCapture("git", ["rev-parse", "--is-shallow-repository"])
				.pipe(Effect.catchAll(() => Effect.succeed({ stdout: "false\n", stderr: "", exitCode: 0 })));
			if (shallow.stdout.trim() === "true") {
				yield* Effect.logInfo("Repository is shallow, fetching full history");
				yield* Effect.either(runner.exec("git", ["fetch", "--unshallow", "origin"]));
			}
			yield* Effect.either(runner.exec("git", ["fetch", "origin", `${targetBranch}:${targetBranch}`]));
			yield* Effect.logInfo(`Fetched ${targetBranch} as a local ref`);

			// Step 1 — link issues from commits (migrated).
			yield* Effect.logInfo("Step 1: Link Issues from Commits");
			const issuesResult = yield* linkIssuesFromCommits.pipe(
				Effect.catchAll((e) =>
					Effect.gen(function* () {
						yield* Effect.logWarning(`linkIssuesFromCommits failed: ${String(e)}`);
						return { linkedIssues: [] as Array<{ number: number; title: string }>, commits: [] };
					}),
				),
			);
			// Step 2 — validate builds (migrated).
			yield* Effect.logInfo("Step 2: Validate Builds");
			const buildResult = yield* validateBuilds(packageManager).pipe(
				Effect.catchAll((e) =>
					Effect.gen(function* () {
						yield* Effect.logError(`validateBuilds failed: ${String(e)}`);
						return { success: false, errors: String(e), checkId: 0 };
					}),
				),
			);
			// Steps 3-5 — publish / release-notes / SBOM validation.
			// These remain imperative for now; dynamic import keeps their
			// @actions/* dependencies out of the static module graph so the
			// main bundle stays clear of undici.
			const publishCheckId = 0;
			let publishSummary = "";
			let publishReadyTargets = 0;
			let publishTotalTargets = 0;
			let publishOk = true;
			let npmReady = false;
			let githubPackagesReady = false;
			let hasVersionOnlyPackages = false;
			// Per-package publish validations — fed to the release-notes and SBOM
			// preview steps so they reflect the packages actually being released.
			let publishValidations: PackagePublishValidation[] = [];

			if (buildResult.success) {
				yield* Effect.logInfo("Step 3: Validate Publishing");
				const result = yield* Effect.tryPromise({
					try: async () => {
						const mod = await import("./utils/validate-publish.js");
						return await mod.validatePublish(packageManager, targetBranch, dryRun, process.cwd());
					},
					catch: (error) => (error instanceof Error ? error : new Error(String(error))),
				}).pipe(
					Effect.catchAll((e) =>
						Effect.gen(function* () {
							const message = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
							yield* Effect.logWarning(`validatePublish failed: ${message}`);
							return null;
						}),
					),
				);
				if (result !== null) {
					publishSummary = result.summary;
					publishReadyTargets = result.readyTargets;
					publishTotalTargets = result.totalTargets;
					publishOk = result.success;
					npmReady = result.npmReady;
					githubPackagesReady = result.githubPackagesReady;
					publishValidations = result.validations;
					hasVersionOnlyPackages =
						result.totalTargets === 0 &&
						result.validations.length > 0 &&
						result.validations.some((v) => !v.discoveryError);
				}
			} else {
				yield* Effect.logWarning("Builds failed, skipping publish validation");
			}

			yield* Effect.logInfo("Step 4: Generate Release Notes Preview");
			const releaseNotesResult = yield* Effect.tryPromise({
				try: async () => {
					const mod = await import("./utils/generate-release-notes-preview.js");
					return await mod.generateReleaseNotesPreview(packageManager, publishValidations);
				},
				catch: (error) => (error instanceof Error ? error : new Error(String(error))),
			}).pipe(
				Effect.catchAll((e) =>
					Effect.gen(function* () {
						const message = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
						yield* Effect.logWarning(`generateReleaseNotesPreview failed: ${message}`);
						return { packages: [] as Array<{ name: string; version: string }>, summaryContent: "" };
					}),
				),
			);

			yield* Effect.logInfo("Step 5: Generate SBOM Preview");
			const sbomResult = yield* Effect.tryPromise({
				try: async () => {
					const mod = await import("./utils/generate-sbom-preview.js");
					return await mod.generateSBOMPreview(packageManager, publishValidations, process.cwd());
				},
				catch: (error) => (error instanceof Error ? error : new Error(String(error))),
			}).pipe(
				Effect.catchAll((e) =>
					Effect.gen(function* () {
						const message = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
						yield* Effect.logWarning(`generateSBOMPreview failed: ${message}`);
						return {
							success: true,
							checkTitle: "SBOM Preview skipped",
							summaryContent: "",
							hasComplianceWarnings: false,
							complianceSummary: "",
						};
					}),
				),
			);

			// Step 6 — unified validation check (migrated).
			yield* Effect.logInfo("Step 6: Create Unified Validation Check");
			const checkResults = [
				{
					name: "Link Issues from Commits",
					success: true,
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
					success: buildResult.success && publishOk,
					checkId: publishCheckId,
					message:
						publishTotalTargets === 0 ? "No targets" : `${publishReadyTargets}/${publishTotalTargets} target(s) ready`,
				},
				{
					name: "Release Notes Preview",
					success: true,
					checkId: 0,
					message: `${releaseNotesResult.packages.length} package(s) ready`,
				},
				{
					name: "SBOM Preview",
					success: sbomResult.success,
					checkId: 0,
					message: sbomResult.checkTitle,
				},
			];
			const unified = yield* createValidationCheck(checkResults, dryRun);
			const checkRunUrl = unified.checkId > 0 ? `https://github.com/${repository}/runs/${unified.checkId}` : null;
			const checkRunResult: { url: string; conclusion: string } | null =
				checkRunUrl !== null ? { url: checkRunUrl, conclusion: unified.success ? "success" : "failure" } : null;

			// Step 7 — sticky comment on the release PR (migrated).
			yield* Effect.logInfo("Step 7: Update Sticky Comment");
			const prsResult = yield* Effect.either(
				client.rest<ReadonlyArray<{ number: number }>>("pulls.list.validation", (octokit) =>
					(
						octokit as {
							rest: {
								pulls: {
									list: (params: {
										owner: string;
										repo: string;
										state: "open";
										head: string;
										base: string;
									}) => Promise<{ data: ReadonlyArray<{ number: number }> }>;
								};
							};
						}
					).rest.pulls.list({
						owner,
						repo,
						state: "open",
						head: `${owner}:${releaseBranch}`,
						base: targetBranch,
					}),
				),
			);
			if (prsResult._tag === "Right" && prsResult.right.length > 0) {
				const pr = prsResult.right[0];
				const failedChecks = checkResults.filter((r) => !r.success);
				const allSuccess = failedChecks.length === 0;
				const validationTable = summaryWriter.table(
					[" ", "Check", "Outcome"],
					checkResults.map((r) => [r.success ? "✅" : "❌", r.name, r.message ?? ""]),
				);
				const commentSections: Array<{ heading?: string; level?: 2 | 3 | 4; content: string }> = [
					{
						heading: `📦 Release Validation ${allSuccess ? "✅" : "❌"}`,
						level: 2,
						content: dryRun ? "> 🧪 **DRY RUN MODE** - No actual publishing will occur" : "",
					},
					{ content: validationTable },
				];
				if (failedChecks.length > 0) {
					commentSections.push({
						heading: "❌ Failed Checks",
						level: 3,
						content: `${summaryWriter.list(failedChecks.map((c) => `**${c.name}**`))}\n\nPlease resolve the issues above before merging.`,
					});
				}
				if (publishSummary !== "") {
					commentSections.push({ content: publishSummary });
				}
				if (hasVersionOnlyPackages) {
					commentSections.push({
						heading: "🏷️ Version-Only Packages",
						level: 3,
						content: "These packages will receive GitHub releases only. No registry publishing will occur.",
					});
				}
				commentSections.push({ content: `---\n\n<sub>Updated at ${new Date().toISOString()}</sub>` });
				const commentBody = summaryWriter.build(commentSections);
				yield* updateStickyComment(pr.number, commentBody, "release-validation").pipe(
					Effect.catchAll((e) =>
						Effect.gen(function* () {
							yield* Effect.logWarning(`Failed to update sticky comment: ${String(e)}`);
							return { commentId: 0 };
						}),
					),
				);
			} else {
				yield* Effect.logWarning("No open PR found for release branch - skipping sticky comment update");
			}

			// Emit structured result output for Phase 2.
			const validationOutput = toValidationOutput({
				buildsPassed: buildResult.success,
				packageCount: releaseNotesResult.packages.length,
				npmReady,
				githubPackagesReady,
				publishOk,
				// Per-package ready mirrors the aggregate publishOk — per-package validation detail is not threaded out of the publish dry-run step.
				packages: releaseNotesResult.packages.map((p) => ({ name: p.name, version: p.version, ready: publishOk })),
				checkRun: checkRunResult,
				dryRun,
			});
			yield* emitReleaseOutput(outputs, validationOutput, {
				packageCount: releaseNotesResult.packages.length,
				// Phase 2 runs on a push to the release branch; the release PR number is not
				// in the event payload and resolving it would need an extra API lookup, so
				// the release-pr-number scalar is left empty for the validation phase.
				releasePrNumber: null,
			});
		}).pipe(
			Effect.catchAll((e) =>
				Effect.gen(function* () {
					yield* Effect.logError(`Phase 2 failed: ${String(e)}`);
					yield* cleanupValidationChecks([], `Phase 2 failed: ${String(e)}`, dryRun).pipe(
						Effect.catchAll(() => Effect.succeed({ cleanedUp: 0, failed: 0, errors: [] })),
					);
					return yield* Effect.fail(e);
				}),
			),
		),
	);
});

/**
 * Phase 3 publishing orchestrator. Like {@link runValidation}, defers
 * the heavy publish/tag/release work to the existing imperative helpers
 * via dynamic import — they go through the _actions-compat shim so
 * their @actions/* graph stays out of the static bundle.
 */
const runPublishing = (mergedReleasePRNumber: number | undefined) =>
	Effect.gen(function* () {
		const logger = yield* ActionLogger;
		const outputs = yield* ActionOutputs;
		const runner = yield* CommandRunner;

		const targetBranch = yield* Config.string("target-branch").pipe(Config.withDefault("main"));
		const dryRun = yield* Config.boolean("dry-run").pipe(Config.withDefault(false));
		const packageManager = yield* detectPackageManager;

		// The package-detection helpers need the App installation token; read
		// it straight from the persisted state rather than any env var.
		const installationToken = yield* GitHubToken.read();
		const token = installationToken.token;

		yield* logger.group(
			"Phase 3: Release Publishing",
			Effect.gen(function* () {
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

				yield* Effect.logInfo(`Detected package manager: ${packageManager}`);

				const shallow = yield* runner
					.execCapture("git", ["rev-parse", "--is-shallow-repository"])
					.pipe(Effect.catchAll(() => Effect.succeed({ stdout: "false\n", stderr: "", exitCode: 0 })));
				if (shallow.stdout.trim() === "true") {
					yield* Effect.either(runner.exec("git", ["fetch", "--unshallow", "origin"]));
				}
				yield* Effect.either(runner.exec("git", ["fetch", "origin", `${targetBranch}:${targetBranch}`]));

				yield* Effect.logInfo("Step 1: Detect released packages");
				interface PreDetected {
					readonly name: string;
					readonly version: string;
					readonly path: string;
				}
				let preDetectedReleases: PreDetected[] | undefined;
				if (mergedReleasePRNumber !== undefined) {
					const detection = yield* Effect.tryPromise({
						try: async () => {
							const mod = await import("./utils/detect-released-packages.js");
							return await mod.detectReleasedPackagesFromPR(token, mergedReleasePRNumber);
						},
						catch: (error) => (error instanceof Error ? error : new Error(String(error))),
					}).pipe(
						Effect.catchAll((e) =>
							Effect.gen(function* () {
								yield* Effect.logWarning(`detectReleasedPackagesFromPR failed: ${String(e)}`);
								return null;
							}),
						),
					);
					if (detection?.success === true && detection.packages.length > 0) {
						preDetectedReleases = detection.packages.map(
							(p): PreDetected => ({ name: p.name, version: p.version, path: p.path }),
						);
						yield* Effect.logInfo(`Detected ${preDetectedReleases.length} package(s) from PR`);
					}
				}
				if (preDetectedReleases === undefined || preDetectedReleases.length === 0) {
					const detection = yield* Effect.tryPromise({
						try: async () => {
							const mod = await import("./utils/detect-released-packages.js");
							return await mod.detectReleasedPackagesFromCommit(token);
						},
						catch: (error) => (error instanceof Error ? error : new Error(String(error))),
					}).pipe(
						Effect.catchAll((e) =>
							Effect.gen(function* () {
								yield* Effect.logWarning(`detectReleasedPackagesFromCommit failed: ${String(e)}`);
								return null;
							}),
						),
					);
					if (detection?.success === true && detection.packages.length > 0) {
						preDetectedReleases = detection.packages.map(
							(p): PreDetected => ({ name: p.name, version: p.version, path: p.path }),
						);
						yield* Effect.logInfo(`Detected ${preDetectedReleases.length} package(s) from commit`);
					}
				}

				yield* Effect.logInfo("Step 2: Publish packages");
				const publishResult = yield* Effect.tryPromise({
					try: async () => {
						const mod = await import("./utils/publish-packages.js");
						return await mod.publishPackages(packageManager, targetBranch, dryRun, preDetectedReleases);
					},
					catch: (error) => (error instanceof Error ? error : new Error(String(error))),
				}).pipe(
					Effect.catchAll((e) =>
						Effect.gen(function* () {
							const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
							yield* Effect.logError(`publishPackages failed: ${msg}`);
							return null;
						}),
					),
				);
				if (publishResult === null) {
					// No PublishPackagesResult to project — consumers fall back to step status here.
					yield* outputs.setFailed("Phase 3 failed during publish");
					return;
				}

				if (!publishResult.success) {
					yield* Effect.logError("Publishing failed, skipping tags and releases");
					yield* emitPublishing(publishResult, [], [], {});
					yield* outputs.setFailed("Publishing failed");
					return;
				}

				yield* Effect.logInfo("Step 3: Determine tag strategy");
				const tagPlan = yield* Effect.tryPromise({
					try: async () => {
						const [tagMod, csMod] = await Promise.all([
							import("./utils/determine-tag-strategy.js"),
							import("./utils/get-changeset-status.js"),
						]);
						const tagStrategy = tagMod.determineTagStrategy(publishResult.packages);
						const cs = await csMod.getChangesetStatus(packageManager, targetBranch);
						const bumpTypes = new Map<string, string>();
						for (const r of cs.releases) bumpTypes.set(r.name, r.type);
						const releaseType = tagMod.determineReleaseType(publishResult.packages, bumpTypes);
						return { tagStrategy, releaseType };
					},
					catch: (error) => (error instanceof Error ? error : new Error(String(error))),
				}).pipe(
					Effect.catchAll((e) =>
						Effect.gen(function* () {
							yield* Effect.logWarning(`Tag strategy step failed: ${String(e)}`);
							return null;
						}),
					),
				);
				if (tagPlan === null) {
					yield* emitPublishing(publishResult, [], [], {});
					yield* outputs.setFailed("Phase 3 failed during tag strategy");
					return;
				}

				yield* Effect.logInfo("Step 4: Create GitHub releases");
				const releasesResult = yield* Effect.tryPromise({
					try: async () => {
						const mod = await import("./utils/create-github-releases.js");
						return await mod.createGitHubReleases(
							tagPlan.tagStrategy.tags,
							publishResult.packages,
							packageManager,
							dryRun,
						);
					},
					catch: (error) => (error instanceof Error ? error : new Error(String(error))),
				}).pipe(
					Effect.catchAll((e) =>
						Effect.gen(function* () {
							yield* Effect.logWarning(`createGitHubReleases failed: ${String(e)}`);
							return { success: false, releases: [] as ReleaseInfo[], errors: [String(e)] };
						}),
					),
				);
				if (mergedReleasePRNumber !== undefined) {
					yield* Effect.logInfo("Step 5: Close linked issues");
					yield* closeLinkedIssues(mergedReleasePRNumber, dryRun).pipe(
						Effect.catchAll((e) =>
							Effect.gen(function* () {
								yield* Effect.logWarning(`closeLinkedIssues failed: ${String(e)}`);
								return undefined;
							}),
						),
					);
				}

				const tagShas: Record<string, string> = {};
				for (const tag of tagPlan.tagStrategy.tags) {
					const rev = yield* runner
						.execCapture("git", ["rev-parse", tag.name])
						.pipe(Effect.catchAll(() => Effect.succeed({ stdout: "", stderr: "", exitCode: 1 })));
					tagShas[tag.name] = rev.stdout.trim();
				}
				yield* emitPublishing(publishResult, tagPlan.tagStrategy.tags, releasesResult.releases, tagShas);

				yield* Effect.logInfo(
					`Phase 3 complete: ${publishResult.successfulPackages}/${publishResult.totalPackages} package(s) published, ${releasesResult.releases.length} release(s) created`,
				);
			}),
		);
	});

/**
 * Read the merged-PR number from the GitHub event payload.
 *
 * @remarks
 * Phase 3a only runs on a `pull_request` event where the release PR was
 * merged. `phaseResult.payload.pull_request.number` was previously read
 * from `@actions/github`'s `context.payload`. With github-action-effects
 * we read the event file ourselves via `ActionEnvironment` + `FileSystem`.
 */
const readEventPullRequestNumber = Effect.gen(function* () {
	const env = yield* ActionEnvironment;
	const fs = yield* FileSystem.FileSystem;

	const pathOpt = yield* env.getOptional("GITHUB_EVENT_PATH");
	if (Option.isNone(pathOpt) || pathOpt.value === "") return Option.none<number>();

	const result = yield* Effect.either(fs.readFileString(pathOpt.value));
	if (result._tag === "Left") return Option.none<number>();

	try {
		const parsed = JSON.parse(result.right) as { pull_request?: { number?: number } };
		const num = parsed.pull_request?.number;
		return typeof num === "number" ? Option.some(num) : Option.none<number>();
	} catch {
		return Option.none<number>();
	}
});

const runCloseIssues = Effect.gen(function* () {
	const logger = yield* ActionLogger;
	const dryRun = yield* Config.boolean("dry-run").pipe(Config.withDefault(false));

	yield* logger.group(
		"Phase 3a: Close Linked Issues",
		Effect.gen(function* () {
			const prNumber = yield* readEventPullRequestNumber;
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
	const state = yield* ActionState;

	// The installation token provisioned by pre.ts is read back here and
	// bridged into the `STATE_token` env var so the dynamically-imported
	// imperative helpers (publish validation, SBOM preview, release-notes
	// preview) can read it via the `_actions-compat` `getState("token")`
	// shim. `process.env.GITHUB_TOKEN` is intentionally never set.
	const installationToken = yield* GitHubToken.read();
	process.env.STATE_token = installationToken.token;

	// Bridge the optional workflow-issued `github-token` (saved by pre.ts as
	// `githubPackagesToken`) into the legacy `STATE_githubToken` env var so
	// `registry-auth.setupRegistryAuth` can prefer it for GitHub Packages
	// publishing. Without this bridge, registry-auth's
	// `getState("githubToken")` reads empty and falls back to the App
	// installation token — which may not carry org-level `packages:read`
	// even when the workflow's `secrets.GITHUB_TOKEN` does.
	const pkgToken = yield* state.getOptional(STATE_KEYS.githubPackagesToken, GithubPackagesTokenState);
	if (Option.isSome(pkgToken)) {
		process.env.STATE_githubToken = pkgToken.value.token;
	}

	// Identity diagnostics — the App identity resolved by `provision`.
	if (installationToken.appName !== undefined || installationToken.appSlug !== undefined) {
		yield* Effect.logInfo(`Using GitHub App token (${installationToken.appName ?? installationToken.appSlug})`);
	}

	// Routing.
	const releaseBranch = yield* Config.string("release-branch").pipe(Config.withDefault("changeset-release/main"));
	const targetBranch = yield* Config.string("target-branch").pipe(Config.withDefault("main"));
	const explicitInput = yield* Config.string("phase").pipe(Config.withDefault(""));
	const explicitPhase = explicitInput !== "" ? (explicitInput as WorkflowPhase) : undefined;

	const phaseResult = yield* detectWorkflowPhase({
		releaseBranch,
		targetBranch,
		...(explicitPhase !== undefined && { explicitPhase }),
	});

	yield* Effect.logInfo(`Phase: ${phaseResult.phase} — ${phaseResult.reason}`);

	switch (phaseResult.phase) {
		case "branch-management":
			yield* runBranchManagement;
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
 * The composite domain layer for the main action. `Action.run` injects
 * `ActionLogger`, `ActionOutputs`, `ActionEnvironment`, `ActionState`, and
 * `ActionsConfigProvider`; everything else is wired here.
 *
 * The main action's `GitHubClient` is built from the App installation token
 * that `pre.ts` persisted to `ActionState`, via the library-native
 * `GitHubToken.client()` layer — no `process.env.GITHUB_TOKEN` involved.
 * `GitHubToken.client()` needs `ActionState`; `Action.run`'s `layer` option
 * requires a self-contained layer, so `ActionStateLive` (backed by
 * `NodeFileSystem`) is provided here. `Layer.orDie` turns a missing or
 * unreadable token into a fatal defect rather than a partial boot.
 */
const actionStateLayer = ActionStateLive.pipe(Layer.provide(NodeFileSystem.layer));
const githubClient = GitHubToken.client().pipe(Layer.provide(actionStateLayer), Layer.orDie);
const githubGraphQL = GitHubGraphQLLive.pipe(Layer.provide(githubClient));
const githubApiBase = Layer.merge(githubClient, githubGraphQL);

export const MainLive = Layer.mergeAll(
	githubClient,
	githubGraphQL,
	CheckRunLive.pipe(Layer.provide(githubClient)),
	PullRequestLive.pipe(Layer.provide(githubApiBase)),
	PullRequestCommentLive.pipe(Layer.provide(githubClient)),
	GitHubIssueLive.pipe(Layer.provide(githubApiBase)),
	GitHubReleaseLive.pipe(Layer.provide(githubClient)),
	GitTagLive.pipe(Layer.provide(githubClient)),
	GitBranchLive.pipe(Layer.provide(githubClient)),
	GitCommitLive.pipe(Layer.provide(githubClient)),
	CommandRunnerLive,
	NodeFileSystem.layer,
);

/* v8 ignore next 3 -- entry-point guard, only runs in GitHub Actions */
if (process.env.GITHUB_ACTIONS) {
	await Action.run(main, { layer: MainLive });
}
