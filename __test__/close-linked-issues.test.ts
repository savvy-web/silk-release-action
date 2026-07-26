/**
 * Tests for the close-linked-issues stage.
 *
 * @remarks
 * Written against the kit's `layerTest` seams. Two properties are load-bearing:
 * the whole stage is **non-fatal** (its error channel is `never`), so a failed
 * close is recorded and reported rather than aborting the phase; and dry-run
 * must reach neither `comment` nor `close`.
 */

import type { CheckRunOutput } from "@effected/github";
import { CheckRun, CheckRunRef, GitHubError, GitHubIssue, LinkedIssue, Repo, RepoRef } from "@effected/github";
import { ActionEnvironment, ActionOutputs } from "@effected/github-actions";
import { Effect, Layer, Logger } from "effect";
import { describe, expect, it } from "vitest";
import type { CloseLinkedIssuesResult } from "../src/utils/close-linked-issues.js";
import { closeLinkedIssues } from "../src/utils/close-linked-issues.js";

interface Recorder {
	readonly created: Array<{ name: string; sha: string }>;
	readonly completed: Array<{ id: number; conclusion: string; output?: CheckRunOutput | undefined }>;
	readonly comments: Array<number>;
	readonly closed: Array<number>;
	readonly outputs: Array<{ name: string; value: string }>;
	readonly summaries: Array<string>;
}

const makeRecorder = (): Recorder => ({
	created: [],
	completed: [],
	comments: [],
	closed: [],
	outputs: [],
	summaries: [],
});

const linked = (number: number, title: string): LinkedIssue =>
	LinkedIssue.make({
		number,
		title,
		state: "open",
		url: `https://x.test/issues/${number}`,
		nodeId: `I_${number}`,
		userLinked: true,
	});

interface Options {
	readonly issues?: ReadonlyArray<{ number: number; title: string }>;
	readonly linkedFails?: boolean;
	readonly closeFails?: boolean;
}

const makeLayer = (recorder: Recorder, options: Options) =>
	Layer.mergeAll(
		ActionEnvironment.layerTest({
			GITHUB_REPOSITORY: "savvy-web/silk-release-action",
			GITHUB_REPOSITORY_OWNER: "savvy-web",
			GITHUB_SHA: "deadbeef",
		}),
		ActionOutputs.layerTest({
			set: (name, value) => Effect.sync(() => void recorder.outputs.push({ name, value })),
			summary: (content) => Effect.sync(() => void recorder.summaries.push(content)),
		}),
		CheckRun.layerTest({
			create: (name, sha) =>
				Effect.sync(() => {
					recorder.created.push({ name, sha });
					return CheckRunRef.make({ id: 55, name, url: "https://x.test/checks/55", status: "in_progress" });
				}),
			complete: (id, conclusion, output) => Effect.sync(() => void recorder.completed.push({ id, conclusion, output })),
		}),
		GitHubIssue.layerTest({
			linkedIssues: () =>
				options.linkedFails === true
					? Effect.fail(GitHubError.rejected("GitHubIssue.linkedIssues", 500, "boom") as never)
					: Effect.succeed((options.issues ?? []).map((i) => linked(i.number, i.title))),
			comment: (number) =>
				Effect.sync(() => {
					recorder.comments.push(number);
					return 1;
				}),
			close: (number) =>
				options.closeFails === true
					? Effect.fail(GitHubError.rejected("GitHubIssue.close", 403, "no permission"))
					: Effect.sync(() => void recorder.closed.push(number)),
		}),
		Layer.succeed(Repo, RepoRef.make({ owner: "savvy-web", repo: "silk-release-action" })),
	);

const run = (recorder: Recorder, options: Options, dryRun = false): Promise<CloseLinkedIssuesResult> =>
	closeLinkedIssues(42, dryRun).pipe(
		Effect.provide(makeLayer(recorder, options)),
		Effect.provide(Logger.layer([])),
		Effect.runPromise,
	);

describe("closeLinkedIssues", () => {
	it("should comment on and close each linked issue", async () => {
		const recorder = makeRecorder();

		const result = await run(recorder, {
			issues: [
				{ number: 1, title: "a" },
				{ number: 2, title: "b" },
			],
		});

		expect(recorder.comments).toEqual([1, 2]);
		expect(recorder.closed).toEqual([1, 2]);
		expect(result.closedCount).toBe(2);
		expect(result.failedCount).toBe(0);
	});

	it("should create a check run against the head sha and complete it", async () => {
		const recorder = makeRecorder();

		await run(recorder, { issues: [{ number: 1, title: "a" }] });

		expect(recorder.created[0]?.sha).toBe("deadbeef");
		expect(recorder.completed).toHaveLength(1);
	});

	it("should skip real close calls in dry-run and flag the check name", async () => {
		const recorder = makeRecorder();

		const result = await run(recorder, { issues: [{ number: 1, title: "a" }] }, true);

		expect(recorder.created[0]?.name).toContain("Dry Run");
		expect(recorder.comments).toEqual([]);
		expect(recorder.closed).toEqual([]);
		expect(result.closedCount).toBe(1);
	});

	it("should report zero closures when the PR has no linked issues", async () => {
		const recorder = makeRecorder();

		const result = await run(recorder, { issues: [] });

		expect(result.closedCount).toBe(0);
		expect(recorder.outputs).toContainEqual({ name: "closed_issues_count", value: "0" });
	});

	it("should emit the closed-issue outputs", async () => {
		const recorder = makeRecorder();

		await run(recorder, { issues: [{ number: 7, title: "seven" }] });

		expect(recorder.outputs).toContainEqual({ name: "closed_issues_count", value: "1" });
		const payload = recorder.outputs.find((o) => o.name === "closed_issues")?.value ?? "[]";
		expect(JSON.parse(payload)).toEqual([{ number: 7, title: "seven", closed: true }]);
	});

	it("should record a failed close without failing the stage", async () => {
		const recorder = makeRecorder();

		// The stage's error channel is `never` — a 403 on one issue is reported,
		// not propagated, so a partially-successful run still finishes cleanly.
		const result = await run(recorder, { issues: [{ number: 1, title: "a" }], closeFails: true });

		expect(result.failedCount).toBe(1);
		expect(result.closedCount).toBe(0);
		expect(result.issues[0]?.error).toBeDefined();
	});

	it("should degrade to zero issues when the linked-issue query fails", async () => {
		const recorder = makeRecorder();

		const result = await run(recorder, { linkedFails: true });

		expect(result.closedCount).toBe(0);
		expect(recorder.comments).toEqual([]);
	});
});
