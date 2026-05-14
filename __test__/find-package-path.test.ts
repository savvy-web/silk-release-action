import * as core from "@actions/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePackage } from "workspaces-effect";
import { findWorkspaceRootSync, getWorkspacePackagesSync } from "workspaces-effect";
import { clearWorkspaceCache, findPackagePath, findPublishablePath } from "../src/utils/find-package-path.js";
import { cleanupTestEnvironment, setupTestEnvironment } from "./utils/github-mocks.js";

// Mock modules
vi.mock("@actions/core");
vi.mock("workspaces-effect");

describe("find-package-path", () => {
	beforeEach(() => {
		setupTestEnvironment({ suppressOutput: true });
		// Default: walking up from cwd discovers a workspace root.
		vi.mocked(findWorkspaceRootSync).mockReturnValue("/workspace");
	});

	afterEach(() => {
		clearWorkspaceCache();
		cleanupTestEnvironment();
	});

	// Helper to create a minimal WorkspacePackage-shaped fixture. We cast through
	// unknown because mocks only need the fields we read (name, path).
	const createWorkspace = (name: string, path: string): WorkspacePackage =>
		({
			name,
			path,
			packageJsonPath: `${path}/package.json`,
			relativePath: path,
			version: "1.0.0",
			private: false,
			dependencies: {},
			devDependencies: {},
			peerDependencies: {},
			optionalDependencies: {},
		}) as unknown as WorkspacePackage;

	describe("findPackagePath", () => {
		it("should find package path from workspaces-effect", () => {
			vi.mocked(getWorkspacePackagesSync).mockReturnValue([createWorkspace("@test/pkg", "/workspace/pkgs/my-package")]);

			const result = findPackagePath("@test/pkg");

			expect(result).toBe("/workspace/pkgs/my-package");
			expect(core.debug).toHaveBeenCalledWith(expect.stringContaining("@test/pkg"));
		});

		it("should return null for unknown package", () => {
			vi.mocked(getWorkspacePackagesSync).mockReturnValue([createWorkspace("@test/other", "/workspace/pkgs/other")]);

			const result = findPackagePath("@test/unknown");

			expect(result).toBeNull();
			expect(core.warning).toHaveBeenCalledWith(expect.stringContaining("@test/unknown"));
		});

		it("should cache workspace data between calls", () => {
			vi.mocked(getWorkspacePackagesSync).mockReturnValue([createWorkspace("@test/pkg", "/workspace/pkgs/pkg")]);

			// First call
			findPackagePath("@test/pkg");
			// Second call
			findPackagePath("@test/pkg");

			// getWorkspacePackagesSync should only be called once due to caching
			expect(getWorkspacePackagesSync).toHaveBeenCalledTimes(1);
		});

		it("should append publishSubdir to path when provided", () => {
			vi.mocked(getWorkspacePackagesSync).mockReturnValue([createWorkspace("@test/pkg", "/workspace/pkgs/my-package")]);

			const result = findPackagePath("@test/pkg", "dist/npm");

			expect(result).toBe("/workspace/pkgs/my-package/dist/npm");
			expect(core.debug).toHaveBeenCalledWith(expect.stringContaining("publish path"));
		});

		it("should handle multiple packages in workspace", () => {
			vi.mocked(getWorkspacePackagesSync).mockReturnValue([
				createWorkspace("@test/pkg-a", "/workspace/pkgs/a"),
				createWorkspace("@test/pkg-b", "/workspace/pkgs/b"),
				createWorkspace("@test/pkg-c", "/workspace/pkgs/c"),
			]);

			expect(findPackagePath("@test/pkg-a")).toBe("/workspace/pkgs/a");
			expect(findPackagePath("@test/pkg-b")).toBe("/workspace/pkgs/b");
			expect(findPackagePath("@test/pkg-c")).toBe("/workspace/pkgs/c");
		});

		it("should log workspace discovery info", () => {
			vi.mocked(getWorkspacePackagesSync).mockReturnValue([createWorkspace("@test/pkg", "/workspace/pkgs/pkg")]);

			findPackagePath("@test/pkg");

			expect(core.info).toHaveBeenCalledWith(expect.stringContaining("1 workspace"));
		});

		it("should produce an empty package map when no workspace root is detected", () => {
			vi.mocked(findWorkspaceRootSync).mockReturnValue(null);

			const result = findPackagePath("@test/anything");

			expect(result).toBeNull();
			expect(getWorkspacePackagesSync).not.toHaveBeenCalled();
		});
	});

	describe("findPublishablePath", () => {
		it("should return dist/npm path for package", () => {
			vi.mocked(getWorkspacePackagesSync).mockReturnValue([createWorkspace("@test/pkg", "/workspace/pkgs/my-package")]);

			const result = findPublishablePath("@test/pkg");

			expect(result).toBe("/workspace/pkgs/my-package/dist/npm");
		});

		it("should return null for unknown package", () => {
			vi.mocked(getWorkspacePackagesSync).mockReturnValue([]);

			const result = findPublishablePath("@test/unknown");

			expect(result).toBeNull();
		});
	});

	describe("clearWorkspaceCache", () => {
		it("should clear cache and allow fresh workspace discovery", () => {
			vi.mocked(getWorkspacePackagesSync).mockReturnValue([createWorkspace("@test/pkg", "/workspace/pkgs/pkg")]);

			// First call
			findPackagePath("@test/pkg");
			expect(getWorkspacePackagesSync).toHaveBeenCalledTimes(1);

			// Clear cache
			clearWorkspaceCache();

			// Second call should invoke getWorkspacePackagesSync again
			findPackagePath("@test/pkg");
			expect(getWorkspacePackagesSync).toHaveBeenCalledTimes(2);
		});
	});
});
