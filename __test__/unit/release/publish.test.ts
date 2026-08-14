/**
 * Unit tests for the Phase-3 publish flow.
 *
 * Covers the three functions that replaced the former `runPublish`:
 *
 *  - `detectReleases`    — detection from a merged PR / commit diff.
 *  - `runBuildAndSbom`   — the build-and-SBOM gate.
 *  - `runPublishTargets` — target resolution, topo-sort, and publishing.
 *
 * Everything is provided through kit test seams; no real filesystem (except
 * temp files), registry, subprocess, GitHub API or Sigstore traffic is
 * exercised. Unstubbed kit members **die** rather than answering, so a test
 * that goes red because something was never scripted is a finding.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it, vi } from "@effect/vitest";
import { ScriptedSpawner } from "@effected/commands";
import type { AttestationShape } from "@effected/github";
import {
	Attestation,
	AttestationListEntry,
	AttestationRecord,
	CommitFile,
	CommitSummary,
	GitHubCommit,
	GitHubContent,
	PullRequest,
	PullRequestInfo,
	Repo,
	RepoRef,
} from "@effected/github";
import {
	ActionEnvironment,
	ActionLogger,
	ActionOutputs,
	ActionState,
	OidcTokenError,
	OidcTokenIssuer,
} from "@effected/github-actions";
import type { PackagePublishShape, PublishOptions } from "@effected/npm";
import { NpmRegistry, PackagePublish, PackedTarball, PublishError } from "@effected/npm";
import { SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE, SigstoreBundle, SigstoreSigner } from "@effected/sbom";
import { PublishTarget, PublishabilityDetector, WorkspaceDiscovery, WorkspacePackage } from "@effected/workspaces";
import { ConfigProvider, Effect, Layer, Option, Redacted } from "effect";
import { ChangesetConfig } from "../../../src/release/changeset-config.js";
import type { BuildSbomResult, DetectedRelease, PublishInputArgs } from "../../../src/release/publish.js";
import { detectReleases, runBuildAndSbom, runPublishTargets, userNpmrcPath } from "../../../src/release/publish.js";
import type { PublishPackagesResult } from "../../../src/release/types.js";
import { matchesIgnorePattern } from "../../../src/utils/detect-repo-type.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

/**
 * Run an async effect-based operation with the process cwd temporarily changed.
 *
 * Restores the cwd even if the promise rejects.
 */
async function runInCwd<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
	const savedCwd = process.cwd();
	process.chdir(cwd);
	try {
		return await fn();
	} finally {
		process.chdir(savedCwd);
	}
}

/** Build a minimal WorkspacePackage for tests. */
const makeWsPkg = (name: string, version = "1.0.0", path = `/tmp/test/${name}`): WorkspacePackage =>
	WorkspacePackage.make({
		name,
		version,
		path,
		packageJsonPath: `${path}/package.json`,
		relativePath: name,
		workspaceRoot: "/tmp/test",
	});

/** Build a minimal npm PublishTarget. */
const makeNpmTarget = (name: string, directory = "/tmp/dist"): PublishTarget =>
	new PublishTarget({
		name,
		registry: "https://registry.npmjs.org/",
		directory,
		access: "public",
		provenance: false,
	});

/** Build a `DetectedRelease` for tests (the decoupled detection result). */
const makeDetected = (name: string, version = "1.0.0", path = `/tmp/test/${name}`): DetectedRelease => ({
	name,
	version,
	path,
});

/** Build a WorkspaceDiscovery test layer returning the given packages. */
const makeWorkspaceDiscoveryLayer = (packages: WorkspacePackage[]): Layer.Layer<WorkspaceDiscovery> =>
	Layer.succeed(WorkspaceDiscovery, {
		info: () => Effect.die(new Error("info() not stubbed")),
		listPackages: () => Effect.succeed(packages as ReadonlyArray<WorkspacePackage>),
		getPackage: (name: string) => {
			const found = packages.find((p) => p.name === name);
			if (!found) return Effect.die(new Error(`Package not found: ${name}`));
			return Effect.succeed(found);
		},
		importerMap: () =>
			Effect.succeed(new Map(packages.map((p) => [p.relativePath, p])) as ReadonlyMap<string, WorkspacePackage>),
		resolveFile: () => Effect.succeed(Option.none()),
		resolveFiles: () => Effect.succeed([] as ReadonlyArray<WorkspacePackage>),
		refresh: () => Effect.void,
	});

/** Build a PublishabilityDetector test layer returning targets per package name. */
const makePublishabilityLayer = (targetsByName: Map<string, PublishTarget[]>): Layer.Layer<PublishabilityDetector> =>
	Layer.succeed(PublishabilityDetector, {
		detect: (pkg: WorkspacePackage) =>
			Effect.succeed((targetsByName.get(pkg.name) ?? []) as ReadonlyArray<PublishTarget>),
	});

const repoLayer = Layer.succeed(Repo, RepoRef.make({ owner: "test-owner", repo: "test-repo" }));

/** A minimal merged release PR. `headSha`/`baseSha` are required fields. */
const prInfo = (number: number, baseSha: string): PullRequestInfo =>
	PullRequestInfo.make({
		number,
		nodeId: `PR_node_${number}`,
		url: `https://github.com/test-owner/test-repo/pull/${number}`,
		title: `Release PR #${number}`,
		state: "closed",
		head: "changeset-release/main",
		headSha: "head-sha-abc",
		base: "main",
		baseSha,
		draft: false,
		merged: true,
		mergedAt: Option.none(),
		mergeCommitSha: "merge-sha",
	});

/**
 * A `GitHubContent` double answering base-branch file text, keyed by
 * `` `${ref}:${path}` ``.
 */
const makeContentLayer = (files: ReadonlyMap<string, string>): Layer.Layer<GitHubContent> =>
	GitHubContent.layerTest({
		getFileOption: (path, options) => {
			const found = files.get(`${options?.ref ?? ""}:${path}`);
			return Effect.succeed(found === undefined ? Option.none() : Option.some(found));
		},
	});

/**
 * Build test layers that simulate `detectFromPR` responses.
 *
 * @remarks
 * Entirely on `PullRequest` now. This helper used to drive
 * `GitHubClient.layerFixture` against two raw routes, because `listFiles`
 * dropped each file's `status` and `PullRequestInfo` had no base sha. Both are
 * first-class fields, so the double is the resource service.
 */
const makeLayerForPR = (
	prNumber: number,
	packages: Array<{ name: string; newVersion: string; oldVersion: string; filename: string }>,
): { layer: Layer.Layer<GitHubCommit | GitHubContent | PullRequest | Repo>; tmpCwd: string } => {
	const tmpCwd = join(tmpdir(), `silk-publish-test-${prNumber}-${Date.now()}`);
	mkdirSync(tmpCwd, { recursive: true });

	const baseSha = "base-sha-abc";
	const contentFiles = new Map<string, string>();

	const files = packages.map((pkg) => {
		const dir = join(tmpCwd, ...pkg.filename.split("/").slice(0, -1));
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(tmpCwd, pkg.filename), JSON.stringify({ name: pkg.name, version: pkg.newVersion }));
		contentFiles.set(`${baseSha}:${pkg.filename}`, JSON.stringify({ name: pkg.name, version: pkg.oldVersion }));
		return CommitFile.make({ path: pkg.filename, status: "modified", additions: 1, deletions: 1 });
	});

	return {
		layer: Layer.mergeAll(
			PullRequest.layerTest({
				listFiles: () => Effect.succeed(files),
				get: () => Effect.succeed(prInfo(prNumber, baseSha)),
			}),
			makeContentLayer(contentFiles),
			// `detectReleases` falls back to `detectFromCommit` when the PR path
			// detects nothing, so `GitHubCommit.get` IS reached. It answers a ROOT
			// commit — no parents — which is the honest "nothing to diff against"
			// and makes the fallback return empty rather than inventing a base.
			// `changedFiles` is left unstubbed on purpose: reaching it would mean
			// the early return did not fire, and that should die loudly.
			GitHubCommit.layerTest({
				get: (ref) =>
					Effect.succeed(
						CommitSummary.make({
							sha: ref,
							message: "root",
							author: "Test Author",
							url: `https://github.com/test-owner/test-repo/commit/${ref}`,
							parents: [],
						}),
					),
			}),
			repoLayer,
		),
		tmpCwd,
	};
};

