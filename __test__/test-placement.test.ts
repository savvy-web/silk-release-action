/**
 * Placement guard for test files.
 *
 * @remarks
 * `__test__/utils/` is never collected by the vitest-agent project discovery —
 * a `*.test.ts` dropped there does not run and nothing reports that it did not.
 * The only visible signal is the collected count going *down*, which no green
 * run surfaces. This suite makes the placement rules executable instead:
 *
 * - no `*.test.ts` under `src/**` (tests are not co-located any more),
 * - no `*.test.ts` under `__test__/utils/**` (the directory that never collects),
 * - every `*.test.ts` in the repo lives at or below `__test__/`.
 */

import { readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const SKIP_DIRS = new Set([".git", ".repos", ".turbo", "coverage", "dist", "node_modules"]);

/** Every `*.test.ts` path in the repository, repo-relative and POSIX-separated. */
const collectTestFiles = (dir: string, acc: string[] = []): string[] => {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (SKIP_DIRS.has(entry.name)) continue;
			collectTestFiles(join(dir, entry.name), acc);
			continue;
		}
		if (entry.isFile() && entry.name.endsWith(".test.ts")) {
			acc.push(relative(ROOT, join(dir, entry.name)).split(sep).join("/"));
		}
	}
	return acc;
};

describe("test file placement", () => {
	const testFiles = collectTestFiles(ROOT);

	it("should find test files at all (guards the walker itself)", () => {
		// Given the repo tree; Then the walker must see the suites it is policing.
		expect(testFiles.length).toBeGreaterThan(20);
	});

	it("should have no test files co-located under src/", () => {
		// Given every test file; When filtered to src/
		const inSrc = testFiles.filter((f) => f.startsWith("src/"));

		// Then none remain — co-located tests moved to __test__/unit/.
		expect(inSrc).toEqual([]);
	});

	it("should have no test files under __test__/utils/, which is never collected", () => {
		// Given every test file; When filtered to the uncollected helper directory
		const inHelperDir = testFiles.filter((f) => f.startsWith("__test__/utils/"));

		// Then none remain — a suite there would silently never run.
		expect(inHelperDir).toEqual([]);
	});

	it("should keep every test file at or below __test__/", () => {
		// Given every test file; When filtered to those outside __test__/
		const outside = testFiles.filter((f) => !f.startsWith("__test__/"));

		// Then none remain.
		expect(outside).toEqual([]);
	});
});
