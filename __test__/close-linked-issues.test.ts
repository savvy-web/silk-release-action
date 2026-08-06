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
import {
	CheckRun,
	CheckRunRef,
	GitHubError,
	GitHubGraphQLError,
	GitHubIssue,
	LinkedIssue,
	Repo,
	RepoRef,
} from "@effected/github";
import { ActionEnvironment, ActionOutputs } from "@effected/github-actions";
import { Effect, Layer, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CloseLinkedIssuesResult } from "../src/utils/close-linked-issues.js";
import { closeLinkedIssues } from "../src/utils/close-linked-issues.js";
import { cleanupTestEnvironment, setupTestEnvironment } from "./utils/github-mocks.js";

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

const linked = (number: number, title: string, state = "open"): LinkedIssue =>
	LinkedIssue.make({
		number,
		title,
		state,
		url: `https://x.test/issues/${number}`,
		nodeId: `I_${number}`,
		userLinked: true,
	});

interface Options {
	readonly issues?: ReadonlyArray<{ number: number; title: string; state?: string }>;
	readonly linkedFails?: boolean;
	readonly closeFails?: boolean;
	readonly commentFails?: boolean;
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
					? // A real `GitHubGraphQLError` — the error type `linkedIssues` actually
						// declares, rather than a `GitHubError` cast to `never`.
						Effect.fail(
							new GitHubGraphQLError({
								kind: "transport",
								operation: "GitHubIssue.linkedIssues",
								reason: "boom",
								errors: [],
							}),
						)
					: Effect.succeed((options.issues ?? []).map((i) => linked(i.number, i.title, i.state))),
			comment: (number) =>
				options.commentFails === true
					? Effect.fail(GitHubError.rejected("GitHubIssue.comment", 403, "no permission"))
					: Effect.sync(() => {
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
	// Shared harness: clears mocks and silences stdout/stderr so a log line
	// added to the module under test cannot start leaking into the reporter.
	beforeEach(() => setupTestEnvironment({ suppressOutput: true }));
	afterEach(() => cleanupTestEnvironment());

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
		expect(recorder.outputs).toContainEqual({ name: "closed-issues-count", value: "0" });
	});

	it("should emit the closed-issue outputs", async () => {
		const recorder = makeRecorder();

		await run(recorder, { issues: [{ number: 7, title: "seven" }] });

		expect(recorder.outputs).toContainEqual({ name: "closed-issues-count", value: "1" });
		const payload = recorder.outputs.find((o) => o.name === "closed-issues")?.value ?? "[]";
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

	// ── Re-run idempotency (the property the whole "fail loudly so the operator
	// re-runs" posture in steps/publishing.ts depends on) ────────────────────
	describe("re-running must not double-apply", () => {
		it("should NOT comment again on an issue that is already closed", async () => {
			const recorder = makeRecorder();

			// The second run's view of the world: `linkedIssues` still returns the
			// issue — `closingIssuesReferences` does not filter by state — but it now
			// reports CLOSED. Before the guard, this posted a second "Closed by
			// release PR #42 merge." comment on every linked issue, every re-run.
			const result = await run(recorder, { issues: [{ number: 1, title: "a", state: "CLOSED" }] });

			expect(recorder.comments).toEqual([]);
			expect(recorder.closed).toEqual([]);
			// Counted as closed: it IS closed. Reporting it as a failure would fail
			// the phase forever on a successful release.
			expect(result.closedCount).toBe(1);
			expect(result.failedCount).toBe(0);
		});

		it("should treat the lower-case state spelling the same way", async () => {
			const recorder = makeRecorder();

			// GraphQL's IssueState is upper-case; the comparison is case-insensitive
			// so a differently-cased source cannot silently reopen the double-comment.
			const result = await run(recorder, { issues: [{ number: 1, title: "a", state: "closed" }] });

			expect(recorder.comments).toEqual([]);
			expect(result.closedCount).toBe(1);
		});

		it("should not comment when the close fails, so a re-run has nothing to duplicate", async () => {
			const recorder = makeRecorder();

			// The ordering guarantee. Comment-first would leave a comment behind on
			// the exact path that makes the operator re-run — and the re-run, seeing
			// the issue still open, would comment a second time.
			const result = await run(recorder, { issues: [{ number: 1, title: "a" }], closeFails: true });

			expect(recorder.comments).toEqual([]);
			expect(result.failedCount).toBe(1);
		});

		it("should still count the issue closed when only the comment fails", async () => {
			const recorder = makeRecorder();

			// The issue is closed; the comment is a courtesy. Reporting a failure
			// here would fail Phase 3 over a cosmetic call, and the re-run would skip
			// the issue anyway because it is already CLOSED.
			const result = await run(recorder, { issues: [{ number: 1, title: "a" }], commentFails: true });

			expect(recorder.closed).toEqual([1]);
			expect(result.closedCount).toBe(1);
			expect(result.failedCount).toBe(0);
		});
	});

	it("should degrade to zero issues when the linked-issue query fails", async () => {
		const recorder = makeRecorder();

		const result = await run(recorder, { linkedFails: true });

		expect(result.closedCount).toBe(0);
		expect(recorder.comments).toEqual([]);
	});
});
