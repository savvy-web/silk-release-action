/**
 * Tests for releasing-package detection and the release PR title decision.
 *
 * @remarks
 * `resolveReleasePrTitle` builds the changeset release PR's `release: …` title. A single released package — or several sharing one version (a locked
 * group) — yields `release: <version>`, mirroring the commit title. An
 * independent multi-package release lists `name@version` per package, falling
 * back to `release: <count> packages` once the title exceeds a length cap.
 * `getReleasingPackages` narrows the publishable set (from {@link listPublishablePackages})
 * to the packages whose package.json changed in this version bump.
 */

import { describe, expect, it } from "vitest";
import type { PublishablePackage } from "../src/utils/release-summary-helpers.js";
import {
	formatReleasePackageList,
	getReleasingPackages,
	resolveReleasePrTitle,
} from "../src/utils/release-summary-helpers.js";

const pkg = (overrides: Partial<PublishablePackage>): PublishablePackage => ({
	name: "@org/pkg",
	version: "1.0.0",
	path: "/repo/pkg",
	targetCount: 1,
	...overrides,
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
		});
		expect(title).toBe("release: 0.20.5");
	});

	it("uses release: <version> when multiple packages are fixed to one shared version", () => {
		const title = resolveReleasePrTitle({
			releasingPackages: [pkg({ name: "@org/a", version: "2.0.0" }), pkg({ name: "@org/b", version: "2.0.0" })],
			perPackageVersioning: false,
		});
		expect(title).toBe("release: 2.0.0");
	});

	it("omits the shared scope when listing an independent multi-package release", () => {
		const title = resolveReleasePrTitle({
			releasingPackages: [pkg({ name: "@org/a", version: "1.2.0" }), pkg({ name: "@org/b", version: "3.4.0" })],
			perPackageVersioning: true,
			releasablePackages: [pkg({ name: "@org/a" }), pkg({ name: "@org/b" })],
			maxLength: 80,
		});
		expect(title).toBe("release: a@1.2.0, b@3.4.0");
	});

	// The regression this pins: the scope basis was widened from the
	// release-eligible set to EVERY workspace package, which pulled in the
	// changeset-ignored ones (`docs`, `scratchpad`). Their differing scope made
	// the set mixed, `commonScope` returned null, and a title that had read
	// `release: runtimes@0.4.4` silently came back fully qualified. Nothing in
	// the title logic changed — only what it was asked to consider.
	it("omits the shared scope even when the workspace also holds differently-scoped packages", () => {
		const title = resolveReleasePrTitle({
			releasingPackages: [
				pkg({ name: "@effected/claude-code-plugin", version: "0.14.0" }),
				pkg({ name: "@effected/copilot-plugin", version: "0.1.0" }),
			],
			perPackageVersioning: true,
			// The basis excludes `docs` and `scratchpad` — changeset-ignored, and
			// never candidates for a release title.
			releasablePackages: [
				pkg({ name: "@effected/claude-code-plugin" }),
				pkg({ name: "@effected/copilot-plugin" }),
				pkg({ name: "@effected/runtimes" }),
			],
		});

		expect(title).toBe("release: claude-code-plugin@0.14.0, copilot-plugin@0.1.0");
		expect(title).not.toContain("@effected/");
	});

	it("keeps full names when the releasable packages do not share one scope", () => {
		const title = resolveReleasePrTitle({
			releasingPackages: [
				pkg({ name: "@scope/pkg-1", version: "1.2.0" }),
				pkg({ name: "unscoped-pkg", version: "3.4.0" }),
			],
			perPackageVersioning: true,
			releasablePackages: [pkg({ name: "@scope/pkg-1" }), pkg({ name: "unscoped-pkg" }), pkg({ name: "@scope/pkg-2" })],
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
		});
		expect(title).toBe("release: dependency-package@0.10.0");
	});

	it("keeps the full name for a single releasing package in a mixed-scope repo", () => {
		const title = resolveReleasePrTitle({
			releasingPackages: [pkg({ name: "@savvy-web/foo", version: "0.10.0" })],
			perPackageVersioning: true,
			releasablePackages: [pkg({ name: "@savvy-web/foo" }), pkg({ name: "@other/bar" })],
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
			maxLength: 30,
		});
		expect(title).toBe("release: 3 packages");
	});

	it("keeps a single long package named rather than collapsing to '1 packages'", () => {
		const title = resolveReleasePrTitle({
			releasingPackages: [pkg({ name: "very-long-unscoped-package-name", version: "1.0.0" })],
			perPackageVersioning: true,
			maxLength: 10,
		});
		expect(title).toBe("release: very-long-unscoped-package-name@1.0.0");
	});

	it("uses release: <root version> for a single-package repo with no publishable workspace", () => {
		const title = resolveReleasePrTitle({
			releasingPackages: [],
			perPackageVersioning: false,
			singlePackageRepoVersion: "1.0.0",
		});
		expect(title).toBe("release: 1.0.0");
	});

	it("falls back to a pending title when nothing is releasing and the repo is not single-package", () => {
		const title = resolveReleasePrTitle({
			releasingPackages: [],
			perPackageVersioning: false,
		});
		// A guard rail, not a title anyone should see: Phase 1 closes the PR and
		// deletes the branch when there is nothing to release. It reads
		// `release:` rather than the old `chore: release` so every title this
		// action emits carries the same prefix.
		expect(title).toBe("release: pending");
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
