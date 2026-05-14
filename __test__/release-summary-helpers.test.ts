import * as fs from "node:fs";
import * as core from "@actions/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePackage } from "workspaces-effect";
import { findWorkspaceRootSync, getWorkspacePackagesSync } from "workspaces-effect";
import {
	countChangesetsPerPackage,
	findPackageGroup,
	formatSkipReason,
	getAllWorkspacePackages,
	getBumpTypeIcon,
	getGroupIcon,
	getSkipReason,
	isFirstRelease,
	readChangesetConfig,
} from "../src/utils/release-summary-helpers.js";

vi.mock("node:fs");
vi.mock("@actions/core");
vi.mock("workspaces-effect", async (importOriginal) => {
	const actual = await importOriginal<typeof import("workspaces-effect")>();
	return {
		...actual,
		findWorkspaceRootSync: vi.fn(),
		getWorkspacePackagesSync: vi.fn(),
	};
});

interface WorkspaceFixture {
	name: string;
	path: string;
	version?: string;
	private?: boolean;
	publishConfig?: {
		access?: "public" | "restricted";
		registry?: string;
		directory?: string;
		targets?: ReadonlyArray<string | { access?: string; registry?: string }>;
	};
}

// Build a WorkspacePackage-shaped fixture plus the raw package.json JSON the
// helper will re-read off disk for silk-rule evaluation.
const buildFixture = (
	fixtures: WorkspaceFixture[],
): {
	workspaces: WorkspacePackage[];
	pkgJsonFor: Map<string, string>;
} => {
	const workspaces = fixtures.map(
		(f) =>
			({
				name: f.name,
				path: f.path,
				packageJsonPath: `${f.path}/package.json`,
				relativePath: f.path,
				version: f.version ?? "1.0.0",
				private: f.private ?? false,
				dependencies: {},
				devDependencies: {},
				peerDependencies: {},
				optionalDependencies: {},
			}) as unknown as WorkspacePackage,
	);

	const pkgJsonFor = new Map<string, string>();
	for (const f of fixtures) {
		pkgJsonFor.set(
			`${f.path}/package.json`,
			JSON.stringify({
				name: f.name,
				version: f.version,
				private: f.private,
				publishConfig: f.publishConfig,
			}),
		);
	}

	return { workspaces, pkgJsonFor };
};

