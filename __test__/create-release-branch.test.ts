/**
 * Fixture tests for the create-release-branch stage.
 *
 * @remarks
 * Driven entirely through kit seams — `GitBranch`, `GitCommit`,
 * `GitHubRepository`, `PullRequest`, `GitTag`, `GitHubCommit`, `GitHubIssue`
 * and `CheckRun` `layerTest` doubles over one mutable fixture, plus a
 * `ScriptedSpawner` for the git commands. There is no `GitHubClient`: the two
 * hand-cast REST calls (`git.getCommit`, `repos.get`), the `createRef`
 * fallback and both GraphQL mutations are gone.
 *
 * Four invariants are pinned here beyond the original coverage, none of them
 * visible to the typechecker:
 *
 * 1. **`upsert` then `commitFiles`, in that order.** `commitFiles` cannot
 *    create a branch, so without the `upsert` the brand-new release branch is
 *    never placed — the exact case the predecessor's `updateRef` →
 *    `createRef`-on-404 fallback existed for.
 * 2. **The commit is rooted on the TARGET branch head**, read from the ref
 *    rather than from `git rev-parse HEAD`, where it matched only by
 *    coincidence.
 * 3. **The branch is linked to each issue via `GitBranch.createLinked`**,
 *    carrying the issue node id and the repository node id.
 * 4. **The no-changes path cleans up locally** (`git checkout` +
 *    `git branch -D`) and creates no PR — deliberately asymmetric with
 *    `update-release-branch`, which deletes the *remote* branch.
 */

import type { SpawnRecord } from "@effected/commands";
import { ScriptedSpawner, ToolDiscovery } from "@effected/commands";
import { Git } from "@effected/git";
import type { CheckRunOutput, FileChange, PullRequestInfo } from "@effected/github";
import {
	CheckRun,
	CheckRunRef,
	CommitSummary,
	GitBranch,
	GitCommit,
	GitHubCommit,
	GitHubIssue,
	GitHubRepository,
	GitTag,
	LinkedIssue as KitLinkedIssue,
	PullRequest,
	Repo,
	RepoRef,
} from "@effected/github";
import { ActionEnvironment, ActionOutputs, DryRun } from "@effected/github-actions";
import { PublishabilityDetector, WorkspaceDiscovery } from "@effected/workspaces";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, FileSystem, Layer, Logger, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ChangesetConfig } from "../src/release/changeset-config.js";
import type { CreateReleaseBranchResult } from "../src/utils/create-release-branch.js";
import { createReleaseBranch } from "../src/utils/create-release-branch.js";
import { actionStateWithAppToken, cleanupTestEnvironment, setupTestEnvironment } from "./utils/github-mocks.js";

const RELEASE_BRANCH = "changeset-release/main";
const TARGET_BRANCH = "main";
/** The sha `GitBranch.sha(TARGET_BRANCH)` reports — the expected commit parent. */
const TARGET_HEAD = "targethead000";
const REPO_NODE_ID = "R_repo_node";
const NEW_COMMIT_SHA = "newcommitsha";

// --- ambient stubs -------------------------------------------------------

const workspaceDiscoveryStub = Layer.succeed(WorkspaceDiscovery, {
	info: () => Effect.die("not implemented"),
	listPackages: () => Effect.succeed([]),
	getPackage: () => Effect.die("not implemented"),
	importerMap: () => Effect.succeed(new Map()),
	resolveFile: () => Effect.succeed(Option.none()),
	resolveFiles: () => Effect.succeed([]),
	refresh: () => Effect.void,
});

const publishabilityDetectorStub = Layer.succeed(PublishabilityDetector, { detect: () => Effect.succeed([]) });

const changesetConfigStub = Layer.succeed(ChangesetConfig, {
	mode: () => Effect.succeed("silk" as const),
	versionPrivate: () => Effect.succeed(false),
	ignorePatterns: () => Effect.succeed([]),
	isIgnored: () => Effect.succeed(false),
	fixed: () => Effect.succeed([]),
	refresh: () => Effect.void,
});

