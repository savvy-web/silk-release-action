/**
 * Phase-3 release orchestrator: git tags, GitHub releases, release-asset
 * attestation, and artifact-metadata storage records.
 *
 * Ports the behaviour preserved in `src/utils/create-github-releases.ts`
 * (`createGitHubReleases`) and the release-asset attestation logic in
 * `src/utils/create-attestation.ts` (`createReleaseAssetAttestation`) plus
 * the storage-record call in `src/utils/attest-runner.ts`
 * (`runCreateStorageRecord`) to a pure Effect program.
 *
 * Per-tag failures are collected into the `errors` array without aborting the
 * rest of the batch. The overall `success` flag is `true` only when `errors`
 * is empty.
 *
 * @module release/releases
 */

import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { Attestation, GitHubError, ReleaseInfo as GitHubReleaseInfo } from "@effected/github";
import { ArtifactMetadata, GitHubRelease, GitTag, Repo, StorageRecordInput } from "@effected/github";
import type { OidcTokenIssuer } from "@effected/github-actions";
import { ActionEnvironment, ActionLogger } from "@effected/github-actions";
import { classifyRegistry } from "@effected/npm";
import type { SigstoreSigner } from "@effected/sbom";
import { SlsaProvenance } from "@effected/sbom";
import { WorkspaceDiscovery } from "@effected/workspaces";
import { Effect, Option } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";

import { extractVersionReleaseNotes } from "../utils/extract-release-notes.js";
import { getGroupId, insertGroupToken } from "../utils/group-id.js";
import { registryDisplayName } from "../utils/registry-label.js";
import { attestSubject, buildProvenancePredicate } from "./attest-helpers.js";
import { ReleasesError } from "./errors.js";
import { tarMetaFolder } from "./meta-archive.js";
import { getPackagePageUrl } from "./report.js";
import type { AssetInfo, PackagePublishResult, PublishPackagesResult, ReleaseInfo, TagInfo } from "./types.js";

// ─── Public interfaces ────────────────────────────────────────────────────────

/**
 * Input arguments for {@link runReleases}.
 *
 * @public
 */
export interface ReleasesInputArgs {
	/** Tags to create releases for. */
	readonly tags: ReadonlyArray<TagInfo>;
	/** Results from the preceding publish step. */
	readonly publishResult: PublishPackagesResult;
	/** Package manager used (pnpm / npm / yarn / bun). */
	readonly packageManager: string;
	/** When true skip all real mutations and return a synthetic report. */
	readonly dryRun: boolean;
}

/**
 * Aggregated result from {@link runReleases}.
 *
 * @public
 */
export interface ReleasesReport {
	/** Whether all tags/releases were created without error. */
	readonly success: boolean;
	/** Per-tag release descriptors. */
	readonly releases: ReadonlyArray<ReleaseInfo>;
	/** Human-readable error strings accumulated over the batch. */
	readonly errors: ReadonlyArray<string>;
}

/**
 * Every service {@link runReleases} and its helpers resolve.
 *
 * @remarks
 * Named once rather than spelled out on each helper: the union appeared three
 * times and drifted, carrying a `CommandRunner` requirement no call site had
 * used since `tarMetaFolder` moved onto `@effected/commands`.
 *
 * @public
 */
export type ReleasesServices =
	| ActionEnvironment
	| ActionLogger
	| ArtifactMetadata
	| Attestation
	| ChildProcessSpawner.ChildProcessSpawner
	| GitHubRelease
	| GitTag
	| OidcTokenIssuer
	| Repo
	| SigstoreSigner
	| WorkspaceDiscovery;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Return the unscoped package name.
 *
 * @example
 * getUnscopedName("@savvy-web/pkg") // "pkg"
 */
function getUnscopedName(packageName: string): string {
	if (packageName.startsWith("@") && packageName.includes("/")) {
		return packageName.split("/")[1] ?? packageName;
	}
	return packageName;
}

/**
 * Resolve the bundler's `meta/` folder that sits beside a `dist/prod/<group>/pkg`
 * build directory. `…/<group>/pkg` → `…/<group>/meta`.
 *
 * Trailing slashes are tolerated, so `…/<group>/pkg/` maps to `…/<group>/meta`.
 */