/**
 * Build test layers that simulate `detectFromCommit` responses.
 *
 * @remarks
 * `changedFiles` comes from `GitHubCommit` (which paginates by file); the
 * parent sha comes from a typed route, because `CommitSummary` has no
 * `parents`.
 */
const makeLayerForCommit = (
	sha: string,
	baseSha: string,
	pkg: { name: string; newVersion: string; oldVersion: string; filename: string },
): { layer: Layer.Layer<GitHubCommit | GitHubContent | PullRequest | Repo>; tmpCwd: string } => {
	const tmpCwd = join(tmpdir(), `silk-publish-commit-test-${sha}-${Date.now()}`);
	const dir = join(tmpCwd, ...pkg.filename.split("/").slice(0, -1));
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(tmpCwd, pkg.filename), JSON.stringify({ name: pkg.name, version: pkg.newVersion }));

	const contentFiles = new Map([
		[`${baseSha}:${pkg.filename}`, JSON.stringify({ name: pkg.name, version: pkg.oldVersion })],
	]);

	return {
		layer: Layer.mergeAll(
			GitHubCommit.layerTest({
				// `parents` is a required field on `CommitSummary` now, and its first
				// entry is the base the diff is taken against. This used to need a raw
				// `GET /repos/{owner}/{repo}/commits/{ref}` route.
				get: (ref) =>
					Effect.succeed(
						CommitSummary.make({
							sha: ref,
							message: "chore: release",
							author: "Test Author",
							url: `https://github.com/test-owner/test-repo/commit/${ref}`,
							parents: [baseSha],
						}),
					),
				changedFiles: () =>
					Effect.succeed([CommitFile.make({ path: pkg.filename, status: "modified", additions: 1, deletions: 1 })]),
			}),
			makeContentLayer(contentFiles),
			// The commit path passes `mergedReleasePRNumber: undefined`, so
			// `detectFromPR` is never invoked — a double whose members all die is
			// the correct stand-in, and a call would be the finding.
			PullRequest.layerTest(),
			repoLayer,
		),
		tmpCwd,
	};
};

// ─── Shared "always-on" base layers ──────────────────────────────────────────

const loggerLayer = ActionLogger.layerSilent;
// ActionState carrying a GitHub Packages token.
//
// Not empty, deliberately. The fixtures below publish to
// `https://npm.pkg.github.com/`, and a GitHub Packages target with no token is
// not a state production can reach — OIDC covers npm and JSR, never GitHub
// Packages, which needs the workflow's `secrets.GITHUB_TOKEN` via the
// `github-token` input. An empty state here modelled an impossible case and let
// the missing-credential guard go unexercised by every test that used it.
const actionStateLayer = ActionState.layerTest({
	getOptional: () => Effect.succeed(Option.some({ token: "ghp-fixture-token" })) as never,
});
// Empty ConfigProvider — `npm-token` is absent, Config.option returns None (OIDC path).
const configProviderLayer = ConfigProvider.layer(ConfigProvider.fromUnknown({}));
// Default ChangesetConfig stub: no packages ignored (isIgnored always false).
const changesetConfigDefaultLayer = Layer.succeed(ChangesetConfig, {
	mode: () => Effect.succeed("silk" as const),
	versionPrivate: () => Effect.succeed(false),
	ignorePatterns: () => Effect.succeed([]),
	isIgnored: (_name: string) => Effect.succeed(false),
	fixed: () => Effect.succeed([]),
	refresh: () => Effect.void,
});
const environmentLayer = ActionEnvironment.layerTest();
const outputsLayer = ActionOutputs.layerTest({ setSecret: () => Effect.void });

/**
 * `OidcTokenIssuer` whose `claims` FAILS.
 *
 * @remarks
 * The provenance attestation is best-effort: without `permissions: id-token:
 * write` the exchange cannot happen and the run must still publish. Most tests
 * here take that branch, which is what makes the SBOM-attestation counts below
 * the honest measurement of "did the per-build helper run once".
 */
const oidcUnavailableLayer = OidcTokenIssuer.layerTest({
	claims: () => Effect.fail(new OidcTokenError({ reason: "unavailable" })),
});

/** A `SigstoreSigner` whose `sign` succeeds with a placeholder bundle. */
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

/** Records every attestation upload and list, and answers from a seed. */
const makeAttestationLayer = (
	seeded: ReadonlyArray<{ predicateType: string; url: string }> = [],
): {
	uploads: unknown[];
	listed: Array<{ sha256: string; predicateType: string | undefined }>;
	layer: Layer.Layer<Attestation>;
} => {
	const uploads: unknown[] = [];
	const listed: Array<{ sha256: string; predicateType: string | undefined }> = [];
	const overrides: AttestationShape = {
		upload: (bundle) => {
			uploads.push(bundle);
			return Effect.succeed(
				AttestationRecord.make({
					id: uploads.length,
					url: `https://github.com/test-owner/test-repo/attestations/${uploads.length}`,
				}),
			);
		},
		listForSubject: (sha256, options) => {
			listed.push({ sha256, predicateType: options?.predicateType });
			return Effect.succeed(
				seeded
					.filter((s) => options?.predicateType === undefined || s.predicateType === options.predicateType)
					.map((s) => AttestationListEntry.make({ url: s.url, predicateType: s.predicateType })),
			);
		},
	};
	return { uploads, listed, layer: Attestation.layerTest(overrides) };
};

// ─── Pack fixtures ────────────────────────────────────────────────────────────

const PACK_NAME = "@test/pkg";
const PACK_VERSION = "1.0.0";
const PACK_INTEGRITY = "sha512-AAAA";
/** 64 hex chars — the subject digest every attestation probe uses. */
const SUBJECT_SHA = "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1";

const makePackResult = (integrity: string | undefined = PACK_INTEGRITY): PackedTarball =>
	PackedTarball.make({
		tarballPath: "/tmp/test/pkg-1.0.0.tgz",
		name: PACK_NAME,
		version: PACK_VERSION,
		sha256Hex: SUBJECT_SHA,
		packedSize: 1234,
		unpackedSize: 4321,
		fileCount: 7,
		...(integrity !== undefined ? { integrity } : {}),
	} as Parameters<typeof PackedTarball.make>[0]);

/** A recording `PackagePublish` double. */
const makePackagePublishLayer = (
	options: { readonly packResult?: PackedTarball; readonly packFails?: string; readonly provenanceUrl?: string } = {},
) => {
	const packCalls: string[] = [];
	const publishTarballCalls: Array<{ tarballPath: string; options: PublishOptions }> = [];
	const setupAuthCalls: Array<{ registry: string; npmrcPath: string; token: string }> = [];

	const shape: PackagePublishShape = {
		setupAuth: (input) => {
			setupAuthCalls.push({
				registry: input.registry,
				npmrcPath: input.npmrcPath,
				token: Redacted.value(input.token),
			});
			return Effect.void;
		},
		pack: (packageDir) => {
			packCalls.push(packageDir);
			return options.packFails !== undefined
				? Effect.fail(new PublishError({ kind: "pack", subject: packageDir, output: options.packFails }))
				: Effect.succeed(options.packResult ?? makePackResult());
		},
		publishTarball: (tarballPath, publishOptions) => {
			publishTarballCalls.push({ tarballPath, options: publishOptions });
			return Effect.succeed(options.provenanceUrl === undefined ? {} : { provenanceUrl: options.provenanceUrl });
		},
		dryRun: () => Effect.die(new Error("dryRun is not part of the Phase-3 flow")),
	};

	return { packCalls, publishTarballCalls, setupAuthCalls, layer: PackagePublish.layerTest(shape) };
};

