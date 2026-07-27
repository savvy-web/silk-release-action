// Phase-3 publish orchestrator.
//
// Detects released packages from a merged PR or commit diff, resolves publish
// targets via `PublishabilityDetector`, orders them topologically, builds the
// workspace, and publishes each package to each configured registry —
// accumulating errors per package so one failure does not abort the batch.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import { Run } from "@effected/commands";
import type { GitHubError, Repo } from "@effected/github";
import { Attestation, GitHubCommit, GitHubContent, PullRequest } from "@effected/github";
import type { OidcTokenIssuer } from "@effected/github-actions";
import { ActionEnvironment, ActionInput, ActionLogger, ActionOutputs, ActionState } from "@effected/github-actions";
import { NpmExecutor, NpmRegistry, PackagePublish, classifyRegistry } from "@effected/npm";
import type { SigstoreSigner } from "@effected/sbom";
import { CYCLONEDX_BOM_PREDICATE, Sbom, SbomMetadataSource, SlsaProvenance } from "@effected/sbom";
import { PublishabilityDetector, WorkspaceDiscovery, WorkspacePackage } from "@effected/workspaces";
import type { FileSystem } from "effect";
import { Config, Effect, Option, Redacted } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import { ChildProcess } from "effect/unstable/process";

import { GithubPackagesTokenState, STATE_KEYS } from "../state.js";
import { getGroupId } from "../utils/group-id.js";
import { registryHost, registryShortLabel } from "../utils/registry-label.js";
import { sortReleasesTopologically } from "../utils/sort-releases-topologically.js";
import { attestSubject, buildProvenancePredicate } from "./attest-helpers.js";
import { ChangesetConfig } from "./changeset-config.js";
import { humanizeSize } from "./report.js";
import { isTargetPrivate, pickToken } from "./resolve-targets.js";
import type { PackagePublishResult, PublishPackagesResult, TargetPublishResult } from "./types.js";

// ─── Public interfaces ────────────────────────────────────────────────────────

/**
 * Input arguments for the Phase-3 publish flow ({@link detectReleases},
 * {@link runBuildAndSbom}, {@link runPublishTargets}).
 *
 * @public
 */
export interface PublishInputArgs {
	readonly packageManager: string;
	readonly targetBranch: string;
	readonly dryRun: boolean;
	readonly mergedReleasePRNumber: number | undefined;
}

// ─── Internal types ───────────────────────────────────────────────────────────

/**
 * A detected release (name + version + source path).
 *
 * @public
 */
export interface DetectedRelease {
	readonly name: string;
	readonly version: string;
	readonly path: string;
}

/** Resolved target shape used internally (subset of the legacy ResolvedTarget). */
interface TargetSpec {
	readonly registry: string;
	readonly directory: string;
	readonly access: "public" | "restricted";
	readonly provenance: boolean;
}

/**
 * Which `npm` every pack and publish in this phase runs through.
 *
 * @remarks
 * **Pinned deliberately, and the pin is load-bearing.** OIDC trusted publishing
 * needs npm ≥ 11.5.1 and GitHub-hosted runners ship 10.x, so the runner's
 * ambient npm cannot publish this way at all; npm 12's publish is separately
 * broken (it ships without sigstore). `NpmExecutor.dlx` resolves through the
 * project's `LocalExec` launcher — `pnpm dlx npm@11` here — and **fails typed**
 * when no launcher is provided rather than degrading to the ambient npm, which
 * is the whole point: a silent downgrade would reintroduce the OIDC failure
 * invisibly.
 *
 * This replaces the predecessor's `packageManager` option, which was repeated
 * on five method signatures to express this one thing.
 */
const NPM_EXECUTOR = NpmExecutor.dlx("npm@11");

/**
 * The `.npmrc` `setupAuth` writes to and `npm publish` reads from.
 *
 * @remarks
 * The kit made this caller-supplied on purpose: resolving `~` needs
 * `node:os`, which a boundary package should not import. So the resolution
 * lives here, at the edge, and reproduces the predecessor's rule exactly —
 * `NPM_CONFIG_USERCONFIG` wins when set, because npm itself honours it and a
 * CI image that sets it would otherwise have the token written to a file npm
 * never reads.
 *
 * @internal
 */
