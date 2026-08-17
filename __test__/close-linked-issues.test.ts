/**
 * Tests for the close-linked-issues stage.
 *
 * @remarks
 * Written against the kit's `layerTest` seams. Two properties are load-bearing:
 * the whole stage is **non-fatal** (its error channel is `never`), so a failed
 * close is recorded and reported rather than aborting the phase; and dry-run
 * must reach neither `commentOnce` nor `close`.
 */

import type { CheckRunOutput } from "@effected/github";
import {
	CheckRun,
	CheckRunRef,
	CommentOnceResult,
	CommentRecord,
	GitHubClient,
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
	readonly markers: Array<string>;
	readonly closed: Array<number>;
	readonly outputs: Array<{ name: string; value: string }>;
	readonly summaries: Array<string>;
}

const makeRecorder = (): Recorder => ({
	created: [],
	completed: [],
	comments: [],
	markers: [],
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
	/** The marker is already on the issue: `commentOnce` finds it and skips posting. */
	readonly commentExists?: boolean;
	/**
	 * Issue numbers GitHub attributes to THIS release PR's merge (issue #259).
	 * Anything not listed reads as closed by someone else, which is the state an
	 * already-closed issue has by default.
	 */
	readonly closedByThisRelease?: ReadonlyArray<number>;
	/** The attribution query itself fails — the degrade-to-skip path. */
	readonly attributionFails?: boolean;
}

/**
 * The attribution seam (issue #259).
 *
 * @remarks
 * Answers the one `GraphQLDocument` `issue-close-attribution.ts` owns, shaped
 * exactly as GitHub's `closedByPullRequestsReferences` connection is, and runs
 * the raw payload through **the document's own `decode`** rather than handing
 * back an already-decoded value — otherwise the module's null-tolerant response
 * schema would never be exercised by any test here. The `issue` variable is
 * read back off the call so a test can attribute one issue and not another.
 */
const attributionClient = (options: Options): Layer.Layer<GitHubClient> =>
	GitHubClient.layerTest({
		graphql: (document, variables) => {
			if (options.attributionFails === true) {
				return Effect.fail(
					new GitHubGraphQLError({
						kind: "transport",
						operation: "closedByPullRequests",
						reason: "attribution unavailable",
						errors: [],
					}),
				);
			}
			const issueNumber = variables.issue as number;
			const attributed = (options.closedByThisRelease ?? []).includes(issueNumber);
			return document
				.decode({
					repository: {
						issue: {
							// PR 42 is the release PR every test in this file runs against.
							closedByPullRequestsReferences: { nodes: attributed ? [{ number: 42 }] : [] },
						},
					},
				})
				.pipe(
					Effect.orDie, // a decode failure here is a broken fixture, not a scenario
				);
		},
	});

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
			commentOnce: (number, marker) =>
				options.commentFails === true
					? Effect.fail(GitHubError.rejected("GitHubIssue.commentOnce", 403, "no permission"))
					: Effect.sync(() => {
							recorder.markers.push(marker.html);
							// The duplicate branch: the marker is already on the issue, so no
							// comment is created — only the lookup happened.
							if (options.commentExists === true) {
								return CommentOnceResult.make({
									wrote: false,
									comment: CommentRecord.make({ id: 1, body: "existing", url: "https://x.test/comments/1" }),
								});
							}
							recorder.comments.push(number);
							return CommentOnceResult.make({
								wrote: true,
								comment: CommentRecord.make({ id: 1, body: "posted", url: "https://x.test/comments/1" }),
							});
						}),
			close: (number) =>
				options.closeFails === true
					? Effect.fail(GitHubError.rejected("GitHubIssue.close", 403, "no permission"))
					: Effect.sync(() => void recorder.closed.push(number)),
		}),
		Layer.succeed(Repo, RepoRef.make({ owner: "savvy-web", repo: "silk-release-action" })),
		attributionClient(options),
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
		// The marker keys the comment to THIS release PR, so a re-run of the same
		// release skips it while a later release PR can still comment.
		expect(recorder.markers).toEqual([
			"<!-- savvy-web:closed-by-release-42 -->",
			"<!-- savvy-web:closed-by-release-42 -->",
		]);
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

		// ── Issue #259: the closed-but-uncommented window ─────────────────────
		//
		// The skip above is what makes a re-run safe, and it is also what made a
		// close-succeeded-comment-failed run unrecoverable: the re-run exited
		// before reaching the comment. Attribution splits the two cases apart.
		describe("recovering a close whose comment never landed (issue #259)", () => {
			it("comments on an already-closed issue THIS release closed", async () => {
				const recorder = makeRecorder();

				// The unrecoverable window, replayed: run 1 closed #1 and then failed
				// to comment. Run 2 sees CLOSED — but GitHub attributes the closure to
				// PR #42, this very release, so the comment is reconciled.
				const result = await run(recorder, {
					issues: [{ number: 1, title: "a", state: "CLOSED" }],
					closedByThisRelease: [1],
				});

				expect(recorder.comments).toEqual([1]);
				expect(result.closedCount).toBe(1);
				expect(result.failedCount).toBe(0);
			});

			it("does not re-close an issue it only reconciles the comment on", async () => {
				const recorder = makeRecorder();

				await run(recorder, {
					issues: [{ number: 1, title: "a", state: "CLOSED" }],
					closedByThisRelease: [1],
				});

				// Attribution enables the COMMENT, never a second close call.
				expect(recorder.closed).toEqual([]);
			});

			it("posts nothing on the ordinary re-run, where the marker is already there", async () => {
				const recorder = makeRecorder();

				// Attributed AND already commented — the common case by far. The
				// fall-through reaches `commentOnce`, whose marker lookup finds the
				// existing comment and skips, so recovery costs one lookup and adds
				// no duplicate.
				const result = await run(recorder, {
					issues: [{ number: 1, title: "a", state: "CLOSED" }],
					closedByThisRelease: [1],
					commentExists: true,
				});

				expect(recorder.comments).toEqual([]);
				expect(recorder.markers).toHaveLength(1);
				expect(result.closedCount).toBe(1);
			});

			it("stays silent on an issue closed manually or by an earlier release", async () => {
				const recorder = makeRecorder();

				// The reason the obvious fix is wrong. `linkedIssues` returns this
				// issue regardless of who closed it, and "Closed by release PR #42
				// merge." would be a FALSE claim — worse than the missing courtesy
				// comment the recovery exists to restore.
				const result = await run(recorder, {
					issues: [{ number: 1, title: "a", state: "CLOSED" }],
					closedByThisRelease: [],
				});

				expect(recorder.comments).toEqual([]);
				expect(result.closedCount).toBe(1);
			});

			it("degrades to the skip when attribution cannot be established", async () => {
				const recorder = makeRecorder();

				// A failed attribution query must never read as attribution. The cost
				// of a wrong `false` is a missing comment; the cost of a wrong `true`
				// is a false claim on someone else's issue.
				const result = await run(recorder, {
					issues: [{ number: 1, title: "a", state: "CLOSED" }],
					closedByThisRelease: [1],
					attributionFails: true,
				});

				expect(recorder.comments).toEqual([]);
				expect(result.closedCount).toBe(1);
				expect(result.failedCount).toBe(0);
			});

			it("attributes per issue rather than per run", async () => {
				const recorder = makeRecorder();

				const result = await run(recorder, {
					issues: [
						{ number: 1, title: "ours", state: "CLOSED" },
						{ number: 2, title: "someone else's", state: "CLOSED" },
					],
					closedByThisRelease: [1],
				});

				expect(recorder.comments).toEqual([1]);
				expect(result.closedCount).toBe(2);
			});

			it("does not consult attribution for an issue that is still open", async () => {
				const recorder = makeRecorder();

				// The ordinary first-run path must not pay for the recovery: an open
				// issue is closed and commented without an attribution query, and it
				// works even when that query would have failed.
				const result = await run(recorder, {
					issues: [{ number: 1, title: "a" }],
					attributionFails: true,
				});

				expect(recorder.closed).toEqual([1]);
				expect(recorder.comments).toEqual([1]);
				expect(result.closedCount).toBe(1);
			});
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

		it("should skip posting when the marker is already on the issue (wrote: false)", async () => {
			const recorder = makeRecorder();

			// The commentOnce duplicate branch: the marker lookup finds an existing
			// comment, so nothing is posted and the issue still counts as closed.
			const result = await run(recorder, { issues: [{ number: 1, title: "a" }], commentExists: true });

			expect(recorder.closed).toEqual([1]);
			expect(recorder.markers).toEqual(["<!-- savvy-web:closed-by-release-42 -->"]);
			expect(recorder.comments).toEqual([]);
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
