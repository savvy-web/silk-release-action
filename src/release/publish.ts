/**
 * Phase-3 publish orchestrator.
 *
 * Detects released packages from a merged PR or commit diff (or from
 * caller-supplied pre-detected releases), resolves publish targets via
 * `PublishabilityDetector`, orders them topologically, and publishes each
 * package to each configured registry — accumulating errors per package so
 * one failure does not abort the batch.
 *
 * @module release/publish
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AttestError, PackagePublishError } from "@savvy-web/github-action-effects";
import { Attest, ErrorAccumulator, GitHubClient, NpmRegistry, PackagePublish } from "@savvy-web/github-action-effects";
import { Effect } from "effect";
import { PublishabilityDetector, TopologicalSorter, WorkspaceDiscovery, WorkspacePackage } from "workspaces-effect";

import { PublishError } from "./errors.js";
import type { PackagePublishResult, PublishPackagesResult, TargetPublishResult } from "./types.js";

// ─── Public interfaces ────────────────────────────────────────────────────────

/**
 * Pre-detected release (name + version + source path) provided by the caller
 * when the detection step has already been done (e.g., from `main.ts`).
 *
 * @public
 */
export interface PreDetectedRelease {
	readonly name: string;
	readonly version: string;
	readonly path: string;
}

/**
 * Input arguments for {@link runPublish}.
 *
 * @public
 */
