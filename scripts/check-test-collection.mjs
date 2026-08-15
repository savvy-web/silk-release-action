#!/usr/bin/env node
// Fails when a test file on disk is not collected by vitest.
//
// The failure this guards against is silent by construction: a suite excluded
// by project discovery does not run, does not fail, and does not appear in any
// report. The run stays green and the only trace is a smaller total that
// nobody is comparing against anything. `--pass-with-no-tests` means even
// collecting NOTHING exits 0.
//
// `__test__/test-placement.test.ts` covers the same ground by checking
// directory names against a known list. This script needs no list: it asks
// vitest what it actually collected and compares that to what is on disk, so
// it catches an exclusion rule nobody has learned about yet.

import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEST_ROOT = join(ROOT, "__test__");
const SKIP_DIRS = new Set([".git", ".repos", ".turbo", "coverage", "dist", "node_modules"]);

const toPosix = (absolute) => relative(ROOT, absolute).split(sep).join("/");

/** Every `*.test.ts` under `__test__/`, repo-relative and POSIX-separated. */
const onDisk = (dir, acc = []) => {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) onDisk(full, acc);
		} else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
			acc.push(toPosix(full));
		}
	}
	return acc;
};

/** Every test file vitest reports collecting, via `vitest list --json`. */
const collected = () => {
	const raw = execFileSync("npx", ["vitest", "list", "--json"], {
		cwd: ROOT,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
		stdio: ["ignore", "pipe", "ignore"],
	});
	const parsed = JSON.parse(raw);
	const files = new Set();
	for (const entry of Array.isArray(parsed) ? parsed : []) {
		if (typeof entry?.file === "string") files.add(toPosix(entry.file));
	}
	return files;
};

const disk = onDisk(TEST_ROOT);
const seen = collected();
const missing = disk.filter((file) => !seen.has(file)).sort();

if (disk.length === 0) {
	console.error("check-test-collection: found no test files at all — the walker is broken, not the tree.");
	process.exit(1);
}

if (missing.length > 0) {
	console.error(`check-test-collection: ${missing.length} test file(s) on disk are NEVER COLLECTED:\n`);
	for (const file of missing) console.error(`  ${file}`);
	console.error(
		[
			"",
			"These do not run, and no run reports them missing.",
			"Almost always a directory name the vitest-agent discovery excludes",
			"(`utils`, `fixtures`, `snapshots`) appearing anywhere in the path.",
			"Rename the directory — `utils` becomes `utilities` — and add the name",
			"to UNCOLLECTED_DIR_NAMES in __test__/test-placement.test.ts.",
			"",
		].join("\n"),
	);
	process.exit(1);
}

console.log(`check-test-collection: ${disk.length} test files on disk, ${disk.length} collected.`);
