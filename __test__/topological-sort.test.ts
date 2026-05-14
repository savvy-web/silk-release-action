import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePackage } from "workspaces-effect";
import { findWorkspaceRootSync, getWorkspacePackagesSync } from "workspaces-effect";
import { sortPackageMapTopologically, sortPackagesTopologically } from "../src/utils/topological-sort.js";

// Partial mock — auto-mock triggers getters on the bundled error classes
// (e.g. CyclicDependencyError.message reads `.join` off undefined) and
// crashes at import time. Keep real exports for everything except the two
// sync APIs we actually stub.
vi.mock("workspaces-effect", async (importOriginal) => {
	const actual = await importOriginal<typeof import("workspaces-effect")>();
	return {
		...actual,
		findWorkspaceRootSync: vi.fn(),
		getWorkspacePackagesSync: vi.fn(),
	};
});

// Mock @actions/core
vi.mock("@actions/core", () => ({
	debug: vi.fn(),
	info: vi.fn(),
}));

interface WorkspaceFixture {
	name: string;
	dependencies?: Record<string, string>;
}

const makePackages = (entries: WorkspaceFixture[]): WorkspacePackage[] =>
	entries.map(
		({ name, dependencies = {} }, idx) =>
			({
				name,
				version: "1.0.0",
				path: `/workspace/${name}`,
				packageJsonPath: `/workspace/${name}/package.json`,
				relativePath: idx === 0 ? "." : name,
				private: false,
				dependencies,
				devDependencies: {},
				peerDependencies: {},
				optionalDependencies: {},
			}) as unknown as WorkspacePackage,
	);

const mockWorkspace = (entries: WorkspaceFixture[], root = "/workspace") => {
	vi.mocked(findWorkspaceRootSync).mockReturnValue(root);
	vi.mocked(getWorkspacePackagesSync).mockReturnValue(makePackages(entries));
};

