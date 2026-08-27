// Unit tests for the shared release table.
//
// The assertions that matter here are the two the type system cannot make: that
// a zero changeset count renders as an em dash rather than a `0`, and that a
// package with no changeset still appears as a row. Both encode the fact that a
// dependency-driven release is a real release.

import { describe, expect, it } from "vitest";
import type { ReleaseRow } from "../src/utils/release-table.js";
import {
	RELEASE_TABLE_LEGEND,
	releaseTable,
	toPendingReleaseRows,
	toValidatedReleaseRows,
} from "../src/utils/release-table.js";

const PLAN = [
	{
		name: "@scope/explicit",
		bumpType: "minor" as const,
		changesetCount: 2,
		oldVersion: "1.4.0",
		newVersion: "1.5.0",
	},
	{
		name: "@scope/dependent",
		bumpType: "patch" as const,
		changesetCount: 0,
		oldVersion: "2.0.3",
		newVersion: "2.0.4",
	},
	{
		name: "@scope/breaking",
		bumpType: "major" as const,
		changesetCount: 1,
		oldVersion: "0.9.9",
		newVersion: "1.0.0",
	},
];

describe("releaseTable", () => {
	it("renders a package with no changeset as an em dash, never a zero", () => {
		const rendered = releaseTable.render(toPendingReleaseRows(PLAN));
		const dependentRow = rendered.split("\n").find((line) => line.includes("@scope/dependent"));

		expect(dependentRow).toBeDefined();
		expect(dependentRow).toContain("| — |");
		// The discriminating half: a `0` here would read as "nothing to release"
		// for a package that is in fact being versioned and changelogged.
		expect(dependentRow).not.toContain("| 0 |");
	});

	it("keeps a dependency-driven package as a row of its own", () => {
		const rendered = releaseTable.render(toPendingReleaseRows(PLAN));

		// Every planned package appears, whether or not a changeset named it.
		expect(rendered).toContain("@scope/explicit");
		expect(rendered).toContain("@scope/dependent");
		expect(rendered).toContain("@scope/breaking");
	});

	it("renders the version transition as one column", () => {
		const rendered = releaseTable.render(toPendingReleaseRows(PLAN));

		expect(rendered).toContain("1.4.0 → 1.5.0");
		expect(rendered).toContain("0.9.9 → 1.0.0");
	});

	it("marks bump severity distinctly per level", () => {
		const rendered = releaseTable.render(toPendingReleaseRows(PLAN));

		expect(rendered).toContain("🔴 major");
		expect(rendered).toContain("🟡 minor");
		expect(rendered).toContain("🟢 patch");
	});

	it("takes its headers from the schema's title annotations", () => {
		const header = releaseTable.render(toPendingReleaseRows(PLAN)).split("\n")[0];

		expect(header).toContain("Package");
		expect(header).toContain("Current → Next");
		expect(header).toContain("Bump");
		expect(header).toContain("Changesets");
		expect(header).toContain("Targets");
	});

	it("leaves publish readiness pending rather than blank or assumed", () => {
		const rendered = releaseTable.render(toPendingReleaseRows(PLAN));
		const rows = rendered.split("\n").filter((line) => line.includes("@scope/"));

		// A blank cell would be indistinguishable from "no targets"; a ✅ would
		// claim a validation result Phase 1 has not got.
		expect(rows).toHaveLength(3);
		for (const row of rows) {
			expect(row).toContain("| pending |");
			// The hourglass belongs to the status column; repeating it here
			// duplicated the signal and widened the row.
			expect(row).not.toContain("⏳ pending");
			expect(row).not.toContain("✅");
		}
	});

	it("renders an empty plan as headers with no rows", () => {
		const rendered = releaseTable.render(toPendingReleaseRows([]));

		expect(rendered).toContain("Package");
		expect(rendered.split("\n").filter((line) => line.includes("@scope/"))).toHaveLength(0);
	});

	it("legends every icon the table can emit", () => {
		// `⏭️` (no targets) and `❌` (failed) are emitted by `toValidatedReleaseRows`
		// alongside the plan icons. Omitting them here let a legend that dropped
		// either one still pass.
		for (const icon of ["✅", "⏳", "⏭️", "❌", "🔴", "🟡", "🟢"]) {
			expect(RELEASE_TABLE_LEGEND).toContain(icon);
		}
	});
});

const target = (status: "ready" | "skipped" | "failed") => ({ status });