export interface PublishInputArgs {
	readonly packageManager: string;
	readonly targetBranch: string;
	readonly dryRun: boolean;
	readonly mergedReleasePRNumber: number | undefined;
	/**
	 * Optional pre-detected releases provided by the caller.
	 * When set, skip the GitHub API detection step.
	 */
	readonly preDetectedReleases?: ReadonlyArray<PreDetectedRelease> | undefined;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Resolve the token to use for registry authentication.
 *
 * Mirrors the resolution order in `registry-auth.ts`:
 *  - npm public registry  → `NPM_TOKEN` / `INPUT_NPM_TOKEN`
 *  - GitHub Packages      → `SILK_GITHUB_PACKAGES_TOKEN`
 *  - Custom registries    → env var derived from registry URL
 *
 * Returns `null` when no token is found (OIDC path).
 */
function resolveToken(registry: string): string | null {
	if (registry.includes("registry.npmjs.org")) {
		return process.env.NPM_TOKEN ?? process.env.INPUT_NPM_TOKEN ?? null;
	}
	if (registry.includes("npm.pkg.github.com")) {
		return process.env.SILK_GITHUB_PACKAGES_TOKEN ?? null;
	}
	const envName = registry
		.replace(/^https?:\/\//, "")
		.replace(/[^a-zA-Z0-9]/g, "_")
		.toUpperCase()
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "")
		.concat("_TOKEN");
	return process.env[envName] ?? null;
}

/** Infer bump type from old/new version strings (for logging). */
function inferBumpType(oldVersion: string, newVersion: string): "major" | "minor" | "patch" | "unknown" {
	const oldParts = oldVersion.split(".").map(Number);
	const newParts = newVersion.split(".").map(Number);
	if (oldParts.length < 3 || newParts.length < 3) return "unknown";
	if ((newParts[0] ?? 0) > (oldParts[0] ?? 0)) return "major";
	if (newParts[0] === oldParts[0] && (newParts[1] ?? 0) > (oldParts[1] ?? 0)) return "minor";
	return "patch";
}

// ─── Detection helpers ────────────────────────────────────────────────────────

/**
 * Detect released packages from the merged PR's file diff.
 *
 * Ports `detectReleasedPackagesFromPR` using `GitHubClient.rest` for all
 * Octokit calls.  Reads the current `package.json` from disk (it exists on
 * the filesystem after the merge) and fetches the base-branch version via the
 * GitHub Contents API.
 */
const detectFromPR = (prNumber: number): Effect.Effect<ReadonlyArray<PreDetectedRelease>, never, GitHubClient> =>
	Effect.gen(function* () {
		const client = yield* GitHubClient;
		const { owner, repo } = yield* client.repo;

		// List files changed in the merged PR
		interface PrFile {
			filename: string;
			status: string;
		}
		const files = yield* client
			.rest<PrFile[]>("pulls.listFiles", (octokit) => {
				const ok = octokit as {
					rest: {
						pulls: {
							listFiles: (p: Record<string, unknown>) => Promise<{ data: PrFile[] }>;
						};
					};
				};
				return ok.rest.pulls.listFiles({ owner, repo, pull_number: prNumber, per_page: 100 });
			})
			.pipe(Effect.catchAll(() => Effect.succeed([] as PrFile[])));

		// Filter to package.json files that were modified
		const modifiedPkgJsonFiles = files.filter(
			(f) => f.filename.endsWith("package.json") && (f.status === "modified" || f.status === "changed"),
		);

		// Also include the root package.json if modified
		const rootPkgJson = files.find((f) => f.filename === "package.json" && f.status === "modified");
		const allPkgJsonFiles = rootPkgJson
			? [rootPkgJson, ...modifiedPkgJsonFiles.filter((f) => f.filename !== "package.json")]
			: modifiedPkgJsonFiles;

		if (allPkgJsonFiles.length === 0) return [];

		// Get the base SHA from the PR
		interface PrData {
			base: { sha: string };
		}
		const prData = yield* client
			.rest<PrData>("pulls.get", (octokit) => {
				const ok = octokit as {
					rest: { pulls: { get: (p: Record<string, unknown>) => Promise<{ data: PrData }> } };
				};
				return ok.rest.pulls.get({ owner, repo, pull_number: prNumber });
			})
			.pipe(Effect.catchAll(() => Effect.succeed({ base: { sha: "" } } as PrData)));

		const baseSha = prData.base.sha;
		const releases: PreDetectedRelease[] = [];

		for (const file of allPkgJsonFiles) {
			const fullPath = join(process.cwd(), file.filename);
			if (!existsSync(fullPath)) continue;

			let currentContent: { name?: string; version?: string };
			try {
				currentContent = JSON.parse(readFileSync(fullPath, "utf-8")) as { name?: string; version?: string };
			} catch {
				continue;
			}

			const newVersion = currentContent.version ?? "0.0.0";
			let oldVersion = "0.0.0";

			if (baseSha) {
				interface ContentData {
					content?: string;
				}
				const oldContent = yield* client
					.rest<ContentData>("repos.getContent", (octokit) => {
						const ok = octokit as {
							rest: { repos: { getContent: (p: Record<string, unknown>) => Promise<{ data: ContentData }> } };
						};
						return ok.rest.repos.getContent({ owner, repo, path: file.filename, ref: baseSha });
					})
					.pipe(Effect.catchAll(() => Effect.succeed({} as ContentData)));

				if (oldContent.content) {
					try {
						const decoded = Buffer.from(oldContent.content, "base64").toString("utf-8");
						const oldPkg = JSON.parse(decoded) as { version?: string };
						oldVersion = oldPkg.version ?? "0.0.0";
					} catch {
						// keep oldVersion
					}
				}
			}

			if (oldVersion === newVersion) continue;

			const packageDir = dirname(file.filename);
			const pkgPath = packageDir === "." ? process.cwd() : join(process.cwd(), packageDir);

			const bumpType = inferBumpType(oldVersion, newVersion);
			yield* Effect.logInfo(`  ${currentContent.name}: ${oldVersion} → ${newVersion} (${bumpType})`);

			releases.push({
				name: currentContent.name ?? packageDir,
				version: newVersion,
				path: pkgPath,
			});
		}

		return releases;
	}).pipe(Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<PreDetectedRelease>)));

/**
 * Detect released packages by comparing HEAD with its first parent via the
 * GitHub compare API.
 *
 * Ports `detectReleasedPackagesFromCommit` using `GitHubClient.rest`.
 */
