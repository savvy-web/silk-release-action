import { Contact, SbomMetadata, Supplier } from "@effected/sbom";
import { describe, expect, it } from "vitest";
import {
	buildChecksTable,
	buildFindingsTable,
	buildPublishSummary,
	buildPublishValidationSummary,
	buildReleaseNotesPreviewSummary,
	buildReleaseTotals,
	buildSbomPreviewSummary,
	buildValidationComment,
	getPackagePageUrl,
} from "../../../src/release/report.js";
import type { ValidationOutput } from "../../../src/schema/release-output.js";
import { summarizeValidationWorkspace } from "../../../src/utils/release-kind.js";

// ─── Type aliases for the build-centric ValidationOutput sub-structs ──────────

type ValidationPayload = ValidationOutput["validation"];
/** The three fields the renderers read as a unit; the payload keys by name. */
type ValidationPublish = Pick<ValidationPayload, "order" | "workspaces">;
/** A workspace with its name grafted on, which is how fixtures are easiest to write. */
type ValidationPublishPackage = ValidationPayload["workspaces"][string] & { readonly name: string };
type ValidationPackage = ValidationPublishPackage["packages"][number];

/**
 * A build directory plus the targets under it — the shape the fixtures are
 * easiest to write in.
 *
 * @remarks
 * The payload is FLAT (one entry per publication, each carrying its own build
 * metadata) so it lines up with what the publish phase reports. Fixtures still
 * describe a build once and list its targets, and `buildsToPackages` flattens
 * them the way the projection does — so a fixture cannot accidentally describe
 * two publications of one tarball with disagreeing sizes.
 */
interface FixtureBuild {
	readonly directory: string;
	readonly packedBytes: number | null;
	readonly unpackedBytes: number | null;
	readonly fileCount: number | null;
	readonly sbom: ValidationPackage["sbom"];
	readonly targets: ReadonlyArray<FixtureTarget>;
}

/** A registry target, before the build metadata is merged onto it. */
interface FixtureTarget {
	readonly name?: string;
	readonly registry: string;
	readonly status: "ready" | "skipped" | "failed";
	readonly access: "public" | "restricted";
	readonly provenance: boolean;
}

type ValidationBuildTarget = FixtureTarget;

