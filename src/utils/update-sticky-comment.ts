// Phase 2 utility: upsert a sticky comment on a PR through the kit's
// marker-based comment service.

import type { GitHubError, Repo } from "@effected/github";
import { CommentMarker, PullRequestComment } from "@effected/github";
import { Effect, Option } from "effect";

export interface StickyCommentResult {
	commentId: number;
}

/**
 * The namespace half of every sticky-comment marker this action writes.
 *
 * @remarks
 * `CommentMarker` renders `<!-- ${namespace}:${key} -->`, so `"savvy-web"` here
 * reproduces the predecessor's hard-coded `<!-- savvy-web:${key} -->`
 * **byte for byte**.
 *
 * That equality is load-bearing and is pinned by a test. The marker is how an
 * in-flight comment is found again on a later run; changing it by one character
 * would orphan every existing sticky comment and post a duplicate beneath it on
 * every open release PR.
 */
const MARKER_NAMESPACE = "savvy-web";

/**
 * Create or update a sticky comment on the given PR.
 *
 * @remarks
 * The kit inserts and matches a hidden `<!-- savvy-web:<key> -->` marker, so the
 * same comment is found across runs.
 *
 * @param prNumber - The pull request (or issue) number to comment on.
 * @param commentBody - The rendered markdown body.
 * @param commentIdentifier - The marker key identifying this comment's role.
 * @returns The upserted comment's id.
 *
 * @public
 */
export const updateStickyComment = (
	prNumber: number,
	commentBody: string,
	commentIdentifier: string,
): Effect.Effect<StickyCommentResult, GitHubError, PullRequestComment | Repo> =>
	Effect.gen(function* () {
		const comments = yield* PullRequestComment;
		yield* Effect.logInfo(`Upserting sticky comment on PR #${prNumber} (key=${commentIdentifier})`);
		const marker = CommentMarker.make({ namespace: MARKER_NAMESPACE, key: commentIdentifier });

		// Strip any marker already in the body before handing it over.
		//
		// `upsert` appends the marker so the comment can be found again. A caller
		// that reads the existing body, edits it, and writes it back — which is
		// how a section rewrite works — hands back a body that already carries
		// one, and gets a second appended. Repeat per write and they accumulate:
		// four copies after a few runs, observed on silk-integration PR #248.
		//
		// Stripping here rather than at each call site keeps the invariant with
		// the code that knows what the marker is.
		const withoutMarker = commentBody.split(marker.html).join("").trimEnd();

		// `upsert` returns a `CommentRecord`; the predecessor returned a bare id.
		const record = yield* comments.upsert(prNumber, marker, withoutMarker);
		yield* Effect.logInfo(`Sticky comment id: ${record.id}`);
		return { commentId: record.id };
	});

/**
 * The current body of a sticky comment, or `""` when it does not exist yet.
 *
 * @remarks
 * The read half of read-modify-write. `upsert` replaces a comment's body
 * wholesale, so a caller rewriting one marker-delimited section **must** start
 * from what is already there — passing `""` silently discards every other
 * section and anything a human wrote, which is exactly the bug this exists to
 * prevent.
 *
 * A missing comment is `""` rather than a failure: the first write of a run
 * legitimately has nothing to preserve, and `upsertSection` appends into an
 * empty body correctly.
 *
 * @param prNumber - The pull request (or issue) number to read from.
 * @param commentIdentifier - The marker key identifying the comment's role.
 * @returns The existing body, or `""` when there is no such comment.
 *
 * @public
 */
export const readStickyComment = (
	prNumber: number,
	commentIdentifier: string,
): Effect.Effect<string, GitHubError, PullRequestComment | Repo> =>
	Effect.gen(function* () {
		const comments = yield* PullRequestComment;
		const marker = CommentMarker.make({ namespace: MARKER_NAMESPACE, key: commentIdentifier });
		const found = yield* comments.find(prNumber, marker);
		return Option.match(found, { onNone: () => "", onSome: (record) => record.body });
	});
