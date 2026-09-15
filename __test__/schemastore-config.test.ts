/**
 * Pins the identities `lib/scripts/schemastore.config.ts` derives to the URLs
 * the source schemas publish. Content drift between the committed documents
 * and their Effect Schema sources is `pnpm schema:check`'s job (the CI gate);
 * this test covers the one thing that gate cannot see — a config that derives
 * a different `$id` from the one every emitted payload carries as `$schema`
 * (`SCHEMA_URL`) or the one the input document advertises
 * (`INPUT_SCHEMA_URL`). `schemastore build` would happily regenerate under the
 * new identity, and consumers would resolve a URL the action never emits.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../lib/scripts/schemastore.config.js";
import { SCHEMA_URL } from "../src/schema/release-output.js";
import { INPUT_SCHEMA_URL, OUTPUT_SCHEMA_URL, OUTPUT_SCHEMA_VERSION } from "../src/schema/silk-release-config.js";

// Relative paths in the config resolve against the config file's directory.
const CONFIG_DIR = resolve(import.meta.dirname, "../lib/scripts");

const byName = (name: string) => {
	const entry = config.schemas.find((s) => s.name === name);
	if (entry === undefined) throw new Error(`schemastore.config.ts declares no "${name}" schema`);
	return entry;
};

const expected = (name: string) => ({
	id: `${OUTPUT_SCHEMA_URL}/${OUTPUT_SCHEMA_VERSION}/${name}-${OUTPUT_SCHEMA_VERSION}.json`,
	path: `../../schemas/${OUTPUT_SCHEMA_VERSION}/${name}-${OUTPUT_SCHEMA_VERSION}.json`,
});

describe("lib/scripts/schemastore.config.ts", () => {
	it("derives the output document's $id as SCHEMA_URL, at the versioned path", () => {
		const output = byName("silk-release-action.output");
		expect(output.target.$id).toBe(SCHEMA_URL);
		expect(output.target.$id).toBe(expected("silk-release-action.output").id);
		expect(output.target.path).toBe(expected("silk-release-action.output").path);
	});

	it("derives the input document's $id as INPUT_SCHEMA_URL, at the versioned path", () => {
		const input = byName("silk-release-action.input");
		expect(input.target.$id).toBe(INPUT_SCHEMA_URL);
		expect(input.target.$id).toBe(expected("silk-release-action.input").id);
		expect(input.target.path).toBe(expected("silk-release-action.input").path);
	});

	it("versions both documents at OUTPUT_SCHEMA_VERSION, unpublished", () => {
		expect(config.schemas.map((s) => s.name).sort()).toEqual([
			"silk-release-action.input",
			"silk-release-action.output",
		]);
		for (const schema of config.schemas) {
			expect(String(schema.target.version), schema.name).toBe(OUTPUT_SCHEMA_VERSION);
			expect(schema.target.published, schema.name).toBe(false);
			expect(schema.frozen, schema.name).toEqual([]);
		}
	});

	it("generates every document closed (onExcessProperty: error)", () => {
		for (const schema of config.schemas) {
			expect(schema.target.jsonSchema?.onExcessProperty, schema.name).toBe("error");
		}
	});

	it("has every derived document committed on disk", () => {
		for (const schema of config.schemas) {
			expect(existsSync(resolve(CONFIG_DIR, schema.target.path)), schema.target.path).toBe(true);
		}
	});
});