/** Flatten fixture builds into the flat publication list the payload carries. */
function buildsToPackages(builds: ReadonlyArray<FixtureBuild>, version: string): ReadonlyArray<ValidationPackage> {
	return builds.flatMap((b) =>
		b.targets.map((t) => ({
			name: t.name ?? "@savvy-web/linked-1",
			version,
			registry: t.registry.includes("npm.pkg.github.com")
				? { name: "GitHub Packages", type: "github-packages" as const, url: t.registry }
				: t.registry.includes("registry.npmjs.org")
					? { name: "npm", type: "npm" as const, url: t.registry }
					: { name: t.registry, type: "custom" as const, url: t.registry },
			outcome: t.status,
			success: t.status === "ready",
			error: null,
			access: t.access,
			provenance: t.provenance,
			directory: b.directory,
			packedBytes: b.packedBytes,
			unpackedBytes: b.unpackedBytes,
			fileCount: b.fileCount,
			sbom: b.sbom,
		})),
	);
}
type ValidationCheck = ValidationPayload["checks"][number];
type ValidationFinding = ValidationPayload["errors"][number];

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
function build(overrides?: Partial<FixtureBuild>): FixtureBuild {
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
function pkg(
	overrides?: Partial<ValidationPublishPackage> & { readonly builds?: ReadonlyArray<FixtureBuild> },
): ValidationPublishPackage {
	const { builds, ...rest } = overrides ?? {};
	const version = rest.version ?? "5.0.13";
	const packages = builds === undefined ? buildsToPackages([build()], version) : buildsToPackages(builds, version);
	// Derive `outcome` and `summary` from the packages, exactly as the
	// projection does. A fixture that let them be set independently could
	// describe a `github-only` workspace as "1 package(s) ready to publish" —
	// which is how the rendering bug this guards against would slip through.
	const ready = packages.filter((p) => p.outcome === "ready").length;
	const failed = packages.filter((p) => p.outcome === "failed").length;
	const outcome =
		packages.length === 0
			? ("nothing-to-validate" as const)
			: failed > 0 && ready > 0
				? ("partial" as const)
				: failed > 0
					? ("failed" as const)
					: ready === 0
						? ("skipped" as const)
						: ("validated" as const);
	return {
		name: "@savvy-web/linked-1",
		version: "5.0.13",
		baseVersion: "5.0.12",
		bumpType: "patch",
		changesetCount: 1,
		success: failed === 0,
		outcome,
		summary: summarizeValidationWorkspace({ outcome, packages: packages.length, ready }),
		kind: packages.length === 0 ? "github-only" : "github-with-packages",
		packages,
		releaseNotes: { status: "found", content: "### Patch Changes\n\n- Sample release note." },
		...rest,
	};
}

/** A publish payload around a list of packages. */
function publishOf(packages: ReadonlyArray<ValidationPublishPackage>): ValidationPublish {
	return {
		order: packages.map((p) => p.name),
		workspaces: Object.fromEntries(packages.map(({ name, ...ws }) => [name, ws] as const)),
	};
}

/** A validation payload around a publish payload + checks/findings. */
function validationOf(
	overrides?: Partial<ValidationPayload> & {
		readonly publish?: ValidationPublish;
		/** Convenience: a flat finding list, split by severity the way the projection does. */
		readonly findings?: ReadonlyArray<ValidationFinding>;
	},
): ValidationPayload {
	const { publish, findings, ...rest } = overrides ?? {};
	const split =
		findings === undefined
			? {}
			: {
					errors: findings.filter((f) => f.severity === "error"),
					warnings: findings.filter((f) => f.severity === "warning"),
				};
	return {
		buildValidation: { passed: true, packageCount: 0 },
		checks: [],
		errors: [],
		warnings: [],
		...publishOf([]),
		...publish,
		...split,
		checkRun: null,
		...rest,
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

		const markdown = buildReleaseTotals(publishOf([pkgA, pkgB]));

		// 716 + 284 = 1000 → 1.0 kB; 2300 + 700 = 3000 → 3.0 kB; 5 + 3 = 8 files.
		expect(markdown).toContain("**Totals:**");
		expect(markdown).toContain("1.0 kB packed");
		expect(markdown).toContain("3.0 kB unpacked");
		expect(markdown).toContain("8 files");
		expect(markdown).toContain("2/2 targets ready");
	});

	it("counts only ready targets in the Totals, matching the release table", () => {
		// `toValidatedReleaseRows` in `src/utils/release-table.ts` counts
		// `status === "ready"`. This used to count every non-`failed` target, so a
		// `skipped` one was reported as ready here and not there — the same release
		// showing two different `n/m ready` figures in two adjacent sections of the
		// same comment.
		const mixed = pkg({
			name: "@org/mixed",
			builds: [
				build({
					targets: [npmTarget(), npmTarget({ status: "skipped" }), npmTarget({ status: "failed" })],
				}),
			],
		});

		const markdown = buildReleaseTotals(publishOf([mixed]));

		expect(markdown).toContain("1/3 targets ready");
	});

	it("omits an absent size from the Totals sum", () => {
		const partial = pkg({
			name: "@org/partial-sizes",
			builds: [build({ packedBytes: 500, unpackedBytes: null, fileCount: null })],
		});
		const markdown = buildReleaseTotals(publishOf([partial]));
		expect(markdown).toContain("0.5 kB packed");
		expect(markdown).toContain("0 B unpacked");
		expect(markdown).toContain("0 files");
	});

	it("renders provenance ✅ for a configured target and 🚫 for an unconfigured one", () => {
		const provMd = buildPublishSummary(publishOf([pkg({ builds: [build({ targets: [npmTarget()] })] })]));
		const noProvMd = buildPublishSummary(publishOf([pkg({ builds: [build({ targets: [ghTarget()] })] })]));
		expect(provMd).toContain("✅");
		expect(noProvMd).toContain("\u{1F6AB}");
	});

	it("renders a failed target with a ❌ status and a degraded package summary", () => {
		const failedBuild = build({ targets: [npmTarget({ status: "failed" })] });
		const markdown = buildPublishSummary(publishOf([pkg({ success: false, builds: [failedBuild] })]));
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

	it("escapes a pipe in cell content so the table does not lose a column", () => {
		// THE DEFECT THIS REPLACES. The predecessor built every table with
		// `join(" | ")` and escaped nothing, so one `|` anywhere in a cell
		// silently shifted every column after it — and `message` carries raw
		// npm stderr, where a pipe is entirely ordinary.
		const findings: ReadonlyArray<ValidationFinding> = [
			{
				severity: "error",
				check: "Publish Validation",
				scope: { package: "@org/a", directory: null },
				message: "dry-run failed: peer range >=1 || <2 unsatisfied",
			},
		];

		const table = buildFindingsTable(findings);
		const bodyRow = table.split("\n").find((line) => line.includes("dry-run failed"));

		expect(bodyRow).toBeDefined();
		// The pipes inside the message are escaped...
		expect(bodyRow).toContain(String.raw`\|\|`);
		// ...so the row still has exactly the delimiter count its header does.
		// (Line 0 is the section heading, not the table — take the first row.)
		const header = table.split("\n").find((line) => line.startsWith("|"));
		const unescapedPipes = (line: string): number => (line.match(/(?<!\\)\|/g) ?? []).length;
		expect(unescapedPipes(bodyRow ?? "")).toBe(unescapedPipes(header ?? ""));
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
		expect(comment).toContain("## ✅ Release Validation");
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
		expect(comment).toContain("## ⚠️ Release Validation");
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
		expect(comment).toContain("## ❌ Release Validation");
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

	it("carries the per-package breakdown without repeating the release heading", () => {
		const comment = buildValidationComment(validationOf({ checks: passingChecks, publish: publishOf([pkg()]) }));

		// The breakdown is here…
		expect(comment).toContain("`dist/npm`");
		// …but the heading and the table belong to the release-plan section, which
		// sits above this in the same comment. Repeating them produced two
		// disagreeing tables under nested identical headings.
		expect(comment).not.toContain("What will be released");
		expect(comment).not.toContain("**Totals:**");
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

	it("links the full validation summary from the footer", () => {
		const comment = buildValidationComment(validationOf({ checks: passingChecks, publish: publishOf([pkg()]) }), {
			releaseNotesUrl: "https://example.com/runs/9",
		});

		// The link points at the unified check run — the whole summary, structured
		// output included. It was previously headed "Release Notes Preview", which
		// named a section OF that page rather than the page, and sent a reader
		// looking for notes.
		expect(comment).toContain("[Full validation summary →](https://example.com/runs/9)");
		expect(comment).not.toContain("Release Notes Preview");
		// Folded into the footer beside the timestamp rather than given a heading.
		expect(comment).toMatch(/\[Full validation summary →\][^\n]*· <sub>Updated at/);
	});

	it("omits the link entirely when there is no check-run url", () => {
		const comment = buildValidationComment(validationOf({ checks: passingChecks, publish: publishOf([pkg()]) }));

		// No placeholder prose: a footer with nothing to link to is just a
		// timestamp, and a sentence promising notes "on merge" said nothing a
		// reader could act on.
		expect(comment).not.toContain("Full validation summary");
		expect(comment).toContain("<sub>Updated at");
	});

	it("replaces the publish summary with a build-failed notice when the build did not pass", () => {
		const comment = buildValidationComment(
			validationOf({
				buildValidation: { passed: false, packageCount: 0 },
				findings: [
					{ severity: "error", check: "Build Validation", scope: null, message: "Command exited with code 1" },
				],
			}),
		);
		expect(comment).toContain("Build validation failed");
		expect(comment).toContain("no release preview is available");
		// The empty summary table + zero-byte totals must NOT appear.
		expect(comment).not.toContain("On merge, these packages publish:");
		expect(comment).not.toContain("0 B packed");
		// The meaningless release-notes link is suppressed too.
		expect(comment).not.toContain("📋 Release Notes Preview");
	});

	it("replaces the publish summary with a no-version-diffs notice when zero packages are released", () => {
		const comment = buildValidationComment(validationOf({ checks: passingChecks, publish: publishOf([]) }));
		expect(comment).toContain("No packages have version differences");
		expect(comment).not.toContain("On merge, these packages publish:");
		expect(comment).not.toContain("📋 Release Notes Preview");
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

describe("buildPublishValidationSummary", () => {
	it("renders the totals line — the body does not repeat the check-run title", () => {
		const md = buildPublishValidationSummary(validationOf({ publish: publishOf([pkg()]) }));
		// The check-run page already shows "📦 Publish Validation"; the body
		// must not duplicate it as a `## ...` heading.
		expect(md).not.toContain("## 📦 Publish Validation");
		expect(md).toContain("**Targets ready:** 1/1");
		expect(md).toContain("**npm:** ✅");
		// The default fixture has one npm target and no GitHub Packages target.
		expect(md).toContain("**GitHub Packages:** — none");
		// The wave's shape leads the section.
		expect(md).toContain("**1 package(s)** publishing to a registry.");
	});

	it("renders one section per package with a header and a registry table per build", () => {
		const md = buildPublishValidationSummary(validationOf({ publish: publishOf([pkg()]) }));
		expect(md).toContain("### ✅ 📦 @savvy-web/linked-1@5.0.13");
		// The build headline + registry table both appear, without a <details>
		// wrapper (flattened so the check-run page renders them expanded).
		expect(md).toContain("`dist/npm`");
		expect(md).toContain("Registry");
		expect(md).not.toContain("<details>");
	});

	it("renders a no-packages placeholder when nothing is being released", () => {
		const md = buildPublishValidationSummary(validationOf({ publish: publishOf([]) }));
		expect(md).toContain("**Nothing to release**");
		expect(md).toContain("_No packages have version differences against the target branch._");
		// An empty wave must NOT be described as a wave of release-only packages.
		expect(md).not.toContain("0 package(s)");
	});

	// A package with no builds is `github-release` kind. The copy must say that
	// it IS released — tagged, and given a GitHub release — rather than describe
	// it by what it lacks, which is how `no publish targets` read.
	it("describes a package with no builds as GitHub-release-only, not as lacking targets", () => {
		const versionOnly = pkg({ name: "@org/version-only", kind: "github-only", builds: [] });
		const md = buildPublishValidationSummary(validationOf({ publish: publishOf([versionOnly]) }));
		expect(md).toContain("@org/version-only");
		expect(md).toContain("GitHub release only");
		// The workspace's own derived summary, not a sentence the renderer
		// composes — so the comment and the JSON cannot disagree.
		expect(md).toContain("No registry target — nothing to validate");
		// And it must NOT claim publications a workspace with none would make.
		expect(md).not.toContain("ready to publish");
		// `⏭️` claims something was skipped. Nothing was.
		expect(md).not.toContain("⏭️");
	});

	// Readiness is now DERIVED from the registry map rather than carried as a
	// pair of booleans, so a fixture cannot assert a readiness its targets
	// contradict. The booleans this replaced were "nothing of this kind FAILED"
	// flags that both started `true`, so a wave with no target at all reported
	// `npmReady: true` — a green verdict on a check that never ran.
	it("renders '— none' rather than ✅ for a registry the wave has no targets for", () => {
		const versionOnly = pkg({ name: "@org/tracking", kind: "github-only", builds: [] });
		const publish = publishOf([versionOnly]);
		// The proof is on the workspace itself: no publications at all, so there
		// is no registry for a readiness verdict to be about.
		expect(publish.workspaces["@org/tracking"]?.packages).toEqual([]);
		const md = buildPublishValidationSummary(validationOf({ publish }));
		expect(md).toContain("**npm:** — none");
		expect(md).toContain("**GitHub Packages:** — none");
		expect(md).not.toContain("**npm:** ✅");
		expect(md).not.toContain("**GitHub Packages:** ✅");
		// ...and the wave's shape is stated up front.
		expect(md).toContain("every one is");
		expect(md).toContain("Nothing publishes to a registry.");
	});

	it("renders ❌ npm / ❌ GitHub Packages flags when readiness is false", () => {
		const failedBuild = build({ targets: [npmTarget({ status: "failed" })] });
		const publish = publishOf([pkg({ builds: [failedBuild] })]);
		const md = buildPublishValidationSummary(validationOf({ publish }));
		// npm HAS a target and it failed, so ❌ is a real verdict.
		expect(md).toContain("**npm:** ❌");
		// GitHub Packages has no target in this wave, so it gets neither verdict.
		expect(md).toContain("**GitHub Packages:** — none");
	});

	it("renders ❌ for GitHub Packages when the wave has a GitHub Packages target that failed", () => {
		const failedBuild = build({ targets: [ghTarget({ status: "failed" })] });
		const publish = publishOf([pkg({ builds: [failedBuild] })]);
		const md = buildPublishValidationSummary(validationOf({ publish }));
		expect(md).toContain("**GitHub Packages:** ❌");
	});

	it("renders one section per package across multiple packages with distinct builds", () => {
		const pkgA = pkg({
			name: "@org/pkg-a",
			version: "1.2.3",
			baseVersion: "1.2.2",
			builds: [
				build({
					directory: "dist/npm",
					packedBytes: 716,
					unpackedBytes: 2300,
					fileCount: 5,
					targets: [npmTarget({ registry: "https://registry.npmjs.org/" })],
				}),
			],
		});
		const pkgB = pkg({
			name: "@org/pkg-b",
			version: "2.0.0",
			baseVersion: null,
			bumpType: "new",
			builds: [
				build({
					directory: "dist/github",
					packedBytes: 800,
					unpackedBytes: 2500,
					fileCount: 6,
					targets: [ghTarget()],
				}),
			],
		});

		const md = buildPublishValidationSummary(validationOf({ publish: publishOf([pkgA, pkgB]) }));

		// Both per-package headers appear, in input order.
		expect(md).toContain("### ✅ 📦 @org/pkg-a@1.2.3");
		expect(md).toContain("### ✅ 📦 @org/pkg-b@2.0.0");
		expect(md.indexOf("@org/pkg-a@1.2.3")).toBeLessThan(md.indexOf("@org/pkg-b@2.0.0"));

		// Each package's build headline + registry sit under its own header.
		expect(md).toContain("`dist/npm`");
		expect(md).toContain("`dist/github`");
		expect(md).toContain("0.7 kB");
		expect(md).toContain("0.8 kB");
		// pkg-a's npm registry table sits between its header and pkg-b's header.
		const pkgAIdx = md.indexOf("@org/pkg-a@1.2.3");
		const pkgBIdx = md.indexOf("@org/pkg-b@2.0.0");
		expect(md.indexOf("`dist/npm`")).toBeGreaterThan(pkgAIdx);
		expect(md.indexOf("`dist/npm`")).toBeLessThan(pkgBIdx);
		expect(md.indexOf("`dist/github`")).toBeGreaterThan(pkgBIdx);
	});
});

describe("buildReleaseNotesPreviewSummary", () => {
	it("renders the released-packages list with Current → Next, bump, and changeset count", () => {
		const md = buildReleaseNotesPreviewSummary(
			validationOf({
				publish: publishOf([pkg({ changesetCount: 2 })]),
			}),
		);
		// The check-run page already shows "📋 Release Notes Preview"; the
		// body must not duplicate it as a `## ...` heading.
		expect(md).not.toContain("## 📋 Release Notes Preview");
		expect(md).toContain("**1 package(s) ready for release on merge.**");
		expect(md).toContain("@savvy-web/linked-1");
		expect(md).toContain("5.0.12 → 5.0.13");
		expect(md).toContain("\u{1F7E2} patch");
		expect(md).toContain("| 2 |");
	});

	it("renders '—' when changesetCount is null", () => {
		const md = buildReleaseNotesPreviewSummary(validationOf({ publish: publishOf([pkg({ changesetCount: null })]) }));
		expect(md).toContain("| — |");
	});

	it("renders an empty-state when no packages are being released", () => {
		const md = buildReleaseNotesPreviewSummary(validationOf({ publish: publishOf([]) }));
		expect(md).not.toContain("## 📋 Release Notes Preview");
		expect(md).toContain("_No packages are being released._");
	});

	it("renders distinct Current → Next, bump, and changesetCount per package across multiple packages", () => {
		const pkgA = pkg({
			name: "@org/pkg-a",
			version: "1.2.3",
			baseVersion: "1.2.2",
			bumpType: "patch",
			changesetCount: 2,
		});
		const pkgB = pkg({
			name: "@org/pkg-b",
			version: "3.0.0",
			baseVersion: "2.4.1",
			bumpType: "major",
			changesetCount: 5,
		});
		const pkgC = pkg({
			name: "@org/pkg-c",
			version: "0.1.0",
			baseVersion: null,
			bumpType: "new",
			changesetCount: null,
		});

		const md = buildReleaseNotesPreviewSummary(validationOf({ publish: publishOf([pkgA, pkgB, pkgC]) }));

		expect(md).toContain("**3 package(s) ready for release on merge.**");
		// Each package's name, version transition, and bump label appear.
		expect(md).toContain("@org/pkg-a");
		expect(md).toContain("@org/pkg-b");
		expect(md).toContain("@org/pkg-c");
		expect(md).toContain("1.2.2 → 1.2.3");
		expect(md).toContain("2.4.1 → 3.0.0");
		expect(md).toContain("— → 0.1.0");
		expect(md).toContain("\u{1F7E2} patch");
		expect(md).toContain("\u{1F534} major");
		expect(md).toContain("\u{1F195} new");
		// Per-package changesetCount cells: 2, 5, and '—' (for null).
		expect(md).toContain("| 2 |");
		expect(md).toContain("| 5 |");
		expect(md).toContain("| — |");

		// Rows appear in input order.
		const aIdx = md.indexOf("@org/pkg-a");
		const bIdx = md.indexOf("@org/pkg-b");
		const cIdx = md.indexOf("@org/pkg-c");
		expect(aIdx).toBeLessThan(bIdx);
		expect(bIdx).toBeLessThan(cIdx);
	});

	it("renders the extracted CHANGELOG content per package below the summary table", () => {
		const md = buildReleaseNotesPreviewSummary(
			validationOf({
				publish: publishOf([
					pkg({
						releaseNotes: { status: "found", content: "### Patch Changes\n\n- A specific fix for a bug" },
					}),
				]),
			}),
		);
		expect(md).toContain("### @savvy-web/linked-1");
		expect(md).toContain("**5.0.12 → 5.0.13**");
		expect(md).toContain("- A specific fix for a bug");
		// The Notes column shows ✅ when content was extracted.
		expect(md).toMatch(/\| ✅ \|/);
	});

	it("renders a ⚠️ no-CHANGELOG warning when releaseNotes.status is 'no-changelog'", () => {
		const md = buildReleaseNotesPreviewSummary(
			validationOf({ publish: publishOf([pkg({ releaseNotes: { status: "no-changelog" } })]) }),
		);
		expect(md).toContain("No `CHANGELOG.md` found");
		expect(md).toMatch(/\| ⚠️ \|/);
	});

	it("renders a ⚠️ version-not-found warning with the reason", () => {
		const md = buildReleaseNotesPreviewSummary(
			validationOf({
				publish: publishOf([
					pkg({ releaseNotes: { status: "version-not-found", reason: "Could not find version section in CHANGELOG" } }),
				]),
			}),
		);
		expect(md).toContain("Could not locate the `5.0.13` section");
		expect(md).toContain("Could not find version section in CHANGELOG");
	});

	it("renders a ⚠️ error message when releaseNotes.status is 'error'", () => {
		const md = buildReleaseNotesPreviewSummary(
			validationOf({
				publish: publishOf([pkg({ releaseNotes: { status: "error", message: "EACCES: permission denied" } })]),
			}),
		);
		expect(md).toContain("Failed to read");
		expect(md).toContain("EACCES: permission denied");
	});
});

describe("buildSbomPreviewSummary", () => {
	// The kit's `SbomMetadata` — the value actually threaded onto the emitted
	// BOM — rather than the consumer-shaped `ResolvedSBOMMetadata` that used to
	// be reconstructed alongside it.
	const sampleResolved: SbomMetadata = SbomMetadata.make({
		supplier: Supplier.make({
			name: "Savvy Web Systems",
			url: ["https://savvyweb.systems"],
			contact: [Contact.make({ email: "security@savvyweb.systems" })],
		}),
		authors: [Contact.make({ name: "Spencer Beggs" })],
		timestamp: "2026-01-01T00:00:00.000Z",
	});

	it("renders per-build component count and NTIA status from the validation payload", () => {
		const md = buildSbomPreviewSummary(
			validationOf({ publish: publishOf([pkg()]) }),
			new Map([["@savvy-web/linked-1:dist/npm", sampleResolved]]),
		);
		// The check-run page already shows "🔏 SBOM Preview"; the body must
		// not duplicate it as a `## ...` heading.
		expect(md).not.toContain("## 🔏 SBOM Preview");
		expect(md).toContain("`dist/npm`");
		expect(md).toContain("SBOM: 3 components · NTIA ✅");
	});

	it("renders the resolved sbom-config metadata as a fenced JSON block per build", () => {
		const md = buildSbomPreviewSummary(
			validationOf({ publish: publishOf([pkg()]) }),
			new Map([["@savvy-web/linked-1:dist/npm", sampleResolved]]),
		);
		expect(md).toContain("_Resolved `sbom-config` metadata used:_");
		expect(md).toContain("```json");
		expect(md).toContain("Savvy Web Systems");
		expect(md).toContain("security@savvyweb.systems");
	});

	it("surfaces the missing NTIA fields when the build is not NTIA-compliant", () => {
		const nonCompliant = build({
			sbom: { componentCount: 0, ntiaCompliant: false, missingNtiaFields: ["Supplier Name", "Author"] },
		});
		const md = buildSbomPreviewSummary(
			validationOf({ publish: publishOf([pkg({ builds: [nonCompliant] })]) }),
			new Map([["@savvy-web/linked-1:dist/npm", sampleResolved]]),
		);
		expect(md).toContain("NTIA ⚠️");
		expect(md).toContain("**Missing NTIA fields:** Supplier Name, Author");
	});

	it("surfaces the empty-resolved-config hint when resolvedSbomConfig is null", () => {
		const md = buildSbomPreviewSummary(validationOf({ publish: publishOf([pkg()]) }), null);
		expect(md).toContain(
			"_No `sbom-config` resolved — supply via the `sbom-config` action input or `vars.SILK_RELEASE_SBOM_TEMPLATE`._",
		);
	});

	it("surfaces the empty-resolved-config hint when resolvedSbomConfig is an empty map", () => {
		const md = buildSbomPreviewSummary(validationOf({ publish: publishOf([pkg()]) }), new Map<string, SbomMetadata>());
		expect(md).toContain(
			"_No `sbom-config` resolved — supply via the `sbom-config` action input or `vars.SILK_RELEASE_SBOM_TEMPLATE`._",
		);
	});

	it("renders a per-build no-resolved-metadata note when the map exists but the key is missing", () => {
		const md = buildSbomPreviewSummary(
			validationOf({ publish: publishOf([pkg()]) }),
			// Map populated for an unrelated key.
			new Map([["@org/other:dist/npm", sampleResolved]]),
		);
		expect(md).toContain("_No resolved `sbom-config` metadata for this build._");
	});

	it("renders an empty-state when no packages require an SBOM", () => {
		const md = buildSbomPreviewSummary(validationOf({ publish: publishOf([]) }), new Map());
		expect(md).not.toContain("## 🔏 SBOM Preview");
		expect(md).toContain("_No packages require an SBOM._");
	});

	it("omits the empty-config hint when packages is empty but a non-empty config map was supplied", () => {
		// The hint is meant to flag "no config resolved" — when the caller did
		// supply a config (a non-empty map) but no packages need an SBOM, the
		// hint is misleading and must not appear.
		const md = buildSbomPreviewSummary(
			validationOf({ publish: publishOf([]) }),
			new Map([["@org/other:dist/npm", sampleResolved]]),
		);
		expect(md).toContain("_No packages require an SBOM._");
		expect(md).not.toContain(
			"_No `sbom-config` resolved — supply via the `sbom-config` action input or `vars.SILK_RELEASE_SBOM_TEMPLATE`._",
		);
	});

	it("renders the version-only sub-section for a package with no builds", () => {
		const versionOnly = pkg({ name: "@org/version-only", kind: "github-only", builds: [] });
		const md = buildSbomPreviewSummary(
			validationOf({ publish: publishOf([versionOnly]) }),
			new Map([["@org/version-only:dist/npm", sampleResolved]]),
		);
		expect(md).toContain("_Version-only package — no SBOM generated._");
	});

	it("renders an SBOM-not-generated note when a build has no SBOM document", () => {
		const noSbom = build({ sbom: null });
		const md = buildSbomPreviewSummary(
			validationOf({ publish: publishOf([pkg({ builds: [noSbom] })]) }),
			new Map([["@savvy-web/linked-1:dist/npm", sampleResolved]]),
		);
		expect(md).toContain("_SBOM not generated for this build._");
	});

	it("renders the Config source line with the location when source is 'input'", () => {
		const md = buildSbomPreviewSummary(
			validationOf({ publish: publishOf([pkg()]) }),
			new Map([["@savvy-web/linked-1:dist/npm", sampleResolved]]),
			{ source: "input", location: "sbom-config" },
		);
		expect(md).toContain("**Config source:** `input` (sbom-config)");
	});

	it("renders the Config source line with the file path when source is 'local'", () => {
		const md = buildSbomPreviewSummary(
			validationOf({ publish: publishOf([pkg()]) }),
			new Map([["@savvy-web/linked-1:dist/npm", sampleResolved]]),
			{ source: "local", location: ".github/silk-release.json" },
		);
		expect(md).toContain("**Config source:** `local` (.github/silk-release.json)");
	});

	it("treats source 'none' as authoritative even when the resolved map is non-empty", () => {
		// The map can carry inferred-only resolutions for every build (the
		// `resolveSBOMMetadata` fallback). Source `"none"` is the one signal
		// that no template reached the action, so the hint must fire.
		const md = buildSbomPreviewSummary(
			validationOf({ publish: publishOf([pkg()]) }),
			new Map([["@savvy-web/linked-1:dist/npm", sampleResolved]]),
			{ source: "none" },
		);
		expect(md).toContain("**Config source:** `none` — no config supplied");
		expect(md).toContain(
			"_No `sbom-config` resolved — supply via the `sbom-config` action input or `vars.SILK_RELEASE_SBOM_TEMPLATE`._",
		);
	});

	it("suppresses the empty-config hint when source is non-'none', even with a sparse map", () => {
		// `source: "input"` means a template was supplied; the hint would
		// mislead the reader into thinking no template arrived.
		const md = buildSbomPreviewSummary(validationOf({ publish: publishOf([pkg()]) }), new Map<string, SbomMetadata>(), {
			source: "input",
			location: "sbom-config",
		});
		expect(md).not.toContain(
			"_No `sbom-config` resolved — supply via the `sbom-config` action input or `vars.SILK_RELEASE_SBOM_TEMPLATE`._",
		);
	});
});
