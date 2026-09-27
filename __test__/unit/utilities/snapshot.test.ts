import { describe, expect, it } from "vitest";
import { checkSnapshotRef } from "../../../src/utils/snapshot.js";

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
