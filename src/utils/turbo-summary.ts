/**
 * Turbo run-summary detection, diagnostics, and summary rendering.
 *
 * @remarks
 * When a release builds via `turbo run ... --summarize`, Turbo writes a run
 * summary JSON under `.turbo/runs/`. This module detects whether a build is a
 * turbo-summarize build ({@link readTurboDiagnostics}), emits concise live
 * marker lines ({@link emitConciseMarker}), and renders a collapsible
 * step-summary section ({@link renderTurboCacheSection}) so the embedded remote
 * cache's behaviour during a release is observable in the Actions log and
 * job/check summaries.
 *
 * The whole flow is strictly **non-fatal**: callers wrap via
 * {@link Effect.catchAllCause} and demote any failure to a warning, so build
 * validation never depends on turbo parsing.
 *
 * @module utils/turbo-summary
 */

import { basename, join } from "node:path";
import { FileSystem } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Step } from "@savvy-web/github-action-effects";
import { Effect, Option } from "effect";
import { summaryWriter } from "./summary-writer.js";

/**
 * Shape of the relevant fields of a Turbo run-summary JSON. Every field is
 * optional because the summary is parsed defensively — we never assume Turbo's
 * schema is stable across versions.
 *
 * @public
 */
export interface TurboRunSummary {
	execution?: {
		command?: string;
		attempted?: number;
		cached?: number;
		failed?: number;
		success?: number;
		exitCode?: number;
		startTime?: number;
		endTime?: number;
	};
	tasks?: ReadonlyArray<{
		taskId?: string;
		task?: string;
		package?: string;
		cache?: {
			local?: boolean;
			remote?: boolean;
			status?: string;
			source?: string;
			timeSaved?: number;
		};
	}>;
}

/** A `.turbo/runs` directory entry with its modification time, for ranking. */
export interface TurboRunEntry {
	name: string;
	mtimeMs: number;
}

/**
 * A single task's cache outcome, normalized for display.
 *
 * @public
 */
export interface TurboTaskRow {
	taskId: string;
	status: string;
	source: "REMOTE" | "LOCAL" | "MISS";
	timeSaved: number;
}

/**
 * Per-summary-file cache stats.
 *
 * @public
 */
export interface TurboFileStats {
	path: string;
	attempted: number;
	cached: number;
	fresh: number;
	failed: number;
	remote: number;
	local: number;
	miss: number;
	timeSaved: number;
}

/**
 * Aggregate cache stats across every summary file in a job.
 *
 * @public
 */
export interface TurboAggregate {
	files: number;
	attempted: number;
	cached: number;
	fresh: number;
	failed: number;
	remote: number;
	local: number;
	miss: number;
	timeSaved: number;
	perFile: TurboFileStats[];
	tasks: TurboTaskRow[];
}

/**
 * Decide whether a package-manager script body runs a `turbo --summarize`
 * build.
 *
 * @remarks
 * A turbo-summarize build is one whose script invokes Turbo (`turbo run` or
 * `turbo <flags> run`) **and** passes `--summarize` (with or without a value),
 * or sets `TURBO_RUN_SUMMARY` to a truthy value (either as an environment
 * variable or inline in the script).
 *
 * @param scriptBody - The raw script body from `package.json` `scripts`.
 * @param env - The environment object (typically `process.env`).
 * @returns `true` when the script is a turbo-summarize build.
 *
 * @public
 */
