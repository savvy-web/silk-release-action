/**
 * Tests for publishable-package detection, releasing-package detection, and the
 * release PR title decision.
 *
 * @remarks
 * `resolveReleasePrTitle` decides whether the changeset release PR keeps the
 * configured prefix (e.g. `chore: release`) or is renamed to a `release: …`
 * title. A single released package — or several sharing one version (a locked
 * group) — yields `release: <version>`, mirroring the commit title. An
 * independent multi-package release lists `name@version` per package, falling
 * back to `release: <count> packages` once the title exceeds a length cap.
 * `isPublishablePackage` is the shared predicate that `determine-tag-strategy`
 * also uses; `getReleasingPackages` narrows the publishable set to the packages
 * whose package.json changed in this version bump.
 */

import { describe, expect, it } from "vitest";
import type { WorkspacePackageInfo } from "../src/utils/release-summary-helpers.js";
import {
	formatReleasePackageList,
	getReleasingPackages,
	isPublishablePackage,
	resolveReleasePrTitle,
} from "../src/utils/release-summary-helpers.js";

const pkg = (overrides: Partial<WorkspacePackageInfo>): WorkspacePackageInfo => ({
	name: "@org/pkg",
	version: "1.0.0",
	path: "/repo/pkg",
	private: false,
	hasPublishConfig: false,
	targetCount: 0,
	...overrides,
});

describe("isPublishablePackage", () => {
	it("treats a public package with no publish config as publishable", () => {
		expect(isPublishablePackage(pkg({ private: false }))).toBe(true);
	});

	it("treats a private package with publishConfig.access as publishable", () => {
		expect(isPublishablePackage(pkg({ private: true, hasPublishConfig: true }))).toBe(true);
	});

	it("treats a private package with publishConfig.targets as publishable", () => {
		expect(isPublishablePackage(pkg({ private: true, targetCount: 2 }))).toBe(true);
	});

	it("treats a private package with no publish config as not publishable", () => {
		expect(isPublishablePackage(pkg({ private: true, hasPublishConfig: false, targetCount: 0 }))).toBe(false);
	});
});

describe("getReleasingPackages", () => {
	const repoRoot = "/repo";
	const pkgA = pkg({ name: "@org/a", version: "1.1.0", path: "/repo/pkgs/a" });
	const pkgB = pkg({ name: "@org/b", version: "2.0.0", path: "/repo/pkgs/b" });
	const rootPkg = pkg({ name: "@org/root", version: "3.0.0", path: "/repo" });

	it("returns only publishable packages whose package.json changed", () => {
		const changed = " M pkgs/a/package.json\n M pkgs/a/CHANGELOG.md\n M pnpm-lock.yaml";
		const releasing = getReleasingPackages([pkgA, pkgB], changed, repoRoot);
		expect(releasing.map((p) => p.name)).toEqual(["@org/a"]);
	});

	it("matches the root package.json without matching nested package.json files", () => {
		const changed = " M pkgs/a/package.json\n M pkgs/b/package.json";
		const releasing = getReleasingPackages([rootPkg, pkgA, pkgB], changed, repoRoot);
		// Root must NOT be flagged just because nested package.json files changed.
		expect(releasing.map((p) => p.name)).toEqual(["@org/a", "@org/b"]);
	});

	it("returns an empty list when no publishable package changed", () => {
		const changed = " M README.md\n M pnpm-lock.yaml";
		expect(getReleasingPackages([pkgA, pkgB], changed, repoRoot)).toEqual([]);
	});
});

