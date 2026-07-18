/**
 * Guards the committed silk-release-action.{input,output}.schema.json files
 * against drift from their Effect Schema sources. If this fails, run
 * `pnpm generate-schema` and commit the regenerated files.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildActionJsonSchema } from "../lib/scripts/generate-schema.js";
import { ReleaseOutput, SCHEMA_URL } from "../src/schema/release-output.js";
import { INPUT_SCHEMA_URL, SilkReleaseConfig } from "../src/schema/silk-release-config.js";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

interface SchemaCase {
	readonly file: string;
	readonly schema: Parameters<typeof buildActionJsonSchema>[0];
	readonly $id: string;
}

const cases: ReadonlyArray<SchemaCase> = [
	{ file: "silk-release-action.output.schema.json", schema: ReleaseOutput, $id: SCHEMA_URL },
	{ file: "silk-release-action.input.schema.json", schema: SilkReleaseConfig, $id: INPUT_SCHEMA_URL },
];

describe("generated action JSON Schemas", () => {
	for (const c of cases) {
		it(`${c.file} matches its Effect Schema source`, () => {
			const generated = buildActionJsonSchema(c.schema, c.$id);
			const committed = JSON.parse(readFileSync(resolve(REPO_ROOT, c.file), "utf8"));
			expect(committed).toEqual(generated);
		});
	}
});