const detectFromCommit = (): Effect.Effect<ReadonlyArray<PreDetectedRelease>, never, GitHubClient> =>
	Effect.gen(function* () {
		const client = yield* GitHubClient;
		const { owner, repo } = yield* client.repo;

		const sha = process.env.GITHUB_SHA ?? "";
		if (!sha) return [];

		interface CommitData {
			parents?: Array<{ sha: string }>;
		}
		const commitData = yield* client
			.rest<CommitData>("repos.getCommit", (octokit) => {
				const ok = octokit as {
					rest: { repos: { getCommit: (p: Record<string, unknown>) => Promise<{ data: CommitData }> } };
				};
				return ok.rest.repos.getCommit({ owner, repo, ref: sha });
			})
			.pipe(Effect.catchAll(() => Effect.succeed({} as CommitData)));

		const parents = commitData.parents;
		if (!parents || parents.length === 0) return [];

		const baseSha = parents[0]?.sha ?? "";

		interface CompareData {
			files?: Array<{ filename: string; status: string }>;
		}
		const comparison = yield* client
			.rest<CompareData>("repos.compareCommits", (octokit) => {
				const ok = octokit as {
					rest: { repos: { compareCommits: (p: Record<string, unknown>) => Promise<{ data: CompareData }> } };
				};
				return ok.rest.repos.compareCommits({ owner, repo, base: baseSha, head: sha });
			})
			.pipe(Effect.catchAll(() => Effect.succeed({} as CompareData)));

		const modifiedPkgJsonFiles = (comparison.files ?? []).filter(
			(f) => f.filename.endsWith("package.json") && (f.status === "modified" || f.status === "changed"),
		);

		if (modifiedPkgJsonFiles.length === 0) return [];

		const releases: PreDetectedRelease[] = [];

		for (const file of modifiedPkgJsonFiles) {
			const fullPath = join(process.cwd(), file.filename);
			if (!existsSync(fullPath)) continue;

			let currentContent: { name?: string; version?: string };
			try {
				currentContent = JSON.parse(readFileSync(fullPath, "utf-8")) as { name?: string; version?: string };
			} catch {
				continue;
			}

			const newVersion = currentContent.version ?? "0.0.0";
			let oldVersion = "0.0.0";

			interface ContentData {
				content?: string;
			}
			const oldContent = yield* client
				.rest<ContentData>("repos.getContent", (octokit) => {
					const ok = octokit as {
						rest: { repos: { getContent: (p: Record<string, unknown>) => Promise<{ data: ContentData }> } };
					};
					return ok.rest.repos.getContent({ owner, repo, path: file.filename, ref: baseSha });
				})
				.pipe(Effect.catchAll(() => Effect.succeed({} as ContentData)));

			if (oldContent.content) {
				try {
					const decoded = Buffer.from(oldContent.content, "base64").toString("utf-8");
					const oldPkg = JSON.parse(decoded) as { version?: string };
					oldVersion = oldPkg.version ?? "0.0.0";
				} catch {
					// keep oldVersion
				}
			}

			if (oldVersion === newVersion) continue;

			const packageDir = dirname(file.filename);
			const pkgPath = packageDir === "." ? process.cwd() : join(process.cwd(), packageDir);

			releases.push({
				name: currentContent.name ?? packageDir,
				version: newVersion,
				path: pkgPath,
			});
		}

		return releases;
	}).pipe(Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<PreDetectedRelease>)));

// ─── Per-target publish ───────────────────────────────────────────────────────

/** Resolved target shape used internally (subset of the legacy ResolvedTarget). */
interface TargetSpec {
	readonly registry: string;
	readonly directory: string;
	readonly access: "public" | "restricted";
	readonly provenance: boolean;
}

