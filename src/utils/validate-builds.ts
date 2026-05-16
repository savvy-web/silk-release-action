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

import type {
	ActionEnvironmentError,
	ActionOutputError,
	CheckRunError,
	CommandRunnerError,
	GitHubClientError,
} from "@savvy-web/github-action-effects";
import {
	ActionEnvironment,
	ActionOutputs,
	CheckRun,
	CommandRunner,
	GitHubClient,
} from "@savvy-web/github-action-effects";
import type { ConfigError } from "effect";
import { Config, Effect } from "effect";
import { summaryWriter } from "./summary-writer.js";

export interface BuildValidationResult {
	success: boolean;
	errors: string;
	checkId: number;
}

interface BuildAnnotation {
	path: string;
	start_line: number;
	end_line: number;
	annotation_level: "failure" | "warning";
	message: string;
}

const buildInvocation = (packageManager: string, buildCommand: string): { cmd: string; args: string[] } => {
	if (buildCommand !== "") {
		switch (packageManager) {
			case "pnpm":
				return { cmd: "pnpm", args: ["run", buildCommand] };
			case "yarn":
				return { cmd: "yarn", args: ["run", buildCommand] };
			case "bun":
				return { cmd: "bun", args: ["run", buildCommand] };
			default:
				return { cmd: "npm", args: ["run", buildCommand] };
		}
	}
	switch (packageManager) {
		case "pnpm":
			return { cmd: "pnpm", args: ["ci:build"] };
		case "yarn":
			return { cmd: "yarn", args: ["ci:build"] };
		case "bun":
			return { cmd: "bun", args: ["run", "ci:build"] };
		default:
			return { cmd: "npm", args: ["run", "ci:build"] };
	}
};

const parseAnnotations = (buildError: string): BuildAnnotation[] => {
	const out: BuildAnnotation[] = [];
	const tsErrorPattern = /([^\s:]+\.tsx?):(\d+):(\d+)\s+-\s+error\s+TS\d+:\s+(.+)/g;
	let match: RegExpExecArray | null = tsErrorPattern.exec(buildError);
	while (match !== null) {
		out.push({
			path: match[1],
			start_line: Number.parseInt(match[2], 10),
			end_line: Number.parseInt(match[2], 10),
			annotation_level: "failure",
			message: match[4],
		});
		match = tsErrorPattern.exec(buildError);
	}
	const genericErrorPattern = /ERROR in ([^\s:]+):?\s*(.+)?/g;
	match = genericErrorPattern.exec(buildError);
	while (match !== null) {
		if (match[1].includes(".ts")) {
			out.push({
				path: match[1],
				start_line: 1,
				end_line: 1,
				annotation_level: "failure",
				message: match[2] ?? "Build error",
			});
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
	| CheckRunError
	| CommandRunnerError
	| ConfigError.ConfigError
	| GitHubClientError,
	ActionEnvironment | ActionOutputs | CheckRun | CommandRunner | GitHubClient
> =>
	Effect.gen(function* () {
		const env = yield* ActionEnvironment;
		const outputs = yield* ActionOutputs;
		const checks = yield* CheckRun;
		const runner = yield* CommandRunner;
		const client = yield* GitHubClient;

		const buildCommand = yield* Config.string("build-command").pipe(Config.withDefault(""));
		const dryRun = yield* Config.boolean("dry-run").pipe(Config.withDefault(false));

		const { sha, repository } = yield* env.github;
		const [owner, repo] = repository.split("/");

		const { cmd: buildCmd, args: buildArgs } = buildInvocation(packageManager, buildCommand);
		yield* Effect.logInfo(`Running build command: ${buildCmd} ${buildArgs.join(" ")}`);

		let buildError = "";
		let buildExitCode = 0;

		if (!dryRun) {
			const result = yield* Effect.either(runner.execCapture(buildCmd, buildArgs));
			if (result._tag === "Right") {
				buildExitCode = result.right.exitCode;
				buildError = result.right.stderr;
				if (result.right.stdout !== "") process.stdout.write(result.right.stdout);
				if (result.right.stderr !== "") process.stderr.write(result.right.stderr);
			} else {
				buildExitCode = 1;
				buildError = result.left.reason;
				yield* Effect.logError(`Build command failed: ${buildError}`);
			}
		} else {
			yield* Effect.logInfo(`[DRY RUN] Would run: ${buildCmd} ${buildArgs.join(" ")}`);
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

		// Use GitHubClient.rest directly so we can attach annotations — CheckRun.create
		// + complete doesn't expose the annotations field.
		const checkRun = yield* client.rest<{ id: number; html_url: string }>("checks.create.with-annotations", (octokit) =>
			(
				octokit as {
					rest: {
						checks: {
							create: (params: {
								owner: string;
								repo: string;
								name: string;
								head_sha: string;
								status: "completed";
								conclusion: "success" | "failure";
								output: {
									title: string;
									summary: string;
									annotations?: Array<BuildAnnotation>;
								};
							}) => Promise<{ data: { id: number; html_url: string } }>;
						};
					};
				}
			).rest.checks.create({
				owner,
				repo,
				name: checkTitle,
				head_sha: sha,
				status: "completed",
				conclusion: success ? "success" : "failure",
				output: {
					title: checkSummary,
					summary: checkDetails,
					annotations: annotations.slice(0, 50),
				},
			}),
		);
		yield* Effect.logInfo(`Created check run: ${checkRun.html_url}`);

		// Touch the CheckRun service so it stays in the requirements set —
		// downstream callers reuse this layer for the unified validation check.
		void checks;

		for (const ann of annotations.slice(0, 10)) {
			yield* Effect.logError(`${ann.path}:${ann.start_line}: ${ann.message}`);
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

		return { success, errors: buildError, checkId: checkRun.id };
	});
