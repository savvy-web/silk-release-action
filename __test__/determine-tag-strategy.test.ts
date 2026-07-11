import { Effect, Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PublishabilityDetector, WorkspaceDiscovery } from "workspaces-effect";
import { ChangesetConfig } from "../src/release/changeset-config.js";
import type { PackagePublishResult } from "../src/release/types.js";
import {
	determineReleaseType,
	determineTagStrategy,
	isMonorepoForTagging,
} from "../src/utils/determine-tag-strategy.js";
import { cleanupTestEnvironment, setupTestEnvironment } from "./utils/github-mocks.js";

// ─── Minimal test layers ───────────────────────────────────────────────────

interface WsPkgStub {
	name: string;
	version: string;
	path: string;
	private?: boolean;
}

/** Build a WorkspaceDiscovery test layer that returns the given package stubs. */
const makeDiscoveryLayer = (packages: WsPkgStub[]): Layer.Layer<WorkspaceDiscovery> =>
	Layer.succeed(WorkspaceDiscovery, {
		listPackages: () => Effect.succeed(packages as never),
		getPackage: () => Effect.die("not implemented"),
		importerMap: () => Effect.die("not implemented"),
		refresh: () => Effect.void,
	});

/**
 * Build a PublishabilityDetector test layer that resolves targets per package
 * name. Any package in the map with a non-empty targets list is publishable;
 * packages missing from the map resolve to zero targets (not publishable).
 */
const makeDetectorLayer = (publishableNames: Set<string>): Layer.Layer<PublishabilityDetector> =>
	Layer.succeed(PublishabilityDetector, {
		detect: (pkg: { name: string }) =>
			Effect.succeed(publishableNames.has(pkg.name) ? ([{ protocol: "npm" }] as never) : []),
	});

/** Build a ChangesetConfig test layer returning the given fixed groups. */
const makeChangesetConfigLayer = (
	fixed: ReadonlyArray<ReadonlyArray<string>> = [],
	ignore: ReadonlyArray<string> = [],
): Layer.Layer<ChangesetConfig> =>
	Layer.succeed(ChangesetConfig, {
		mode: () => Effect.succeed("silk" as const),
		versionPrivate: () => Effect.succeed(false),
		ignorePatterns: () => Effect.succeed(ignore),
		isIgnored: (name: string) =>
			Effect.succeed(ignore.some((p) => name === p || (p.endsWith("/*") && name.startsWith(p.slice(0, -1))))),
		fixed: () => Effect.succeed(fixed),
		refresh: () => Effect.void,
	});