export function isTurboSummarizeBuild(scriptBody: string, env: { TURBO_RUN_SUMMARY?: string | undefined }): boolean {
	if (typeof scriptBody !== "string" || scriptBody === "") {
		return false;
	}
	if (!/\bturbo\b[^\n]*\brun\b/.test(scriptBody)) {
		return false;
	}
	const summarizeFlag = /--summarize\b/.test(scriptBody);
	const envValue = env.TURBO_RUN_SUMMARY;
	const envEnabled = typeof envValue === "string" && (envValue === "1" || envValue.toLowerCase() === "true");
	const inlineEnabled = /\bTURBO_RUN_SUMMARY\s*=\s*["']?(?:1|true)\b/i.test(scriptBody);
	return summarizeFlag || envEnabled || inlineEnabled;
}

/**
 * Sort entries by modification time (newest first), with ties broken by larger
 * name for determinism.
 *
 * @remarks
 * Pure and non-mutating — copies the input before sorting, so callers can pass
 * a readonly array without side effects.
 *
 * @param entries - Candidate entries.
 * @returns Sorted entries (newest mtime first, ties broken by larger name).
 *
 * @public
 */
export function sortEntriesNewestFirst(entries: ReadonlyArray<TurboRunEntry>): TurboRunEntry[] {
	return [...entries].sort((a, b) => {
		if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
		return a.name < b.name ? 1 : a.name > b.name ? -1 : 0;
	});
}

/**
 * Pick the newest entry by modification time, breaking ties deterministically
 * by the lexicographically larger name (so the result is independent of the
 * order in which directory entries were read).
 *
 * @remarks
 * A thin convenience over {@link sortEntriesNewestFirst} — returns just the
 * newest entry's name.
 *
 * @param entries - Candidate entries.
 * @returns The name of the newest entry, or `undefined` when there are none.
 *
 * @public
 */
export function pickNewest(entries: ReadonlyArray<TurboRunEntry>): string | undefined {
	return sortEntriesNewestFirst(entries)[0]?.name;
}

/**
 * List all `.turbo/runs/*.json` summaries under a build directory, sorted
 * newest-first by modification time.
 *
 * @remarks
 * Returns an empty array when the `.turbo/runs` directory is absent or holds
 * no `.json` files — both are normal cases. Genuine read failures surface as
 * the {@link PlatformError} typed error.
 *
 * @param cwd - The build working directory.
 * @returns Absolute paths of all `.json` summaries, sorted newest-first.
 *
 * @public
 */
export const listTurboRunSummaryPaths = (cwd: string): Effect.Effect<string[], PlatformError, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const runsDir = join(cwd, ".turbo", "runs");
		if (!(yield* fs.exists(runsDir))) {
			return [];
		}
		const names = (yield* fs.readDirectory(runsDir)).filter((name) => name.endsWith(".json"));
		if (names.length === 0) {
			return [];
		}
		const entries: TurboRunEntry[] = [];
		for (const name of names) {
			const info = yield* fs.stat(join(runsDir, name));
			const mtimeMs = Option.match(info.mtime, { onNone: () => 0, onSome: (date) => date.getTime() });
			entries.push({ name, mtimeMs });
		}
		return sortEntriesNewestFirst(entries).map((entry) => join(runsDir, entry.name));
	});

/**
 * Read a Turbo run-summary JSON from a path.
 *
 * @remarks
 * File read failures surface as the typed {@link PlatformError}. Malformed JSON
 * throws synchronously and becomes an Effect defect (Cause.die), not a typed
 * error; callers handle via {@link Effect.catchAllCause}.
 *
 * @param path - Absolute path to the `.json` summary file.
 * @returns The parsed summary.
 *
 * @public
 */
export const readTurboRunSummary = (
	path: string,
): Effect.Effect<TurboRunSummary, PlatformError, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const content = yield* fs.readFileString(path);
		return JSON.parse(content) as TurboRunSummary;
	});

const toTaskRows = (summary: TurboRunSummary): TurboTaskRow[] =>
	(summary.tasks ?? []).map((task) => {
		const cache = task.cache ?? {};
		const source: TurboTaskRow["source"] =
			cache.source === "REMOTE" || cache.remote === true
				? "REMOTE"
				: cache.source === "LOCAL" || cache.local === true
					? "LOCAL"
					: "MISS";
		return { taskId: task.taskId ?? "?", status: cache.status ?? "?", source, timeSaved: cache.timeSaved ?? 0 };
	});

