/**
 * Unit tests for runPublish (Phase-3 orchestrator).
 *
 * All dependencies are provided via in-memory test layers; no real filesystem,
 * registry, git, GitHub API, or attestation tooling is exercised.
 */

import type { RestResponse } from "@savvy-web/github-action-effects/testing";
import {
	ActionLoggerTest,
	AttestTest,
	CommandRunnerTest,
	GitHubClientTest,
	NpmRegistryTest,
	OidcTokenIssuerTest,
	PackagePublishTest,
	SbomTest,
	SigstoreSignerTest,
} from "@savvy-web/github-action-effects/testing";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
	PublishTarget,
	PublishabilityDetector,
	TopologicalSorter,
	WorkspaceDiscovery,
	WorkspacePackage,
} from "workspaces-effect";

import type { PublishInputArgs } from "./publish.js";
import { runPublish } from "./publish.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Build a minimal WorkspacePackage for tests. */
const makeWsPkg = (name: string, version = "1.0.0", path = `/tmp/test/${name}`): WorkspacePackage =>
	new WorkspacePackage({
		name,
		version,
		path,
		packageJsonPath: `${path}/package.json`,
		relativePath: name,
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

/** Build a WorkspaceDiscovery test layer returning the given packages. */
const makeWorkspaceDiscoveryLayer = (packages: WorkspacePackage[]): Layer.Layer<WorkspaceDiscovery> =>
	Layer.succeed(WorkspaceDiscovery, {
		listPackages: (_cwd?: string) => Effect.succeed(packages as ReadonlyArray<WorkspacePackage>),
		getPackage: (name: string) => {
			const found = packages.find((p) => p.name === name);
			if (!found) return Effect.die(new Error(`Package not found: ${name}`));
			return Effect.succeed(found);
		},
		importerMap: (_cwd?: string) =>
			Effect.succeed(new Map(packages.map((p) => [p.relativePath, p])) as ReadonlyMap<string, WorkspacePackage>),
	});

/** Build a PublishabilityDetector test layer returning targets per package name. */
const makePublishabilityLayer = (targetsByName: Map<string, PublishTarget[]>): Layer.Layer<PublishabilityDetector> =>
	Layer.succeed(PublishabilityDetector, {
		detect: (pkg: WorkspacePackage, _root: string) =>
			Effect.succeed((targetsByName.get(pkg.name) ?? []) as ReadonlyArray<PublishTarget>),
	});

/** Build a TopologicalSorter test layer that returns names in the order given. */
const makeTopologicalSorterLayer = (orderedNames: string[]): Layer.Layer<TopologicalSorter> =>
	Layer.succeed(TopologicalSorter, {
		sort: () => Effect.succeed(orderedNames as ReadonlyArray<string>),
		sortSubset: (names: ReadonlyArray<string>) => {
			// Return only the names that were requested, in the pre-configured order
			const sorted = orderedNames.filter((n) => (names as string[]).includes(n));
			// Any names not in orderedNames go at the end (new packages)
			const missing = (names as string[]).filter((n) => !orderedNames.includes(n));
			return Effect.succeed([...sorted, ...missing] as ReadonlyArray<string>);
		},
		levels: () => Effect.succeed([orderedNames] as ReadonlyArray<ReadonlyArray<string>>),
	});

/**
 * Build a GitHubClient test layer that responds with the given PR files
 * for a specific PR number. Used to test the `detectReleasedPackagesFromPR`
 * path.
 */
const _makeGitHubClientLayer = (
	prNumber: number,
	files: Array<{ filename: string; status: string }>,
	baseContent?: Record<string, string>,
): Layer.Layer<import("@savvy-web/github-action-effects/testing").GitHubClient> => {
	const state = {
		restResponses: new Map<string, RestResponse>([
			[`pulls.listFiles:${prNumber}`, { data: files }],
			[`pulls.get:${prNumber}`, { data: { base: { sha: "base-sha-123" } } }],
		]),
		graphqlResponses: new Map<string, unknown>(),
		paginateResponses: new Map<string, Array<unknown[]>>(),
		repo: { owner: "test-owner", repo: "test-repo" },
	};

	// Add getContent responses for base commit content
	if (baseContent) {
		for (const [path, content] of Object.entries(baseContent)) {
			state.restResponses.set(`repos.getContent:base-sha-123:${path}`, {
				data: { content: Buffer.from(content).toString("base64") },
			});
		}
	}

	return GitHubClientTest.layer(state) as never;
};

// ─── Shared "always-on" base layers ──────────────────────────────────────────

const loggerState = ActionLoggerTest.empty();
const loggerLayer = ActionLoggerTest.layer(loggerState);
const commandRunnerLayer = CommandRunnerTest.empty();
const sbomLayer = SbomTest.empty();
const oidcTokenIssuerLayer = OidcTokenIssuerTest;
const sigstoreSignerLayer = SigstoreSignerTest;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runPublish", () => {
	describe("first-publish path (version absent from registry)", () => {
		it("publishes and returns status: 'published' when version is not on the registry", async () => {
			// Arrange: NpmRegistry returns empty versions (package never published)
			const pkg = makeWsPkg("@test/first", "1.0.0");
			const target = makeNpmTarget("@test/first", "/tmp/dist/first");

			const npmState = { packages: new Map() }; // No versions → getVersions fails with E404
			const npmLayer = NpmRegistryTest.layer(npmState);

			// PackagePublish: pack succeeds, publish succeeds; no versions published yet
			const { state: pubState, layer: pubLayer } = PackagePublishTest.layer({
				publishedVersions: [], // version not in registry → first-publish path
				integrityMatch: false, // irrelevant for first publish
			});

			const attestState = AttestTest.empty();
			const ghLayer = GitHubClientTest.empty();

			const preDetectedReleases = [{ name: "@test/first", version: "1.0.0", path: "/tmp/test/@test/first" }];

			const layers = Layer.mergeAll(
				loggerLayer,
				commandRunnerLayer,
				pubLayer,
				npmLayer,
				sbomLayer,
				attestState,
				oidcTokenIssuerLayer,
				sigstoreSignerLayer,
				ghLayer,
				makeWorkspaceDiscoveryLayer([pkg]),
				makePublishabilityLayer(new Map([["@test/first", [target]]])),
				makeTopologicalSorterLayer(["@test/first"]),
			);

			const args: PublishInputArgs = {
				packageManager: "pnpm",
				targetBranch: "main",
				dryRun: false,
				mergedReleasePRNumber: undefined,
				preDetectedReleases,
			};

			// Act
			const result = await Effect.runPromise(runPublish(args).pipe(Effect.provide(layers)));

			// Assert
			expect(result.success).toBe(true);
			expect(result.packages).toHaveLength(1);
			expect(result.totalPackages).toBe(1);
			expect(result.successfulPackages).toBe(1);

			// The first-publish path calls pack then publish (not publishIdempotent)
			expect(pubState.packCalls).toHaveLength(1);
			expect(pubState.publishCalls).toHaveLength(1);
			// publishIdempotent should NOT have been called
			expect(pubState.publishIdempotentCalls).toHaveLength(0);

			const pkg0 = result.packages[0];
			expect(pkg0?.name).toBe("@test/first");
			expect(pkg0?.version).toBe("1.0.0");
			expect(pkg0?.targets).toHaveLength(1);
			expect(pkg0?.targets[0]?.success).toBe(true);
			expect(pkg0?.targets[0]?.alreadyPublished).toBeFalsy();
		});
	});

	describe("already-published-identical path", () => {
		it("returns status: 'skipped' with skipReason: 'already-published-identical' when version exists with identical content", async () => {
			// Arrange: version 1.0.0 is already in the registry with matching integrity
			const pkg = makeWsPkg("@test/idempotent", "1.0.0");
			const target = makeNpmTarget("@test/idempotent", "/tmp/dist/idempotent");

			const npmState = {
				packages: new Map([
					[
						"@test/idempotent",
						{
							versions: ["1.0.0"],
							latest: "1.0.0",
							distTags: { latest: "1.0.0" },
						},
					],
				]),
			};
			const npmLayer = NpmRegistryTest.layer(npmState);

			// PackagePublish: 1.0.0 is already published with identical content
			const { state: pubState, layer: pubLayer } = PackagePublishTest.layer({
				publishedVersions: ["1.0.0"],
				integrityMatch: true, // identical content → skip
			});

			const attestState = AttestTest.empty();
			const ghLayer = GitHubClientTest.empty();

			const preDetectedReleases = [{ name: "@test/idempotent", version: "1.0.0", path: "/tmp/test/@test/idempotent" }];

			const layers = Layer.mergeAll(
				loggerLayer,
				commandRunnerLayer,
				pubLayer,
				npmLayer,
				sbomLayer,
				attestState,
				oidcTokenIssuerLayer,
				sigstoreSignerLayer,
				ghLayer,
				makeWorkspaceDiscoveryLayer([pkg]),
				makePublishabilityLayer(new Map([["@test/idempotent", [target]]])),
				makeTopologicalSorterLayer(["@test/idempotent"]),
			);

			const args: PublishInputArgs = {
				packageManager: "pnpm",
				targetBranch: "main",
				dryRun: false,
				mergedReleasePRNumber: undefined,
				preDetectedReleases,
			};

			// Act
			const result = await Effect.runPromise(runPublish(args).pipe(Effect.provide(layers)));

			// Assert
			expect(result.success).toBe(true);
			expect(result.packages).toHaveLength(1);
			expect(result.packages[0]?.targets).toHaveLength(1);
			expect(result.packages[0]?.targets[0]?.success).toBe(true);
			expect(result.packages[0]?.targets[0]?.alreadyPublished).toBe(true);
			expect(result.packages[0]?.targets[0]?.alreadyPublishedReason).toBe("identical");

			// publishIdempotent was called (existing package path)
			expect(pubState.publishIdempotentCalls).toHaveLength(1);
			// publish (first-publish path) was NOT called
			expect(pubState.publishCalls).toHaveLength(0);
		});
	});

	describe("batch error resilience", () => {
		it("does not abort the batch when one package fails to publish", async () => {
			// Arrange: two packages; the first fails to pack, the second succeeds
			const pkgA = makeWsPkg("@test/fail-pkg", "2.0.0");
			const pkgB = makeWsPkg("@test/ok-pkg", "1.0.0");
			const targetA = makeNpmTarget("@test/fail-pkg", "/tmp/dist/fail-pkg");
			const targetB = makeNpmTarget("@test/ok-pkg", "/tmp/dist/ok-pkg");

			// Empty NpmRegistry — both packages are new (no versions)
			const npmLayer = NpmRegistryTest.empty();

			// PackagePublish: pack will succeed (default), publish succeeds
			// We simulate the first package failing by overriding via the test state
			// Since PackagePublishTest does not allow per-package overrides, we build
			// a custom layer that fails publish for "@test/fail-pkg".
			const { state: pubState } = PackagePublishTest.layer({
				publishedVersions: [], // no versions — both go through first-publish
				integrityMatch: false,
			});

			// Custom PackagePublish layer that causes the first package to fail at pack
			const { PackagePublishError } = await import("@savvy-web/github-action-effects");
			const failingPubLayer = Layer.succeed((await import("@savvy-web/github-action-effects")).PackagePublish, {
				setupAuth: (_registry: string, _token: string) => Effect.succeed(undefined as undefined),
				pack: (packageDir: string) => {
					if (packageDir.includes("fail-pkg")) {
						return Effect.fail(
							new PackagePublishError({
								operation: "pack",
								reason: "Simulated pack failure",
							}),
						);
					}
					return Effect.succeed({ tarball: "/tmp/dist/ok-pkg/pkg.tgz", digest: "sha256:abc123" });
				},
				publish: (_packageDir: string) => Effect.succeed(undefined as undefined),
				verifyIntegrity: (_name: string, _version: string, _digest: string) => Effect.succeed(false),
				publishToRegistries: (_packageDir: string, _registries: unknown[]) => Effect.succeed(undefined as undefined),
				publishIdempotent: (_input: unknown) =>
					Effect.succeed({ status: "published" as const, packageName: "x", version: "1.0.0" }),
				dryRun: (_packageDir: string) =>
					Effect.succeed({ ok: true, output: "", packedSize: 0, unpackedSize: 0, fileCount: 0 }),
			});

			const attestState = AttestTest.empty();
			const ghLayer = GitHubClientTest.empty();

			const preDetectedReleases = [
				{ name: "@test/fail-pkg", version: "2.0.0", path: "/tmp/test/@test/fail-pkg" },
				{ name: "@test/ok-pkg", version: "1.0.0", path: "/tmp/test/@test/ok-pkg" },
			];

			const layers = Layer.mergeAll(
				loggerLayer,
				commandRunnerLayer,
				failingPubLayer,
				npmLayer,
				sbomLayer,
				attestState,
				oidcTokenIssuerLayer,
				sigstoreSignerLayer,
				ghLayer,
				makeWorkspaceDiscoveryLayer([pkgA, pkgB]),
				makePublishabilityLayer(
					new Map([
						["@test/fail-pkg", [targetA]],
						["@test/ok-pkg", [targetB]],
					]),
				),
				makeTopologicalSorterLayer(["@test/fail-pkg", "@test/ok-pkg"]),
			);

			const args: PublishInputArgs = {
				packageManager: "pnpm",
				targetBranch: "main",
				dryRun: false,
				mergedReleasePRNumber: undefined,
				preDetectedReleases,
			};

			// Act
			const result = await Effect.runPromise(runPublish(args).pipe(Effect.provide(layers)));

			// Assert: batch completed (no early abort), result has both packages
			expect(result.packages).toHaveLength(2);
			// success is false because one package failed
			expect(result.success).toBe(false);
			// The ok-pkg succeeded
			const okPkg = result.packages.find((p) => p.name === "@test/ok-pkg");
			expect(okPkg).toBeDefined();
			expect(okPkg?.targets[0]?.success).toBe(true);
			// The fail-pkg failed
			const failPkg = result.packages.find((p) => p.name === "@test/fail-pkg");
			expect(failPkg).toBeDefined();
			expect(failPkg?.targets[0]?.success).toBe(false);

			// Void pubState (failingPubLayer replaced it, pubState is unused)
			void pubState;
		});
	});
});
