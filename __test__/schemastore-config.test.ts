/**
 * Pins the identities `schemastore.config.ts` derives to the URLs the source
 * schemas publish. Content drift between the committed documents and their
 * Effect Schema sources is `pnpm schema:check`'s job (the CI gate); this test
 * covers the one thing that gate cannot see — a config that derives a
 * different `$id` from the one every emitted payload carries as `$schema`
 * (`SCHEMA_URL`) or the one the input document advertises (`INPUT_SCHEMA_URL`).
 * `schemastore build` would happily regenerate under the new identity, and
 * consumers would resolve a URL the action never emits.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../lib/scripts/schemastore.config.js";
import { SCHEMA_URL } from "../src/schema/release-output.js";
import { INPUT_SCHEMA_URL } from "../src/schema/silk-release-config.js";

const CONFIG_DIR = resolve(import.meta.dirname, "../lib/scripts");

const byName = (name: string) => {
	const entry = config.schemas.find((s) => s.name === name);
	if (entry === undefined) throw new Error(`schemastore.config.ts declares no "${name}" schema`);
	return entry;
};

describe("schemastore.config.ts", () => {
	it("derives the output document's $id as SCHEMA_URL, at a versioned path", () => {
		const output = byName("silk-release-action");
		expect(output.target.$id).toBe(SCHEMA_URL);
		// The label the $id carries is the label the file is written under.
		expect(output.target.version).toBeDefined();
		// Paths are relative to the config file's directory (lib/scripts/).
		const file = `schemas/${output.target.version}/silk-release-action-${output.target.version}.json`;
		expect(output.target.path).toBe(`../../${file}`);
		expect(SCHEMA_URL.endsWith(`/${file}`)).toBe(true);
	});

	it("derives the input document's $id as INPUT_SCHEMA_URL, unversioned", () => {
		const input = byName("silk-release-action.input.schema");
		expect(input.target.$id).toBe(INPUT_SCHEMA_URL);
		expect(input.target.version).toBeUndefined();
		expect(input.target.path).toBe("../../schemas/silk-release-action.input.schema.json");
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
