/**
 * Guards the committed silk-release-action.{input,output}.schema.json files
 * against drift from their Effect Schema sources. If this fails, run
 * `pnpm generate-schema` and commit the regenerated files.
 */

import { basename } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { DocumentDiff, SchemaFile, SchemaPipeline, SchemaValidator } from "@effected/schemastore";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { targets } from "../lib/scripts/generate-schema.js";

const TestLayer = Layer.mergeAll(SchemaFile.layer, SchemaValidator.layer).pipe(Layer.provide(NodeServices.layer));

describe("generated action JSON Schemas", () => {
	for (const target of targets) {
		it(`${basename(target.path)} matches its Effect Schema source`, async () => {
			// The generator's own walk with no writes. `check` reports rather than
			// enforcing, so both halves have to be asserted: `blocked` catches a
			// document that could never have been written, and `change` catches
			// drift. Comparing content rather than text keeps the guard immune to
			// whatever formatted the committed file.
			const result = await Effect.runPromise(SchemaPipeline.checkOne(target).pipe(Effect.provide(TestLayer)));
			expect(result.blocked, `gate blocked: ${result.findings.map((f) => f.label).join(", ")}`).toBe(false);
			expect(DocumentDiff.isClean(result.change), `expected no drift, got "${result.change}"`).toBe(true);
		});
	}
});
