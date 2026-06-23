import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isTurboSummarizeScript, logTurboRunSummary, pickNewest } from "./turbo-summary.js";

describe("isTurboSummarizeScript", () => {
	it("detects a `turbo run` build with --summarize", () => {
		expect(isTurboSummarizeScript("turbo run build:prod --summarize")).toBe(true);
	});

	it("detects `turbo ... run` with flags before run and --summarize=true", () => {
		expect(isTurboSummarizeScript("turbo --log-order=grouped run build --summarize=true")).toBe(true);
	});

	it("detects when CI prefix and other flags surround the command", () => {
		expect(isTurboSummarizeScript('CI="true" turbo run build:prod --output-logs=full --summarize')).toBe(true);
	});

	it("returns false for a turbo run without --summarize", () => {
		expect(isTurboSummarizeScript("turbo run build:prod --log-order=grouped")).toBe(false);
	});

	it("returns false for a non-turbo script even if --summarize appears", () => {
		expect(isTurboSummarizeScript("node build.js --summarize")).toBe(false);
	});

	it("returns false for an empty or non-string body", () => {
		expect(isTurboSummarizeScript("")).toBe(false);
		expect(isTurboSummarizeScript(undefined as unknown as string)).toBe(false);
	});
});

describe("pickNewest", () => {
	it("returns undefined for no entries", () => {
		expect(pickNewest([])).toBeUndefined();
	});

	it("returns the only entry", () => {
		expect(pickNewest([{ name: "a.json", mtimeMs: 5 }])).toBe("a.json");
	});

	it("returns the entry with the greatest mtime regardless of order", () => {
		expect(
			pickNewest([
				{ name: "old.json", mtimeMs: 100 },
				{ name: "new.json", mtimeMs: 300 },
				{ name: "mid.json", mtimeMs: 200 },
			]),
		).toBe("new.json");
	});

	it("breaks ties deterministically by larger name", () => {
		expect(
			pickNewest([
				{ name: "aaa.json", mtimeMs: 100 },
				{ name: "zzz.json", mtimeMs: 100 },
			]),
		).toBe("zzz.json");
		// order-independent
		expect(
			pickNewest([
				{ name: "zzz.json", mtimeMs: 100 },
				{ name: "aaa.json", mtimeMs: 100 },
			]),
		).toBe("zzz.json");
	});
});

describe("logTurboRunSummary (non-fatal orchestrator)", () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "turbo-summary-"));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	const run = (cwd: string, scriptName: string): Promise<void> =>
		Effect.runPromise(logTurboRunSummary(cwd, scriptName).pipe(Effect.provide(NodeFileSystem.layer)));

	it("resolves (never rejects) when the run summary JSON is malformed", async () => {
		writeFileSync(
			join(dir, "package.json"),
			JSON.stringify({ scripts: { "ci:build": "turbo run build --summarize" } }),
		);
		await mkdir(join(dir, ".turbo", "runs"), { recursive: true });
		writeFileSync(join(dir, ".turbo", "runs", "bad.json"), "{ this is not json");

		// Must resolve, not reject — turbo logging is strictly non-fatal.
		await expect(run(dir, "ci:build")).resolves.toBeUndefined();
	});

	it("resolves when the script is not a turbo --summarize build", async () => {
		writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: { "ci:build": "tsc -b" } }));
		await expect(run(dir, "ci:build")).resolves.toBeUndefined();
	});

	it("resolves when there is no .turbo/runs directory", async () => {
		writeFileSync(
			join(dir, "package.json"),
			JSON.stringify({ scripts: { "ci:build": "turbo run build --summarize" } }),
		);
		await expect(run(dir, "ci:build")).resolves.toBeUndefined();
	});

	it("resolves on a well-formed summary", async () => {
		writeFileSync(
			join(dir, "package.json"),
			JSON.stringify({ scripts: { "ci:build": "turbo run build --summarize" } }),
		);
		await mkdir(join(dir, ".turbo", "runs"), { recursive: true });
		writeFileSync(
			join(dir, ".turbo", "runs", "run.json"),
			JSON.stringify({
				execution: { command: "turbo run build", attempted: 1, cached: 1, failed: 0, success: 0, exitCode: 0 },
				tasks: [{ taskId: "pkg#build", cache: { status: "HIT", source: "REMOTE", timeSaved: 1200 } }],
			}),
		);
		await expect(run(dir, "ci:build")).resolves.toBeUndefined();
	});
});
