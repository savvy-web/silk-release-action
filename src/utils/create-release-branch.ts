/**
 * Phase 1 stage: cut the release branch, run changeset version, commit the
 * version bump via the Git Data API, link the branch to closed issues from
 * the release, and open the release PR.
 *
 * @remarks
 * The commit is created through {@link GitCommit} so it is signed by the
 * GitHub App identity. Branch-linking goes through
 * `GitBranch.createLinked` — the one operation with no REST equivalent —
 * because that preserves the issue↔branch link the imperative version
 * established. PR creation is retried once on failure (network blip).
 */

// `ActionState` is the KIT tag: this module never yields it directly, but
// `resolveSignoff` requires it, and `R` propagates upward.
import type { CommandFailedError, CommandOutputError, ToolDiscovery } from "@effected/commands";
import type { GitCommandError, NotARepositoryError, UnknownRefError } from "@effected/git";
import { Git, StatusEntry } from "@effected/git";
import type { GitHubCommit, GitHubError, GitHubIssue, GitTag, Repo } from "@effected/github";
import { CheckRun, CheckRunOutput, GitBranch, GitCommit, GitHubRepository, PullRequest } from "@effected/github";
import type {
	ActionEnvironmentError,
	ActionOutputError,
	ActionState,
	ActionStateError,
	GitHubTokenError,
} from "@effected/github-actions";
import { ActionEnvironment, ActionOutputs, DryRun } from "@effected/github-actions";
import type { PublishabilityDetector } from "@effected/workspaces";
import { WorkspaceDiscovery } from "@effected/workspaces";
import type { Changesets } from "@savvy-web/silk-effects";
import type { Config } from "effect";
import { Effect, FileSystem } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { ChangesetConfig } from "../release/changeset-config.js";
import type { BranchRefs } from "../schema/inputs.js";
import { applyAutoMerge } from "./auto-merge.js";
import { resolveSignoff } from "./commit-signoff.js";
import { isSinglePackage } from "./detect-repo-type.js";
import { isMonorepoForTagging } from "./determine-tag-strategy.js";
import { formatWorkspaceWithBiome } from "./format-workspace.js";
import type { LinkedIssue } from "./link-issues-from-commits.js";
import { getLinkedIssuesFromCommits } from "./link-issues-from-commits.js";
import { runNativeVersion } from "./native-version.js";
import type { FileReadError } from "./porcelain-changes.js";
import { collectPorcelainChanges } from "./porcelain-changes.js";
import { buildManagedPrBody } from "./pr-body.js";
import {
	NOTHING_TO_RELEASE_TITLE,
	formatReleasePackageList,
	getReleasingPackages,
	listPublishablePackages,
	resolveReleasePrTitle,
} from "./release-summary-helpers.js";
import { summaryWriter } from "./summary-writer.js";

/** Public result returned to the orchestrator. */
export interface CreateReleaseBranchResult {
	created: boolean;
	prNumber: number | null;
	checkId: number;
	versionSummary: string;
}

/**
 * Run the `createReleaseBranch` stage.
 *
 * @public
 */
export const createReleaseBranch = (
	refs: BranchRefs,
): Effect.Effect<
	CreateReleaseBranchResult,
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
	| UnknownRefError,
	| ActionEnvironment
	| ActionOutputs
	| DryRun
	| ActionState
	| ChangesetConfig
	| Changesets.ConfigInspector
	| Changesets.ReleasePlanner
	| CheckRun
	| ChildProcessSpawner.ChildProcessSpawner
	| ToolDiscovery
	| FileSystem.FileSystem
	| Git
	| GitBranch
	| GitCommit
	| GitHubCommit
	| GitHubIssue
	| GitHubRepository
	| GitTag
	| PublishabilityDetector
	| PullRequest
	| Repo
	| WorkspaceDiscovery
