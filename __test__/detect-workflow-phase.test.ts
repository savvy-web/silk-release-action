/**
 * Fixture tests for the detect-workflow-phase module.
 *
 * @remarks
 * Exercises the `PullRequest.list` rewire (Strategy 2 — closed-PR / merge-SHA
 * lookup) and the fall-through path where no merged release PR is found.
 * Strategy 1 (`listPullRequestsAssociatedWithCommit`) is left raw ("Bucket B");
 * `GitHubClientTest.empty()` causes it to return a `Left` so the test falls
 * through to Strategy 2 on every run.
 */

import { GitHubError, PullRequest, PullRequestInfo, Repo, RepoRef } from "@effected/github";
import { ActionEnvironment } from "@effected/github-actions";
import { MemoryFileSystem } from "@effected/memfs";
import { DateTime, Effect, Layer, Logger, Option } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PhaseDetectionOptions, PhaseDetectionResult } from "../src/utils/detect-workflow-phase.js";
import { detectWorkflowPhase } from "../src/utils/detect-workflow-phase.js";

/** Where every seeded event payload lives in the in-memory volume. */
const EVENT_PATH = "/event.json";

const RELEASE_BRANCH = "changeset-release/main";
const TARGET_BRANCH = "main";
const MERGE_COMMIT_SHA = "deadbeef123456";

interface Fixtures {
	prs: ReadonlyArray<PullRequestInfo>;
}

const makeFixtures = (
	params: {
		prs?: Array<{
			number: number;
			head: string;
			base: string;
			state: "open" | "closed";
			mergedAt?: string | null;
			mergeCommitSha?: string | null;
		}>;
	} = {},
): Fixtures => ({
	prs: (params.prs ?? []).map((pr) =>
		PullRequestInfo.make({
			number: pr.number,
			nodeId: `node-${pr.number}`,
			url: `https://github.com/owner/repo/pull/${pr.number}`,
			title: `PR #${pr.number}`,
			state: pr.state,
			// `head`/`base`, NOT `headRef`/`baseRef`.
			head: pr.head,
			headSha: `head-sha-${pr.number}`,
			base: pr.base,
			baseSha: `base-sha-${pr.number}`,
			draft: false,
			merged: (pr.mergedAt ?? null) !== null,
			// `mergedAt` is a REQUIRED Option on the kit's shape.
			mergedAt: pr.mergedAt == null ? Option.none() : Option.some(DateTime.makeUnsafe(pr.mergedAt)),
			...(pr.mergeCommitSha == null ? {} : { mergeCommitSha: pr.mergeCommitSha }),
		}),
	),
});

/**
 * Run `detectWorkflowPhase` against the given fixtures.
 *
 * @remarks
 * The SHA is set to `MERGE_COMMIT_SHA` so tests can control whether a seeded
 * PR's `mergeCommitSha` matches. `GitHubClientTest.empty()` is used so the
 * `listPullRequestsAssociatedWithCommit` call (Strategy 1) always fails with a
 * 404, driving execution to Strategy 2 (the rewired `pr.list` call).
 *
 * `GITHUB_EVENT_PATH` is intentionally blank so `readEventPayload` short-circuits
 * before touching the filesystem, avoiding any need for a real FileSystem layer.
 */
