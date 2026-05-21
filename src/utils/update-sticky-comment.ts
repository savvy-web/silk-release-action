/**
 * Phase 2 utility: upsert a sticky comment on a PR using the library's
 * marker-based comment service.
 */

import type { PullRequestCommentError } from "@savvy-web/github-action-effects";
import { PullRequestComment } from "@savvy-web/github-action-effects";
import { Effect } from "effect";

export interface StickyCommentResult {
	commentId: number;
}

/**
 * Create or update a sticky comment on the given PR. The library
 * inserts/updates a hidden `<!-- savvy-web:<key> -->` marker so the same
 * comment is found across runs.
 *
 * @public
 */
export const updateStickyComment = (
	prNumber: number,
	commentBody: string,
	commentIdentifier: string,
): Effect.Effect<StickyCommentResult, PullRequestCommentError, PullRequestComment> =>
	Effect.gen(function* () {
		const comments = yield* PullRequestComment;
		yield* Effect.logInfo(`Upserting sticky comment on PR #${prNumber} (key=${commentIdentifier})`);
		const commentId = yield* comments.upsert(prNumber, commentIdentifier, commentBody);
		yield* Effect.logInfo(`Sticky comment id: ${commentId}`);
		return { commentId };
	});
