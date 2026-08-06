/**
 * The read-modify-write both phases perform on the release PR's sticky comment.
 *
 * @remarks
 * Phase 1 and Phase 2 write to the *same* comment, under the same marker key,
 * and they are not the only writers — a human can add prose, and each phase owns
 * regions the other must not disturb. That makes four rules load-bearing on
 * every write, and they were previously spelled out twice:
 *
 *  1. **Read before writing.** `upsert` replaces the body wholesale, so a
 *     rewrite that starts from `""` deletes every other section and anything a
 *     human wrote. This is a bug that actually shipped.
 *  2. **A failed read degrades to `""`,** rather than aborting. Losing a
 *     neighbour is bad; refusing to report the release at all is worse.
 *  3. **One write, not one per section.** The sections are folded in memory and
 *     posted once, so a reader never catches the comment mid-update with a stale
 *     verdict above a fresh table.
 *  4. **Banners are refreshed across the whole body afterwards,** because a
 *     banner is rendered into the text and freezes at write time — a section
 *     nobody rewrote otherwise goes on claiming it is up to date at a sha the
 *     branch has moved past. See `managed-sections.ts` rule 3.
 *
 * And one posture: **degrade-to-warning**, declared in the error channel as
 * `never`. A reporting write is not a release gate.
 *
 * What is deliberately NOT here is the bracket. Phase 1 wraps its write in
 * `withSection` — `running` before the branch work, a terminal state on every
 * exit — and Phase 2 writes once at the end because by then there is nothing
 * left to bracket. That difference sits *above* this function: a caller composes
 * it, rather than this function growing a mode. Sharing the fold and keeping the
 * bracket separate is why the two call sites are one line each and still mean
 * different things.
 *
 * @module utils/write-sections
 */

import { Effect } from "effect";
import type { Section } from "./managed-sections.js";
import { refreshBanners, upsertSection } from "./managed-sections.js";

/**
 * One folded write of a set of sections into one sticky comment.
 *
 * @remarks
 * `read` and `publish` are parameters rather than the concrete
 * `readStickyComment`/`updateStickyComment`, so this stays independent of *where*
 * the sections live and so a test can observe the exact body posted without
 * standing up a GitHub client. Their error type is free: whatever they can fail
 * with is caught here.
 *
 * @public
 */
export interface SectionWrite<E, R> {
	/** The pull request (or issue) carrying the comment. */
	readonly prNumber: number;
	/** The sticky-comment marker key — which comment, not which section. */
	readonly key: string;
	/**
	 * The sections to fold in, in order.
	 *
	 * @remarks
	 * `upsertSection` appends a key it has not seen before, so for a comment that
	 * does not exist yet this array's order IS the reader's order.
	 */
	readonly sections: ReadonlyArray<Section>;
	/** The commit every banner is measured against — see rule 4. */
	readonly headSha: string;
	/** Links the stamped sha in every banner. Decoration, not structure. */
	readonly commitLink?: ((sha: string) => string) | undefined;
	/**
	 * The warning logged when the write fails, verbatim; the cause is appended
	 * after a colon.
	 *
	 * @remarks
	 * A parameter because the two callers say different things about the same
	 * failure, and both strings are what the job log has read for as long as
	 * there have been job logs.
	 */
	readonly warning: string;
	/** Read the comment's current body, so a rewrite preserves its neighbours. */
	readonly read: (prNumber: number, key: string) => Effect.Effect<string, E, R>;
	/** Post the folded body. Failures are this function's to swallow. */
	readonly publish: (prNumber: number, body: string, key: string) => Effect.Effect<unknown, E, R>;
}

/**
 * Fold sections into a sticky comment: read once, upsert each, refresh every
 * banner, post once.
 *
 * @param write - The comment, the sections, and how to read and write them.
 * @returns `true` when the comment was posted, `false` when the write failed and
 *   was degraded to a warning. Never fails.
 *
 * @public
 */
export const writeSections = <E, R>(write: SectionWrite<E, R>): Effect.Effect<boolean, never, R> =>
	Effect.gen(function* () {
		const existing = yield* write.read(write.prNumber, write.key).pipe(Effect.catch(() => Effect.succeed("")));

		const merged = refreshBanners(
			write.sections.reduce((body, section) => upsertSection(body, section, write.headSha, write.commitLink), existing),
			write.headSha,
			write.commitLink,
		);

		const posted = yield* Effect.result(write.publish(write.prNumber, merged, write.key));
		if (posted._tag === "Failure") {
			yield* Effect.logWarning(`${write.warning}: ${String(posted.failure)}`);
			return false;
		}
		return true;
	});