describe("topological-sort", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe("sortPackagesTopologically", () => {
		it("should return empty array for empty input", () => {
			const result = sortPackagesTopologically([]);

			expect(result.sorted).toEqual([]);
			expect(result.success).toBe(true);
		});

		it("should return single package as-is", () => {
			const result = sortPackagesTopologically(["pkg-a"]);

			expect(result.sorted).toEqual(["pkg-a"]);
			expect(result.success).toBe(true);
		});

		it("should handle packages with no dependencies", () => {
			mockWorkspace([{ name: "pkg-a" }, { name: "pkg-b" }, { name: "pkg-c" }]);

			const result = sortPackagesTopologically(["pkg-a", "pkg-b", "pkg-c"]);

			expect(result.success).toBe(true);
			// All packages should be present (order may vary since no dependencies)
			expect(result.sorted).toHaveLength(3);
			expect(result.sorted).toContain("pkg-a");
			expect(result.sorted).toContain("pkg-b");
			expect(result.sorted).toContain("pkg-c");
		});

		it("should sort packages with linear dependencies", () => {
			// pkg-c depends on pkg-b, pkg-b depends on pkg-a
			mockWorkspace([
				{ name: "pkg-a" },
				{ name: "pkg-b", dependencies: { "pkg-a": "1.0.0" } },
				{ name: "pkg-c", dependencies: { "pkg-b": "1.0.0" } },
			]);

			const result = sortPackagesTopologically(["pkg-c", "pkg-b", "pkg-a"]);

			expect(result.success).toBe(true);
			expect(result.sorted).toEqual(["pkg-a", "pkg-b", "pkg-c"]);
		});

		it("should sort packages with diamond dependencies", () => {
			// pkg-d depends on pkg-b and pkg-c, both depend on pkg-a
			mockWorkspace([
				{ name: "pkg-a" },
				{ name: "pkg-b", dependencies: { "pkg-a": "1.0.0" } },
				{ name: "pkg-c", dependencies: { "pkg-a": "1.0.0" } },
				{ name: "pkg-d", dependencies: { "pkg-b": "1.0.0", "pkg-c": "1.0.0" } },
			]);

			const result = sortPackagesTopologically(["pkg-d", "pkg-c", "pkg-b", "pkg-a"]);

			expect(result.success).toBe(true);
			// pkg-a must come first, pkg-d must come last
			expect(result.sorted[0]).toBe("pkg-a");
			expect(result.sorted[3]).toBe("pkg-d");
			// pkg-b and pkg-c can be in either order
			expect(result.sorted.slice(1, 3).sort()).toEqual(["pkg-b", "pkg-c"]);
		});

		it("should filter out dependencies not in package set", () => {
			// pkg-b depends on pkg-a and external-pkg (not a workspace member)
			mockWorkspace([
				{ name: "pkg-a" },
				{ name: "pkg-b", dependencies: { "pkg-a": "1.0.0", "external-pkg": "1.0.0" } },
			]);

			const result = sortPackagesTopologically(["pkg-b", "pkg-a"]);

			expect(result.success).toBe(true);
			expect(result.sorted).toEqual(["pkg-a", "pkg-b"]);
		});

		it("should detect circular dependencies", () => {
			// pkg-a depends on pkg-b, pkg-b depends on pkg-a
			mockWorkspace([
				{ name: "pkg-a", dependencies: { "pkg-b": "1.0.0" } },
				{ name: "pkg-b", dependencies: { "pkg-a": "1.0.0" } },
			]);

			const result = sortPackagesTopologically(["pkg-a", "pkg-b"]);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Circular dependency detected");
			// Should fall back to original order
			expect(result.sorted).toEqual(["pkg-a", "pkg-b"]);
		});

		it("should handle getWorkspacePackagesSync throwing error", () => {
			vi.mocked(findWorkspaceRootSync).mockReturnValue("/workspace");
			vi.mocked(getWorkspacePackagesSync).mockImplementation(() => {
				throw new Error("Failed to enumerate workspace packages");
			});

			const result = sortPackagesTopologically(["pkg-a", "pkg-b"]);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Failed to enumerate workspace packages");
			// Should fall back to original order
			expect(result.sorted).toEqual(["pkg-a", "pkg-b"]);
		});

		it("should handle findWorkspaceRootSync throwing error", () => {
			vi.mocked(findWorkspaceRootSync).mockImplementation(() => {
				throw new Error("Failed to find workspace root");
			});

			const result = sortPackagesTopologically(["pkg-a", "pkg-b"]);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Failed to find workspace root");
			expect(result.sorted).toEqual(["pkg-a", "pkg-b"]);
		});

		it("should handle non-Error throws", () => {
			vi.mocked(findWorkspaceRootSync).mockImplementation(() => {
				throw "string error";
			});

			const result = sortPackagesTopologically(["pkg-a", "pkg-b"]);

			expect(result.success).toBe(false);
			expect(result.error).toBe("string error");
		});

		it("should use custom cwd parameter", () => {
			mockWorkspace([{ name: "pkg-a" }, { name: "pkg-b" }], "/custom/path");

			// Need 2+ packages to trigger actual sorting (single package short-circuits)
			sortPackagesTopologically(["pkg-a", "pkg-b"], "/custom/path");

			expect(findWorkspaceRootSync).toHaveBeenCalledWith("/custom/path");
		});

		it("should handle workspace with no detectable root", () => {
			vi.mocked(findWorkspaceRootSync).mockReturnValue(null);

			const result = sortPackagesTopologically(["pkg-a", "pkg-b"]);

			// With no workspace root, dependency map is empty, so packages appear
			// independent and sort succeeds in arbitrary order.
			expect(result.success).toBe(true);
			expect(result.sorted).toHaveLength(2);
		});
	});

	describe("sortPackageMapTopologically", () => {
		it("should sort map entries in dependency order", () => {
			mockWorkspace([{ name: "pkg-a" }, { name: "pkg-b", dependencies: { "pkg-a": "1.0.0" } }]);

			const packageMap = new Map<string, { version: string }>([
				["pkg-b", { version: "2.0.0" }],
				["pkg-a", { version: "1.0.0" }],
			]);

			const result = sortPackageMapTopologically(packageMap);

			expect(result).toEqual([
				["pkg-a", { version: "1.0.0" }],
				["pkg-b", { version: "2.0.0" }],
			]);
		});

		it("should preserve package info in tuples", () => {
			mockWorkspace([{ name: "pkg-a" }]);

			const complexInfo = {
				version: "1.0.0",
				targets: ["npm", "jsr"],
				metadata: { foo: "bar" },
			};
			const packageMap = new Map([["pkg-a", complexInfo]]);

			const result = sortPackageMapTopologically(packageMap);

			expect(result[0][1]).toBe(complexInfo);
		});

		it("should handle empty map", () => {
			const packageMap = new Map<string, { version: string }>();

			const result = sortPackageMapTopologically(packageMap);

			expect(result).toEqual([]);
		});

		it("should log warning on circular dependency", async () => {
			const { info } = await import("@actions/core");

			mockWorkspace([
				{ name: "pkg-a", dependencies: { "pkg-b": "1.0.0" } },
				{ name: "pkg-b", dependencies: { "pkg-a": "1.0.0" } },
			]);

			const packageMap = new Map([
				["pkg-a", { version: "1.0.0" }],
				["pkg-b", { version: "2.0.0" }],
			]);

			sortPackageMapTopologically(packageMap);

			expect(info).toHaveBeenCalledWith(expect.stringContaining("Circular dependency detected"));
			expect(info).toHaveBeenCalledWith(expect.stringContaining("publishing in original order"));
		});

		it("should filter out packages not found in map", () => {
			// This tests when sortPackagesTopologically returns a package name
			// that somehow isn't in our map (edge case)
			mockWorkspace([{ name: "pkg-a" }]);

			const packageMap = new Map([["pkg-a", { version: "1.0.0" }]]);

			const result = sortPackageMapTopologically(packageMap);

			expect(result).toEqual([["pkg-a", { version: "1.0.0" }]]);
		});

		it("should use custom cwd parameter", () => {
			mockWorkspace([{ name: "pkg-a" }, { name: "pkg-b" }], "/custom/path");

			// Need 2+ packages to trigger actual sorting (single package short-circuits)
			const packageMap = new Map([
				["pkg-a", { version: "1.0.0" }],
				["pkg-b", { version: "2.0.0" }],
			]);

			sortPackageMapTopologically(packageMap, "/custom/path");

			expect(findWorkspaceRootSync).toHaveBeenCalledWith("/custom/path");
		});
	});
});