/**
 * Publish a single package to a single target, returning a `TargetPublishResult`.
 *
 * Decision tree:
 * 1. `PackagePublish.pack(target.directory)` → content digest.
 * 2. `NpmRegistry.getVersions(packageName)` to determine if the package has
 *    ever been published:
 *    - `NpmRegistryError` (E404 / not found) → first-publish path:
 *      `PackagePublish.setupAuth` then `PackagePublish.publish`.
 *    - Versions list returned → existing package → `PackagePublish.publishIdempotent`
 *      (handles already-published-identical skip and content-mismatch error).
 * 3. On a `"published"` outcome with `provenance: true`:
 *    `Attest.provenance` + `Attest.sbom`.
 *
 * All errors are caught at the target level and turned into a failed
 * `TargetPublishResult` so the caller can accumulate without aborting.
 */
const publishOneTarget = (packageName: string, version: string, target: TargetSpec) => {
	const legacyTarget = {
		protocol: "npm" as const,
		registry: target.registry,
		directory: target.directory,
		access: target.access,
		provenance: target.provenance,
		tag: "latest" as const,
		tokenEnv: null,
	};

	return Effect.gen(function* () {
		const publishSvc = yield* PackagePublish;
		const registrySvc = yield* NpmRegistry;
		const attestSvc = yield* Attest;

		// Step 1: Pack to get digest.
		const packResult = yield* publishSvc.pack(target.directory);

		// Step 2: First-publish vs. existing-package decision.
		const versionsCheck = yield* registrySvc.getVersions(packageName).pipe(
			Effect.map((versions) => ({ exists: true as const, versions })),
			Effect.catchAll(() => Effect.succeed({ exists: false as const })),
		);

		let publishStatus: "published" | "skipped" = "published";
		let skipReason: "already-published-identical" | undefined;

		if (!versionsCheck.exists) {
			// First publish: set up auth and publish.
			const token = resolveToken(target.registry);
			if (token !== null) {
				yield* publishSvc
					.setupAuth(target.registry, token)
					.pipe(
						Effect.catchAll((e: PackagePublishError) =>
							Effect.logWarning(`setupAuth failed for ${target.registry}: ${e.message}`),
						),
					);
			}
			yield* publishSvc.publish(target.directory, {
				registry: target.registry,
				access: target.access,
				provenance: target.provenance,
			});
		} else {
			// Existing package: delegate to publishIdempotent for version/integrity check.
			const idempotentResult = yield* publishSvc.publishIdempotent({
				packageDir: target.directory,
				packageName,
				version,
				digest: packResult.digest,
				options: {
					registry: target.registry,
					access: target.access,
					provenance: target.provenance,
				},
			});

			publishStatus = idempotentResult.status;
			skipReason = idempotentResult.skipReason;
		}

		// Step 3: Attestation for freshly published packages.
		let attestationUrl: string | undefined;
		let sbomAttestationUrl: string | undefined;

		if (publishStatus === "published" && target.provenance) {
			// Provenance attestation (SLSA). The predicate is built inside the
			// live Attest layer from OIDC claims; in tests AttestTest ignores it.
			const provenanceRecord = yield* attestSvc
				.provenance({
					subjectName: `pkg:npm/${packageName}@${version}`,
					subjectSha256: packResult.digest.replace(/^sha256:/i, ""),
					predicate: {},
				})
				.pipe(
					Effect.catchAll((e: AttestError) =>
						Effect.gen(function* () {
							yield* Effect.logWarning(`Provenance attestation failed for ${packageName}@${version}: ${e.message}`);
							return null;
						}),
					),
				);

			if (provenanceRecord !== null) {
				attestationUrl = provenanceRecord.attestationUrl;
			}

			// SBOM attestation (CycloneDX).
			const sbomRecord = yield* attestSvc
				.sbom({
					rootName: packageName,
					rootVersion: version,
					dependencies: [],
					subjectSha256: packResult.digest.replace(/^sha256:/i, ""),
				})
				.pipe(
					Effect.catchAll((e) => {
						const msg = e instanceof Error ? e.message : String(e);
						return Effect.gen(function* () {
							yield* Effect.logWarning(`SBOM attestation failed for ${packageName}@${version}: ${msg}`);
							return null;
						});
					}),
				);

			if (sbomRecord !== null) {
				sbomAttestationUrl = sbomRecord.attestationUrl;
			}
		}

		return {
			target: legacyTarget,
			success: true,
			alreadyPublished: publishStatus === "skipped" ? true : undefined,
			alreadyPublishedReason: skipReason !== undefined ? ("identical" as const) : undefined,
			attestationUrl,
			sbomAttestationUrl,
			tarballDigest: packResult.digest,
		} satisfies TargetPublishResult;
	}).pipe(
		Effect.catchAll((e: unknown) =>
			Effect.succeed({
				target: legacyTarget,
				success: false,
				error: e instanceof Error ? e.message : String(e),
			} satisfies TargetPublishResult),
		),
	);
};

