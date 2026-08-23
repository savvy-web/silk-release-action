/**
 * Fixture tests for the update-release-branch stage.
 *
 * @remarks
 * Everything is driven through kit seams: `PullRequest`, `GitHubIssue`,
 * `GitBranch` and `GitCommit` `layerTest` doubles over a small mutable fixture,
 * and a `ScriptedSpawner` for the git commands. The predecessor harness needed
 * `GitHubClientTest` recorded REST responses to satisfy a raw
 * `client.rest("git.getRef")`; that call is gone, replaced by `GitBranch.sha`.
 *
 * Three invariants are pinned here beyond the original coverage, because none
 * of them is visible to the typechecker:
 *
 * 1. **Build the commit, THEN move the ref once.** The release branch must
 *    never be pointed at the target head: an open release PR whose head equals
 *    its base is closed by GitHub. `commitFiles` cannot be used at all — it
 *    roots on the branch's own tree and cannot force-move a ref.
 * 2. **The commit is rooted on the TARGET branch head**, not the release
 *    branch's own head — what keeps the release branch one clean commit on main.
 * 3. **`mergedAt` is an `Option`.** The predecessor's `(p.mergedAt ?? null) ===
 *    null` compiles unchanged against an Option and is always false, which would
 *    silently stop closed-but-unmerged release PRs from ever being reopened.
 */

import type { SpawnRecord } from "@effected/commands";
import { ScriptedSpawner, ToolDiscovery } from "@effected/commands";
import { Git } from "@effected/git";
import type { CheckRunOutput, FileChange, IssueInfo, PullRequestInfo } from "@effected/github";
import {
	CheckRun,
	CheckRunRef,
	CommitComparison,
	CommitRef,
	CommitSummary,
	GitBranch,
	GitCommit,
	GitHubCommit,
	GitHubError,
	GitHubIssue,
	LinkedIssue as KitLinkedIssue,
	PullRequest,
	Repo,
	RepoRef,
} from "@effected/github";
import { ActionEnvironment, ActionOutputs, DryRun } from "@effected/github-actions";
import { PublishabilityDetector, WorkspaceDiscovery } from "@effected/workspaces";
import { Changesets, PrBody } from "@savvy-web/silk-effects";
import { DateTime, Effect, FileSystem, Layer, Logger, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ChangesetConfig } from "../src/release/changeset-config.js";
import type { LinkedIssue, UpdateReleaseBranchResult } from "../src/utils/update-release-branch.js";
import { updateReleaseBranch } from "../src/utils/update-release-branch.js";
import { actionStateWithAppToken, cleanupTestEnvironment, setupTestEnvironment } from "./utils/github-mocks.js";

const RELEASE_BRANCH = "changeset-release/main";
const TARGET_BRANCH = "main";
/** The sha `GitBranch.sha(TARGET_BRANCH)` reports — the expected commit parent. */
const TARGET_HEAD = "targethead000";

// --- ambient stubs -------------------------------------------------------