/** A registry seeded with a published version, or empty. */
const makeRegistryLayer = (published?: { integrity?: string }): Layer.Layer<NpmRegistry> =>
	NpmRegistry.layerSeeded({
		registries:
			published === undefined
				? {}
				: {
						"https://registry.npmjs.org/": {
							[PACK_NAME]: {
								[PACK_VERSION]: published.integrity === undefined ? {} : { integrity: published.integrity },
							},
						},
					},
	});

/** The full layer set `runPublishTargets` needs, with the varying pieces injected. */
const makeBaseLayers = (
	pubLayer: Layer.Layer<PackagePublish>,
	npmLayer: Layer.Layer<NpmRegistry>,
	wsPkg: WorkspacePackage,
	targets: PublishTarget[],
	attestationLayer: Layer.Layer<Attestation> = makeAttestationLayer().layer,
) =>
	Layer.mergeAll(
		loggerLayer,
		actionStateLayer,
		configProviderLayer,
		environmentLayer,
		outputsLayer,
		repoLayer,
		pubLayer,
		npmLayer,
		attestationLayer,
		oidcUnavailableLayer,
		sigstoreLayer,
		makeWorkspaceDiscoveryLayer([wsPkg]),
		makePublishabilityLayer(new Map([[wsPkg.name, targets]])),
	);

// ─── userNpmrcPath ────────────────────────────────────────────────────────────

describe("userNpmrcPath", () => {
	// This is the file `npm publish` reads. A wrong value fails at the worst
	// possible moment with an unhelpful error, so it is pinned rather than
	// assumed. `npmrcPath` became caller-supplied when the kit moved `node:os`
	// out of the boundary package.
	it("honours NPM_CONFIG_USERCONFIG when the runner sets one", () => {
		expect(userNpmrcPath({ NPM_CONFIG_USERCONFIG: "/ci/custom/.npmrc" })).toBe("/ci/custom/.npmrc");
	});

	it("falls back to the user home .npmrc when the variable is absent", () => {
		expect(userNpmrcPath({})).toMatch(/[\\/]\.npmrc$/);
	});

	it("treats an empty NPM_CONFIG_USERCONFIG as absent", () => {
		expect(userNpmrcPath({ NPM_CONFIG_USERCONFIG: "" })).toMatch(/[\\/]\.npmrc$/);
	});
});

// ─── detectReleases ───────────────────────────────────────────────────────────

describe("detectReleases", () => {
	const detectionLayers = (ghLayer: Layer.Layer<GitHubCommit | GitHubContent | PullRequest | Repo>) =>
		Layer.mergeAll(ghLayer, loggerLayer, environmentLayer, changesetConfigDefaultLayer);

	describe("detection via the commit diff (detectFromCommit)", () => {
		it("detects packages from the commit's modified package.json files", async () => {
			const sha = "headsha-commit";
			const baseSha = "parentsha-commit";
			const { layer: ghLayer, tmpCwd } = makeLayerForCommit(sha, baseSha, {
				name: "@test/commit-pkg",
				newVersion: "3.0.0",
				oldVersion: "2.0.0",
				filename: "packages/commit-pkg/package.json",
			});

			const args: PublishInputArgs = {
				packageManager: "pnpm",
				targetBranch: "main",
				dryRun: false,
				mergedReleasePRNumber: undefined,
			};

			const detected = await runInCwd(tmpCwd, () =>
				Effect.runPromise(
					detectReleases(args).pipe(
						Effect.provide(detectionLayers(ghLayer)),
						Effect.provide(ActionEnvironment.layerTest({ GITHUB_SHA: sha })),
					),
				),
			);

			expect(detected).toHaveLength(1);
			expect(detected[0]?.name).toBe("@test/commit-pkg");
			expect(detected[0]?.version).toBe("3.0.0");
			expect(detected[0]?.path.endsWith(join("packages", "commit-pkg"))).toBe(true);
		});

		it("does not detect a package when old and new versions are identical", async () => {
			// The base `package.json` version EQUALS the on-disk current version.
			// This is the only scenario that proves the base-version read is
			// consulted — an unseeded content layer would fall back to "0.0.0" and
			// (wrongly) detect a release.
			const sha = "headsha-commit-noop";
			const baseSha = "parentsha-commit-noop";
			const { layer: ghLayer, tmpCwd } = makeLayerForCommit(sha, baseSha, {
				name: "@test/commit-pkg",
				newVersion: "3.0.0",
				oldVersion: "3.0.0",
				filename: "packages/commit-pkg/package.json",
			});

			const args: PublishInputArgs = {
				packageManager: "pnpm",
				targetBranch: "main",
				dryRun: false,
				mergedReleasePRNumber: undefined,
			};

			const detected = await runInCwd(tmpCwd, () =>
				Effect.runPromise(
					detectReleases(args).pipe(
						Effect.provide(detectionLayers(ghLayer)),
						Effect.provide(ActionEnvironment.layerTest({ GITHUB_SHA: sha })),
					),
				),
			);

			expect(detected).toHaveLength(0);
		});
	});

	describe("detection via the merged PR (detectFromPR)", () => {
		it("detects packages from a merged PR", async () => {
			const { layer: ghLayer, tmpCwd } = makeLayerForPR(42, [
				{
					name: "@test/pr-pkg",
					newVersion: "2.0.0",
					oldVersion: "1.0.0",
					filename: "packages/pr-pkg/package.json",
				},
			]);

			const args: PublishInputArgs = {
				packageManager: "pnpm",
				targetBranch: "main",
				dryRun: false,
				mergedReleasePRNumber: 42,
			};

			const detected = await runInCwd(tmpCwd, () =>
				Effect.runPromise(detectReleases(args).pipe(Effect.provide(detectionLayers(ghLayer)))),
			);

			expect(detected).toHaveLength(1);
			expect(detected[0]?.name).toBe("@test/pr-pkg");
			expect(detected[0]?.version).toBe("2.0.0");
		});

		it("does not detect a package when old and new versions are identical", async () => {
			const { layer: ghLayer, tmpCwd } = makeLayerForPR(43, [
				{
					name: "@test/pr-pkg",
					newVersion: "2.0.0",
					oldVersion: "2.0.0",
					filename: "packages/pr-pkg/package.json",
				},
			]);

			const args: PublishInputArgs = {
				packageManager: "pnpm",
				targetBranch: "main",
				dryRun: false,
				mergedReleasePRNumber: 43,
			};

			const detected = await runInCwd(tmpCwd, () =>
				Effect.runPromise(detectReleases(args).pipe(Effect.provide(detectionLayers(ghLayer)))),
			);

			expect(detected).toHaveLength(0);
		});
	});

	describe("changeset-ignored packages are excluded from detection result", () => {
		it("detectReleases drops packages matching the changeset ignore list", async () => {
			const { layer: ghLayer, tmpCwd } = makeLayerForPR(44, [
				{
					name: "@test/kept",
					newVersion: "2.0.0",
					oldVersion: "1.0.0",
					filename: "packages/kept/package.json",
				},
				{
					name: "@test/ignored",
					newVersion: "2.0.0",
					oldVersion: "1.0.0",
					filename: "packages/ignored/package.json",
				},
			]);

			const ignoringConfig = Layer.succeed(ChangesetConfig, {
				mode: () => Effect.succeed("silk" as const),
				versionPrivate: () => Effect.succeed(false),
				ignorePatterns: () => Effect.succeed(["@test/ignored"]),
				isIgnored: (name: string) => Effect.succeed(matchesIgnorePattern(name, "@test/ignored")),
				fixed: () => Effect.succeed([]),
				refresh: () => Effect.void,
			});

			const args: PublishInputArgs = {
				packageManager: "pnpm",
				targetBranch: "main",
				dryRun: false,
				mergedReleasePRNumber: 44,
			};

			const detected = await runInCwd(tmpCwd, () =>
				Effect.runPromise(
					detectReleases(args).pipe(
						Effect.provide(Layer.mergeAll(ghLayer, loggerLayer, environmentLayer, ignoringConfig)),
					),
				),
			);

			expect(detected.map((d) => d.name)).toEqual(["@test/kept"]);
		});
	});
});

