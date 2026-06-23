import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { Step } from "@savvy-web/github-action-effects";
import { Effect, LogLevel, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	aggregateTurboRuns,
	emitConciseMarker,
	formatConciseMarkerLines,
	isTurboSummarizeBuild,
	listTurboRunSummaryPaths,
	logTurboRunSummary,
	pickNewest,
	renderTurboCacheSection,
	sortEntriesNewestFirst,
} from "./turbo-summary.js";

describe("isTurboSummarizeBuild", () => {
	const noEnv = {} as { TURBO_RUN_SUMMARY?: string };
	it("detects a turbo run build with --summarize", () => {
		expect(isTurboSummarizeBuild("turbo run build:prod --summarize", noEnv)).toBe(true);
	});
	it("detects --summarize=true with flags before run", () => {
		expect(isTurboSummarizeBuild("turbo --log-order=grouped run build --summarize=true", noEnv)).toBe(true);
	});
	it("detects TURBO_RUN_SUMMARY=1 in the process env", () => {
		expect(isTurboSummarizeBuild("turbo run build:prod", { TURBO_RUN_SUMMARY: "1" })).toBe(true);
	});
	it("detects TURBO_RUN_SUMMARY=true (case-insensitive) in the env", () => {
		expect(isTurboSummarizeBuild("turbo run build", { TURBO_RUN_SUMMARY: "TRUE" })).toBe(true);
	});
	it("detects TURBO_RUN_SUMMARY set inline in the script", () => {
		expect(isTurboSummarizeBuild("TURBO_RUN_SUMMARY=1 turbo run build", noEnv)).toBe(true);
	});
	it("returns false for a turbo run with neither flag nor env", () => {
		expect(isTurboSummarizeBuild("turbo run build:prod --log-order=grouped", noEnv)).toBe(false);
	});
	it("returns false when env is set but the script is not turbo", () => {
		expect(isTurboSummarizeBuild("node build.js", { TURBO_RUN_SUMMARY: "1" })).toBe(false);
	});
	it("returns false for env value 0/false/empty", () => {
		expect(isTurboSummarizeBuild("turbo run build", { TURBO_RUN_SUMMARY: "0" })).toBe(false);
		expect(isTurboSummarizeBuild("turbo run build", { TURBO_RUN_SUMMARY: "false" })).toBe(false);
		expect(isTurboSummarizeBuild("turbo run build", { TURBO_RUN_SUMMARY: "" })).toBe(false);
	});
	it("returns false for an empty or non-string body", () => {
		expect(isTurboSummarizeBuild("", noEnv)).toBe(false);
		expect(isTurboSummarizeBuild(undefined as unknown as string, noEnv)).toBe(false);
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

describe("sortEntriesNewestFirst", () => {
	it("orders newest mtime first, tie-broken by larger name", () => {
		const sorted = sortEntriesNewestFirst([
			{ name: "old.json", mtimeMs: 100 },
			{ name: "new.json", mtimeMs: 300 },
			{ name: "aaa.json", mtimeMs: 300 },
		]);
		expect(sorted.map((e) => e.name)).toEqual(["new.json", "aaa.json", "old.json"]);
	});
});

describe("listTurboRunSummaryPaths", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "turbo-list-"));
	});
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});
	const run = (cwd: string): Promise<string[]> =>
		Effect.runPromise(listTurboRunSummaryPaths(cwd).pipe(Effect.provide(NodeFileSystem.layer)));

	it("returns [] when .turbo/runs is absent", async () => {
		await expect(run(dir)).resolves.toEqual([]);
	});
	it("returns [] when the dir has no json files", async () => {
		await mkdir(join(dir, ".turbo", "runs"), { recursive: true });
		writeFileSync(join(dir, ".turbo", "runs", "note.txt"), "x");
		await expect(run(dir)).resolves.toEqual([]);
	});
	it("returns all json paths newest-first", async () => {
		const runs = join(dir, ".turbo", "runs");
		await mkdir(runs, { recursive: true });
		writeFileSync(join(runs, "a.json"), "{}");
		writeFileSync(join(runs, "b.json"), "{}");
		// make b.json newer
		const future = new Date(Date.now() + 10_000);
		utimesSync(join(runs, "b.json"), future, future);
		const paths = await run(dir);
		expect(paths.map((p) => p.split("/").pop())).toEqual(["b.json", "a.json"]);
		expect(paths.every((p) => p.startsWith(runs))).toBe(true);
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

	// Regression for the integration finding: inside the Phase-2
	// `Step.groupStep`, info-level Effect logs are buffered and discarded on
	// success, so the marker must be emitted via a buffer-bypassing channel
	// (`Step.line`) to appear live. Wrapping in `Step.withStep` reproduces that
	// buffering; `Effect.logInfo` would be swallowed, `Step.line` is not.
	it("emits the marker live even when wrapped in a buffering Step that succeeds", async () => {
		const summary = {
			execution: { command: "turbo run build", attempted: 2, cached: 2, failed: 0 },
			tasks: [{ taskId: "a#build", cache: { status: "HIT", source: "REMOTE", timeSaved: 100 } }],
		};
		const chunks: string[] = [];
		const origWrite = process.stdout.write.bind(process.stdout);
		// biome-ignore lint/suspicious/noExplicitAny: monkey-patch for test capture
		(process.stdout.write as any) = (chunk: unknown, ...rest: unknown[]) => {
			chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString("utf-8"));
			return origWrite(chunk as string, ...(rest as []));
		};
		try {
			await Effect.runPromise(
				Step.withStep("Validate builds", emitConciseMarker("/x/run.json", summary)).pipe(
					Logger.withMinimumLogLevel(LogLevel.All),
				),
			);
		} finally {
			process.stdout.write = origWrite;
		}
		expect(chunks.join("")).toContain("/x/run.json");
	});
});

