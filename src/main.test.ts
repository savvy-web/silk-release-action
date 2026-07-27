/**
 * Structural check for the npm-cache wiring in `main.ts`.
 *
 * @remarks
 * `main` is an `Effect.gen` program that requires the full `ActionRuntime`
 * layer graph to actually execute, so spawning the real entry point is
 * impractical here. Instead this asserts, from the source text, that
 * `ensureNpmCacheEnv` is imported and invoked before `detectWorkflowPhase` is
 * called — the ordering that guarantees all three phases (including Phase 2
 * dry-runs and npm view calls) inherit the cache redirect.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));

describe("main.ts npm-cache wiring", () => {
	it("should call ensureNpmCacheEnv before detectWorkflowPhase in main.ts source", () => {
		// Given: the main.ts source text
		const source = readFileSync(join(HERE, "main.ts"), "utf8");

		// When
		const importsHelper = /import\s*\{[^}]*\bensureNpmCacheEnv\b[^}]*\}\s*from\s*["']\.\/utils\/npm-cache\.js["']/.test(
			source,
		);
		const callIndex = source.indexOf("ensureNpmCacheEnv()");
		const phaseDetectionIndex = source.indexOf("detectWorkflowPhase(");

		// Then
		expect(importsHelper).toBe(true);
		expect(callIndex).toBeGreaterThan(-1);
		expect(phaseDetectionIndex).toBeGreaterThan(-1);
		expect(callIndex).toBeLessThan(phaseDetectionIndex);
	});
});
