/**
 * The release action's structured JSON output contract.
 *
 * @remarks
 * `ReleaseOutput` is a `Schema.Union` of three phase structs, discriminated by
 * the `phase` literal. It is the single source of truth: the committed
 * `silk-release-action.schema.json` is generated from it, and `main.ts` emits
 * a Schema-encoded instance as the `result` action output.
 *
 * Field order matters — `setJson` serialises in declaration order, so `$schema`
 * is declared first in every phase struct.
 */

import { Schema } from "effect";

/** Hosted JSON Schema URL; the emitted `result` carries this as `$schema`. */
export const SCHEMA_URL = "https://json.schemastore.org/silk-release-action.schema.json";

/**
 * In-band schema version. Bumped only on a breaking JSON-shape change
 * (removed/renamed field, changed type) — additive fields do not bump it.
 */
export const SCHEMA_VERSION = "1";

const StatusLiteral = Schema.Literal("no-op", "success", "partial", "failed");

/** The three orthogonal machine flags every phase derives. */
export interface ReleaseFlags {
	readonly noop: boolean;
	readonly succeeded: boolean;
	readonly hasFailures: boolean;
}

/** Human-readable status label — derived from the flags, never the contract. */
export type ReleaseStatus = Schema.Schema.Type<typeof StatusLiteral>;

/**
 * Derive the human-readable `status` label from the machine flags.
 *
 * @remarks
 * Precedence: no-op wins, then success, then partial, then failed. `status` is
 * a coarse label for logs and summaries only — the three flags (`noop`,
 * `succeeded`, `hasFailures`) are the machine contract.
 *
 * Because the projections set `hasFailures` on *any* failure, `"partial"`
 * here means "completed with failures" — it does not distinguish a fully
 * failed run from a mixed one (the three booleans carry no "some work landed"
 * signal). The `"failed"` arm is therefore a defensive fallthrough that the
 * current projections never reach; a consumer that needs failure granularity
 * should read `succeeded`/`hasFailures` and the phase payload, not `status`.
 */
export const deriveStatus = (flags: ReleaseFlags): ReleaseStatus => {
	if (flags.noop) return "no-op";
	if (flags.succeeded) return "success";
	if (flags.hasFailures) return "partial";
	return "failed";
};

// --- branch-management phase ---------------------------------------------

const BranchManagementPayload = Schema.Struct({
	releaseBranch: Schema.Struct({
		name: Schema.String,
		existed: Schema.Boolean,
		created: Schema.Boolean,
		updated: Schema.Boolean,
		hasConflicts: Schema.Boolean,
	}),
	releasePr: Schema.NullOr(
		Schema.Struct({
			number: Schema.Number,
			url: Schema.String,
			action: Schema.Literal("created", "updated"),
		}),
	),
	changesets: Schema.Struct({
		count: Schema.Number,
		packages: Schema.Array(
			Schema.Struct({
				name: Schema.String,
				bumpType: Schema.Literal("major", "minor", "patch"),
			}),
		),
	}),
});

export const BranchManagementOutput = Schema.Struct({
	$schema: Schema.Literal(SCHEMA_URL),
	schemaVersion: Schema.Literal(SCHEMA_VERSION),
	phase: Schema.Literal("branch-management"),
	status: StatusLiteral,
	noop: Schema.Boolean,
	succeeded: Schema.Boolean,
	hasFailures: Schema.Boolean,
	dryRun: Schema.Boolean,
	branchManagement: BranchManagementPayload,
});
export type BranchManagementOutput = Schema.Schema.Type<typeof BranchManagementOutput>;

// --- validation phase ----------------------------------------------------

const ValidationPayload = Schema.Struct({
	builds: Schema.Struct({
		passed: Schema.Boolean,
		packageCount: Schema.Number,
	}),
	publish: Schema.Struct({
		npmReady: Schema.Boolean,
		githubPackagesReady: Schema.Boolean,
		packages: Schema.Array(
			Schema.Struct({
				name: Schema.String,
				version: Schema.String,
				ready: Schema.Boolean,
			}),
		),
	}),
	checkRun: Schema.NullOr(
		Schema.Struct({
			url: Schema.String,
			conclusion: Schema.String,
		}),
	),
});

export const ValidationOutput = Schema.Struct({
	$schema: Schema.Literal(SCHEMA_URL),
	schemaVersion: Schema.Literal(SCHEMA_VERSION),
	phase: Schema.Literal("validation"),
	status: StatusLiteral,
	noop: Schema.Boolean,
	succeeded: Schema.Boolean,
	hasFailures: Schema.Boolean,
	dryRun: Schema.Boolean,
	validation: ValidationPayload,
});
export type ValidationOutput = Schema.Schema.Type<typeof ValidationOutput>;

// --- publishing phase ----------------------------------------------------

const PublishTarget = Schema.Struct({
	registry: Schema.String,
	status: Schema.Literal("published", "skipped", "failed"),
	registryUrl: Schema.NullOr(Schema.String),
	error: Schema.NullOr(Schema.String),
});

const PublishPackage = Schema.Struct({
	name: Schema.String,
	version: Schema.String,
	status: Schema.Literal("published", "skipped", "failed"),
	skipReason: Schema.NullOr(Schema.Literal("already-published-identical", "already-published-unknown")),
	targets: Schema.Array(PublishTarget),
	attestations: Schema.Struct({
		provenanceUrl: Schema.NullOr(Schema.String),
		sbomUrl: Schema.NullOr(Schema.String),
		githubAttestationUrl: Schema.NullOr(Schema.String),
	}),
	tarballDigest: Schema.NullOr(Schema.String),
});

const PublishingPayload = Schema.Struct({
	packages: Schema.Array(PublishPackage),
	tags: Schema.Array(Schema.Struct({ name: Schema.String, sha: Schema.String })),
	releases: Schema.Array(Schema.Struct({ tag: Schema.String, url: Schema.String, id: Schema.Number })),
});

export const PublishingOutput = Schema.Struct({
	$schema: Schema.Literal(SCHEMA_URL),
	schemaVersion: Schema.Literal(SCHEMA_VERSION),
	phase: Schema.Literal("publishing"),
	status: StatusLiteral,
	noop: Schema.Boolean,
	succeeded: Schema.Boolean,
	hasFailures: Schema.Boolean,
	dryRun: Schema.Boolean,
	publishing: PublishingPayload,
});
export type PublishingOutput = Schema.Schema.Type<typeof PublishingOutput>;

// --- the union -----------------------------------------------------------

/** The phase-discriminated release output contract. */
export const ReleaseOutput = Schema.Union(BranchManagementOutput, ValidationOutput, PublishingOutput).annotations({
	identifier: "ReleaseOutput",
	title: "Silk Release Action output",
});
export type ReleaseOutput = Schema.Schema.Type<typeof ReleaseOutput>;
