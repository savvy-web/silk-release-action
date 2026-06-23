/**
 * Turbo run-summary detection and (Phase 1) raw logging.
 *
 * @remarks
 * When a release builds via `turbo run ... --summarize`, Turbo writes a run
 * summary JSON under `.turbo/runs/`. This module detects that a build is a
 * turbo-summarize build, locates the newest summary, and logs what it found so
 * the embedded remote cache's behaviour during a release is observable in the
 * Actions log.
 *
 * The whole flow is strictly **non-fatal**: {@link logTurboRunSummary} wraps
 * every effect (including JSON parse defects) in {@link Effect.catchAllCause}
 * and demotes any failure to a warning, so build validation never depends on
 * turbo parsing.
 *
 * @module utils/turbo-summary
 */

import { join } from "node:path";
import { FileSystem } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Step } from "@savvy-web/github-action-effects";
import { Cause, Effect, Option } from "effect";

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
 * Pick the newest entry by modification time, breaking ties deterministically
 * by the lexicographically larger name (so the result is independent of the
 * order in which directory entries were read).
 *
 * @param entries - Candidate entries.
 * @returns The name of the newest entry, or `undefined` when there are none.
 *
 * @public
 */
export function pickNewest(entries: ReadonlyArray<TurboRunEntry>): string | undefined {
	let best: TurboRunEntry | undefined;
	for (const entry of entries) {
		if (
			best === undefined ||
			entry.mtimeMs > best.mtimeMs ||
			(entry.mtimeMs === best.mtimeMs && entry.name > best.name)
		) {
			best = entry;
		}
	}
	return best?.name;
}

/**
 * Locate the newest `.turbo/runs/*.json` summary under a build directory.
 *
 * @remarks
 * Returns {@link Option.none} when the `.turbo/runs` directory is absent or
 * holds no `.json` files — both are normal "no summary to report" cases (no
 * `--summarize`, or the build failed before Turbo wrote the summary). Genuine
 * read failures surface as the {@link PlatformError} typed error.
 *
 * @param cwd - The build working directory (Turbo writes `.turbo/runs` here).
 * @returns The absolute path of the newest summary, or {@link Option.none}.
 *
 * @public
 */
export const findLatestTurboRunSummary = (
	cwd: string,
): Effect.Effect<Option.Option<string>, PlatformError, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const runsDir = join(cwd, ".turbo", "runs");
		if (!(yield* fs.exists(runsDir))) {
			return Option.none();
		}
		const names = (yield* fs.readDirectory(runsDir)).filter((name) => name.endsWith(".json"));
		if (names.length === 0) {
			return Option.none();
		}
		const entries: TurboRunEntry[] = [];
		for (const name of names) {
			const info = yield* fs.stat(join(runsDir, name));
			const mtimeMs = Option.match(info.mtime, { onNone: () => 0, onSome: (date) => date.getTime() });
			entries.push({ name, mtimeMs });
		}
		const newest = pickNewest(entries);
		return newest === undefined ? Option.none() : Option.some(join(runsDir, newest));
	});

/**
 * Phase 1: detect a turbo-summarize build, locate the newest run summary, and
 * raw-log it so the embedded remote cache's behaviour is visible in the
 * Actions log.
 *
 * @remarks
 * Non-fatal by construction: any failure (missing/malformed `package.json`,
 * unreadable directory, malformed summary JSON — including parse defects) is
 * caught via {@link Effect.catchAllCause} and demoted to a warning. The
 * effect therefore has `never` in its error channel and can be sequenced into
 * build validation without affecting its success.
 *
 * Absence (not a turbo-summarize build, or no summary written) is logged at
 * debug level and is not a failure.
 *
 * @param cwd - The build working directory.
 * @param scriptName - The package-manager script that ran the build (e.g. the
 *   `build-command` input, or `ci:build` by default).
 *
 * @public
 */
export const logTurboRunSummary = (
	cwd: string,
	scriptName: string,
): Effect.Effect<void, never, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;

		const pkgRaw = yield* fs.readFileString(join(cwd, "package.json"));
		const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string> };
		const scriptBody = pkg.scripts?.[scriptName] ?? "";

		if (!isTurboSummarizeBuild(scriptBody, process.env as { TURBO_RUN_SUMMARY?: string | undefined })) {
			yield* Effect.logDebug(`Turbo summary: '${scriptName}' is not a turbo --summarize build; skipping`);
			return;
		}

		const summaryPathOpt = yield* findLatestTurboRunSummary(cwd);
		if (Option.isNone(summaryPathOpt)) {
			yield* Effect.logDebug("Turbo summary: no .turbo/runs/*.json found; skipping");
			return;
		}
		const summaryPath = summaryPathOpt.value;

		const content = yield* fs.readFileString(summaryPath);
		const summary = JSON.parse(content) as TurboRunSummary;

		const execution = summary.execution ?? {};
		const tasks = summary.tasks ?? [];
		let remote = 0;
		let local = 0;
		let miss = 0;
		let timeSaved = 0;
		for (const task of tasks) {
			const cache = task.cache ?? {};
			if (cache.source === "REMOTE" || cache.remote === true) remote++;
			else if (cache.source === "LOCAL" || cache.local === true) local++;
			else miss++;
			timeSaved += cache.timeSaved ?? 0;
		}

		// `Step.line` bypasses the Phase-2 step buffer, so these surface live at
		// the default `info` log level (unlike `Effect.logInfo`, which is
		// buffered and discarded when the build succeeds).
		yield* Step.line("🐢", `turbo summary: ${summaryPath}`);
		yield* Step.line(
			"🐢",
			`turbo execution: command=${execution.command ?? "?"} attempted=${execution.attempted ?? 0} cached=${execution.cached ?? 0} failed=${execution.failed ?? 0}`,
		);
		yield* Step.line("🐢", `turbo cache: ${remote} REMOTE · ${local} LOCAL · ${miss} MISS · ${timeSaved}ms saved`);

		// Per-task detail stays at debug level (visible only under
		// ACTIONS_STEP_DEBUG) to keep the normal log to a few summary rows.
		for (const task of tasks) {
			const cache = task.cache ?? {};
			yield* Effect.logDebug(
				`turbo task ${task.taskId ?? "?"} — ${cache.status ?? "?"} (${cache.source && cache.source !== "" ? cache.source : "—"}), saved ${cache.timeSaved ?? 0}ms`,
			);
		}
	}).pipe(Effect.catchAllCause((cause) => Effect.logWarning(`Turbo summary logging failed: ${Cause.pretty(cause)}`)));
