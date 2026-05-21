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
 * Run via `pnpm generate-schema`. The committed outputs are guarded against
 * drift by `__test__/generate-schema.test.ts`.
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { JsonSchemaExporter, JsonSchemaValidator } from "json-schema-effect";
import { ReleaseOutput, SCHEMA_URL } from "../../src/schema/release-output.js";
import { INPUT_SCHEMA_URL, SilkReleaseConfig } from "../../src/schema/silk-release-config.js";

const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const OUTPUT_PATH = resolve(REPO_ROOT, "silk-release-action.output.schema.json");
const INPUT_PATH = resolve(REPO_ROOT, "silk-release-action.input.schema.json");

const program = Effect.gen(function* () {
	const exporter = yield* JsonSchemaExporter;
	const validator = yield* JsonSchemaValidator;

	const outputGenerated = yield* exporter.generate({
		name: "silk-release-action-output",
		schema: ReleaseOutput,
		rootDefName: "ReleaseOutput",
		$id: SCHEMA_URL,
	});
	// ajvStrict catches malformed JSON Schema (unknown keywords, bad refs).
	yield* validator.validate(outputGenerated, { ajvStrict: true });
	const outputWrite = yield* exporter.write(outputGenerated, OUTPUT_PATH);
	yield* Effect.log(outputWrite._tag === "Written" ? `Written: ${outputWrite.path}` : `Unchanged: ${outputWrite.path}`);

	const inputGenerated = yield* exporter.generate({
		name: "silk-release-action-input",
		schema: SilkReleaseConfig,
		rootDefName: "SilkReleaseConfig",
		$id: INPUT_SCHEMA_URL,
	});
	yield* validator.validate(inputGenerated, { ajvStrict: true });
	const inputWrite = yield* exporter.write(inputGenerated, INPUT_PATH);
	yield* Effect.log(inputWrite._tag === "Written" ? `Written: ${inputWrite.path}` : `Unchanged: ${inputWrite.path}`);
});

await Effect.runPromise(
	program.pipe(
		Effect.provide(JsonSchemaExporter.Live),
		Effect.provide(JsonSchemaValidator.Live),
		Effect.provide(NodeFileSystem.layer),
	),
);