const runIsMonorepo = (
	packages: WsPkgStub[],
	publishableNames: Set<string>,
	fixed: ReadonlyArray<ReadonlyArray<string>> = [],
	ignore: ReadonlyArray<string> = [],
): Promise<boolean> =>
	Effect.runPromise(
		isMonorepoForTagging("/repo").pipe(
			Effect.provide(makeDiscoveryLayer(packages)),
			Effect.provide(makeDetectorLayer(publishableNames)),
			Effect.provide(makeChangesetConfigLayer(fixed, ignore)),
		),
	);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("determine-tag-strategy", () => {
	beforeEach(() => {
		setupTestEnvironment({ suppressOutput: true });
	});

	afterEach(() => {
		cleanupTestEnvironment();
	});

	describe("determineTagStrategy", () => {
		it("returns empty tags for no successful packages", () => {
			const publishResults: PackagePublishResult[] = [
				{
					name: "@org/pkg-a",
					version: "1.0.0",
					targets: [
						{
							target: {
								protocol: "npm",
								registry: "https://registry.npmjs.org/",
								directory: "/path/to/pkg-a",
								access: "public",
								provenance: true,
								tag: "latest",
								tokenEnv: "NPM_TOKEN",
							},
							success: false,
							error: "Failed to publish",
						},
					],
				},
			];

			const result = determineTagStrategy(publishResults, false);

			expect(result.strategy).toBe("single");
			expect(result.tags).toHaveLength(0);
			expect(result.isFixedVersioning).toBe(true);
		});

		it("returns single tag for single package", () => {
			const publishResults: PackagePublishResult[] = [
				{
					name: "@org/pkg-a",
					version: "1.2.3",
					targets: [
						{
							target: {
								protocol: "npm",
								registry: "https://registry.npmjs.org/",
								directory: "/path/to/pkg-a",
								access: "public",
								provenance: true,
								tag: "latest",
								tokenEnv: "NPM_TOKEN",
							},
							success: true,
							registryUrl: "https://www.npmjs.com/package/@org/pkg-a",
						},
					],
				},
			];

			const result = determineTagStrategy(publishResults, false);

			expect(result.strategy).toBe("single");
			expect(result.tags).toHaveLength(1);
			expect(result.tags[0]).toEqual({
				name: "1.2.3",
				packageName: "@org/pkg-a",
				version: "1.2.3",
			});
			expect(result.isFixedVersioning).toBe(true);
		});

		it("returns single tag for fixed versioning (all same version)", () => {
			const publishResults: PackagePublishResult[] = [
				{
					name: "@org/pkg-a",
					version: "2.0.0",
					targets: [
						{
							target: {
								protocol: "npm",
								registry: "https://registry.npmjs.org/",
								directory: "/path/to/pkg-a",
								access: "public",
								provenance: true,
								tag: "latest",
								tokenEnv: "NPM_TOKEN",
							},
							success: true,
						},
					],
				},
				{
					name: "@org/pkg-b",
					version: "2.0.0",
					targets: [
						{
							target: {
								protocol: "npm",
								registry: "https://registry.npmjs.org/",
								directory: "/path/to/pkg-b",
								access: "public",
								provenance: true,
								tag: "latest",
								tokenEnv: "NPM_TOKEN",
							},
							success: true,
						},
					],
				},
			];

			const result = determineTagStrategy(publishResults, false);

			expect(result.strategy).toBe("single");
			expect(result.tags).toHaveLength(1);
			expect(result.tags[0].name).toBe("2.0.0");
			expect(result.tags[0].packageName).toContain("@org/pkg-a");
			expect(result.tags[0].packageName).toContain("@org/pkg-b");
			expect(result.isFixedVersioning).toBe(true);
		});

		it("returns multiple tags for independent versioning in monorepo", () => {
			const publishResults: PackagePublishResult[] = [
				{
					name: "@org/pkg-a",
					version: "1.0.0",
					targets: [
						{
							target: {
								protocol: "npm",
								registry: "https://registry.npmjs.org/",
								directory: "/path/to/pkg-a",
								access: "public",
								provenance: true,
								tag: "latest",
								tokenEnv: "NPM_TOKEN",
							},
							success: true,
						},
					],
				},
				{
					name: "@org/pkg-b",
					version: "2.0.0",
					targets: [
						{
							target: {
								protocol: "npm",
								registry: "https://registry.npmjs.org/",
								directory: "/path/to/pkg-b",
								access: "public",
								provenance: true,
								tag: "latest",
								tokenEnv: "NPM_TOKEN",
							},
							success: true,
						},
					],
				},
			];

			const result = determineTagStrategy(publishResults, true);

			expect(result.strategy).toBe("multiple");
			expect(result.tags).toHaveLength(2);
			expect(result.tags[0].name).toBe("@org/pkg-a@1.0.0");
			expect(result.tags[1].name).toBe("@org/pkg-b@2.0.0");
			expect(result.isFixedVersioning).toBe(false);
		});

		it("uses v prefix for non-scoped packages in independent versioning", () => {
			const publishResults: PackagePublishResult[] = [
				{
					name: "pkg-a",
					version: "1.0.0",
					targets: [
						{
							target: {
								protocol: "npm",
								registry: "https://registry.npmjs.org/",
								directory: "/path/to/pkg-a",
								access: "public",
								provenance: true,
								tag: "latest",
								tokenEnv: "NPM_TOKEN",
							},
							success: true,
						},
					],
				},
				{
					name: "pkg-b",
					version: "2.0.0",
					targets: [
						{
							target: {
								protocol: "npm",
								registry: "https://registry.npmjs.org/",
								directory: "/path/to/pkg-b",
								access: "public",
								provenance: true,
								tag: "latest",
								tokenEnv: "NPM_TOKEN",
							},
							success: true,
						},
					],
				},
			];

			const result = determineTagStrategy(publishResults, true);

			expect(result.tags[0].name).toBe("pkg-a@v1.0.0");
			expect(result.tags[1].name).toBe("pkg-b@v2.0.0");
		});

		it("only considers packages with at least one successful target", () => {
			const publishResults: PackagePublishResult[] = [
				{
					name: "@org/pkg-a",
					version: "1.0.0",
					targets: [
						{
							target: {
								protocol: "npm",
								registry: "https://registry.npmjs.org/",
								directory: "/path/to/pkg-a",
								access: "public",
								provenance: true,
								tag: "latest",
								tokenEnv: "NPM_TOKEN",
							},
							success: true,
						},
					],
				},
				{
					name: "@org/pkg-b",
					version: "2.0.0",
					targets: [
						{
							target: {
								protocol: "npm",
								registry: "https://registry.npmjs.org/",
								directory: "/path/to/pkg-b",
								access: "public",
								provenance: true,
								tag: "latest",
								tokenEnv: "NPM_TOKEN",
							},
							success: false,
							error: "Failed",
						},
					],
				},
			];

			const result = determineTagStrategy(publishResults, false);

			expect(result.strategy).toBe("single");
			expect(result.tags).toHaveLength(1);
			expect(result.tags[0].name).toBe("1.0.0");
		});

		it("uses per-package tag when monorepo releases single package (bug fix)", () => {
			// This is the key bug fix: when a monorepo releases only ONE package,
			// it should still use per-package tags, not v1.0.0
			const publishResults: PackagePublishResult[] = [
				{
					name: "@org/pkg-a",
					version: "1.0.0",
					targets: [
						{
							target: {
								protocol: "npm",
								registry: "https://registry.npmjs.org/",
								directory: "/path/to/pkg-a",
								access: "public",
								provenance: true,
								tag: "latest",
								tokenEnv: "NPM_TOKEN",
							},
							success: true,
						},
					],
				},
			];

			const result = determineTagStrategy(publishResults, true);

			// Should use per-package tag, NOT v1.0.0
			expect(result.strategy).toBe("multiple");
			expect(result.tags).toHaveLength(1);
			expect(result.tags[0].name).toBe("@org/pkg-a@1.0.0");
		});

		it("includes version-only packages (empty targets) in tag strategy", () => {
			const publishResults: PackagePublishResult[] = [
				{
					name: "@org/version-only",
					version: "1.0.0",
					targets: [], // No publish targets - version-only package
				},
			];

			const result = determineTagStrategy(publishResults, false);

			expect(result.strategy).toBe("single");
			expect(result.tags).toHaveLength(1);
			expect(result.tags[0]).toEqual({
				name: "1.0.0",
				packageName: "@org/version-only",
				version: "1.0.0",
			});
			expect(result.isFixedVersioning).toBe(true);
		});

		it("uses single tag when all packages are in same fixed group", () => {
			const publishResults: PackagePublishResult[] = [
				{
					name: "@org/pkg-a",
					version: "1.0.0",
					targets: [{ target: {} as never, success: true }],
				},
				{
					name: "@org/pkg-b",
					version: "1.0.0",
					targets: [{ target: {} as never, success: true }],
				},
			];

			// needsPerPackageTags=false means all in fixed group → single tag
			const result = determineTagStrategy(publishResults, false);

			expect(result.strategy).toBe("single");
			expect(result.tags).toHaveLength(1);
			expect(result.tags[0].name).toBe("1.0.0");
		});
	});

	describe("isMonorepoForTagging", () => {
		it("returns false for single publishable package", async () => {
			const pkgs = [{ name: "my-pkg", version: "1.0.0", path: "/" }];
			const result = await runIsMonorepo(pkgs, new Set(["my-pkg"]));
			expect(result).toBe(false);
		});

		it("returns true for multiple publishable packages without fixed config", async () => {
			const pkgs = [
				{ name: "@org/pkg-a", version: "1.0.0", path: "/pkgs/a" },
				{ name: "@org/pkg-b", version: "1.0.0", path: "/pkgs/b" },
			];
			const result = await runIsMonorepo(pkgs, new Set(["@org/pkg-a", "@org/pkg-b"]));
			expect(result).toBe(true);
		});

		it("returns false when all publishable packages are in same fixed group", async () => {
			const pkgs = [
				{ name: "@org/pkg-a", version: "1.0.0", path: "/pkgs/a" },
				{ name: "@org/pkg-b", version: "1.0.0", path: "/pkgs/b" },
			];
			const result = await runIsMonorepo(pkgs, new Set(["@org/pkg-a", "@org/pkg-b"]), [["@org/pkg-a", "@org/pkg-b"]]);
			expect(result).toBe(false);
		});

		it("returns true when packages are in linked group (not fixed)", async () => {
			const pkgs = [
				{ name: "@org/pkg-a", version: "1.0.0", path: "/pkgs/a" },
				{ name: "@org/pkg-b", version: "1.0.0", path: "/pkgs/b" },
			];
			// No fixed groups — linked doesn't affect isMonorepoForTagging
			const result = await runIsMonorepo(pkgs, new Set(["@org/pkg-a", "@org/pkg-b"]));
			expect(result).toBe(true);
		});

		it("returns true when only some packages are in fixed group", async () => {
			const pkgs = [
				{ name: "@org/pkg-a", version: "1.0.0", path: "/pkgs/a" },
				{ name: "@org/pkg-b", version: "1.0.0", path: "/pkgs/b" },
				{ name: "@org/pkg-c", version: "1.0.0", path: "/pkgs/c" },
			];
			// Only pkg-a and pkg-b in fixed group; pkg-c is independent
			const result = await runIsMonorepo(pkgs, new Set(["@org/pkg-a", "@org/pkg-b", "@org/pkg-c"]), [
				["@org/pkg-a", "@org/pkg-b"],
			]);
			expect(result).toBe(true);
		});

		it("ignores packages the detector returns no targets for (private no publish config)", async () => {
			const pkgs = [
				{ name: "@org/pkg-a", version: "1.0.0", path: "/pkgs/a" },
				{ name: "root", version: "0.0.0", path: "/" },
			];
			// Only pkg-a is publishable; root resolves to 0 targets
			const result = await runIsMonorepo(pkgs, new Set(["@org/pkg-a"]));
			// Only 1 publishable package, so not a monorepo for tagging
			expect(result).toBe(false);
		});

		it("excludes changeset-ignored packages when counting publishable packages", async () => {
			// rslib-builder shape: one real package plus several publishable example
			// packages that are excluded via the changeset `ignore` list.
			// The detector returns targets for all, but ignorePatterns causes detector to return []
			// via the adaptive layer. In our test setup, we model it directly:
			// only rslib-builder is publishable (detector returns no targets for examples).
			const pkgs = [
				{ name: "@savvy-web/rslib-builder", version: "0.20.5", path: "/package" },
				{ name: "@libraries/single-entry", version: "0.0.0", path: "/examples/libraries/single-entry" },
				{ name: "@rspress/plugin", version: "0.0.0", path: "/examples/rspress-plugin/plugin" },
			];
			// The detector returns targets only for rslib-builder (ignored packages get [] from adaptive layer)
			const result = await runIsMonorepo(pkgs, new Set(["@savvy-web/rslib-builder"]));
			// Only @savvy-web/rslib-builder can actually release → single-tag repo.
			expect(result).toBe(false);
		});
	});

	describe("determineReleaseType", () => {
		it("returns major for major bump", () => {
			const publishResults: PackagePublishResult[] = [
				{
					name: "@org/pkg-a",
					version: "2.0.0",
					targets: [{ target: {} as never, success: true }],
				},
			];
			const bumpTypes = new Map([["@org/pkg-a", "major"]]);

			const result = determineReleaseType(publishResults, bumpTypes);

			expect(result).toBe("major");
		});

		it("returns minor for minor bump", () => {
			const publishResults: PackagePublishResult[] = [
				{
					name: "@org/pkg-a",
					version: "1.1.0",
					targets: [{ target: {} as never, success: true }],
				},
			];
			const bumpTypes = new Map([["@org/pkg-a", "minor"]]);

			const result = determineReleaseType(publishResults, bumpTypes);

			expect(result).toBe("minor");
		});

		it("returns patch for patch bump", () => {
			const publishResults: PackagePublishResult[] = [
				{
					name: "@org/pkg-a",
					version: "1.0.1",
					targets: [{ target: {} as never, success: true }],
				},
			];
			const bumpTypes = new Map([["@org/pkg-a", "patch"]]);

			const result = determineReleaseType(publishResults, bumpTypes);

			expect(result).toBe("patch");
		});

		it("returns highest bump type when mixed", () => {
			const publishResults: PackagePublishResult[] = [
				{
					name: "@org/pkg-a",
					version: "2.0.0",
					targets: [{ target: {} as never, success: true }],
				},
				{
					name: "@org/pkg-b",
					version: "1.1.0",
					targets: [{ target: {} as never, success: true }],
				},
				{
					name: "@org/pkg-c",
					version: "1.0.1",
					targets: [{ target: {} as never, success: true }],
				},
			];
			const bumpTypes = new Map([
				["@org/pkg-a", "major"],
				["@org/pkg-b", "minor"],
				["@org/pkg-c", "patch"],
			]);

			const result = determineReleaseType(publishResults, bumpTypes);

			expect(result).toBe("major");
		});

		it("returns minor when major is not present", () => {
			const publishResults: PackagePublishResult[] = [
				{
					name: "@org/pkg-a",
					version: "1.1.0",
					targets: [{ target: {} as never, success: true }],
				},
				{
					name: "@org/pkg-b",
					version: "1.0.1",
					targets: [{ target: {} as never, success: true }],
				},
			];
			const bumpTypes = new Map([
				["@org/pkg-a", "minor"],
				["@org/pkg-b", "patch"],
			]);

			const result = determineReleaseType(publishResults, bumpTypes);

			expect(result).toBe("minor");
		});

		it("returns patch when no bump types found", () => {
			const publishResults: PackagePublishResult[] = [
				{
					name: "@org/pkg-a",
					version: "1.0.0",
					targets: [{ target: {} as never, success: true }],
				},
			];
			const bumpTypes = new Map<string, string>();

			const result = determineReleaseType(publishResults, bumpTypes);

			expect(result).toBe("patch");
		});

		it("includes version-only packages (empty targets) in release type", () => {
			const publishResults: PackagePublishResult[] = [
				{
					name: "@org/version-only",
					version: "2.0.0",
					targets: [], // No publish targets - version-only package
				},
			];
			const bumpTypes = new Map([["@org/version-only", "major"]]);

			const result = determineReleaseType(publishResults, bumpTypes);

			expect(result).toBe("major");
		});

		it("ignores failed packages", () => {
			const publishResults: PackagePublishResult[] = [
				{
					name: "@org/pkg-a",
					version: "2.0.0",
					targets: [{ target: {} as never, success: false, error: "Failed" }],
				},
				{
					name: "@org/pkg-b",
					version: "1.0.1",
					targets: [{ target: {} as never, success: true }],
				},
			];
			const bumpTypes = new Map([
				["@org/pkg-a", "major"],
				["@org/pkg-b", "patch"],
			]);

			const result = determineReleaseType(publishResults, bumpTypes);

			expect(result).toBe("patch");
		});
	});
});