const toFileStats = (path: string, summary: TurboRunSummary): TurboFileStats => {
	const rows = toTaskRows(summary);
	const exec = summary.execution ?? {};
	const attempted = exec.attempted ?? rows.length;
	const cached = exec.cached ?? 0;
	let remote = 0;
	let local = 0;
	let miss = 0;
	let timeSaved = 0;
	for (const row of rows) {
		if (row.source === "REMOTE") remote++;
		else if (row.source === "LOCAL") local++;
		else miss++;
		timeSaved += row.timeSaved;
	}
	return {
		path,
		attempted,
		cached,
		fresh: Math.max(0, attempted - cached),
		failed: exec.failed ?? 0,
		remote,
		local,
		miss,
		timeSaved,
	};
};

/**
 * Aggregate cache stats across all turbo run summaries in a batch.
 *
 * @remarks
 * `cached` and `fresh` come from each summary's `execution` block while
 * `remote`, `local`, and `miss` are counted from task rows, so the two are
 * independent turbo-reported figures that may not reconcile under version skew.
 *
 * @param items - Array of summary file paths paired with parsed summaries.
 * @returns Aggregated statistics with per-file detail and flattened task rows.
 *
 * @public
 */
export function aggregateTurboRuns(items: ReadonlyArray<{ path: string; summary: TurboRunSummary }>): TurboAggregate {
	const perFile = items.map(({ path, summary }) => toFileStats(path, summary));
	const tasks = items.flatMap(({ summary }) => toTaskRows(summary));
	const sum = (pick: (f: TurboFileStats) => number): number => perFile.reduce((total, f) => total + pick(f), 0);
	return {
		files: perFile.length,
		attempted: sum((f) => f.attempted),
		cached: sum((f) => f.cached),
		fresh: sum((f) => f.fresh),
		failed: sum((f) => f.failed),
		remote: sum((f) => f.remote),
		local: sum((f) => f.local),
		miss: sum((f) => f.miss),
		timeSaved: sum((f) => f.timeSaved),
		perFile,
		tasks,
	};
}

/**
 * Build the three concise marker lines for the newest summary: path,
 * execution summary, and a REMOTE/LOCAL/MISS cache tally.
 *
 * @remarks
 * Pure — formats display strings only. Cache counts derive from the summary's
 * task rows via {@link toFileStats}; missing fields fall back to `0`/`"?"`.
 *
 * @param path - Absolute path to the summary file (used as the first line).
 * @param summary - Parsed turbo run summary.
 * @returns Array of three formatted marker lines.
 *
 * @public
 */
export function formatConciseMarkerLines(path: string, summary: TurboRunSummary): string[] {
	const stats = toFileStats(path, summary);
	const exec = summary.execution ?? {};
	return [
		`turbo summary: ${path}`,
		`turbo execution: command=${exec.command ?? "?"} attempted=${exec.attempted ?? 0} cached=${exec.cached ?? 0} failed=${exec.failed ?? 0}`,
		`turbo cache: ${stats.remote} REMOTE · ${stats.local} LOCAL · ${stats.miss} MISS · ${stats.timeSaved}ms saved`,
	];
}

/**
 * Emit the concise marker via `Step.line`, which bypasses the Phase-2 step
 * buffer and appears live at the default info level.
 *
 * @remarks
 * `Effect.logInfo` would be buffered and discarded on a successful build inside
 * the Phase-2 `Step.groupStep`; `Step.line` writes live, so the marker is
 * always visible.
 *
 * @param path - Absolute path to the summary file.
 * @param summary - Parsed turbo run summary.
 * @returns Effect that emits all three marker lines to stdout.
 *
 * @public
 */
export const emitConciseMarker = (path: string, summary: TurboRunSummary): Effect.Effect<void> =>
	Effect.forEach(formatConciseMarkerLines(path, summary), (line) => Step.line("🐢", line), { discard: true });

/**
 * Result of detecting and reading turbo run summaries.
 *
 * @public
 */
