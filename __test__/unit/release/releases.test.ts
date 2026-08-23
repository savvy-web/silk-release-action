/**
 * Unit tests for runReleases (Phase-3 tag / release / attestation / storage-record).
 *
 * All dependencies are provided via kit test seams; no real git, GitHub API,
 * subprocess or Sigstore traffic is exercised.
 *
 * Note on OIDC / SLSA: the shared layer set below uses
 * `OidcTokenIssuer.layerFor(...)`, which answers with **real, decodable
 * claims** — unlike the predecessor's double, whose synthetic non-JWT made
 * `decodeJwtClaims` yield nothing and silently skipped the attestation path in
 * every test. So attestation now RUNS here, through a `SigstoreSigner` double
 * and an `Attestation` double, and the asserted `attestationUrl` is evidence
 * the path executed.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { ScriptedSpawner } from "@effected/commands";
import {
	ArtifactMetadata,
	Attestation,
	AttestationRecord,
	GitHubError,
	GitHubRelease,
	ReleaseInfo as GitHubReleaseInfo,
	GitTag,
	ReleaseAsset,
	Repo,
	RepoRef,
} from "@effected/github";
import { ActionEnvironment, ActionLogger, OidcClaims, OidcTokenIssuer } from "@effected/github-actions";
import { SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE, SigningError, SigstoreBundle, SigstoreSigner } from "@effected/sbom";
import { PackageNotFoundError, WorkspaceDiscovery } from "@effected/workspaces";
import { Effect, Layer, Option } from "effect";
import type { ReleasesInputArgs, ReleasesReport } from "../../../src/release/releases.js";
import { copySbomIntoMeta, findApiDocFile, metaDirFor, runReleases } from "../../../src/release/releases.js";
import type { PackagePublishResult, TagInfo } from "../../../src/release/types.js";
import { getGroupId, insertGroupToken } from "../../../src/utils/group-id.js";

/**
 * `tarMetaFolder` runs `tar` through `@effected/commands`, so the suite needs a
 * `ChildProcessSpawner`. Scripted rather than real: `tar` succeeds and anything
 * else is not-found, so a stray subprocess fails loudly.
 */
const tarSpawner = ScriptedSpawner.make((command) =>
	command === "tar" ? { exit: 0, stdout: "", stderr: "" } : ScriptedSpawner.notFound(command),
).layer;

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** A valid SHA-256 hex digest, so `Sha256Digest.parse` accepts the subject. */
const DIGEST_HEX = "a".repeat(64);

/** Minimal PackagePublishResult for a successfully-published package. */
const makePublishResult = (
	name: string,
	version: string,
	tarballPath?: string,
	sbomPath?: string,
): PackagePublishResult => ({
	name,
	version,
	targets: [
		{
			target: {
				protocol: "npm" as const,
				registry: "https://registry.npmjs.org/",
				directory: `/tmp/dist/${name}`,
				access: "public" as const,
				provenance: true,
				tag: "latest" as const,
				tokenEnv: null,
			},
			success: true,
			tarballPath: tarballPath ?? `/tmp/dist/${name}/pkg.tgz`,
			tarballDigest: `sha256:${DIGEST_HEX}`,
			sbomPath,
		},
	],
});

/** Minimal TagInfo. */
const makeTag = (name: string, packageName: string, version: string): TagInfo => ({
	name,
	packageName,
	version,
});

/** Build a minimal PublishPackagesResult wrapping an array of package results. */
const makePublishPackagesResult = (packages: PackagePublishResult[]) => ({
	success: true,
	packages,
	totalPackages: packages.length,
	successfulPackages: packages.length,
	totalTargets: packages.reduce((n, p) => n + p.targets.length, 0),
	successfulTargets: packages.reduce((n, p) => n + p.targets.filter((t) => t.success).length, 0),
});

// ─── Kit doubles ──────────────────────────────────────────────────────────────

const loggerLayer = ActionLogger.layerSilent;
const repoLayer = Layer.succeed(Repo, RepoRef.make({ owner: "test-owner", repo: "test-repo" }));

/** Real, decodable OIDC claims, so the provenance path actually executes. */
const oidcLayer = OidcTokenIssuer.layerFor(
	OidcClaims.make({
		iss: "https://token.actions.githubusercontent.com",
		ref: "refs/heads/main",
		sha: "cafebabe",
		repository: "test-owner/test-repo",
		event_name: "push",
		job_workflow_ref: "test-owner/test-repo/.github/workflows/release.yml@refs/heads/main",
		workflow_ref: "test-owner/test-repo/.github/workflows/release.yml@refs/heads/main",
		repository_id: "1",
		repository_owner_id: "2",
		runner_environment: "github-hosted",
		run_id: "10",
		run_attempt: "1",
	}),
);

/**
 * A `SigstoreSigner` whose `sign` returns a placeholder bundle.
 *
 * @remarks
 * `SigstoreSigner.makeTest` **dies** on an unstubbed `sign` by design — there is
 * no honest fabricated signature — so every suite that reaches the attestation
 * path must say what signing does. This one says "it succeeds", which is what
 * makes the downstream upload assertion meaningful.
 */
const sigstoreLayer = SigstoreSigner.layerTest({
	sign: () =>
		Effect.succeed(
			SigstoreBundle.make({
				mediaType: SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE,
				verificationMaterial: {},
				dsseEnvelope: { payload: "", payloadType: "application/vnd.in-toto+json", signatures: [] },
			}),
		),
});

/** Records every attestation upload so a test can assert the path ran. */
const makeAttestationLayer = () => {
	const uploads: unknown[] = [];
	const layer = Attestation.layerTest({
		upload: (bundle) => {
			uploads.push(bundle);
			return Effect.succeed(
				AttestationRecord.make({
					id: uploads.length,
					url: `https://github.com/test-owner/test-repo/attestations/${uploads.length}`,
				}),
			);
		},
		listForSubject: () => Effect.succeed([]),
	});
	return { uploads, layer };
};

