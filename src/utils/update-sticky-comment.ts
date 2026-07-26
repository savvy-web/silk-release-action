// Phase 2 utility: upsert a sticky comment on a PR through the kit's
// marker-based comment service.

import type { GitHubError, Repo } from "@effected/github";
import { CommentMarker, PullRequestComment } from "@effected/github";
import { Effect } from "effect";

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
		// `upsert` returns a `CommentRecord`; the predecessor returned a bare id.
		const record = yield* comments.upsert(prNumber, marker, commentBody);
		yield* Effect.logInfo(`Sticky comment id: ${record.id}`);
		return { commentId: record.id };
	});