export type TurboDiagnostics =
	| { _tag: "not-turbo" }
	| { _tag: "no-summaries" }
	| { _tag: "ok"; newestPath: string; newestSummary: TurboRunSummary; aggregate: TurboAggregate };

/**
 * Detect a turbo-summarize build, read every `.turbo/runs/*.json`, and
 * aggregate. Returns a discriminated result so the caller chooses the log
 * level / output.
 *
 * @remarks
 * Each summary file is read with an individual guard: a malformed or unreadable
 * file is skipped (debug-logged) rather than propagating a defect. Only
 * surviving files are aggregated. If all files fail, `{ _tag: "no-summaries" }`
 * is returned rather than a defect. The outer `package.json` read still
 * surfaces its `PlatformError` typed channel; a malformed `package.json` is a
 * defect — the `validateBuilds` caller's `catchAllCause` is the backstop.
 *
 * @public
 */
export const readTurboDiagnostics = (
	cwd: string,
	scriptName: string,
	env: { TURBO_RUN_SUMMARY?: string | undefined },
): Effect.Effect<TurboDiagnostics, PlatformError, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const pkgRaw = yield* fs.readFileString(join(cwd, "package.json"));
		const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string> };
		const scriptBody = pkg.scripts?.[scriptName] ?? "";
		if (!isTurboSummarizeBuild(scriptBody, env)) {
			return { _tag: "not-turbo" };
		}
		const paths = yield* listTurboRunSummaryPaths(cwd);
		if (paths.length === 0) {
			return { _tag: "no-summaries" };
		}
		const items: { path: string; summary: TurboRunSummary }[] = [];
		for (const path of paths) {
			const result = yield* readTurboRunSummary(path).pipe(
				Effect.map((summary) => ({ path, summary })),
				Effect.catchAllCause((cause) =>
					Effect.logDebug(`Turbo summary: skipping unreadable/malformed ${path}: ${cause}`).pipe(
						Effect.as(null as { path: string; summary: TurboRunSummary } | null),
					),
				),
			);
			if (result !== null) {
				items.push(result);
			}
		}
		if (items.length === 0) {
			return { _tag: "no-summaries" };
		}
		return {
			_tag: "ok",
			newestPath: items[0].path,
			newestSummary: items[0].summary,
			aggregate: aggregateTurboRuns(items),
		};
	});

/**
 * Render the collapsed "Turbo Cache" step-summary section markdown.
 * @public
 */
export function renderTurboCacheSection(aggregate: TurboAggregate): string {
	const totals = summaryWriter.table(
		["Metric", "Value"],
		[
			["Attempted", String(aggregate.attempted)],
			["Cached", String(aggregate.cached)],
			["Fresh", String(aggregate.fresh)],
			["Failed", String(aggregate.failed)],
			["Time saved", `${aggregate.timeSaved}ms`],
		],
	);
	const sources = `**Cache sources:** ${aggregate.remote} REMOTE · ${aggregate.local} LOCAL · ${aggregate.miss} MISS`;
	const parts: string[] = [totals, sources];
	if (aggregate.files > 1) {
		parts.push(
			summaryWriter.table(
				["Summary", "Attempted", "Cached", "Remote", "Local", "Miss", "Saved (ms)"],
				aggregate.perFile.map((f) => [
					basename(f.path),
					String(f.attempted),
					String(f.cached),
					String(f.remote),
					String(f.local),
					String(f.miss),
					String(f.timeSaved),
				]),
			),
		);
	}
	if (aggregate.tasks.length > 0) {
		const taskTable = summaryWriter.table(
			["Task", "Status", "Source", "Saved (ms)"],
			aggregate.tasks.map((t) => [t.taskId, t.status, t.source, String(t.timeSaved)]),
		);
		parts.push(
			`<details>\n<summary>Per-task detail (${aggregate.tasks.length})</summary>\n\n${taskTable}\n\n</details>`,
		);
	}
	return parts.join("\n\n");
}
