import { existsSync, readFileSync } from "node:fs";
import type { WorkspacePackage } from "@effected/workspaces";
import { findWorkspaceRootSync, getWorkspacePackagesSync } from "@effected/workspaces";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isSinglePackage } from "../src/utils/detect-repo-type.js";

// Helper to create a WorkspacePackage-shaped fixture with the fields the
// repo-type detector actually reads (`name`).
const createMockWorkspace = (name: string, path: string): WorkspacePackage =>
	({
		name,
		path,
		packageJsonPath: `${path}/package.json`,
		relativePath: path === "/" ? "." : path,
		version: "1.0.0",
		private: false,
		dependencies: {},
		devDependencies: {},
		peerDependencies: {},
		optionalDependencies: {},
	}) as unknown as WorkspacePackage;

// Mock modules
vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
	readFile: vi.fn(),
}));

vi.mock("@effected/workspaces", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@effected/workspaces")>();
	return {
		...actual,
		findWorkspaceRootSync: vi.fn(),
		getWorkspacePackagesSync: vi.fn(),
	};
});

const mockWorkspace = (packages: WorkspacePackage[], root: string | null = "/workspace") => {
	vi.mocked(findWorkspaceRootSync).mockReturnValue(root);
	vi.mocked(getWorkspacePackagesSync).mockReturnValue(packages);
};

describe("detect-repo-type", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe("isSinglePackage", () => {
		it("should return true when only one workspace exists", () => {
			mockWorkspace([createMockWorkspace("my-package", "/path/to/pkg")]);

			expect(isSinglePackage()).toBe(true);
		});

		it("should return false when multiple workspaces exist", () => {
			mockWorkspace([createMockWorkspace("pkg-a", "/path/to/a"), createMockWorkspace("pkg-b", "/path/to/b")]);

			expect(isSinglePackage()).toBe(false);
		});

		it("should return true when no workspaces exist (single-package repo)", () => {
			mockWorkspace([], null);

			// A repo with no workspace config is a single-package repo
			expect(isSinglePackage()).toBe(true);
		});

		it("should return true when getWorkspacePackagesSync throws", () => {
			vi.mocked(findWorkspaceRootSync).mockReturnValue("/workspace");
			vi.mocked(getWorkspacePackagesSync).mockImplementation(() => {
				throw new Error("Failed to detect workspaces");
			});

			// If workspace detection fails, assume single-package
			expect(isSinglePackage()).toBe(true);
		});

		it("should return true when all non-root packages are in changeset ignore list", () => {
			// Multiple workspaces exist, but all non-root packages are ignored by changesets
			mockWorkspace([
				createMockWorkspace("@savvy-web/rslib-builder", "/root"),
				createMockWorkspace("@fixtures/multi-entry", "/test/fixtures/multi-entry"),
				createMockWorkspace("@fixtures/single-entry", "/test/fixtures/single-entry"),
			]);
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readFileSync).mockImplementation((path) => {
				const pathStr = String(path);
				if (pathStr === ".changeset/config.json") {
					return JSON.stringify({
						ignore: ["@fixtures/*"],
					});
				}
				if (pathStr === "package.json") {
					return JSON.stringify({
						name: "@savvy-web/rslib-builder",
					});
				}
				throw new Error("File not found");
			});

			expect(isSinglePackage()).toBe(true);
		});

		it("should return false when non-root packages are not in ignore list", () => {
			mockWorkspace([
				createMockWorkspace("root-pkg", "/root"),
				createMockWorkspace("pkg-a", "/packages/a"),
				createMockWorkspace("pkg-b", "/packages/b"),
			]);
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readFileSync).mockImplementation((path) => {
				const pathStr = String(path);
				if (pathStr === ".changeset/config.json") {
					return JSON.stringify({
						ignore: ["@other/*"],
					});
				}
				if (pathStr === "package.json") {
					return JSON.stringify({
						name: "root-pkg",
					});
				}
				throw new Error("File not found");
			});

			expect(isSinglePackage()).toBe(false);
		});

		it("should handle exact match ignore patterns", () => {
			mockWorkspace([
				createMockWorkspace("main-pkg", "/root"),
				createMockWorkspace("ignored-pkg", "/packages/ignored"),
			]);
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readFileSync).mockImplementation((path) => {
				const pathStr = String(path);
				if (pathStr === ".changeset/config.json") {
					return JSON.stringify({
						ignore: ["ignored-pkg"],
					});
				}
				if (pathStr === "package.json") {
					return JSON.stringify({
						name: "main-pkg",
					});
				}
				throw new Error("File not found");
			});

			expect(isSinglePackage()).toBe(true);
		});

		it("should return false when no ignore patterns and multiple packages", () => {
			mockWorkspace([createMockWorkspace("root", "/"), createMockWorkspace("pkg-a", "/packages/a")]);
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readFileSync).mockImplementation((path) => {
				const pathStr = String(path);
				if (pathStr === ".changeset/config.json") {
					return JSON.stringify({});
				}
				if (pathStr === "package.json") {
					return JSON.stringify({ name: "root" });
				}
				throw new Error("File not found");
			});

			expect(isSinglePackage()).toBe(false);
		});

		it("should return false when changeset config does not exist and multiple packages", () => {
			mockWorkspace([createMockWorkspace("root", "/"), createMockWorkspace("pkg-a", "/packages/a")]);
			vi.mocked(existsSync).mockReturnValue(false);

			expect(isSinglePackage()).toBe(false);
		});

		it("should return false when package.json read fails", () => {
			mockWorkspace([createMockWorkspace("root", "/"), createMockWorkspace("@fixtures/test", "/test/fixtures")]);
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readFileSync).mockImplementation((path) => {
				const pathStr = String(path);
				if (pathStr === ".changeset/config.json") {
					return JSON.stringify({
						ignore: ["@fixtures/*"],
					});
				}
				// package.json read fails
				throw new Error("File not found");
			});

			expect(isSinglePackage()).toBe(false);
		});

		it("should handle changeset config with invalid JSON gracefully", () => {
			mockWorkspace([createMockWorkspace("root", "/"), createMockWorkspace("pkg-a", "/packages/a")]);
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readFileSync).mockImplementation((path) => {
				const pathStr = String(path);
				if (pathStr === ".changeset/config.json") {
					return "invalid json {{{";
				}
				if (pathStr === "package.json") {
					return JSON.stringify({ name: "root" });
				}
				throw new Error("File not found");
			});

			// Invalid JSON = no ignore patterns = multiple packages = not single
			expect(isSinglePackage()).toBe(false);
		});

		it("should handle mixed ignored and non-ignored packages", () => {
			mockWorkspace([
				createMockWorkspace("root-pkg", "/"),
				createMockWorkspace("@fixtures/test", "/test/fixtures"),
				createMockWorkspace("pkg-publishable", "/packages/pub"),
			]);
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readFileSync).mockImplementation((path) => {
				const pathStr = String(path);
				if (pathStr === ".changeset/config.json") {
					return JSON.stringify({
						ignore: ["@fixtures/*"],
					});
				}
				if (pathStr === "package.json") {
					return JSON.stringify({ name: "root-pkg" });
				}
				throw new Error("File not found");
			});

			// pkg-publishable is not ignored, so this is not a single package
			expect(isSinglePackage()).toBe(false);
		});
	});
});