/** Records every storage-record call. */
const makeArtifactMetadataLayer = () => {
	const calls: Array<Record<string, unknown>> = [];
	const layer = ArtifactMetadata.layerTest({
		createStorageRecord: (input) => {
			calls.push(input as unknown as Record<string, unknown>);
			return Effect.succeed([1]);
		},
	});
	return { calls, layer };
};

/** Records every `GitTag` call and succeeds. */
const makeGitTagLayer = (
	overrides: {
		create?: (tag: string, sha: string) => Effect.Effect<void, GitHubError, Repo>;
		resolve?: (tag: string) => Effect.Effect<string, GitHubError, Repo>;
	} = {},
) => {
	const createCalls: Array<{ tag: string; sha: string }> = [];
	const resolveCalls: string[] = [];
	const layer = GitTag.layerTest({
		create: (tag, sha) => {
			createCalls.push({ tag, sha });
			return overrides.create?.(tag, sha) ?? Effect.void;
		},
		resolve: (tag) => {
			resolveCalls.push(tag);
			return overrides.resolve?.(tag) ?? Effect.succeed("resolved-sha");
		},
	});
	return { createCalls, resolveCalls, layer };
};

/** An in-memory `GitHubRelease` recording creates, updates and asset uploads. */
const makeGitHubReleaseLayer = (
	overrides: {
		create?: (tag: string) => Effect.Effect<GitHubReleaseInfo, GitHubError, Repo> | undefined;
		seedAssets?: ReadonlyArray<ReleaseAsset>;
	} = {},
) => {
	const releases = new Map<string, GitHubReleaseInfo>();
	const createCalls: Array<{ tag: string; name: string; body: string }> = [];
	const uploadCalls: Array<{ releaseId: number; name: string; contentType: string }> = [];
	const updateCalls: Array<{ id: number; body: string | undefined }> = [];
	const assets = new Map<number, ReleaseAsset[]>();
	if (overrides.seedAssets !== undefined) assets.set(1, [...overrides.seedAssets]);

	const infoFor = (tag: string, name: string, body: string): GitHubReleaseInfo =>
		GitHubReleaseInfo.make({
			id: releases.size + 1,
			tag,
			name,
			body,
			draft: false,
			prerelease: false,
			url: `https://github.com/test-owner/test-repo/releases/tag/${tag}`,
			uploadUrl: `https://uploads.github.com/releases/${releases.size + 1}/assets`,
		});

	const layer = GitHubRelease.layerTest({
		create: (input) => {
			createCalls.push({ tag: input.tag, name: input.name ?? "", body: input.body ?? "" });
			const overridden = overrides.create?.(input.tag);
			if (overridden !== undefined) return overridden;
			const info = infoFor(input.tag, input.name ?? "", input.body ?? "");
			releases.set(input.tag, info);
			return Effect.succeed(info);
		},
		getByTag: (tag) => {
			const found = releases.get(tag);
			return found !== undefined
				? Effect.succeed(found)
				: Effect.fail(GitHubError.notFound("GitHubRelease.getByTag", tag));
		},
		listAssets: (id) => Effect.succeed(assets.get(id) ?? []),
		uploadAsset: (release, asset) => {
			uploadCalls.push({ releaseId: release.id, name: asset.name, contentType: asset.contentType });
			const stored = ReleaseAsset.make({
				id: uploadCalls.length,
				name: asset.name,
				url: `https://github.com/test-owner/test-repo/releases/assets/${uploadCalls.length}`,
				size: 1024,
			});
			assets.set(release.id, [...(assets.get(release.id) ?? []), stored]);
			return Effect.succeed(stored);
		},
		update: (id, patch) => {
			updateCalls.push({ id, body: patch.body });
			const existing = [...releases.values()].find((r) => r.id === id);
			return Effect.succeed(
				GitHubReleaseInfo.make({
					...(existing ?? infoFor("", "", "")),
					id,
					...(patch.body !== undefined ? { body: patch.body } : {}),
				}),
			);
		},
	});

	return { releases, createCalls, uploadCalls, updateCalls, assets, layer };
};

/**
 * Minimal WorkspaceDiscovery stub.
 *
 * Returns PackageNotFoundError for every package lookup so buildReleaseNotes
 * falls back to process.cwd() for the CHANGELOG path — the test cases don't
 * need real workspace paths.
 */
const workspaceDiscoveryLayer = Layer.succeed(WorkspaceDiscovery, {
	info: () => Effect.die(new Error("info() not stubbed")),
	listPackages: () => Effect.succeed([]),
	getPackage: (name: string) =>
		Effect.fail(new PackageNotFoundError({ name, available: [] })) as Effect.Effect<never, PackageNotFoundError>,
	importerMap: () => Effect.succeed(new Map()),
	resolveFile: () => Effect.succeed(Option.none()),
	resolveFiles: () => Effect.succeed([]),
	refresh: () => Effect.void,
	infoIn: () => Effect.die(new Error("infoIn() not stubbed")),
	listPackagesIn: () => Effect.die(new Error("listPackagesIn() not stubbed")),
	refreshIn: () => Effect.void,
});