// ─── runBuildAndSbom ──────────────────────────────────────────────────────────

describe("runBuildAndSbom", () => {
	const buildArgs: PublishInputArgs = {
		packageManager: "pnpm",
		targetBranch: "main",
		dryRun: false,
		mergedReleasePRNumber: undefined,
	};

	/** A spawner whose `pnpm ci:build` exits with the given code. */
	const buildSpawner = (exit: number, stderr = "") =>
		ScriptedSpawner.make((command) =>
			command === "pnpm" ? { exit, stdout: "build ok", stderr } : ScriptedSpawner.notFound(command),
		).layer;

	describe("build step", () => {
		it.effect("returns buildError and ok: false when ci:build fails", () =>
			Effect.gen(function* () {
				const pkg = makeWsPkg("@test/build-fail", "1.0.0");
				const detected: DetectedRelease[] = [makeDetected("@test/build-fail", "1.0.0", pkg.path)];

				// `NodeServices.layer` provides `FileSystem` for `Sbom.write` — and ALSO
				// a real `ChildProcessSpawner`. The scripted spawner is merged LAST so
				// it wins; merged first, the suite silently shells out to a real
				// `pnpm ci:build` (3.5s per test, and a green that proves nothing).
				const layers = Layer.mergeAll(
					loggerLayer,
					NodeServices.layer,
					makeWorkspaceDiscoveryLayer([pkg]),
					buildSpawner(1, "Build failed: compile error"),
				);

				const result: BuildSbomResult = yield* runBuildAndSbom(detected, buildArgs).pipe(Effect.provide(layers));

				expect(result.ok).toBe(false);
				expect(result.buildError).toMatch(/Build failed/);
				expect(result.sbomFailures).toHaveLength(0);
				expect(result.packageCount).toBe(1);
			}),
		);
	});

	describe("happy path", () => {
		it.effect("returns ok: true with no SBOM failures when build and every SBOM write succeed", () =>
			Effect.gen(function* () {
				// Real temp dirs so `Sbom.write` succeeds and `sbomPaths` populates.
				const tmpRoot = join(tmpdir(), `silk-sbom-save-test-${Date.now()}`);
				const pkgAPath = join(tmpRoot, "sbom-a");
				const pkgBPath = join(tmpRoot, "sbom-b");
				mkdirSync(pkgAPath, { recursive: true });
				mkdirSync(pkgBPath, { recursive: true });

				const pkgA = makeWsPkg("@test/sbom-a", "1.0.0", pkgAPath);
				const pkgB = makeWsPkg("@test/sbom-b", "2.0.0", pkgBPath);
				const detected: DetectedRelease[] = [
					makeDetected("@test/sbom-a", "1.0.0", pkgA.path),
					makeDetected("@test/sbom-b", "2.0.0", pkgB.path),
				];

				const layers = Layer.mergeAll(
					loggerLayer,
					NodeServices.layer,
					makeWorkspaceDiscoveryLayer([pkgA, pkgB]),
					buildSpawner(0),
				);

				const result: BuildSbomResult = yield* runBuildAndSbom(detected, buildArgs).pipe(Effect.provide(layers));

				expect(result.ok).toBe(true);
				expect(result.sbomFailures).toHaveLength(0);
				expect(result.buildError).toBeUndefined();
				expect(result.packageCount).toBe(detected.length);
				expect(result.sbomPaths.get("@test/sbom-a")).toBe(join(pkgAPath, "sbom-a.sbom.json"));
				expect(result.sbomPaths.get("@test/sbom-b")).toBe(join(pkgBPath, "sbom-b.sbom.json"));
			}),
		);

		it.effect("keeps ok: true and only lists the package when the SBOM WRITE fails", () =>
			Effect.gen(function* () {
				// The predecessor's test failed `Sbom.generate`. That is no longer
				// expressible: `Sbom.generate` and `Sbom.toJson` are **total**, and
				// `SbomError` does not exist. `Sbom.write` is the one fallible member —
				// it does not create parent directories, so a package whose path does
				// not exist is the genuine remaining failure mode, and this proves it
				// reaches `sbomFailures`.
				const tmpRoot = join(tmpdir(), `silk-sbom-write-fail-${Date.now()}`);
				const goodPath = join(tmpRoot, "sbom-good");
				mkdirSync(goodPath, { recursive: true });
				const badPath = join(tmpRoot, "does", "not", "exist");

				const pkgGood = makeWsPkg("@test/sbom-good", "1.0.0", goodPath);
				const pkgBad = makeWsPkg("@test/sbom-bad", "1.0.0", badPath);
				const detected: DetectedRelease[] = [
					makeDetected("@test/sbom-good", "1.0.0", pkgGood.path),
					makeDetected("@test/sbom-bad", "1.0.0", pkgBad.path),
				];

				const layers = Layer.mergeAll(
					loggerLayer,
					NodeServices.layer,
					makeWorkspaceDiscoveryLayer([pkgGood, pkgBad]),
					buildSpawner(0),
				);

				const result: BuildSbomResult = yield* runBuildAndSbom(detected, buildArgs).pipe(Effect.provide(layers));

				// `ok` stays TRUE. This is the load-bearing half of the assertion:
				// `runPublishing` treats `!ok` as a fail-fast gate that aborts Phase 3
				// and fails the workflow with `PublishError`. Folding an SBOM write
				// failure into `ok` meant an unwritable package directory blocked a
				// release whose build had succeeded — contradicting both this function's
				// own remark ("stays non-fatal") and its warning ("release asset will be
				// skipped"). The write failure costs the release its SBOM asset, nothing
				// more.
				expect(result.ok).toBe(true);
				expect(result.sbomFailures).toEqual(["@test/sbom-bad"]);
				expect(result.buildError).toBeUndefined();
				expect(result.packageCount).toBe(detected.length);
				// The good package still wrote its SBOM — one failure does not abort.
				expect(result.sbomPaths.get("@test/sbom-good")).toBe(join(goodPath, "sbom-good.sbom.json"));
				// ...and the failing package has no asset path, which is how the release
				// step knows to skip it.
				expect(result.sbomPaths.has("@test/sbom-bad")).toBe(false);
			}),
		);
	});
});

// ─── runPublishTargets ────────────────────────────────────────────────────────

