/**
 * Guards the committed silk-release-action.{input,output}.schema.json files
 * against drift from their Effect Schema sources. If this fails, run
 * `pnpm generate-schema` and commit the regenerated files.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import type { SchemaEntry } from "json-schema-effect";
import { JsonSchemaExporter } from "json-schema-effect";
import { describe, expect, it } from "vitest";
import { ReleaseOutput, SCHEMA_URL } from "../src/schema/release-output.js";
import { INPUT_SCHEMA_URL, SilkReleaseConfig } from "../src/schema/silk-release-config.js";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

interface SchemaCase {
	readonly file: string;
	readonly entry: SchemaEntry;
}

const cases: ReadonlyArray<SchemaCase> = [
	{
		file: "silk-release-action.output.schema.json",
		entry: {
			name: "silk-release-action-output",
			schema: ReleaseOutput,
			rootDefName: "ReleaseOutput",
			$id: SCHEMA_URL,
		},
	},
	{
		file: "silk-release-action.input.schema.json",
		entry: {
			name: "silk-release-action-input",
			schema: SilkReleaseConfig,
			rootDefName: "SilkReleaseConfig",
			$id: INPUT_SCHEMA_URL,
		},
	},
];

describe("generated action JSON Schemas", () => {
	for (const c of cases) {
		it(`${c.file} matches its Effect Schema source`, async () => {
			const generated = await Effect.runPromise(
				Effect.gen(function* () {
					const exporter = yield* JsonSchemaExporter;
					return yield* exporter.generate(c.entry);
				}).pipe(Effect.provide(JsonSchemaExporter.Live), Effect.provide(NodeFileSystem.layer)),
			);

			const committed = JSON.parse(readFileSync(resolve(REPO_ROOT, c.file), "utf8"));
			expect(committed).toEqual(generated.schema);
		});
	}
});