export function metaDirFor(buildDirectory: string): string {
	const normalized = buildDirectory.replace(/\/+$/, "");
	return join(dirname(normalized), "meta");
}

/**
 * Copy a generated SBOM file into the group's `meta/` folder (beside its `pkg/`
 * build dir) so the `…{group}.meta.tgz` doc bundle includes it. No-op when the
 * meta folder is absent (a non-bundler package) or the source is missing. The
 * copy keeps the SBOM's basename (`<unscoped>.sbom.json`).
 */
export function copySbomIntoMeta(sbomPath: string, buildDirectory: string): void {
	const metaDir = metaDirFor(buildDirectory);
	if (!existsSync(sbomPath) || !existsSync(metaDir)) return;
	copyFileSync(sbomPath, join(metaDir, basename(sbomPath)));
}

/**
 * Find the API Extractor doc file (`<unscopedName>.api.json`) in the sibling
 * `meta/` folder beside the build directory.
 *
 * The `@savvy-web/bundler` prod layout emits `<unscoped>.api.json` into
 * `dist/prod/<group>/meta/` (not `dist/prod/<group>/pkg/`), so we resolve
 * the sibling folder via `metaDirFor` before searching.
 *
 * @param directory - Build directory (`dist/prod/<group>/pkg`); may be undefined
 * @param packageName - Full package name used to derive the unscoped file name
 * @returns Absolute path to the `.api.json` file, or `undefined` if not found
 */
export function findApiDocFile(directory: string | undefined, packageName: string): string | undefined {
	if (!directory) return undefined;
	const unscopedName = getUnscopedName(packageName);
	const apiFilePath = join(metaDirFor(directory), `${unscopedName}.api.json`);
	return existsSync(apiFilePath) ? apiFilePath : undefined;
}

/**
 * Build the release-notes markdown for a set of packages associated with a tag.
 *
 * Ports the changelog-extraction + publish-summary-table logic from
 * `createGitHubReleases` in `create-github-releases.ts`.
 *
 * Uses `WorkspaceDiscovery.getPackage` to resolve each package's filesystem
 * path so CHANGELOG.md can be located.  Falls back to `process.cwd()` if
 * discovery fails (e.g. a deleted monorepo member).
 */
const buildReleaseNotes = (
	packages: PackagePublishResult[],
	owner: string,
): Effect.Effect<string, never, WorkspaceDiscovery> =>
	Effect.gen(function* () {
		const discovery = yield* WorkspaceDiscovery;
		let notes = "";

		// Changelog sections
		for (const pkg of packages) {
			const wsPkg = yield* discovery.getPackage(pkg.name).pipe(Effect.option);
			const pkgPath = Option.isSome(wsPkg) ? wsPkg.value.path : undefined;
			const changelogPaths: string[] = [];
			if (pkgPath) changelogPaths.push(join(pkgPath, "CHANGELOG.md"));
			changelogPaths.push(join(process.cwd(), "CHANGELOG.md"));

			let changelog: string | undefined;
			for (const cp of changelogPaths) {
				changelog = extractVersionReleaseNotes(cp, pkg.version);
				if (changelog) break;
			}

			if (packages.length > 1) notes += `## ${pkg.name}\n\n`;
			notes += changelog ?? `Released version ${pkg.version}`;
			notes += "\n\n";
		}

		// Publish summary table
		const publishedTargets: Array<{
			pkg: PackagePublishResult;
			target: PackagePublishResult["targets"][number];
			registryName: string;
			packageUrl: string | undefined;
		}> = [];

		for (const pkg of packages) {
			for (const target of pkg.targets.filter((t) => t.success)) {
				const registryName = registryDisplayName(target.target.registry);
				const packageUrl = getPackagePageUrl(target.target.registry ?? null, pkg.name, pkg.version, owner);
				publishedTargets.push({ pkg, target, registryName, packageUrl });
			}
		}

		if (publishedTargets.length === 0) {
			notes += "> This is a version-only release. No packages were published to a registry.\n\n";
			return notes;
		}

		notes += "---\n\n";
		notes += "### Publish Summary\n\n";
		notes += "| Registry | Package | SBOM | API | Provenance |\n";
		notes += "|----------|---------|------|-----|------------|\n";

		for (const { pkg, target, registryName, packageUrl } of publishedTargets) {
			const packageCell = packageUrl ? `[${pkg.name}@${pkg.version}](${packageUrl})` : `${pkg.name}@${pkg.version}`;
			const sbomCell = target.sbomPath ? "📦" : "—";
			const apiDocExists = findApiDocFile(target.target.directory, pkg.name) !== undefined;
			const apiCell = apiDocExists ? "📄" : "—";
			const provenanceParts: string[] = [];
			// npm's own trusted-publishing provenance (npm-registry targets only),
			// then the action's own SLSA provenance + GitHub attestation + SBOM. A
			// given target may carry several distinct anchors over the same artifact.
			if (target.npmProvenanceUrl) provenanceParts.push(`[npm](${target.npmProvenanceUrl})`);
			if (target.attestationUrl) provenanceParts.push(`[Sigstore](${target.attestationUrl})`);
			if (pkg.githubAttestationUrl) provenanceParts.push(`[GitHub](${pkg.githubAttestationUrl})`);
			if (target.sbomAttestationUrl) provenanceParts.push(`[SBOM](${target.sbomAttestationUrl})`);
			const provenanceCell = provenanceParts.length > 0 ? provenanceParts.join(", ") : "—";
			notes += `| ${registryName} | ${packageCell} | ${sbomCell} | ${apiCell} | ${provenanceCell} |\n`;
		}

		return notes;
	});

