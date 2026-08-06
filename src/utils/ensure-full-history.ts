/**
 * Give changesets the git history it needs before a changeset-aware step runs.
 *
 * @module utils/ensure-full-history
 */

import { Git } from "@effected/git";
import { Effect } from "effect";

/**
 * Give changesets the history it needs: full depth, and a **local** ref for the
 * target branch.
 *
 * @remarks
 * The checkout step in the wrapping workflow may have only shallow history of
 * the release branch plus an `origin/<target>` remote ref, while changesets
 * computes its diff against a local one.
 *
 * The probe goes through `Effect.result`: a non-zero exit is a **result** here,
 * not a failure — an old git without `--is-shallow-repository` answers non-zero,
 * and that means "not shallow", not "stop". Both fetches go through
 * `Effect.result` because neither is worth failing the phase over: a
 * `--unshallow` on an already-complete clone exits non-zero by design, which is
 * why the `isShallow` probe gates it.
 *
 * Phases 1, 2 and 3 all need this and each carried its own copy; one drifting
 * from another would silently change what changesets compares against.
 *
 * @param targetBranch - The branch changesets diffs the release branch against.
 *
 * @public
 */
export const ensureFullHistory = (targetBranch: string): Effect.Effect<void, never, Git> =>
	Effect.gen(function* () {
		const git = yield* Git;
		// `Effect.result` on the probe, not a bare `yield*`: a non-zero exit is a
		// **result** here, not a failure — an old git without
		// `--is-shallow-repository` answers non-zero, and that means "not shallow",
		// not "stop". `Git.isShallow` reports that as a typed `GitCommandError`, so
		// the failure must stay a value to keep this function's `never` error
		// channel.
		const probe = yield* Effect.result(git.isShallow(process.cwd()));
		const isShallow = probe._tag === "Success" && probe.success;
		if (isShallow) {
			yield* Effect.logDebug("Repository is shallow, fetching full history");
			// The `isShallow` guard is LOAD-BEARING and must stay. `--unshallow` on an
			// already-complete clone exits non-zero by design, and `Git.fetchUnshallow`
			// deliberately does not swallow that — swallowing it would swallow every
			// other fetch-failure shape too. Guarding on the probe is what keeps a
			// documented no-op from becoming a typed failure.
			yield* Effect.result(git.fetchUnshallow(process.cwd(), { remote: "origin" }));
		}
		// A refspec, not a bare ref — `Git.fetch` passes `ref` through as git's
		// last positional argument, so `<target>:<target>` still creates the local
		// branch changesets diffs against. `Effect.result` keeps the failure a
		// value: this is best-effort, exactly as the raw form was.
		yield* Effect.result(git.fetch(process.cwd(), { ref: `${targetBranch}:${targetBranch}`, remote: "origin" }));
	});