// ─── runPublish ───────────────────────────────────────────────────────────────

/**
 * Effect-based Phase-3 publish orchestrator.
 *
 * @remarks
 * Orchestrates package detection, target resolution, topological ordering, and
 * multi-registry publishing. Accumulates errors per package so one failure does
 * not abort the batch.
 *
 * The returned effect fails with {@link PublishError} only for fatal
 * infrastructure errors (e.g., workspace discovery or topological sort failure).
 * Per-package / per-target errors are captured in the returned
 * `PublishPackagesResult` (with `success: false`).
 *
 * @public
 */
export const runPublish = (args: PublishInputArgs) =>
	Effect.gen(function* () {
		const discovery = yield* WorkspaceDiscovery;
		const detector = yield* PublishabilityDetector;
		const sorter = yield* TopologicalSorter;

		// ── Step 1: Detect released packages ─────────────────────────────────

		yield* Effect.logInfo("runPublish: detecting released packages");

		let preDetected: ReadonlyArray<PreDetectedRelease>;

		if (args.preDetectedReleases !== undefined && args.preDetectedReleases.length > 0) {
			preDetected = args.preDetectedReleases;
			yield* Effect.logInfo(`runPublish: using ${preDetected.length} pre-detected release(s)`);
		} else if (args.mergedReleasePRNumber !== undefined) {
			yield* Effect.logInfo(`runPublish: detecting from PR #${args.mergedReleasePRNumber}`);
			preDetected = yield* detectFromPR(args.mergedReleasePRNumber);
			if (preDetected.length === 0) {
				yield* Effect.logInfo("runPublish: PR detection returned nothing, falling back to commit diff");
				preDetected = yield* detectFromCommit();
			}
		} else {
			yield* Effect.logInfo("runPublish: detecting from commit diff");
			preDetected = yield* detectFromCommit();
		}

		if (preDetected.length === 0) {
			yield* Effect.logInfo("runPublish: no packages to publish");
			return {
				success: true,
				packages: [],
				totalPackages: 0,
				successfulPackages: 0,
				totalTargets: 0,
				successfulTargets: 0,
			} satisfies PublishPackagesResult;
		}

		// ── Step 2: Resolve publish targets ──────────────────────────────────

		yield* Effect.logInfo("runPublish: resolving publish targets");

		const workspaceRoot = process.cwd();

		interface PkgEntry {
			readonly version: string;
			readonly targets: ReadonlyArray<{
				registry: string;
				directory: string;
				access: "public" | "restricted";
				provenance: boolean;
			}>;
		}
		const targetsByPackage = new Map<string, PkgEntry>();

		for (const detected of preDetected) {
			// Resolve the WorkspacePackage from discovery, synthesising a minimal
			// one if the package is not in the workspace (e.g. deleted monorepo member).
			const wsPkg = yield* discovery.getPackage(detected.name).pipe(
				Effect.catchAll(() =>
					Effect.succeed(
						new WorkspacePackage({
							name: detected.name,
							version: detected.version,
							path: detected.path,
							packageJsonPath: join(detected.path, "package.json"),
							relativePath: "",
						}),
					),
				),
			);

			const publishTargets = yield* detector.detect(wsPkg, workspaceRoot).pipe(
				Effect.catchAll((e: unknown) =>
					Effect.gen(function* () {
						yield* Effect.logWarning(`Failed to resolve targets for ${detected.name}: ${String(e)}`);
						return [] as ReadonlyArray<{
							registry: string;
							directory: string;
							access: "public" | "restricted";
							provenance: boolean;
						}>;
					}),
				),
			);

			targetsByPackage.set(detected.name, {
				version: detected.version,
				targets: publishTargets.map((t) => ({
					registry: t.registry,
					directory: t.directory,
					access: t.access,
					provenance: t.provenance ?? false,
				})),
			});

			yield* Effect.logInfo(`runPublish: ${detected.name}@${detected.version}: ${publishTargets.length} target(s)`);
		}

		// ── Step 3: Topological ordering ──────────────────────────────────────

		yield* Effect.logInfo("runPublish: sorting packages topologically");

		const sortedNames = yield* sorter.sortSubset(preDetected.map((r) => r.name)).pipe(
			Effect.catchAll((e: unknown) =>
				Effect.gen(function* () {
					yield* Effect.logWarning(`Topological sort failed, using insertion order: ${String(e)}`);
					return preDetected.map((r) => r.name) as ReadonlyArray<string>;
				}),
			),
		);

		// ── Step 4: Publish each package (accumulate errors) ──────────────────

		const totalTargets = [...targetsByPackage.values()].reduce((sum, p) => sum + p.targets.length, 0);
		yield* Effect.logInfo(`runPublish: publishing ${sortedNames.length} package(s), ${totalTargets} total target(s)`);

		const accumulateResult = yield* ErrorAccumulator.forEachAccumulate(sortedNames, (name) =>
			Effect.gen(function* () {
				const pkgEntry = targetsByPackage.get(name);
				if (pkgEntry === undefined) {
					yield* Effect.logWarning(`runPublish: no target info for ${name}, skipping`);
					return null;
				}

				const { version, targets } = pkgEntry;
				yield* Effect.logInfo(`runPublish: publishing ${name}@${version}`);

				if (targets.length === 0) {
					yield* Effect.logInfo(`runPublish: ${name} has no publish targets (version-only)`);
					return {
						name,
						version,
						targets: [],
					} satisfies PackagePublishResult;
				}

				const targetResults: TargetPublishResult[] = [];

				for (const target of targets) {
					const result = yield* publishOneTarget(name, version, target);
					targetResults.push(result);
				}

				return {
					name,
					version,
					targets: targetResults,
				} satisfies PackagePublishResult;
			}),
		);

		// ── Step 5: Assemble PublishPackagesResult ─────────────────────────────

		const packages: PackagePublishResult[] = [];
		let successfulPackages = 0;
		let successfulTargets = 0;

		for (const result of accumulateResult.successes) {
			if (result === null) continue;
			packages.push(result);
			const allTargetsOk = result.targets.length === 0 || result.targets.every((t) => t.success);
			if (allTargetsOk) {
				successfulPackages++;
			}
			successfulTargets += result.targets.filter((t) => t.success).length;
		}

		// Packages that errored inside forEachAccumulate appear in failures.
		for (const { item: name, error: rawError } of accumulateResult.failures) {
			const error: unknown = rawError;
			const version = targetsByPackage.get(name)?.version ?? "unknown";
			packages.push({
				name,
				version,
				targets: [
					{
						target: {
							protocol: "npm" as const,
							registry: null,
							directory: "",
							access: "restricted" as const,
							provenance: false,
							tag: "latest" as const,
							tokenEnv: null,
						},
						success: false,
						error: error instanceof Error ? error.message : String(error),
					},
				],
			});
		}

		const allSuccess = successfulPackages === targetsByPackage.size;

		return {
			success: allSuccess,
			packages,
			totalPackages: targetsByPackage.size,
			successfulPackages,
			totalTargets,
			successfulTargets,
		} satisfies PublishPackagesResult;
	});
