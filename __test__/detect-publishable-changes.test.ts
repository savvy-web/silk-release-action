import { readFile, unlink } from "node:fs/promises";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { context, getOctokit } from "@actions/github";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePackage } from "workspaces-effect";
import { findWorkspaceRootSync, getWorkspacePackagesSync } from "workspaces-effect";
import { detectPublishableChanges } from "../src/utils/detect-publishable-changes.js";
import { cleanupTestEnvironment, createMockOctokit, setupTestEnvironment } from "./utils/github-mocks.js";
import type { MockOctokit } from "./utils/test-types.js";

// Mock modules
vi.mock("@actions/core");
vi.mock("@actions/exec");
vi.mock("@actions/github");
vi.mock("node:fs/promises");
// Partial mock — keep PublishTarget (and other exports) real because the
// production code transitively constructs PublishTarget instances via
// silk-publishability. Auto-mock triggers BaseEffectError getters at import
// time, so we narrow to the two sync functions we actually stub.
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
		targets?: ReadonlyArray<string | { access?: "public" | "restricted"; protocol?: string; registry?: string }>;
	};
}

const buildWorkspacePackage = (f: WorkspaceFixture): WorkspacePackage =>
	({
		name: f.name,
		path: f.path,
		packageJsonPath: `${f.path}/package.json`,
		relativePath: f.path,
		version: f.version ?? "0.0.0",
		private: f.private ?? false,
		dependencies: {},
		devDependencies: {},
		peerDependencies: {},
		optionalDependencies: {},
	}) as unknown as WorkspacePackage;