describe("resolveReleasePrTitle", () => {
	it("uses release: <version> when only one package can release (single-tag repo)", () => {
		const title = resolveReleasePrTitle({
			releasingPackages: [pkg({ name: "@savvy-web/rslib-builder", version: "0.20.5" })],
			perPackageVersioning: false,
			prTitlePrefix: "chore: release",
		});
		expect(title).toBe("release: 0.20.5");
	});

	it("uses release: <version> when multiple packages are fixed to one shared version", () => {
		const title = resolveReleasePrTitle({
			releasingPackages: [pkg({ name: "@org/a", version: "2.0.0" }), pkg({ name: "@org/b", version: "2.0.0" })],
			perPackageVersioning: false,
			prTitlePrefix: "chore: release",
		});
		expect(title).toBe("release: 2.0.0");
	});

	it("omits the shared scope when listing an independent multi-package release", () => {
		const title = resolveReleasePrTitle({
			releasingPackages: [pkg({ name: "@org/a", version: "1.2.0" }), pkg({ name: "@org/b", version: "3.4.0" })],
			perPackageVersioning: true,
			releasablePackages: [pkg({ name: "@org/a" }), pkg({ name: "@org/b" })],
			prTitlePrefix: "chore: release",
			maxLength: 80,
		});
		expect(title).toBe("release: a@1.2.0, b@3.4.0");
	});

	it("keeps full names when the releasable packages do not share one scope", () => {
		const title = resolveReleasePrTitle({
			releasingPackages: [
				pkg({ name: "@scope/pkg-1", version: "1.2.0" }),
				pkg({ name: "unscoped-pkg", version: "3.4.0" }),
			],
			perPackageVersioning: true,
			releasablePackages: [pkg({ name: "@scope/pkg-1" }), pkg({ name: "unscoped-pkg" }), pkg({ name: "@scope/pkg-2" })],
			prTitlePrefix: "chore: release",
			maxLength: 120,
		});
		expect(title).toBe("release: @scope/pkg-1@1.2.0, unscoped-pkg@3.4.0");
	});

	it("omits the shared scope for a single releasing package (integration-repo case)", () => {
		// Many packages CAN release (all @savvy-web), one IS releasing this run.
		const title = resolveReleasePrTitle({
			releasingPackages: [pkg({ name: "@savvy-web/dependency-package", version: "0.10.0" })],
			perPackageVersioning: true,
			releasablePackages: [
				pkg({ name: "@savvy-web/dependency-package" }),
				pkg({ name: "@savvy-web/standalone-package" }),
			],
			prTitlePrefix: "chore: release",
		});
		expect(title).toBe("release: dependency-package@0.10.0");
	});

	it("keeps the full name for a single releasing package in a mixed-scope repo", () => {
		const title = resolveReleasePrTitle({
			releasingPackages: [pkg({ name: "@savvy-web/foo", version: "0.10.0" })],
			perPackageVersioning: true,
			releasablePackages: [pkg({ name: "@savvy-web/foo" }), pkg({ name: "@other/bar" })],
			prTitlePrefix: "chore: release",
		});
		expect(title).toBe("release: @savvy-web/foo@0.10.0");
	});

	it("collapses to release: <count> packages when the listed title exceeds the cap", () => {
		const title = resolveReleasePrTitle({
			releasingPackages: [
				pkg({ name: "@org/a", version: "1.2.0" }),
				pkg({ name: "@org/b", version: "3.4.0" }),
				pkg({ name: "@org/c", version: "5.6.0" }),
			],
			perPackageVersioning: true,
			releasablePackages: [pkg({ name: "@org/a" }), pkg({ name: "@org/b" }), pkg({ name: "@org/c" })],
			prTitlePrefix: "chore: release",
			maxLength: 30,
		});
		expect(title).toBe("release: 3 packages");
	});

	it("keeps a single long package named rather than collapsing to '1 packages'", () => {
		const title = resolveReleasePrTitle({
			releasingPackages: [pkg({ name: "very-long-unscoped-package-name", version: "1.0.0" })],
			perPackageVersioning: true,
			prTitlePrefix: "chore: release",
			maxLength: 10,
		});
		expect(title).toBe("release: very-long-unscoped-package-name@1.0.0");
	});

	it("uses release: <root version> for a single-package repo with no publishable workspace", () => {
		const title = resolveReleasePrTitle({
			releasingPackages: [],
			perPackageVersioning: false,
			singlePackageRepoVersion: "1.0.0",
			prTitlePrefix: "chore: release",
		});
		expect(title).toBe("release: 1.0.0");
	});

	it("keeps the prefix when nothing is releasing and the repo is not single-package", () => {
		const title = resolveReleasePrTitle({
			releasingPackages: [],
			perPackageVersioning: false,
			prTitlePrefix: "chore: release",
		});
		expect(title).toBe("chore: release");
	});
});

describe("formatReleasePackageList", () => {
	it("renders a bullet list of full name@version (scope kept)", () => {
		const list = formatReleasePackageList([
			pkg({ name: "@savvy-web/a", version: "1.0.0" }),
			pkg({ name: "@savvy-web/b", version: "2.0.0" }),
		]);
		expect(list).toBe("- @savvy-web/a@1.0.0\n- @savvy-web/b@2.0.0");
	});

	it("returns an empty string when no packages are releasing", () => {
		expect(formatReleasePackageList([])).toBe("");
	});
});
