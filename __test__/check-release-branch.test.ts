/**
 * Tests for the release-branch state check.
 *
 * @remarks
 * Written against the kit's `layerTest` seams. The two failure-tolerance cases
 * matter most: a branch-existence probe and a PR lookup that fail must degrade
 * to "no branch" / "no PR" rather than aborting Phase 1. This check is
 * diagnostic — it decides between create and update — so a transient API blip
 * must not stop a release.
 */

import type { CheckRunOutput } from "@effected/github";
import {
	CheckRun,
	CheckRunRef,
	GitBranch,
	GitHubError,
	PullRequest,
	PullRequestInfo,
	Repo,
	RepoRef,
} from "@effected/github";
import { ActionEnvironment, ActionOutputs } from "@effected/github-actions";
import { Effect, Layer, Logger, Option } from "effect";
import { describe, expect, it } from "vitest";
import type { ReleaseBranchCheckResult } from "../src/utils/check-release-branch.js";
import { checkReleaseBranch } from "../src/utils/check-release-branch.js";

interface Recorder {
	readonly created: Array<{ name: string; sha: string }>;
	readonly completed: Array<{ id: number; conclusion: string; output?: CheckRunOutput | undefined }>;
	readonly summaries: Array<string>;
}

const makeRecorder = (): Recorder => ({ created: [], completed: [], summaries: [] });

interface Options {
	readonly exists?: boolean;
	readonly prs?: ReadonlyArray<{ number: number; url: string }>;
	readonly existsFails?: boolean;
	readonly listFails?: boolean;
}

const prInfo = (number: number, url: string): PullRequestInfo =>
	PullRequestInfo.make({
		number,
		nodeId: `PR_${number}`,
		url,
		title: "chore: release",
		state: "open",
		head: "changeset-release/main",
		headSha: `head-sha-${number}`,
		base: "main",
		baseSha: `base-sha-${number}`,
		draft: false,
		merged: false,
		mergedAt: Option.none(),
	});

const makeLayer = (recorder: Recorder, options: Options) =>
	Layer.mergeAll(
		ActionEnvironment.layerTest({
			GITHUB_REPOSITORY: "savvy-web/silk-release-action",
			GITHUB_REPOSITORY_OWNER: "savvy-web",
			GITHUB_SHA: "deadbeef",
		}),
		ActionOutputs.layerTest({
			summary: (content) => Effect.sync(() => void recorder.summaries.push(content)),
		}),
		CheckRun.layerTest({
			create: (name, sha) =>
				Effect.sync(() => {
					recorder.created.push({ name, sha });
					return CheckRunRef.make({ id: 77, name, url: "https://x.test/checks/77", status: "in_progress" });
				}),
			complete: (id, conclusion, output) => Effect.sync(() => void recorder.completed.push({ id, conclusion, output })),
		}),
		GitBranch.layerTest({
			exists: () =>
				options.existsFails === true
					? Effect.fail(GitHubError.rejected("GitBranch.exists", 500, "boom"))
					: Effect.succeed(options.exists ?? false),
		}),
		PullRequest.layerTest({
			list: () =>
				options.listFails === true
					? Effect.fail(GitHubError.rejected("PullRequest.list", 500, "boom"))
					: Effect.succeed((options.prs ?? []).map((p) => prInfo(p.number, p.url))),
		}),
		Layer.succeed(Repo, RepoRef.make({ owner: "savvy-web", repo: "silk-release-action" })),
	);

const run = (recorder: Recorder, options: Options, dryRun = false): Promise<ReleaseBranchCheckResult> =>
	checkReleaseBranch("changeset-release/main", "main", dryRun).pipe(
		Effect.provide(makeLayer(recorder, options)),
		Effect.provide(Logger.layer([])),
		Effect.runPromise,
	);

describe("checkReleaseBranch", () => {
	it("should report the branch and its open PR", async () => {
		const result = await run(makeRecorder(), {
			exists: true,
			prs: [{ number: 189, url: "https://x.test/pr/189" }],
		});

		expect(result.exists).toBe(true);
		expect(result.hasOpenPr).toBe(true);
		expect(result.prNumber).toBe(189);
	});

	it("should report a branch with no open PR", async () => {
		const result = await run(makeRecorder(), { exists: true, prs: [] });

		expect(result.exists).toBe(true);
		expect(result.hasOpenPr).toBe(false);
		expect(result.prNumber).toBeNull();
	});

	it("should report an absent branch", async () => {
		const result = await run(makeRecorder(), { exists: false });

		expect(result.exists).toBe(false);
		expect(result.hasOpenPr).toBe(false);
	});

	it("should flag dry-run in the check-run title", async () => {
		const recorder = makeRecorder();
		await run(recorder, { exists: false }, true);

		expect(recorder.created[0]?.name).toContain("Dry Run");
	});

	it("should create and complete a check run against the head sha", async () => {
		const recorder = makeRecorder();
		const result = await run(recorder, { exists: true, prs: [] });

		expect(recorder.created[0]?.sha).toBe("deadbeef");
		expect(recorder.completed[0]?.conclusion).toBe("success");
		expect(result.checkId).toBe(77);
	});

	it("should degrade to 'no branch' when the existence probe fails", async () => {
		// Diagnostic, not a gate: a transient API failure must not abort Phase 1.
		const result = await run(makeRecorder(), { existsFails: true });

		expect(result.exists).toBe(false);
		expect(result.hasOpenPr).toBe(false);
	});

	it("should degrade to 'no PR' when the PR lookup fails", async () => {
		const result = await run(makeRecorder(), { exists: true, listFails: true });

		expect(result.exists).toBe(true);
		expect(result.hasOpenPr).toBe(false);
		expect(result.prNumber).toBeNull();
	});
});
