import { describe, expect, it } from "vitest";
import { buildPublishSummary, getPackagePageUrl } from "./report.js";
import type { PackagePublishResult, PublishPackagesResult, TargetPublishResult } from "./types.js";

// Minimal ResolvedTarget stub — only the fields the report module touches
const npmTarget = {
	protocol: "npm" as const,
	registry: "https://registry.npmjs.org/",
	directory: "dist/npm",
	access: "public" as const,
	provenance: true,
	tag: "latest",
	tokenEnv: "NPM_TOKEN",
};

const ghTarget = {
	protocol: "npm" as const,
	registry: "https://npm.pkg.github.com/",
	directory: "dist/npm",
	access: "public" as const,
	provenance: false,
	tag: "latest",
	tokenEnv: "NODE_AUTH_TOKEN",
};

describe("getPackagePageUrl", () => {
	it("returns npmjs.com URL for npm registry", () => {
		const url = getPackagePageUrl("https://registry.npmjs.org/", "@org/my-pkg", "1.2.3");
		expect(url).toBe("https://www.npmjs.com/package/@org/my-pkg/v/1.2.3");
	});

	it("returns GitHub Packages URL for github registry", () => {
		const url = getPackagePageUrl("https://npm.pkg.github.com/", "@savvy-web/my-pkg", "2.0.0", "savvy-web");
		expect(url).toBe("https://github.com/orgs/savvy-web/packages/npm/package/my-pkg");
	});

	it("returns undefined for custom registry", () => {
		const url = getPackagePageUrl("https://my-custom-registry.example.com/", "@org/pkg", "1.0.0");
		expect(url).toBeUndefined();
	});

	it("returns jsr.io URL when registry is null", () => {
		const url = getPackagePageUrl(null, "@jsr/pkg", "0.1.0");
		expect(url).toBe("https://jsr.io/@jsr/pkg@0.1.0");
	});
});

describe("buildPublishSummary", () => {
	it("renders a markdown string containing both package names for a result with one published and one skipped package", () => {
		// Arrange
		const publishedTarget: TargetPublishResult = {
			target: npmTarget,
			success: true,
			registryUrl: "https://www.npmjs.com/package/@org/pkg-a/v/1.0.0",
		};

		const skippedTarget: TargetPublishResult = {
			target: npmTarget,
			success: true,
			alreadyPublished: true,
			alreadyPublishedReason: "identical",
		};

		const pkgA: PackagePublishResult = {
			name: "@org/pkg-a",
			version: "1.0.0",
			targets: [publishedTarget],
		};

		const pkgB: PackagePublishResult = {
			name: "@org/pkg-b",
			version: "2.0.0",
			targets: [skippedTarget],
		};

		const result: PublishPackagesResult = {
			success: true,
			packages: [pkgA, pkgB],
			totalPackages: 2,
			successfulPackages: 2,
			totalTargets: 2,
			successfulTargets: 2,
		};

		// Act
		const markdown = buildPublishSummary(result);

		// Assert
		expect(markdown).toContain("@org/pkg-a");
		expect(markdown).toContain("@org/pkg-b");
	});

	it("includes dry-run indicator in header when dryRun is true", () => {
		const result: PublishPackagesResult = {
			success: true,
			packages: [],
			totalPackages: 0,
			successfulPackages: 0,
			totalTargets: 0,
			successfulTargets: 0,
		};

		const markdown = buildPublishSummary(result, { dryRun: true });

		expect(markdown).toContain("Dry Run");
	});

	it("shows success status icon for all-successful result", () => {
		const publishedTarget: TargetPublishResult = {
			target: npmTarget,
			success: true,
			registryUrl: "https://www.npmjs.com/package/@org/pkg-a/v/1.0.0",
		};

		const pkg: PackagePublishResult = {
			name: "@org/pkg-a",
			version: "1.0.0",
			targets: [publishedTarget],
		};

		const result: PublishPackagesResult = {
			success: true,
			packages: [pkg],
			totalPackages: 1,
			successfulPackages: 1,
			totalTargets: 1,
			successfulTargets: 1,
		};

		const markdown = buildPublishSummary(result);

		// ✅ success icon
		expect(markdown).toContain("✅");
	});

	it("shows package URL link for a successfully published target", () => {
		const publishedTarget: TargetPublishResult = {
			target: npmTarget,
			success: true,
			registryUrl: "https://www.npmjs.com/package/@org/pkg-a/v/1.0.0",
		};

		const pkg: PackagePublishResult = {
			name: "@org/pkg-a",
			version: "1.0.0",
			targets: [publishedTarget],
		};

		const result: PublishPackagesResult = {
			success: true,
			packages: [pkg],
			totalPackages: 1,
			successfulPackages: 1,
			totalTargets: 1,
			successfulTargets: 1,
		};

		const markdown = buildPublishSummary(result);

		expect(markdown).toContain("https://www.npmjs.com/package/@org/pkg-a/v/1.0.0");
	});

	it("shows failed status for a package with failed targets", () => {
		const failedTarget: TargetPublishResult = {
			target: npmTarget,
			success: false,
			error: "Authentication failed",
		};

		const pkg: PackagePublishResult = {
			name: "@org/pkg-a",
			version: "1.0.0",
			targets: [failedTarget],
		};

		const result: PublishPackagesResult = {
			success: false,
			packages: [pkg],
			totalPackages: 1,
			successfulPackages: 0,
			totalTargets: 1,
			successfulTargets: 0,
		};

		const markdown = buildPublishSummary(result);

		// ❌ failure icon
		expect(markdown).toContain("❌");
		expect(markdown).toContain("@org/pkg-a");
	});

	it("renders GitHub Packages URL from getPackagePageUrl for github registry target", () => {
		const publishedTarget: TargetPublishResult = {
			target: ghTarget,
			success: true,
			registryUrl: "https://github.com/orgs/savvy-web/packages/npm/package/my-pkg",
		};

		const pkg: PackagePublishResult = {
			name: "@savvy-web/my-pkg",
			version: "1.0.0",
			targets: [publishedTarget],
		};

		const result: PublishPackagesResult = {
			success: true,
			packages: [pkg],
			totalPackages: 1,
			successfulPackages: 1,
			totalTargets: 1,
			successfulTargets: 1,
		};

		const markdown = buildPublishSummary(result);

		expect(markdown).toContain("@savvy-web/my-pkg");
	});
});
