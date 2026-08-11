/**
 * Phase 2 utility: validate that all packages build successfully.
 *
 * @remarks
 * Runs the master build command (`ci:build` by default) for the configured
 * package manager, parses TypeScript and generic build errors into
 * annotations, and reports the result through a {@link CheckRun}. Builds
 * cover the entire codebase (not just publishable packages) so the validation
 * catches breakage anywhere in the repo.
 */

import type { CommandFailedError, CommandOutputError, Launcher } from "@effected/commands";
import { LocalExec, Run } from "@effected/commands";
import type { GitHubError, Repo } from "@effected/github";
import { Annotation, CheckRun, CheckRunOutput } from "@effected/github";
import type { ActionEnvironmentError, ActionOutputError } from "@effected/github-actions";
import { ActionEnvironment, ActionOutputs, DryRun } from "@effected/github-actions";
import type { Config, FileSystem } from "effect";
import { Cause, Effect } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import { ChildProcess } from "effect/unstable/process";
import { summaryWriter } from "./summary-writer.js";
import { emitConciseMarker, readTurboDiagnostics, renderTurboCacheSection } from "./turbo-summary.js";

export interface BuildValidationResult {
	success: boolean;
	errors: string;
	checkId: number;
	/** Web URL of the build-validation check run, for the checks-table link. */
	htmlUrl: string;
}

/**
 * The argv that runs a `package.json` script under a package manager.
 *
 * @remarks
 * `LocalExec.prefixes(launcher).scriptPrefix` is the single home of this
 * knowledge now — the hand-rolled four-way table this replaces had drifted into
 * a real inconsistency: pnpm and yarn emitted the script name bare
 * (`pnpm ci:build`) while npm and bun emitted `run` (`npm run ci:build`).
 * Equivalent for pnpm and yarn, which accept the shorthand, but the table was
 * carrying the difference for no reason and had to be read twice to see it.
 *
 * An unrecognised name falls back to `npm`, which is what the table did and
 * what `main.ts`'s detector already narrows to.
 */
const asLauncher = (packageManager: string): Launcher =>
	packageManager === "pnpm" || packageManager === "yarn" || packageManager === "bun" ? packageManager : "npm";

/**
 * The build script every validated workspace is expected to expose.
 *
 * @remarks
 * Not configurable. There was a `build-command` input read here, but it was
 * never declared in `action.yml` — in any commit — so no workflow could ever
 * set it and it always resolved to `""`, i.e. this constant. The read was
 * removed rather than the input declared: exposing a new public input is a
 * capability decision, not a cleanup.
 */
const BUILD_SCRIPT = "ci:build";

const buildInvocation = (packageManager: string): { cmd: string; args: string[] } => {
	const launcher = asLauncher(packageManager);
	const [cmd = launcher, ...prefixArgs] = LocalExec.prefixes(launcher).scriptPrefix;
	return { cmd, args: [...prefixArgs, BUILD_SCRIPT] };
};

// `Annotation` is a `Schema.Class` and renames every wire field: `startLine` /
// `endLine` / `level`, not `start_line` / `end_line` / `annotation_level`. The
// snake_case mapping happens once, in the kit's `wireOutput`.
const parseAnnotations = (buildError: string): Annotation[] => {
	const out: Annotation[] = [];
	const tsErrorPattern = /([^\s:]+\.tsx?):(\d+):(\d+)\s+-\s+error\s+TS\d+:\s+(.+)/g;
	let match: RegExpExecArray | null = tsErrorPattern.exec(buildError);
	while (match !== null) {
		out.push(
			Annotation.make({
				path: match[1],
				startLine: Number.parseInt(match[2], 10),
				endLine: Number.parseInt(match[2], 10),
				level: "failure",
				message: match[4],
			}),
		);
		match = tsErrorPattern.exec(buildError);
	}
	const genericErrorPattern = /ERROR in ([^\s:]+):?\s*(.+)?/g;
	match = genericErrorPattern.exec(buildError);
	while (match !== null) {
		if (match[1].includes(".ts")) {
			out.push(
				Annotation.make({
					path: match[1],
					startLine: 1,
					endLine: 1,
					level: "failure",
					message: match[2] ?? "Build error",
				}),
			);
		}
		match = genericErrorPattern.exec(buildError);
	}
	return out;
};

/**
 * Run the build-validation stage.
 *
 * @public
 */
export const validateBuilds = (
	packageManager: string,
): Effect.Effect<
	BuildValidationResult,
	| ActionEnvironmentError
	| ActionOutputError
	| GitHubError
	| CommandFailedError
	| CommandOutputError
	| Config.ConfigError,
	| ActionEnvironment
	| ActionOutputs
	| CheckRun
	| DryRun
	| Repo
	| ChildProcessSpawner.ChildProcessSpawner
	| FileSystem.FileSystem
