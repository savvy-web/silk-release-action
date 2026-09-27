import { Data } from "effect";

/** Error from Phase-2 release validation. */
export class ValidationError extends Data.TaggedError("ValidationError")<{
	readonly reason: "build" | "dry-run" | "sbom" | "check-run";
	readonly message: string;
	readonly cause?: unknown;
}> {}

/**
 * Error from Phase-3 package publishing.
 *
 * @remarks
 * **Phase 3 must FAIL the effect, not just annotate.** `ActionOutputs.setFailed`
 * emits the error annotation and deliberately does not touch the exit code —
 * that is `Action.run`'s job, decided by whether the effect fails. Two abort
 * paths previously called `setFailed` and then `return`ed, so a release that
 * published nothing to a registry and created no GitHub release still reported
 * **success** to the workflow.
 *
 * That is exactly how `savvy-web/systems` run 30228332922 was read as a clean
 * release by everyone looking at it, while all four GitHub Packages targets had
 * failed 403 and no release was ever created.
 *
 * `build` covers the Build & SBOM abort, which is a Phase-3 stage even though
 * its subject matter overlaps {@link ValidationError}.
 */
export class PublishError extends Data.TaggedError("PublishError")<{
	readonly reason: "build" | "detect" | "resolve" | "publish" | "attest";
	readonly message: string;
	readonly cause?: unknown;
}> {}

/**
 * Error from Phase-3 tag / GitHub-release creation, and from the
 * close-linked-issues follow-on that runs alongside it.
 *
 * @remarks
 * `linked-issues` names the follow-on because no other member honestly does.
 * Phase 3 fails when linked issues could not be closed, and reporting that as
 * `reason: "release"` would tell an operator the GitHub release failed when it
 * did not — the same reason this is `ReleasesError` and not `PublishError`
 * (the packages published; only the housekeeping failed).
 */
export class ReleasesError extends Data.TaggedError("ReleasesError")<{
	readonly reason: "tag" | "release" | "asset" | "storage-record" | "linked-issues";
	readonly message: string;
	readonly cause?: unknown;
}> {}

/**
 * Error from the snapshot phase.
 *
 * @remarks
 * Raised only AFTER the phase has emitted its `result` output and job
 * summary, so a partial publish is always readable (and pinnable) even though
 * the run fails. Every reason has a constructor site in `steps/snapshot.ts`
 * and a test in `__test__/snapshot.test.ts` that fires it.
 *
 * - `missing-tag` — `phase: snapshot` with no `snapshot-tag`.
 * - `ref` — dispatched on a non-branch ref, or on the release or target branch.
 * - `version` — the snapshot versioning failed (pre mode, config, a package
 *   missing from the workspace).
 * - `build` — `ci:build` failed; nothing was packed.
 * - `publish` — at least one publication failed; others may have landed.
 */
export class SnapshotError extends Data.TaggedError("SnapshotError")<{
	readonly reason: "missing-tag" | "ref" | "version" | "build" | "publish";
	readonly message: string;
	readonly cause?: unknown;
}> {}