const runDetect = (f: Fixtures): Promise<PhaseDetectionResult> => {
	const layer = Layer.mergeAll(
		ActionEnvironment.layerTest({
			GITHUB_SHA: MERGE_COMMIT_SHA,
			GITHUB_REF: `refs/heads/${TARGET_BRANCH}`,
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
		PullRequest.layerTest({
			// Strategy 1 always 404s, driving execution to Strategy 2 (`pr.list`) —
			// the same routing the predecessor's empty client produced.
			listAssociatedWithCommit: () =>
				Effect.fail(GitHubError.notFound("PullRequest.listAssociatedWithCommit", "commit")),
			list: () => Effect.succeed(f.prs),
		}),
		Layer.succeed(Repo, RepoRef.make({ owner: "owner", repo: "repo" })),
		// An empty volume. `detectWorkflowPhase` itself reads no files — this only
		// satisfies the `FileSystem` requirement its dependencies carry — so nothing
		// is seeded, and a read that DID happen would fail typed rather than being
		// answered `"{}"` by a stub that could not tell one path from another.
		MemoryFileSystem.layer,
	);

	return Effect.runPromise(
		detectWorkflowPhase({ releaseBranch: RELEASE_BRANCH, targetBranch: TARGET_BRANCH }).pipe(
			Effect.provide(layer),
			Effect.provide(Logger.layer([])),
		),
	);
};

describe("detectWorkflowPhase", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns phase=publishing when a closed PR with matching mergeCommitSha is found (Strategy 2)", async () => {
		// Seed a merged release PR whose merge_commit_sha matches the push SHA.
		// Strategy 1 will fail (GitHubClientTest.empty()), driving code to Strategy 2.
		const f = makeFixtures({
			prs: [
				{
					number: 7,
					head: RELEASE_BRANCH,
					base: TARGET_BRANCH,
					state: "closed",
					mergedAt: "2026-01-15T12:00:00Z",
					mergeCommitSha: MERGE_COMMIT_SHA,
				},
			],
		});

		const result = await runDetect(f);

		expect(result.phase).toBe("publishing");
		expect(result.isReleaseCommit).toBe(true);
		expect(result.mergedReleasePRNumber).toBe(7);
		expect(result.isMainBranch).toBe(true);
		expect(result.isReleaseBranch).toBe(false);
	});

	it("returns phase=branch-management when no merged PR matches the commit SHA (Strategy 2 fall-through)", async () => {
		// No PRs seeded — Strategy 2 finds nothing matching the SHA.
		// detectReleaseCommit retries 3× with 5s delays; fake timers skip the waits.
		vi.useFakeTimers();
		const f = makeFixtures();

		const resultPromise = runDetect(f);
		await vi.advanceTimersByTimeAsync(60000);
		const result = await resultPromise;

		expect(result.phase).toBe("branch-management");
		expect(result.isReleaseCommit).toBe(false);
		expect(result.mergedReleasePRNumber).toBeUndefined();
		expect(result.isMainBranch).toBe(true);
	});

	it("ignores a closed PR with a non-matching mergeCommitSha and falls through to branch-management", async () => {
		// A real merged PR exists, but its SHA does not match the push event SHA.
		// Still retries 3× before returning false; fake timers skip the waits.
		vi.useFakeTimers();
		const f = makeFixtures({
			prs: [
				{
					number: 3,
					head: RELEASE_BRANCH,
					base: TARGET_BRANCH,
					state: "closed",
					mergedAt: "2026-01-10T09:00:00Z",
					mergeCommitSha: "aaaa0000differentsha",
				},
			],
		});

		const resultPromise = runDetect(f);
		await vi.advanceTimersByTimeAsync(60000);
		const result = await resultPromise;

		expect(result.phase).toBe("branch-management");
		expect(result.isReleaseCommit).toBe(false);
		expect(result.mergedReleasePRNumber).toBeUndefined();
	});

	it("ignores a closed PR whose mergeCommitSha matches but is not actually merged (mergedAt null)", async () => {
		// merge_commit_sha matches the push SHA, but the PR was closed without
		// merging (mergedAt null). The `(p.mergedAt ?? null) !== null` guard must
		// reject it. Retries 3× before returning false; fake timers skip the waits.
		vi.useFakeTimers();
		const f = makeFixtures({
			prs: [
				{
					number: 9,
					head: RELEASE_BRANCH,
					base: TARGET_BRANCH,
					state: "closed",
					mergedAt: null,
					mergeCommitSha: MERGE_COMMIT_SHA,
				},
			],
		});

		const resultPromise = runDetect(f);
		await vi.advanceTimersByTimeAsync(60000);
		const result = await resultPromise;

		expect(result.phase).toBe("branch-management");
		expect(result.isReleaseCommit).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Flexible harness: control branch, event name, event payload, associated PRs,
// and explicit-phase overrides without forcing Strategy 2 / fake timers.
// ---------------------------------------------------------------------------

interface FullParams {
	ref?: string;
	eventName?: string;
	sha?: string;
	/** Event payload seeded into the volume as JSON at `EVENT_PATH`. */
	eventPayload?: unknown;
	/** Raw bytes seeded at `EVENT_PATH` verbatim — for a payload that is not valid JSON. */
	rawEvent?: string;
	/** Points GITHUB_EVENT_PATH at this path and seeds NOTHING there (the missing-file case). */
	unseededEventPath?: string;
	/** PRs returned by Strategy 1 (`listAssociatedWithCommit`) for `sha`. */
	associated?: PullRequestInfo[];
	options?: Partial<PhaseDetectionOptions>;
}

const runDetectFull = (params: FullParams): Promise<PhaseDetectionResult> => {
	const sha = params.sha ?? MERGE_COMMIT_SHA;

	// The event file lives in the in-memory volume, not on the host disk. Only
	// ONE of these three shapes applies per case: a JSON payload, raw bytes that
	// are deliberately not JSON, or a path that is deliberately absent.
	let eventPath = "";
	const seed: Record<string, string> = {};
	if (params.unseededEventPath !== undefined) {
		eventPath = params.unseededEventPath;
	} else if (params.rawEvent !== undefined) {
		eventPath = EVENT_PATH;
		seed[EVENT_PATH] = params.rawEvent;
	} else if (params.eventPayload !== undefined) {
		eventPath = EVENT_PATH;
		seed[EVENT_PATH] = JSON.stringify(params.eventPayload);
	}

	// One layer VALUE, provided in two places, so both provisions memoize onto
	// the same volume rather than building two that could drift apart.
	const fileSystem = MemoryFileSystem.layerWith(seed);
	const associated = params.associated;

	const layer = Layer.mergeAll(
		// `makeTest` provided with a WORKING FileSystem, not `layerTest`.
		// `layerTest` is documented as "makeTest behind a layer, with FileSystem
		// STUBBED OUT" — so its `payload` never reads the seeded event file these
		// cases rely on, and the FileSystem merged below would not reach it.
		// Seeding `GITHUB_EVENT_PATH` and getting an empty payload back is the
		// false green this harness exists to avoid. The implementation only has to
		// be a real one; it does not have to be the host's.
		Layer.effect(ActionEnvironment)(
			ActionEnvironment.makeTest({
				GITHUB_SHA: sha,
				GITHUB_REF: params.ref ?? `refs/heads/${TARGET_BRANCH}`,
				GITHUB_REPOSITORY: "owner/repo",
				GITHUB_REPOSITORY_OWNER: "owner",
				GITHUB_WORKSPACE: "/workspace",
				GITHUB_EVENT_NAME: params.eventName ?? "push",
				GITHUB_EVENT_PATH: eventPath,
				GITHUB_RUN_ID: "1",
				GITHUB_RUN_NUMBER: "1",
				GITHUB_ACTOR: "test",
				GITHUB_SERVER_URL: "https://github.com",
				GITHUB_API_URL: "https://api.github.com",
			}),
		).pipe(Layer.provide(fileSystem)),
		PullRequest.layerTest({
			listAssociatedWithCommit: () =>
				associated === undefined
					? Effect.fail(GitHubError.notFound("PullRequest.listAssociatedWithCommit", "commit"))
					: Effect.succeed(associated),
			list: () => Effect.succeed([]),
		}),
		Layer.succeed(Repo, RepoRef.make({ owner: "owner", repo: "repo" })),
		fileSystem,
	);

	return Effect.runPromise(
		detectWorkflowPhase({
			releaseBranch: RELEASE_BRANCH,
			targetBranch: TARGET_BRANCH,
			...params.options,
		}).pipe(Effect.provide(layer), Effect.provide(Logger.layer([]))),
	);
};

const makeAssociatedPR = (over: Partial<PullRequestInfo> = {}): PullRequestInfo =>
	PullRequestInfo.make({
		number: 7,
		url: "https://github.com/owner/repo/pull/7",
		nodeId: "node-7",
		title: "chore: release",
		state: "closed",
		head: RELEASE_BRANCH,
		headSha: "head-sha-7",
		base: TARGET_BRANCH,
		baseSha: "base-sha-7",
		draft: false,
		merged: true,
		mergedAt: Option.some(DateTime.makeUnsafe("2026-01-15T12:00:00Z")),
		mergeCommitSha: MERGE_COMMIT_SHA,
		...over,
	});

describe("detectWorkflowPhase — Strategy 1 (commit association)", () => {
	it("detects publishing via an associated merged release PR without retrying", async () => {
		const result = await runDetectFull({ associated: [makeAssociatedPR({ number: 11 })] });

		expect(result.phase).toBe("publishing");
		expect(result.isReleaseCommit).toBe(true);
		expect(result.mergedReleasePRNumber).toBe(11);
		expect(result.reason).toContain("#11");
	});

	it("ignores an associated PR that is not merged and falls through to Strategy 2", async () => {
		vi.useFakeTimers();
		const resultPromise = runDetectFull({
			associated: [makeAssociatedPR({ number: 4, merged: false, mergedAt: Option.none() })],
		});
		await vi.advanceTimersByTimeAsync(60000);
		const result = await resultPromise;

		expect(result.phase).toBe("branch-management");
		expect(result.isReleaseCommit).toBe(false);
	});
});

describe("detectWorkflowPhase — event-driven phases", () => {
	it("returns close-issues when a release PR is merged via a pull_request event", async () => {
		const result = await runDetectFull({
			eventName: "pull_request",
			eventPayload: {
				pull_request: { merged: true, number: 22, head: { ref: RELEASE_BRANCH }, base: { ref: TARGET_BRANCH } },
			},
		});

		expect(result.phase).toBe("close-issues");
		expect(result.isReleasePRMerged).toBe(true);
		expect(result.mergedReleasePRNumber).toBe(22);
		expect(result.isReleaseCommit).toBe(true);
	});

	it("returns none for a pull_request event that is not merged", async () => {
		const result = await runDetectFull({
			ref: "refs/heads/feature",
			eventName: "pull_request",
			eventPayload: {
				pull_request: { merged: false, number: 5, head: { ref: "feature" }, base: { ref: TARGET_BRANCH } },
			},
		});

		expect(result.phase).toBe("none");
		expect(result.isPullRequestEvent).toBe(true);
		expect(result.isPRMerged).toBe(false);
		expect(result.isReleasePRMerged).toBe(false);
	});

	it("returns validation for a push to the release branch", async () => {
		const result = await runDetectFull({ ref: `refs/heads/${RELEASE_BRANCH}` });

		expect(result.phase).toBe("validation");
		expect(result.isReleaseBranch).toBe(true);
		expect(result.reason).toContain(RELEASE_BRANCH);
	});

	it("returns none when on neither the target nor the release branch", async () => {
		const result = await runDetectFull({ ref: "refs/heads/some-feature" });

		expect(result.phase).toBe("none");
		expect(result.reason).toContain("Not on");
	});

	it("truncates a long head_commit message to 100 chars with an ellipsis", async () => {
		const longMessage = "x".repeat(150);
		const result = await runDetectFull({
			ref: "refs/heads/some-feature",
			eventPayload: { head_commit: { message: longMessage } },
		});

		expect(result.commitMessage.endsWith("...")).toBe(true);
		expect(result.commitMessage).toHaveLength(103);
	});

	it("falls back to an empty payload when GITHUB_EVENT_PATH points at a missing file", async () => {
		const result = await runDetectFull({
			ref: "refs/heads/some-feature",
			unseededEventPath: "/does-not-exist-detect-phase.json",
		});

		expect(result.phase).toBe("none");
		expect(result.commitMessage).toBe("");
	});

	it("falls back to an empty payload when the event file holds malformed JSON", async () => {
		const result = await runDetectFull({ ref: "refs/heads/some-feature", rawEvent: "{ not valid json" });

		expect(result.phase).toBe("none");
		expect(result.commitMessage).toBe("");
	});
});

describe("detectWorkflowPhase — explicit phase override", () => {
	it("short-circuits to the explicit phase and backfills the PR for publishing", async () => {
		const result = await runDetectFull({
			associated: [makeAssociatedPR({ number: 33 })],
			options: { explicitPhase: "publishing" },
		});

		expect(result.phase).toBe("publishing");
		expect(result.reason).toContain("Explicit phase provided");
		expect(result.isReleaseCommit).toBe(true);
		expect(result.mergedReleasePRNumber).toBe(33);
	});

	it("backfills the merged PR number from the payload for an explicit close-issues phase", async () => {
		const result = await runDetectFull({
			eventName: "pull_request",
			eventPayload: {
				pull_request: { merged: true, number: 44, head: { ref: RELEASE_BRANCH }, base: { ref: TARGET_BRANCH } },
			},
			options: { explicitPhase: "close-issues" },
		});

		expect(result.phase).toBe("close-issues");
		expect(result.mergedReleasePRNumber).toBe(44);
		expect(result.isReleaseCommit).toBe(true);
	});

	it("returns the explicit phase verbatim without API calls for a non-publishing phase", async () => {
		const result = await runDetectFull({
			ref: "refs/heads/some-feature",
			options: { explicitPhase: "validation" },
		});

		expect(result.phase).toBe("validation");
		expect(result.isReleaseCommit).toBe(false);
		expect(result.mergedReleasePRNumber).toBeUndefined();
	});
});
