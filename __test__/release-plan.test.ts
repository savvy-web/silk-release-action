// Unit tests for the release-plan projection.
//
// Two production defects live in this mapping's history, and each has a test
// below that fails if it returns:
//
//   1. A dependency-driven package was invisible, because the report was built
//      from the changeset files rather than from the plan.
//   2. The changeset count was derived from the package list, which is a
//      different number in both directions.
//
// The fixtures are deliberately asymmetric — a differing number of packages and
// files, non-alphabetical order, two files naming one package — so a mapping
// that happened to agree by coincidence on a one-file-one-package release still
// goes red here.

import { describe, expect, it } from "vitest";
import type { PlanLike } from "../src/utils/release-plan.js";
import { toReleasePlanReport } from "../src/utils/release-plan.js";

/** One changeset for `zulu`; `alpha` releases only because it depends on it. */
const DEPENDENCY_DRIVEN: PlanLike = {
	releases: [
		{ name: "@scope/zulu", type: "minor", oldVersion: "1.4.0", newVersion: "1.5.0", changesets: ["brave-cats"] },
		{ name: "@scope/alpha", type: "patch", oldVersion: "2.0.3", newVersion: "2.0.4", changesets: [] },
	],
	changesets: [{ id: "brave-cats" }],
};

describe("toReleasePlanReport", () => {
	it("includes a package that releases only because a dependency did", () => {
		const report = toReleasePlanReport(DEPENDENCY_DRIVEN);

		// The defect this replaces: `@scope/alpha` has no changeset, so a report
		// built from the files could not see it — while the release versions it
		// and writes it a CHANGELOG entry.
		expect(report.packages.map((p) => p.name)).toEqual(["@scope/zulu", "@scope/alpha"]);
	});

	it("marks a dependency-driven package with a zero changeset count", () => {
		const report = toReleasePlanReport(DEPENDENCY_DRIVEN);
		const alpha = report.packages.find((p) => p.name === "@scope/alpha");

		expect(alpha?.changesetCount).toBe(0);
	});

	it("counts changeset FILES, not released packages", () => {
		const report = toReleasePlanReport(DEPENDENCY_DRIVEN);

		// Two packages, one file. Deriving the count from `packages.length` would
		// report 2 — the exact misreport the schema documents against.
		expect(report.packages).toHaveLength(2);
		expect(report.changesetFileCount).toBe(1);
	});

	it("counts two files naming one package as two, not one", () => {
		// The other direction: fewer packages than files.
		const report = toReleasePlanReport({
			releases: [
				{
					name: "@scope/solo",
					type: "major",
					oldVersion: "1.0.0",
					newVersion: "2.0.0",
					changesets: ["one", "two"],
				},
			],
			changesets: [{ id: "one" }, { id: "two" }],
		});

		expect(report.packages).toHaveLength(1);
		expect(report.changesetFileCount).toBe(2);
		expect(report.packages[0]?.changesetCount).toBe(2);
	});

	it("carries the version transition from the plan", () => {
		const report = toReleasePlanReport(DEPENDENCY_DRIVEN);
		const zulu = report.packages.find((p) => p.name === "@scope/zulu");

		expect(zulu?.oldVersion).toBe("1.4.0");
		expect(zulu?.newVersion).toBe("1.5.0");
	});

	it("preserves the plan's own bump per package rather than one bump for the release", () => {
		const report = toReleasePlanReport(DEPENDENCY_DRIVEN);

		// A single release routinely mixes levels — the dependent takes a patch
		// while the package that changed takes a minor.
		expect(report.packages.map((p) => p.bumpType)).toEqual(["minor", "patch"]);
	});

	it("preserves the plan's ordering rather than sorting", () => {
		// `zulu` before `alpha` is not alphabetical, so a stray sort shows up here
		// instead of hiding behind a fixture that was already in order.
		expect(toReleasePlanReport(DEPENDENCY_DRIVEN).packages.map((p) => p.name)).toEqual(["@scope/zulu", "@scope/alpha"]);
	});

	it("reports an empty plan as no packages and no files", () => {
		const report = toReleasePlanReport({ releases: [], changesets: [] });

		expect(report.packages).toEqual([]);
		expect(report.changesetFileCount).toBe(0);
	});

	it("drops a package the plan decided not to version", () => {
		// A `"none"` release has no new version and no changelog entry, so it is
		// not part of "what will be released" and has no honest bump to show.
		const report = toReleasePlanReport({
			releases: [
				{ name: "@scope/bumped", type: "patch", oldVersion: "1.0.0", newVersion: "1.0.1", changesets: ["c"] },
				{ name: "@scope/untouched", type: "none", oldVersion: "3.0.0", newVersion: "3.0.0", changesets: [] },
			],
			changesets: [{ id: "c" }],
		});

		expect(report.packages.map((p) => p.name)).toEqual(["@scope/bumped"]);
	});

	it("reports files that release nothing", () => {
		// A changeset naming only unpublishable packages plans no releases. The
		// file still exists, and reporting zero for it would hide that someone
		// wrote a changeset which did nothing.
		const report = toReleasePlanReport({ releases: [], changesets: [{ id: "orphan" }] });

		expect(report.packages).toEqual([]);
		expect(report.changesetFileCount).toBe(1);
	});
});