/**
 * Create the artifact-metadata storage record that links an attestation to a
 * GitHub Packages artifact.
 *
 * @remarks
 * Non-fatal — failures are logged as warnings.  Only called for GitHub Packages
 * targets.
 *
 * The body carries exactly the fields the endpoint declares. The predecessor's
 * input shape additionally carried `version`, and spelled the repository field
 * `repo`; neither appears in the endpoint's schema, so both were sent and
 * ignored. `@effected/github` types the body from the generated route, which is
 * why the difference is visible at all.
 */
const createStorageRecord = (
	packageName: string,
	version: string,
	digest: string,
): Effect.Effect<readonly number[] | undefined, never, ArtifactMetadata | Repo> =>
	Effect.gen(function* () {
		const artifactMetadata = yield* ArtifactMetadata;
		const { owner } = yield* Repo;

		const purlName = `pkg:npm/${packageName}@${version}`;
		const unscopedName = getUnscopedName(packageName);

		return yield* artifactMetadata.createStorageRecord(
			owner,
			StorageRecordInput.make({
				name: purlName,
				digest,
				registryUrl: "https://npm.pkg.github.com/",
				artifactUrl: `https://github.com/${owner}/pkgs/npm/${unscopedName}`,
				repository: unscopedName,
			}),
		);
	}).pipe(
		Effect.catch((e: GitHubError) =>
			Effect.gen(function* () {
				yield* Effect.logWarning(
					`runReleases: failed to create storage record for ${packageName}@${version}: ${e.message}`,
				);
				return undefined;
			}),
		),
	);

/**
 * Attest a single release asset (tarball) with SLSA provenance.
 *
 * @remarks
 * Non-fatal — on failure returns `undefined` so the batch can continue. Three
 * distinct things can go wrong and each is reported for what it is: no OIDC
 * claims (no `id-token: write`), a digest that is not a SHA-256, or a signing /
 * upload failure.
 */
const attestAsset = (
	artifactPath: string,
	packageName: string,
	version: string,
	tarballDigest: string,
): Effect.Effect<
	string | undefined,
	never,
	ActionEnvironment | Attestation | OidcTokenIssuer | Repo | SigstoreSigner