describe("release-summary-helpers", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.spyOn(process, "cwd").mockReturnValue("/test/workspace");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("readChangesetConfig", () => {
		it("should read and parse changeset config file", () => {
			const mockConfig = {
				fixed: [["@test/pkg-a", "@test/pkg-b"]],
				linked: [["@test/pkg-c", "@test/pkg-d"]],
			};

			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

			const result = readChangesetConfig();

			expect(result).toEqual(mockConfig);
			expect(fs.existsSync).toHaveBeenCalledWith("/test/workspace/.changeset/config.json");
		});

		it("should return null when config file does not exist", () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const result = readChangesetConfig();

			expect(result).toBeNull();
		});

		it("should return null and log debug when parsing fails", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue("invalid json");

			const result = readChangesetConfig();

			expect(result).toBeNull();
			expect(core.debug).toHaveBeenCalled();
		});
	});

	describe("findPackageGroup", () => {
		it("should find fixed group for a package", () => {
			const config = {
				fixed: [["@test/pkg-a", "@test/pkg-b"]],
				linked: [],
			};

			const result = findPackageGroup("@test/pkg-a", config);

			expect(result).toEqual({
				type: "fixed",
				siblings: ["@test/pkg-b"],
			});
		});

		it("should find linked group for a package", () => {
			const config = {
				fixed: [],
				linked: [["@test/pkg-c", "@test/pkg-d", "@test/pkg-e"]],
			};

			const result = findPackageGroup("@test/pkg-c", config);

			expect(result).toEqual({
				type: "linked",
				siblings: ["@test/pkg-d", "@test/pkg-e"],
			});
		});

		it("should return none for package not in any group", () => {
			const config = {
				fixed: [["@test/pkg-a", "@test/pkg-b"]],
				linked: [["@test/pkg-c", "@test/pkg-d"]],
			};

			const result = findPackageGroup("@test/pkg-x", config);

			expect(result).toEqual({
				type: "none",
				siblings: [],
			});
		});

		it("should return none when config is null", () => {
			const result = findPackageGroup("@test/pkg-a", null);

			expect(result).toEqual({
				type: "none",
				siblings: [],
			});
		});

		it("should prioritize fixed groups over linked", () => {
			const config = {
				fixed: [["@test/pkg-a", "@test/pkg-b"]],
				linked: [["@test/pkg-a", "@test/pkg-c"]],
			};

			const result = findPackageGroup("@test/pkg-a", config);

			expect(result.type).toBe("fixed");
		});
	});

	describe("getAllWorkspacePackages", () => {
		it("should return all workspace packages with their info", () => {
			const { workspaces, pkgJsonFor } = buildFixture([
				{
					name: "@test/pkg-a",
					path: "/test/workspace/packages/a",
					version: "1.0.0",
					private: true,
					publishConfig: { access: "public", targets: ["npm", "github"] },
				},
				{
					name: "@test/pkg-b",
					path: "/test/workspace/packages/b",
					version: "2.0.0",
					private: true,
				},
			]);

			vi.mocked(findWorkspaceRootSync).mockReturnValue("/test/workspace");
			vi.mocked(getWorkspacePackagesSync).mockReturnValue(workspaces);
			vi.mocked(fs.readFileSync).mockImplementation((p: fs.PathOrFileDescriptor) => {
				const content = pkgJsonFor.get(String(p));
				if (content === undefined) throw new Error(`Unexpected read: ${String(p)}`);
				return content;
			});

			const result = getAllWorkspacePackages();

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({
				name: "@test/pkg-a",
				version: "1.0.0",
				path: "/test/workspace/packages/a",
				private: true,
				hasPublishConfig: true,
				access: "public",
				// private + 2 string targets → 2 silk targets
				targetCount: 2,
			});
			expect(result[1]).toEqual({
				name: "@test/pkg-b",
				version: "2.0.0",
				path: "/test/workspace/packages/b",
				private: true,
				hasPublishConfig: false,
				access: undefined,
				// private + no publishConfig → 0 silk targets
				targetCount: 0,
			});
		});

		it("should return empty array when no workspace root found", () => {
			vi.mocked(findWorkspaceRootSync).mockReturnValue(null);

			const result = getAllWorkspacePackages();

			expect(result).toEqual([]);
			expect(core.debug).toHaveBeenCalledWith("No workspace root found");
		});

		it("should default version to 0.0.0 when not specified", () => {
			const { workspaces } = buildFixture([
				{
					name: "@test/pkg",
					path: "/test/workspace/packages/pkg",
					version: "",
				},
			]);
			vi.mocked(findWorkspaceRootSync).mockReturnValue("/test/workspace");
			vi.mocked(getWorkspacePackagesSync).mockReturnValue(workspaces);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ name: "@test/pkg", version: "" }));

			const result = getAllWorkspacePackages();

			expect(result[0].version).toBe("0.0.0");
		});

		it("should count single target when only access is specified", () => {
			const { workspaces, pkgJsonFor } = buildFixture([
				{
					name: "@test/pkg",
					path: "/test/workspace/packages/pkg",
					version: "1.0.0",
					publishConfig: { access: "public" },
				},
			]);
			vi.mocked(findWorkspaceRootSync).mockReturnValue("/test/workspace");
			vi.mocked(getWorkspacePackagesSync).mockReturnValue(workspaces);
			vi.mocked(fs.readFileSync).mockImplementation((p: fs.PathOrFileDescriptor) => {
				const content = pkgJsonFor.get(String(p));
				if (content === undefined) throw new Error(`Unexpected read: ${String(p)}`);
				return content;
			});

			const result = getAllWorkspacePackages();

			expect(result[0].targetCount).toBe(1);
		});

		it("should treat private+publishConfig.targets as publishable under silk rules", () => {
			const { workspaces, pkgJsonFor } = buildFixture([
				{
					name: "@test/pkg",
					path: "/test/workspace/packages/pkg",
					version: "1.0.0",
					private: true,
					publishConfig: { access: "restricted", targets: ["npm", "github"] },
				},
			]);
			vi.mocked(findWorkspaceRootSync).mockReturnValue("/test/workspace");
			vi.mocked(getWorkspacePackagesSync).mockReturnValue(workspaces);
			vi.mocked(fs.readFileSync).mockImplementation((p: fs.PathOrFileDescriptor) => {
				const content = pkgJsonFor.get(String(p));
				if (content === undefined) throw new Error(`Unexpected read: ${String(p)}`);
				return content;
			});

			const result = getAllWorkspacePackages();

			expect(result[0].private).toBe(true);
			expect(result[0].targetCount).toBe(2);
		});
	});

	describe("countChangesetsPerPackage", () => {
		it("should count changesets per package", () => {
			const changesets = [
				{ releases: [{ name: "@test/pkg-a" }, { name: "@test/pkg-b" }] },
				{ releases: [{ name: "@test/pkg-a" }] },
				{ releases: [{ name: "@test/pkg-c" }] },
			];

			const result = countChangesetsPerPackage(changesets);

			expect(result.get("@test/pkg-a")).toBe(2);
			expect(result.get("@test/pkg-b")).toBe(1);
			expect(result.get("@test/pkg-c")).toBe(1);
		});

		it("should return empty map for empty changesets", () => {
			const result = countChangesetsPerPackage([]);

			expect(result.size).toBe(0);
		});
	});

	describe("getSkipReason", () => {
		it("should return null when package is in releases", () => {
			const pkg = {
				name: "@test/pkg",
				version: "1.0.0",
				path: "/test",
				private: false,
				hasPublishConfig: true,
				targetCount: 1,
			};

			const result = getSkipReason(pkg, true);

			expect(result).toBeNull();
		});

		it("should return private when package is private without publish config", () => {
			const pkg = {
				name: "@test/pkg",
				version: "1.0.0",
				path: "/test",
				private: true,
				hasPublishConfig: false,
				targetCount: 0,
			};

			const result = getSkipReason(pkg, false);

			expect(result).toBe("private");
		});

		it("should return no-publish-config when not private but no publish config", () => {
			const pkg = {
				name: "@test/pkg",
				version: "1.0.0",
				path: "/test",
				private: false,
				hasPublishConfig: false,
				targetCount: 0,
			};

			const result = getSkipReason(pkg, false);

			expect(result).toBe("no-publish-config");
		});

		it("should return no-changes when has publish config but not in releases", () => {
			const pkg = {
				name: "@test/pkg",
				version: "1.0.0",
				path: "/test",
				private: false,
				hasPublishConfig: true,
				targetCount: 1,
			};

			const result = getSkipReason(pkg, false);

			expect(result).toBe("no-changes");
		});
	});

	describe("formatSkipReason", () => {
		it("should format private reason", () => {
			expect(formatSkipReason("private")).toBe("🔒 Private (no `publishConfig.access`)");
		});

		it("should format no-publish-config reason", () => {
			expect(formatSkipReason("no-publish-config")).toBe("⚙️ No `publishConfig.access`");
		});

		it("should format no-changes reason", () => {
			expect(formatSkipReason("no-changes")).toBe("📭 No changes");
		});

		it("should format ignored reason", () => {
			expect(formatSkipReason("ignored")).toBe("🚫 Ignored");
		});
	});

	describe("getBumpTypeIcon", () => {
		it("should return red circle for major", () => {
			expect(getBumpTypeIcon("major")).toBe("🔴");
		});

		it("should return yellow circle for minor", () => {
			expect(getBumpTypeIcon("minor")).toBe("🟡");
		});

		it("should return green circle for patch", () => {
			expect(getBumpTypeIcon("patch")).toBe("🟢");
		});

		it("should return dot for unknown type", () => {
			expect(getBumpTypeIcon("unknown")).toBe("⚪️");
		});
	});

	describe("getGroupIcon", () => {
		it("should return lock for fixed", () => {
			expect(getGroupIcon("fixed")).toBe("🔒");
		});

		it("should return link for linked", () => {
			expect(getGroupIcon("linked")).toBe("🔗");
		});

		it("should return dot for none", () => {
			expect(getGroupIcon("none")).toBe("📦");
		});
	});

	describe("isFirstRelease", () => {
		it("should return true for 0.0.0", () => {
			expect(isFirstRelease("0.0.0")).toBe(true);
		});

		it("should return false for other versions", () => {
			expect(isFirstRelease("0.0.1")).toBe(false);
			expect(isFirstRelease("1.0.0")).toBe(false);
			expect(isFirstRelease("0.1.0")).toBe(false);
		});
	});
});
