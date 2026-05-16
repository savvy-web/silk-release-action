/**
 * Detect publishable changes from changeset status.
 *
 * @remarks
 * Runs `changeset status --output=json`, parses the result, and classifies
 * each release under silk publishability rules. Creates a Check Run for PR
 * feedback and writes a summary to the job summary.
 *
 * Workspace discovery uses `workspaces-effect`'s sync API; the silk
 * publishability rules live in `./silk-publishability.ts`.
 */

import { dirname, join } from "node:path";
import { FileSystem } from "@effect/platform";
import type { CommandRunnerError } from "@savvy-web/github-action-effects";
import { ActionOutputs, CheckRun, CommandRunner } from "@savvy-web/github-action-effects";
import { Effect } from "effect";
import { findWorkspaceRootSync, getWorkspacePackagesSync } from "workspaces-effect";
import type { RawPackageJson } from "./silk-publishability.js";
import { silkDetect } from "./silk-publishability.js";
import { summaryWriter } from "./summary-writer.js";

/**
 * Package information from changeset status.
 */
export interface ChangesetPackage {
	name: string;
	oldVersion: string;
	newVersion: string;
	type: "major" | "minor" | "patch" | "none";
}

/**
 * Result of the detect-publishable-changes stage.
 */
export interface DetectPublishableChangesResult {
	hasChanges: boolean;
	packages: ChangesetPackage[];
	versionOnlyPackages: ChangesetPackage[];
	checkId: number;
}

/**
 * Changeset status output from `changeset status --output=json`.
 */
interface ChangesetStatus {
	releases: ChangesetPackage[];
	changesets: Array<{
		id: string;
		summary: string;
		releases: Array<{ name: string; type: string }>;
	}>;
}

/**
 * Resolve the package-manager-specific argv for `changeset status`.
 *
 * @internal
 */
const resolveChangesetCommand = (packageManager: string): { command: string; args: (file: string) => string[] } => {
	switch (packageManager) {
		case "pnpm":
			return { command: "pnpm", args: (f) => ["exec", "changeset", "status", "--output", f] };
		case "yarn":
			return { command: "yarn", args: (f) => ["changeset", "status", "--output", f] };
		case "bun":
			return { command: "bun", args: (f) => ["x", "changeset", "status", "--output", f] };
		default:
			return { command: "npx", args: (f) => ["changeset", "status", "--output", f] };
	}
};

/**
 * Detects whether the runner output indicates a Changeset ValidationError.
 *
 * @internal
 */
const isValidationError = (stderr: string): boolean =>
	stderr.includes("ValidationError") ||
	stderr.includes("depends on the ignored package") ||
	stderr.includes("is not being ignored");

const extractValidationMessage = (stderr: string): string => {
	const lines = stderr
		.split("\n")
		.filter((line) => line.includes("error") && !line.includes("at "))
		.map((line) => line.replace(/^\s*🦋\s*error\s*/, "").trim())
		.filter((line) => line.length > 0 && !line.startsWith("{"));
	return lines.length > 0 ? lines.join("\n") : "Changeset configuration validation failed";
};

/**
 * Aggregate per-changeset releases when the top-level `releases` array is
 * empty (changesets sometimes omits private packages from that field).
 *
 * @internal
 */
const aggregateReleases = (status: ChangesetStatus): ChangesetStatus => {
	if ((status.releases?.length ?? 0) > 0 || status.changesets.length === 0) return status;

	const map = new Map<string, ChangesetPackage>();
	for (const cs of status.changesets) {
		for (const rel of cs.releases ?? []) {
			if (!map.has(rel.name)) {
				map.set(rel.name, {
					name: rel.name,
					type: rel.type as ChangesetPackage["type"],
					oldVersion: "",
					newVersion: "",
				});
			}
		}
	}
	return map.size > 0 ? { ...status, releases: Array.from(map.values()) } : status;
};

/**
 * Run `changeset status` and capture its output to a temp file, returning
 * the parsed payload (or an empty payload on missing/invalid output).
 *
 * @internal
 */