> =>
	Effect.gen(function* () {
		const predicate = yield* buildProvenancePredicate();

		if (predicate === null) {
			yield* Effect.logWarning(
				`runReleases: skipping attestation for ${basename(artifactPath)}: could not obtain OIDC claims`,
			);
			return undefined;
		}

		return yield* attestSubject({
			name: `pkg:npm/${packageName}@${version}`,
			sha256: tarballDigest,
			predicateType: SlsaProvenance.predicateType,
			predicate,
		}).pipe(
			Effect.catch((e) =>
				Effect.gen(function* () {
					yield* Effect.logWarning(`runReleases: attestation failed for ${basename(artifactPath)}: ${e.message}`);
					return undefined;
				}),
			),
		);
	});

// ─── Per-tag processing ────────────────────────────────────────────────────────

/**
 * Process a single tag: create the git tag, create the GitHub release, upload
 * assets, attest each asset, and write the storage record for GitHub Packages.
 *
 * Returns a tuple `[ReleaseInfo | null, string | null]` — the release info and
 * an error string (mutually exclusive).
 */
const processOneTag = (
	tag: TagInfo,
	associatedPackages: PackagePublishResult[],
	owner: string,
	repo: string,
	headSha: string,
	dryRun: boolean,
): Effect.Effect<readonly [ReleaseInfo | null, string | null], never, ReleasesServices> =>
	Effect.gen(function* () {
		yield* Effect.logDebug(`runReleases: processing ${tag.name}`);

		if (associatedPackages.length === 0) {
			yield* Effect.logWarning(`runReleases: no packages found for tag ${tag.name}`);
			return [null, null] as const;
		}

		// ── Dry-run shortcut ─────────────────────────────────────────────────────
		if (dryRun) {
			yield* Effect.logInfo(`✅ [DRY RUN] would create tag and release for ${tag.name}`);
			return [
				{
					tag: tag.name,
					url: `https://github.com/${owner}/${repo}/releases/tag/${tag.name}`,
					id: 0,
					assets: [],
				} satisfies ReleaseInfo,
				null,
			] as const;
		}

		// ── Step 1: Create git tag ────────────────────────────────────────────────
		// `GitTag.create`, deliberately NOT `GitTag.upsert`. Upsert would force the
		// tag onto the new head, silently retagging a release that already shipped
		// from a different commit. Here a divergence is reported and left alone.
		const gitTagSvc = yield* GitTag;

		yield* gitTagSvc.create(tag.name, headSha).pipe(
			Effect.tap(() => Effect.logInfo(`  🏷 ${tag.name} · created at ${headSha}`)),
			Effect.catch((createErr: GitHubError) =>
				// Distinguish the idempotent "tag already exists at the right SHA"
				// case from a true divergence. Resolve the existing tag's SHA and
				// compare against the head we tried to point at: equal → info-level
				// recovery (no GitHub Actions warning annotation), different →
				// warning that names both SHAs so the divergence is forensically
				// auditable, resolve-failure → preserve prior best-effort warning.
				gitTagSvc.resolve(tag.name).pipe(
					Effect.flatMap((existingSha) =>
						existingSha === headSha
							? Effect.gen(function* () {
									yield* Effect.logDebug(
										`runReleases: tag ${tag.name} already at ${headSha} — idempotent recovery, proceeding`,
									);
									yield* Effect.logInfo(`  🏷 ${tag.name} · already at ${headSha} — idempotent recovery`);
								})
							: Effect.gen(function* () {
									yield* Effect.logWarning(
										`runReleases: tag ${tag.name} create failed (${createErr.kind}); existing tag points at ${existingSha} but head is ${headSha} — proceeding`,
									);
									yield* Effect.logInfo(
										`  🏷 ${tag.name} · diverged — existing ${existingSha} ≠ head ${headSha} (proceeding)`,
									);
								}),
					),
					Effect.catch((resolveErr: GitHubError) =>
						Effect.gen(function* () {
							yield* Effect.logWarning(
								`runReleases: tag ${tag.name} create failed (${createErr.kind}) and resolve failed (${resolveErr.kind}) — proceeding`,
							);
							yield* Effect.logInfo(`  🏷 ${tag.name} · create+resolve failed — proceeding`);
						}),
					),
				),
			),
		);

		// ── Step 2: Build release notes ───────────────────────────────────────────
		const notes = yield* buildReleaseNotes(associatedPackages, owner);

		// ── Step 3: Create GitHub release ─────────────────────────────────────────
		const releaseSvc = yield* GitHubRelease;

		const releaseData: GitHubReleaseInfo = yield* releaseSvc
			.create({
				tag: tag.name,
				name: tag.name,
				body: notes.trim(),
				draft: false,
				prerelease: tag.version.includes("-"),
			})
			.pipe(
				// On re-run the release may already exist — fall back to getByTag.
				// Branch on the structural `kind`, never on the rendered message: the
				// predecessor matched `/already_exists|already exists/i` against a
				// free-text reason string.
				Effect.catchIf(
					(createErr: GitHubError) => createErr.kind === "alreadyExists",
					() => releaseSvc.getByTag(tag.name),
				),
			);

		yield* Effect.logDebug(`runReleases: release object ready — ${releaseData.id}`);

		// ── Step 4: Upload assets and attest ──────────────────────────────────────

		// Pre-fetch existing release assets for idempotency: if a re-run
		// encounters an asset name already attached to this release, skip the
		// upload and reuse the existing URL (ports `uploadAssetIdempotent` +
		// the `existingAssetsByName` pre-fetch from `create-github-releases.ts`).
		const existingAssetsByName = yield* releaseSvc.listAssets(releaseData.id).pipe(
			Effect.map((assets) => new Map(assets.map((a) => [a.name, { url: a.url, size: a.size }] as const))),
			Effect.catch((e: GitHubError) =>
				Effect.gen(function* () {
					yield* Effect.logWarning(`runReleases: failed to list existing assets for ${tag.name}: ${e.message}`);
					return new Map<string, { url: string; size: number }>();
				}),
			),
		);

		const assets: AssetInfo[] = [];
		const releaseInfo: ReleaseInfo = {
			tag: tag.name,
			url: `https://github.com/${owner}/${repo}/releases/tag/${tag.name}`,
			id: releaseData.id,
			assets,
		};

		// Mutable release-notes string; updated after asset uploads to replace
		// placeholder cells (📦 / 📄) with real download URLs, then pushed back
		// to GitHub via `GitHubRelease.update` (same pattern as original).
		let releaseNotes = notes;

		for (const pkg of associatedPackages) {
			const targetsWithTarballs = pkg.targets.filter((t) => t.success && t.tarballPath);

			if (targetsWithTarballs.length === 0) {
				yield* Effect.logWarning(`runReleases: no tarball path for ${pkg.name}@${pkg.version} — skipping asset upload`);
				continue;
			}

			const uploadedPaths = new Set<string>();

			// Accumulate SBOM / API-doc URLs so we can replace placeholder cells.
			// Keyed by package name (NOT directory) because the summary table
			// has one row per `(package, registry)` pair, and the placeholder
			// regex anchors on the package name to identify which rows to
			// rewrite. Two targets of the same package share one SBOM upload
			// and one API doc, so a single map entry covers every row for
			// that package.
			const sbomAssetUrls = new Map<string, string>();
			const apiDocAssetUrls = new Map<string, string>();

			for (const targetResult of targetsWithTarballs) {
				const artifactPath = targetResult.tarballPath;
				if (!artifactPath) continue;
				if (uploadedPaths.has(artifactPath)) continue;
				uploadedPaths.add(artifactPath);

				if (!existsSync(artifactPath)) {
					yield* Effect.logWarning(`runReleases: tarball not found at ${artifactPath} — skipping`);
					continue;
				}

				const group = getGroupId(targetResult.target.directory);
				const originalFileName = basename(artifactPath);
				const fileName = insertGroupToken(originalFileName, group);

				// ── Tarball upload (idempotent) ─────────────────────────────────────
				const existing = existingAssetsByName.get(fileName);
				let assetUrl: string;
				let assetSize: number;

				if (existing) {
					yield* Effect.logDebug(`runReleases: asset ${fileName} already attached — reusing`);
					assetUrl = existing.url;
					assetSize = existing.size;
				} else {
					const fileContent = readFileSync(artifactPath);
					yield* Effect.logDebug(`runReleases: uploading asset ${fileName}`);

					const asset = yield* releaseSvc
						.uploadAsset(releaseData, {
							name: fileName,
							data: fileContent,
							contentType: "application/octet-stream",
						})
						.pipe(
							Effect.catch((e: GitHubError) =>
								Effect.gen(function* () {
									yield* Effect.logWarning(`runReleases: upload failed for ${fileName}: ${e.message}`);
									return null;
								}),
							),
						);

					if (asset === null) continue;

					yield* Effect.logDebug(`runReleases: uploaded ${fileName} → ${asset.url}`);
					assetUrl = asset.url;
					assetSize = asset.size;
					existingAssetsByName.set(fileName, { url: asset.url, size: asset.size });
				}

				// Attest the asset. A target with no recorded digest is NOT attested:
				// the predecessor substituted `sha256:<filename>` here, which
				// `InTotoSubject` accepted verbatim and signed, publishing an
				// attestation whose subject digest was a file name. The kit validates
				// the digest, so that path now reports and skips.
				const attestationUrl =
					targetResult.tarballDigest === undefined
						? yield* Effect.logWarning(
								`runReleases: no tarball digest for ${pkg.name}@${pkg.version} — skipping attestation for ${fileName}`,
							).pipe(Effect.as(undefined))
						: yield* attestAsset(artifactPath, pkg.name, pkg.version, targetResult.tarballDigest);

				assets.push({
					name: fileName,
					downloadUrl: assetUrl,
					size: assetSize,
					attestationUrl,
					registry: targetResult.target.registry ?? undefined,
				});

				// Storage record for GitHub Packages
				if (
					classifyRegistry(targetResult.target.registry ?? undefined) === "github-packages" &&
					targetResult.tarballDigest !== undefined
				) {
					const storageIds = yield* createStorageRecord(pkg.name, pkg.version, targetResult.tarballDigest);
					if (storageIds && storageIds.length > 0) {
						yield* Effect.logDebug(
							`runReleases: storage record created for ${pkg.name}@${pkg.version} (IDs: ${storageIds.join(",")})`,
						);
					}
				}

				// ── SBOM meta copy ──────────────────────────────────────────────────
				if (targetResult.sbomPath) {
					copySbomIntoMeta(targetResult.sbomPath, targetResult.target.directory);
				}

				// ── Meta bundle (api + tsconfig + sbom) — unattested doc-builder asset ──
				const metaDir = metaDirFor(targetResult.target.directory);
				if (existsSync(metaDir)) {
					const metaName = insertGroupToken(originalFileName, group, ".meta.tgz");
					if (!existingAssetsByName.has(metaName)) {
						const metaOut = join(dirname(metaDir), metaName);
						yield* tarMetaFolder(metaDir, metaOut).pipe(
							Effect.catch((e) => Effect.logWarning(`runReleases: meta tar failed for ${metaName}: ${e.message}`)),
						);
						if (existsSync(metaOut)) {
							const metaAsset = yield* releaseSvc
								.uploadAsset(releaseData, {
									name: metaName,
									data: readFileSync(metaOut),
									contentType: "application/gzip",
								})
								.pipe(Effect.catch(() => Effect.succeed(null)));
							if (metaAsset !== null) {
								existingAssetsByName.set(metaName, { url: metaAsset.url, size: metaAsset.size });
								assets.push({ name: metaName, downloadUrl: metaAsset.url, size: metaAsset.size });
							}
						}
					}
				}

				// ── SBOM upload ─────────────────────────────────────────────────────
				if (targetResult.sbomPath && existsSync(targetResult.sbomPath)) {
					const sbomFileName = insertGroupToken(originalFileName, group, ".sbom.json");
					const sbomExisting = existingAssetsByName.get(sbomFileName);

					if (sbomExisting) {
						yield* Effect.logDebug(`runReleases: SBOM ${sbomFileName} already attached — reusing`);
						sbomAssetUrls.set(pkg.name, sbomExisting.url);
					} else {
						const sbomContent = readFileSync(targetResult.sbomPath);
						yield* Effect.logDebug(`runReleases: uploading SBOM ${sbomFileName}`);

						const sbomAsset = yield* releaseSvc
							.uploadAsset(releaseData, {
								name: sbomFileName,
								data: sbomContent,
								contentType: "application/json",
							})
							.pipe(
								Effect.catch((e: GitHubError) =>
									Effect.gen(function* () {
										yield* Effect.logWarning(`runReleases: SBOM upload failed for ${sbomFileName}: ${e.message}`);
										return null;
									}),
								),
							);

						if (sbomAsset !== null) {
							yield* Effect.logDebug(`runReleases: uploaded SBOM ${sbomFileName} → ${sbomAsset.url}`);
							sbomAssetUrls.set(pkg.name, sbomAsset.url);
							existingAssetsByName.set(sbomFileName, { url: sbomAsset.url, size: sbomAsset.size });
							assets.push({
								name: sbomFileName,
								downloadUrl: sbomAsset.url,
								size: sbomAsset.size,
							});
						}
					}
				}

				// ── API doc upload ──────────────────────────────────────────────────
				const apiDocPath = findApiDocFile(targetResult.target.directory, pkg.name);
				if (apiDocPath) {
					const apiDocFileName = insertGroupToken(originalFileName, group, ".api.json");
					const apiExisting = existingAssetsByName.get(apiDocFileName);

					if (apiExisting) {
						yield* Effect.logDebug(`runReleases: API doc ${apiDocFileName} already attached — reusing`);
						apiDocAssetUrls.set(pkg.name, apiExisting.url);
					} else {
						const apiDocContent = readFileSync(apiDocPath);
						yield* Effect.logDebug(`runReleases: uploading API doc ${apiDocFileName}`);

						const apiDocAsset = yield* releaseSvc
							.uploadAsset(releaseData, {
								name: apiDocFileName,
								data: apiDocContent,
								contentType: "application/json",
							})
							.pipe(
								Effect.catch((e: GitHubError) =>
									Effect.gen(function* () {
										yield* Effect.logWarning(`runReleases: API doc upload failed for ${apiDocFileName}: ${e.message}`);
										return null;
									}),
								),
							);

						if (apiDocAsset !== null) {
							yield* Effect.logDebug(`runReleases: uploaded API doc ${apiDocFileName} → ${apiDocAsset.url}`);
							apiDocAssetUrls.set(pkg.name, apiDocAsset.url);
							existingAssetsByName.set(apiDocFileName, { url: apiDocAsset.url, size: apiDocAsset.size });
							assets.push({
								name: apiDocFileName,
								downloadUrl: apiDocAsset.url,
								size: apiDocAsset.size,
							});
						}
					}
				}
			}

			// Replace SBOM and API-doc placeholder cells with real download
			// links. The maps are keyed by package name; the regex anchors
			// on the package's row identifier (`@scope/name@version` in the
			// Package cell) so every row owned by that package — one per
			// registry — gets the link, and rows owned by a DIFFERENT
			// package are left alone. The `g` flag is required because a
			// single package commonly has multiple targets (one row each)
			// sharing the same SBOM/API doc upload.
			const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			// `$` in a String.replace replacement string is a backreference
			// sigil (`$1`, `$&`, `$$`); a literal `$` must be doubled. Asset
			// URLs do not contain `$` today, but escape defensively in case a
			// future GitHub URL scheme does.
			const escapeRepl = (s: string) => s.replace(/\$/g, "$$$$");

			for (const [pkgName, sbomUrl] of sbomAssetUrls) {
				const escapedPkg = escapeRe(pkgName);
				releaseNotes = releaseNotes.replace(
					new RegExp(`(\\| [^|\\n]+ \\| [^|\\n]*${escapedPkg}@[^|\\n]+ \\|) 📦 \\|`, "g"),
					`$1 [📦](${escapeRepl(sbomUrl)}) |`,
				);
			}

			for (const [pkgName, apiDocUrl] of apiDocAssetUrls) {
				const escapedPkg = escapeRe(pkgName);
				releaseNotes = releaseNotes.replace(
					new RegExp(`(\\| [^|\\n]+ \\| [^|\\n]*${escapedPkg}@[^|\\n]+ \\|(?: [^|\\n]+ \\|)?) 📄 \\|`, "g"),
					`$1 [📄](${escapeRepl(apiDocUrl)}) |`,
				);
			}
		}

		// ── Step 5: Refresh release body with real asset links ────────────────────
		if (releaseInfo.assets.length > 0) {
			yield* releaseSvc
				.update(releaseData.id, { body: releaseNotes.trim() })
				.pipe(
					Effect.catch((e: GitHubError) =>
						Effect.logWarning(`runReleases: failed to update release body for ${tag.name}: ${e.message}`),
					),
				);
			yield* Effect.logDebug(`runReleases: updated release body with asset links for ${tag.name}`);
		}

		const releaseAssetCount = releaseInfo.assets.length;
		yield* Effect.logInfo(
			`  ✅ release created — ${releaseData.id} (${associatedPackages.length} package(s), ${releaseAssetCount} asset(s))`,
		);
		return [releaseInfo, null] as const;
	}).pipe(
		Effect.catch((e: GitHubError) => {
			const msg = `runReleases: failed to create release for ${tag.name}: ${e.message}`;
			return Effect.gen(function* () {
				yield* Effect.logWarning(msg);
				return [null, msg] as const;
			});
		}),
	);

