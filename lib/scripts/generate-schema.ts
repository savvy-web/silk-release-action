/**
 * Generate the two action JSON Schema files from their Effect Schema sources.
 *
 * @remarks
 * The Effect Schemas in `src/schema/release-output.ts`
 * (`ReleaseOutput` — the action's structured output) and
 * `src/schema/silk-release-config.ts` (`SilkReleaseConfig` — the
 * `sbom-config`/`.github/silk-release.json`/`SILK_RELEASE_SBOM_TEMPLATE`
 * input) are the single sources of truth. This script serialises them to
 * two SchemaStore-compatible JSON Schema documents at the repository root:
 *
 * - `silk-release-action.output.schema.json` — from `ReleaseOutput`
 * - `silk-release-action.input.schema.json`  — from `SilkReleaseConfig`
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
 * Run via `pnpm generate-schema`. The committed outputs are guarded against
 * drift by `__test__/generate-schema.test.ts`, which imports {@link targets}
 * and uses `SchemaPipeline.check` — the identical walk, without writing.
 */

import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { SchemaFile, SchemaPipeline, SchemaTarget, SchemaValidator } from "@effected/schemastore";
import { Effect, Layer } from "effect";
import { ReleaseOutput, SCHEMA_URL } from "../../src/schema/release-output.js";
import { INPUT_SCHEMA_URL, SilkReleaseConfig } from "../../src/schema/silk-release-config.js";

const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

/**
 * The schema publication targets: one per emitted document.
 *
 * @remarks
 * Exported so the drift test checks exactly the wiring the generator writes.
 * `name` is only required for versioned catalog naming, which these
 * unversioned documents do not use.
 */
export const targets: ReadonlyArray<SchemaTarget> = [
	SchemaTarget.make({
		schema: ReleaseOutput,
		$id: SCHEMA_URL,
		path: resolve(REPO_ROOT, "silk-release-action.output.schema.json"),
	}),
	SchemaTarget.make({
		schema: SilkReleaseConfig,
		$id: INPUT_SCHEMA_URL,
		path: resolve(REPO_ROOT, "silk-release-action.input.schema.json"),
	}),
];

const generate = Effect.gen(function* () {
	// The whole gate-and-write walk is the package's: it lints, runs the ajv
	// gate, fails with `SchemaGateError` carrying every blocking finding, and
	// writes only what passes. The default blocking predicate is
	// `severity === "warning"`, which is the policy we want.
	const results = yield* SchemaPipeline.run(targets);

	for (const result of results) {
		// Anything surviving the gate is advisory by definition.
		for (const finding of result.findings) {
			yield* Effect.logInfo(`${result.$id}: ${finding.label} at "${finding.path}" — ${finding.message}`);
		}
		// `change` classifies what actually differed: `"contract"` is a
		// consumer-visible break, `"annotations"` is documentation only — the
		// versioning signal for a published schema, reported for free.
		yield* Effect.log(
			result.outcome === "written" ? `Written (${result.change}): ${result.path}` : `Unchanged: ${result.path}`,
		);
	}
});

const AppLayer = Layer.mergeAll(SchemaFile.layer, SchemaValidator.layer).pipe(Layer.provide(NodeServices.layer));

const invokedDirectly =
	process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));

if (invokedDirectly) {
	await Effect.runPromise(generate.pipe(Effect.provide(AppLayer)));
}
