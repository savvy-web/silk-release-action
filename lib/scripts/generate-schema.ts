/**
 * Generate the two action JSON Schema files from their Effect Schema sources.
 *
 * @remarks
 * The Effect Schemas in `src/schema/release-output.ts`
 * (`ReleaseOutput` — the action's structured output) and
 * `src/schema/silk-release-config.ts` (`SilkReleaseConfig` — the
 * `sbom-config`/`.github/silk-release.json`/`SILK_RELEASE_SBOM_TEMPLATE`
 * input) are the single sources of truth. This script serialises them to two
 * SchemaStore-compatible JSON Schema documents:
 *
 * - `schemas/<version>/silk-release-action-<version>.json` — from
 *   `ReleaseOutput`, **version-labelled** because every emitted payload's
 *   `$schema` points at it (see {@link SCHEMA_SEMVER})
 * - `silk-release-action.input.schema.json` — from `SilkReleaseConfig`, at the
 *   repository root, unversioned because nothing pins it per payload
 *
 * Everything below {@link targets} belongs to `@effected/schemastore`:
 * `SchemaPipeline.run` builds each document (core's `Schema.toJsonSchemaDocument`
 * at Draft 2020-12, lowered with `JsonSchema.toDocumentDraft07`, with the
 * `#/definitions` → `#/$defs` `$ref` rewrite that lowering makes necessary),
 * runs the structural lint and the shipped ajv strict-mode gate, fails with a
 * `SchemaGateError` carrying every blocking finding, and writes only what
 * passes — through `CanonicalJson`, and only when the document's **content**
 * differs. This script supplies the targets and the log wording; the package
 * deliberately never logs.
 *
 * Because the comparison is by content rather than bytes, the generated files
 * need no formatter carve-out: Biome reflowing them (via lint-staged) does not
 * provoke a rewrite on the next run, and the drift test stays green either way.
 *
 * Gating uses the pipeline's default blocking predicate — `warning` severity
 * (`UnresolvedRef`, `UnknownKeyword`, `DepthExceeded`, and every engine
 * finding) fails the run, since each means a document that would be broken for
 * the editors it exists to serve. `advisory` findings survive the gate and are
 * logged here.
 *
 * Run via `pnpm generate-schema`. Two flags override the default walk:
 *
 * - `--check` (alias `--dry-run`) — report what a run would do and write
 *   nothing, including the contract change the gate would refuse
 * - `--allow-contract-change` (alias `--force`) — write through the contract
 *   gate at the SAME version label. Correct only while that label is
 *   unpublished, or when repairing an unparseable file; see
 *   {@link allowContractChange}
 *
 * The committed outputs are guarded against drift by
 * `__test__/generate-schema.test.ts`, which imports {@link targets} and uses
 * `SchemaPipeline.check` — the identical walk, without writing.
 */

import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { SchemaFile, SchemaPipeline, SchemaTarget, SchemaValidator, SchemaVersioning } from "@effected/schemastore";
import { Effect, Layer, Result } from "effect";
import { ReleaseOutput, SCHEMA_URL } from "../../src/schema/release-output.js";
import { INPUT_SCHEMA_URL, SilkReleaseConfig } from "../../src/schema/silk-release-config.js";

const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

/**
 * The catalog name both documents publish under.
 *
 * @remarks
 * `SchemaVersioning.fileName` requires a simple base name — no separators, no
 * whitespace — and throws on anything else, so this is the one place the name
 * is spelled.
 */
const CATALOG_NAME = "silk-release-action";

/**
 * The published version of the output document.
 *
 * @remarks
 * **Full three-component SemVer, enforced by `@effected/schemastore`.** Its
 * `Order` is numeric rather than lexical (`1.10.0` above `1.9.0`), and a
 * bare-major label like `"5"` is rejected — a label has to round-trip out of a
 * file name unambiguously, and integer-like keys also jump the queue in JSON
 * object enumeration, which reorders a catalog's `versions` map regardless of
 * insertion order.
 *
 * The directory carries the same label as the file. That redundancy is
 * deliberate: it keeps a version's artifacts together while the file name stays
 * the one SchemaStore resolves (`<name>-<version>.json`).
 *
 * **Bumping this is the response to a `contract` change, not a workaround for
 * one** — see the gate in `generate` below.
 */
const SCHEMA_SEMVER = SchemaVersioning.parseResult("5.0.0").pipe(
	Result.getOrThrowWith((e) => new Error(`SCHEMA_SEMVER is not a valid schema version: ${e.message}`)),
);

/**
 * The schema publication targets: one per emitted document.
 *
 * @remarks
 * Exported so the drift test checks exactly the wiring the generator writes.
 * The output document is **versioned** — it is referenced by `$schema` in every
 * payload the action emits, so its URL has to keep resolving after the shape
 * moves on. `name` is required once `version` is present, enforced by an
 * overload pair rather than a runtime check.
 */
export const targets: ReadonlyArray<SchemaTarget> = [
	SchemaTarget.make({
		schema: ReleaseOutput,
		$id: SCHEMA_URL,
		name: CATALOG_NAME,
		version: SCHEMA_SEMVER,
		path: resolve(REPO_ROOT, "schemas", SCHEMA_SEMVER, SchemaVersioning.fileName(CATALOG_NAME, SCHEMA_SEMVER)),
	}),
	SchemaTarget.make({
		schema: SilkReleaseConfig,
		$id: INPUT_SCHEMA_URL,
		path: resolve(REPO_ROOT, "silk-release-action.input.schema.json"),
	}),
];

