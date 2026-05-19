import { describe, expect, it } from "vitest";
import type { ValidationOutput } from "../schema/release-output.js";
import {
	buildChecksTable,
	buildFindingsTable,
	buildPublishSummary,
	buildValidationComment,
	getPackagePageUrl,
} from "./report.js";

// ─── Type aliases for the build-centric ValidationOutput sub-structs ──────────

type ValidationPayload = ValidationOutput["validation"];
type ValidationPublish = ValidationPayload["publish"];
type ValidationPublishPackage = ValidationPublish["packages"][number];
type ValidationBuild = ValidationPublishPackage["builds"][number];
type ValidationBuildTarget = ValidationBuild["targets"][number];
type ValidationCheck = ValidationPayload["checks"][number];
type ValidationFinding = ValidationPayload["findings"][number];

// ─── Factories ────────────────────────────────────────────────────────────────

/** A ready npm registry target with provenance enabled. */
function npmTarget(overrides?: Partial<ValidationBuildTarget>): ValidationBuildTarget {
	return {
		registry: "https://registry.npmjs.org/",
		status: "ready",
		access: "public",
		provenance: true,
		...overrides,
	};
}

/** A ready GitHub Packages target with provenance disabled. */
function ghTarget(overrides?: Partial<ValidationBuildTarget>): ValidationBuildTarget {
	return {
		registry: "https://npm.pkg.github.com/",
		status: "ready",
		access: "public",
		provenance: false,
		...overrides,
	};
}

/** A build directory with sizes, SBOM, and registry targets. */
function build(overrides?: Partial<ValidationBuild>): ValidationBuild {
	return {
		directory: "dist/npm",
		packedBytes: 716,
		unpackedBytes: 2300,
		fileCount: 5,
		sbom: { componentCount: 3, ntiaCompliant: true, missingNtiaFields: [] },
		targets: [npmTarget()],
		...overrides,
	};
}

/** A released package with one build. */
function pkg(overrides?: Partial<ValidationPublishPackage>): ValidationPublishPackage {
	return {
		name: "@savvy-web/linked-1",
		version: "5.0.13",
		baseVersion: "5.0.12",
		bumpType: "patch",
		changesetCount: 1,
		ready: true,
		versionOnly: false,
		builds: [build()],
		...overrides,
	};
}

/** A publish payload around a list of packages. */
function publishOf(packages: ReadonlyArray<ValidationPublishPackage>): ValidationPublish {
	let totalTargets = 0;
	let readyTargets = 0;
	for (const p of packages) {
		for (const b of p.builds) {
			for (const t of b.targets) {
				totalTargets++;
				if (t.status !== "failed") readyTargets++;
			}
		}
	}
	return {
		npmReady: true,
		githubPackagesReady: true,
		totalTargets,
		readyTargets,
		packages,
	};
}

/** A validation payload around a publish payload + checks/findings. */
function validationOf(overrides?: Partial<ValidationPayload>): ValidationPayload {
	return {
		buildValidation: { passed: true, packageCount: 0 },
		checks: [],
		findings: [],
		publish: publishOf([]),
		checkRun: null,
		...overrides,
	};
}

const passingChecks: ReadonlyArray<ValidationCheck> = [
	{ name: "Build Validation", status: "pass", outcome: "Build passed", url: "https://example.com/runs/1" },
	{ name: "Publish Validation", status: "pass", outcome: "1/1 target(s) ready", url: "https://example.com/runs/1" },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getPackagePageUrl", () => {
	it("returns npmjs.com URL for npm registry", () => {
		const url = getPackagePageUrl("https://registry.npmjs.org/", "@org/my-pkg", "1.2.3");
		expect(url).toBe("https://www.npmjs.com/package/@org/my-pkg/v/1.2.3");
	});

	it("returns GitHub Packages URL for github registry", () => {
		const url = getPackagePageUrl("https://npm.pkg.github.com/", "@savvy-web/my-pkg", "2.0.0", "savvy-web");
		expect(url).toBe("https://github.com/orgs/savvy-web/packages/npm/package/my-pkg");
	});

	it("returns undefined for custom registry", () => {
		const url = getPackagePageUrl("https://my-custom-registry.example.com/", "@org/pkg", "1.0.0");
		expect(url).toBeUndefined();
	});

	it("returns jsr.io URL when registry is null", () => {
		const url = getPackagePageUrl(null, "@jsr/pkg", "0.1.0");
		expect(url).toBe("https://jsr.io/@jsr/pkg@0.1.0");
	});
});