describe("toValidatedReleaseRows", () => {
	it("reports a package with no builds as GitHub-release-only, not as skipped", () => {
		const [row] = toValidatedReleaseRows([
			{ name: "@scope/version-only", version: "1.1.0", baseVersion: "1.0.0", changesetCount: 1, builds: [] },
		]);
		const rendered = releaseTable.render([row as ReleaseRow]);

		// `0/0 ready` would read as a problem for a package that is simply not
		// published — versioned and changelogged, but with nothing to upload.
		expect(rendered).not.toContain("0/0");
		// The cell must name what the package DOES get (a tag and a GitHub
		// release), not what it lacks. `⏭️ no targets` said the opposite: the
		// skip glyph reads as "this was passed over", and a private tracking
		// package is not passed over — this is its whole release.
		expect(rendered).toContain("🏷️ GitHub release only");
		expect(rendered).not.toContain("⏭️");
		expect(rendered).not.toContain("no targets");
	});

	it("counts ready targets across every build of a package", () => {
		const [row] = toValidatedReleaseRows([
			{
				name: "@scope/multi",
				version: "2.0.0",
				baseVersion: "1.9.0",
				changesetCount: 1,
				builds: [{ targets: [target("ready"), target("ready")] }, { targets: [target("ready")] }],
			},
		]);

		expect(releaseTable.render([row as ReleaseRow])).toContain("✅ 3/3 ready");
	});

	it("reports failure over readiness when any target failed", () => {
		const [row] = toValidatedReleaseRows([
			{
				name: "@scope/broken",
				version: "1.0.1",
				baseVersion: "1.0.0",
				changesetCount: 1,
				builds: [{ targets: [target("ready"), target("failed")] }],
			},
		]);
		const rendered = releaseTable.render([row as ReleaseRow]);

		// A row that is half-ready is not ready; the failure is the headline.
		expect(rendered).toContain("❌ 1/2 failed");
		expect(rendered).not.toContain("✅ 1/2 ready");
	});

	it("counts a skipped target as neither ready nor failed", () => {
		const [row] = toValidatedReleaseRows([
			{
				name: "@scope/partly-skipped",
				version: "1.0.1",
				baseVersion: "1.0.0",
				changesetCount: 1,
				builds: [{ targets: [target("ready"), target("skipped")] }],
			},
		]);

		// "Already published, identical" is a success for the release even though
		// nothing was uploaded — so it inflates neither bucket.
		expect(releaseTable.render([row as ReleaseRow])).toContain("✅ 1/2 ready");
	});

	it("renders a brand-new package as new → version", () => {
		const [row] = toValidatedReleaseRows([
			{
				name: "@scope/fresh",
				version: "0.1.0",
				baseVersion: null,
				changesetCount: 1,
				builds: [{ targets: [target("ready")] }],
			},
		]);
		const rendered = releaseTable.render([row as ReleaseRow]);

		expect(rendered).toContain("new → 0.1.0");
		expect(rendered).not.toContain("null");
	});

	it("recovers the bump from the version transition", () => {
		const rows = toValidatedReleaseRows([
			{ name: "@scope/maj", version: "2.0.0", baseVersion: "1.9.9", changesetCount: 1, builds: [] },
			{ name: "@scope/min", version: "1.3.0", baseVersion: "1.2.9", changesetCount: 1, builds: [] },
			{ name: "@scope/pat", version: "1.2.4", baseVersion: "1.2.3", changesetCount: 1, builds: [] },
		]);
		const rendered = releaseTable.render(rows);

		// Phase 2 has no changeset files left to read — `apply` consumed them.
		expect(rendered).toContain("🔴 major");
		expect(rendered).toContain("🟡 minor");
		expect(rendered).toContain("🟢 patch");
	});

	it("reports a prerelease major transition as major, not patch", () => {
		// `"2.0.0-rc.1".split(".")` yields `["2","0","0-rc","1"]`, whose third
		// element is `NaN` — which sent the guard down the `patch` path and rendered
		// a MAJOR transition as `🟢 patch`. The severity column would understate
		// every prerelease.
		const rows = toValidatedReleaseRows([
			{ name: "@scope/rc-major", version: "2.0.0-rc.1", baseVersion: "1.9.9", changesetCount: 1, builds: [] },
			{ name: "@scope/rc-minor", version: "1.3.0-beta.0", baseVersion: "1.2.9", changesetCount: 1, builds: [] },
			{ name: "@scope/rc-patch", version: "1.2.4-alpha.2", baseVersion: "1.2.3", changesetCount: 1, builds: [] },
		]);

		expect(rows[0]?.bump).toBe("major");
		expect(rows[1]?.bump).toBe("minor");
		expect(rows[2]?.bump).toBe("patch");
	});

	it("reports a bump across build metadata honestly", () => {
		// `+build` suffixes trip the same `Number` parse as `-prerelease`.
		const [row] = toValidatedReleaseRows([
			{ name: "@scope/build", version: "2.0.0+20260727", baseVersion: "1.0.0", changesetCount: 1, builds: [] },
		]);

		expect(row?.bump).toBe("major");
	});

	it("still falls back to patch when a version is genuinely unparseable", () => {
		// The documented behaviour for a version that is not SemVer at all:
		// understating severity beats overstating it.
		const [row] = toValidatedReleaseRows([
			{ name: "@scope/weird", version: "not-a-version", baseVersion: "1.0.0", changesetCount: 1, builds: [] },
		]);

		expect(row?.bump).toBe("patch");
	});

	it("still renders an unknown changeset count as an em dash", () => {
		const [row] = toValidatedReleaseRows([
			{
				name: "@scope/unknown",
				version: "1.0.1",
				baseVersion: "1.0.0",
				changesetCount: null,
				builds: [{ targets: [target("ready")] }],
			},
		]);

		expect(releaseTable.render([row as ReleaseRow])).toContain("| — |");
	});
});