/**
 * Whether this invocation was asked to write through the contract gate.
 *
 * @remarks
 * `--allow-contract-change` (alias `--force`) swaps the pipeline's
 * `"block-versioned"` policy for `"allow"`: the run classifies and reports a
 * contract change instead of refusing it, and writes the new document over the
 * published one at the SAME version label.
 *
 * That is a lie to every consumer pinned to {@link SCHEMA_URL} — unless the
 * label was never published, which is exactly the case this flag exists for:
 * iterating on a version that has not shipped, or seeing what a dependency bump
 * did to the document before deciding whether it warrants a bump. It is also
 * the sanctioned repair path for a published file whose text no longer parses
 * (`SchemaFile` classifies unparseable text as a contract change).
 *
 * The gate is the default; this is the deliberate override, and the run says so
 * loudly on the way past.
 */
const allowContractChange = process.argv.slice(2).some((a) => a === "--allow-contract-change" || a === "--force");

/**
 * Whether this invocation should report only.
 *
 * @remarks
 * `--check` runs the identical walk with no writes — the same call the drift
 * test makes — and reports what a run WOULD do, including a contract change the
 * gate would refuse.
 */
const checkOnly = process.argv.slice(2).some((a) => a === "--check" || a === "--dry-run");

const contractChanges = allowContractChange ? "allow" : "block-versioned";

/** Log one target's findings and what the walk did (or would do) with it. */
const report = Effect.fn("report")(function* (r: {
	readonly $id: string;
	readonly path: string;
	readonly change: string;
	readonly findings: ReadonlyArray<{ readonly label: string; readonly path: string; readonly message: string }>;
}) {
	// Anything surviving the gate is advisory by definition.
	for (const finding of r.findings) {
		yield* Effect.logInfo(`${r.$id}: ${finding.label} at "${finding.path}" — ${finding.message}`);
	}
});

const generate = Effect.gen(function* () {
	// The contract gate now lives in the package: under the default
	// `"block-versioned"` policy, `run` refuses a PINNED target whose validation
	// contract moved — before anything is written, and total over the targets, so
	// two broken documents surface in one run. Rewriting an already-published
	// version's file in place would silently break every consumer pinned to its
	// URL, and failing after the write would report the problem accurately and
	// still have caused it.
	//
	// `DocumentDiff` classifies `default`, `examples`, `readOnly` and
	// `writeOnly` as contract changes even though the spec calls them
	// annotations — consumers act on them, and under-reporting ships a silent
	// break while over-reporting only costs a bump. `"created"` is not a
	// contract change: a version's first write has no predecessor to break.
	if (checkOnly) {
		const results = yield* SchemaPipeline.check(targets, { contractChanges });
		for (const result of results) {
			yield* report(result);
			yield* Effect.log(
				`${result.wouldWrite ? "Would write" : "Unchanged"} (${result.change}): ${result.path}` +
					(result.contractBlocked ? " — REFUSED: contract change at a published version" : "") +
					(result.blocked ? " — REFUSED: blocking findings" : ""),
			);
		}
		return;
	}

	if (allowContractChange) {
		yield* Effect.logWarning(
			"--allow-contract-change: the contract gate is OFF. A published document may be rewritten in place " +
				`at version ${SCHEMA_SEMVER}, which breaks every consumer pinned to its URL. Only correct while ` +
				"that label is unpublished, or when repairing an unparseable file.",
		);
	}

	// The whole gate-and-write walk is the package's: it lints, runs the ajv
	// gate, fails with `SchemaGateError` carrying every blocking finding, applies
	// the contract policy, and writes only what passes. The default blocking
	// predicate is `severity === "warning"`, which is the policy we want.
	const results = yield* SchemaPipeline.run(targets, { contractChanges });

	for (const result of results) {
		yield* report(result);
		// `change` classifies what actually differed: `"contract"` is a
		// consumer-visible break, `"annotations"` is documentation only — the
		// versioning signal for a published schema, reported for free.
		yield* Effect.log(
			result.outcome === "written" ? `Written (${result.change}): ${result.path}` : `Unchanged: ${result.path}`,
		);
	}
}).pipe(
	Effect.catchTag("SchemaContractChangeError", (error) =>
		Effect.gen(function* () {
			for (const t of error.targets) {
				yield* Effect.logError(`Contract change in an already-published schema: ${t.path}`);
			}
			return yield* Effect.fail(
				new Error(
					`${error.targets.length} document(s) changed their contract at version ${SCHEMA_SEMVER}. ` +
						"Nothing was written. Bump SCHEMA_SEMVER in lib/scripts/generate-schema.ts and SCHEMA_URL in " +
						"src/schema/release-output.ts to the new label" +
						(error.targets[0] ? ` (suggested: ${error.targets[0].nextVersion})` : "") +
						", then re-run: the new version writes a new file and leaves the published one intact. " +
						"To write anyway — only correct while the label is unpublished — re-run with " +
						"`pnpm generate-schema -- --allow-contract-change`, or `--check` to see what would change.",
				),
			);
		}),
	),
);

const AppLayer = Layer.mergeAll(SchemaFile.layer, SchemaValidator.layer).pipe(Layer.provide(NodeServices.layer));

const invokedDirectly =
	process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));

if (invokedDirectly) {
	await Effect.runPromise(generate.pipe(Effect.provide(AppLayer)));
}
