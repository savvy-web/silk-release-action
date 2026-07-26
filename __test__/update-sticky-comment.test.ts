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
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { updateStickyComment } from "../src/utils/update-sticky-comment.js";

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
		Effect.runPromise,
	);

describe("updateStickyComment", () => {
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
});