const runChangesetStatus = (
	packageManager: string,
): Effect.Effect<ChangesetStatus, CommandRunnerError | Error, CommandRunner | FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const runner = yield* CommandRunner;
		const fs = yield* FileSystem.FileSystem;

		// Relative path because the changeset CLI treats absolute paths as relative.
		const statusFile = `.changeset-status-${Date.now()}.json`;
		const { command, args } = resolveChangesetCommand(packageManager);
		yield* Effect.logInfo(`Running: ${command} ${args(statusFile).join(" ")}`);

		// Capture stdout/stderr; tolerate non-zero exit codes via Effect.either.
		const result = yield* Effect.either(runner.execCapture(command, args(statusFile), { silent: true }));

		if (result._tag === "Left") {
			const stderr = result.left.stderr ?? "";
			if (stderr && isValidationError(stderr)) {
				const summary = extractValidationMessage(stderr);
				yield* Effect.logError(`Changeset validation error:\n${summary}`);
				return yield* Effect.fail(new Error(`Changeset configuration is invalid:\n${summary}`));
			}
		} else {
			yield* Effect.logInfo(`Changeset status exit code: ${result.right.exitCode}`);
			if (result.right.stdout.trim()) yield* Effect.logInfo(`Changeset stdout: ${result.right.stdout.trim()}`);
			if (result.right.stderr.trim()) yield* Effect.logInfo(`Changeset stderr: ${result.right.stderr.trim()}`);
		}

		// Parse output file.
		const exists = yield* fs.exists(statusFile);
		let parsed: ChangesetStatus = { releases: [], changesets: [] };

		if (exists) {
			const content = yield* fs.readFileString(statusFile);
			const trimmed = content.trim();
			yield* Effect.logInfo(`Changeset status file contents (${content.length} bytes): ${trimmed.slice(0, 500)}`);
			if (trimmed) {
				try {
					parsed = aggregateReleases(JSON.parse(trimmed) as ChangesetStatus);
					if (parsed.releases?.length && parsed.releases.length > 0) {
						yield* Effect.logInfo(`Parsed ${parsed.changesets.length} changesets, ${parsed.releases.length} releases`);
					} else {
						yield* Effect.logInfo(`Parsed ${parsed.changesets.length} changesets, 0 releases`);
					}
				} catch (err) {
					yield* Effect.logWarning(
						`Failed to read/parse changeset status: ${err instanceof Error ? err.message : String(err)}`,
					);
				}
			} else {
				yield* Effect.logInfo("Changeset status file is empty (no changesets present)");
			}
		} else {
			yield* Effect.logInfo(`Changeset status file not created at ${statusFile}`);
		}

		// Best-effort cleanup; ignore failures.
		yield* fs.remove(statusFile).pipe(Effect.catchAll(() => Effect.void));

		return parsed;
	});

/**
 * Discover workspace packages and read their raw `package.json` files so
 * silk rules can be applied to the full publishConfig (including
 * `targets`, which `workspaces-effect`'s typed PublishConfig omits).
 *
 * @internal
 */
const loadPackageMap = (): Effect.Effect<
	Map<string, { path: string; packageJson: RawPackageJson }>,
	never,
	FileSystem.FileSystem
> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const cwd = process.cwd();
		const packageMap = new Map<string, { path: string; packageJson: RawPackageJson }>();

		const root = findWorkspaceRootSync(cwd);
		yield* Effect.logDebug(`workspaces-effect findWorkspaceRootSync: ${root ?? "null"}`);

		if (root !== null) {
			try {
				const workspaces = getWorkspacePackagesSync(root);
				yield* Effect.logDebug(`workspaces-effect getWorkspacePackagesSync returned ${workspaces.length} workspace(s)`);
				for (const workspace of workspaces) {
					const path = join(workspace.path, "package.json");
					const result = yield* Effect.either(fs.readFileString(path));
					let raw: RawPackageJson;
					if (result._tag === "Right") {
						try {
							raw = JSON.parse(result.right) as RawPackageJson;
						} catch {
							raw = { name: workspace.name, version: workspace.version, private: workspace.private };
						}
					} else {
						yield* Effect.logDebug(`Failed to re-read ${path}: ${result.left.message ?? String(result.left)}`);
						raw = { name: workspace.name, version: workspace.version, private: workspace.private };
					}
					packageMap.set(workspace.name, { path: workspace.path, packageJson: raw });
				}
			} catch (err) {
				yield* Effect.logDebug(`workspaces-effect failed: ${err instanceof Error ? err.message : String(err)}`);
			}
		}

		// Always check root package.json for single-package repos.
		const rootPkgPath = join(cwd, "package.json");
		yield* Effect.logInfo(`Reading root package.json from: ${rootPkgPath}`);
		const result = yield* Effect.either(fs.readFileString(rootPkgPath));
		if (result._tag === "Right") {
			try {
				const rootPkg = JSON.parse(result.right) as RawPackageJson;
				yield* Effect.logInfo(
					`Root package.json parsed: name="${rootPkg.name || "(none)"}", private=${rootPkg.private ?? false}`,
				);
				if (rootPkg.publishConfig) {
					yield* Effect.logInfo(`  publishConfig.access: ${rootPkg.publishConfig.access || "(not set)"}`);
				}
				if (rootPkg.name && !packageMap.has(rootPkg.name)) {
					packageMap.set(rootPkg.name, { path: dirname(rootPkgPath), packageJson: rootPkg });
					yield* Effect.logInfo(`✓ Added root package "${rootPkg.name}" to package map`);
				} else if (rootPkg.name) {
					yield* Effect.logDebug(`Root package "${rootPkg.name}" already in package map from workspaces`);
				} else {
					yield* Effect.logWarning("Root package.json has no 'name' field - cannot detect package for release");
				}
			} catch (err) {
				yield* Effect.logWarning(
					`Failed to parse root package.json: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		} else {
			yield* Effect.logWarning(
				`Failed to read root package.json at ${rootPkgPath}: ${result.left.message ?? String(result.left)}`,
			);
		}

		return packageMap;
	});

/**
 * Detect publishable changes from changeset status, classify each
 * release under silk rules, and report via a Check Run.
 *
 * @remarks
 * A package is publishable when it has a changeset with a version bump
 * AND silk rules return a non-empty target list. Packages with changesets
 * that resolve to no silk targets are categorized as "version-only" — they
 * still get version bumps and a GitHub Release, but skip registry publish.
 */
export const detectPublishableChanges = (
	packageManager: string,
	dryRun: boolean,
): Effect.Effect<
	DetectPublishableChangesResult,
	CommandRunnerError | Error,
	ActionOutputs | CheckRun | CommandRunner | FileSystem.FileSystem
> =>
	Effect.gen(function* () {
		const outputs = yield* ActionOutputs;
		const checks = yield* CheckRun;

		const changesetStatus = yield* runChangesetStatus(packageManager);

		yield* Effect.logDebug(`Changeset status: ${JSON.stringify(changesetStatus, null, 2)}`);
		if (changesetStatus.changesets.length > 0) {
			yield* Effect.logInfo(`Found ${changesetStatus.changesets.length} changeset(s)`);
		}
		if (changesetStatus.releases.length > 0) {
			yield* Effect.logInfo(`Found ${changesetStatus.releases.length} package(s) with pending releases`);
		} else {
			yield* Effect.logInfo("No packages with pending releases found");
		}

		const packageMap = yield* loadPackageMap();

		if (packageMap.size > 0) {
			yield* Effect.logInfo(`📦 Discovered ${packageMap.size} package(s) in workspace:`);
			for (const [name, pkgInfo] of packageMap) {
				const targets = silkDetect(name, pkgInfo.packageJson);
				let strategy: string;
				if (targets.length === 0) {
					strategy = pkgInfo.packageJson.private ? "private (no publish)" : "no publishConfig";
				} else if (targets.length === 1) {
					strategy = `publishes to ${targets[0].registry} (access: ${targets[0].access})`;
				} else {
					strategy = `publishes to ${targets.length} target(s): ${targets.map((t) => t.registry).join(", ")}`;
				}
				yield* Effect.logInfo(`   • ${name} (${strategy})`);
			}
		} else {
			yield* Effect.logInfo("📦 No packages found in workspace");
		}

		const publishablePackages: ChangesetPackage[] = [];
		const versionOnlyPackages: ChangesetPackage[] = [];

		for (const release of changesetStatus.releases) {
			if (release.type === "none") {
				yield* Effect.logDebug(`Skipping ${release.name}: no version bump`);
				continue;
			}
			const pkgInfo = packageMap.get(release.name);
			if (!pkgInfo) {
				yield* Effect.logWarning(`Could not find package.json for ${release.name}, skipping`);
				continue;
			}
			const targets = silkDetect(release.name, pkgInfo.packageJson);
			if (targets.length > 0) {
				const summary =
					targets.length === 1
						? `access: ${targets[0].access}, registry: ${targets[0].registry}`
						: `${targets.length} targets`;
				yield* Effect.logInfo(`✓ ${release.name} is publishable (${summary})`);
				publishablePackages.push(release);
			} else {
				yield* Effect.logInfo(`🏷️ ${release.name}: version-only (GitHub release only)`);
				versionOnlyPackages.push(release);
			}
		}

		// Build Check Run + job summary content.
		const checkTitle = dryRun ? "🧪 Detect Publishable Changes (Dry Run)" : "Detect Publishable Changes";
		const totalReleasable = publishablePackages.length + versionOnlyPackages.length;
		const checkSummary =
			totalReleasable > 0
				? `Found ${totalReleasable} releasable package(s) with changes${
						versionOnlyPackages.length > 0
							? ` (${publishablePackages.length} publishable, ${versionOnlyPackages.length} version-only)`
							: ""
					}`
				: "No releasable packages with changes";

		const checkSections: Array<{ heading?: string; level?: 2 | 3 | 4; content: string }> = [
			{
				heading: "Publishable Packages",
				content:
					publishablePackages.length > 0
						? summaryWriter.list(
								publishablePackages.map(
									(pkg) => `**${pkg.name}**: \`${pkg.oldVersion}\` → \`${pkg.newVersion}\` (${pkg.type})`,
								),
							)
						: "_No publishable packages found_",
			},
		];
		if (versionOnlyPackages.length > 0) {
			checkSections.push({
				heading: "Version-Only Packages",
				content: summaryWriter.list(
					versionOnlyPackages.map(
						(pkg) =>
							`**${pkg.name}**: \`${pkg.oldVersion}\` → \`${pkg.newVersion}\` (${pkg.type}) — GitHub release only`,
					),
				),
			});
		}
		if (dryRun) {
			checkSections.push({
				content: "> **Dry Run Mode**: This is a preview run. No actual publishing will occur.",
			});
		}
		const changesetContent =
			changesetStatus.changesets.length > 0
				? `Found ${changesetStatus.changesets.length} changeset(s)`
				: "No changesets found";
		checkSections.push({ heading: "Changeset Summary", content: changesetContent });

		const checkDetails = summaryWriter.build(checkSections);
		const checkId = yield* checks.create(checkTitle, process.env.GITHUB_SHA ?? "");
		yield* checks.complete(checkId, "success", {
			title: checkSummary,
			summary: checkDetails,
		});

		// Job summary.
		const jobSections: Array<{ heading?: string; level?: 2 | 3 | 4; content: string }> = [
			{ heading: checkTitle, content: checkSummary },
			{
				heading: "Publishable Packages",
				level: 3,
				content:
					publishablePackages.length > 0
						? summaryWriter.table(
								["Package", "Current", "Next", "Type"],
								publishablePackages.map((pkg) => [pkg.name, pkg.oldVersion, pkg.newVersion, pkg.type]),
							)
						: "_No publishable packages found_",
			},
		];
		if (versionOnlyPackages.length > 0) {
			jobSections.push({
				heading: "Version-Only Packages (GitHub release only)",
				level: 3,
				content: summaryWriter.table(
					["Package", "Current", "Next", "Type"],
					versionOnlyPackages.map((pkg) => [pkg.name, pkg.oldVersion, pkg.newVersion, pkg.type]),
				),
			});
		}
		jobSections.push({ heading: "Changeset Summary", level: 3, content: changesetContent });
		yield* outputs.summary(summaryWriter.build(jobSections));

		return {
			hasChanges: publishablePackages.length > 0 || versionOnlyPackages.length > 0,
			packages: publishablePackages,
			versionOnlyPackages,
			checkId,
		};
	});