> =>
	Effect.gen(function* () {
		const env = yield* ActionEnvironment;
		const outputs = yield* ActionOutputs;
		const checks = yield* CheckRun;
		const git = yield* Git;
		const branches = yield* GitBranch;
		const gitCommit = yield* GitCommit;
		const repository_ = yield* GitHubRepository;
		const pr = yield* PullRequest;
		const fs = yield* FileSystem.FileSystem;
		const signoff = yield* resolveSignoff();

		// Branch names arrive from the ONE decode in `readInputs`; the rehearsal
		// decision comes from the `DryRun` service. Neither is re-read here — this
		// module used to restate both defaults, and a drift between its copy and
		// main's would silently target a different branch than the phase reported.
		//
		// `refs`, not `branches`: `branches` is the `GitBranch` SERVICE in this
		// module, and shadowing it here compiles into a very confusing error.
		const { releaseBranch, targetBranch } = refs;
		const dryRun = yield* (yield* DryRun).isDryRun;

		const { sha, repository } = yield* env.github;

		yield* Effect.logInfo(`Creating branch '${releaseBranch}' from '${targetBranch}' HEAD`);
		if (!dryRun) {
			// `checkout: true` is `git checkout -b <name> <start-point>`. No
			// `force` here, deliberately: this stage creates a branch that must not
			// already exist, so a collision is a real failure and stays one.
			yield* git.branchCreate(process.cwd(), releaseBranch, {
				startPoint: `origin/${targetBranch}`,
				checkout: true,
			});
		} else {
			yield* Effect.logInfo(`[DRY RUN] Would create branch: ${releaseBranch} from origin/${targetBranch}`);
		}

		yield* Effect.logInfo("Applying pending changesets natively");
		if (!dryRun) {
			const appliedRelease = yield* runNativeVersion(process.cwd());
			for (const release of appliedRelease.releases) {
				yield* Effect.logInfo(
					`Released ${release.name}: ${release.oldVersion} -> ${release.newVersion} (${release.type})`,
				);
			}
			yield* formatWorkspaceWithBiome();
		} else {
			yield* Effect.logInfo("[DRY RUN] Would natively apply pending changesets");
		}

		let changedFiles = "";
		let hasChanges = false;
		if (!dryRun) {
			// `Git.status`, not a raw `git status --porcelain`. The property that
			// mattered about the raw form is preserved: a non-zero exit is a TYPED
			// FAILURE (`GitCommandError`/`NotARepositoryError`), never an empty
			// listing — a silently-empty status here takes the "nothing to release"
			// branch below. The text the three downstream consumers want is rendered
			// back from the entries by `StatusEntry.format`, which defaults to a
			// rename's NEW path only — the convention all three consumers want.
			const entries = yield* git.status(process.cwd());
			changedFiles = StatusEntry.format(entries);
			hasChanges = changedFiles.trim().length > 0;
		} else {
			hasChanges = true;
			yield* Effect.logInfo("[DRY RUN] Assuming changes exist for version bump");
		}

		if (!hasChanges) {
			yield* Effect.logInfo("No changes generated by changeset version. Cleaning up and exiting.");
			if (!dryRun) {
				// Asymmetric with `update-release-branch`, deliberately: this stage
				// created the branch locally and never pushed it, so cleanup is local.
				yield* git.checkout(process.cwd(), targetBranch);
				// `force: true` is `branch -D`: this branch carries the version commit
				// being abandoned, so it is not fully merged and the default `-d`
				// would refuse it. Safe because the `checkout` above moved off it —
				// `branch -D` refuses to delete the currently checked-out branch.
				yield* git.branchDelete(process.cwd(), releaseBranch, { force: true });
			}

			const checkTitle = dryRun ? "🧪 Create Release Branch (Dry Run)" : "Create Release Branch";
			const { id: noChangesId } = yield* checks.create(checkTitle, sha);
			yield* checks.complete(
				noChangesId,
				"neutral",
				CheckRunOutput.make({
					title: "No version changes generated",
					summary: "Changeset version command did not produce any changes. No release branch created.",
				}),
			);

			const noChangesSummary = summaryWriter.build([
				{ heading: checkTitle, content: "No version changes generated" },
				{ content: "Changeset version command did not produce any changes. No release branch created." },
			]);
			yield* outputs.summary(noChangesSummary);

			return { created: false, prNumber: null, checkId: noChangesId, versionSummary: "No changes" };
		}

		const versionSummary = changedFiles
			.split("\n")
			.filter((line) => line.includes("package.json") || line.includes("CHANGELOG.md"))
			.join("\n");
		yield* Effect.logInfo("Version changes:");
		yield* Effect.logInfo(versionSummary);

		// `changeset version` just rewrote package.json on disk. WorkspaceDiscovery
		// caches the package list (including versions) per root for the layer's
		// lifetime and may have been populated before the bump, so refresh it
		// before reading versions for the title/commit — otherwise they report the
		// pre-bump version (see workspaces-effect WorkspaceDiscovery.refresh).
		yield* (yield* WorkspaceDiscovery).refresh();

		// Title the release PR from the packages that will release: a single
		// package (or a locked group sharing one version) gets `release:
		// <version>`; an independent multi-package release lists name@version
		// (collapsing to a count when long); a single-package repo with nothing
		// publishable falls back to the root version. Otherwise the prefix.
		const publishablePackages = yield* listPublishablePackages(process.cwd());
		const detectedReleasing = getReleasingPackages(publishablePackages, changedFiles, process.cwd());
		const releasingPackages = detectedReleasing.length > 0 ? detectedReleasing : publishablePackages;
		let singlePackageRepoVersion: string | undefined;
		if (releasingPackages.length === 0 && isSinglePackage()) {
			const readResult = yield* Effect.result(fs.readFileString("package.json"));
			if (readResult._tag === "Success") {
				try {
					singlePackageRepoVersion = (JSON.parse(readResult.success) as { version?: string }).version;
				} catch (error) {
					yield* Effect.logWarning(
						`Failed to read version for PR title: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			} else {
				yield* Effect.logWarning(`Failed to read package.json: ${readResult.failure.message}`);
			}
		}
		const prTitle = resolveReleasePrTitle({
			releasingPackages,
			perPackageVersioning: yield* isMonorepoForTagging(process.cwd()),
			releasablePackages: publishablePackages,
			singlePackageRepoVersion,
		});
		if (prTitle !== NOTHING_TO_RELEASE_TITLE) {
			yield* Effect.logInfo(`Release PR title: ${prTitle}`);
		}

		// Commit subject matches the PR title; body lists the releasing packages
		// with full (scoped) names, falling back to a description when none.
		const releaseList = formatReleasePackageList(releasingPackages);
		const commitBody = releaseList !== "" ? releaseList : "Version bump from changesets";
		const commitMessage = `${prTitle}\n\n${commitBody}\n\n${signoff}`;
		let finalCommitSha = "";
		if (!dryRun) {
			yield* Effect.logInfo("Creating verified commit via GitHub API...");

			// INVARIANT: the commit is rooted on the TARGET branch head. The
			// predecessor read `git rev-parse HEAD` and got the same sha only
			// because the local branch was cut from `origin/<target>` a few lines
			// up; reading the ref makes the invariant explicit and drops a
			// subprocess.
			const parentSha = yield* branches.sha(targetBranch);
			yield* Effect.logInfo(`Target head: ${parentSha}`);

			// `Git.status` runs `--porcelain -z` and hands back PARSED entries, so
			// the NUL splitting, the positional column arithmetic and the trim
			// hazard that forced `Run.collect` over `Run.text` here are all gone —
			// together with the rename defect they hid (see `porcelain-changes.ts`).
			const changes = yield* collectPorcelainChanges(yield* git.status(process.cwd()));

			if (changes.length === 0) {
				yield* Effect.logWarning("No changes to commit via API");
			} else {
				// INVARIANT: `upsert` THEN `commitFiles`. `upsert(branch, sha)` creates
				// the branch at the target head or force-resets it there; that is what
				// replaces the predecessor's `updateRef`-then-`createRef`-on-404 dance,
				// which existed for exactly this brand-new-branch case. `commitFiles`
				// then roots its tree on the branch (== target head, because we just
				// placed it) and its deliberately unforced ref move is safe.
				yield* branches.upsert(releaseBranch, parentSha);
				finalCommitSha = yield* gitCommit.commitFiles({
					branch: releaseBranch,
					message: commitMessage,
					changes,
				});
				yield* Effect.logInfo(`✓ Created verified commit: ${finalCommitSha}`);
			}
		} else {
			yield* Effect.logInfo(`[DRY RUN] Would commit with message: ${commitMessage}`);
		}

		let repoNodeId = "";
		if (!dryRun) {
			yield* Effect.logInfo("Fetching repository node ID...");
			repoNodeId = yield* repository_.nodeId;
			yield* Effect.logInfo(`Repository node ID: ${repoNodeId}`);
		}

		// Hoisted out of the branch-linking block below: the PR body needs the same
		// issues, and scoping them to that block is why the create path had none.
		let linkedIssues: ReadonlyArray<LinkedIssue> = [];

		if (!dryRun && finalCommitSha) {
			yield* Effect.logInfo(`Searching for linked issues from commits on branch: ${targetBranch}`);
			const found = yield* getLinkedIssuesFromCommits(targetBranch, releaseBranch);
			const commits = found.commits;
			linkedIssues = found.linkedIssues;
			yield* Effect.logInfo(`Found ${commits.length} commit(s) to analyze`);

			if (linkedIssues.length > 0) {
				yield* Effect.logInfo(`Found ${linkedIssues.length} issue(s) to link to branch:`);
				for (const issue of linkedIssues) {
					yield* Effect.logInfo(`  - Issue #${issue.number}: ${issue.title} (${issue.node_id})`);
				}
				yield* Effect.logInfo(`Linking branch '${releaseBranch}' at commit ${finalCommitSha} to issues...`);
				for (const issue of linkedIssues) {
					const linkResult = yield* Effect.result(
						branches.createLinked({
							issueNodeId: issue.node_id,
							repositoryNodeId: repoNodeId,
							name: releaseBranch,
							sha: finalCommitSha,
						}),
					);
					if (linkResult._tag === "Success") {
						yield* Effect.logInfo(`  ✓ Linked branch to issue #${issue.number}`);
					} else {
						yield* Effect.logWarning(`  Failed to link issue #${issue.number}: ${linkResult.failure.reason}`);
					}
				}
				yield* Effect.logInfo(`✓ Successfully linked branch to ${linkedIssues.length} issue(s)`);
			} else {
				yield* Effect.logInfo("No issues found to link to branch");
			}
		} else if (!dryRun && !finalCommitSha) {
			yield* Effect.logInfo("No final commit SHA available, skipping branch linking");
		} else {
			yield* Effect.logInfo("[DRY RUN] Would link branch to issues from commits");
		}

		let prNumber: number | null = null;
		let prUrl = "";
		// The bug this replaces: `const prBody = ""`. A first release PR was
		// created with an empty description, so GitHub linked nothing — observed
		// on silk-integration #242 and #232.
		const prBody = buildManagedPrBody({
			subject: prTitle,
			linkedIssues,
			signoff,
			// A PR being created has no prior body, so nothing to carry through.
			summary: "",
		});

		if (!dryRun) {
			yield* Effect.logInfo("Creating PR...");
			yield* Effect.logInfo(`  Repository: ${repository}`);
			yield* Effect.logInfo(`  Base: ${targetBranch}`);
			yield* Effect.logInfo(`  Head: ${releaseBranch}`);
			yield* Effect.logInfo(`  Title: ${prTitle}`);

			// `pr.create` is a NON-IDEMPOTENT write, so the retry cannot simply call
			// it again: if the first attempt reached GitHub and only the response
			// was lost, a blind retry either opens a duplicate release PR or is
			// rejected with 422 — turning a transient blip into a hard failure of
			// the whole stage.
			//
			// So the retry re-lists open PRs on this head first and adopts one if it
			// is there. Only a genuinely absent PR is created again.
			const createOnce = pr.create({ title: prTitle, head: releaseBranch, base: targetBranch, body: prBody });
			const created = yield* createOnce.pipe(
				Effect.catch((error) =>
					Effect.gen(function* () {
						yield* Effect.logWarning(`PR creation failed, retrying: ${error.reason}`);
						const existing = yield* pr
							.list({ state: "open", head: releaseBranch })
							.pipe(Effect.catch(() => Effect.succeed([])));
						const adopted = existing[0];
						if (adopted !== undefined) {
							yield* Effect.logInfo(`✓ First attempt had in fact created PR #${adopted.number}; adopting it`);
							return adopted;
						}
						return yield* createOnce;
					}),
				),
			);

			prNumber = created.number;
			prUrl = created.url;
			yield* Effect.logInfo(`✓ PR created: #${prNumber} (${created.nodeId})`);

			yield* Effect.logInfo(`Adding labels to PR #${prNumber}...`);
			yield* pr.addLabels(prNumber, ["automated", "release"]);
			// `dryRun`, not a literal `false`. This sits inside the `!dryRun` arm so
			// the two agree today, but the literal would defeat `applyAutoMerge`'s
			// own dry-run guard if this block were ever restructured.
			yield* applyAutoMerge(created, dryRun);
			yield* Effect.logInfo(`✓ Created PR #${prNumber}: ${prUrl}`);
		} else {
			yield* Effect.logInfo(`[DRY RUN] Would create PR with title: ${prTitle}`);
			yield* Effect.logInfo(`[DRY RUN] PR body:\n${prBody}`);
		}

		const checkStatusTable = summaryWriter.keyValueTable([
			{ key: "Branch", value: `\`${releaseBranch}\`` },
			{ key: "Target", value: `\`${targetBranch}\`` },
			{ key: "PR", value: prNumber ? `[#${prNumber}](${prUrl})` : "_N/A (dry run)_" },
		]);

		const checkSections: Array<{ heading?: string; level?: 2 | 3; content: string }> = [
			{ heading: "Release Branch Created", content: checkStatusTable },
		];
		if (versionSummary) {
			checkSections.push({
				heading: "Version Changes",
				level: 3,
				content: summaryWriter.codeBlock(versionSummary, "text"),
			});
		}
		const checkDetails = summaryWriter.build(checkSections);

		const checkTitle = dryRun ? "🧪 Create Release Branch (Dry Run)" : "Create Release Branch";
		const { id: finalCheckId } = yield* checks.create(checkTitle, sha);
		yield* checks.complete(
			finalCheckId,
			"success",
			CheckRunOutput.make({
				title: prNumber ? `Created release PR #${prNumber}` : "Release branch created (dry run)",
				summary: checkDetails,
			}),
		);

		const jobStatusTable = summaryWriter.keyValueTable([
			{ key: "Branch", value: `\`${releaseBranch}\`` },
			{ key: "Target", value: `\`${targetBranch}\`` },
			{ key: "PR", value: prNumber ? `#${prNumber}` : "_N/A (dry run)_" },
		]);
		const jobSections: Array<{ heading?: string; level?: 2 | 3; content: string }> = [
			{
				heading: checkTitle,
				content: prNumber ? `Created release PR #${prNumber}` : "Release branch created (dry run)",
			},
			{ heading: "Release Branch Created", level: 3, content: jobStatusTable },
		];
		if (versionSummary) {
			jobSections.push({
				heading: "Version Changes",
				level: 3,
				content: summaryWriter.codeBlock(versionSummary, "text"),
			});
		}
		yield* outputs.summary(summaryWriter.build(jobSections));

		return { created: true, prNumber, checkId: finalCheckId, versionSummary };
	});
