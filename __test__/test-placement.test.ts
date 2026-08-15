/**
 * Placement guard for test files.
 *
 * @remarks
 * A directory named `utils` is never collected by the vitest-agent project
 * discovery — a `*.test.ts` dropped there does not run and nothing reports that
 * it did not. The only visible signal is the collected count going *down*,
 * which no green run surfaces. This suite makes the placement rules executable
 * instead:
 *
 * - no `*.test.ts` under `src/**` (tests are not co-located any more),
 * - no `*.test.ts` under any directory whose name the discovery excludes,
 * - every `*.test.ts` in the repo lives at or below `__test__/`.
 *
 * The exclusion applies to the directory NAME at ANY depth, not to one
 * top-level path. That was learned the expensive way: this suite originally
 * checked only the literal prefix `__test__/utils/`, so when the plugin's
 * pattern widened, `__test__/unit/utils/` began matching and five suites — 60
 * cases — stopped running with nothing red (#237). Checking the name at every
 * depth is what makes the guard survive the next widening.
 */

import { readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const SKIP_DIRS = new Set([".git", ".repos", ".turbo", "coverage", "dist", "node_modules"]);

/**
 * Directory names the vitest-agent project discovery drops, at any depth.
 *
 * @remarks
 * These are treated by the plugin as holding helpers, fixtures or stored
 * output rather than suites, so anything matching is excluded before vitest
 * sees it. A `*.test.ts` below one of them is invisible, not failing. Keep
 * this in step with the plugin's exclude list; `scripts/check-test-collection.mjs`
 * is the backstop that catches a name this set has not learned about yet.
 */
const UNCOLLECTED_DIR_NAMES: ReadonlySet<string> = new Set(["utils", "fixtures", "snapshots"]);

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

	it("should have no test files under a directory the discovery never collects", () => {
		// Given every test file; When filtered to any path carrying an excluded
		// directory NAME at any depth — not just a top-level prefix.
		const inExcludedDir = testFiles.filter((f) =>
			f
				.split("/")
				.slice(0, -1)
				.some((segment) => UNCOLLECTED_DIR_NAMES.has(segment)),
		);

		// Then none remain — a suite there would silently never run.
		expect(inExcludedDir).toEqual([]);
	});

	it("should keep every test file at or below __test__/", () => {
		// Given every test file; When filtered to those outside __test__/
		const outside = testFiles.filter((f) => !f.startsWith("__test__/"));

		// Then none remain.
		expect(outside).toEqual([]);
	});
});