const appliedRelease: Changesets.AppliedRelease = {
	dryRun: false,
	releases: [{ name: "@scope/a", type: "minor", oldVersion: "1.0.0", newVersion: "1.1.0" }],
	touchedFiles: ["package.json", "CHANGELOG.md"],
	versionFileUpdates: [],
};

const releasePlannerStub = Changesets.makeReleasePlannerTest({ apply: appliedRelease });

const configInspectorStub = Changesets.makeConfigInspectorTest({
	configPath: "/workspace/.changeset/config.json",
	projectDir: "/workspace",
	changelog: "@savvy-web/silk/changesets/changelog",
	baseBranch: "main",
	access: "restricted",
	ignore: [],
	packages: [],
	legacyVersionFilesUsed: false,
});

// --- fixture -------------------------------------------------------------

const commitSummary = (sha: string, message: string): CommitSummary =>
	CommitSummary.make({
		sha,
		message,
		author: "Test Author",
		url: `https://github.com/owner/repo/commit/${sha}`,
		// `parents` became a required field when the kit stopped forcing consumers
		// to a raw route for it. These fixtures never read it, so an empty list
		// (a root commit) is the honest value rather than an invented parent.
		parents: [],
	});

interface Fixtures {
	prs: PullRequestInfo[];
	labels: Map<number, string[]>;
	/** Every `GitBranch.upsert` call, in order. */
	upserts: Array<{ name: string; sha: string }>;
	/** Every `GitCommit.commitFiles` call, in order. */
	commits: Array<{ branch: string; message: string; changes: ReadonlyArray<FileChange> }>;
	/** Every `GitBranch.createLinked` call, in order. */
	linkedBranches: Array<{ issueNodeId: string; repositoryNodeId: string; name: string; sha: string }>;
	/** What `GitHubCommit.list` returns for the target branch. */
	branchCommits: CommitSummary[];
	/** Issues each merge commit's PR closes, keyed by PR number. */
	linkedIssues: Map<number, KitLinkedIssue[]>;
	completed: Array<{ conclusion: string; output: CheckRunOutput | undefined }>;
	summaries: string[];
	/** Every value masked with the runner via `setSecret`. */
	masked: string[];
	nextPrNumber: number;
}

const makeFixtures = (
	params: { linkedIssues?: Array<[number, number[]]>; branchCommits?: CommitSummary[] } = {},
): Fixtures => {
	const linkedIssues = new Map<number, KitLinkedIssue[]>();
	for (const [prNumber, issueNumbers] of params.linkedIssues ?? []) {
		linkedIssues.set(
			prNumber,
			issueNumbers.map((n) =>
				KitLinkedIssue.make({
					number: n,
					title: `Issue ${n}`,
					state: "OPEN",
					url: `https://github.com/owner/repo/issues/${n}`,
					nodeId: `I_${n}`,
					userLinked: false,
				}),
			),
		);
	}
	return {
		prs: [],
		labels: new Map(),
		upserts: [],
		commits: [],
		linkedBranches: [],
		branchCommits: params.branchCommits ?? [],
		linkedIssues,
		completed: [],
		summaries: [],
		masked: [],
		nextPrNumber: 42,
	};
};

// --- git script ----------------------------------------------------------

/**
 * The `git status` stdout that drives the version-change branch.
 *
 * @remarks
 * NUL-terminated: every status read in the stage now goes through `Git.status`,
 * which runs `--porcelain -z` and parses it. The human `-z`-less form would be
 * read as ONE entry whose path is the tail of the first line.
 */
const PORCELAIN_CHANGED = "M  package.json\0M  CHANGELOG.md\0";

interface GitOptions {
	/**
	 * The FIRST `git status` read — the change probe. Empty drives the no-change
	 * cleanup path.
	 */
	readonly porcelain?: string;
	/**
	 * The SECOND `git status` read, which becomes the commit's file list.
	 *
	 * @remarks
	 * Both reads are now the same command (`Git.status` runs `--porcelain -z`
	 * for each), so the script answers them by call order rather than by argv.
	 */
	readonly porcelainZ?: string;
}