export const userNpmrcPath = (env: Readonly<Record<string, string | undefined>> = process.env): string => {
	const configured = env.NPM_CONFIG_USERCONFIG;
	return configured !== undefined && configured !== "" ? configured : join(homedir(), ".npmrc");
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Infer the semver bump type from old/new version strings.
 *
 * @param oldVersion - The previous version string (e.g. `1.2.3`).
 * @param newVersion - The new version string (e.g. `1.3.0`).
 * @returns The bump type, or `"unknown"` when either version is not a
 *   three-part semver string or carries a non-numeric part (e.g. a
 *   pre-release suffix like `1.2.0-alpha.1`).
 *
 * @public
 */
export function inferBumpType(oldVersion: string, newVersion: string): "major" | "minor" | "patch" | "unknown" {
	const oldParts = oldVersion.split(".").map(Number);
	const newParts = newVersion.split(".").map(Number);
	if (oldParts.length < 3 || newParts.length < 3 || [...oldParts, ...newParts].some(Number.isNaN)) {
		return "unknown";
	}
	if ((newParts[0] ?? 0) > (oldParts[0] ?? 0)) return "major";
	if (newParts[0] === oldParts[0] && (newParts[1] ?? 0) > (oldParts[1] ?? 0)) return "minor";
	return "patch";
}

/**
 * Read a package's version out of a `package.json` on disk.
 *
 * Returns `undefined` when the file is absent or undecodable — both mean
 * "nothing to compare", which the callers treat as "not a release".
 */
const readLocalManifest = (path: string): { name?: string; version?: string } | undefined => {
	if (!existsSync(path)) return undefined;
	try {
		return JSON.parse(readFileSync(path, "utf-8")) as { name?: string; version?: string };
	} catch {
		return undefined;
	}
};

/** The version recorded in a `package.json` at a git ref, or `"0.0.0"`. */
const versionAtRef = (
	content: GitHubContent["Service"],
	path: string,
	ref: string,
): Effect.Effect<string, never, Repo> => {
	if (ref === "") return Effect.succeed("0.0.0");
	return content.getFileOption(path, { ref }).pipe(
		Effect.map((maybe) =>
			Option.match(maybe, {
				onNone: () => "0.0.0",
				onSome: (text) => {
					try {
						return (JSON.parse(text) as { version?: string }).version ?? "0.0.0";
					} catch {
						return "0.0.0";
					}
				},
			}),
		),
		Effect.catch(() => Effect.succeed("0.0.0")),
	);
};

/** Turn a changed `package.json` path plus its base version into a release, if it is one. */
const releaseFor = (filename: string, oldVersion: string): DetectedRelease | undefined => {
	const fullPath = join(process.cwd(), filename);
	const current = readLocalManifest(fullPath);
	if (current === undefined) return undefined;

	const newVersion = current.version ?? "0.0.0";
	if (oldVersion === newVersion) return undefined;

	const packageDir = dirname(filename);
	return {
		name: current.name ?? packageDir,
		version: newVersion,
		path: packageDir === "." ? process.cwd() : join(process.cwd(), packageDir),
	};
};

// ─── Detection helpers ────────────────────────────────────────────────────────

/**
 * Detect released packages from the merged PR's file diff.
 *
 * @remarks
 * Entirely on the resource surface. Two raw `GitHubClient` routes used to live
 * here because `PullRequest.listFiles` projected every file down to its path
 * (dropping `status`) and `PullRequestInfo` carried `base` as a branch **name**
 * rather than the base commit sha. Both are now first-class:
 * `listFiles` answers a full `CommitFile`, and `PullRequestInfo.baseSha` is a
 * required field.
 */
const detectFromPR = (
	prNumber: number,
): Effect.Effect<ReadonlyArray<DetectedRelease>, never, GitHubContent | PullRequest | Repo> =>
	Effect.gen(function* () {
		const content = yield* GitHubContent;
		const pullRequests = yield* PullRequest;

		const files = yield* pullRequests.listFiles(prNumber).pipe(Effect.catch(() => Effect.succeed([])));

		// Filter to package.json files that were modified
		const modifiedPkgJsonFiles = files.filter(
			(f) => f.path.endsWith("package.json") && (f.status === "modified" || f.status === "changed"),
		);

		// Also include the root package.json if modified
		const rootPkgJson = files.find((f) => f.path === "package.json" && f.status === "modified");
		const allPkgJsonFiles = rootPkgJson
			? [rootPkgJson, ...modifiedPkgJsonFiles.filter((f) => f.path !== "package.json")]
			: modifiedPkgJsonFiles;

		if (allPkgJsonFiles.length === 0) return [];

		// `baseSha` — the commit the pull request branches from — read off the
		// record rather than a route. An unreadable PR degrades to `""`, which
		// `versionAtRef` treats as "no base version", exactly as before.
		const baseSha = yield* pullRequests.get(prNumber).pipe(
			Effect.map((pr) => pr.baseSha),
			Effect.catch(() => Effect.succeed("")),
		);
		const releases: DetectedRelease[] = [];

		for (const file of allPkgJsonFiles) {
			const oldVersion = yield* versionAtRef(content, file.path, baseSha);
			const release = releaseFor(file.path, oldVersion);
			if (release === undefined) continue;
			yield* Effect.logDebug(
				`  ${release.name}: ${oldVersion} → ${release.version} (${inferBumpType(oldVersion, release.version)})`,
			);
			releases.push(release);
		}

		return releases;
	}).pipe(Effect.catch(() => Effect.succeed([] as ReadonlyArray<DetectedRelease>)));

/**
 * Detect released packages by comparing HEAD with its first parent.
 *
 * @remarks
 * The changed-file list comes from `GitHubCommit.changedFiles`, which
 * paginates **by file** — the compare endpoint paginates by commit and is
 * therefore permanently capped at 300 files for a one-commit comparison, which
 * would silently drop packages whose `package.json` sorts past #300. That
 * constraint is recorded in the kit's own `compare` docstring.
 *
 * The first parent comes off `CommitSummary.parents`, a required field. It used
 * to need a raw route; the kit's own remark on the field is that "which
 * commit(s) did this come from" never needs one.
 */
const detectFromCommit = (): Effect.Effect<
	ReadonlyArray<DetectedRelease>,
	never,
	ActionEnvironment | GitHubCommit | GitHubContent | Repo
> =>
	Effect.gen(function* () {
		const commits = yield* GitHubCommit;
		const content = yield* GitHubContent;
		const environment = yield* ActionEnvironment;

		const sha = Option.getOrElse(yield* environment.getOptional("GITHUB_SHA"), () => "");
		if (sha === "") return [];

		// A root commit has no parents and an unreadable commit degrades to none;
		// both mean "nothing to diff against", which is the existing early return.
		const baseSha = yield* commits.get(sha).pipe(
			Effect.map((commit) => commit.parents[0] ?? ""),
			Effect.catch(() => Effect.succeed("")),
		);
		if (baseSha === "") return [];

		const changedFiles = yield* commits.changedFiles(sha).pipe(Effect.catch(() => Effect.succeed([])));

		const modifiedPkgJsonFiles = changedFiles.filter(
			(f) => f.path.endsWith("package.json") && (f.status === "modified" || f.status === "changed"),
		);

		if (modifiedPkgJsonFiles.length === 0) return [];

		const releases: DetectedRelease[] = [];

		for (const file of modifiedPkgJsonFiles) {
			const oldVersion = yield* versionAtRef(content, file.path, baseSha);
			const release = releaseFor(file.path, oldVersion);
			if (release !== undefined) releases.push(release);
		}

		return releases;
	}).pipe(Effect.catch(() => Effect.succeed([] as ReadonlyArray<DetectedRelease>)));

// ─── Per-target publish ───────────────────────────────────────────────────────

/** Build the legacy `ResolvedTarget` shape we carry on every `TargetPublishResult`. */
const toLegacyTarget = (target: TargetSpec, protocol: "npm" | "jsr" = "npm") => ({
	protocol,
	registry: target.registry,
	directory: target.directory,
	access: target.access,
	provenance: target.provenance,
	tag: "latest" as const,
	tokenEnv: null,
});

/** Outcome of running attestations for a freshly-published target. */
interface AttestationsOutcome {
	readonly attestationUrl: string | undefined;
	readonly sbomAttestationUrl: string | undefined;
	/**
	 * `true` when the provenance attestation already existed for the
	 * tarball's `sha256` and the orchestrator reused the URL instead
	 * of writing a fresh one. `false` when a new attestation was
	 * written this run.
	 */
	readonly provenanceRecovered: boolean;
	/** Same as {@link provenanceRecovered}, but for the SBOM attestation. */
	readonly sbomRecovered: boolean;
}

/** Every service the attestation and publish helpers resolve. */
type PublishServices =
	| ActionEnvironment
	| ActionLogger
	| ActionOutputs
	| Attestation
	| NpmRegistry
	| OidcTokenIssuer
	| PackagePublish
	| Repo
	| SigstoreSigner;

/**
 * Read the on-disk SBOM document written by the Build & SBOM step.
 *
 * @remarks
 * Returns `null` when the file does not exist or fails to parse — the
 * SBOM-attestation path then falls back to a minimal generated BOM, so a
 * malformed file never fails the publish run.
 */
const readSbomDocument = (sbomPath: string | null): Record<string, unknown> | null => {
	if (sbomPath === null) return null;
	try {
		if (!existsSync(sbomPath)) return null;
		const text = readFileSync(sbomPath, "utf-8");
		const parsed: unknown = JSON.parse(text);
		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
		return parsed as Record<string, unknown>;
	} catch {
		return null;
	}
};

/**
 * Run provenance + SBOM attestations ONCE for the build directory's tarball.
 *
 * @remarks
 * The same attestation URLs apply to every target in the group that ended
 * successfully (published or skipped-identical). Prior to this contract the
 * orchestrator fired attestation per-target — that produced N provenance +
 * N SBOM records for a package with N registry targets even though the
 * tarball is byte-identical across them. Hoisting the call out of the
 * per-target loop collapses the count to one of each per build directory.
 *
 * Fires on BOTH the `published` and `skipped-identical` branches. On a
 * recovery skip the original publish from a prior run may have failed
 * BEFORE the attestation step, leaving the package on the registry with no
 * GitHub artifact attestation. Re-running attestation with the same subject
 * digest is idempotent at the registry — duplicates either return the
 * existing URL or no-op cleanly — so it is safe to run on every successful
 * publish state and dangerous to skip.
 *
 * `subjectSha256` MUST be the sha256-hex of the tarball. `PackedTarball` also
 * carries `integrity`, which is npm's `sha512-<base64>`; the two are a
 * different algorithm **and** a different encoding, and the GitHub attestation
 * API rejects the latter. The kit's own docstring warns that comparing them
 * "silently fails".
 *
 * `provenance` is derived by the caller from the group: any target in the
 * group with `provenance: true` enables attestation for the whole group.
 */
const runAttestationsForBuild = (
	packageName: string,
	version: string,
	provenance: boolean,
	subjectSha256: string,
	sbomPath: string | null,
): Effect.Effect<AttestationsOutcome, never, PublishServices> =>
	Effect.gen(function* () {
		if (!provenance) {
			return {
				attestationUrl: undefined,
				sbomAttestationUrl: undefined,
				provenanceRecovered: false,
				sbomRecovered: false,
			} satisfies AttestationsOutcome;
		}

		const attestation = yield* Attestation;
		const subjectName = `pkg:npm/${packageName}@${version}`;

		/** 404 and 422 both mean "none" inside `listForSubject`; a read failure means "try a fresh write". */
		const existingFor = (predicateType: string) =>
			attestation.listForSubject(subjectSha256, { predicateType }).pipe(
				Effect.catch((e: GitHubError) =>
					Effect.gen(function* () {
						yield* Effect.logDebug(
							`[attest] ${predicateType}: listForSubject failed for ${subjectSha256}, will attempt fresh write: ${e.message}`,
						);
						return [];
					}),
				),
			);

		// ── Provenance: skip-on-presence ───────────────────────────────────
		let attestationUrl: string | undefined;
		let provenanceRecovered = false;

		const existingProvenance = yield* existingFor(SlsaProvenance.predicateType);

		if (existingProvenance.length > 0) {
			const existing = existingProvenance[0];
			if (existing !== undefined) {
				yield* Effect.logDebug(
					`[attest] provenance: reusing existing attestation for ${subjectSha256} → ${existing.url}`,
				);
				attestationUrl = existing.url;
				provenanceRecovered = true;
			}
		} else {
			const predicate = yield* buildProvenancePredicate();
			if (predicate !== null) {
				yield* Effect.logDebug(`[attest] provenance: writing new attestation for ${subjectSha256}`);
				attestationUrl = yield* attestSubject({
					name: subjectName,
					sha256: subjectSha256,
					predicateType: SlsaProvenance.predicateType,
					predicate,
				}).pipe(
					Effect.catch((e) =>
						Effect.gen(function* () {
							yield* Effect.logWarning(`Provenance attestation failed for ${packageName}@${version}: ${e.message}`);
							return undefined;
						}),
					),
				);
			} else {
				yield* Effect.logWarning(
					`Skipping provenance attestation for ${packageName}@${version}: could not obtain OIDC claims`,
				);
			}
		}

		// ── SBOM: skip-on-presence + real BOM document ────────────────────
		let sbomAttestationUrl: string | undefined;
		let sbomRecovered = false;

		const existingSbom = yield* existingFor(CYCLONEDX_BOM_PREDICATE);

		if (existingSbom.length > 0) {
			const existing = existingSbom[0];
			if (existing !== undefined) {
				yield* Effect.logDebug(`[attest] SBOM: reusing existing attestation for ${subjectSha256} → ${existing.url}`);
				sbomAttestationUrl = existing.url;
				sbomRecovered = true;
			}
		} else {
			// Prefer the Build & SBOM document on disk — it carries supplier
			// metadata, components and licences. The generated fallback is a
			// component-less BOM naming only the package itself, which is what the
			// predecessor's `dependencies: []` branch produced.
			const onDisk = readSbomDocument(sbomPath);
			if (onDisk === null && sbomPath !== null) {
				yield* Effect.logDebug(
					`[attest] SBOM: failed to read ${sbomPath} for ${packageName}@${version}; falling back to a minimal BOM`,
				);
			}
			const predicate =
				onDisk ??
				Sbom.generate({
					root: SbomMetadataSource.componentFor({ name: packageName, version }),
					components: [],
				});

			yield* Effect.logDebug(`[attest] SBOM: writing new attestation for ${subjectSha256}`);
			sbomAttestationUrl = yield* attestSubject({
				name: subjectName,
				sha256: subjectSha256,
				predicateType: CYCLONEDX_BOM_PREDICATE,
				predicate,
			}).pipe(
				Effect.catch((e) =>
					Effect.gen(function* () {
						yield* Effect.logWarning(`SBOM attestation failed for ${packageName}@${version}: ${e.message}`);
						return undefined;
					}),
				),
			);
		}

		return {
			attestationUrl,
			sbomAttestationUrl,
			provenanceRecovered,
			sbomRecovered,
		} satisfies AttestationsOutcome;
	});

/**
 * Publish a single package to every target in one build-directory group —
 * the self-recovering, pack-once flow.
 *
 * Decision tree per group:
 *  1. **Pack once.** `PackagePublish.pack(directory)` writes the tarball and
 *     reports both digests.
 *  2. **Per-target probe + decision.** For each target, read the published
 *     version off **the target's own registry** and branch:
 *     - absent — set up auth (when a token is available) and `publishTarball`
 *       the bytes from step 1. Record `status: "published"`.
 *     - present with the same integrity — already there with the same content.
 *       Record `status: "skipped"` with `skipReason:
 *       "already-published-identical"` and the `recovery` digest pair.
 *     - present and different, **or either integrity missing** — the version is
 *       occupied and identity cannot be proven. Record `status: "failed"`.
 *  3. **Attest once per build.** Provenance + SBOM attestation runs ONCE for
 *     the build directory's tarball after every target has been probed.
 *
 * JSR targets are skipped with a warning — they require a separate publish
 * path that is outside this orchestrator's scope.
 */
const publishDirectoryGroup = (
	packageName: string,
	version: string,
	directory: string,
	targetsInGroup: ReadonlyArray<TargetSpec>,
	npmToken: string | null,
	ghPkgsToken: string | null,
	npmrcPath: string,
	sbomPath: string | null,
): Effect.Effect<ReadonlyArray<TargetPublishResult>, never, PublishServices> =>
	Effect.gen(function* () {
		const publishSvc = yield* PackagePublish;
		const registrySvc = yield* NpmRegistry;

		// JSR targets are not handled here — split them off so the npm flow
		// is uncluttered. Each JSR target records a skipped result.
		const jsrTargets: TargetSpec[] = [];
		const npmTargets: TargetSpec[] = [];
		for (const t of targetsInGroup) {
			(classifyRegistry(t.registry) === "jsr" ? jsrTargets : npmTargets).push(t);
		}

		const results: TargetPublishResult[] = [];

		for (const t of jsrTargets) {
			yield* Effect.logWarning(
				`runPublishTargets: skipping JSR target for ${packageName}@${version} — JSR publishing is not yet supported in this orchestrator`,
			);
			results.push({
				target: toLegacyTarget(t, "jsr"),
				success: true,
				status: "skipped",
			});
		}

		if (npmTargets.length === 0) {
			yield* Effect.logInfo("  ✅ 0 published, 0 skipped-identical, 0 mismatch (JSR-only)");
			return results;
		}

		// ── Pack stage — once per directory ───────────────────────────────────
		yield* Effect.logDebug(`[publish] ${packageName}: packing ${directory}`);
		const packOutcome = yield* publishSvc.pack(directory, { executor: NPM_EXECUTOR }).pipe(
			Effect.map((result) => ({ ok: true as const, result })),
			Effect.catch((e) => Effect.succeed({ ok: false as const, error: e.message })),
		);

		if (!packOutcome.ok) {
			// Pack failed — every target in the group is recorded failed; no
			// publish attempts are made.
			yield* Effect.logError(`[publish] ${packageName}: pack ${directory} failed — ${packOutcome.error}`);
			for (const t of npmTargets) {
				results.push({
					target: toLegacyTarget(t),
					success: false,
					status: "failed",
					error: packOutcome.error,
				});
			}
			yield* Effect.logWarning(`  ❌ pack failed — ${npmTargets.length} target(s) marked failed`);
			return results;
		}

		const packResult = packOutcome.result;
		const localIntegrity = packResult.integrity;
		yield* Effect.logInfo(
			`  📦 pack: ${packResult.packedSize !== undefined ? humanizeSize(packResult.packedSize) : "sized"} · ${
				packResult.fileCount ?? "?"
			} files · ${packResult.sha256Hex.slice(0, 32)}…`,
		);

		// ── Per-target decision stage ─────────────────────────────────────────
		let publishedCount = 0;
		let skippedIdenticalCount = 0;
		let mismatchCount = 0;
		let failedCount = 0;

		const digestFields = {
			tarballPath: packResult.tarballPath,
			tarballDigest: `sha256:${packResult.sha256Hex}`,
			...(packResult.packedSize !== undefined ? { packedSize: packResult.packedSize } : {}),
			...(packResult.unpackedSize !== undefined ? { unpackedSize: packResult.unpackedSize } : {}),
			...(packResult.fileCount !== undefined ? { fileCount: packResult.fileCount } : {}),
		};

		for (const t of npmTargets) {
			const label = registryShortLabel(t.registry);
			yield* Effect.logDebug(`[publish] ${packageName} ${directory} → ${t.registry}`);

			// Auth is set up before the probe, unchanged from the predecessor.
			// The reason has changed: the probe is now an HTTP read that takes its
			// own token, so it no longer needs an npmrc. The ordering is kept
			// anyway because reordering the authentication sequence of a publish
			// pipeline buys tidiness and risks a failure mode discovered in
			// production. Whether the setup can move after the probe is on the
			// post-migration list.
			const token = pickToken(t.registry, npmToken, ghPkgsToken);

			// Name the missing credential instead of letting it surface as a 403.
			//
			// GitHub Packages needs the workflow's own `secrets.GITHUB_TOKEN`, passed
			// as the `github-token` input.
			//
			// The App installation token is **not** a substitute and never can be:
			// GitHub App tokens are not supported for accessing GitHub Packages,
			// the one exception being the default GitHub Actions token, which is a
			// special kind of App token. Permissions are irrelevant — on
			// `savvy-web/systems` run 30228332922 the same token that resolved the
			// App identity and revoked itself against `api.github.com` was rejected
			// 403 by `npm.pkg.github.com` while holding `packages:write`.
			//
			// Without this, the symptom is four identical "integrity probe failed —
			// status 403" lines that read like a permissions problem on the packages
			// rather than a missing input.
			if (token === null && classifyRegistry(t.registry) === "github-packages") {
				const reason =
					"no github-token input — GitHub Packages requires the workflow's secrets.GITHUB_TOKEN. " +
					"GitHub App tokens cannot access GitHub Packages at all, so the App installation token " +
					"this action provisions is not a fallback";
				yield* Effect.logError(`[publish] ${t.registry}: cannot publish ${packResult.name} — ${reason}`);
				yield* Effect.logWarning(`  ⬆ ${label} · no-token`);
				results.push({
					target: toLegacyTarget(t),
					success: false,
					status: "failed",
					error: reason,
					...digestFields,
				});
				failedCount++;
				continue;
			}

			const redactedToken = token === null ? null : Redacted.make(token);
			if (redactedToken !== null) {
				yield* publishSvc
					.setupAuth({ registry: t.registry, token: redactedToken, npmrcPath })
					.pipe(Effect.catch((e) => Effect.logWarning(`setupAuth failed for ${t.registry}: ${e.message}`)));
			}

			const probe = yield* registrySvc
				.version(packResult.name, packResult.version, {
					registry: t.registry,
					...(redactedToken !== null ? { token: redactedToken } : {}),
				})
				.pipe(
					Effect.map((value) => ({ ok: true as const, value })),
					Effect.catch((e) => Effect.succeed({ ok: false as const, error: e.message })),
				);

			if (!probe.ok) {
				yield* Effect.logError(
					`[publish] ${t.registry}: integrity probe for ${packResult.name}@${packResult.version} failed — ${probe.error}`,
				);
				yield* Effect.logWarning(`  ⬆ ${label} · probe-failed`);
				results.push({
					target: toLegacyTarget(t),
					success: false,
					status: "failed",
					error: probe.error,
					...digestFields,
				});
				failedCount += 1;
				continue;
			}

			if (Option.isNone(probe.value)) {
				// Not on registry → publish the pre-packed tarball.
				yield* Effect.logDebug(
					`[publish] ${t.registry}: ${packResult.name}@${packResult.version} not on registry; publishing tarball`,
				);

				// GitHub Packages never supports npm's tokenless OIDC trusted publishing —
				// npm 11.5+ still attempts the `/-/npm/v1/oidc/token/exchange` POST
				// whenever the Actions OIDC env is present (even without --provenance) and
				// 404s, ignoring the configured _authToken. Publish GitHub Packages with
				// token auth (OIDC env stripped) from the first attempt.
				const isGhPkgs = classifyRegistry(t.registry) === "github-packages";
				let publishOutcome = yield* publishSvc
					.publishTarball(packResult.tarballPath, {
						registry: t.registry,
						access: t.access,
						provenance: t.provenance,
						tokenAuth: isGhPkgs,
						executor: NPM_EXECUTOR,
					})
					.pipe(
						Effect.map((r) => ({ ok: true as const, provenanceUrl: r.provenanceUrl })),
						Effect.catch((e) => Effect.succeed({ ok: false as const, error: e.message })),
					);

				// Token-auth fallback for the npm registry. Trusted publishing (the OIDC
				// path npm auto-takes) cannot bootstrap a package that has no trusted
				// publisher configured yet — the exchange 404s ("package not found"). When
				// it fails and a token is available, retry once with classic token auth
				// (OIDC env stripped). Once the package exists and trusted publishing is
				// configured, the first attempt succeeds and this retry never fires.
				if (!publishOutcome.ok && !isGhPkgs && redactedToken !== null) {
					yield* Effect.logWarning(
						`[publish] ${t.registry}: trusted-publishing publish failed for ${packResult.name}@${packResult.version} (${publishOutcome.error}); retrying with token auth`,
					);
					publishOutcome = yield* publishSvc
						.publishTarball(packResult.tarballPath, {
							registry: t.registry,
							access: t.access,
							provenance: false,
							tokenAuth: true,
							executor: NPM_EXECUTOR,
						})
						.pipe(
							Effect.map((r) => ({ ok: true as const, provenanceUrl: r.provenanceUrl })),
							Effect.catch((e) => Effect.succeed({ ok: false as const, error: e.message })),
						);
				}

				if (!publishOutcome.ok) {
					yield* Effect.logError(
						`[publish] ${t.registry}: publishTarball failed for ${packResult.name}@${packResult.version} — ${publishOutcome.error}`,
					);
					yield* Effect.logWarning(`  ⬆ ${label} · publish-failed`);
					results.push({
						target: toLegacyTarget(t),
						success: false,
						status: "failed",
						error: publishOutcome.error,
						...digestFields,
					});
					failedCount += 1;
					continue;
				}

				yield* Effect.logInfo(`  ⬆ ${label} · published · ${registryHost(t.registry)}`);
				results.push({
					target: toLegacyTarget(t),
					success: true,
					status: "published",
					...digestFields,
					// A plain optional field. It was briefly an `Option`, where a
					// `!== undefined` check would have been ALWAYS TRUE and stamped the
					// Option object into a `string` slot; that shape is gone, so the
					// straightforward check is the correct one again.
					...(publishOutcome.provenanceUrl !== undefined ? { npmProvenanceUrl: publishOutcome.provenanceUrl } : {}),
				});
				publishedCount += 1;
				continue;
			}

			const remoteIntegrity = probe.value.value.integrity;
			if (localIntegrity !== undefined && remoteIntegrity !== undefined && remoteIntegrity === localIntegrity) {
				// Recovery skip — already on registry with identical bytes.
				yield* Effect.logDebug(
					`[publish] ${t.registry}: ${packResult.name}@${packResult.version} already published with identical integrity (digest=${remoteIntegrity}); recovery skip`,
				);
				yield* Effect.logInfo(`  ⬆ ${label} · skipped-identical (recovery)`);
				results.push({
					target: toLegacyTarget(t),
					success: true,
					status: "skipped",
					skipReason: "already-published-identical",
					alreadyPublished: true,
					alreadyPublishedReason: "identical",
					recovery: { localDigest: localIntegrity, remoteDigest: remoteIntegrity },
					...digestFields,
				});
				skippedIdenticalCount += 1;
				continue;
			}

			// The version is occupied and identity cannot be established — either
			// the digests differ, or one side did not report one. Both are fatal for
			// this target: publishing over it would fail, and calling it "identical"
			// without proof would be a lie. Naming which side is missing is what
			// makes the log actionable.
			const localLabel = localIntegrity ?? "<not reported by npm pack>";
			const remoteLabel = remoteIntegrity ?? "<not reported by the registry>";
			yield* Effect.logError(
				`[publish] ${t.registry}: integrity MISMATCH for ${packResult.name}@${packResult.version} (local=${localLabel}, remote=${remoteLabel}); fatal`,
			);
			yield* Effect.logWarning(`  ⬆ ${label} · failed-mismatch`);
			results.push({
				target: toLegacyTarget(t),
				success: false,
				status: "failed",
				error: `integrity mismatch — local ${localLabel} ≠ remote ${remoteLabel}`,
				alreadyPublished: true,
				alreadyPublishedReason: "different",
				recovery: { localDigest: localLabel, remoteDigest: remoteLabel },
				...digestFields,
			});
			mismatchCount += 1;
		}

		// ── One attestation per build directory, shared across successful targets.
		//
		// The tarball is byte-identical for every target in this group, so a
		// single provenance + SBOM attestation pair applies to all of them.
		// Provenance opts in at the package level — if any target in the group
		// requested provenance the whole group attests; if none did, we skip.
		// Failed-mismatch results do not receive the URLs.
		const anySuccess = results.some((r) => r.status === "published" || r.status === "skipped");
		const groupProvenance = npmTargets.some((t) => t.provenance);
		let attestations: AttestationsOutcome = {
			attestationUrl: undefined,
			sbomAttestationUrl: undefined,
			provenanceRecovered: false,
			sbomRecovered: false,
		};
		let attestationsRan = false;
		if (anySuccess && groupProvenance) {
			attestations = yield* runAttestationsForBuild(
				packageName,
				version,
				groupProvenance,
				packResult.sha256Hex,
				sbomPath,
			);
			attestationsRan = true;
		}

		// Emit the attestation rows beneath the publish targets — one per real URL,
		// never an empty row. npm's native trusted-publishing provenance (captured per
		// npm target during publish) and the action's own attestation are distinct
		// anchors over the same artifact, so both render when present.
		const npmProvenanceUrls = [
			...new Set(results.map((r) => r.npmProvenanceUrl).filter((u): u is string => u !== undefined)),
		];
		for (const url of npmProvenanceUrls) {
			yield* Effect.logInfo(`  🔏 provenance: ${url} (npm native)`);
		}
		if (attestations.attestationUrl !== undefined) {
			const reused = attestations.provenanceRecovered ? " — reused" : "";
			yield* Effect.logInfo(`  🔏 provenance: ${attestations.attestationUrl} (action)${reused}`);
		}
		if (attestations.sbomAttestationUrl !== undefined) {
			const reused = attestations.sbomRecovered ? " — reused" : "";
			yield* Effect.logInfo(`  📄 sbom: ${attestations.sbomAttestationUrl}${reused}`);
		}

		// Attach the shared URLs (and the per-package sbomPath, threaded in from
		// runBuildAndSbom) to every successful target's result. `recovered`
		// surfaces only when the per-build attestation step actually ran —
		// undefined when groupProvenance was false (no attestation attempted).
		const enrichedResults = results.map((r) =>
			r.status === "published" || r.status === "skipped"
				? {
						...r,
						attestationUrl: attestations.attestationUrl,
						sbomAttestationUrl: attestations.sbomAttestationUrl,
						...(sbomPath !== null ? { sbomPath } : {}),
						...(attestationsRan
							? {
									recovered: {
										provenance: attestations.provenanceRecovered,
										sbom: attestations.sbomRecovered,
									},
								}
							: {}),
					}
				: r,
		);

		// Render the group's tally honestly: when any target failed to publish or
		// hit a fatal integrity mismatch, the group did not fully succeed. Only
		// non-zero counts appear, so a clean run reads `2 targets published`
		// rather than burying the signal under three zero columns.
		const counts: string[] = [];
		if (publishedCount > 0) counts.push(`${publishedCount} published`);
		if (skippedIdenticalCount > 0) counts.push(`${skippedIdenticalCount} skipped-identical`);
		if (mismatchCount > 0) counts.push(`${mismatchCount} mismatch`);
		if (failedCount > 0) counts.push(`${failedCount} failed`);
		const attestNote: string[] = [];
		if (npmProvenanceUrls.length > 0 || attestations.attestationUrl !== undefined) attestNote.push("provenance");
		if (attestations.sbomAttestationUrl !== undefined) attestNote.push("SBOM");
		const summaryParts = [counts.length > 0 ? counts.join(", ") : "no targets"];
		if (attestNote.length > 0) summaryParts.push(attestNote.join(" + "));
		const groupSummary = summaryParts.join(" · ");
		if (mismatchCount > 0 || failedCount > 0) {
			yield* Effect.logWarning(`  ❌ ${groupSummary}`);
		} else {
			yield* Effect.logInfo(`  ✅ ${groupSummary}`);
		}
		return enrichedResults;
	});

// ─── detectReleases ────────────────────────────────────────────────────────────

/**
 * Detect the released / in-scope packages for a publish run — Step 1 of the
 * Phase-3 flow.
 *
 * Prefers the merged-PR file diff; falls back to the commit diff when a PR
 * number is absent or the PR diff yields nothing. Never fails — detection
 * errors yield an empty array.
 *
 * @public
 */
export const detectReleases = (
	args: PublishInputArgs,
): Effect.Effect<
	ReadonlyArray<DetectedRelease>,
	never,
	ActionEnvironment | ActionLogger | ChangesetConfig | GitHubCommit | GitHubContent | PullRequest | Repo
> =>
	Effect.gen(function* () {
		const logger = yield* ActionLogger;

		return yield* logger.group(
			"Detect released packages",
			Effect.gen(function* () {
				let detected: ReadonlyArray<DetectedRelease>;

				if (args.mergedReleasePRNumber !== undefined) {
					yield* Effect.logDebug(`detectReleases: detecting from PR #${args.mergedReleasePRNumber}`);
					detected = yield* detectFromPR(args.mergedReleasePRNumber);
					if (detected.length === 0) {
						yield* Effect.logDebug("detectReleases: PR detection returned nothing, falling back to commit diff");
						detected = yield* detectFromCommit();
					}
				} else {
					yield* Effect.logDebug("detectReleases: detecting from commit diff");
					detected = yield* detectFromCommit();
				}

				yield* Effect.logDebug(`detectReleases: ${detected.length} package(s) detected`);

				// Drop packages whose names match the changeset ignore list so they
				// are fully excluded from Phase-3 publishing, not just from the Phase-1
				// changeset analysis.
				const config = yield* ChangesetConfig;
				const root = process.cwd();
				const kept: DetectedRelease[] = [];
				for (const d of detected) {
					if (yield* config.isIgnored(d.name, root)) continue;
					kept.push(d);
				}
				yield* Effect.logDebug(`detectReleases: ${kept.length} package(s) in scope after ignore filter`);
				yield* Effect.logInfo(`  ✅ ${kept.length} package(s) in scope`);
				return kept;
			}),
		);
	});

// ─── runBuildAndSbom ───────────────────────────────────────────────────────────

/**
 * Result of {@link runBuildAndSbom} — the Phase-3 Build & SBOM gate.
 *
 * @public
 */
export interface BuildSbomResult {
	/** True when `ci:build` succeeded and every package's SBOM generated. */
	readonly ok: boolean;
	/** `ci:build` stderr/output when the build failed. */
	readonly buildError?: string;
	/** Names of packages whose SBOM generation failed. */
	readonly sbomFailures: ReadonlyArray<string>;
	/** Number of in-scope packages. */
	readonly packageCount: number;
	/**
	 * Per-package on-disk path of the saved CycloneDX SBOM JSON. The release
	 * step uploads this file as a release asset; absent entries indicate the
	 * SBOM was generated but not saved to disk (saving failed non-fatally).
	 * Keyed by package name.
	 */
	readonly sbomPaths: ReadonlyMap<string, string>;
}

/**
 * Build all in-scope packages and generate each one's SBOM — Step 3 of the
 * Phase-3 flow and its fail-fast gate.
 *
 * @remarks
 * Runs `ci:build` once, then assembles a BOM per package. The caller must
 * abort the phase (skip publish and releases) when `ok` is `false`.
 *
 * **`sbomFailures` can now only be populated by a failed disk write.**
 * `Sbom.generate` and `Sbom.toJson` are **total** — assembling and serializing
 * an owned model over validated values has nothing to fail at — so the
 * predecessor's `SbomError` generation channel is gone along with the package
 * that raised it. `Sbom.write` is the one fallible member, and it stays
 * non-fatal exactly as the predecessor's `save` did.
 *
 * @public
 */
export const runBuildAndSbom = (
	detected: ReadonlyArray<DetectedRelease>,
	args: PublishInputArgs,
): Effect.Effect<
	BuildSbomResult,
	never,
	ActionLogger | ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | WorkspaceDiscovery
> =>
	Effect.gen(function* () {
		const logger = yield* ActionLogger;
		const discovery = yield* WorkspaceDiscovery;

		return yield* logger.group(
			"Build & SBOM",
			Effect.gen(function* () {
				// ── Build (ci:build, once) ─────────────────────────────────────────
				const buildArgs = args.packageManager === "npm" ? ["run", "ci:build"] : ["ci:build"];
				yield* Effect.logDebug(`runBuildAndSbom: ${args.packageManager} ${buildArgs.join(" ")}`);

				// `Run.collect` treats a non-zero exit as a RESULT, not a failure —
				// the same split the predecessor's `execCapture` had, so the
				// exit-code branch below is reached identically. The error channel
				// fires only when the process could not be run at all.
				const buildOutcome = yield* Effect.result(Run.collect(ChildProcess.make(args.packageManager, buildArgs)));

				const build =
					buildOutcome._tag === "Success"
						? {
								success: buildOutcome.success.exitCode === 0,
								error: buildOutcome.success.stderr,
								output: buildOutcome.success.stdout,
							}
						: { success: false, error: buildOutcome.failure.message, output: "" };

				if (build.success) {
					yield* Effect.logDebug(build.output);
					yield* Effect.logInfo("  ✅ ci:build succeeded");
				} else {
					yield* Effect.logError(`ci:build failed — ${build.error}`);
					yield* Effect.logWarning("  ❌ aborted — build failed");
					return {
						ok: false,
						buildError: build.error,
						sbomFailures: [],
						packageCount: detected.length,
						sbomPaths: new Map<string, string>(),
					} satisfies BuildSbomResult;
				}

				// ── SBOM generation (per package) ──────────────────────────────────
				const sbomFailures: string[] = [];
				const sbomPaths = new Map<string, string>();

				for (const rel of detected) {
					// Resolve the WorkspacePackage for its dependency map; synthesise a
					// minimal one if discovery fails (e.g. a deleted monorepo member).
					const wsPkg = yield* discovery.getPackage(rel.name).pipe(
						Effect.catch(() =>
							Effect.succeed(
								WorkspacePackage.make({
									name: rel.name,
									version: rel.version,
									path: rel.path,
									packageJsonPath: join(rel.path, "package.json"),
									relativePath: "",
									workspaceRoot: process.cwd(),
								}),
							),
						),
					);

					// Save the SBOM under the package's own directory as
					// <unscoped>.sbom.json — the same naming convention runReleases
					// uploads with, and per-package because the SBOM describes the
					// package, not a particular registry target.
					const sbomDestPath = join(wsPkg.path, `${wsPkg.unscopedName}.sbom.json`);

					yield* Effect.logDebug(`runBuildAndSbom: generating SBOM for ${rel.name}@${rel.version}`);
					const document = Sbom.generate({
						root: SbomMetadataSource.componentFor({ name: rel.name, version: rel.version }),
						components: Object.entries(wsPkg.dependencies).map(([name, specifier]) =>
							SbomMetadataSource.componentFor({ name, version: specifier }),
						),
					});
					yield* Effect.logDebug(`generated CycloneDX BOM:\n${Sbom.toJson(document)}`);

					// Persist to disk so runReleases can attach the SBOM as a release
					// asset. Write failures are non-fatal — a warning, and no asset to
					// upload — but they ARE the only thing that can put a package in
					// `sbomFailures` now.
					const written = yield* Effect.result(Sbom.write(document, sbomDestPath));
					if (written._tag === "Success") {
						sbomPaths.set(rel.name, sbomDestPath);
						yield* Effect.logInfo(`  📄 sbom · ${rel.name}: ${document.components.length} component(s)`);
					} else {
						sbomFailures.push(rel.name);
						yield* Effect.logWarning(
							`  📄 sbom · ${rel.name}: write failed at ${sbomDestPath} — ${written.failure.message}; release asset will be skipped`,
						);
					}
				}

				yield* Effect.logInfo(`  ✅ ${detected.length} package(s) ready`);
				return {
					ok: sbomFailures.length === 0,
					sbomFailures,
					packageCount: detected.length,
					sbomPaths,
				} satisfies BuildSbomResult;
			}),
		);
	});

// ─── runPublishTargets ─────────────────────────────────────────────────────────

/**
 * Resolve publish targets for the detected packages, order them
 * topologically, and publish each to its registries — Step 4 of the Phase-3
 * flow.
 *
 * @remarks
 * Accumulates per-package / per-target errors into the returned
 * `PublishPackagesResult` (one failure does not abort the batch). The build
 * and detection that `runPublish` previously did internally are now Steps 3
 * and 1, performed by {@link runBuildAndSbom} and {@link detectReleases}.
 *
 * @public
 */
export const runPublishTargets = (
	detected: ReadonlyArray<DetectedRelease>,
	// `PublishInputArgs` is gone from this signature. Its only contribution was
	// `packageManager`, threaded down to pick the npm executor — a decision the
	// kit moved onto `NpmExecutor` (see `NPM_EXECUTOR` above), which is a
	// constant of this module rather than an input. `normalize-package-manager`
	// died with it; this was its last consumer.
	// Per-package on-disk path of the saved SBOM JSON. Populated by
	// `runBuildAndSbom` and threaded through so `publishDirectoryGroup` can
	// stamp it onto every successful target's result for the release-asset
	// upload step in `runReleases`. Absent entries omit the field — no SBOM
	// means no SBOM asset.
	sbomPaths: ReadonlyMap<string, string> = new Map(),
): Effect.Effect<
	PublishPackagesResult,
	Config.ConfigError,
	PublishServices | ActionState | PublishabilityDetector | WorkspaceDiscovery
> =>
	Effect.gen(function* () {
		const discovery = yield* WorkspaceDiscovery;
		const detector = yield* PublishabilityDetector;
		const state = yield* ActionState;
		const logger = yield* ActionLogger;
		const outputs = yield* ActionOutputs;

		// ── Resolve registry tokens once ───────────────────────────────────────
		// Masked here rather than inside `setupAuth`: the kit's `setupAuth` takes
		// a `Redacted` and states that masking in the CI log is the caller's job.
		// Once at resolution, not once per target — masking is idempotent, but a
		// workflow command per call is noise.
		// `ActionInput.string` treats an absent input AND an empty one as missing
		// data — the runner writes `""` for an unsupplied input — so `Config.option`
		// already yields `none` for both. The `!== ""` guard is therefore belt-and-
		// braces rather than load-bearing; kept because it costs nothing and states
		// the intent at the call site.
		const npmTokenOpt = yield* ActionInput.string("npm-token").pipe(Config.option);
		const npmToken: string | null = Option.isSome(npmTokenOpt) && npmTokenOpt.value !== "" ? npmTokenOpt.value : null;
		if (npmToken !== null) yield* outputs.setSecret(npmToken);

		const ghPkgsTokenOpt = yield* state
			.getOptional(STATE_KEYS.githubPackagesToken, GithubPackagesTokenState)
			.pipe(Effect.catch(() => Effect.succeed(Option.none<GithubPackagesTokenState>())));
		const ghPkgsToken: string | null =
			Option.isSome(ghPkgsTokenOpt) && ghPkgsTokenOpt.value.token !== "" ? ghPkgsTokenOpt.value.token : null;
		if (ghPkgsToken !== null) yield* outputs.setSecret(ghPkgsToken);

		const npmrcPath = userNpmrcPath();

		if (detected.length === 0) {
			return {
				success: true,
				packages: [],
				totalPackages: 0,
				successfulPackages: 0,
				totalTargets: 0,
				successfulTargets: 0,
			} satisfies PublishPackagesResult;
		}

		// ── Resolve publish targets ────────────────────────────────────────────
		yield* Effect.logDebug("runPublishTargets: resolving publish targets");

		interface PkgEntry {
			readonly version: string;
			readonly targets: ReadonlyArray<TargetSpec>;
		}
		const targetsByPackage = new Map<string, PkgEntry>();

		for (const rel of detected) {
			const wsPkg = yield* discovery.getPackage(rel.name).pipe(
				Effect.catch(() =>
					Effect.succeed(
						WorkspacePackage.make({
							name: rel.name,
							version: rel.version,
							path: rel.path,
							packageJsonPath: join(rel.path, "package.json"),
							relativePath: "",
							workspaceRoot: process.cwd(),
						}),
					),
				),
			);

			// No `Effect.catch` here, deliberately. `PublishabilityDetectorShape.detect`
			// is `Effect<ReadonlyArray<PublishTarget>>` — **`E` is `never`**, so the
			// predecessor's "Failed to resolve targets for …" warning arm could not
			// fire and is deleted rather than carried forward. An undetectable
			// package yields an empty array, which the loop below already handles.
			const publishTargets = yield* detector.detect(wsPkg);

			const jsrTargets = publishTargets.filter((t) => classifyRegistry(t.registry) === "jsr");
			const npmTargets = publishTargets.filter((t) => classifyRegistry(t.registry) !== "jsr");

			for (const t of jsrTargets) {
				yield* Effect.logWarning(
					`runPublishTargets: skipping JSR target ${t.registry} for ${rel.name} — JSR publishing is not yet supported`,
				);
			}

			// Resolve each target's directory to an absolute path, then drop any
			// whose built `package.json` is `private` — the build pipeline keeps
			// `private: true` on dev-only outputs as the "never publish" signal.
			const resolvedTargets: TargetSpec[] = [];
			let privateSkipped = 0;
			for (const t of npmTargets) {
				const directory = isAbsolute(t.directory) ? t.directory : join(wsPkg.path, t.directory);
				if (isTargetPrivate(directory)) {
					privateSkipped++;
					yield* Effect.logInfo(
						`⏭ ${rel.name} · ${basename(directory)} — package.json is private, not a publish target`,
					);
					continue;
				}
				resolvedTargets.push({
					registry: t.registry,
					directory,
					access: t.access,
					provenance: t.provenance ?? false,
				});
			}

			targetsByPackage.set(rel.name, { version: rel.version, targets: resolvedTargets });

			yield* Effect.logDebug(
				`runPublishTargets: ${rel.name}@${rel.version}: ${resolvedTargets.length} target(s)` +
					(jsrTargets.length > 0 ? ` (${jsrTargets.length} JSR skipped)` : "") +
					(privateSkipped > 0 ? ` (${privateSkipped} private skipped)` : ""),
			);
		}

		// ── Topological ordering ───────────────────────────────────────────────
		yield* Effect.logDebug("runPublishTargets: sorting packages topologically");

		// Dependency-first order via the shared helper (keeps only the released
		// packages, falls back to detection order on a cyclic graph). The Phase-3
		// orchestrator already sorts `detected`, so this is idempotent here.
		const sortedNames = yield* sortReleasesTopologically(detected.map((r) => r.name));

		// ── Publish each package (accumulate errors) ───────────────────────────
		const totalTargets = [...targetsByPackage.values()].reduce((sum, p) => sum + p.targets.length, 0);
		yield* Effect.logDebug(
			`runPublishTargets: publishing ${sortedNames.length} package(s), ${totalTargets} total target(s)`,
		);

		// `Effect.partition` is the accumulator: it runs every element and returns
		// `[failures, successes]` — note the order, which is the reverse of the
		// predecessor's `{ successes, failures }` field order. It never fails, so
		// one package's failure cannot abort the batch. It also loses item
		// attribution, which `Effect.mapError` restores by naming the package
		// inside the failing branch.
		const [failures, successes] = yield* Effect.partition(sortedNames, (name) =>
			Effect.gen(function* () {
				const pkgEntry = targetsByPackage.get(name);
				if (pkgEntry === undefined) {
					yield* Effect.logWarning(`runPublishTargets: no target info for ${name}, skipping`);
					return null;
				}

				const { version, targets } = pkgEntry;
				yield* Effect.logDebug(`runPublishTargets: publishing ${name}@${version}`);

				if (targets.length === 0) {
					yield* Effect.logDebug(`runPublishTargets: ${name} has no publish targets (version-only)`);
					return { name, version, targets: [] } satisfies PackagePublishResult;
				}

				// Group targets by build directory so each unique directory packs
				// once and the resulting tarball is reused across every target
				// sharing it (pack-once / publish-tarball flow).
				const groups = new Map<string, TargetSpec[]>();
				for (const t of targets) {
					const arr = groups.get(t.directory);
					if (arr === undefined) groups.set(t.directory, [t]);
					else arr.push(t);
				}

				const targetResults: TargetPublishResult[] = [];
				const sbomPathForPackage = sbomPaths.get(name) ?? null;

				for (const [directory, groupTargets] of groups) {
					// Single-group packages (the common npm+github-collapsed case) read
					// `Publish · @scope/pkg@1.2.3`; only a package split across distinct
					// byte-groups disambiguates with the group id (e.g. `· github`).
					const groupSuffix = groups.size > 1 ? ` · ${getGroupId(directory)}` : "";
					const groupResults = yield* logger.group(
						`Publish · ${name}@${version}${groupSuffix}`,
						publishDirectoryGroup(
							name,
							version,
							directory,
							groupTargets,
							npmToken,
							ghPkgsToken,
							npmrcPath,
							sbomPathForPackage,
						),
					);
					targetResults.push(...groupResults);
				}

				return { name, version, targets: targetResults } satisfies PackagePublishResult;
			}).pipe(Effect.mapError((error: never) => ({ item: name, error }))),
		);

		// ── Assemble PublishPackagesResult ─────────────────────────────────────
		const packages: PackagePublishResult[] = [];
		let successfulPackages = 0;
		let successfulTargets = 0;

		for (const result of successes) {
			if (result === null) continue;
			packages.push(result);
			// A target counts as successful for the abort check when it
			// either published (`status: "published"`) or recovered
			// (`status: "skipped"` with `skipReason: "already-published-identical"`).
			// `success: true` already covers both branches; failed targets are
			// `success: false`.
			const allTargetsOk = result.targets.length === 0 || result.targets.every((t) => t.success);
			if (allTargetsOk) {
				successfulPackages++;
			}
			successfulTargets += result.targets.filter((t) => t.success).length;
		}

		// UNREACHABLE TODAY, and kept on purpose. `publishDirectoryGroup` catches
		// every failure into a `status: "failed"` result, so the partitioned `E` is
		// `never` and this loop cannot run — which was equally true of the
		// predecessor's `ErrorAccumulator` branch; no test ever exercised it. It
		// stays as the landing site for the moment any step inside stops catching,
		// because deleting it would turn that future failure into an abort of the
		// whole batch instead of one package's failed entry. `String(error)` rather
		// than an `instanceof` narrowing, because `never` has no prototype to test.
		for (const { item: name, error } of failures) {
			const message = String(error);
			yield* Effect.logError(`runPublishTargets: publishing ${name} failed — ${message}`);
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
						error: message,
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