describe("buildPublishSummary", () => {
	it("frames the report as 'What will be released', never 'Published'", () => {
		const markdown = buildPublishSummary(publishOf([]));
		expect(markdown).toContain("What will be released");
		expect(markdown).not.toContain("Publish Results");
		expect(markdown).not.toContain("Published");
		expect(markdown).toContain("On merge, these packages publish:");
	});

	it("includes the dry-run indicator in the header when dryRun is true", () => {
		const markdown = buildPublishSummary(publishOf([]), { dryRun: true });
		expect(markdown).toContain("Dry Run");
	});

	it("renders the current → next version transition for a bumped package", () => {
		const markdown = buildPublishSummary(publishOf([pkg()]));
		expect(markdown).toContain("5.0.12 → 5.0.13");
	});

	it("renders a patch bump emoji and label from the precomputed bumpType", () => {
		const markdown = buildPublishSummary(publishOf([pkg({ bumpType: "patch" })]));
		expect(markdown).toContain("\u{1F7E2} patch");
	});

	it("renders a minor bump emoji and label from the precomputed bumpType", () => {
		const markdown = buildPublishSummary(publishOf([pkg({ bumpType: "minor" })]));
		expect(markdown).toContain("\u{1F7E1} minor");
	});

	it("renders a major bump emoji and label from the precomputed bumpType", () => {
		const markdown = buildPublishSummary(publishOf([pkg({ bumpType: "major" })]));
		expect(markdown).toContain("\u{1F534} major");
	});

	it("renders a brand-new package (null baseVersion) as '— → version' with a 🆕 new bump", () => {
		const markdown = buildPublishSummary(
			publishOf([pkg({ name: "@org/brand-new", version: "1.0.0", baseVersion: null, bumpType: "new" })]),
		);
		expect(markdown).toContain("— → 1.0.0");
		expect(markdown).toContain("\u{1F195} new");
	});

	it("renders the changeset count, and '—' when it is null", () => {
		const withCountMd = buildPublishSummary(publishOf([pkg({ name: "@org/with-count", changesetCount: 3 })]));
		const noCountMd = buildPublishSummary(publishOf([pkg({ name: "@org/no-count", changesetCount: null })]));
		expect(withCountMd).toContain("| 3 |");
		expect(noCountMd).toContain("| — |");
	});

	it("renders the build directory, sizes, and SBOM line in the Details block", () => {
		const markdown = buildPublishSummary(publishOf([pkg()]));
		expect(markdown).toContain("<details>");
		expect(markdown).toContain("`dist/npm`");
		expect(markdown).toContain("0.7 kB");
		expect(markdown).toContain("2.3 kB");
		expect(markdown).toContain("5 files");
		expect(markdown).toContain("SBOM: 3 components · NTIA ✅");
	});

	it("renders the SBOM NTIA ⚠️ marker when the build is not NTIA-compliant", () => {
		const nonCompliant = build({
			sbom: { componentCount: 3, ntiaCompliant: false, missingNtiaFields: ["Supplier"] },
		});
		const markdown = buildPublishSummary(publishOf([pkg({ builds: [nonCompliant] })]));
		expect(markdown).toContain("NTIA ⚠️");
	});

	it("omits the SBOM line when a build has no SBOM", () => {
		const noSbom = build({ sbom: null });
		const markdown = buildPublishSummary(publishOf([pkg({ builds: [noSbom] })]));
		expect(markdown).not.toContain("SBOM:");
	});

	it("renders '—' for a build whose sizes were not reported", () => {
		const noSizes = build({ packedBytes: null, unpackedBytes: null, fileCount: null });
		const markdown = buildPublishSummary(publishOf([pkg({ builds: [noSizes] })]));
		expect(markdown).toContain("📦 —");
		expect(markdown).toContain("📂 —");
		expect(markdown).toContain("📄 — files");
	});

	it("renders one section per build directory for a multi-build package", () => {
		const npmBuild = build({
			directory: "dist/npm",
			packedBytes: 716,
			unpackedBytes: 2300,
			fileCount: 5,
			sbom: { componentCount: 3, ntiaCompliant: true, missingNtiaFields: [] },
			targets: [
				npmTarget({ registry: "https://registry.one.com/" }),
				npmTarget({ registry: "https://registry.two.com/" }),
			],
		});
		const githubBuild = build({
			directory: "dist/github",
			packedBytes: 800,
			unpackedBytes: 2500,
			fileCount: 6,
			sbom: { componentCount: 3, ntiaCompliant: false, missingNtiaFields: ["Supplier"] },
			targets: [ghTarget()],
		});

		const markdown = buildPublishSummary(publishOf([pkg({ builds: [npmBuild, githubBuild] })]));

		// Both build directories appear, each with its own headline.
		expect(markdown).toContain("`dist/npm`");
		expect(markdown).toContain("`dist/github`");
		// The npm build's two registries both render under it.
		expect(markdown).toContain("registry.one.com");
		expect(markdown).toContain("registry.two.com");
		// Per-build sizes are distinct.
		expect(markdown).toContain("0.7 kB");
		expect(markdown).toContain("0.8 kB");
		// Per-build SBOM lines are distinct.
		expect(markdown).toContain("SBOM: 3 components · NTIA ✅");
		expect(markdown).toContain("SBOM: 3 components · NTIA ⚠️");
		// The dist/npm headline precedes the dist/github headline.
		expect(markdown.indexOf("`dist/npm`")).toBeLessThan(markdown.indexOf("`dist/github`"));
	});

	it("renders a Totals line summing per-build sizes and file counts", () => {
		const pkgA = pkg({
			name: "@org/pkg-a",
			builds: [build({ packedBytes: 716, unpackedBytes: 2300, fileCount: 5 })],
		});
		const pkgB = pkg({
			name: "@org/pkg-b",
			version: "2.0.1",
			baseVersion: "2.0.0",
			builds: [
				build({ directory: "dist/b", packedBytes: 284, unpackedBytes: 700, fileCount: 3, targets: [ghTarget()] }),
			],
		});

		const markdown = buildPublishSummary(publishOf([pkgA, pkgB]));

		// 716 + 284 = 1000 → 1.0 kB; 2300 + 700 = 3000 → 3.0 kB; 5 + 3 = 8 files.
		expect(markdown).toContain("**Totals:**");
		expect(markdown).toContain("1.0 kB packed");
		expect(markdown).toContain("3.0 kB unpacked");
		expect(markdown).toContain("8 files");
		expect(markdown).toContain("2/2 targets ready");
	});

	it("omits an absent size from the Totals sum", () => {
		const partial = pkg({
			name: "@org/partial-sizes",
			builds: [build({ packedBytes: 500, unpackedBytes: null, fileCount: null })],
		});
		const markdown = buildPublishSummary(publishOf([partial]));
		expect(markdown).toContain("0.5 kB packed");
		expect(markdown).toContain("0 B unpacked");
		expect(markdown).toContain("0 files");
	});

	it("renders a version-only package (no builds) with the 'Version only' targets cell", () => {
		const versionOnly = pkg({ name: "@org/version-only", versionOnly: true, builds: [] });
		const markdown = buildPublishSummary(publishOf([versionOnly]));
		expect(markdown).toContain("Version only");
		expect(markdown).toContain("@org/version-only");
		// A version-only package has no builds, so it must not produce a
		// `<details>` block — that would wrap a header-only output.
		expect(markdown).not.toContain("<details>");
	});

	it("includes the Legend line", () => {
		const markdown = buildPublishSummary(publishOf([pkg()]));
		expect(markdown).toContain("**Legend:**");
		expect(markdown).toContain("🔴 major");
	});

	it("renders provenance ✅ for a configured target and 🚫 for an unconfigured one", () => {
		const provMd = buildPublishSummary(publishOf([pkg({ builds: [build({ targets: [npmTarget()] })] })]));
		const noProvMd = buildPublishSummary(publishOf([pkg({ builds: [build({ targets: [ghTarget()] })] })]));
		expect(provMd).toContain("✅");
		expect(noProvMd).toContain("\u{1F6AB}");
	});

	it("renders a failed target with a ❌ status and a degraded package summary", () => {
		const failedBuild = build({ targets: [npmTarget({ status: "failed" })] });
		const markdown = buildPublishSummary(publishOf([pkg({ ready: false, builds: [failedBuild] })]));
		expect(markdown).toContain("❌ Failed");
	});

	it("renders a skipped target with a ⏭️ status", () => {
		const skippedBuild = build({ targets: [npmTarget({ status: "skipped" })] });
		const markdown = buildPublishSummary(publishOf([pkg({ builds: [skippedBuild] })]));
		expect(markdown).toContain("⏭️ Skipped");
	});
});