describe("aggregateTurboRuns", () => {
	const remoteSummary = {
		execution: { command: "turbo run build", attempted: 2, cached: 2, failed: 0 },
		tasks: [
			{ taskId: "a#build", cache: { status: "HIT", source: "REMOTE", timeSaved: 100 } },
			{ taskId: "b#build", cache: { status: "HIT", source: "LOCAL", timeSaved: 200 } },
		],
	};
	it("derives per-file stats and task rows from one summary", () => {
		const agg = aggregateTurboRuns([{ path: "/x/run.json", summary: remoteSummary }]);
		expect(agg.files).toBe(1);
		expect(agg.attempted).toBe(2);
		expect(agg.cached).toBe(2);
		expect(agg.fresh).toBe(0);
		expect(agg.remote).toBe(1);
		expect(agg.local).toBe(1);
		expect(agg.miss).toBe(0);
		expect(agg.timeSaved).toBe(300);
		expect(agg.tasks).toHaveLength(2);
		expect(agg.tasks[0]).toEqual({ taskId: "a#build", status: "HIT", source: "REMOTE", timeSaved: 100 });
	});
	it("classifies a built task as MISS and counts fresh", () => {
		const agg = aggregateTurboRuns([
			{
				path: "/x/run.json",
				summary: {
					execution: { attempted: 1, cached: 0, failed: 0 },
					tasks: [{ taskId: "c#build", cache: { status: "MISS", source: "" } }],
				},
			},
		]);
		expect(agg.miss).toBe(1);
		expect(agg.fresh).toBe(1);
		expect(agg.tasks[0].source).toBe("MISS");
	});
	it("sums across multiple files and preserves per-file rows", () => {
		const agg = aggregateTurboRuns([
			{ path: "/x/1.json", summary: remoteSummary },
			{ path: "/x/2.json", summary: remoteSummary },
		]);
		expect(agg.files).toBe(2);
		expect(agg.attempted).toBe(4);
		expect(agg.remote).toBe(2);
		expect(agg.timeSaved).toBe(600);
		expect(agg.perFile.map((f) => f.path)).toEqual(["/x/1.json", "/x/2.json"]);
		expect(agg.tasks).toHaveLength(4);
	});
});

describe("formatConciseMarkerLines", () => {
	it("returns path, execution, and cache-tally lines", () => {
		const lines = formatConciseMarkerLines("/x/run.json", {
			execution: { command: "turbo run build", attempted: 2, cached: 2, failed: 0 },
			tasks: [
				{ taskId: "a#build", cache: { status: "HIT", source: "REMOTE", timeSaved: 100 } },
				{ taskId: "b#build", cache: { status: "HIT", source: "LOCAL", timeSaved: 200 } },
			],
		});
		expect(lines[0]).toContain("/x/run.json");
		expect(lines[1]).toContain("attempted=2");
		expect(lines[1]).toContain("cached=2");
		expect(lines[2]).toBe("turbo cache: 1 REMOTE · 1 LOCAL · 0 MISS · 300ms saved");
	});
});

describe("renderTurboCacheSection", () => {
	const agg = aggregateTurboRuns([
		{
			path: "/x/run.json",
			summary: {
				execution: { attempted: 2, cached: 2, failed: 0 },
				tasks: [
					{ taskId: "a#build", cache: { status: "HIT", source: "REMOTE", timeSaved: 100 } },
					{ taskId: "b#build", cache: { status: "HIT", source: "LOCAL", timeSaved: 200 } },
				],
			},
		},
	]);
	it("includes totals, the source tally, and a collapsed per-task table", () => {
		const md = renderTurboCacheSection(agg);
		expect(md).toContain("Attempted");
		expect(md).toContain("1 REMOTE · 1 LOCAL · 0 MISS");
		expect(md).toContain("<details>");
		expect(md).toContain("a#build");
	});
	it("omits the per-file table for a single file", () => {
		// "Attempted" appears once (totals row label); the per-file table — which
		// would add a second "Attempted" column header — is omitted for one file.
		const md = renderTurboCacheSection(agg);
		expect((md.match(/Attempted/g) ?? []).length).toBe(1);
	});
});