const workspaceDiscoveryStub = Layer.succeed(WorkspaceDiscovery, {
	info: () => Effect.die("not implemented"),
	listPackages: () => Effect.succeed([]),
	getPackage: () => Effect.die("not implemented"),
	importerMap: () => Effect.succeed(new Map()),
	resolveFile: () => Effect.succeed(Option.none()),
	resolveFiles: () => Effect.succeed([]),
	refresh: () => Effect.void,
	infoIn: () => Effect.die("not implemented"),
	listPackagesIn: () => Effect.die("not implemented"),
	refreshIn: () => Effect.void,
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

interface SeedPr {
	number: number;
	head: string;
	base: string;
	state: "open" | "closed";
	title?: string;
	body?: string;
	/** Drives `mergedAt`: an `Option`, NOT a nullable string. */
	merged?: boolean;
}

interface Fixtures {
	prs: PullRequestInfo[];
	/** Commits `GitHubCommit.list` reports for the target branch. */
	branchCommits: CommitSummary[];
	labels: Map<number, string[]>;
	issues: Map<number, IssueInfo>;
	linked: Map<number, KitLinkedIssue[]>;
	branches: Map<string, string>;
	/** Every `GitBranch.upsert` call, in order. */
	upserts: Array<{ name: string; sha: string }>;
	/** Every commit written, in order. */
	commits: Array<{ branch: string; message: string; changes: ReadonlyArray<FileChange> }>;
	/** Every `GitCommit.createTree` call, in order. */
	trees: Array<{ baseTree: string | undefined; changes: ReadonlyArray<FileChange> }>;
	/** Every `GitCommit.createCommit` call, in order. */
	createdCommits: Array<{ message: string; tree: string; parents: ReadonlyArray<string> }>;
	deleted: string[];
	completed: Array<{ conclusion: string; output: CheckRunOutput | undefined }>;
	summaries: string[];
	/** Every value masked with the runner via `setSecret`. */
	masked: string[];
	nextPrNumber: number;
	/** When set, closes that PR the moment the branch ref moves. */
	closeOnRefMove?: number;
	/** With `closeOnRefMove`, marks it MERGED rather than merely closed. */
	mergeOnRefMove?: boolean;
}

const makePr = (seed: SeedPr): PullRequestInfo =>
	({
		number: seed.number,
		nodeId: `node-${seed.number}`,
		url: `https://github.com/owner/repo/pull/${seed.number}`,
		title: seed.title ?? `PR #${seed.number}`,
		body: seed.body ?? "",
		state: seed.state,
		head: seed.head,
		base: seed.base,
		draft: false,
		merged: seed.merged ?? false,
		// An `Option`, which is the whole point of the landmine test below.
		mergedAt: seed.merged === true ? Option.some(DateTime.makeUnsafe("2026-01-01T00:00:00Z")) : Option.none(),
	}) as unknown as PullRequestInfo;

const makeFixtures = (
	params: {
		prs?: SeedPr[];
		branches?: Array<[string, string]>;
		linkedIssues?: Array<[number, Array<{ number: number; title: string }>]>;
		issueDetails?: Array<{ number: number; title: string; state: "open" | "closed"; url?: string; nodeId?: string }>;
		branchCommits?: CommitSummary[];
	} = {},
): Fixtures => {
	const prs = (params.prs ?? []).map(makePr);
	const linked = new Map<number, KitLinkedIssue[]>();
	for (const [prNumber, entries] of params.linkedIssues ?? []) {
		linked.set(
			prNumber,
			entries.map((e) =>
				KitLinkedIssue.make({
					number: e.number,
					title: e.title,
					state: "open",
					url: `https://x/${e.number}`,
					nodeId: `I_${e.number}`,
					userLinked: false,
				}),
			),
		);
	}
	const issues = new Map<number, IssueInfo>();
	for (const d of params.issueDetails ?? []) {
		issues.set(d.number, {
			number: d.number,
			title: d.title,
			state: d.state,
			labels: [],
			url: d.url ?? `https://x/${d.number}`,
			nodeId: d.nodeId ?? `I_${d.number}`,
		} as unknown as IssueInfo);
	}
	return {
		prs,
		branchCommits: params.branchCommits ?? [],
		labels: new Map(),
		issues,
		linked,
		branches: new Map(params.branches ?? [[RELEASE_BRANCH, "deadbeef"]]),
		upserts: [],
		trees: [],
		createdCommits: [],
		commits: [],
		deleted: [],
		completed: [],
		summaries: [],
		masked: [],
		nextPrNumber: Math.max(0, ...prs.map((p) => p.number)) + 1,
	};
};

// --- git script ----------------------------------------------------------

/** A commit as `GitHubCommit.list` reports it for the target branch. */
const branchCommit = (sha: string, message: string): CommitSummary =>
	CommitSummary.make({ sha, message, author: "Test Author", url: `https://x/commit/${sha}`, parents: [] });

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
	 * The FIRST `git status` read — the change probe. Empty drives the
	 * close-the-PR-and-delete-the-branch path.
	 */
	readonly porcelain?: string;
	/** That read's exit code. Non-zero must FAIL the stage, not read as "no changes". */
	readonly porcelainExit?: number;
	/**
	 * The SECOND `git status` read, taken after `git add`, which becomes the
	 * commit's file list.
	 *
	 * @remarks
	 * Both reads are now the same command (`Git.status` runs `--porcelain -z`
	 * for each), so the script answers them by call order rather than by argv.
	 */
	readonly porcelainZ?: string;
	/** `git log` stdout, keyed by the changeset file path it targets. */
	readonly logs?: Record<string, string>;
}

const gitScript = (options: GitOptions) => {
	let statusReads = 0;
	return (command: string, args: ReadonlyArray<string>) => {
		if (command !== "git") return ScriptedSpawner.notFound(command);
		const argv = args.join(" ");
		if (argv === "status --porcelain -z") {
			statusReads += 1;
			if (statusReads === 1) {
				const exit = options.porcelainExit ?? 0;
				// Only the failure case carries the fatal stderr. Emitting it on exit 0
				// too is contradictory and misleads the next reader debugging a failure.
				return {
					exit,
					stdout: options.porcelain ?? "",
					stderr: exit === 0 ? "" : "fatal: not a git repository",
				};
			}
			return { exit: 0, stdout: options.porcelainZ ?? "", stderr: "" };
		}
		if (args[0] === "log") {
			const path = args[args.length - 1];
			return { exit: 0, stdout: options.logs?.[path] ?? "", stderr: "" };
		}
		// checkout -B, add -- ., rev-parse --verify HEAD, fetch …
		return { exit: 0, stdout: "", stderr: "" };
	};
};

// --- runner --------------------------------------------------------------

const runStage = async (
	f: Fixtures,
	git: GitOptions = { porcelain: PORCELAIN_CHANGED },
	changesetFiles: ReadonlyArray<string> = [],
	plannerLayer: Layer.Layer<Changesets.ReleasePlanner> = releasePlannerStub,
	/** Overrides on top of the seeded `GITHUB_*` block — e.g. a GHES host. */
	envOverrides: Readonly<Record<string, string>> = {},
): Promise<{ result: UpdateReleaseBranchResult; spawns: ReadonlyArray<SpawnRecord> }> => {
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
			...envOverrides,
		}),
		ActionOutputs.layerTest({
			summary: (content) =>
				Effect.sync(() => {
					f.summaries.push(content);
				}),
			// `runNativeVersion` declassifies the App token through
			// `Secret.forProcessEnv`, which masks it with the runner. The double dies
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
		// Every one of the stage's git operations is a kit member now (`status`,
		// `revParse`, `add`, `branchCreate`), and driving them through one spawner
		// keeps `spawner.spawns` a complete record of the argv this stage runs —
		// which is what the force-push regression test asserts on. A `makeTest`
		// double would assert that a method was called and would NOT catch the
		// kit changing what it spawns.
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
			sha: (name) =>
				name === TARGET_BRANCH ? Effect.succeed(TARGET_HEAD) : Effect.succeed(f.branches.get(name) ?? "unknownsha"),
			upsert: (name, sha) =>
				Effect.sync(() => {
					f.upserts.push({ name, sha });
					f.branches.set(name, sha);
					// Models the real mechanism: GitHub closed #243 as a side effect of
					// the ref moving, mid-run, after the opening snapshot was taken.
					if (f.closeOnRefMove !== undefined) {
						const idx = f.prs.findIndex((p) => p.number === f.closeOnRefMove);
						if (idx !== -1) {
							f.prs[idx] = {
								...(f.prs[idx] as unknown as Record<string, unknown>),
								state: "closed",
								...(f.mergeOnRefMove === true
									? { merged: true, mergedAt: Option.some(DateTime.makeUnsafe("2026-01-01T00:00:00Z")) }
									: {}),
							} as PullRequestInfo;
						}
					}
					return "reset" as const;
				}),
			delete: (name) =>
				Effect.sync(() => {
					f.deleted.push(name);
					f.branches.delete(name);
				}),
		}),
		GitCommit.layerTest({
			// `commitFiles` is deliberately UNSTUBBED: it roots on the branch's own
			// tree and cannot force-move a ref, so reaching it here would be the bug
			// this suite exists to prevent. Unstubbed members die loudly.
			get: (sha) => Effect.succeed(CommitRef.make({ sha, treeSha: `tree-of-${sha}`, parents: [] })),
			createTree: ({ changes, baseTree }) =>
				Effect.sync(() => {
					f.trees.push({ baseTree, changes });
					return "newtreesha";
				}),
			createCommit: ({ message, tree, parents }) =>
				Effect.sync(() => {
					f.commits.push({ branch: RELEASE_BRANCH, message, changes: f.trees[f.trees.length - 1]?.changes ?? [] });
					f.createdCommits.push({ message, tree, parents });
					return "newcommitsha";
				}),
		}),
		// The issue walk runs before versioning now. With no merged release PR in
		// these fixtures it takes the list-the-branch path, and an empty branch
		// yields no linked issues — which is what these cases asserted all along,
		// previously by way of an absent `.changeset` directory.
		GitHubCommit.layerTest({
			list: () => Effect.succeed(f.branchCommits),
			compare: () =>
				Effect.succeed(CommitComparison.make({ status: "ahead", aheadBy: 0, behindBy: 0, commits: [], files: [] })),
		}),
		GitHubIssue.layerTest({
			linkedIssues: (prNumber) => Effect.succeed(f.linked.get(prNumber) ?? []),
			get: (number) => {
				const found = f.issues.get(number);
				return found === undefined
					? Effect.fail(GitHubError.notFound("GitHubIssue.get", `issue ${number}`))
					: Effect.succeed(found);
			},
		}),
		PullRequest.layerTest({
			list: (options) =>
				Effect.succeed(
					f.prs.filter((p) => (options?.state === undefined || p.state === options.state) && p.base === TARGET_BRANCH),
				),
			get: (number) => {
				const found = f.prs.find((p) => p.number === number);
				return found === undefined
					? Effect.fail(GitHubError.notFound("PullRequest.get", `pr ${number}`))
					: Effect.succeed(found);
			},
			create: (input) =>
				Effect.sync(() => {
					const created = makePr({
						number: f.nextPrNumber++,
						head: input.head,
						base: input.base,
						state: "open",
						title: input.title,
						...(input.body === undefined ? {} : { body: input.body }),
					});
					f.prs.push(created);
					return created;
				}),
			update: (number, patch) =>
				Effect.sync(() => {
					const idx = f.prs.findIndex((p) => p.number === number);
					const merged = { ...(f.prs[idx] as unknown as Record<string, unknown>), ...patch } as PullRequestInfo;
					f.prs[idx] = merged;
					return merged;
				}),
			addLabels: (number, labels) =>
				Effect.sync(() => {
					f.labels.set(number, [...(f.labels.get(number) ?? []), ...labels]);
				}),
		}),
		Layer.succeed(Repo, RepoRef.make({ owner: "owner", repo: "repo" })),
		FileSystem.layerNoop({
			exists: () => Effect.succeed(false),
			readDirectory: () => Effect.succeed([...changesetFiles]),
			readFileString: () => Effect.succeed("file contents"),
		}),
		workspaceDiscoveryStub,
		publishabilityDetectorStub,
		changesetConfigStub,
		plannerLayer,
		configInspectorStub,
	);
	// Runner-shaped input names (`INPUT_<MANGLED>`), through `ActionInput.layer`.
	// The bare-name provider this replaces was keyed by names the runner never
	// writes, so the reads under test were resolving through a path production
	// does not take.
	//
	// NOTE: every value here equals its production default, so a mis-named input
	// still resolves to the same string — these reads are exercised but not yet
	// *discriminated*. Making them so needs non-default fixture values, which
	// ripples into the assertions; recorded as follow-up rather than done here.
	const refs = { releaseBranch: RELEASE_BRANCH, targetBranch: TARGET_BRANCH };
	const result = await Effect.runPromise(
		updateReleaseBranch(refs).pipe(
			Effect.provide(layer),
			Effect.provide(Logger.layer([])),
			Effect.provide(DryRun.layerFrom(false)),
		),
	);
	return { result, spawns: spawner.spawns };
};

