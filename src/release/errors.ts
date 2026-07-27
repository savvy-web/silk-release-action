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

/** Error from Phase-3 tag / GitHub-release creation. */
export class ReleasesError extends Data.TaggedError("ReleasesError")<{
	readonly reason: "tag" | "release" | "asset" | "storage-record";
	readonly message: string;
	readonly cause?: unknown;
}> {}
