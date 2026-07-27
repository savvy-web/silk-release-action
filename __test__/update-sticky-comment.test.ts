/**
 * Tests for the sticky-comment upsert.
 *
 * @remarks
 * The load-bearing assertion here is the **marker string**, not the upsert
 * mechanics. The marker is how a comment posted on an earlier run is found
 * again; if it changes by one character, every open release PR gets a *second*
 * comment instead of its existing one updated. That regression is invisible to
 * the typechecker and would only be noticed in production, so it is pinned
 * literally below rather than derived.
 */

import type { CommentMarker } from "@effected/github";
import { CommentRecord, PullRequestComment, Repo, RepoRef } from "@effected/github";
import { Effect, Layer, Logger, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readStickyComment, updateStickyComment } from "../src/utils/update-sticky-comment.js";
import { cleanupTestEnvironment, setupTestEnvironment } from "./utils/github-mocks.js";

interface Upserted {
	readonly issueNumber: number;
	readonly marker: CommentMarker;
	readonly body: string;
}

const run = (
	recorder: Array<Upserted>,
	prNumber = 42,
	body = "## report",
	key = "release-validation",
): Promise<{ commentId: number }> =>
	updateStickyComment(prNumber, body, key).pipe(
		Effect.provide(
			Layer.mergeAll(
				PullRequestComment.layerTest({
					upsert: (issueNumber, marker, commentBody) =>
						Effect.sync(() => {
							recorder.push({ issueNumber, marker, body: commentBody });
							return CommentRecord.make({ id: 1234, body: commentBody, url: "https://x.test/c/1234" });
						}),
				}),
				Layer.succeed(Repo, RepoRef.make({ owner: "savvy-web", repo: "silk-release-action" })),
			),
		),
		// `Logger.layer([])` removes every logger from the runtime. Without it the
		// module's `Effect.log*` calls reach Effect's DEFAULT logger, which writes
		// via `console.log` — not `process.stdout.write`, so `suppressOutput`
		// cannot catch it — and leak into the reporter.
		Effect.provide(Logger.layer([])),
		Effect.runPromise,
	);

describe("updateStickyComment", () => {
	// Mock hygiene between cases. Log suppression is NOT this — it is the
	// `Logger.layer([])` in `run` above; see the note there.
	beforeEach(() => setupTestEnvironment({ suppressOutput: true }));
	afterEach(() => cleanupTestEnvironment());

	it("should render the marker as <!-- savvy-web:<key> --> byte for byte", async () => {
		const recorder: Array<Upserted> = [];
		await run(recorder);

		// The exact string the predecessor emitted. Do not "improve" it.
		expect(recorder[0]?.marker.html).toBe("<!-- savvy-web:release-validation -->");
	});

	it("should carry the namespace and key separately on the marker", async () => {
		const recorder: Array<Upserted> = [];
		await run(recorder);

		expect(recorder[0]?.marker.namespace).toBe("savvy-web");
		expect(recorder[0]?.marker.key).toBe("release-validation");
	});

	it("should namespace an arbitrary key the same way", async () => {
		const recorder: Array<Upserted> = [];
		await run(recorder, 7, "body", "some-other-key");

		expect(recorder[0]?.marker.html).toBe("<!-- savvy-web:some-other-key -->");
	});

	it("should upsert against the given PR with the given body", async () => {
		const recorder: Array<Upserted> = [];
		await run(recorder, 99, "## the body");

		expect(recorder[0]?.issueNumber).toBe(99);
		expect(recorder[0]?.body).toBe("## the body");
	});

	it("should return the comment id from the record", async () => {
		// The kit returns a `CommentRecord`; the predecessor returned a bare id.
		const result = await run([]);

		expect(result).toEqual({ commentId: 1234 });
	});

	it("should strip a pre-existing marker when the body already carries one", async () => {
		// The accumulating-marker bug: `upsert` APPENDS the marker, so a
		// read-modify-write caller hands back a body that already has one and gets
		// a second. Four copies were observed on silk-integration PR #248.
		//
		// Without the strip at update-sticky-comment.ts:61 the recorded body still
		// contains the marker, so this assertion is what holds that line in place.
		const recorder: Array<Upserted> = [];
		await run(recorder, 42, "## report\n\n<!-- savvy-web:release-validation -->");

		expect(recorder[0]?.body).toBe("## report");
		expect(recorder[0]?.body).not.toContain("<!-- savvy-web:release-validation -->");
	});

	it("should strip every copy when the body carries the marker more than once", async () => {
		// `split(...).join("")` removes ALL copies, which is what recovers a comment
		// that already accumulated several before the fix landed.
		const recorder: Array<Upserted> = [];
		await run(
			recorder,
			42,
			"<!-- savvy-web:release-validation -->## report<!-- savvy-web:release-validation --><!-- savvy-web:release-validation -->",
		);

		expect(recorder[0]?.body).toBe("## report");
	});

	it("should leave a different key's marker in place when stripping", async () => {
		// Only this comment's own marker is the caller's to remove; another
		// section's marker is content.
		const recorder: Array<Upserted> = [];
		await run(recorder, 42, "## report\n\n<!-- savvy-web:other-key -->", "release-validation");

		expect(recorder[0]?.body).toBe("## report\n\n<!-- savvy-web:other-key -->");
	});
});

describe("readStickyComment", () => {
	beforeEach(() => setupTestEnvironment({ suppressOutput: true }));
	afterEach(() => cleanupTestEnvironment());

	const runRead = (found: Option.Option<CommentRecord>, prNumber = 42, key = "release-validation"): Promise<string> =>
		readStickyComment(prNumber, key).pipe(
			Effect.provide(
				Layer.mergeAll(
					PullRequestComment.layerTest({ find: () => Effect.succeed(found) }),
					Layer.succeed(Repo, RepoRef.make({ owner: "savvy-web", repo: "silk-release-action" })),
				),
			),
			Effect.provide(Logger.layer([])),
			Effect.runPromise,
		);

	it("should return the existing body when the comment is found", async () => {
		const body = await runRead(
			Option.some(CommentRecord.make({ id: 1234, body: "## existing", url: "https://x.test/c/1234" })),
		);

		expect(body).toBe("## existing");
	});

	it("should return an empty string when no such comment exists", async () => {
		// A missing comment is `""`, not a failure: the first write of a run
		// legitimately has nothing to preserve.
		const body = await runRead(Option.none());

		expect(body).toBe("");
	});

	it("should look the comment up by the same namespaced marker it writes", async () => {
		// The read and write halves must agree on the marker or a read-modify-write
		// silently starts from `""` and discards every other section.
		const markers: Array<CommentMarker> = [];
		await readStickyComment(7, "some-other-key").pipe(
			Effect.provide(
				Layer.mergeAll(
					PullRequestComment.layerTest({
						find: (_issueNumber, marker) =>
							Effect.sync(() => {
								markers.push(marker);
								return Option.none();
							}),
					}),
					Layer.succeed(Repo, RepoRef.make({ owner: "savvy-web", repo: "silk-release-action" })),
				),
			),
			Effect.provide(Logger.layer([])),
			Effect.runPromise,
		);

		expect(markers[0]?.html).toBe("<!-- savvy-web:some-other-key -->");
	});
});
