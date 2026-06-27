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

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import type { PullRequestInfo, PullRequestTestState } from "@savvy-web/github-action-effects/testing";
import { ActionEnvironmentTest, GitHubClientTest, PullRequestTest } from "@savvy-web/github-action-effects/testing";
import { Effect, Layer, Logger } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PhaseDetectionOptions, PhaseDetectionResult } from "../src/utils/detect-workflow-phase.js";
import { detectWorkflowPhase } from "../src/utils/detect-workflow-phase.js";

const RELEASE_BRANCH = "changeset-release/main";
const TARGET_BRANCH = "main";
const MERGE_COMMIT_SHA = "deadbeef123456";

interface Fixtures {
	prState: PullRequestTestState;
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
): Fixtures => {
	const prState = PullRequestTest.empty();
	let nextNumber = 1;
	for (const pr of params.prs ?? []) {
		prState.prs.push({
			number: pr.number,
			nodeId: `node-${pr.number}`,
			url: `https://github.com/owner/repo/pull/${pr.number}`,
			title: `PR #${pr.number}`,
			body: "",
			state: pr.state,
			head: pr.head,
			base: pr.base,
			draft: false,
			merged: (pr.mergedAt ?? null) !== null,
			mergedAt: pr.mergedAt ?? null,
			mergeCommitSha: pr.mergeCommitSha ?? null,
			labels: [],
			reviewers: [],
			teamReviewers: [],
			autoMerge: undefined,
		});
		nextNumber = Math.max(nextNumber, pr.number + 1);
	}
	prState.nextNumber = nextNumber;

	return { prState };
};

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
		ActionEnvironmentTest.layer({
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
		GitHubClientTest.empty(),
		PullRequestTest.layer(f.prState),
		FileSystem.layerNoop({ readFileString: () => Effect.succeed("{}") }),
	);

	return Effect.runPromise(
		detectWorkflowPhase({ releaseBranch: RELEASE_BRANCH, targetBranch: TARGET_BRANCH }).pipe(
			Effect.provide(layer),
			Effect.provide(Logger.replace(Logger.defaultLogger, Logger.none)),
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
	/** Event payload written to a real temp file and read via NodeFileSystem. */
	eventPayload?: unknown;
	/** When set, GITHUB_EVENT_PATH points here verbatim (e.g. a missing path). */
	eventPathOverride?: string;
	/** PRs returned by Strategy 1 (`listAssociatedWithCommit`) for `sha`. */
	associated?: PullRequestInfo[];
	options?: Partial<PhaseDetectionOptions>;
}

const runDetectFull = (params: FullParams): Promise<PhaseDetectionResult> => {
	const sha = params.sha ?? MERGE_COMMIT_SHA;
	const tmp = mkdtempSync(join(tmpdir(), "detect-phase-"));
	let eventPath = "";
	if (params.eventPathOverride !== undefined) {
		eventPath = params.eventPathOverride;
	} else if (params.eventPayload !== undefined) {
		eventPath = join(tmp, "event.json");
		writeFileSync(eventPath, JSON.stringify(params.eventPayload));
	}

	const prState = PullRequestTest.empty();
	if (params.associated !== undefined) {
		prState.associatedByCommit.set(sha, params.associated);
	}

	const layer = Layer.mergeAll(
		ActionEnvironmentTest.layer({
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
		GitHubClientTest.empty(),
		PullRequestTest.layer(prState),
		NodeFileSystem.layer,
	);

	return Effect.runPromise(
		detectWorkflowPhase({
			releaseBranch: RELEASE_BRANCH,
			targetBranch: TARGET_BRANCH,
			...params.options,
		}).pipe(Effect.provide(layer), Effect.provide(Logger.replace(Logger.defaultLogger, Logger.none))),
	).finally(() => rmSync(tmp, { recursive: true, force: true }));
};

const makeAssociatedPR = (over: Partial<PullRequestInfo> = {}): PullRequestInfo => ({
	number: 7,
	url: "https://github.com/owner/repo/pull/7",
	nodeId: "node-7",
	title: "chore: release",
	state: "closed",
	head: RELEASE_BRANCH,
	base: TARGET_BRANCH,
	draft: false,
	merged: true,
	mergedAt: "2026-01-15T12:00:00Z",
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
			associated: [makeAssociatedPR({ number: 4, merged: false, mergedAt: null })],
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
			eventPathOverride: join(tmpdir(), "does-not-exist-detect-phase.json"),
		});

		expect(result.phase).toBe("none");
		expect(result.commitMessage).toBe("");
	});

	it("falls back to an empty payload when the event file holds malformed JSON", async () => {
		const tmp = mkdtempSync(join(tmpdir(), "detect-bad-"));
		const bad = join(tmp, "event.json");
		writeFileSync(bad, "{ not valid json");
		try {
			const result = await runDetectFull({ ref: "refs/heads/some-feature", eventPathOverride: bad });
			expect(result.phase).toBe("none");
			expect(result.commitMessage).toBe("");
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
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