describe("detect-publishable-changes", () => {
	let mockOctokit: MockOctokit;

	// Track what the changeset status file should contain
	let changesetStatusContent: string;

	// Track per-path raw package.json contents (used when the code re-reads
	// workspace package.json files for silk rules).
	const pkgJsonByPath = new Map<string, string>();

	const installWorkspaces = (fixtures: WorkspaceFixture[]): void => {
		vi.mocked(findWorkspaceRootSync).mockReturnValue("/test/workspace");
		vi.mocked(getWorkspacePackagesSync).mockReturnValue(fixtures.map(buildWorkspacePackage));
		pkgJsonByPath.clear();
		for (const f of fixtures) {
			pkgJsonByPath.set(
				`${f.path}/package.json`,
				JSON.stringify({
					name: f.name,
					version: f.version,
					private: f.private,
					publishConfig: f.publishConfig,
				}),
			);
		}
	};

	beforeEach(() => {
		setupTestEnvironment({ suppressOutput: true });

		// Default: empty changeset status
		changesetStatusContent = JSON.stringify({ releases: [], changesets: [] });

		// Mock core.summary
		const mockSummary = {
			addHeading: vi.fn().mockReturnThis(),
			addEOL: vi.fn().mockReturnThis(),
			addTable: vi.fn().mockReturnThis(),
			addRaw: vi.fn().mockReturnThis(),
			addCodeBlock: vi.fn().mockReturnThis(),
			write: vi.fn().mockResolvedValue(undefined),
			stringify: vi.fn().mockReturnValue(""),
		};
		Object.defineProperty(core, "summary", { value: mockSummary, writable: true });

		// Setup core mocks
		vi.mocked(core.getInput).mockImplementation((name: string) => {
			if (name === "token") return "test-token";
			return "";
		});
		vi.mocked(core.getState).mockReturnValue("test-token");

		// Setup octokit mock
		mockOctokit = createMockOctokit();
		vi.mocked(getOctokit).mockReturnValue(mockOctokit as unknown as ReturnType<typeof getOctokit>);
		Object.defineProperty(vi.mocked(context), "repo", {
			value: { owner: "test-owner", repo: "test-repo" },
			writable: true,
		});
		Object.defineProperty(vi.mocked(context), "sha", { value: "abc123", writable: true });

		// Default workspaces — empty
		vi.mocked(findWorkspaceRootSync).mockReturnValue("/test/workspace");
		vi.mocked(getWorkspacePackagesSync).mockReturnValue([]);
		pkgJsonByPath.clear();

		// Mock readFile — handles changeset status file, per-workspace package.json,
		// and root package.json fallback for single-package repos.
		vi.mocked(readFile).mockImplementation(async (path: Parameters<typeof readFile>[0]) => {
			const pathStr = String(path);
			if (pathStr.includes("changeset-status")) {
				return changesetStatusContent;
			}
			const perWorkspace = pkgJsonByPath.get(pathStr);
			if (perWorkspace !== undefined) return perWorkspace;
			// Root package.json fallback
			return '{"name": "@test/pkg"}';
		});

		// Mock unlink for cleanup
		vi.mocked(unlink).mockResolvedValue(undefined);

		// Mock exec - just returns success, output is via file
		vi.mocked(exec.exec).mockResolvedValue(0);
	});

	afterEach(() => {
		cleanupTestEnvironment();
	});

	it("should detect no changes when changeset has no releases", async () => {
		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(false);
		expect(result.packages).toEqual([]);
		expect(result.versionOnlyPackages).toEqual([]);
		expect(result.checkId).toBe(12345);
		expect(mockOctokit.rest.checks.create).toHaveBeenCalled();
	});

	it("should detect changes for packages with publishConfig.access", async () => {
		changesetStatusContent = JSON.stringify({
			releases: [
				{ name: "@test/pkg-a", newVersion: "1.0.0", type: "minor" },
				{ name: "@test/pkg-b", newVersion: "2.0.0", type: "major" },
			],
			changesets: [{ id: "change-1", summary: "Test change", releases: [] }],
		});

		installWorkspaces([
			{
				name: "@test/pkg-a",
				path: "/test/workspace/packages/pkg-a",
				publishConfig: { access: "public" },
			},
			{
				name: "@test/pkg-b",
				path: "/test/workspace/packages/pkg-b",
				publishConfig: { access: "public" },
			},
		]);

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(true);
		expect(result.packages.length).toBe(2);
		expect(result.packages[0].name).toBe("@test/pkg-a");
		expect(result.packages[1].name).toBe("@test/pkg-b");
	});

	it("should skip packages with type 'none'", async () => {
		changesetStatusContent = JSON.stringify({
			releases: [
				{ name: "@test/pkg-a", newVersion: "1.0.0", type: "none" },
				{ name: "@test/pkg-b", newVersion: "2.0.0", type: "patch" },
			],
			changesets: [],
		});

		installWorkspaces([
			{
				name: "@test/pkg-a",
				path: "/test/workspace/packages/pkg-a",
				publishConfig: { access: "public" },
			},
			{
				name: "@test/pkg-b",
				path: "/test/workspace/packages/pkg-b",
				publishConfig: { access: "public" },
			},
		]);

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.packages.length).toBe(1);
		expect(result.packages[0].name).toBe("@test/pkg-b");
	});

	it("should use correct changeset command for different package managers", async () => {
		await detectPublishableChanges("pnpm", false);
		expect(exec.exec).toHaveBeenCalledWith(
			"pnpm",
			["exec", "changeset", "status", "--output", expect.stringContaining("changeset-status")],
			expect.any(Object),
		);

		await detectPublishableChanges("yarn", false);
		expect(exec.exec).toHaveBeenCalledWith(
			"yarn",
			["changeset", "status", "--output", expect.stringContaining("changeset-status")],
			expect.any(Object),
		);

		await detectPublishableChanges("npm", false);
		expect(exec.exec).toHaveBeenCalledWith(
			"npx",
			["changeset", "status", "--output", expect.stringContaining("changeset-status")],
			expect.any(Object),
		);
	});

	it("should handle empty status file (no changesets)", async () => {
		changesetStatusContent = "";

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(false);
		expect(result.packages).toEqual([]);
		// Should use info for expected empty output
		expect(core.info).toHaveBeenCalledWith("Changeset status file is empty (no changesets present)");
		expect(core.warning).not.toHaveBeenCalled();
	});

	it("should handle file not created (no changesets or command failed)", async () => {
		// Simulate file not found
		vi.mocked(readFile).mockImplementation(async (path: Parameters<typeof readFile>[0]) => {
			const pathStr = String(path);
			if (pathStr.includes("changeset-status")) {
				const error = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
				error.code = "ENOENT";
				throw error;
			}
			return '{"name": "@test/pkg"}';
		});

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(false);
		expect(result.packages).toEqual([]);
		expect(core.info).toHaveBeenCalledWith(expect.stringContaining("Changeset status file not created"));
		expect(core.warning).not.toHaveBeenCalled();
	});

	it("should warn on malformed JSON from changeset status file", async () => {
		changesetStatusContent = '{"releases": [malformed';

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(false);
		expect(result.packages).toEqual([]);
		expect(core.warning).toHaveBeenCalledWith(expect.stringContaining("Failed to read/parse changeset status"));
	});

	it("should classify packages without publishConfig.access as version-only", async () => {
		changesetStatusContent = JSON.stringify({
			releases: [{ name: "@test/no-access", newVersion: "1.0.0", type: "minor" }],
			changesets: [],
		});

		installWorkspaces([{ name: "@test/no-access", path: "/test/workspace/packages/no-access", private: true }]);

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(true);
		expect(result.packages).toEqual([]);
		expect(result.versionOnlyPackages.length).toBe(1);
		expect(result.versionOnlyPackages[0].name).toBe("@test/no-access");
	});

	it("should warn when package.json is not found", async () => {
		changesetStatusContent = JSON.stringify({
			releases: [{ name: "@test/not-found", newVersion: "1.0.0", type: "minor" }],
			changesets: [],
		});

		installWorkspaces([]);

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(false);
		expect(core.warning).toHaveBeenCalledWith(expect.stringContaining("Could not find package.json"));
	});

	it("should include dry-run mode in output", async () => {
		const result = await detectPublishableChanges("pnpm", true);

		expect(result.checkId).toBe(12345);
		expect(mockOctokit.rest.checks.create).toHaveBeenCalledWith(
			expect.objectContaining({
				name: expect.stringContaining("Dry Run"),
			}),
		);
	});

	it("should handle packages with changesets in output", async () => {
		changesetStatusContent = JSON.stringify({
			releases: [{ name: "@test/pkg-a", newVersion: "1.0.0", type: "minor" }],
			changesets: [
				{ id: "change-1", summary: "Add feature", releases: [{ name: "@test/pkg-a", type: "minor" }] },
				{ id: "change-2", summary: "Fix bug", releases: [{ name: "@test/pkg-a", type: "patch" }] },
			],
		});

		installWorkspaces([
			{
				name: "@test/pkg-a",
				path: "/test/workspace/packages/pkg-a",
				publishConfig: { access: "public" },
			},
		]);

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(true);
		expect(result.packages.length).toBe(1);
	});

	it("should handle package not in workspace", async () => {
		changesetStatusContent = JSON.stringify({
			releases: [{ name: "@test/error-pkg", newVersion: "1.0.0", type: "minor" }],
			changesets: [],
		});

		installWorkspaces([]);

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(false);
		expect(core.warning).toHaveBeenCalledWith(expect.stringContaining("Could not find package.json"));
	});

	it("should capture stderr output from changeset command", async () => {
		vi.mocked(exec.exec).mockImplementation(async (_cmd, _args, options) => {
			if (options?.listeners?.stderr) {
				options.listeners.stderr(Buffer.from("Warning: Some changeset issue\n"));
			}
			return 0;
		});

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(false);
	});

	it("should capture stdout output from changeset command", async () => {
		vi.mocked(exec.exec).mockImplementation(async (_cmd, _args, options) => {
			if (options?.listeners?.stdout) {
				options.listeners.stdout(Buffer.from("Some stdout output\n"));
			}
			return 0;
		});

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(false);
		expect(core.info).toHaveBeenCalledWith("Changeset stdout: Some stdout output");
	});

	it("should throw on changeset ValidationError", async () => {
		const validationError = `🦋  error The package "@test/pkg-a" depends on the ignored package "@test/builder", but "@test/pkg-a" is not being ignored.
🦋  error     at parse (/node_modules/@changesets/config/dist/changesets-config.cjs.js:317:11)
🦋  error     at Object.read (/node_modules/@changesets/config/dist/changesets-config.cjs.js:143:10)
🦋  error   _error: Error
🦋  error       at new ValidationError (/node_modules/@changesets/errors/dist/changesets-errors.cjs.js:18:1)`;

		vi.mocked(exec.exec).mockImplementation(async (_cmd, _args, options) => {
			if (options?.listeners?.stderr) {
				options.listeners.stderr(Buffer.from(validationError));
			}
			return 1;
		});

		await expect(detectPublishableChanges("pnpm", false)).rejects.toThrow("Changeset configuration is invalid");
		expect(core.error).toHaveBeenCalledWith(expect.stringContaining("depends on the ignored package"));
	});

	it("should not throw on non-validation changeset errors", async () => {
		// Some other error that's not a ValidationError
		vi.mocked(exec.exec).mockImplementation(async (_cmd, _args, options) => {
			if (options?.listeners?.stderr) {
				options.listeners.stderr(Buffer.from("Some other error\n"));
			}
			return 1;
		});

		// Should not throw, just return no changes
		const result = await detectPublishableChanges("pnpm", false);
		expect(result.hasChanges).toBe(false);
	});

	it("should find package from root package.json when not in workspaces", async () => {
		changesetStatusContent = JSON.stringify({
			releases: [{ name: "@test/root-pkg", newVersion: "1.0.0", type: "minor" }],
			changesets: [],
		});

		// No workspaces, but root package.json matches
		installWorkspaces([]);
		vi.mocked(readFile).mockImplementation(async (path: Parameters<typeof readFile>[0]) => {
			const pathStr = String(path);
			if (pathStr.includes("changeset-status")) {
				return changesetStatusContent;
			}
			// Root package.json with publishConfig
			return JSON.stringify({ name: "@test/root-pkg", publishConfig: { access: "public" } });
		});

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(true);
		expect(result.packages.length).toBe(1);
		expect(result.packages[0].name).toBe("@test/root-pkg");
	});

	it("should use bun x for bun package manager", async () => {
		await detectPublishableChanges("bun", false);
		expect(exec.exec).toHaveBeenCalledWith(
			"bun",
			["x", "changeset", "status", "--output", expect.stringContaining("changeset-status")],
			expect.any(Object),
		);
	});

	it("should handle findWorkspaceRootSync returning null", async () => {
		// Simulate workspaces-effect not finding a project root
		vi.mocked(findWorkspaceRootSync).mockReturnValue(null);
		vi.mocked(getWorkspacePackagesSync).mockReturnValue([]);

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(false);
		expect(core.debug).toHaveBeenCalledWith("workspaces-effect findWorkspaceRootSync: null");
	});

	it("should handle getWorkspacePackagesSync throwing an error", async () => {
		vi.mocked(findWorkspaceRootSync).mockReturnValue("/test/workspace");
		vi.mocked(getWorkspacePackagesSync).mockImplementation(() => {
			throw new Error("workspaces-effect error: unsupported lock file");
		});

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(false);
		expect(core.debug).toHaveBeenCalledWith(expect.stringContaining("workspaces-effect failed:"));
	});

	it("should warn when root package.json has no name field", async () => {
		installWorkspaces([]);
		vi.mocked(readFile).mockImplementation(async (path: Parameters<typeof readFile>[0]) => {
			const pathStr = String(path);
			if (pathStr.includes("changeset-status")) {
				return changesetStatusContent;
			}
			// Root package.json without name field
			return JSON.stringify({ version: "1.0.0", publishConfig: { access: "public" } });
		});

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(false);
		expect(core.warning).toHaveBeenCalledWith(
			"Root package.json has no 'name' field - cannot detect package for release",
		);
	});

	it("should warn when root package.json read fails", async () => {
		installWorkspaces([]);
		vi.mocked(readFile).mockImplementation(async (path: Parameters<typeof readFile>[0]) => {
			const pathStr = String(path);
			if (pathStr.includes("changeset-status")) {
				return changesetStatusContent;
			}
			// Simulate read error for root package.json
			throw new Error("EACCES: permission denied");
		});

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(false);
		expect(core.warning).toHaveBeenCalledWith(expect.stringContaining("Failed to read root package.json"));
	});

	it("should skip adding root package when already in workspaces map", async () => {
		changesetStatusContent = JSON.stringify({
			releases: [{ name: "@test/pkg-a", newVersion: "1.0.0", type: "minor" }],
			changesets: [],
		});

		// Workspace already contains the package
		installWorkspaces([
			{
				name: "@test/pkg-a",
				path: "/test/workspace/packages/pkg-a",
				publishConfig: { access: "public" },
			},
		]);

		// Override readFile so that the per-workspace lookup uses our fixture but
		// the root package.json fallback also reports the same name.
		const perWorkspaceContent = pkgJsonByPath.get("/test/workspace/packages/pkg-a/package.json");
		vi.mocked(readFile).mockImplementation(async (path: Parameters<typeof readFile>[0]) => {
			const pathStr = String(path);
			if (pathStr.includes("changeset-status")) {
				return changesetStatusContent;
			}
			if (pathStr === "/test/workspace/packages/pkg-a/package.json" && perWorkspaceContent !== undefined) {
				return perWorkspaceContent;
			}
			return JSON.stringify({ name: "@test/pkg-a", publishConfig: { access: "public" } });
		});

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(true);
		expect(result.packages.length).toBe(1);
		expect(core.debug).toHaveBeenCalledWith('Root package "@test/pkg-a" already in package map from workspaces');
	});

	it("should aggregate releases from changesets when top-level releases is empty", async () => {
		// This happens with private packages where changesets doesn't populate top-level releases
		// but the releases are nested in changesets[].releases
		changesetStatusContent = JSON.stringify({
			releases: [], // Empty top-level releases (private package behavior)
			changesets: [
				{
					id: "feature-change",
					summary: "Add new feature",
					releases: [{ name: "@test/private-pkg", type: "minor" }],
				},
			],
		});

		installWorkspaces([
			{
				name: "@test/private-pkg",
				path: "/test/workspace",
				version: "1.0.0",
				private: true,
				publishConfig: { access: "public", targets: [{ protocol: "npm" }] },
			},
		]);

		const result = await detectPublishableChanges("pnpm", false);

		expect(core.info).toHaveBeenCalledWith("Aggregated 1 release(s) from changesets");
		expect(result.hasChanges).toBe(true);
		expect(result.packages.length).toBe(1);
		expect(result.packages[0].name).toBe("@test/private-pkg");
	});

	it("should not aggregate when top-level releases already has packages", async () => {
		changesetStatusContent = JSON.stringify({
			releases: [{ name: "@test/public-pkg", newVersion: "2.0.0", type: "major" }],
			changesets: [
				{
					id: "breaking-change",
					summary: "Breaking change",
					releases: [{ name: "@test/public-pkg", type: "major" }],
				},
			],
		});

		installWorkspaces([
			{
				name: "@test/public-pkg",
				path: "/test/workspace/packages/public",
				version: "1.0.0",
				publishConfig: { access: "public" },
			},
		]);

		const result = await detectPublishableChanges("pnpm", false);

		// Should NOT have called aggregation
		expect(core.info).not.toHaveBeenCalledWith(expect.stringContaining("Aggregated"));
		expect(result.hasChanges).toBe(true);
		expect(result.packages.length).toBe(1);
	});

	it("should separate publishable and version-only packages in mixed scenario", async () => {
		changesetStatusContent = JSON.stringify({
			releases: [
				{ name: "@test/publishable", newVersion: "1.0.0", type: "minor" },
				{ name: "@test/private-only", newVersion: "2.0.0", type: "patch" },
			],
			changesets: [{ id: "change-1", summary: "Test", releases: [] }],
		});

		installWorkspaces([
			{
				name: "@test/publishable",
				path: "/test/workspace/packages/publishable",
				publishConfig: { access: "public" },
			},
			{
				name: "@test/private-only",
				path: "/test/workspace/packages/private-only",
				private: true,
			},
		]);

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(true);
		expect(result.packages.length).toBe(1);
		expect(result.packages[0].name).toBe("@test/publishable");
		expect(result.versionOnlyPackages.length).toBe(1);
		expect(result.versionOnlyPackages[0].name).toBe("@test/private-only");
	});

	it("should treat private package with publishConfig.targets as publishable (silk rules)", async () => {
		changesetStatusContent = JSON.stringify({
			releases: [{ name: "@test/silk-pkg", newVersion: "1.0.0", type: "minor" }],
			changesets: [],
		});

		installWorkspaces([
			{
				name: "@test/silk-pkg",
				path: "/test/workspace/packages/silk-pkg",
				private: true,
				publishConfig: { access: "restricted", targets: ["npm", "github"] },
			},
		]);

		const result = await detectPublishableChanges("pnpm", false);

		expect(result.hasChanges).toBe(true);
		expect(result.packages.length).toBe(1);
		expect(result.packages[0].name).toBe("@test/silk-pkg");
		expect(result.versionOnlyPackages.length).toBe(0);
	});

	it("should deduplicate packages when aggregating from multiple changesets", async () => {
		changesetStatusContent = JSON.stringify({
			releases: [],
			changesets: [
				{
					id: "change-1",
					summary: "Feature 1",
					releases: [{ name: "@test/pkg", type: "minor" }],
				},
				{
					id: "change-2",
					summary: "Feature 2",
					releases: [{ name: "@test/pkg", type: "patch" }], // Same package, different type
				},
			],
		});

		installWorkspaces([
			{
				name: "@test/pkg",
				path: "/test/workspace",
				version: "1.0.0",
				private: true,
				publishConfig: { access: "public" },
			},
		]);

		const result = await detectPublishableChanges("pnpm", false);

		// Should only aggregate once (first occurrence wins)
		expect(core.info).toHaveBeenCalledWith("Aggregated 1 release(s) from changesets");
		expect(result.hasChanges).toBe(true);
		expect(result.packages.length).toBe(1);
	});
});