describe("buildChecksTable", () => {
	it("renders a linked Check cell when a row carries a url", () => {
		const table = buildChecksTable([
			{ name: "Build Validation", status: "pass", outcome: "Build passed", url: "https://example.com/runs/1" },
		]);
		expect(table).toContain("[Build Validation](https://example.com/runs/1)");
	});

	it("renders a plain Check name when a row has a null url", () => {
		const table = buildChecksTable([{ name: "Build Validation", status: "pass", outcome: "Build passed", url: null }]);
		expect(table).toContain("Build Validation");
		expect(table).not.toContain("](");
	});

	it("renders all three status icons from the status literal", () => {
		const table = buildChecksTable([
			{ name: "Build Validation", status: "pass", outcome: "Build passed", url: null },
			{ name: "SBOM Preview", status: "warning", outcome: "1 NTIA warning", url: null },
			{ name: "Publish Validation", status: "error", outcome: "1 failed", url: null },
		]);
		expect(table).toContain("✅");
		expect(table).toContain("⚠️");
		expect(table).toContain("❌");
	});
});

describe("buildFindingsTable", () => {
	it("returns an empty string when there are no findings", () => {
		expect(buildFindingsTable([])).toBe("");
	});

	it("orders errors before warnings regardless of discovery order", () => {
		const findings: ReadonlyArray<ValidationFinding> = [
			{
				severity: "warning",
				check: "SBOM Preview",
				scope: { package: "@org/a", directory: null },
				message: "missing NTIA fields",
			},
			{
				severity: "error",
				check: "Publish Validation",
				scope: { package: "@org/b", directory: null },
				message: "dry-run failed",
			},
		];

		const table = buildFindingsTable(findings);
		const errorIdx = table.indexOf("dry-run failed");
		const warningIdx = table.indexOf("missing NTIA fields");

		expect(errorIdx).toBeGreaterThan(-1);
		expect(warningIdx).toBeGreaterThan(-1);
		expect(errorIdx).toBeLessThan(warningIdx);
	});

	it("omits the error side of the heading when there are no errors", () => {
		const table = buildFindingsTable([
			{
				severity: "warning",
				check: "SBOM Preview",
				scope: { package: "@org/a", directory: null },
				message: "missing NTIA fields",
			},
		]);
		expect(table).toContain("### ⚠️ 1 warning");
		expect(table).not.toContain("error");
	});

	it("omits the warning side of the heading when there are no warnings", () => {
		const table = buildFindingsTable([
			{ severity: "error", check: "Build Validation", scope: null, message: "tsc exited 2" },
		]);
		expect(table).toContain("### ❌ 1 error");
		expect(table).not.toContain("warning");
	});

	it("pluralises the heading counts", () => {
		const table = buildFindingsTable([
			{ severity: "error", check: "Build Validation", scope: null, message: "a" },
			{ severity: "error", check: "Publish Validation", scope: null, message: "b" },
			{ severity: "warning", check: "SBOM Preview", scope: null, message: "c" },
			{ severity: "warning", check: "SBOM Preview", scope: null, message: "d" },
		]);
		expect(table).toContain("❌ 2 errors");
		expect(table).toContain("⚠️ 2 warnings");
	});

	it("renders '—' in the Package column for a repo-wide finding with no scope", () => {
		const table = buildFindingsTable([
			{ severity: "error", check: "Build Validation", scope: null, message: "tsc exited 2" },
		]);
		expect(table).toContain("| — |");
	});

	it("renders the package in the Package column for a package-scoped finding", () => {
		const table = buildFindingsTable([
			{
				severity: "error",
				check: "Publish Validation",
				scope: { package: "@savvy-web/linked-2", directory: null },
				message: "dry-run failed",
			},
		]);
		expect(table).toContain("@savvy-web/linked-2");
	});

	it("renders the package and directory for a build-scoped finding", () => {
		const table = buildFindingsTable([
			{
				severity: "warning",
				check: "SBOM Preview",
				scope: { package: "@savvy-web/linked-2", directory: "dist/npm" },
				message: "missing NTIA fields",
			},
		]);
		expect(table).toContain("@savvy-web/linked-2 · dist/npm");
	});
});