const gitScript = (options: GitOptions) => {
	let statusReads = 0;
	return (command: string, args: ReadonlyArray<string>) => {
		if (command !== "git") return ScriptedSpawner.notFound(command);
		const argv = args.join(" ");
		if (argv === "status --porcelain -z") {
			statusReads += 1;
			return { exit: 0, stdout: (statusReads === 1 ? options.porcelain : options.porcelainZ) ?? "", stderr: "" };
		}
		// checkout -b, checkout <target>, branch -D
		return { exit: 0, stdout: "", stderr: "" };
	};
};

// --- runner --------------------------------------------------------------

const runStage = async (
	f: Fixtures,
	git: GitOptions = { porcelain: PORCELAIN_CHANGED, porcelainZ: "M  package.json\0" },
	plannerLayer: Layer.Layer<Changesets.ReleasePlanner> = releasePlannerStub,
): Promise<{ result: CreateReleaseBranchResult; spawns: ReadonlyArray<SpawnRecord> }> => {
	const spawner = ScriptedSpawner.make(gitScript(git));
	const layer = Layer.mergeAll(
		ActionEnvironment.layerTest({
			GITHUB_SHA: "abc123",
			GITHUB_REF: "refs/heads/main",
			GITHUB_REPOSITORY: "owner/repo",
			GITHUB_REPOSITORY_OWNER: "owner",
			GITHUB_WORKSPACE: "/workspace",
			GITHUB_EVENT_NAME: "push",
			GITHUB_EVENT_PATH: "",
			GITHUB_RUN_ID: "1",
			GITHUB_RUN_NUMBER: "1",
			GITHUB_ACTOR: "test",
			GITHUB_SERVER_URL: "https://github.com",
			GITHUB_API_URL: "https://api.github.com",
		}),
		ActionOutputs.layerTest({
			summary: (content) =>
				Effect.sync(() => {
					f.summaries.push(content);
				}),
			// `runNativeVersion` declassifies the App token through
			// `Secret.forSigning`, which masks it with the runner. The double dies
			// loudly on an unstubbed member, so this records the masks instead —
			// which is also what proves the token reaches the log filter before it
			// reaches `process.env.GITHUB_TOKEN`.
			setSecret: (value) =>
				Effect.sync(() => {
					f.masked.push(value);
				}),
		}),
		// The App token `pre` persisted. `runNativeVersion` reads it with
		// `GitHubToken.read()` now that the `process.env.STATE_token` bridge is
		// gone, so a state double that answers "missing" would fail the stage. The
		// token carries no `appSlug`, so the sign-off still resolves to the
		// `github-actions[bot]` identity these fixtures expect.
		actionStateWithAppToken(),
		// `exists` answers false, so `formatWorkspaceWithBiome` returns before
		// probing — an unstubbed `isAvailable` would die if it did not.
		ToolDiscovery.layerTest(),
		spawner.layer,
		// The REAL `Git`, over the scripted spawner — not a `makeTest` double.
		// The stage's git work is now split between kit members and the raw
		// commands the kit cannot express, and driving both through one spawner
		// is what keeps `spawner.spawns` a complete record of the argv this stage
		// runs (which two tests below assert on directly).
		Git.layer.pipe(Layer.provide(spawner.layer)),
		CheckRun.layerTest({
			create: (name) =>
				Effect.succeed(
					CheckRunRef.make({ id: 1, name, url: "https://github.com/owner/repo/runs/1", status: "in_progress" }),
				),
			complete: (_id, conclusion, output) =>
				Effect.sync(() => {
					f.completed.push({ conclusion, output });
				}),
		}),
		GitBranch.layerTest({
			sha: (name) => Effect.succeed(name === TARGET_BRANCH ? TARGET_HEAD : `sha-of-${name}`),
			upsert: (name, sha) =>
				Effect.sync(() => {
					f.upserts.push({ name, sha });
					return "created" as const;
				}),
			createLinked: (input) =>
				Effect.sync(() => {
					f.linkedBranches.push({ ...input });
				}),
		}),
		GitCommit.layerTest({
			commitFiles: ({ branch, message, changes }) =>
				Effect.sync(() => {
					f.commits.push({ branch, message, changes });
					return NEW_COMMIT_SHA;
				}),
		}),
		GitHubRepository.layerTest({ nodeId: Effect.succeed(REPO_NODE_ID) }),
		// No tags → `getLinkedIssuesFromCommits` takes its list path.
		GitTag.layerTest({ latestSemver: () => Effect.succeed(Option.none()) }),
		GitHubCommit.layerTest({ list: () => Effect.succeed(f.branchCommits) }),
		GitHubIssue.layerTest({
			linkedIssues: (prNumber) => Effect.succeed(f.linkedIssues.get(prNumber) ?? []),
		}),
		PullRequest.layerTest({
			// The release boundary asks for merged release PRs before walking
			// commits. Empty means "nothing released yet", which sends the walk
			// down the list-the-whole-branch path these fixtures already expect.
			list: () => Effect.succeed([]),
			create: (input) =>
				Effect.sync(() => {
					const created = {
						number: f.nextPrNumber++,
						nodeId: `PR_node_${f.nextPrNumber}`,
						url: `https://github.com/owner/repo/pull/${f.nextPrNumber - 1}`,
						title: input.title,
						body: input.body ?? "",
						state: "open",
						head: input.head,
						base: input.base,
						draft: false,
						merged: false,
						mergedAt: Option.none(),
					} as unknown as PullRequestInfo;
					f.prs.push(created);
					return created;
				}),
			addLabels: (number, labels) =>
				Effect.sync(() => {
					f.labels.set(number, [...(f.labels.get(number) ?? []), ...labels]);
				}),
		}),
		Layer.succeed(Repo, RepoRef.make({ owner: "owner", repo: "repo" })),
		FileSystem.layerNoop({
			exists: () => Effect.succeed(false),
			readFileString: () => Effect.succeed("file contents"),
		}),
		workspaceDiscoveryStub,
		publishabilityDetectorStub,
		changesetConfigStub,
		plannerLayer,
		configInspectorStub,
	);
	// Branch names are now ARGUMENTS, not inputs this module reads for itself,
	// so the old `ActionInput.layer` arrangement is gone. That also retires the
	// note that used to sit here: the fixture values equalled their production
	// defaults, so a mis-named input still resolved to the right string and the
	// reads were exercised but never discriminated. Passed as values, the wrong
	// branch name can no longer coincide with the right one.
	const refs = { releaseBranch: RELEASE_BRANCH, targetBranch: TARGET_BRANCH };
	const result = await Effect.runPromise(
		createReleaseBranch(refs).pipe(
			Effect.provide(layer),
			Effect.provide(Logger.layer([])),
			Effect.provide(DryRun.layerFrom(false)),
		),
	);
	return { result, spawns: spawner.spawns };
};