/** Everything `runReleases` needs that no individual test varies. */
const baseLayers = (
	options: {
		readonly headSha?: string;
		readonly signer?: Layer.Layer<SigstoreSigner>;
		readonly logger?: Layer.Layer<ActionLogger>;
	} = {},
) =>
	Layer.mergeAll(
		options.logger ?? loggerLayer,
		repoLayer,
		oidcLayer,
		options.signer ?? sigstoreLayer,
		workspaceDiscoveryLayer,
		tarSpawner,
		ActionEnvironment.layerTest(options.headSha !== undefined ? { GITHUB_SHA: options.headSha } : {}),
	);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runReleases", () => {
	describe("happy-path: two tags → two releases", () => {
		it.effect("creates two git tags and two GitHub releases and returns success: true", () =>
			Effect.gen(function* () {
				// Arrange
				const tag = makeGitTagLayer();
				const release = makeGitHubReleaseLayer();
				const attestation = makeAttestationLayer();

				const tags: TagInfo[] = [makeTag("v1.0.0", "@test/pkg-a", "1.0.0"), makeTag("v2.0.0", "@test/pkg-b", "2.0.0")];
				const publishResult = makePublishPackagesResult([
					makePublishResult("@test/pkg-a", "1.0.0"),
					makePublishResult("@test/pkg-b", "2.0.0"),
				]);

				const args: ReleasesInputArgs = {
					tags,
					publishResult,
					packageManager: "pnpm",
					dryRun: false,
				};

				const layers = Layer.mergeAll(
					baseLayers(),
					tag.layer,
					release.layer,
					attestation.layer,
					makeArtifactMetadataLayer().layer,
				);

				// Act
				const result: ReleasesReport = yield* runReleases(args).pipe(Effect.provide(layers));

				// Assert: report
				expect(result.success).toBe(true);
				expect(result.errors).toHaveLength(0);
				expect(result.releases).toHaveLength(2);
				expect(result.releases.map((r) => r.tag)).toContain("v1.0.0");
				expect(result.releases.map((r) => r.tag)).toContain("v2.0.0");

				// Assert: two git tags were created
				expect(tag.createCalls).toHaveLength(2);
				expect(tag.createCalls.map((c) => c.tag)).toContain("v1.0.0");
				expect(tag.createCalls.map((c) => c.tag)).toContain("v2.0.0");

				// Assert: two GitHub releases were created
				expect(release.createCalls).toHaveLength(2);
				expect(release.createCalls.map((c) => c.tag)).toContain("v1.0.0");
				expect(release.createCalls.map((c) => c.tag)).toContain("v2.0.0");
			}),
		);

		it.effect("creates the git tag at GITHUB_SHA read through ActionEnvironment", () =>
			Effect.gen(function* () {
				const tag = makeGitTagLayer();
				const release = makeGitHubReleaseLayer();

				const args: ReleasesInputArgs = {
					tags: [makeTag("v1.2.3", "@test/pkg-sha", "1.2.3")],
					publishResult: makePublishPackagesResult([makePublishResult("@test/pkg-sha", "1.2.3")]),
					packageManager: "pnpm",
					dryRun: false,
				};

				const layers = Layer.mergeAll(
					baseLayers({ headSha: "feedface" }),
					tag.layer,
					release.layer,
					makeAttestationLayer().layer,
					makeArtifactMetadataLayer().layer,
				);

				yield* runReleases(args).pipe(Effect.provide(layers));

				expect(tag.createCalls).toEqual([{ tag: "v1.2.3", sha: "feedface" }]);
			}),
		);
	});

	describe("attestation", () => {
		it.effect("signs and uploads a provenance attestation for the tarball, and reports its URL", () =>
			Effect.gen(function* () {
				const tmpDir = mkdtempSync(join(tmpdir(), "releases-attest-"));
				try {
					const tarballPath = join(tmpDir, "pkg.tgz");
					writeFileSync(tarballPath, Buffer.from("fake tarball"));

					const attestation = makeAttestationLayer();
					const release = makeGitHubReleaseLayer();

					const publishResult = makePublishPackagesResult([makePublishResult("@test/pkg-att", "1.0.0", tarballPath)]);
					const firstTarget = publishResult.packages[0]?.targets[0];
					if (firstTarget) firstTarget.target.directory = tmpDir;

					const args: ReleasesInputArgs = {
						tags: [makeTag("v1.0.0", "@test/pkg-att", "1.0.0")],
						publishResult,
						packageManager: "pnpm",
						dryRun: false,
					};

					const layers = Layer.mergeAll(
						baseLayers(),
						makeGitTagLayer().layer,
						release.layer,
						attestation.layer,
						makeArtifactMetadataLayer().layer,
					);

					const result: ReleasesReport = yield* runReleases(args).pipe(Effect.provide(layers));

					// The attestation path ran: exactly one bundle was uploaded, and the
					// URL it returned reached the reported asset.
					expect(attestation.uploads).toHaveLength(1);
					const asset = result.releases[0]?.assets[0];
					expect(asset?.attestationUrl).toBe("https://github.com/test-owner/test-repo/attestations/1");
				} finally {
					rmSync(tmpDir, { recursive: true, force: true });
				}
			}),
		);

		it.effect("skips attestation — without uploading anything — when the target has no tarball digest", () =>
			Effect.gen(function* () {
				const tmpDir = mkdtempSync(join(tmpdir(), "releases-attest-"));
				try {
					const tarballPath = join(tmpDir, "pkg.tgz");
					writeFileSync(tarballPath, Buffer.from("fake tarball"));

					const attestation = makeAttestationLayer();
					const release = makeGitHubReleaseLayer();

					const publishResult = makePublishPackagesResult([
						makePublishResult("@test/pkg-nodigest", "1.0.0", tarballPath),
					]);
					const firstTarget = publishResult.packages[0]?.targets[0];
					if (firstTarget) {
						firstTarget.target.directory = tmpDir;
						// The predecessor substituted `sha256:<filename>` here and signed it.
						firstTarget.tarballDigest = undefined;
					}

					const args: ReleasesInputArgs = {
						tags: [makeTag("v1.0.0", "@test/pkg-nodigest", "1.0.0")],
						publishResult,
						packageManager: "pnpm",
						dryRun: false,
					};

					const layers = Layer.mergeAll(
						baseLayers(),
						makeGitTagLayer().layer,
						release.layer,
						attestation.layer,
						makeArtifactMetadataLayer().layer,
					);

					const result: ReleasesReport = yield* runReleases(args).pipe(Effect.provide(layers));

					// Nothing was signed or stored, the asset still uploaded, and the run
					// still succeeded — attestation is best-effort, not a gate.
					expect(attestation.uploads).toHaveLength(0);
					expect(result.success).toBe(true);
					const asset = result.releases[0]?.assets[0];
					expect(asset).toBeDefined();
					expect(asset?.attestationUrl).toBeUndefined();
				} finally {
					rmSync(tmpDir, { recursive: true, force: true });
				}
			}),
		);

		it.effect("does not fail the release when signing fails", () =>
			Effect.gen(function* () {
				const tmpDir = mkdtempSync(join(tmpdir(), "releases-attest-"));
				try {
					const tarballPath = join(tmpDir, "pkg.tgz");
					writeFileSync(tarballPath, Buffer.from("fake tarball"));

					const attestation = makeAttestationLayer();
					const release = makeGitHubReleaseLayer();

					const publishResult = makePublishPackagesResult([
						makePublishResult("@test/pkg-signfail", "1.0.0", tarballPath),
					]);
					const firstTarget = publishResult.packages[0]?.targets[0];
					if (firstTarget) firstTarget.target.directory = tmpDir;

					const args: ReleasesInputArgs = {
						tags: [makeTag("v1.0.0", "@test/pkg-signfail", "1.0.0")],
						publishResult,
						packageManager: "pnpm",
						dryRun: false,
					};

					const layers = Layer.mergeAll(
						baseLayers({
							signer: SigstoreSigner.layerTest({
								sign: () => Effect.fail(new SigningError({ kind: "identity", cause: new Error("no token") })),
							}),
						}),
						makeGitTagLayer().layer,
						release.layer,
						attestation.layer,
						makeArtifactMetadataLayer().layer,
					);

					const result: ReleasesReport = yield* runReleases(args).pipe(Effect.provide(layers));

					expect(result.success).toBe(true);
					expect(attestation.uploads).toHaveLength(0);
					expect(result.releases[0]?.assets[0]?.attestationUrl).toBeUndefined();
				} finally {
					rmSync(tmpDir, { recursive: true, force: true });
				}
			}),
		);
	});

	describe("resilient batch: one release failure does not abort the other", () => {
		it.effect("captures the failing release in errors but still creates the succeeding release", () =>
			Effect.gen(function* () {
				// Arrange: GitHubRelease.create fails for the first tag (v1.0.0)
				const tag = makeGitTagLayer();
				const release = makeGitHubReleaseLayer({
					create: (tagName) =>
						tagName === "v1.0.0"
							? Effect.fail(GitHubError.rejected("GitHubRelease.create", 500, "Simulated create failure for pkg-a"))
							: undefined,
				});

				const tags: TagInfo[] = [makeTag("v1.0.0", "@test/pkg-a", "1.0.0"), makeTag("v2.0.0", "@test/pkg-b", "2.0.0")];
				const publishResult = makePublishPackagesResult([
					makePublishResult("@test/pkg-a", "1.0.0"),
					makePublishResult("@test/pkg-b", "2.0.0"),
				]);

				const args: ReleasesInputArgs = {
					tags,
					publishResult,
					packageManager: "pnpm",
					dryRun: false,
				};

				const layers = Layer.mergeAll(
					baseLayers(),
					tag.layer,
					release.layer,
					makeAttestationLayer().layer,
					makeArtifactMetadataLayer().layer,
				);

				// Act
				const result: ReleasesReport = yield* runReleases(args).pipe(Effect.provide(layers));

				// Assert: both git tags were created (tag step happens before release step)
				expect(tag.createCalls.map((c) => c.tag)).toContain("v1.0.0");
				expect(tag.createCalls.map((c) => c.tag)).toContain("v2.0.0");

				// Assert: only one release succeeded (pkg-b / v2.0.0)
				expect(result.releases).toHaveLength(1);
				expect(result.releases[0]?.tag).toBe("v2.0.0");

				// Assert: one error was captured for pkg-a / v1.0.0
				expect(result.errors).toHaveLength(1);
				expect(result.errors[0]).toMatch(/v1\.0\.0/);

				// Assert: overall success is false due to the error
				expect(result.success).toBe(false);
			}),
		);

		it.effect("recovers an already-existing release via getByTag on `alreadyExists`", () =>
			Effect.gen(function* () {
				// The recovery branches on the structural `kind`, not on the message.
				const seeded = GitHubReleaseInfo.make({
					id: 77,
					tag: "v1.0.0",
					name: "v1.0.0",
					body: "prior",
					draft: false,
					prerelease: false,
					url: "https://github.com/test-owner/test-repo/releases/tag/v1.0.0",
					uploadUrl: "https://uploads.github.com/releases/77/assets",
				});

				const layers = Layer.mergeAll(
					baseLayers(),
					makeGitTagLayer().layer,
					GitHubRelease.layerTest({
						create: () => Effect.fail(GitHubError.alreadyExists("GitHubRelease.create", "v1.0.0")),
						getByTag: () => Effect.succeed(seeded),
						listAssets: () => Effect.succeed([]),
					}),
					makeAttestationLayer().layer,
					makeArtifactMetadataLayer().layer,
				);

				const args: ReleasesInputArgs = {
					tags: [makeTag("v1.0.0", "@test/pkg-exists", "1.0.0")],
					publishResult: makePublishPackagesResult([makePublishResult("@test/pkg-exists", "1.0.0")]),
					packageManager: "pnpm",
					dryRun: false,
				};

				const result: ReleasesReport = yield* runReleases(args).pipe(Effect.provide(layers));

				expect(result.success).toBe(true);
				expect(result.releases[0]?.id).toBe(77);
			}),
		);

		it.effect("does NOT recover a non-alreadyExists create failure", () =>
			Effect.gen(function* () {
				// The mutation guard for the branch above: a `rejected` create must be
				// reported, not silently turned into a `getByTag`.
				const layers = Layer.mergeAll(
					baseLayers(),
					makeGitTagLayer().layer,
					GitHubRelease.layerTest({
						create: () => Effect.fail(GitHubError.rejected("GitHubRelease.create", 422, "validation failed")),
						getByTag: () => Effect.die(new Error("getByTag must not be reached")),
						listAssets: () => Effect.succeed([]),
					}),
					makeAttestationLayer().layer,
					makeArtifactMetadataLayer().layer,
				);

				const args: ReleasesInputArgs = {
					tags: [makeTag("v1.0.0", "@test/pkg-rejected", "1.0.0")],
					publishResult: makePublishPackagesResult([makePublishResult("@test/pkg-rejected", "1.0.0")]),
					packageManager: "pnpm",
					dryRun: false,
				};

				const result: ReleasesReport = yield* runReleases(args).pipe(Effect.provide(layers));

				expect(result.success).toBe(false);
				expect(result.errors).toHaveLength(1);
			}),
		);
	});

	describe("idempotent tag recovery on create failure", () => {
		it.effect("proceeds without a warning when tag.create fails but resolve returns the head SHA", () =>
			Effect.gen(function* () {
				const headSha = "head-sha-deadbeef";
				const tag = makeGitTagLayer({
					create: (tagName) => Effect.fail(GitHubError.alreadyExists("GitTag.create", tagName)),
					resolve: () => Effect.succeed(headSha),
				});
				const release = makeGitHubReleaseLayer();

				const args: ReleasesInputArgs = {
					tags: [makeTag("v7.0.0", "@test/pkg-idem", "7.0.0")],
					publishResult: makePublishPackagesResult([makePublishResult("@test/pkg-idem", "7.0.0")]),
					packageManager: "pnpm",
					dryRun: false,
				};

				const layers = Layer.mergeAll(
					baseLayers({ headSha }),
					tag.layer,
					release.layer,
					makeAttestationLayer().layer,
					makeArtifactMetadataLayer().layer,
				);

				const result: ReleasesReport = yield* runReleases(args).pipe(Effect.provide(layers));

				expect(tag.createCalls).toHaveLength(1);
				expect(tag.resolveCalls).toEqual(["v7.0.0"]);
				expect(release.createCalls).toHaveLength(1);
				expect(result.success).toBe(true);
				expect(result.releases).toHaveLength(1);
			}),
		);

		// NOT `it.effect`: this test patches the real `console.log` to observe
		// `ActionLogger`'s `::warning::` output. Under `it.effect` the TestEnv
		// installs `TestConsole`, which intercepts the same `ConsoleRef` that
		// `ActionLogger` writes through, so the spy would capture nothing. Kept on
		// the live runtime, where the try/finally restore is also reliable.
		it("logs a warning naming BOTH SHAs when resolve returns a DIFFERENT SHA", async () => {
			const headSha = "head-sha-aaaa";
			const existingSha = "existing-sha-bbbb";

			const tag = makeGitTagLayer({
				create: (tagName) => Effect.fail(GitHubError.alreadyExists("GitTag.create", tagName)),
				resolve: () => Effect.succeed(existingSha),
			});

			const args: ReleasesInputArgs = {
				tags: [makeTag("v8.0.0", "@test/pkg-div", "8.0.0")],
				publishResult: makePublishPackagesResult([makePublishResult("@test/pkg-div", "8.0.0")]),
				packageManager: "pnpm",
				dryRun: false,
			};

			// The REAL `ActionLogger`, not the silent double: the assertion is about
			// what a maintainer reads in the run log, so a double that swallows the
			// line would make it vacuous. `ActionLogger.logger` renders `Warn` as a
			// `::warning::` workflow command through core `Console`, which makes
			// `console.log` the observation point.
			const environment = ActionEnvironment.layerTest({ GITHUB_SHA: headSha });
			const layers = Layer.mergeAll(
				repoLayer,
				oidcLayer,
				sigstoreLayer,
				workspaceDiscoveryLayer,
				tarSpawner,
				environment,
				ActionLogger.layer.pipe(Layer.provide(environment)),
				tag.layer,
				makeGitHubReleaseLayer().layer,
				makeAttestationLayer().layer,
				makeArtifactMetadataLayer().layer,
			);

			const lines: string[] = [];
			const originalLog = console.log;
			console.log = (...parts: unknown[]) => {
				lines.push(parts.map((p) => (typeof p === "string" ? p : String(p))).join(" "));
			};
			let result: ReleasesReport;
			try {
				result = await Effect.runPromise(
					runReleases(args).pipe(Effect.provide(layers), Effect.provide(ActionLogger.layerLogger)),
				);
			} finally {
				console.log = originalLog;
			}

			// The divergence path proceeded rather than aborting, and the warning
			// names BOTH SHAs so the divergence is auditable after the fact.
			expect(result.success).toBe(true);
			expect(tag.resolveCalls).toEqual(["v8.0.0"]);
			const warning = lines.find((l) => l.includes("::warning::") && l.includes("v8.0.0"));
			expect(warning).toBeDefined();
			expect(warning).toContain(headSha);
			expect(warning).toContain(existingSha);
		});
	});

	describe("dry-run mode", () => {
		it.effect("does not mutate tag/release state when dryRun: true", () =>
			Effect.gen(function* () {
				const tag = makeGitTagLayer();
				const release = makeGitHubReleaseLayer();

				const args: ReleasesInputArgs = {
					tags: [makeTag("v3.0.0", "@test/pkg-c", "3.0.0")],
					publishResult: makePublishPackagesResult([makePublishResult("@test/pkg-c", "3.0.0")]),
					packageManager: "pnpm",
					dryRun: true,
				};

				const layers = Layer.mergeAll(
					baseLayers(),
					tag.layer,
					release.layer,
					makeAttestationLayer().layer,
					makeArtifactMetadataLayer().layer,
				);

				const result: ReleasesReport = yield* runReleases(args).pipe(Effect.provide(layers));

				expect(tag.createCalls).toHaveLength(0);
				expect(release.createCalls).toHaveLength(0);
				expect(release.uploadCalls).toHaveLength(0);

				expect(result.success).toBe(true);
				expect(result.releases).toHaveLength(1);
				expect(result.releases[0]?.tag).toBe("v3.0.0");
				expect(result.errors).toHaveLength(0);
			}),
		);
	});

	describe("SBOM and API-doc asset upload", () => {
		let tmpDir: string;

		beforeEach(() => {
			tmpDir = mkdtempSync(join(tmpdir(), "releases-test-"));
		});

		afterEach(() => {
			rmSync(tmpDir, { recursive: true, force: true });
		});

		it.effect("uploads SBOM and API-doc assets and includes them in AssetInfo[]", () =>
			Effect.gen(function* () {
				// Arrange: write real files so existsSync / readFileSync succeed.
				// The bundler emits <unscoped>.api.json into dist/prod/<group>/meta/,
				// sitting beside the pkg/ dir. We mirror that layout inside tmpDir:
				//   tmpDir/pkg/   ← target.directory (the "pkg" output folder)
				//   tmpDir/meta/  ← sibling meta folder where api.json lives
				const pkgDir = join(tmpDir, "pkg");
				const metaDir = join(tmpDir, "meta");
				mkdirSync(pkgDir, { recursive: true });
				mkdirSync(metaDir, { recursive: true });

				const tarballPath = join(pkgDir, "pkg.tgz");
				const sbomPath = join(pkgDir, "pkg.sbom.json");
				// pkg-d is the unscoped name of @test/pkg-d.
				const apiDocPath = join(metaDir, "pkg-d.api.json");

				writeFileSync(tarballPath, Buffer.from("fake tarball"));
				writeFileSync(sbomPath, JSON.stringify({ bomFormat: "CycloneDX" }));
				writeFileSync(apiDocPath, JSON.stringify({ metadata: { toolPackage: "@microsoft/api-extractor" } }));

				const tag = makeGitTagLayer();
				const release = makeGitHubReleaseLayer();

				const publishResult = makePublishPackagesResult([
					makePublishResult("@test/pkg-d", "4.0.0", tarballPath, sbomPath),
				]);

				// Override the directory so findApiDocFile resolves the .api.json file.
				// target.directory must point at the pkg/ dir; metaDirFor will derive
				// the sibling meta/ folder from it.
				const firstTarget = publishResult.packages[0]?.targets[0];
				if (firstTarget) {
					firstTarget.target.directory = pkgDir;
				}

				const args: ReleasesInputArgs = {
					tags: [makeTag("v4.0.0", "@test/pkg-d", "4.0.0")],
					publishResult,
					packageManager: "pnpm",
					dryRun: false,
				};

				const layers = Layer.mergeAll(
					baseLayers(),
					tag.layer,
					release.layer,
					makeAttestationLayer().layer,
					makeArtifactMetadataLayer().layer,
				);

				const result: ReleasesReport = yield* runReleases(args).pipe(Effect.provide(layers));

				expect(result.success).toBe(true);
				expect(result.releases).toHaveLength(1);

				expect(tag.createCalls).toHaveLength(1);
				expect(release.createCalls).toHaveLength(1);

				// Assert: three assets were uploaded — tarball, SBOM, API doc
				expect(release.uploadCalls).toHaveLength(3);
				const uploadedNames = release.uploadCalls.map((c) => c.name);
				const group = getGroupId(pkgDir);
				const expectedTarball = insertGroupToken("pkg.tgz", group);
				const expectedSbom = insertGroupToken("pkg.tgz", group, ".sbom.json");
				const expectedApiDoc = insertGroupToken("pkg.tgz", group, ".api.json");
				expect(uploadedNames).toContain(expectedTarball);
				expect(uploadedNames).toContain(expectedSbom);
				expect(uploadedNames).toContain(expectedApiDoc);

				const releaseResult = result.releases[0];
				expect(releaseResult).toBeDefined();
				if (!releaseResult) return;
				const assetNames = releaseResult.assets.map((a) => a.name);
				expect(assetNames).toContain(expectedTarball);
				expect(assetNames).toContain(expectedSbom);
				expect(assetNames).toContain(expectedApiDoc);
			}),
		);
	});

	describe("group-keyed meta.tgz doc bundle", () => {
		let tmpDir: string;

		beforeEach(() => {
			tmpDir = mkdtempSync(join(tmpdir(), "releases-meta-test-"));
		});

		afterEach(() => {
			rmSync(tmpDir, { recursive: true, force: true });
		});

		it.effect("packs the group meta/ folder and uploads it as an unattested .npm.meta.tgz asset", () =>
			Effect.gen(function* () {
				// Arrange: mirror the bundler prod layout dist/prod/npm/{pkg,meta}.
				const pkgDir = join(tmpDir, "dist", "prod", "npm", "pkg");
				const metaDir = join(tmpDir, "dist", "prod", "npm", "meta");
				mkdirSync(pkgDir, { recursive: true });
				mkdirSync(metaDir, { recursive: true });

				const tarballPath = join(pkgDir, "savvy-web-pkg-meta-9.0.0.tgz");
				writeFileSync(tarballPath, Buffer.from("fake tarball"));
				writeFileSync(join(metaDir, "pkg-meta.api.json"), JSON.stringify({ metadata: {} }));
				writeFileSync(join(metaDir, "tsconfig.json"), JSON.stringify({ compilerOptions: {} }));

				// A spawner whose `tar` actually WRITES the output tarball to its
				// `-czf <outPath>` arg (args[1]), so the post-tar `existsSync(metaOut)`
				// guard passes and the upload fires.
				const writingTarSpawner = ScriptedSpawner.make((command, args) => {
					if (command !== "tar") return ScriptedSpawner.notFound(command);
					// Derived from the flag rather than hard-coded at `args[1]`: with a
					// fixed index, any reordering of `releases.ts`'s argv would make this
					// double write to a flag string (or nothing) and the assertion below
					// would fail without naming the cause.
					const flagIndex = args.findIndex((a) => a === "-czf" || a === "-f");
					const outPath = flagIndex === -1 ? undefined : args[flagIndex + 1];
					if (outPath !== undefined) writeFileSync(outPath, "fake-tgz");
					return { exit: 0, stdout: "", stderr: "" };
				}).layer;

				const release = makeGitHubReleaseLayer();

				const publishResult = makePublishPackagesResult([makePublishResult("@test/pkg-meta", "9.0.0", tarballPath)]);
				const firstTarget = publishResult.packages[0]?.targets[0];
				if (firstTarget) firstTarget.target.directory = pkgDir;

				const args: ReleasesInputArgs = {
					tags: [makeTag("v9.0.0", "@test/pkg-meta", "9.0.0")],
					publishResult,
					packageManager: "pnpm",
					dryRun: false,
				};

				const layers = Layer.mergeAll(
					loggerLayer,
					repoLayer,
					oidcLayer,
					sigstoreLayer,
					workspaceDiscoveryLayer,
					writingTarSpawner,
					ActionEnvironment.layerTest(),
					makeGitTagLayer().layer,
					release.layer,
					makeAttestationLayer().layer,
					makeArtifactMetadataLayer().layer,
				);

				const result: ReleasesReport = yield* runReleases(args).pipe(Effect.provide(layers));

				// Assert: a group-keyed meta.tgz asset was uploaded as application/gzip.
				expect(result.success).toBe(true);
				const metaUpload = release.uploadCalls.find((c) => /\.npm\.meta\.tgz$/.test(c.name));
				expect(metaUpload).toBeDefined();
				expect(metaUpload?.contentType).toBe("application/gzip");

				// Assert: it surfaces in the release's AssetInfo[] (and carries no
				// attestation — only the primary tarball is attested).
				const releaseResult = result.releases[0];
				expect(releaseResult).toBeDefined();
				if (!releaseResult) return;
				const metaAsset = releaseResult.assets.find((a) => /\.npm\.meta\.tgz$/.test(a.name));
				expect(metaAsset).toBeDefined();
				expect(metaAsset?.attestationUrl).toBeUndefined();
			}),
		);
	});

	describe("GitHub Packages storage record", () => {
		let tmpDir: string;

		beforeEach(() => {
			tmpDir = mkdtempSync(join(tmpdir(), "releases-test-"));
		});

		afterEach(() => {
			rmSync(tmpDir, { recursive: true, force: true });
		});

		it.effect("creates an artifact-metadata storage record for a GitHub Packages target", () =>
			Effect.gen(function* () {
				const tarballPath = join(tmpDir, "pkg.tgz");
				writeFileSync(tarballPath, Buffer.from("fake tarball"));

				const tag = makeGitTagLayer();
				const release = makeGitHubReleaseLayer();
				const artifact = makeArtifactMetadataLayer();

				// A package whose only target is GitHub Packages — triggers the
				// createStorageRecord path.
				const publishResult = makePublishPackagesResult([
					{
						name: "@test/pkg-gh",
						version: "5.0.0",
						targets: [
							{
								target: {
									protocol: "npm" as const,
									registry: "https://npm.pkg.github.com/",
									directory: tmpDir,
									access: "public" as const,
									provenance: true,
									tag: "latest" as const,
									tokenEnv: null,
								},
								success: true,
								tarballPath,
								tarballDigest: `sha256:${DIGEST_HEX}`,
							},
						],
					},
				]);

				const args: ReleasesInputArgs = {
					tags: [makeTag("v5.0.0", "@test/pkg-gh", "5.0.0")],
					publishResult,
					packageManager: "pnpm",
					dryRun: false,
				};

				const layers = Layer.mergeAll(
					baseLayers(),
					tag.layer,
					release.layer,
					makeAttestationLayer().layer,
					artifact.layer,
				);

				const result: ReleasesReport = yield* runReleases(args).pipe(Effect.provide(layers));

				expect(result.success).toBe(true);
				expect(tag.createCalls).toHaveLength(1);
				expect(release.createCalls).toHaveLength(1);
				const expectedTarballName = insertGroupToken("pkg.tgz", getGroupId(tmpDir));
				expect(release.uploadCalls.map((c) => c.name)).toContain(expectedTarballName);

				// Assert: a storage record was created, against the ORG, with exactly
				// the fields the endpoint declares — `repository`, not `repo`, and no
				// fabricated `version`.
				expect(artifact.calls).toHaveLength(1);
				const call = artifact.calls[0];
				expect(call).toBeDefined();
				if (!call) return;
				// The org is no longer passed positionally — the service resolves it
				// from `Repo`, like every other resource method.
				expect(call.name).toBe("pkg:npm/@test/pkg-gh@5.0.0");
				expect(call.digest).toBe(`sha256:${DIGEST_HEX}`);
				expect(call.repository).toBe("pkg-gh");
				expect(call.registryUrl).toBe("https://npm.pkg.github.com/");
				expect(call.artifactUrl).toBe("https://github.com/test-owner/pkgs/npm/pkg-gh");
				expect(call).not.toHaveProperty("version");
			}),
		);

		it.effect("does NOT create a storage record for a non-GitHub-Packages target", () =>
			Effect.gen(function* () {
				// Mutation guard for the `classifyRegistry(...) === "github-packages"`
				// branch: the npm-registry default target must not reach the endpoint.
				const tarballPath = join(tmpDir, "pkg.tgz");
				writeFileSync(tarballPath, Buffer.from("fake tarball"));

				const artifact = makeArtifactMetadataLayer();
				const publishResult = makePublishPackagesResult([makePublishResult("@test/pkg-npm", "1.0.0", tarballPath)]);
				const firstTarget = publishResult.packages[0]?.targets[0];
				if (firstTarget) firstTarget.target.directory = tmpDir;

				const args: ReleasesInputArgs = {
					tags: [makeTag("v1.0.0", "@test/pkg-npm", "1.0.0")],
					publishResult,
					packageManager: "pnpm",
					dryRun: false,
				};

				const layers = Layer.mergeAll(
					baseLayers(),
					makeGitTagLayer().layer,
					makeGitHubReleaseLayer().layer,
					makeAttestationLayer().layer,
					artifact.layer,
				);

				const result: ReleasesReport = yield* runReleases(args).pipe(Effect.provide(layers));

				expect(result.success).toBe(true);
				expect(artifact.calls).toHaveLength(0);
			}),
		);

		it.effect("reuses a pre-existing release asset instead of re-uploading", () =>
			Effect.gen(function* () {
				const tarballPath = join(tmpDir, "pkg.tgz");
				writeFileSync(tarballPath, Buffer.from("fake tarball"));

				// makePublishResult sets directory to /tmp/dist/@test/pkg-e, so
				// getGroupId resolves to "pkg-e" and the tarball name is "pkg.pkg-e.tgz".
				const release = makeGitHubReleaseLayer({
					seedAssets: [
						ReleaseAsset.make({
							id: 9,
							name: "pkg.pkg-e.tgz",
							url: "https://github.com/test-owner/test-repo/releases/assets/9",
							size: 4096,
						}),
					],
				});

				const publishResult = makePublishPackagesResult([makePublishResult("@test/pkg-e", "6.0.0", tarballPath)]);

				const args: ReleasesInputArgs = {
					tags: [makeTag("v6.0.0", "@test/pkg-e", "6.0.0")],
					publishResult,
					packageManager: "pnpm",
					dryRun: false,
				};

				const layers = Layer.mergeAll(
					baseLayers(),
					makeGitTagLayer().layer,
					release.layer,
					makeAttestationLayer().layer,
					makeArtifactMetadataLayer().layer,
				);

				const result: ReleasesReport = yield* runReleases(args).pipe(Effect.provide(layers));

				expect(result.success).toBe(true);
				expect(result.releases).toHaveLength(1);

				// Assert: the pre-existing asset was reused — no upload recorded
				expect(release.uploadCalls).toHaveLength(0);

				const releaseResult = result.releases[0];
				expect(releaseResult).toBeDefined();
				if (!releaseResult) return;
				const tarballAsset = releaseResult.assets.find((a) => a.name === "pkg.pkg-e.tgz");
				expect(tarballAsset).toBeDefined();
				expect(tarballAsset?.downloadUrl).toBe("https://github.com/test-owner/test-repo/releases/assets/9");
				expect(tarballAsset?.size).toBe(4096);
			}),
		);
	});
});