describe("runPublishTargets", () => {
	describe("first-publish path (version absent from registry)", () => {
		it.effect("packs once, probes the target registry, and publishes the tarball to it", () =>
			Effect.gen(function* () {
				const pub = makePackagePublishLayer();
				const wsPkg = makeWsPkg(PACK_NAME, PACK_VERSION, `/tmp/test/${PACK_NAME}`);
				const target = makeNpmTarget(PACK_NAME, `/tmp/test/${PACK_NAME}`);
				const detected: DetectedRelease[] = [makeDetected(PACK_NAME, PACK_VERSION, wsPkg.path)];

				const result: PublishPackagesResult = yield* runPublishTargets(detected).pipe(
					Effect.provide(makeBaseLayers(pub.layer, makeRegistryLayer(), wsPkg, [target])),
				);

				expect(result.success).toBe(true);
				expect(result.packages).toHaveLength(1);
				expect(pub.packCalls).toHaveLength(1);
				expect(pub.publishTarballCalls).toHaveLength(1);

				// The published-to registry matches the target's registry (not the default).
				expect(pub.publishTarballCalls[0]?.options.registry).toBe(target.registry);

				const targetResult = result.packages[0]?.targets[0];
				expect(targetResult?.status).toBe("published");
				expect(targetResult?.success).toBe(true);
				expect(targetResult?.skipReason).toBeUndefined();
				expect(targetResult?.recovery).toBeUndefined();
			}),
		);

		it.effect("packs and publishes through the pinned npm@11 dlx executor, never the ambient npm", () =>
			Effect.gen(function* () {
				// The pin is what makes OIDC trusted publishing possible at all: runners
				// ship npm 10.x, which cannot do it, and npm 12's publish is broken.
				const pub = makePackagePublishLayer();
				const wsPkg = makeWsPkg(PACK_NAME, PACK_VERSION, `/tmp/test/${PACK_NAME}`);
				const target = makeNpmTarget(PACK_NAME, `/tmp/test/${PACK_NAME}`);
				const detected: DetectedRelease[] = [makeDetected(PACK_NAME, PACK_VERSION, wsPkg.path)];

				yield* runPublishTargets(detected).pipe(
					Effect.provide(makeBaseLayers(pub.layer, makeRegistryLayer(), wsPkg, [target])),
				);

				const executor = pub.publishTarballCalls[0]?.options.executor;
				expect(executor).toBeDefined();
				expect(JSON.stringify(executor)).toContain("npm@11");
			}),
		);

		// NOT `it.effect`: this test spies on the real `console.log` to assert on
		// `ActionLogger`'s rendered publish tree. `it.effect` installs
		// `TestConsole`, which intercepts the same `ConsoleRef` the logger writes
		// through, so the spy captures nothing and the render assertions go red.
		it("renders the rich publish tree (icons, registry rows, npm-native provenance) and threads the URL onto the result", async () => {
			const provUrl = "https://search.sigstore.dev/?logIndex=1822519034";
			const pub = makePackagePublishLayer({ provenanceUrl: provUrl });
			const wsPkg = makeWsPkg(PACK_NAME, PACK_VERSION, `/tmp/test/${PACK_NAME}`);
			const target = makeNpmTarget(PACK_NAME, `/tmp/test/${PACK_NAME}`);
			const detected: DetectedRelease[] = [makeDetected(PACK_NAME, PACK_VERSION, wsPkg.path)];

			// The REAL `ActionLogger` renders through core `Console`; the silent
			// double would make the render assertions vacuous.
			const captured: string[] = [];
			const logSpy = vi.spyOn(console, "log").mockImplementation((...parts: unknown[]) => {
				captured.push(parts.map((p) => (typeof p === "string" ? p : String(p))).join(" "));
			});

			let result: PublishPackagesResult;
			try {
				result = await Effect.runPromise(
					runPublishTargets(detected).pipe(
						Effect.provide(
							Layer.mergeAll(
								actionStateLayer,
								configProviderLayer,
								environmentLayer,
								outputsLayer,
								repoLayer,
								pub.layer,
								makeRegistryLayer(),
								makeAttestationLayer().layer,
								oidcUnavailableLayer,
								sigstoreLayer,
								makeWorkspaceDiscoveryLayer([wsPkg]),
								makePublishabilityLayer(new Map([[wsPkg.name, [target]]])),
								ActionLogger.layer.pipe(Layer.provide(environmentLayer)),
							),
						),
						Effect.provide(ActionLogger.layerLogger),
					),
				);
			} finally {
				logSpy.mockRestore();
			}

			const out = captured.join("\n");
			expect(out).toContain("📦 pack:");
			expect(out).toContain("⬆ npm · published · registry.npmjs.org");
			expect(out).toContain(`🔏 provenance: ${provUrl} (npm native)`);
			expect(out).toContain("Publish · @test/pkg@1.0.0");

			// The URL is also threaded onto the structured target result — through
			// `Option.isSome`, not a `!== undefined` check that would always be true.
			expect(result.packages[0]?.targets[0]?.npmProvenanceUrl).toBe(provUrl);
		});
	});

	describe("skipped-identical recovery", () => {
		it.effect(
			"records skipReason: 'already-published-identical' and never publishes when the registry has matching integrity",
			() =>
				Effect.gen(function* () {
					const pub = makePackagePublishLayer();
					const wsPkg = makeWsPkg(PACK_NAME, PACK_VERSION, `/tmp/test/${PACK_NAME}`);
					const target = makeNpmTarget(PACK_NAME, `/tmp/test/${PACK_NAME}`);
					const detected: DetectedRelease[] = [makeDetected(PACK_NAME, PACK_VERSION, wsPkg.path)];

					const result: PublishPackagesResult = yield* runPublishTargets(detected).pipe(
						Effect.provide(
							makeBaseLayers(pub.layer, makeRegistryLayer({ integrity: PACK_INTEGRITY }), wsPkg, [target]),
						),
					);

					expect(result.success).toBe(true);
					expect(pub.packCalls).toHaveLength(1);
					expect(pub.publishTarballCalls).toHaveLength(0);

					const targetResult = result.packages[0]?.targets[0];
					expect(targetResult?.status).toBe("skipped");
					expect(targetResult?.success).toBe(true);
					expect(targetResult?.skipReason).toBe("already-published-identical");
					expect(targetResult?.recovery).toEqual({ localDigest: PACK_INTEGRITY, remoteDigest: PACK_INTEGRITY });
				}),
		);
	});

	describe("failed-mismatch", () => {
		it.effect(
			"records status: 'failed' with a recovery digest pair and a 'mismatch' message when integrity differs",
			() =>
				Effect.gen(function* () {
					const REMOTE_INTEGRITY = "sha512-BBBB";
					const pub = makePackagePublishLayer();
					const wsPkg = makeWsPkg(PACK_NAME, PACK_VERSION, `/tmp/test/${PACK_NAME}`);
					const target = makeNpmTarget(PACK_NAME, `/tmp/test/${PACK_NAME}`);
					const detected: DetectedRelease[] = [makeDetected(PACK_NAME, PACK_VERSION, wsPkg.path)];

					const result: PublishPackagesResult = yield* runPublishTargets(detected).pipe(
						Effect.provide(
							makeBaseLayers(pub.layer, makeRegistryLayer({ integrity: REMOTE_INTEGRITY }), wsPkg, [target]),
						),
					);

					expect(result.success).toBe(false);
					expect(pub.packCalls).toHaveLength(1);
					expect(pub.publishTarballCalls).toHaveLength(0);

					const targetResult = result.packages[0]?.targets[0];
					expect(targetResult?.status).toBe("failed");
					expect(targetResult?.success).toBe(false);
					expect(targetResult?.recovery).toEqual({ localDigest: PACK_INTEGRITY, remoteDigest: REMOTE_INTEGRITY });
					expect(targetResult?.error).toMatch(/mismatch/i);
					expect(targetResult?.error).toContain(PACK_INTEGRITY);
					expect(targetResult?.error).toContain(REMOTE_INTEGRITY);
				}),
		);

		it.effect("fails rather than claiming 'identical' when the registry reports no integrity", () =>
			Effect.gen(function* () {
				// A branch the predecessor could not have: `PublishedVersion.integrity`
				// is an optional key, so "the version is there but we cannot prove the
				// bytes match" is now representable. Calling it identical without proof
				// would be a lie; publishing over it would fail anyway.
				const pub = makePackagePublishLayer();
				const wsPkg = makeWsPkg(PACK_NAME, PACK_VERSION, `/tmp/test/${PACK_NAME}`);
				const target = makeNpmTarget(PACK_NAME, `/tmp/test/${PACK_NAME}`);
				const detected: DetectedRelease[] = [makeDetected(PACK_NAME, PACK_VERSION, wsPkg.path)];

				const result: PublishPackagesResult = yield* runPublishTargets(detected).pipe(
					Effect.provide(makeBaseLayers(pub.layer, makeRegistryLayer({}), wsPkg, [target])),
				);

				expect(result.success).toBe(false);
				expect(pub.publishTarballCalls).toHaveLength(0);
				const targetResult = result.packages[0]?.targets[0];
				expect(targetResult?.status).toBe("failed");
				expect(targetResult?.error).toContain("not reported by the registry");
			}),
		);
	});

	describe("pack-once per directory", () => {
		it.effect("calls pack exactly once when two targets share the same build directory", () =>
			Effect.gen(function* () {
				const SHARED_DIR = `/tmp/test/${PACK_NAME}`;
				const pub = makePackagePublishLayer();
				const wsPkg = makeWsPkg(PACK_NAME, PACK_VERSION, SHARED_DIR);
				const targetA = new PublishTarget({
					name: PACK_NAME,
					registry: "https://registry.npmjs.org/",
					directory: SHARED_DIR,
					access: "public",
					provenance: false,
				});
				const targetB = new PublishTarget({
					name: PACK_NAME,
					registry: "https://npm.pkg.github.com/",
					directory: SHARED_DIR,
					access: "public",
					provenance: false,
				});
				const detected: DetectedRelease[] = [makeDetected(PACK_NAME, PACK_VERSION, wsPkg.path)];

				const result: PublishPackagesResult = yield* runPublishTargets(detected).pipe(
					Effect.provide(makeBaseLayers(pub.layer, makeRegistryLayer(), wsPkg, [targetA, targetB])),
				);

				expect(pub.packCalls).toHaveLength(1);
				expect(pub.publishTarballCalls).toHaveLength(2);
				expect(result.packages[0]?.targets).toHaveLength(2);
			}),
		);

		it.effect("names the missing github-token rather than letting it surface as a 403", () =>
			Effect.gen(function* () {
				// The production failure this guard replaces: savvy-web/systems run
				// 30228332922 emitted four identical "integrity probe failed — status
				// 403" lines, which read as a packages-permission problem rather than a
				// missing input. The App installation token is not a substitute for
				// GitHub Packages, so an absent token can only mean the input is absent.
				const pub = makePackagePublishLayer();
				const wsPkg = makeWsPkg(PACK_NAME, PACK_VERSION, `/tmp/test/${PACK_NAME}`);
				const target = new PublishTarget({
					name: PACK_NAME,
					registry: "https://npm.pkg.github.com/",
					directory: `/tmp/test/${PACK_NAME}`,
					access: "public",
					provenance: false,
				});
				const detected: DetectedRelease[] = [makeDetected(PACK_NAME, PACK_VERSION, wsPkg.path)];

				const noToken = ActionState.layerTest({ getOptional: () => Effect.succeed(Option.none()) });

				const result: PublishPackagesResult = yield* runPublishTargets(detected).pipe(
					Effect.provide(
						Layer.mergeAll(
							makeBaseLayers(pub.layer, makeRegistryLayer(), wsPkg, [target]),
							// Merged last so it wins over the credentialed default.
							noToken,
						),
					),
				);

				expect(result.success).toBe(false);
				expect(result.packages[0]?.targets[0]?.error).toContain("no github-token input");
				// It must not have tried: no auth setup, no publish.
				expect(pub.setupAuthCalls).toHaveLength(0);
				expect(pub.publishTarballCalls).toHaveLength(0);
			}),
		);

		it.effect("writes each registry's token to the resolved npmrc before publishing", () =>
			Effect.gen(function* () {
				// GitHub Packages requires token auth; the npmrc is the file npm reads.
				const pub = makePackagePublishLayer();
				const wsPkg = makeWsPkg(PACK_NAME, PACK_VERSION, `/tmp/test/${PACK_NAME}`);
				const target = new PublishTarget({
					name: PACK_NAME,
					registry: "https://npm.pkg.github.com/",
					directory: `/tmp/test/${PACK_NAME}`,
					access: "public",
					provenance: false,
				});
				const detected: DetectedRelease[] = [makeDetected(PACK_NAME, PACK_VERSION, wsPkg.path)];

				const withToken = ActionState.layerTest({
					getOptional: () => Effect.succeed(Option.some({ token: "ghp-test-token" })) as never,
				});

				yield* runPublishTargets(detected).pipe(
					Effect.provide(
						Layer.mergeAll(
							makeBaseLayers(pub.layer, makeRegistryLayer(), wsPkg, [target]),
							// Merged last so it wins over the empty state above.
							withToken,
						),
					),
				);

				expect(pub.setupAuthCalls).toHaveLength(1);
				expect(pub.setupAuthCalls[0]?.registry).toBe("https://npm.pkg.github.com/");
				expect(pub.setupAuthCalls[0]?.token).toBe("ghp-test-token");
				expect(pub.setupAuthCalls[0]?.npmrcPath).toBe(userNpmrcPath());
			}),
		);
	});

	describe("custom-registry auth (issue #215)", () => {
		// THE regression tests for issue #215. The `custom-registries` input was
		// decoded and consumed by nothing from #90 (v0.2.3) through four minor
		// releases — every structural guard stayed green while the configured
		// token reached no npmrc. These assert the restored behavior END TO END
		// at the seam that matters: the token handed to `runPublishTargets` must
		// come back out of `PackagePublish.setupAuth` for the custom registry.
		// A test at this seam in 2026-05 would have failed the #90 migration.

		it.effect("routes a configured custom-registries token into the custom registry's npmrc auth", () =>
			Effect.gen(function* () {
				const CUSTOM_REGISTRY = "https://registry.example.com/";
				const pub = makePackagePublishLayer();
				const wsPkg = makeWsPkg(PACK_NAME, PACK_VERSION, `/tmp/test/${PACK_NAME}`);
				const target = new PublishTarget({
					name: PACK_NAME,
					registry: CUSTOM_REGISTRY,
					directory: `/tmp/test/${PACK_NAME}`,
					access: "restricted",
					provenance: false,
				});
				const detected: DetectedRelease[] = [makeDetected(PACK_NAME, PACK_VERSION, wsPkg.path)];

				yield* runPublishTargets(detected, new Map(), [
					{ registry: CUSTOM_REGISTRY, token: Redacted.make("custom-registry-token") },
				]).pipe(Effect.provide(makeBaseLayers(pub.layer, makeRegistryLayer(), wsPkg, [target])));

				// The configured token reached the npmrc write for the custom host…
				expect(pub.setupAuthCalls).toHaveLength(1);
				expect(pub.setupAuthCalls[0]?.registry).toBe(CUSTOM_REGISTRY);
				expect(pub.setupAuthCalls[0]?.token).toBe("custom-registry-token");
				expect(pub.setupAuthCalls[0]?.npmrcPath).toBe(userNpmrcPath());
				// …and the publish itself proceeded against that registry.
				expect(pub.publishTarballCalls).toHaveLength(1);
				expect(pub.publishTarballCalls[0]?.options.registry).toBe(CUSTOM_REGISTRY);
			}),
		);

		it.effect("does not send the custom token to other registries, nor other tokens to the custom host", () =>
			Effect.gen(function* () {
				// Credential isolation across a mixed target set: npm keeps its token,
				// the custom host gets exactly its configured one.
				const CUSTOM_REGISTRY = "https://registry.example.com/";
				const SHARED_DIR = `/tmp/test/${PACK_NAME}`;
				const pub = makePackagePublishLayer();
				const wsPkg = makeWsPkg(PACK_NAME, PACK_VERSION, SHARED_DIR);
				const npmTarget = makeNpmTarget(PACK_NAME, SHARED_DIR);
				const customTarget = new PublishTarget({
					name: PACK_NAME,
					registry: CUSTOM_REGISTRY,
					directory: SHARED_DIR,
					access: "restricted",
					provenance: false,
				});
				const detected: DetectedRelease[] = [makeDetected(PACK_NAME, PACK_VERSION, wsPkg.path)];

				yield* runPublishTargets(detected, new Map(), [
					{ registry: CUSTOM_REGISTRY, token: Redacted.make("custom-registry-token") },
				]).pipe(Effect.provide(makeBaseLayers(pub.layer, makeRegistryLayer(), wsPkg, [npmTarget, customTarget])));

				const byRegistry = new Map(pub.setupAuthCalls.map((call) => [call.registry, call.token]));
				expect(byRegistry.get(CUSTOM_REGISTRY)).toBe("custom-registry-token");
				expect(byRegistry.get("https://registry.npmjs.org/")).not.toBe("custom-registry-token");
			}),
		);
	});

	describe("attestation hoisted out of the per-target loop", () => {
		it.effect("fires attestation exactly ONCE per build directory and shares the URL across both targets", () =>
			Effect.gen(function* () {
				const SHARED_DIR = `/tmp/test/${PACK_NAME}`;
				const pub = makePackagePublishLayer();
				const attestation = makeAttestationLayer();

				const wsPkg = makeWsPkg(PACK_NAME, PACK_VERSION, SHARED_DIR);
				const targetA = new PublishTarget({
					name: PACK_NAME,
					registry: "https://registry.npmjs.org/",
					directory: SHARED_DIR,
					access: "public",
					provenance: true,
				});
				const targetB = new PublishTarget({
					name: PACK_NAME,
					registry: "https://npm.pkg.github.com/",
					directory: SHARED_DIR,
					access: "public",
					provenance: true,
				});
				const detected: DetectedRelease[] = [makeDetected(PACK_NAME, PACK_VERSION, wsPkg.path)];

				const result: PublishPackagesResult = yield* runPublishTargets(detected).pipe(
					Effect.provide(makeBaseLayers(pub.layer, makeRegistryLayer(), wsPkg, [targetA, targetB], attestation.layer)),
				);

				// Exactly ONE upload regardless of two targets. The provenance half is
				// skipped because `claims` fails here, so this counts the SBOM
				// attestation — which is the measurement that proves the helper ran
				// once per build rather than once per target.
				expect(attestation.uploads).toHaveLength(1);

				const targets = result.packages[0]?.targets ?? [];
				expect(targets).toHaveLength(2);
				expect(targets[0]?.success).toBe(true);
				expect(targets[1]?.success).toBe(true);
				expect(targets[0]?.sbomAttestationUrl).toBe(targets[1]?.sbomAttestationUrl);
				expect(targets[0]?.sbomAttestationUrl).toBeDefined();
			}),
		);

		it.effect("does NOT attest when every target in the group has provenance: false", () =>
			Effect.gen(function* () {
				const SHARED_DIR = `/tmp/test/${PACK_NAME}`;
				const pub = makePackagePublishLayer();
				const attestation = makeAttestationLayer();

				const wsPkg = makeWsPkg(PACK_NAME, PACK_VERSION, SHARED_DIR);
				const targetA = new PublishTarget({
					name: PACK_NAME,
					registry: "https://registry.npmjs.org/",
					directory: SHARED_DIR,
					access: "public",
					provenance: false,
				});
				const targetB = new PublishTarget({
					name: PACK_NAME,
					registry: "https://npm.pkg.github.com/",
					directory: SHARED_DIR,
					access: "public",
					provenance: false,
				});
				const detected: DetectedRelease[] = [makeDetected(PACK_NAME, PACK_VERSION, wsPkg.path)];

				yield* runPublishTargets(detected).pipe(
					Effect.provide(makeBaseLayers(pub.layer, makeRegistryLayer(), wsPkg, [targetA, targetB], attestation.layer)),
				);

				expect(attestation.uploads).toHaveLength(0);
				expect(attestation.listed).toHaveLength(0);
			}),
		);

		it.effect("stamps the per-package sbomPath onto every successful target's result", () =>
			Effect.gen(function* () {
				const pub = makePackagePublishLayer();
				const wsPkg = makeWsPkg(PACK_NAME, PACK_VERSION, `/tmp/test/${PACK_NAME}`);
				const target = makeNpmTarget(PACK_NAME, `/tmp/test/${PACK_NAME}`);
				const detected: DetectedRelease[] = [makeDetected(PACK_NAME, PACK_VERSION, wsPkg.path)];

				const SBOM_PATH = `/tmp/test/${PACK_NAME}/pkg.sbom.json`;
				const sbomPaths = new Map<string, string>([[PACK_NAME, SBOM_PATH]]);

				const result: PublishPackagesResult = yield* runPublishTargets(detected, sbomPaths).pipe(
					Effect.provide(makeBaseLayers(pub.layer, makeRegistryLayer(), wsPkg, [target])),
				);

				const targetResult = result.packages[0]?.targets[0];
				expect(targetResult?.success).toBe(true);
				expect(targetResult?.sbomPath).toBe(SBOM_PATH);
			}),
		);
	});

	describe("attestation idempotency — skip when already attested", () => {
		const SLSA_PROVENANCE_V1 = "https://slsa.dev/provenance/v1";
		const CYCLONEDX_BOM = "https://cyclonedx.org/bom";

		const provenanceTarget = (directory: string) =>
			new PublishTarget({
				name: PACK_NAME,
				registry: "https://registry.npmjs.org/",
				directory,
				access: "public",
				provenance: true,
			});

		it.effect("reuses existing provenance + SBOM attestations and writes neither", () =>
			Effect.gen(function* () {
				const dir = `/tmp/test/${PACK_NAME}`;
				const pub = makePackagePublishLayer();
				const attestation = makeAttestationLayer([
					{ predicateType: SLSA_PROVENANCE_V1, url: "https://github.com/existing/provenance" },
					{ predicateType: CYCLONEDX_BOM, url: "https://github.com/existing/sbom" },
				]);

				const wsPkg = makeWsPkg(PACK_NAME, PACK_VERSION, dir);
				const detected: DetectedRelease[] = [makeDetected(PACK_NAME, PACK_VERSION, wsPkg.path)];

				const result: PublishPackagesResult = yield* runPublishTargets(detected).pipe(
					Effect.provide(
						makeBaseLayers(pub.layer, makeRegistryLayer(), wsPkg, [provenanceTarget(dir)], attestation.layer),
					),
				);

				// Both probes ran under the tarball's sha256 hex, and nothing was written.
				expect(attestation.listed.map((l) => l.predicateType)).toEqual([SLSA_PROVENANCE_V1, CYCLONEDX_BOM]);
				expect(attestation.listed.every((l) => l.sha256 === SUBJECT_SHA)).toBe(true);
				expect(attestation.uploads).toHaveLength(0);

				const targetResult = result.packages[0]?.targets[0];
				expect(targetResult?.attestationUrl).toBe("https://github.com/existing/provenance");
				expect(targetResult?.sbomAttestationUrl).toBe("https://github.com/existing/sbom");
				expect(targetResult?.recovered).toEqual({ provenance: true, sbom: true });
			}),
		);

		it.effect("writes a fresh SBOM attestation when no existing attestation matches", () =>
			Effect.gen(function* () {
				const dir = `/tmp/test/${PACK_NAME}`;
				const pub = makePackagePublishLayer();
				const attestation = makeAttestationLayer();

				const wsPkg = makeWsPkg(PACK_NAME, PACK_VERSION, dir);
				const detected: DetectedRelease[] = [makeDetected(PACK_NAME, PACK_VERSION, wsPkg.path)];

				const result: PublishPackagesResult = yield* runPublishTargets(detected).pipe(
					Effect.provide(
						makeBaseLayers(pub.layer, makeRegistryLayer(), wsPkg, [provenanceTarget(dir)], attestation.layer),
					),
				);

				expect(attestation.uploads).toHaveLength(1);
				const targetResult = result.packages[0]?.targets[0];
				expect(targetResult?.sbomAttestationUrl).toBe("https://github.com/test-owner/test-repo/attestations/1");
				// Provenance was skipped (no OIDC claims), so it is neither reused nor written.
				expect(targetResult?.attestationUrl).toBeUndefined();
				expect(targetResult?.recovered).toEqual({ provenance: false, sbom: false });
			}),
		);

		it.effect("mixed: SBOM exists, provenance does not — reuses the SBOM and writes nothing", () =>
			Effect.gen(function* () {
				const dir = `/tmp/test/${PACK_NAME}`;
				const pub = makePackagePublishLayer();
				const attestation = makeAttestationLayer([
					{ predicateType: CYCLONEDX_BOM, url: "https://github.com/existing/sbom-only" },
				]);

				const wsPkg = makeWsPkg(PACK_NAME, PACK_VERSION, dir);
				const detected: DetectedRelease[] = [makeDetected(PACK_NAME, PACK_VERSION, wsPkg.path)];

				const result: PublishPackagesResult = yield* runPublishTargets(detected).pipe(
					Effect.provide(
						makeBaseLayers(pub.layer, makeRegistryLayer(), wsPkg, [provenanceTarget(dir)], attestation.layer),
					),
				);

				expect(attestation.uploads).toHaveLength(0);
				const targetResult = result.packages[0]?.targets[0];
				expect(targetResult?.sbomAttestationUrl).toBe("https://github.com/existing/sbom-only");
				expect(targetResult?.recovered).toEqual({ provenance: false, sbom: true });
			}),
		);
	});

	describe("mixed: one published, one skipped-identical", () => {
		it.effect("publishes the missing-registry target and recovers the matching one", () =>
			Effect.gen(function* () {
				const SHARED_DIR = `/tmp/test/${PACK_NAME}`;
				const pub = makePackagePublishLayer();
				const wsPkg = makeWsPkg(PACK_NAME, PACK_VERSION, SHARED_DIR);

				// npmjs already has it with matching integrity; GitHub Packages does not.
				const npmLayer = NpmRegistry.layerSeeded({
					registries: {
						"https://registry.npmjs.org/": {
							[PACK_NAME]: { [PACK_VERSION]: { integrity: PACK_INTEGRITY } },
						},
					},
				});

				const targetA = new PublishTarget({
					name: PACK_NAME,
					registry: "https://registry.npmjs.org/",
					directory: SHARED_DIR,
					access: "public",
					provenance: false,
				});
				const targetB = new PublishTarget({
					name: PACK_NAME,
					registry: "https://npm.pkg.github.com/",
					directory: SHARED_DIR,
					access: "public",
					provenance: false,
				});
				const detected: DetectedRelease[] = [makeDetected(PACK_NAME, PACK_VERSION, wsPkg.path)];

				const result: PublishPackagesResult = yield* runPublishTargets(detected).pipe(
					Effect.provide(makeBaseLayers(pub.layer, npmLayer, wsPkg, [targetA, targetB])),
				);

				expect(result.success).toBe(true);
				expect(pub.packCalls).toHaveLength(1);
				expect(pub.publishTarballCalls).toHaveLength(1);
				expect(pub.publishTarballCalls[0]?.options.registry).toBe("https://npm.pkg.github.com/");

				const targets = result.packages[0]?.targets ?? [];
				expect(targets.filter((t) => t.status === "skipped")).toHaveLength(1);
				expect(targets.filter((t) => t.status === "published")).toHaveLength(1);
				expect(result.successfulTargets).toBe(2);
			}),
		);
	});

	describe("JSR target skipping", () => {
		it.effect("skips JSR targets with a warning and does not call npm publish/pack for them", () =>
			Effect.gen(function* () {
				const pub = makePackagePublishLayer();
				const wsPkg = makeWsPkg("@test/jsr-pkg", "1.0.0", "/tmp/test/jsr-pkg");
				const jsrTarget = new PublishTarget({
					name: "@test/jsr-pkg",
					registry: "https://jsr.io/",
					directory: "/tmp/test/jsr-pkg",
					access: "public",
					provenance: false,
				});
				const detected: DetectedRelease[] = [makeDetected("@test/jsr-pkg", "1.0.0", wsPkg.path)];

				const result: PublishPackagesResult = yield* runPublishTargets(detected).pipe(
					Effect.provide(makeBaseLayers(pub.layer, makeRegistryLayer(), wsPkg, [jsrTarget])),
				);

				// The JSR target is filtered out during target resolution, so the
				// package ends up with no targets at all — and nothing is packed.
				expect(pub.packCalls).toHaveLength(0);
				expect(pub.publishTarballCalls).toHaveLength(0);
				expect(result.packages[0]?.targets).toHaveLength(0);
			}),
		);
	});

	describe("batch error resilience", () => {
		it.effect("does not abort the batch when one package fails to pack", () =>
			Effect.gen(function* () {
				const failingPub = makePackagePublishLayer({ packFails: "simulated pack failure" });

				const pkgA = makeWsPkg("@test/fail-pkg", "2.0.0", "/tmp/test/fail-pkg");
				const pkgB = makeWsPkg("@test/ok-pkg", "1.0.0", "/tmp/test/ok-pkg");
				const targetA = makeNpmTarget("@test/fail-pkg", "/tmp/test/fail-pkg");
				const targetB = makeNpmTarget("@test/ok-pkg", "/tmp/test/ok-pkg");
				const detected: DetectedRelease[] = [
					makeDetected("@test/fail-pkg", "2.0.0", pkgA.path),
					makeDetected("@test/ok-pkg", "1.0.0", pkgB.path),
				];

				const layers = Layer.mergeAll(
					loggerLayer,
					actionStateLayer,
					configProviderLayer,
					environmentLayer,
					outputsLayer,
					repoLayer,
					failingPub.layer,
					makeRegistryLayer(),
					makeAttestationLayer().layer,
					oidcUnavailableLayer,
					sigstoreLayer,
					makeWorkspaceDiscoveryLayer([pkgA, pkgB]),
					makePublishabilityLayer(
						new Map([
							["@test/fail-pkg", [targetA]],
							["@test/ok-pkg", [targetB]],
						]),
					),
				);

				const result: PublishPackagesResult = yield* runPublishTargets(detected).pipe(Effect.provide(layers));

				// Both packages are reported; the pack failure is a per-target `failed`
				// result rather than an aborted batch.
				expect(result.packages).toHaveLength(2);
				expect(result.success).toBe(false);
				const failPkg = result.packages.find((p) => p.name === "@test/fail-pkg");
				expect(failPkg?.targets[0]?.status).toBe("failed");
				expect(failPkg?.targets[0]?.error).toContain("pack");
			}),
		);
	});
});