> =>
	Effect.gen(function* () {
		const env = yield* ActionEnvironment;
		const outputs = yield* ActionOutputs;
		const checks = yield* CheckRun;

		// The rehearsal decision comes from the service, not a re-read of the input.
		const dryRun = yield* (yield* DryRun).isDryRun;

		const { sha } = yield* env.github;

		const { cmd: buildCmd, args: buildArgs } = buildInvocation(packageManager);
		yield* Effect.logInfo(`Running build command: ${buildCmd} ${buildArgs.join(" ")}`);

		let buildError = "";
		let buildExitCode = 0;

		if (!dryRun) {
			// `Run.collect` treats a NON-ZERO EXIT AS A RESULT, not a failure — the
			// same split the predecessor's `execCapture` had, so the exit-code
			// branch below is reached identically. The error channel fires only
			// when the process could not be run at all (`kind: "spawn"`) or its
			// output could not be captured.
			const result = yield* Effect.result(Run.collect(ChildProcess.make(buildCmd, buildArgs)));
			if (result._tag === "Success") {
				buildExitCode = result.success.exitCode;
				buildError = result.success.stderr;
				if (result.success.stdout !== "") process.stdout.write(result.success.stdout);
				if (result.success.stderr !== "") process.stderr.write(result.success.stderr);
			} else {
				buildExitCode = 1;
				buildError = result.failure.message;
				yield* Effect.logError(`Build command failed: ${buildError}`);
			}
		} else {
			yield* Effect.logInfo(`[DRY RUN] Would run: ${buildCmd} ${buildArgs.join(" ")}`);
		}

		// Surface turbo cache behaviour when this was a turbo-summarize build.
		// Strictly non-fatal — never gates build-validation success.
		let turboSection: string | null = null;
		if (!dryRun) {
			turboSection = yield* readTurboDiagnostics(
				process.cwd(),
				BUILD_SCRIPT,
				process.env as { TURBO_RUN_SUMMARY?: string | undefined },
			).pipe(
				Effect.flatMap((diag) =>
					Effect.gen(function* () {
						if (diag._tag === "not-turbo") {
							yield* Effect.logDebug("Turbo summary: not a turbo --summarize build; skipping");
							return null;
						}
						if (diag._tag === "no-summaries") {
							yield* Effect.logDebug("Turbo summary: no .turbo/runs/*.json found; skipping");
							return null;
						}
						yield* emitConciseMarker(diag.newestPath, diag.newestSummary);
						return renderTurboCacheSection(diag.aggregate);
					}),
				),
				Effect.catchCause((cause) =>
					Effect.logWarning(`Turbo summary logging failed: ${Cause.pretty(cause)}`).pipe(Effect.as(null)),
				),
			);
		}

		const success = buildExitCode === 0 && !buildError.includes("error") && !buildError.includes("ERROR");

		const annotations = !success && buildError !== "" ? parseAnnotations(buildError) : [];
		if (annotations.length > 0) yield* Effect.logInfo(`Parsed ${annotations.length} error annotations`);

		const checkTitle = dryRun ? "🧪 Build Validation (Dry Run)" : "Build Validation";
		const checkSummary = success ? "All packages built successfully" : "Build failed with errors";
		const errorSummary =
			!success && buildError !== ""
				? buildError
						.split("\n")
						.filter((line) => line.includes("error") || line.includes("ERROR"))
						.slice(0, 20)
						.join("\n")
				: "";

		const resultsTable = summaryWriter.table(
			["Status", "Details"],
			[
				["Result", success ? "✅ Success" : "❌ Failed"],
				["Command", `\`${buildCmd} ${buildArgs.join(" ")}\``],
				["Errors", annotations.length.toString()],
			],
		);

		const checkSections: Array<{ heading?: string; level?: 2 | 3; content: string }> = [
			{ heading: "Build Results", content: resultsTable },
		];
		if (turboSection !== null) {
			checkSections.push({ heading: "Turbo Cache", level: 3, content: turboSection });
		}
		if (!success && errorSummary !== "") {
			checkSections.push({
				heading: "Build Errors",
				level: 3,
				content: summaryWriter.codeBlock(errorSummary, "text"),
			});
			if (annotations.length > 20) {
				checkSections.push({ content: `_Showing first 20 of ${annotations.length} errors_` });
			}
		}
		const checkDetails = summaryWriter.build(checkSections);

		const checkRun = yield* checks.create(checkTitle, sha);
		// No `capCheckSummary` and no `annotations.slice(0, 50)`: `CheckRun.complete`
		// routes the output through `wireOutput`, which calls
		// `CheckRunOutput.truncated()` unconditionally — capping `summary` on BYTES
		// and slicing annotations to `CheckRunOutput.MAX_ANNOTATIONS` (50).
		yield* checks.complete(
			checkRun.id,
			success ? "success" : "failure",
			CheckRunOutput.make({ title: checkSummary, summary: checkDetails, annotations }),
		);
		// `CheckRunRef` exposes `url`, not `htmlUrl`.
		yield* Effect.logInfo(`Created check run: ${checkRun.url}`);

		for (const ann of annotations.slice(0, 10)) {
			yield* Effect.logError(`${ann.path}:${ann.startLine}: ${ann.message}`);
		}

		const jobResultsTable = summaryWriter.keyValueTable([
			{ key: "Result", value: success ? "✅ Success" : "❌ Failed" },
			{ key: "Command", value: `\`${buildCmd} ${buildArgs.join(" ")}\`` },
			{ key: "Errors Found", value: annotations.length.toString() },
		]);
		const jobSections: Array<{ heading?: string; level?: 2 | 3; content: string }> = [
			{ heading: checkTitle, content: checkSummary },
			{ heading: "Build Results", level: 3, content: jobResultsTable },
		];
		if (turboSection !== null) {
			jobSections.push({ heading: "Turbo Cache", level: 3, content: turboSection });
		}
		if (!success && errorSummary !== "") {
			jobSections.push({
				heading: "Build Errors",
				level: 3,
				content: summaryWriter.codeBlock(errorSummary, "text"),
			});
			if (annotations.length > 20) {
				jobSections.push({ content: `_Showing first 20 of ${annotations.length} errors_` });
			}
		}
		yield* outputs.summary(summaryWriter.build(jobSections));

		return { success, errors: buildError, checkId: checkRun.id, htmlUrl: checkRun.url };
	});