describe("meta-folder api lookup", () => {
	const createdDirs: string[] = [];

	afterEach(() => {
		for (const dir of createdDirs) {
			rmSync(dir, { recursive: true, force: true });
		}
		createdDirs.length = 0;
	});

	it("resolves <unscoped>.api.json from the sibling meta/ folder", () => {
		const root = mkdtempSync(join(tmpdir(), "rel-"));
		createdDirs.push(root);
		const pkgDir = join(root, "dist", "prod", "npm", "pkg");
		const metaDir = join(root, "dist", "prod", "npm", "meta");
		mkdirSync(pkgDir, { recursive: true });
		mkdirSync(metaDir, { recursive: true });
		writeFileSync(join(metaDir, "templates.api.json"), "{}", "utf-8");
		expect(metaDirFor(pkgDir)).toBe(metaDir);
		expect(findApiDocFile(pkgDir, "@savvy-web/templates")).toBe(join(metaDir, "templates.api.json"));
	});

	it("returns undefined when the meta api.json is absent", () => {
		const root = mkdtempSync(join(tmpdir(), "rel-"));
		createdDirs.push(root);
		const pkgDir = join(root, "dist", "prod", "npm", "pkg");
		mkdirSync(pkgDir, { recursive: true });
		expect(findApiDocFile(pkgDir, "@savvy-web/templates")).toBeUndefined();
	});
});

