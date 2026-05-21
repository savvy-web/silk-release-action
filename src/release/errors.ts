import { Data } from "effect";

/** Error from Phase-2 release validation. */
export class ValidationError extends Data.TaggedError("ValidationError")<{
	readonly reason: "build" | "dry-run" | "sbom" | "check-run";
	readonly message: string;
	readonly cause?: unknown;
}> {}

/** Error from Phase-3 package publishing. */
export class PublishError extends Data.TaggedError("PublishError")<{
	readonly reason: "detect" | "resolve" | "publish" | "attest";
	readonly message: string;
	readonly cause?: unknown;
}> {}

/** Error from Phase-3 tag / GitHub-release creation. */
export class ReleasesError extends Data.TaggedError("ReleasesError")<{
	readonly reason: "tag" | "release" | "asset" | "storage-record";
	readonly message: string;
	readonly cause?: unknown;
}> {}
