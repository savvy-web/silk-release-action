// Unit tests for the shared release table.
//
// The assertions that matter here are the two the type system cannot make: that
// a zero changeset count renders as an em dash rather than a `0`, and that a
// package with no changeset still appears as a row. Both encode the fact that a
// dependency-driven release is a real release.

import { describe, expect, it } from "vitest";
import { RELEASE_TABLE_LEGEND, releaseTable, toPendingReleaseRows } from "../src/utils/release-table.js";

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
			expect(row).toContain("⏳ pending validation");
			expect(row).not.toContain("✅");
		}
	});

	it("renders an empty plan as headers with no rows", () => {
		const rendered = releaseTable.render(toPendingReleaseRows([]));

		expect(rendered).toContain("Package");
		expect(rendered.split("\n").filter((line) => line.includes("@scope/"))).toHaveLength(0);
	});

	it("legends every icon the table can emit", () => {
		for (const icon of ["✅", "⏳", "🔴", "🟡", "🟢"]) {
			expect(RELEASE_TABLE_LEGEND).toContain(icon);
		}
	});
});
