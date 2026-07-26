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
 * 1. **`upsert` then `commitFiles`, in that order.** `commitFiles` cannot
 *    create or force-move a branch, so without the `upsert` the release branch
 *    is never reset onto the target head.
 * 2. **The commit is rooted on the TARGET branch head**, not the release
 *    branch's own head — what keeps the release branch one clean commit on main.
 * 3. **`mergedAt` is an `Option`.** The predecessor's `(p.mergedAt ?? null) ===
 *    null` compiles unchanged against an Option and is always false, which would
 *    silently stop closed-but-unmerged release PRs from ever being reopened.
 */

import type { SpawnRecord } from "@effected/commands";
import { ScriptedSpawner, ToolDiscovery } from "@effected/commands";
import type { CheckRunOutput, FileChange, IssueInfo, PullRequestInfo } from "@effected/github";
import {
	CheckRun,
	CheckRunRef,
	GitBranch,
	GitCommit,
	GitHubError,
	GitHubIssue,
	LinkedIssue as KitLinkedIssue,
	PullRequest,
	Repo,
	RepoRef,
} from "@effected/github";
import { ActionEnvironment, ActionOutputs, ActionState, ActionStateError } from "@effected/github-actions";
import { PublishabilityDetector, WorkspaceDiscovery } from "@effected/workspaces";
import { Changesets } from "@savvy-web/silk-effects";
import { ConfigProvider, DateTime, Effect, FileSystem, Layer, Logger, Option } from "effect";
import { describe, expect, it } from "vitest";
import { ChangesetConfig } from "../src/release/changeset-config.js";
import type { LinkedIssue, UpdateReleaseBranchResult } from "../src/utils/update-release-branch.js";
import { updateReleaseBranch } from "../src/utils/update-release-branch.js";

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
	labels: Map<number, string[]>;
	issues: Map<number, IssueInfo>;
	linked: Map<number, KitLinkedIssue[]>;
	branches: Map<string, string>;
	/** Every `GitBranch.upsert` call, in order. */
	upserts: Array<{ name: string; sha: string }>;
	/** Every `GitCommit.commitFiles` call, in order. */
	commits: Array<{ branch: string; message: string; changes: ReadonlyArray<FileChange> }>;
	deleted: string[];
	completed: Array<{ conclusion: string; output: CheckRunOutput | undefined }>;
	summaries: string[];
	nextPrNumber: number;
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
		labels: new Map(),
		issues,
		linked,
		branches: new Map(params.branches ?? [[RELEASE_BRANCH, "deadbeef"]]),
		upserts: [],
		commits: [],
		deleted: [],
		completed: [],
		summaries: [],
		nextPrNumber: Math.max(0, ...prs.map((p) => p.number)) + 1,
	};
};

// --- git script ----------------------------------------------------------

/** `git status --porcelain` stdout that drives the version-change branch. */
const PORCELAIN_CHANGED = "M package.json\nM CHANGELOG.md";

interface GitOptions {
	/** `git status --porcelain` stdout. Empty drives the no-change cleanup path. */
	readonly porcelain?: string;
	/** `git status --porcelain` exit code. Non-zero must FAIL the stage, not read as "no changes". */
	readonly porcelainExit?: number;
	/** `git status --porcelain -z` stdout, which becomes the commit's file list. */
	readonly porcelainZ?: string;
	/** `git log` stdout, keyed by the changeset file path it targets. */
	readonly logs?: Record<string, string>;
}

const gitScript = (options: GitOptions) => (command: string, args: ReadonlyArray<string>) => {
	if (command !== "git") return ScriptedSpawner.notFound(command);
	const argv = args.join(" ");
	if (argv === "status --porcelain")
		return { exit: options.porcelainExit ?? 0, stdout: options.porcelain ?? "", stderr: "fatal: not a git repository" };
	if (argv === "status --porcelain -z") return { exit: 0, stdout: options.porcelainZ ?? "", stderr: "" };
	if (args[0] === "log") {
		const path = args[args.length - 1];
		return { exit: 0, stdout: options.logs?.[path] ?? "", stderr: "" };
	}
	// branch -D, checkout -b, add ., fetch …
	return { exit: 0, stdout: "", stderr: "" };
};

// --- runner --------------------------------------------------------------

const runStage = async (
	f: Fixtures,
	git: GitOptions = { porcelain: PORCELAIN_CHANGED },
	changesetFiles: ReadonlyArray<string> = [],
	plannerLayer: Layer.Layer<Changesets.ReleasePlanner> = releasePlannerStub,
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
		}),
		ActionOutputs.layerTest({
			summary: (content) =>
				Effect.sync(() => {
					f.summaries.push(content);
				}),
		}),
		// No token persisted, so the sign-off takes its `github-actions[bot]` fallback.
		ActionState.layerTest({
			get: ((key: string) =>
				Effect.fail(new ActionStateError({ reason: "missing", key }))) as ActionState["Service"]["get"],
		}),
		// `exists` answers false, so `formatWorkspaceWithBiome` returns before
		// probing — an unstubbed `isAvailable` would die if it did not.
		ToolDiscovery.layerTest(),
		spawner.layer,
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
					return "reset" as const;
				}),
			delete: (name) =>
				Effect.sync(() => {
					f.deleted.push(name);
					f.branches.delete(name);
				}),
		}),
		GitCommit.layerTest({
			commitFiles: ({ branch, message, changes }) =>
				Effect.sync(() => {
					f.commits.push({ branch, message, changes });
					return "newcommitsha";
				}),
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
	const config = ConfigProvider.fromUnknown({
		"release-branch": RELEASE_BRANCH,
		"target-branch": TARGET_BRANCH,
		"pr-title-prefix": "chore: release",
		"dry-run": "false",
	});
	const result = await Effect.runPromise(
		updateReleaseBranch().pipe(
			Effect.provide(layer),
			Effect.provide(Logger.layer([])),
			Effect.provide(ConfigProvider.layer(config)),
		),
	);
	return { result, spawns: spawner.spawns };
};

/** Version-change path with one modified file in the `-z` status. */
const withCommit: GitOptions = { porcelain: PORCELAIN_CHANGED, porcelainZ: "M  package.json\0" };

/** No version changes — drives the close-PR-and-delete-branch cleanup path. */
const noVersionChange: GitOptions = { porcelain: "" };

describe("updateReleaseBranch", () => {
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
		expect(f.prs[0].title).toBe("chore: release");
	});

	it("reopens a closed, unmerged PR instead of creating a new one", async () => {
		// THE LANDMINE. `mergedAt` is `Option.none()` here. The predecessor's
		// `(p.mergedAt ?? null) === null` is ALWAYS FALSE against an Option, so the
		// unmerged PR would never be found and a brand-new PR would be opened.
		const f = makeFixtures({
			prs: [{ number: 7, head: RELEASE_BRANCH, base: TARGET_BRANCH, state: "closed", merged: false }],
		});

		const { result } = await runStage(f);

		expect(result.prNumber).toBe(7);
		expect(f.prs).toHaveLength(1);
		expect(f.prs[0].state).toBe("open");
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

	it("upserts the release branch onto the target head BEFORE committing", async () => {
		// INVARIANT 1 + 2. `commitFiles` can neither create nor force-move a
		// branch, so the `upsert` is what resets the release branch onto the
		// target head — and it must happen first, or the commit is rooted wrong.
		const f = makeFixtures();

		await runStage(f, withCommit);

		expect(f.upserts).toEqual([{ name: RELEASE_BRANCH, sha: TARGET_HEAD }]);
		expect(f.commits).toHaveLength(1);
		expect(f.commits[0].branch).toBe(RELEASE_BRANCH);
		// The branch was pointing at the TARGET head when the commit was written.
		expect(f.branches.get(RELEASE_BRANCH)).toBe(TARGET_HEAD);
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

	it("surfaces linked issues harvested from changeset commits", async () => {
		const f = makeFixtures({
			prs: [{ number: 9, head: RELEASE_BRANCH, base: TARGET_BRANCH, state: "open" }],
			linkedIssues: [[123, [{ number: 55, title: "Linked bug" }]]],
			issueDetails: [{ number: 55, title: "Linked bug", state: "open", url: "https://x/55", nodeId: "I_55" }],
		});

		const { result } = await runStage(
			f,
			{
				porcelain: PORCELAIN_CHANGED,
				logs: { ".changeset/feat.md": "sha111\nfeat: add thing (#123)\n---END---\n" },
			},
			["feat.md"],
		);

		expect(result.linkedIssues.map((i: LinkedIssue) => i.number)).toContain(55);
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
