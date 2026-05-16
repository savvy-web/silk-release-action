/**
 * Generate `silk-release-action.schema.json` from the `ReleaseOutput` Effect
 * Schema. The Effect Schema in `src/schema/release-output.ts` is the single
 * source of truth; this script is the one place that serialises it to a
 * SchemaStore-compatible JSON Schema document at the repository root.
 *
 * Run via `pnpm generate-schema`. The committed output is guarded against
 * drift by `__test__/generate-schema.test.ts`.
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { JsonSchemaExporter, JsonSchemaValidator } from "json-schema-effect";
import { ReleaseOutput, SCHEMA_URL } from "../../src/schema/release-output.js";

const OUTPUT_PATH = resolve(fileURLToPath(new URL("../..", import.meta.url)), "silk-release-action.schema.json");

const program = Effect.gen(function* () {
	const exporter = yield* JsonSchemaExporter;
	const validator = yield* JsonSchemaValidator;

	const generated = yield* exporter.generate({
		name: "silk-release-action",
		schema: ReleaseOutput,
		rootDefName: "ReleaseOutput",
		$id: SCHEMA_URL,
	});

	// ajvStrict catches malformed JSON Schema (unknown keywords, bad refs).
	yield* validator.validate(generated, { ajvStrict: true });

	const result = yield* exporter.write(generated, OUTPUT_PATH);
	yield* Effect.log(result._tag === "Written" ? `Written: ${result.path}` : `Unchanged: ${result.path}`);
});

await Effect.runPromise(
	program.pipe(
		Effect.provide(JsonSchemaExporter.Live),
		Effect.provide(JsonSchemaValidator.Live),
		Effect.provide(NodeFileSystem.layer),
	),
);
