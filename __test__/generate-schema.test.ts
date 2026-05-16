/**
 * Guards the committed silk-release-action.schema.json against drift from the
 * ReleaseOutput Effect Schema. If this fails, run `pnpm generate-schema` and
 * commit the regenerated file.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { JsonSchemaExporter } from "json-schema-effect";
import { describe, expect, it } from "vitest";
import { ReleaseOutput, SCHEMA_URL } from "../src/schema/release-output.js";

const SCHEMA_PATH = resolve(fileURLToPath(new URL("..", import.meta.url)), "silk-release-action.schema.json");

describe("silk-release-action.schema.json", () => {
	it("matches the ReleaseOutput Effect Schema", async () => {
		const generated = await Effect.runPromise(
			Effect.gen(function* () {
				const exporter = yield* JsonSchemaExporter;
				return yield* exporter.generate({
					name: "silk-release-action",
					schema: ReleaseOutput,
					rootDefName: "ReleaseOutput",
					$id: SCHEMA_URL,
				});
			}).pipe(Effect.provide(JsonSchemaExporter.Live), Effect.provide(NodeFileSystem.layer)),
		);

		const committed = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
		expect(committed).toEqual(generated.schema);
	});
});
