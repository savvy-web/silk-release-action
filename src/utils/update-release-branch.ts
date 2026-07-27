/**
 * Phase 1 stage: keep an existing release branch synced with main.
 *
 * @remarks
 * Strategy: recreate the release branch from main on every push, then
 * re-run `changeset version` on top. If there are version changes, a
 * verified commit is created via {@link GitCommit}; PRs are reopened when
 * a prior force-push closed them, titles are refreshed, and bodies are
 * augmented with a "Linked Issues" section harvested from the changeset
 * commits in the remote target-branch history.
 *
 * If `changeset version` produces no changes the release branch has
 * nothing to release — it would be identical to main, an invalid state.
 * Rather than fail trying to open a PR with no commits, this stage closes
 * any open release PR and deletes the release branch.
 */
// `ActionState` is the KIT tag: this module never yields it directly, but
// `resolveSignoff` requires it, and `R` propagates upward.
import type { CommandFailedError, CommandOutputError, ToolDiscovery } from "@effected/commands";
import { Run } from "@effected/commands";
import type { FileChange, GitHubCommit, GitHubError, GitHubIssue, PullRequestInfo, Repo } from "@effected/github";
import {
	CheckRun,
	CheckRunOutput,
	FileContent,
	FileDeletion,
	GitBranch,
	GitCommit,
	PullRequest,
} from "@effected/github";
import type { ActionEnvironmentError, ActionOutputError, ActionState } from "@effected/github-actions";
import { ActionEnvironment, ActionInput, ActionOutputs } from "@effected/github-actions";
import type { PublishabilityDetector } from "@effected/workspaces";
import { WorkspaceDiscovery } from "@effected/workspaces";
import type { Changesets } from "@savvy-web/silk-effects";
import { Config, Effect, FileSystem, Option } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import { ChildProcess } from "effect/unstable/process";
import type { ChangesetConfig } from "../release/changeset-config.js";
import { applyAutoMerge } from "./auto-merge.js";
import { resolveSignoff } from "./commit-signoff.js";
import { isSinglePackage } from "./detect-repo-type.js";
import { isMonorepoForTagging } from "./determine-tag-strategy.js";
import { formatWorkspaceWithBiome } from "./format-workspace.js";
import { pullRequestUrl, resolveServerUrl } from "./github-urls.js";
import { getLinkedIssuesFromCommits } from "./link-issues-from-commits.js";
import { runNativeVersion } from "./native-version.js";
import type { FileReadError } from "./porcelain-changes.js";
import { collectPorcelainChanges } from "./porcelain-changes.js";
import { buildManagedPrBody, extractSummary, upsertManagedRegion } from "./pr-body.js";
import {
	NOTHING_TO_RELEASE_TITLE,
	formatReleasePackageList,
	getReleasingPackages,
	listPublishablePackages,
	resolveReleasePrTitle,
} from "./release-summary-helpers.js";
import { summaryWriter } from "./summary-writer.js";

/**
 * An issue linked to the release via a changeset commit.
 *
 * @public
 */
export interface LinkedIssue {
	number: number;
	title: string;
	state: string;
	url: string;
	commits: string[];
	nodeId?: string;
}

/**
 * Result of the {@link updateReleaseBranch} stage.
 *
 * @public
 */
export interface UpdateReleaseBranchResult {
	success: boolean;
	hadConflicts: boolean;
	/**
	 * True when this run found nothing to release and therefore closed any
	 * release PR and deleted the release branch. See {@link updateReleaseBranch}.
	 */
	deleted: boolean;
	prNumber: number | null;
	checkId: number;
	versionSummary: string;
	linkedIssues: LinkedIssue[];
}

/**
 * Run the `updateReleaseBranch` stage.
 *
 * @public
 */
