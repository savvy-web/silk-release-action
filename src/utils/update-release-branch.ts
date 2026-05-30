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

import { FileSystem } from "@effect/platform";
import type {
	ActionEnvironmentError,
	ActionOutputError,
	ActionState,
	CheckRunError,
	CommandRunnerError,
	GitBranchError,
	GitCommitError,
	GitHubClientError,
	GitHubIssueError,
	PullRequestError,
} from "@savvy-web/github-action-effects";
import {
	ActionEnvironment,
	ActionOutputs,
	CheckRun,
	CommandRunner,
	GitBranch,
	GitCommit,
	GitHubClient,
	GitHubIssue,
	PullRequest,
} from "@savvy-web/github-action-effects";
import type { ConfigError } from "effect";
import { Config, Duration, Effect } from "effect";
import type { PublishabilityDetector } from "workspaces-effect";
import { WorkspaceDiscovery } from "workspaces-effect";
import type { ChangesetConfig } from "../release/changeset-config.js";
import { resolveSignoff } from "./commit-signoff.js";
import { isSinglePackage } from "./detect-repo-type.js";
import { isMonorepoForTagging } from "./determine-tag-strategy.js";
import {
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

const RETRYABLE_NETWORK_ERRORS = ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"];
const CLOSE_KEYWORD_PATTERN = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi;
const MERGE_COMMIT_PR_PATTERN = /\(#(\d+)\)$/m;

const extractIssueReferences = (message: string): number[] => {
	const issues = new Set<number>();
	for (const match of message.matchAll(CLOSE_KEYWORD_PATTERN)) {
		const n = Number.parseInt(match[1], 10);
		if (!Number.isNaN(n)) issues.add(n);
	}
	return Array.from(issues);
};

const extractPRNumber = (message: string): number | null => {
	const match = message.match(MERGE_COMMIT_PR_PATTERN);
	return match ? Number.parseInt(match[1], 10) : null;
};

const execWithRetry = (
	command: string,
	args: ReadonlyArray<string>,
	maxRetries = 3,
): Effect.Effect<void, CommandRunnerError, CommandRunner> =>
	Effect.gen(function* () {
		const runner = yield* CommandRunner;
		const baseDelay = Duration.seconds(1);
		const maxDelay = Duration.seconds(10);

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			const result = yield* Effect.either(runner.exec(command, args).pipe(Effect.asVoid));
			if (result._tag === "Right") return;

			const isRetryable = RETRYABLE_NETWORK_ERRORS.some((code) => result.left.reason.includes(code));
			if (attempt === maxRetries || !isRetryable) {
				return yield* Effect.fail(result.left);
			}

			const exp = Math.min(2 ** attempt * Duration.toMillis(baseDelay), Duration.toMillis(maxDelay));
			const jitter = exp * (0.5 + Math.random() * 0.5);
			yield* Effect.logWarning(
				`Attempt ${attempt + 1} failed (${result.left.reason}); retrying in ${Math.round(jitter)}ms`,
			);
			yield* Effect.sleep(Duration.millis(jitter));
		}
	});

const defaultVersionInvocation = (packageManager: string, versionCommand: string): { cmd: string; args: string[] } => {
	if (versionCommand !== "") {
		const parts = versionCommand.split(" ");
		return { cmd: parts[0], args: parts.slice(1) };
	}
	switch (packageManager) {
		case "pnpm":
			return { cmd: "pnpm", args: ["ci:version"] };
		case "yarn":
			return { cmd: "yarn", args: ["ci:version"] };
		case "bun":
			return { cmd: "bun", args: ["run", "ci:version"] };
		default:
			return { cmd: "npm", args: ["run", "ci:version"] };
	}
};

const buildLinkedIssuesSection = (linkedIssues: ReadonlyArray<LinkedIssue>): string => {
	if (linkedIssues.length === 0) return "";
	const items = linkedIssues.map((issue) => {
		if (issue.state === "closed") return `~~#${issue.number}: ${issue.title}~~ (already closed)`;
		return `Closes #${issue.number}: ${issue.title}`;
	});
	return summaryWriter.build([{ heading: "Linked Issues", content: summaryWriter.list(items) }]);
};

interface RefResponse {
	object: { sha: string };
}

/**
 * Run the `updateReleaseBranch` stage.
 *
 * @public
 */
export const updateReleaseBranch = (
	packageManager: string,
): Effect.Effect<
	UpdateReleaseBranchResult,
	| ActionEnvironmentError
	| ActionOutputError
	| CheckRunError
	| CommandRunnerError
	| ConfigError.ConfigError
	| GitBranchError
	| GitCommitError
	| GitHubClientError
	| GitHubIssueError
	| PullRequestError,
	| ActionEnvironment
	| ActionOutputs
	| ActionState
	| ChangesetConfig
	| CheckRun
	| CommandRunner
	| FileSystem.FileSystem
	| GitBranch
	| GitCommit
	| GitHubClient
	| GitHubIssue
	| PublishabilityDetector
	| PullRequest
	| WorkspaceDiscovery
> =>
	Effect.gen(function* () {
		const env = yield* ActionEnvironment;
		const outputs = yield* ActionOutputs;
		const checks = yield* CheckRun;
		const runner = yield* CommandRunner;
		const gitCommit = yield* GitCommit;
		const client = yield* GitHubClient;
		const branches = yield* GitBranch;
		const pr = yield* PullRequest;
		const issues = yield* GitHubIssue;
		const fs = yield* FileSystem.FileSystem;
		const signoff = yield* resolveSignoff();

		const releaseBranch = yield* Config.string("release-branch").pipe(Config.withDefault("changeset-release/main"));
		const targetBranch = yield* Config.string("target-branch").pipe(Config.withDefault("main"));
		const versionCommand = yield* Config.string("version-command").pipe(Config.withDefault(""));
		const prTitlePrefix = yield* Config.string("pr-title-prefix").pipe(Config.withDefault("chore: release"));
		const dryRun = yield* Config.boolean("dry-run").pipe(Config.withDefault(false));

		const { sha, repository, runId } = yield* env.github;
		const [owner, repo] = repository.split("/");

		// ---------- Find existing PR (open, or closed-not-merged) ----------
		let prNumber: number | null = null;
		let prWasClosed = false;

		const openPrs = yield* Effect.either(
			pr.list({ state: "open", head: `${owner}:${releaseBranch}`, base: targetBranch }),
		);

		if (openPrs._tag === "Right" && openPrs.right.length > 0) {
			prNumber = openPrs.right[0].number;
		} else if (openPrs._tag === "Left") {
			yield* Effect.logWarning(`Could not list open PRs: ${openPrs.left.reason}`);
		} else {
			const closedPrs = yield* Effect.either(
				pr.list({ state: "closed", head: `${owner}:${releaseBranch}`, base: targetBranch }),
			);
			if (closedPrs._tag === "Right") {
				const unmerged = closedPrs.right.find((p) => (p.mergedAt ?? null) === null);
				if (unmerged) {
					prNumber = unmerged.number;
					prWasClosed = true;
					yield* Effect.logInfo(`Found closed (unmerged) PR #${prNumber} - will reopen after branch update`);
				}
			} else {
				yield* Effect.logWarning(`Could not list closed PRs: ${closedPrs.left.reason}`);
			}
		}

		// ---------- Collect linked issues from changesets BEFORE version cmd ----------
		yield* Effect.logInfo("Collecting linked issues from changeset commits");
		let linkedIssues: LinkedIssue[] = [];
		if (!dryRun) {
			linkedIssues = yield* collectLinkedIssuesFromChangesets({ owner, repo, targetBranch });
		} else {
			yield* Effect.logInfo("[DRY RUN] Would collect linked issues from changeset commits");
		}

		// ---------- Recreate the release branch from main locally ----------
		yield* Effect.logInfo(`Recreating release branch '${releaseBranch}' from '${targetBranch}'`);
		if (!dryRun) {
			yield* Effect.either(runner.exec("git", ["branch", "-D", releaseBranch]));
			yield* runner.exec("git", ["checkout", "-b", releaseBranch]);
		} else {
			yield* Effect.logInfo(`[DRY RUN] Would recreate branch: ${releaseBranch} from ${targetBranch}`);
		}

		// ---------- Run changeset version ----------
		yield* Effect.logInfo("Running changeset version");
		const { cmd: versionCmd, args: versionArgs } = defaultVersionInvocation(packageManager, versionCommand);
		if (!dryRun) {
			yield* execWithRetry(versionCmd, versionArgs);
		} else {
			yield* Effect.logInfo(`[DRY RUN] Would run: ${versionCmd} ${versionArgs.join(" ")}`);
		}

		// ---------- Detect changes ----------
		let hasChanges = false;
		let changedFiles = "";
		if (!dryRun) {
			const status = yield* runner.execCapture("git", ["status", "--porcelain"]);
			changedFiles = status.stdout;
			hasChanges = changedFiles.trim().length > 0;
		} else {
			hasChanges = true;
			yield* Effect.logInfo("[DRY RUN] Assuming changes exist for version bump");
		}

		let versionSummary = "";
		let prTitle = prTitlePrefix;
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
				const readResult = yield* Effect.either(fs.readFileString("package.json"));
				if (readResult._tag === "Right") {
					try {
						singlePackageRepoVersion = (JSON.parse(readResult.right) as { version?: string }).version;
					} catch (error) {
						yield* Effect.logWarning(
							`Failed to read version for PR title: ${error instanceof Error ? error.message : String(error)}`,
						);
					}
				} else {
					yield* Effect.logWarning(`Failed to read package.json: ${readResult.left.message}`);
				}
			}
			prTitle = resolveReleasePrTitle({
				releasingPackages,
				perPackageVersioning: yield* isMonorepoForTagging(process.cwd()),
				releasablePackages: publishablePackages,
				singlePackageRepoVersion,
				prTitlePrefix,
			});
			if (prTitle !== prTitlePrefix) {
				yield* Effect.logInfo(`Release PR title: ${prTitle}`);
			}

			if (!dryRun) yield* runner.exec("git", ["add", "."]);

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
					const closed = yield* Effect.either(pr.update(prNumber, { state: "closed" }));
					if (closed._tag === "Right") {
						yield* Effect.logInfo(`✓ Closed stale release PR #${prNumber} (nothing to release)`);
					} else {
						yield* Effect.logWarning(`Could not close release PR #${prNumber}: ${closed.left.reason}`);
					}
				} else if (prNumber !== null && prWasClosed) {
					yield* Effect.logInfo(`Release PR #${prNumber} is already closed`);
				}

				// Delete the release branch — it is in an invalid state.
				const deleted = yield* Effect.either(branches.delete(releaseBranch));
				if (deleted._tag === "Right") {
					yield* Effect.logInfo(`✓ Deleted release branch '${releaseBranch}'`);
				} else {
					yield* Effect.logWarning(`Could not delete release branch '${releaseBranch}': ${deleted.left.reason}`);
				}
			} else {
				yield* Effect.logInfo(
					`[DRY RUN] Would close any open release PR and delete '${releaseBranch}' (nothing to release)`,
				);
			}
			prNumber = null;
		}

		// ---------- Reopen PR if it was closed ----------
		if (!branchDeleted && prWasClosed && prNumber !== null && !dryRun) {
			const reopen = yield* Effect.either(pr.update(prNumber, { state: "open" }));
			if (reopen._tag === "Right") {
				yield* Effect.logInfo(`✓ Reopened PR #${prNumber}`);
			} else {
				yield* Effect.logWarning(`Could not reopen PR #${prNumber}: ${reopen.left.reason}`);
				yield* Effect.logInfo("Will create a new PR instead");
				prNumber = null;
			}
		} else if (!branchDeleted && prWasClosed && prNumber !== null && dryRun) {
			yield* Effect.logInfo(`[DRY RUN] Would reopen PR #${prNumber}`);
		}

		// ---------- Update PR title for existing open PRs ----------
		if (!branchDeleted && prNumber !== null && !prWasClosed && !dryRun) {
			const update = yield* Effect.either(pr.update(prNumber, { title: prTitle }));
			if (update._tag === "Right") {
				yield* Effect.logInfo(`✓ Updated PR #${prNumber} title to: ${prTitle}`);
			} else {
				yield* Effect.logWarning(`Could not update PR title: ${update.left.reason}`);
			}
		}

		// ---------- Create new PR if none exists ----------
		if (!branchDeleted && prNumber === null && !dryRun) {
			const prBody = buildPrBody({ versionSummary, linkedIssues, owner, repo, runId });
			const create = (): Effect.Effect<{ number: number; url: string }, PullRequestError, PullRequest> =>
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

		// ---------- Update PR body with linked issues ----------
		if (prNumber !== null && linkedIssues.length > 0 && !dryRun) {
			const getPr = yield* Effect.either(pr.get(prNumber));

			if (getPr._tag === "Right") {
				const linkedSection = buildLinkedIssuesSection(linkedIssues);
				let currentBody = getPr.right.body ?? "";
				const existingIdx = currentBody.indexOf("## Linked Issues");
				if (existingIdx !== -1) {
					const nextHeadingIdx = currentBody.indexOf("\n## ", existingIdx + 1);
					currentBody =
						nextHeadingIdx !== -1
							? currentBody.substring(0, existingIdx) + currentBody.substring(nextHeadingIdx + 1)
							: currentBody.substring(0, existingIdx);
				}
				const newBody = `${linkedSection}\n${currentBody.trim()}`;

				const update = yield* Effect.either(pr.update(prNumber, { body: newBody }));
				if (update._tag === "Right") {
					yield* Effect.logInfo(`✓ Updated PR #${prNumber} with ${linkedIssues.length} linked issue(s)`);
				} else {
					yield* Effect.logWarning(`Could not update PR body: ${update.left.reason}`);
				}
			} else {
				yield* Effect.logWarning(`Could not fetch PR for body update: ${getPr.left.reason}`);
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
				value: prNumber ? `[#${prNumber}](https://github.com/${owner}/${repo}/pull/${prNumber})` : "_N/A_",
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
		yield* checks.complete(checkId, branchDeleted ? "neutral" : "success", {
			title: checkConclusionTitle,
			summary: checkDetails,
		});

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
		 * Walk the changeset commits on `origin/<targetBranch>` and harvest
		 * issue references from commit messages (and merged-PR linked issues
		 * via `closingIssuesReferences`).
		 */
		function collectLinkedIssuesFromChangesets(args: {
			owner: string;
			repo: string;
			targetBranch: string;
		}): Effect.Effect<
			LinkedIssue[],
			CommandRunnerError,
			CommandRunner | FileSystem.FileSystem | GitHubClient | GitHubIssue
		> {
			return Effect.gen(function* () {
				const dirEntries = yield* fs.readDirectory(".changeset").pipe(Effect.catchAll(() => Effect.succeed([])));
				const changesetFiles = dirEntries.filter((f) => f.endsWith(".md") && f !== "README.md");
				yield* Effect.logInfo(`Found ${changesetFiles.length} changeset file(s): ${changesetFiles.join(", ")}`);
				if (changesetFiles.length === 0) return [];

				yield* Effect.logInfo(`Fetching origin/${args.targetBranch} to get full history...`);
				yield* Effect.either(runner.exec("git", ["fetch", "origin", args.targetBranch, "--unshallow"]));
				yield* Effect.either(
					runner.exec("git", ["fetch", "origin", `${args.targetBranch}:refs/remotes/origin/${args.targetBranch}`]),
				);

				const remoteBranch = `origin/${args.targetBranch}`;
				yield* Effect.logInfo(`Searching ${remoteBranch} for changeset commits...`);

				const issueMap = new Map<number, string[]>();
				for (const file of changesetFiles) {
					const filePath = `.changeset/${file}`;
					const logResult = yield* runner
						.execCapture("git", [
							"log",
							remoteBranch,
							"--diff-filter=A",
							"--follow",
							"--reverse",
							"--format=%H%n%B%n---END---",
							"--",
							filePath,
						])
						.pipe(Effect.catchAll(() => Effect.succeed({ stdout: "", stderr: "", exitCode: 0 })));
					const output = logResult.stdout;
					if (output.trim() === "") {
						yield* Effect.logInfo(`Changeset ${file}: no commit found in ${remoteBranch} history`);
						continue;
					}
					const endIdx = output.indexOf("---END---");
					if (endIdx === -1) continue;
					const content = output.substring(0, endIdx).trim();
					const firstNl = content.indexOf("\n");
					const commit =
						firstNl === -1
							? { sha: content, message: "" }
							: { sha: content.substring(0, firstNl), message: content.substring(firstNl + 1).trim() };

					yield* Effect.logInfo(`Changeset ${file}:`);
					yield* Effect.logInfo(`  Commit: ${commit.sha.slice(0, 7)}`);
					yield* Effect.logInfo(`  Message: ${commit.message.split("\n")[0]}`);

					const refs = extractIssueReferences(commit.message);
					yield* Effect.logInfo(
						`  Issue refs: ${refs.length > 0 ? refs.map((i) => `#${i}`).join(", ") : "(none found)"}`,
					);
					for (const n of refs) {
						const existing = issueMap.get(n) ?? [];
						existing.push(commit.sha);
						issueMap.set(n, existing);
					}

					const prNum = extractPRNumber(commit.message);
					if (prNum !== null) {
						yield* Effect.logInfo(`  PR reference: #${prNum}`);
						const prIssuesResult = yield* Effect.either(issues.getLinkedIssues(prNum));
						if (prIssuesResult._tag === "Right") {
							const prIssues = prIssuesResult.right.map((n) => n.number);
							if (prIssues.length > 0) {
								yield* Effect.logInfo(`  PR #${prNum} has ${prIssues.length} linked issue(s):`);
								for (const n of prIssues) {
									yield* Effect.logInfo(`    - Issue #${n}`);
									const existing = issueMap.get(n) ?? [];
									existing.push(commit.sha);
									issueMap.set(n, existing);
								}
							} else {
								yield* Effect.logInfo(`  PR #${prNum} has no linked issues`);
							}
						}
					}
				}

				yield* Effect.logInfo(
					`Found ${issueMap.size} unique issue reference(s) from ${changesetFiles.length} changeset commit(s)`,
				);

				const result: LinkedIssue[] = [];
				for (const [issueNumber, commitShas] of issueMap) {
					const issueResult = yield* Effect.either(issues.get(issueNumber));
					if (issueResult._tag === "Right") {
						const i = issueResult.right;
						result.push({
							number: issueNumber,
							title: i.title,
							state: i.state,
							url: i.htmlUrl ?? "",
							commits: commitShas,
							nodeId: i.nodeId ?? "",
						});
						yield* Effect.logInfo(`✓ Issue #${issueNumber}: ${i.title} (${i.state})`);
					} else {
						yield* Effect.logWarning(`Failed to fetch issue #${issueNumber}: ${issueResult.left.reason}`);
					}
				}
				return result;
			});
		}

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
			CommandRunnerError | GitCommitError | GitHubClientError,
			CommandRunner | FileSystem.FileSystem | GitCommit | GitHubClient
		> {
			return Effect.gen(function* () {
				const targetRef = yield* client.rest<RefResponse>("git.getRef", (octokit) =>
					(
						octokit as {
							rest: {
								git: {
									getRef: (params: { owner: string; repo: string; ref: string }) => Promise<{ data: RefResponse }>;
								};
							};
						}
					).rest.git.getRef({ owner, repo, ref: `heads/${args.targetBranch}` }),
				);
				const parentSha = targetRef.object.sha;

				// `-z` uses NUL separators so the positional [0..2]=status, [3..]=path
				// parsing survives whitespace and trailing CRLF; trimming the line
				// itself would shift the column for unstaged changes (" M file" → "M file").
				const status = yield* runner.execCapture("git", ["status", "--porcelain", "-z"]);
				const files: Array<
					| { readonly path: string; readonly mode: "100644" | "100755"; readonly content: string }
					| { readonly path: string; readonly mode: "100644"; readonly sha: null }
				> = [];
				for (const entry of status.stdout.split("\0")) {
					if (entry.length === 0) continue;
					const statusCode = entry.substring(0, 2).trim();
					let filePath = entry.substring(3);
					if (filePath.includes(" -> ")) filePath = filePath.split(" -> ")[1];
					if (filePath === "") continue;
					if (statusCode === "D" || statusCode === "DD" || statusCode === "AD") {
						files.push({ path: filePath, mode: "100644", sha: null });
					} else {
						const content = yield* fs.readFileString(filePath).pipe(Effect.catchAll(() => Effect.succeed("")));
						const statResult = yield* Effect.either(fs.stat(filePath));
						const isExecutable = statResult._tag === "Right" && (Number(statResult.right.mode ?? 0n) & 0o111) !== 0;
						files.push({ path: filePath, mode: isExecutable ? "100755" : "100644", content });
					}
				}

				if (files.length === 0) {
					yield* Effect.logWarning("No changes to commit via API");
					return;
				}

				// The Git Data API's `base_tree` wants a tree SHA, not a commit
				// SHA — fetch the parent commit and read its tree.sha.
				const parentCommit = yield* client.rest<{ tree: { sha: string } }>("git.getCommit", (octokit) =>
					(
						octokit as {
							rest: {
								git: {
									getCommit: (params: { owner: string; repo: string; commit_sha: string }) => Promise<{
										data: { tree: { sha: string } };
									}>;
								};
							};
						}
					).rest.git.getCommit({ owner, repo, commit_sha: parentSha }),
				);
				const treeSha = yield* gitCommit.createTree(files, parentCommit.tree.sha);
				const commitSha = yield* gitCommit.createCommit(args.commitMessage, treeSha, [parentSha]);
				// GitCommit.updateRef prefixes "heads/" itself — pass the bare branch name.
				yield* gitCommit.updateRef(args.releaseBranch, commitSha, true);
				yield* Effect.logInfo(`✓ Created verified commit: ${commitSha}`);
			});
		}
	});

const buildPrBody = (args: {
	versionSummary: string;
	linkedIssues: ReadonlyArray<LinkedIssue>;
	owner: string;
	repo: string;
	runId: string;
}): string => {
	const sections: Array<{ heading?: string; level?: 2 | 3; content: string }> = [
		{ heading: "Release PR", content: "This PR was automatically generated by the release workflow." },
	];
	if (args.versionSummary) {
		sections.push({
			heading: "Version Changes",
			level: 3,
			content: summaryWriter.codeBlock(args.versionSummary, "text"),
		});
	}
	if (args.linkedIssues.length > 0) {
		sections.unshift({ content: buildLinkedIssuesSection(args.linkedIssues) });
	}
	sections.push({
		content: `---\n🤖 Generated with [GitHub Actions](https://github.com/${args.owner}/${args.repo}/actions/runs/${args.runId})`,
	});
	return summaryWriter.build(sections);
};
