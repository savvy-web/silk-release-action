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
 * The Effect Schema is converted to a Draft 2020-12 JSON Schema document via
 * `Schema.toJsonSchemaDocument`, lowered to Draft-07 with
 * `JsonSchema.toDocumentDraft07`, then assembled into the SchemaStore shape
 * (`$schema` + `$id` + root schema + `$defs`). Each generated document is
 * validated with ajv in strict mode to catch malformed JSON Schema before it
 * is written.
 *
 * Run via `pnpm generate-schema`. The committed outputs are guarded against
 * drift by `__test__/generate-schema.test.ts`, which imports
 * {@link buildActionJsonSchema} directly.
 */

import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Ajv } from "ajv";
import { Effect, FileSystem, JsonSchema, Schema } from "effect";
import { ReleaseOutput, SCHEMA_URL } from "../../src/schema/release-output.js";
import { INPUT_SCHEMA_URL, SilkReleaseConfig } from "../../src/schema/silk-release-config.js";

const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const OUTPUT_PATH = resolve(REPO_ROOT, "silk-release-action.output.schema.json");
const INPUT_PATH = resolve(REPO_ROOT, "silk-release-action.input.schema.json");
const BIOME_CONFIG = resolve(REPO_ROOT, "biome.jsonc");

const DRAFT_07_META_SCHEMA = "http://json-schema.org/draft-07/schema#";

/**
 * Matches a Draft-07 `#/definitions/...` `$ref` pointer prefix.
 *
 * @remarks
 * `JsonSchema.toDocumentDraft07` lowers Draft 2020-12 `#/$defs/...` refs to the
 * canonical Draft-07 `#/definitions/...` form. We keep the definitions pool
 * under the `$defs` key (a Draft-07-valid alias that these SchemaStore
 * documents have always used), so refs are rewritten back to `#/$defs/...` to
 * stay resolvable against that pool.
 */
const DEFINITIONS_REF_PREFIX = /^#\/definitions(?=\/|$)/;

/**
 * Recursively rewrites `#/definitions/...` `$ref` pointers back to
 * `#/$defs/...` so they resolve against the `$defs` pool.
 */
const restoreDefsRefs = (node: unknown): unknown => {
	if (Array.isArray(node)) {
		return node.map(restoreDefsRefs);
	}
	if (typeof node === "object" && node !== null) {
		const out: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(node)) {
			out[key] =
				key === "$ref" && typeof value === "string"
					? value.replace(DEFINITIONS_REF_PREFIX, "#/$defs")
					: restoreDefsRefs(value);
		}
		return out;
	}
	return node;
};

/**
 * A single schema source paired with the identity it is serialised under.
 */
interface SchemaTarget {
	readonly schema: Schema.Constraint;
	readonly $id: string;
	readonly path: string;
}

const targets: ReadonlyArray<SchemaTarget> = [
	{ schema: ReleaseOutput, $id: SCHEMA_URL, path: OUTPUT_PATH },
	{ schema: SilkReleaseConfig, $id: INPUT_SCHEMA_URL, path: INPUT_PATH },
];

/**
 * Builds the SchemaStore-shaped Draft-07 JSON Schema document for an Effect
 * Schema. Pure and side-effect free so the drift test can call it directly.
 *
 * @param schema - The Effect Schema source to serialise.
 * @param $id - The canonical `$id` URL for the generated document.
 * @returns The assembled Draft-07 JSON Schema object.
 */
export const buildActionJsonSchema = (schema: Schema.Constraint, $id: string): JsonSchema.JsonSchema => {
	const document = JsonSchema.toDocumentDraft07(Schema.toJsonSchemaDocument(schema));
	return restoreDefsRefs({
		$schema: DRAFT_07_META_SCHEMA,
		$id,
		...document.schema,
		$defs: document.definitions,
	}) as JsonSchema.JsonSchema;
};

/**
 * Compiles the document with ajv in strict mode, surfacing malformed JSON
 * Schema (unknown keywords, unresolvable `$ref`s) as a failure.
 */
const validateStrict = (document: JsonSchema.JsonSchema): Effect.Effect<void, Error> =>
	Effect.try({
		try: () => {
			const ajv = new Ajv({ strict: true, allErrors: true });
			ajv.compile(document);
		},
		catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
	});

/**
 * Serialises the document to Biome-formatted JSON so the committed file matches
 * what the pre-commit hook would produce (collapsed short arrays, tabs), which
 * keeps the drift comparison below stable across regenerations.
 */
const serializeDocument = (path: string, document: JsonSchema.JsonSchema): Effect.Effect<string, Error> =>
	Effect.try({
		try: () =>
			execFileSync("pnpm", ["exec", "biome", "format", `--config-path=${BIOME_CONFIG}`, `--stdin-file-path=${path}`], {
				input: JSON.stringify(document, null, "\t"),
				encoding: "utf8",
				cwd: REPO_ROOT,
			}),
		catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
	});

/**
 * Writes the serialised document only when it differs from the committed file,
 * logging `Written`/`Unchanged` to mirror prior behaviour.
 */
const writeIfChanged = (
	path: string,
	document: JsonSchema.JsonSchema,
): Effect.Effect<void, Error, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const serialized = yield* serializeDocument(path, document);
		const exists = yield* fs.exists(path);
		const current = exists ? yield* fs.readFileString(path) : "";
		if (current === serialized) {
			yield* Effect.log(`Unchanged: ${path}`);
			return;
		}
		yield* fs.writeFileString(path, serialized);
		yield* Effect.log(`Written: ${path}`);
	});

const program: Effect.Effect<void, Error, FileSystem.FileSystem> = Effect.gen(function* () {
	for (const target of targets) {
		const document = buildActionJsonSchema(target.schema, target.$id);
		yield* validateStrict(document);
		yield* writeIfChanged(target.path, document);
	}
});

const invokedDirectly =
	process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));

if (invokedDirectly) {
	await Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer)));
}