// ─── runReleases ───────────────────────────────────────────────────────────────

/**
 * Effect-based Phase-3 release orchestrator.
 *
 * @remarks
 * Creates git tags and GitHub releases for every `TagInfo` entry, uploading
 * release-asset tarballs, attesting them with SLSA provenance, and creating
 * GitHub Packages storage records where applicable.
 *
 * Per-tag failures are accumulated into the returned `errors` array — one
 * failure does not abort the rest of the batch.
 *
 * @public
 */
export const runReleases = (args: ReleasesInputArgs): Effect.Effect<ReleasesReport, ReleasesError, ReleasesServices> =>
	Effect.gen(function* () {
		const logger = yield* ActionLogger;

		return yield* logger.group(
			"Create releases",
			Effect.gen(function* () {
				if (args.tags.length === 0) {
					yield* Effect.logDebug("runReleases: no tags to process");
					yield* Effect.logInfo("  ✅ 0 release(s) created — no tags");
					return {
						success: true,
						releases: [],
						errors: [],
					} satisfies ReleasesReport;
				}

				const { owner, repo } = yield* Repo;
				const environment = yield* ActionEnvironment;

				// The commit every tag is created at. `getOptional` rather than the
				// `GitHubContext` projection: absent reads as `""`, preserving the
				// predecessor's tolerance for a runner-less environment instead of
				// failing the whole batch on one missing variable.
				const headSha = Option.getOrElse(yield* environment.getOptional("GITHUB_SHA"), () => "");

				yield* Effect.logDebug(`runReleases: processing ${args.tags.length} tag(s)`);

				const releases: ReleaseInfo[] = [];
				const errors: string[] = [];

				for (const tag of args.tags) {
					// Find packages associated with this tag (mirrors the original logic)
					const associatedPackages = args.publishResult.packages.filter((pkg) => {
						if (tag.packageName.includes(", ")) {
							return tag.packageName.includes(pkg.name);
						}
						return pkg.name === tag.packageName;
					});

					const [releaseInfo, error] = yield* logger.group(
						`Release · ${tag.packageName}@${tag.version}`,
						processOneTag(tag, associatedPackages, owner, repo, headSha, args.dryRun),
					);

					if (error !== null) {
						errors.push(error);
					} else if (releaseInfo !== null) {
						releases.push(releaseInfo);
					}
				}

				yield* Effect.logDebug(
					`runReleases: complete — ${releases.length} release(s) created, ${errors.length} error(s)`,
				);
				yield* Effect.logInfo(
					errors.length === 0
						? `  ✅ ${releases.length} release(s) created`
						: `  ⚠ ${releases.length} release(s) created, ${errors.length} error(s)`,
				);

				return {
					success: errors.length === 0,
					releases,
					errors,
				} satisfies ReleasesReport;
			}),
		);
	}).pipe(
		Effect.catch((e: unknown) =>
			Effect.fail(
				new ReleasesError({
					reason: "release",
					message: `runReleases: fatal error: ${e instanceof Error ? e.message : String(e)}`,
					cause: e,
				}),
			),
		),
	);
