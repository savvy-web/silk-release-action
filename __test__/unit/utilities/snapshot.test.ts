import { describe, expect, it } from "vitest";
import type { PublishPackagesResult } from "../../../src/release/types.js";
import { checkSnapshotRef, findDanglingDependencies } from "../../../src/utils/snapshot.js";

const BRANCHES = { releaseBranch: "changeset-release/main", targetBranch: "main" };

describe("checkSnapshotRef", () => {
	it("accepts a feature branch and returns its short name", () => {
		expect(checkSnapshotRef("refs/heads/feat/lockfile-integrity", BRANCHES)).toEqual({
			ok: true,
			branch: "feat/lockfile-integrity",
		});
	});

	it.each([
		["refs/tags/v1.0.0", /not a branch/],
		["refs/tags/main", /not a branch/],
		["refs/pull/12/merge", /not a branch/],
		["main", /not a branch/],
		["refs/heads/main", /target branch/],
		["refs/heads/changeset-release/main", /release branch/],
		["refs/heads/", /not a branch/],
	])("refuses %s", (ref, reason) => {
		const result = checkSnapshotRef(ref, BRANCHES);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(reason);
	});

	it("honours custom branch names", () => {
		expect(checkSnapshotRef("refs/heads/trunk", { releaseBranch: "rel", targetBranch: "trunk" }).ok).toBe(false);
		expect(checkSnapshotRef("refs/heads/main", { releaseBranch: "rel", targetBranch: "trunk" }).ok).toBe(true);
	});
});

describe("findDanglingDependencies", () => {
	const target = (name: string, overrides: Record<string, unknown> = {}) => ({
		target: {
			name,
			protocol: "npm" as const,
			registry: "https://registry.npmjs.org/",
			directory: `/repo/${name}`,
			access: "public" as const,
			provenance: true,
			tag: "next",
			tokenEnv: null,
		},
		success: true,
		status: "published" as const,
		...overrides,
	});
	const result = (packages: PublishPackagesResult["packages"]): PublishPackagesResult => ({
		success: true,
		packages,
		totalPackages: packages.length,
		successfulPackages: packages.length,
		totalTargets: packages.length,
		successfulTargets: packages.length,
	});
	const releases = [
		{ name: "a", newVersion: "1.0.0-next-1" },
		{ name: "b", newVersion: "2.0.0-next-1" },
	];
	const deps = new Map([
		["a", ["b", "lodash"]],
		["b", []],
	]);

	it.each([
		["never-published", { status: "skipped", skipReason: "never-published" }],
		["failed", { success: false, status: "failed", error: "E403" }],
	])("names a published dependent of a bumped dependency that was %s", (_label, betaOverrides) => {
		const publish = result([
			{ name: "a", version: "1.0.0-next-1", targets: [target("a")] },
			{ name: "b", version: "2.0.0-next-1", targets: [target("b", betaOverrides)] },
		]);
		expect(findDanglingDependencies(releases, deps, publish)).toEqual([
			{ dependent: "a", dependentVersion: "1.0.0-next-1", dependency: "b", version: "2.0.0-next-1" },
		]);
	});

	it("counts an already-published-identical target as published", () => {
		const publish = result([
			{ name: "a", version: "1.0.0-next-1", targets: [target("a")] },
			{
				name: "b",
				version: "2.0.0-next-1",
				targets: [target("b", { status: "skipped", skipReason: "already-published-identical" })],
			},
		]);
		expect(findDanglingDependencies(releases, deps, publish)).toEqual([]);
	});

	it("reports nothing for an unpublished dependent: nobody can install it", () => {
		const publish = result([
			{ name: "a", version: "1.0.0-next-1", targets: [target("a", { status: "skipped", skipReason: "dry-run" })] },
			{ name: "b", version: "2.0.0-next-1", targets: [target("b", { status: "skipped", skipReason: "dry-run" })] },
		]);
		expect(findDanglingDependencies(releases, deps, publish)).toEqual([]);
	});
});