const argvOf = (spawns: ReadonlyArray<SpawnRecord>): string[] => spawns.map((s) => [s.command, ...s.args].join(" "));

describe("createReleaseBranch", () => {
	// Shared harness: clears mocks and silences stdout/stderr so a log line
	// added to the module under test cannot start leaking into the reporter.
	beforeEach(() => setupTestEnvironment({ suppressOutput: true }));
	afterEach(() => cleanupTestEnvironment());

	it("creates the release branch and PR, and applies automated/release labels", async () => {
		const f = makeFixtures();

		const { result } = await runStage(f);

		expect(result.created).toBe(true);
		expect(result.prNumber).toBe(42);
		expect(f.prs).toHaveLength(1);
		expect(f.prs[0].head).toBe(RELEASE_BRANCH);
		expect(f.prs[0].base).toBe(TARGET_BRANCH);
		expect(f.labels.get(42)).toEqual(["automated", "release"]);
		expect(f.completed.at(-1)?.conclusion).toBe("success");
	});

	it("upserts the release branch to the TARGET head before committing onto it", async () => {
		// INVARIANTS 1 and 2. `commitFiles` can neither create the branch nor
		// choose its parent, so an `upsert` at the target head is the only thing
		// that roots the release commit on `main` — and the only thing that makes
		// a brand-new release branch exist at all.
		const f = makeFixtures();

		await runStage(f);

		expect(f.upserts).toEqual([{ name: RELEASE_BRANCH, sha: TARGET_HEAD }]);
		expect(f.commits).toHaveLength(1);
		expect(f.commits[0].branch).toBe(RELEASE_BRANCH);
		expect(f.commits[0].changes.map((c) => c.path)).toEqual(["package.json"]);
	});

	it("reads the parent from the target ref, not from a `git rev-parse HEAD` subprocess", async () => {
		const f = makeFixtures();

		const { spawns } = await runStage(f);

		expect(argvOf(spawns)).not.toContain("git rev-parse HEAD");
		expect(f.upserts[0].sha).toBe(TARGET_HEAD);
	});

	it("links the new branch to every linked issue, carrying both node ids", async () => {
		// INVARIANT 3. `createLinked` is the one operation with no REST
		// equivalent; a plain branch create would neither show on the issue nor
		// close it when the release PR merges.
		const f = makeFixtures({
			branchCommits: [commitSummary("merge1", "feat: thing (#10)")],
			linkedIssues: [[10, [5, 6]]],
		});

		await runStage(f);

		expect(f.linkedBranches).toEqual([
			{ issueNodeId: "I_5", repositoryNodeId: REPO_NODE_ID, name: RELEASE_BRANCH, sha: NEW_COMMIT_SHA },
			{ issueNodeId: "I_6", repositoryNodeId: REPO_NODE_ID, name: RELEASE_BRANCH, sha: NEW_COMMIT_SHA },
		]);
	});

	it("exits early when the version bump produces no changes, cleaning up locally", async () => {
		// INVARIANT 4. The branch only ever existed locally at this point, so the
		// cleanup is `git checkout <target>` + `git branch -D <release>`, with no
		// remote delete — deliberately unlike `update-release-branch`.
		const f = makeFixtures();

		const { result, spawns } = await runStage(f, { porcelain: "" });

		expect(result.created).toBe(false);
		expect(result.prNumber).toBeNull();
		expect(result.versionSummary).toBe("No changes");
		expect(f.prs).toHaveLength(0);
		expect(f.upserts).toHaveLength(0);
		expect(f.commits).toHaveLength(0);
		expect(argvOf(spawns)).toEqual([
			`git checkout -b ${RELEASE_BRANCH} origin/${TARGET_BRANCH}`,
			"git status --porcelain -z",
			`git checkout ${TARGET_BRANCH}`,
			`git branch -D ${RELEASE_BRANCH}`,
		]);
		expect(f.completed.at(-1)?.conclusion).toBe("neutral");
	});

	it("skips the commit entirely when the -z status lists no files", async () => {
		const f = makeFixtures();

		const { result } = await runStage(f, { porcelain: PORCELAIN_CHANGED, porcelainZ: "" });

		// Still a "created" run — the PR is opened — but nothing was committed and
		// therefore nothing was linked.
		expect(result.created).toBe(true);
		expect(f.commits).toHaveLength(0);
		expect(f.linkedBranches).toHaveLength(0);
	});

	it("fails when native versioning fails", async () => {
		const f = makeFixtures();
		// Planner test layer with no apply fixture → apply fails with ReleasePlanError.
		const failingPlanner = Changesets.makeReleasePlannerTest({});
		// The tagged error specifically, by `_tag` rather than by message. The old
		// `/ReleasePlanError|not provided/` also matched a missing-service error, so
		// the test stayed green if `plannerLayer` stopped being wired at all rather
		// than failing inside `apply`. Matching on the rendered message would not
		// fix that either — `ReleasePlanError.message` reads "Release plan error
		// (apply): …" and never contains its own tag.
		await expect(
			runStage(f, { porcelain: PORCELAIN_CHANGED, porcelainZ: "M  package.json\0" }, failingPlanner),
		).rejects.toMatchObject({ _tag: "ReleasePlanError", phase: "apply" });
	});
});