describe("buildValidationComment", () => {
	it("renders a ✅ header icon when there are no findings", () => {
		const comment = buildValidationComment(validationOf({ checks: passingChecks }));
		expect(comment).toContain("## 📦 Release Validation ✅");
	});

	it("renders a ⚠️ header icon when the worst finding is a warning", () => {
		const findings: ReadonlyArray<ValidationFinding> = [
			{
				severity: "warning",
				check: "SBOM Preview",
				scope: { package: "@org/a", directory: null },
				message: "missing NTIA fields",
			},
		];
		const comment = buildValidationComment(validationOf({ checks: passingChecks, findings }));
		expect(comment).toContain("## 📦 Release Validation ⚠️");
	});

	it("renders a ❌ header icon when any finding is an error", () => {
		const findings: ReadonlyArray<ValidationFinding> = [
			{
				severity: "warning",
				check: "SBOM Preview",
				scope: { package: "@org/a", directory: null },
				message: "missing NTIA fields",
			},
			{ severity: "error", check: "Build Validation", scope: null, message: "tsc exited 2" },
		];
		const comment = buildValidationComment(validationOf({ checks: passingChecks, findings }));
		expect(comment).toContain("## 📦 Release Validation ❌");
	});

	it("omits the findings section entirely when there are no findings", () => {
		const comment = buildValidationComment(validationOf({ checks: passingChecks }));
		// The findings-table heading marker must not appear.
		expect(comment).not.toContain("### ❌");
		expect(comment).not.toContain("### ⚠️");
	});

	it("includes the findings table when findings are present", () => {
		const findings: ReadonlyArray<ValidationFinding> = [
			{
				severity: "error",
				check: "Publish Validation",
				scope: { package: "@org/b", directory: null },
				message: "dry-run failed",
			},
		];
		const comment = buildValidationComment(validationOf({ checks: passingChecks, findings }));
		expect(comment).toContain("### ❌ 1 error");
		expect(comment).toContain("dry-run failed");
	});

	it("renders the checks table with linked check names", () => {
		const comment = buildValidationComment(validationOf({ checks: passingChecks }));
		expect(comment).toContain("[Build Validation](https://example.com/runs/1)");
	});

	it("includes the build-centric 'What will be released' publish summary", () => {
		const comment = buildValidationComment(validationOf({ checks: passingChecks, publish: publishOf([pkg()]) }));
		expect(comment).toContain("What will be released");
		expect(comment).toContain("`dist/npm`");
	});

	it("renders the build-grouped Details block for a multi-build package", () => {
		const multiBuild = pkg({
			builds: [
				build({ directory: "dist/npm", targets: [npmTarget()] }),
				build({ directory: "dist/github", packedBytes: 800, targets: [ghTarget()] }),
			],
		});
		const comment = buildValidationComment(validationOf({ checks: passingChecks, publish: publishOf([multiBuild]) }));
		expect(comment).toContain("`dist/npm`");
		expect(comment).toContain("`dist/github`");
	});

	it("links the release-notes section when a check-run url is given", () => {
		const comment = buildValidationComment(validationOf({ checks: passingChecks }), {
			releaseNotesUrl: "https://example.com/runs/9",
		});
		expect(comment).toContain("### 📋 Release Notes Preview");
		expect(comment).toContain("[View detailed release notes →](https://example.com/runs/9)");
	});

	it("renders a release-notes placeholder when no check-run url is given", () => {
		const comment = buildValidationComment(validationOf({ checks: passingChecks }));
		expect(comment).toContain("### 📋 Release Notes Preview");
		expect(comment).toContain("Release notes will be generated on merge");
	});

	it("includes the dry-run banner when dryRun is true", () => {
		const comment = buildValidationComment(validationOf({ checks: passingChecks }), { dryRun: true });
		expect(comment).toContain("DRY RUN MODE");
	});

	it("omits the dry-run banner when dryRun is false", () => {
		const comment = buildValidationComment(validationOf({ checks: passingChecks }));
		expect(comment).not.toContain("DRY RUN MODE");
	});

	it("ends with the updated-at footer rendered from the injected `now`", () => {
		const now = new Date("2026-05-19T12:34:56.000Z");
		const comment = buildValidationComment(validationOf({ checks: passingChecks }), { now });
		expect(comment).toContain("<sub>Updated at 2026-05-19T12:34:56.000Z</sub>");
	});
});