describe("copySbomIntoMeta", () => {
	const createdDirs: string[] = [];

	afterEach(() => {
		for (const dir of createdDirs) {
			rmSync(dir, { recursive: true, force: true });
		}
		createdDirs.length = 0;
	});

	it("copies the SBOM into the group's meta/ folder as <unscoped>.sbom.json", () => {
		const root = mkdtempSync(join(tmpdir(), "rel-meta-"));
		createdDirs.push(root);
		const pkgDir = join(root, "dist", "prod", "npm", "pkg");
		const metaDir = join(root, "dist", "prod", "npm", "meta");
		mkdirSync(pkgDir, { recursive: true });
		mkdirSync(metaDir, { recursive: true });
		const sbomPath = join(root, "templates.sbom.json");
		writeFileSync(sbomPath, '{"bomFormat":"CycloneDX"}', "utf-8");

		copySbomIntoMeta(sbomPath, pkgDir);

		const dest = join(metaDir, "templates.sbom.json");
		expect(existsSync(dest)).toBe(true);
		expect(readFileSync(dest, "utf-8")).toBe('{"bomFormat":"CycloneDX"}');
	});

	it("is a no-op when the meta folder does not exist (non-bundler package)", () => {
		const root = mkdtempSync(join(tmpdir(), "rel-meta-"));
		createdDirs.push(root);
		const pkgDir = join(root, "dist", "dev", "pkg");
		mkdirSync(pkgDir, { recursive: true });
		const sbomPath = join(root, "x.sbom.json");
		writeFileSync(sbomPath, "{}", "utf-8");
		expect(() => copySbomIntoMeta(sbomPath, pkgDir)).not.toThrow();
		expect(existsSync(join(root, "dist", "dev", "meta", "x.sbom.json"))).toBe(false);
	});
});