/** Version-change path with one modified file in the `-z` status. */
const withCommit: GitOptions = { porcelain: PORCELAIN_CHANGED, porcelainZ: "M  package.json\0" };

/** No version changes — drives the close-PR-and-delete-branch cleanup path. */
const noVersionChange: GitOptions = { porcelain: "" };

describe("updateReleaseBranch", () => {
	// Shared harness: clears mocks and silences stdout/stderr so a log line
	// added to the module under test cannot start leaking into the reporter.
	beforeEach(() => setupTestEnvironment({ suppressOutput: true }));
	afterEach(() => cleanupTestEnvironment());

	it("creates a release PR when none exists and applies the automated/release labels", async () => {
		const f = makeFixtures();

		const { result } = await runStage(f);

		expect(result.deleted).toBe(false);
		const created = f.prs.find((pr) => pr.head === RELEASE_BRANCH);
		expect(created).toBeDefined();
		expect(result.prNumber).toBe(created?.number);
		expect(created?.base).toBe(TARGET_BRANCH);
		expect(created?.state).toBe("open");
		expect(f.labels.get(created?.number ?? -1)).toEqual(["automated", "release"]);
	});

	it("updates the existing open PR's title and does not create a new one", async () => {
		const f = makeFixtures({
			prs: [{ number: 42, head: RELEASE_BRANCH, base: TARGET_BRANCH, state: "open", title: "stale title" }],
		});

		const { result } = await runStage(f);

		expect(result.prNumber).toBe(42);
		expect(f.prs).toHaveLength(1);
		expect(f.prs[0].title).toBe("release: pending");
	});

	it("builds the PR link from GITHUB_SERVER_URL — not a hardcoded github.com (GHES)", async () => {
		// The summary table hardcoded `https://github.com`, so every link in it was
		// wrong on GitHub Enterprise Server. The seeded default is *also*
		// `https://github.com`, so a hardcoded host passes against it — this test
		// seeds a GHES host precisely so the two answers differ.
		const f = makeFixtures({
			prs: [{ number: 42, head: RELEASE_BRANCH, base: TARGET_BRANCH, state: "open" }],
		});

		await runStage(f, withCommit, [], releasePlannerStub, {
			GITHUB_SERVER_URL: "https://ghes.acme.internal",
		});

		// The linked PR row lives in the CHECK RUN output, not the job summary —
		// the job summary's PR cell is a bare `#42` with no link. Asserting on
		// `f.summaries` would pass or fail for the wrong reason.
		const checkOutput = f.completed.map((c) => c.output?.summary ?? "").join("\n");
		expect(checkOutput).toContain("https://ghes.acme.internal/owner/repo/pull/42");
		expect(checkOutput).not.toContain("https://github.com/owner/repo/pull/42");
	});

	it("REUSES an open PR — refreshes its managed body region even with no linked issues", async () => {
		// Spencer's directive: an open release PR is a resource to update in place,
		// never to close and recreate — its number, comments and review history are
		// attached to it.
		//
		// The body refresh used to be gated on `linkedIssues.length > 0`, so a
		// release with no linked issues kept a body from an earlier run, still
		// describing versions that had since moved. The managed region carries the
		// version summary and the squash block too, not just closing references.
		const f = makeFixtures({
			prs: [
				{
					number: 42,
					head: RELEASE_BRANCH,
					base: TARGET_BRANCH,
					state: "open",
					title: "stale title",
				},
			],
		});

		const { result } = await runStage(f);

		// Same PR, not a replacement.
		expect(result.prNumber).toBe(42);
		expect(f.prs).toHaveLength(1);
		expect(f.prs[0].state).toBe("open");

		// …and its body now carries our managed region.
		expect(f.prs[0].body ?? "").toContain(PrBody.Markers.MANAGED_START);
		expect(f.prs[0].body ?? "").toContain(PrBody.Markers.MANAGED_END);
	});

	it("REOPENS a PR closed MID-RUN — the guard reads state fresh, not the opening snapshot", async () => {
		// The stale-snapshot defect. `prWasClosed` is captured before the branch is
		// touched, so it can only answer "was it closed when we started". GitHub
		// closed #243 as a side effect of the ref moving — AFTER that snapshot —
		// and the reopen guard was therefore blind to it.
		//
		// The zero-diff window that caused it is gone, but the guard must survive
		// anything else that closes a release PR mid-run.
		const f = makeFixtures({
			prs: [{ number: 42, head: RELEASE_BRANCH, base: TARGET_BRANCH, state: "open", title: "stale title" }],
		});
		f.closeOnRefMove = 42;

		const { result } = await runStage(f, withCommit);

		expect(result.prNumber).toBe(42);
		expect(f.prs).toHaveLength(1);
		expect(f.prs[0].state).toBe("open");
		// …and it is REUSED, not just revived: the title is refreshed too. The old
		// guard skipped the title update whenever the PR had been closed.
		expect(f.prs[0].title).toBe("release: pending");
	});

	it("does NOT reopen a PR that was MERGED mid-run", async () => {
		// The merged check has to be reached to mean anything. Seeding a merged PR
		// at startup does not reach it — the closed-PR selection already skips
		// merged ones, so `prNumber` is never set and the guard never runs. The
		// case that DOES reach it is someone merging the release PR while the run
		// is in flight, which is also the case where reopening is catastrophic.
		const f = makeFixtures({
			prs: [{ number: 42, head: RELEASE_BRANCH, base: TARGET_BRANCH, state: "open", title: "stale title" }],
		});
		f.closeOnRefMove = 42;
		f.mergeOnRefMove = true;

		await runStage(f, withCommit);

		const pr42 = f.prs.find((p) => p.number === 42);
		expect(pr42?.state).toBe("closed");
		expect(pr42?.merged).toBe(true);
	});

	it("reopens a closed, unmerged PR instead of creating a new one", async () => {
		// THE LANDMINE. `mergedAt` is `Option.none()` here. The predecessor's
		// `(p.mergedAt ?? null) === null` is ALWAYS FALSE against an Option, so the
		// unmerged PR would never be found and a brand-new PR would be opened.
		const f = makeFixtures({
			prs: [
				{ number: 7, head: RELEASE_BRANCH, base: TARGET_BRANCH, state: "closed", merged: false, title: "stale title" },
			],
		});

		const { result } = await runStage(f);

		expect(result.prNumber).toBe(7);
		expect(f.prs).toHaveLength(1);
		expect(f.prs[0].state).toBe("open");
		// REUSE, not merely revive: a reopened PR gets the current title too. The
		// title update used to be gated on `!prWasClosed`, so a reopened release PR
		// kept a title naming an earlier version.
		expect(f.prs[0].title).toBe("release: pending");
	});

	it("ignores a closed PR that was actually merged", async () => {
		// The other side of the same guard: a merged PR must NOT be reopened, so a
		// new one is created instead.
		const f = makeFixtures({
			prs: [{ number: 8, head: RELEASE_BRANCH, base: TARGET_BRANCH, state: "closed", merged: true }],
		});

		const { result } = await runStage(f);

		expect(result.prNumber).not.toBe(8);
		expect(f.prs.find((p) => p.number === 8)?.state).toBe("closed");
		expect(f.prs).toHaveLength(2);
	});

	it("recreates the release branch from an EXPLICIT origin/<target> start point", async () => {
		// `git checkout -b <branch>` with no start point branches from ambient HEAD,
		// which this module never establishes. Branching from the wrong point
		// discards the release branch's prior commits, so the push that follows is a
		// non-descendant ref update — recorded by GitHub as `head_ref_force_pushed`,
		// which is the event seen on run 30212579721 despite no `--force` anywhere
		// in this module.
		const f = makeFixtures();

		const { spawns } = await runStage(f, withCommit);

		const checkout = spawns.find((sp) => sp.command === "git" && sp.args[0] === "checkout");
		expect(checkout).toBeDefined();
		// `-B`, not `-b`: `GitBranch.branchCreate(..., { force: true })` collapses
		// the old swallowed `branch -D` + `checkout -b` pair into ONE invocation.
		// That also fixes a real edge the pair had — `git branch -D` refuses to
		// delete the currently checked-out branch, so on a runner already sitting
		// on the release branch the delete failed silently and the `-b` then
		// failed for real.
		expect(checkout?.args).toEqual(["checkout", "-B", RELEASE_BRANCH, `origin/${TARGET_BRANCH}`]);

		// And the delete is GONE, not merely reordered — one invocation now.
		expect(spawns.filter((sp) => sp.command === "git" && sp.args[0] === "branch")).toHaveLength(0);
	});

	it("stages the working tree BEFORE reading the status that becomes the commit", async () => {
		// `git add` moves every change into the index, which is what makes the
		// second status read report `M ` rather than ` M`. Dropping the staging —
		// or running it after the read — leaves the commit's file list computed
		// from a different tree state than the one being committed. Nothing else
		// in this suite spawns it, so this is the only guard on the migrated
		// `Git.add` call.
		const f = makeFixtures();

		const { spawns } = await runStage(f, withCommit);

		const argv = spawns.map((sp) => [sp.command, ...sp.args].join(" "));
		const addIndex = argv.indexOf("git add -- .");
		expect(addIndex).toBeGreaterThanOrEqual(0);
		expect(argv.lastIndexOf("git status --porcelain -z")).toBeGreaterThan(addIndex);
	});

	it("NEVER points the release branch at the target head — the zero-diff window", async () => {
		// THE REGRESSION THIS SUITE EXISTS FOR. The previous sequence was
		// `upsert(branch, TARGET_HEAD)` then `commitFiles`, which left the release
		// branch EQUAL to the target head between the two calls. An open release
		// PR then has head === base, and **GitHub closes a PR whose head becomes
		// identical to its base**. Run 30212579721 lost PR #243 in a ~3.2s window
		// exactly there.
		//
		// The ref must move once, straight to the finished commit.
		const f = makeFixtures();

		await runStage(f, withCommit);

		expect(f.upserts).toEqual([{ name: RELEASE_BRANCH, sha: "newcommitsha" }]);
		expect(f.upserts.map((u) => u.sha)).not.toContain(TARGET_HEAD);
		expect(f.branches.get(RELEASE_BRANCH)).not.toBe(TARGET_HEAD);
	});

	it("roots the commit on the TARGET head's tree, with the target head as sole parent", async () => {
		// INVARIANT 2, unchanged by the atomic rewrite: the release branch stays a
		// single clean commit on the target, so the tree is built on the TARGET's
		// tree and the parent is the TARGET head — not the release branch's own.
		const f = makeFixtures();

		await runStage(f, withCommit);

		expect(f.trees).toHaveLength(1);
		expect(f.trees[0].baseTree).toBe(`tree-of-${TARGET_HEAD}`);
		expect(f.createdCommits).toHaveLength(1);
		expect(f.createdCommits[0].parents).toEqual([TARGET_HEAD]);
	});

	it("carries the staged changes into the commit", async () => {
		const f = makeFixtures();

		await runStage(f, withCommit);

		expect(f.commits[0].changes).toHaveLength(1);
		expect(f.commits[0].changes[0].path).toBe("package.json");
		expect(f.commits[0].message).toContain("Signed-off-by:");
	});

	it("records a deletion rather than a content change for a deleted file", async () => {
		const f = makeFixtures();

		await runStage(f, { porcelain: PORCELAIN_CHANGED, porcelainZ: "D  gone.txt\0" });

		expect(f.commits[0].changes).toHaveLength(1);
		expect(f.commits[0].changes[0]._tag).toBe("FileDeletion");
		expect(f.commits[0].changes[0].path).toBe("gone.txt");
	});

	it("does not commit at all when the -z status is empty", async () => {
		const f = makeFixtures();

		await runStage(f, { porcelain: PORCELAIN_CHANGED, porcelainZ: "" });

		expect(f.commits).toHaveLength(0);
		expect(f.upserts).toHaveLength(0);
	});

	it("surfaces an issue linked only through a merge commit's pull request", async () => {
		// The case the changeset-scoped predecessor could not see. The squash-merge
		// commit carries no closing keyword — the reference lives on PR #123, put
		// there by its body or by hand in the sidebar — and the commit adds no
		// changeset. Only the merge-commit half of the walk recovers it.
		const f = makeFixtures({
			prs: [{ number: 9, head: RELEASE_BRANCH, base: TARGET_BRANCH, state: "open" }],
			branchCommits: [branchCommit("sha111", "feat: add thing (#123)")],
			linkedIssues: [[123, [{ number: 55, title: "Linked bug" }]]],
			issueDetails: [{ number: 55, title: "Linked bug", state: "open", url: "https://x/55", nodeId: "I_55" }],
		});

		const { result } = await runStage(f, { porcelain: PORCELAIN_CHANGED }, ["feat.md"]);

		expect(result.linkedIssues.map((i: LinkedIssue) => i.number)).toContain(55);
	});

	it("omits an already-closed issue from the release", async () => {
		const f = makeFixtures({
			prs: [{ number: 9, head: RELEASE_BRANCH, base: TARGET_BRANCH, state: "open" }],
			branchCommits: [
				branchCommit("sha111", "fix: old work\n\nCloses #54"),
				branchCommit("sha222", "feat: new (#123)"),
			],
			linkedIssues: [[123, [{ number: 55, title: "Linked bug" }]]],
			issueDetails: [
				{ number: 54, title: "Shipped already", state: "closed" },
				{ number: 55, title: "Linked bug", state: "open", url: "https://x/55", nodeId: "I_55" },
			],
		});

		const { result } = await runStage(f, { porcelain: PORCELAIN_CHANGED }, ["feat.md"]);

		expect(result.linkedIssues.map((i: LinkedIssue) => i.number)).toEqual([55]);
	});

	it("closes the open release PR and deletes the branch when there are no version changes", async () => {
		const f = makeFixtures({
			prs: [{ number: 42, head: RELEASE_BRANCH, base: TARGET_BRANCH, state: "open" }],
		});

		const { result } = await runStage(f, noVersionChange);

		expect(result.deleted).toBe(true);
		expect(result.prNumber).toBeNull();
		expect(f.prs.find((pr) => pr.number === 42)?.state).toBe("closed");
		expect(f.deleted).toContain(RELEASE_BRANCH);
	});

	it("leaves an already-closed PR closed and still deletes the branch when there are no version changes", async () => {
		const f = makeFixtures({
			prs: [{ number: 7, head: RELEASE_BRANCH, base: TARGET_BRANCH, state: "closed", merged: false }],
		});

		const { result } = await runStage(f, noVersionChange);

		expect(result.deleted).toBe(true);
		expect(result.prNumber).toBeNull();
		expect(f.prs.find((pr) => pr.number === 7)?.state).toBe("closed");
		expect(f.deleted).toContain(RELEASE_BRANCH);
	});

	it("deletes the branch and creates no PR when there are no version changes and no PR exists", async () => {
		const f = makeFixtures();

		const { result } = await runStage(f, noVersionChange);

		expect(result.deleted).toBe(true);
		expect(result.prNumber).toBeNull();
		expect(f.prs).toHaveLength(0);
		expect(f.deleted).toContain(RELEASE_BRANCH);
	});

	it("FAILS when `git status` exits non-zero — it must never read as 'no version changes'", async () => {
		// The three tests above are exactly why this one matters. A demoted
		// non-zero exit yields empty stdout, which is indistinguishable from a
		// clean tree — and this module's no-change path CLOSES THE RELEASE PR
		// AND DELETES THE REMOTE RELEASE BRANCH, then returns `success: true`.
		// A transient git failure would destroy a live release and report a
		// clean run. `Run.text` makes the exit a typed failure; `Run.collect`
		// would make it a value and take the destructive branch.
		const f = makeFixtures({
			prs: [{ number: 42, head: RELEASE_BRANCH, base: TARGET_BRANCH, state: "open" }],
		});

		await expect(runStage(f, { porcelain: "", porcelainExit: 128 })).rejects.toThrow();

		// Nothing was destroyed on the way out.
		expect(f.prs.find((pr) => pr.number === 42)?.state).toBe("open");
		expect(f.deleted).not.toContain(RELEASE_BRANCH);
	});

	it("fails when native versioning fails", async () => {
		const f = makeFixtures();
		const failingPlanner = Changesets.makeReleasePlannerTest({});

		await expect(runStage(f, withCommit, [], failingPlanner)).rejects.toThrow(/ReleasePlanError|not provided/);
	});
});