export const updateReleaseBranch = (): Effect.Effect<
	UpdateReleaseBranchResult,
	| ActionEnvironmentError
	| ActionOutputError
	| Changesets.ConfigurationError
	| Changesets.ReleasePlanError
	| CommandFailedError
	| CommandOutputError
	| Config.ConfigError
	| FileReadError
	| GitHubError,
	| ActionEnvironment
	| ActionOutputs
	| ActionState
	| ChangesetConfig
	| Changesets.ConfigInspector
	| Changesets.ReleasePlanner
	| CheckRun
	| ChildProcessSpawner.ChildProcessSpawner
	| ToolDiscovery
	| FileSystem.FileSystem
	| GitBranch
	| GitCommit
	| GitHubCommit
	| GitHubIssue
	| PublishabilityDetector
	| PullRequest
	| Repo
	| WorkspaceDiscovery
> =>
	Effect.gen(function* () {
		const env = yield* ActionEnvironment;
		const outputs = yield* ActionOutputs;
		const checks = yield* CheckRun;
		const gitCommit = yield* GitCommit;
		const branches = yield* GitBranch;
		const pr = yield* PullRequest;
		const fs = yield* FileSystem.FileSystem;
		const signoff = yield* resolveSignoff();

		const releaseBranch = yield* ActionInput.string("release-branch").pipe(
			Config.withDefault("changeset-release/main"),
		);
		const targetBranch = yield* ActionInput.string("target-branch").pipe(Config.withDefault("main"));
		const dryRun = yield* ActionInput.boolean("dry-run").pipe(Config.withDefault(false));

		const { sha, repository } = yield* env.github;
		const [owner, repo] = repository.split("/");
		// GHES. `getOptional` rather than `env.github.serverUrl`: absence has a
		// correct default rather than being a failure, and only GHES sets it.
		// Matches `attest-helpers.ts` and the PR-URL fix in `main.ts`.
		const serverUrl = yield* resolveServerUrl();

		// ---------- Find existing PR (open, or closed-not-merged) ----------
		let prNumber: number | null = null;
		let prWasClosed = false;

		const openPrs = yield* Effect.result(
			pr.list({ state: "open", head: `${owner}:${releaseBranch}`, base: targetBranch }),
		);

		if (openPrs._tag === "Success" && openPrs.success.length > 0) {
			prNumber = openPrs.success[0].number;
		} else if (openPrs._tag === "Failure") {
			yield* Effect.logWarning(`Could not list open PRs: ${openPrs.failure.reason}`);
		} else {
			const closedPrs = yield* Effect.result(
				pr.list({ state: "closed", head: `${owner}:${releaseBranch}`, base: targetBranch }),
			);
			if (closedPrs._tag === "Success") {
				// LANDMINE: `mergedAt` is an `Option<DateTime>` on the kit's shape, NOT
				// `string | null`. The old `(p.mergedAt ?? null) === null` compiles
				// UNCHANGED against an Option and is ALWAYS FALSE — `Option.none()` is an
				// object, so `??` never fires — which would mean `unmerged` is never
				// found and a closed-but-unmerged release PR is never reopened.
				const unmerged = closedPrs.success.find((p) => Option.isNone(p.mergedAt));
				if (unmerged) {
					prNumber = unmerged.number;
					prWasClosed = true;
					yield* Effect.logInfo(`Found closed (unmerged) PR #${prNumber} - will reopen after branch update`);
				}
			} else {
				yield* Effect.logWarning(`Could not list closed PRs: ${closedPrs.failure.reason}`);
			}
		}

		// ---------- Collect linked issues BEFORE the version command ----------
		//
		// The same walk the create path uses, deliberately: every commit between
		// the last release and the target branch, taking close keywords from the
		// commit bodies and `closingIssuesReferences` from each merge commit's PR.
		//
		// This replaces a scan scoped to *changeset* commits — for each pending
		// changeset file, the commit that added it. That scope silently lost two
		// things. A pull request whose issue was attached by hand in the sidebar
		// contributed nothing unless the same commit also added a changeset, and a
		// squash merge whose message dropped the closing reference could not be
		// recovered from its merge point. Both are exactly what the merge-commit
		// half of this walk is for.
		//
		// It also ended the disagreement between the two paths: the Phase-2 check
		// counted issues this way while the PR body counted them the other, so one
		// release PR could report four linked issues in its check and two in its
		// description.
		yield* Effect.logInfo("Collecting linked issues from commits since the last release");
		let linkedIssues: LinkedIssue[] = [];
		if (!dryRun) {
			const found = yield* getLinkedIssuesFromCommits(targetBranch, releaseBranch);
			linkedIssues = found.linkedIssues.map((issue) => ({
				number: issue.number,
				title: issue.title,
				state: issue.state,
				url: issue.url,
				commits: issue.commits,
				nodeId: issue.node_id,
			}));
		} else {
			yield* Effect.logInfo("[DRY RUN] Would collect linked issues from commits");
		}

		// ---------- Recreate the release branch from main locally ----------
		yield* Effect.logInfo(`Recreating release branch '${releaseBranch}' from '${targetBranch}'`);
		if (!dryRun) {
			// The start point is EXPLICIT. `checkout -b <branch>` with no start point
			// branches from ambient HEAD, which this module never establishes — the
			// log line above claimed "from '<target>'" while the command said no such
			// thing. `create-release-branch.ts` always passed one; this did not.
			//
			// Why it matters beyond tidiness: branching from the wrong point discards
			// the release branch's prior commits, so the push that follows is a
			// NON-DESCENDANT ref update. GitHub records that as
			// `head_ref_force_pushed` — which is exactly the event on the PR timeline
			// for run 30212579721, and there is no `--force` anywhere in this module.
			yield* Effect.result(Run.text(ChildProcess.make("git", ["branch", "-D", releaseBranch])));
			yield* Run.text(ChildProcess.make("git", ["checkout", "-b", releaseBranch, `origin/${targetBranch}`]));

			// Make the branch point observable. A silent recreate is how a
			// non-descendant update reached GitHub without anything in the log
			// saying what we had branched from.
			const branchedFrom = yield* Effect.result(Run.text(ChildProcess.make("git", ["rev-parse", "HEAD"])));
			if (branchedFrom._tag === "Success") {
				yield* Effect.logInfo(`  '${releaseBranch}' now at ${branchedFrom.success.trim()} (origin/${targetBranch})`);
			}
		} else {
			yield* Effect.logInfo(`[DRY RUN] Would recreate branch: ${releaseBranch} from ${targetBranch}`);
		}

		// ---------- Run changeset version ----------
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

		// ---------- Detect changes ----------
		let hasChanges = false;
		let changedFiles = "";
		if (!dryRun) {
			// `Run.text`, NOT `Run.collect`. `collect` demotes a non-zero exit to a
			// value with empty stdout, which reads here as "no version changes" —
			// and this module's no-change path CLOSES THE RELEASE PR AND DELETES
			// THE REMOTE RELEASE BRANCH, then returns `success: true`. A transient
			// git failure would therefore destroy a live release and report it as
			// a clean run. `text` makes the exit a typed failure.
			//
			// The trim `text` applies is safe for this (non-`-z`) form: all three
			// consumers of `changedFiles` are whitespace-insensitive per line —
			// `.trim().length`, the per-line `.includes(...)` filter, and
			// `getReleasingPackages`, which strips the porcelain status column with
			// `^\s*\S+\s+`. The `-z` read further down is a different matter and
			// must stay `Run.collect`; see the comment there.
			changedFiles = yield* Run.text(ChildProcess.make("git", ["status", "--porcelain"]));
			hasChanges = changedFiles.trim().length > 0;
		} else {
			hasChanges = true;
			yield* Effect.logInfo("[DRY RUN] Assuming changes exist for version bump");
		}

		let versionSummary = "";
		let prTitle = NOTHING_TO_RELEASE_TITLE;
		// When `changeset version` yields nothing the release branch has no
		// commits beyond main: an invalid state. We close any release PR and
		// delete the branch, then skip the reopen/update/create-PR steps below.
		let branchDeleted = false;

		if (hasChanges) {
			versionSummary = changedFiles
				.split("\n")
				.filter((line) => line.includes("package.json") || line.includes("CHANGELOG.md"))
				.join("\n");
			yield* Effect.logInfo("New version changes:");
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
			prTitle = resolveReleasePrTitle({
				releasingPackages,
				perPackageVersioning: yield* isMonorepoForTagging(process.cwd()),
				releasablePackages: publishablePackages,
				singlePackageRepoVersion,
			});
			if (prTitle !== NOTHING_TO_RELEASE_TITLE) {
				yield* Effect.logInfo(`Release PR title: ${prTitle}`);
			}

			if (!dryRun) yield* Run.text(ChildProcess.make("git", ["add", "."]));

			// Commit subject matches the PR title; body lists the releasing packages
			// with full (scoped) names, falling back to a description when none.
			const releaseList = formatReleasePackageList(releasingPackages);
			const commitBody = releaseList !== "" ? releaseList : `Version bump from changesets (rebased on ${targetBranch})`;
			const commitMessage = `${prTitle}\n\n${commitBody}\n\n${signoff}`;
			if (!dryRun) {
				yield* Effect.logInfo("Creating verified commit via GitHub API (rebasing onto main)...");
				yield* commitChangesOntoTarget({
					targetBranch,
					releaseBranch,
					commitMessage,
				});
			} else {
				yield* Effect.logInfo(`[DRY RUN] Would create API commit with message: ${commitMessage}`);
			}
		} else {
			yield* Effect.logInfo(
				`No version changes from changesets — '${releaseBranch}' would be identical to '${targetBranch}', nothing to release`,
			);
			branchDeleted = true;
			if (!dryRun) {
				// Close the release PR (if open) before deleting its branch so the
				// PR records a clean "closed" rather than the auto-close GitHub emits
				// when a head branch disappears. Already-closed PRs are left as-is.
				if (prNumber !== null && !prWasClosed) {
					const closed = yield* Effect.result(pr.update(prNumber, { state: "closed" }));
					if (closed._tag === "Success") {
						yield* Effect.logInfo(`✓ Closed stale release PR #${prNumber} (nothing to release)`);
					} else {
						yield* Effect.logWarning(`Could not close release PR #${prNumber}: ${closed.failure.reason}`);
					}
				} else if (prNumber !== null && prWasClosed) {
					yield* Effect.logInfo(`Release PR #${prNumber} is already closed`);
				}

				// Delete the release branch — it is in an invalid state.
				const deleted = yield* Effect.result(branches.delete(releaseBranch));
				if (deleted._tag === "Success") {
					yield* Effect.logInfo(`✓ Deleted release branch '${releaseBranch}'`);
				} else {
					yield* Effect.logWarning(`Could not delete release branch '${releaseBranch}': ${deleted.failure.reason}`);
				}
			} else {
				yield* Effect.logInfo(
					`[DRY RUN] Would close any open release PR and delete '${releaseBranch}' (nothing to release)`,
				);
			}
			prNumber = null;
		}

		// ---------- Reopen the PR if it is closed NOW ----------
		// A FRESH read, not the `prWasClosed` snapshot taken before the branch was
		// touched. That snapshot can only answer "was it closed when we started",
		// so anything that closes the PR mid-run leaves the guard useless — which
		// is exactly what happened when GitHub auto-closed #243 inside the
		// zero-diff window. That window is gone, but a stale-state guard is a
		// latent defect and the next mid-run closer would find it just as useless.
		//
		// `merged` is checked because a MERGED pull request must never be
		// reopened — reopening one is a different and worse mutation than leaving
		// it closed.
		//
		// Accepted trade, stated: a human who deliberately closes the release PR
		// while a run is in flight will see it reopened. The API cannot
		// distinguish that from a side-effect close, and a closed PR with a live
		// release branch is the invalid state we are here to repair.
		const currentPr =
			!branchDeleted && prNumber !== null && !dryRun ? yield* Effect.result(pr.get(prNumber)) : undefined;
		const isClosedNow = currentPr !== undefined && currentPr._tag === "Success" && currentPr.success.state === "closed";
		const isMerged = currentPr !== undefined && currentPr._tag === "Success" && currentPr.success.merged;

		if (!branchDeleted && prNumber !== null && !dryRun && isClosedNow && !isMerged) {
			if (!prWasClosed) {
				yield* Effect.logWarning(`PR #${prNumber} was open when this run started and is closed now — reopening`);
			}
			const reopen = yield* Effect.result(pr.update(prNumber, { state: "open" }));
			if (reopen._tag === "Success") {
				yield* Effect.logInfo(`✓ Reopened PR #${prNumber}`);
			} else {
				yield* Effect.logWarning(`Could not reopen PR #${prNumber}: ${reopen.failure.reason}`);
				yield* Effect.logInfo("Will create a new PR instead");
				prNumber = null;
			}
		} else if (!branchDeleted && prWasClosed && prNumber !== null && dryRun) {
			yield* Effect.logInfo(`[DRY RUN] Would reopen PR #${prNumber}`);
		}

		// ---------- Update the PR title ----------
		// NOT gated on `!prWasClosed`. A PR we just reopened is being reused, so it
		// needs the current title as much as one that stayed open — under the old
		// guard a reopened release PR kept a title naming an earlier version.
		if (!branchDeleted && prNumber !== null && !dryRun) {
			const update = yield* Effect.result(pr.update(prNumber, { title: prTitle }));
			if (update._tag === "Success") {
				yield* Effect.logInfo(`✓ Updated PR #${prNumber} title to: ${prTitle}`);
			} else {
				yield* Effect.logWarning(`Could not update PR title: ${update.failure.reason}`);
			}
		}

		// ---------- Create new PR if none exists ----------
		if (!branchDeleted && prNumber === null && !dryRun) {
			const prBody = buildManagedPrBody({
				subject: prTitle,
				linkedIssues,
				signoff,
				// A PR being created has no prior body, so nothing to carry through.
				summary: "",
			});
			const create = (): Effect.Effect<PullRequestInfo, GitHubError, Repo> =>
				pr.create({ title: prTitle, body: prBody, head: releaseBranch, base: targetBranch });

			const result = yield* create().pipe(
				Effect.tapError((e) => Effect.logWarning(`PR creation failed, retrying: ${e.reason}`)),
				Effect.retry({ times: 1, schedule: undefined }),
			);
			prNumber = result.number;
			yield* pr.addLabels(prNumber, ["automated", "release"]);
			yield* Effect.logInfo(`✓ Created new release PR #${prNumber}: ${result.url}`);
		} else if (prNumber === null && dryRun) {
			yield* Effect.logInfo("[DRY RUN] Would create new release PR (no existing PR found)");
		}

		// ---------- Auto-merge, when the workflow opted in ----------
		//
		// Applied whether this run created the PR or found an existing one: a
		// workflow that asks for auto-merge wants it on the release PR, and which
		// run happened to open it is an accident of timing. `setAutoMerge` is
		// idempotent, so re-applying on every push costs nothing.
		if (prNumber !== null && !branchDeleted) {
			const info = yield* Effect.result(pr.get(prNumber));
			if (info._tag === "Success") {
				yield* applyAutoMerge(info.success, dryRun);
			} else {
				yield* Effect.logWarning(`Could not read PR #${prNumber} for auto-merge: ${info.failure.reason}`);
			}
		}

		// ---------- Refresh the managed region of the PR body ----------
		// NOT gated on `linkedIssues.length > 0`. The managed region carries the
		// version summary and the proposed-squash-commit block as well as the
		// closing references, so a release with no linked issues still needs it
		// refreshed — under the old guard such a PR kept a body from an earlier
		// run, describing versions that had since moved.
		//
		// This is the reuse-in-place path: an open release PR is updated (title
		// above, body here) and keeps its number, its comments and its review
		// history. It is never closed and recreated.
		if (prNumber !== null && !dryRun) {
			const getPr = yield* Effect.result(pr.get(prNumber));

			if (getPr._tag === "Success") {
				// Regenerate only OUR marker-delimited region; anything a human wrote
				// around it survives verbatim. The heading splice this replaces keyed
				// on `## Linked Issues` and could not tell our text from theirs.
				const existingBody = getPr.success.body ?? "";
				const managed = buildManagedPrBody({
					subject: prTitle,
					linkedIssues,
					signoff,
					// Carried through, not regenerated. The managed region is rebuilt
					// each run, so re-emitting an empty summary region would delete
					// whatever the summariser wrote as soon as any commit landed.
					summary: extractSummary(existingBody),
				});
				const newBody = upsertManagedRegion(existingBody, managed);

				const update = yield* Effect.result(pr.update(prNumber, { body: newBody }));
				if (update._tag === "Success") {
					yield* Effect.logInfo(`✓ Refreshed PR #${prNumber} body (${linkedIssues.length} linked issue(s))`);
				} else {
					yield* Effect.logWarning(`Could not update PR body: ${update.failure.reason}`);
				}
			} else {
				yield* Effect.logWarning(`Could not fetch PR for body update: ${getPr.failure.reason}`);
			}
		}

		// ---------- Check run + job summary ----------
		const strategy = branchDeleted ? "Deleted (nothing to release)" : "Recreate from main";
		const checkStatusTable = summaryWriter.keyValueTable([
			{ key: "Branch", value: `\`${releaseBranch}\`` },
			{ key: "Base", value: `\`${targetBranch}\`` },
			{ key: "Strategy", value: strategy },
			{ key: "Version Changes", value: hasChanges ? "✅ Yes" : "❌ No" },
			{ key: "Linked Issues", value: linkedIssues.length > 0 ? `${linkedIssues.length} issue(s)` : "_None_" },
			{
				key: "PR",
				value: prNumber ? `[#${prNumber}](${pullRequestUrl(serverUrl, owner, repo, prNumber)})` : "_N/A_",
			},
		]);

		const checkSections: Array<{ heading?: string; level?: 2 | 3; content: string }> = [
			{ heading: "Release Branch Updated", content: checkStatusTable },
		];
		if (linkedIssues.length > 0) {
			checkSections.push({
				heading: "Linked Issues",
				level: 3,
				content: summaryWriter.list(
					linkedIssues.map((issue) => `[#${issue.number}](${issue.url}) - ${issue.title} (${issue.state})`),
				),
			});
		}
		if (hasChanges) {
			checkSections.push({
				heading: "Version Changes",
				level: 3,
				content: summaryWriter.codeBlock(versionSummary, "text"),
			});
		}
		const checkDetails = summaryWriter.build(checkSections);

		const checkTitle = dryRun ? "🧪 Update Release Branch (Dry Run)" : "Update Release Branch";
		const checkConclusionTitle = branchDeleted
			? "Release branch deleted (nothing to release)"
			: hasChanges
				? "Release branch recreated from main with version changes"
				: "Release branch synced with main";
		const { id: checkId } = yield* checks.create(checkTitle, sha);
		// `CheckRunOutput` is a `Schema.Class`; an object literal no longer
		// satisfies it. The kit caps the summary itself in `wireOutput`.
		yield* checks.complete(
			checkId,
			branchDeleted ? "neutral" : "success",
			CheckRunOutput.make({ title: checkConclusionTitle, summary: checkDetails }),
		);

		const jobStatusTable = summaryWriter.keyValueTable([
			{ key: "Branch", value: `\`${releaseBranch}\`` },
			{ key: "Base", value: `\`${targetBranch}\`` },
			{ key: "Strategy", value: strategy },
			{ key: "Version Changes", value: hasChanges ? "✅ Yes" : "❌ No" },
			{ key: "Linked Issues", value: linkedIssues.length > 0 ? `${linkedIssues.length} issue(s)` : "_None_" },
			{ key: "PR", value: prNumber ? `#${prNumber}` : "_N/A_" },
		]);
		const jobSections: Array<{ heading?: string; level?: 2 | 3; content: string }> = [
			{
				heading: checkTitle,
				content: branchDeleted
					? `🗑️ Release branch deleted — no changesets to release (would be identical to \`${targetBranch}\`)`
					: hasChanges
						? "✅ Release branch recreated from main with version changes"
						: "✅ Release branch synced with main (no version changes)",
			},
			{ heading: "Update Summary", level: 3, content: jobStatusTable },
		];
		if (linkedIssues.length > 0) {
			jobSections.push({
				heading: "Linked Issues",
				level: 3,
				content: summaryWriter.list(linkedIssues.map((issue) => `#${issue.number} - ${issue.title} (${issue.state})`)),
			});
		}
		if (hasChanges) {
			jobSections.push({
				heading: "Version Changes",
				level: 3,
				content: summaryWriter.codeBlock(versionSummary, "text"),
			});
		}
		yield* outputs.summary(summaryWriter.build(jobSections));

		return {
			success: true,
			hadConflicts: false,
			deleted: branchDeleted,
			prNumber,
			checkId,
			versionSummary,
			linkedIssues,
		};

		/**
		 * Build a rebased commit on top of `targetBranch` for the staged
		 * changes, then update `releaseBranch` to point at it.
		 */
		function commitChangesOntoTarget(args: {
			targetBranch: string;
			releaseBranch: string;
			commitMessage: string;
		}): Effect.Effect<
			void,
			CommandFailedError | CommandOutputError | FileReadError | GitHubError,
			ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | GitBranch | GitCommit | Repo
		> {
			return Effect.gen(function* () {
				// INVARIANT: the commit is rooted on the TARGET branch head, not on
				// the release branch's own head. That is what keeps the release branch
				// a single clean commit on top of `main` rather than an accumulating
				// stack. `GitBranch.sha` replaces a hand-cast `client.rest("git.getRef")`.
				const parentSha = yield* branches.sha(args.targetBranch);

				// `-z` uses NUL separators so the positional [0..2]=status, [3..]=path
				// parsing survives whitespace and trailing CRLF; trimming the line
				// itself would shift the column for unstaged changes (" M file" → "M file").
				const status = yield* Run.collect(ChildProcess.make("git", ["status", "--porcelain", "-z"]));
				const changes = yield* collectPorcelainChanges(status.stdout);

				if (changes.length === 0) {
					yield* Effect.logWarning("No changes to commit via API");
					return;
				}

				// INVARIANT: build the commit FIRST, move the ref ONCE, last.
				//
				// The previous sequence was `upsert(branch, targetHead)` then
				// `commitFiles`. It was correct about rooting but it opened a
				// ZERO-DIFF WINDOW: between the two calls the release branch ref
				// *equals* the target head, so the open release PR's head equals its
				// base — and **GitHub closes a pull request whose head becomes
				// identical to its base**. On run 30212579721 that window was ~3.2s
				// and PR #243 was closed inside it, attributed to whoever force-pushed
				// (us). Our own `pr.update(state: "closed")` never ran; the summary
				// line proved that, which is why the cause took so long to find.
				//
				// `commitFiles` cannot be used at all here: it `GET`s the branch and
				// roots the tree on the BRANCH's commit, and its ref update is
				// deliberately unforced. Both are wrong for a rebase-onto-target.
				//
				// So the three underlying members do it explicitly, and the ref moves
				// exactly once — from wherever it was, straight to the finished
				// commit. The branch is never equal to the target head, so the window
				// does not exist. `parentSha` is still the TARGET head, so the
				// explicit-parent invariant is unchanged.
				const base = yield* gitCommit.get(parentSha);
				const treeSha = yield* gitCommit.createTree({ changes, baseTree: base.treeSha });
				const commitSha = yield* gitCommit.createCommit({
					message: args.commitMessage,
					tree: treeSha,
					parents: [parentSha],
				});
				yield* branches.upsert(args.releaseBranch, commitSha);
				yield* Effect.logInfo(`✓ Created verified commit: ${commitSha}`);
			});
		}
	});
