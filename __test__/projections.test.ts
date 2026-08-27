/**
 * Tests for the pure projection functions that map internal release-pipeline
 * results into ReleaseOutput phase structs.
 */

import { describe, expect, it } from "vitest";
import type {
	PackagePublishResult,
	PublishPackagesResult,
	PublishWorkspacePlan,
	ValidationPackageResult,
} from "../src/release/types.js";
import { toBranchManagementOutput, toPublishOutput, toValidationOutput } from "../src/schema/projections.js";
import { SCHEMA_URL, SCHEMA_VERSION } from "../src/schema/release-output.js";

describe("toBranchManagementOutput", () => {
	it("projects a clean update with a release PR", () => {
		const output = toBranchManagementOutput({
			releaseBranchName: "changeset-release/main",
			existed: true,
			created: false,
			updated: true,
			hasConflicts: false,
			releasePr: { number: 42, url: "https://example.com/pr/42", action: "updated" },
			changesets: [
				{ name: "@savvy-web/foo", bumpType: "minor", changesetCount: 1, oldVersion: "1.0.0", newVersion: "1.1.0" },
			],
			changesetFileCount: 1,
			dryRun: false,
		});

		expect(output.phase).toBe("branch-management");
		expect(output.$schema).toBe(SCHEMA_URL);
		expect(output.schemaVersion).toBe(SCHEMA_VERSION);
		expect(output.success).toBe(true);
		expect(output.outcome).toBe("branch-updated");
		expect(output.failure).toBeNull();
		expect(output.totals).toEqual({ changesetFiles: 1, workspaces: 1 });
		expect(output.dryRun).toBe(false);
		expect(output.branchManagement.changesets.count).toBe(1);
		expect(output.branchManagement.releaseBranch.name).toBe("changeset-release/main");
		expect(output.branchManagement.releaseBranch.existed).toBe(true);
		expect(output.branchManagement.releaseBranch.hasConflicts).toBe(false);
		expect(output.branchManagement.changesets.packages).toEqual([
			{ name: "@savvy-web/foo", bumpType: "minor", changesetCount: 1, oldVersion: "1.0.0", newVersion: "1.1.0" },
		]);
	});

	// `nothing-to-release` is a SUCCESS: nothing failed. The old `noop` flag
	// reported the same run in a way that read as an absence of work rather
	// than a correct, complete run with nothing to do.
	it("reports a run with no changesets as nothing-to-release, and as a success", () => {
		const output = toBranchManagementOutput({
			releaseBranchName: "changeset-release/main",
			existed: false,
			created: false,
			updated: false,
			hasConflicts: false,
			releasePr: null,
			changesets: [],
			changesetFileCount: 0,
			dryRun: false,
		});

		expect(output.outcome).toBe("nothing-to-release");
		expect(output.success).toBe(true);
		expect(output.failure).toBeNull();
		expect(output.totals.workspaces).toBe(0);
		expect(output.branchManagement.releasePr).toBe(null);
	});

	it("flags merge conflicts as a failure", () => {
		const output = toBranchManagementOutput({
			releaseBranchName: "changeset-release/main",
			existed: true,
			created: false,
			updated: false,
			hasConflicts: true,
			releasePr: null,
			changesets: [
				{ name: "@savvy-web/foo", bumpType: "patch", changesetCount: 1, oldVersion: "1.0.0", newVersion: "1.0.1" },
			],
			changesetFileCount: 1,
			dryRun: true,
		});

		expect(output.success).toBe(false);
		expect(output.outcome).toBe("conflicted");
		// The failure names WHERE it stopped and WHY, rather than leaving a
		// consumer to infer it from a boolean.
		expect(output.failure?.stage).toBe("branch");
		expect(output.failure?.reason).toContain("merge conflicted");
		expect(output.dryRun).toBe(true);
	});
});

describe("toValidationOutput", () => {
	/** A build node with one ready npm target and a compliant SBOM. */
	const npmBuild: ValidationPackageResult["builds"][number] = {
		directory: "/repo/dist/npm",
		packedBytes: 700,
		unpackedBytes: 2300,
		fileCount: 5,
		sbom: { componentCount: 3, ntiaCompliant: true, missingNtiaFields: [] },
		targets: [{ registry: "https://registry.npmjs.org/", status: "ready", access: "public", provenance: false }],
	};

	it("projects a clean build-centric validation run as success", () => {
		const output = toValidationOutput({
			buildsPassed: true,
			packageCount: 2,
			npmReady: true,
			githubPackagesReady: true,
			totalTargets: 2,
			readyTargets: 2,
			checks: [
				{ name: "Build Validation", status: "pass", outcome: "Build passed", url: "https://example.com/check/1" },
				{ name: "Publish Validation", status: "pass", outcome: "2/2 target(s) ready", url: null },
			],
			findings: [],
			validationPackages: [
				{
					name: "@savvy-web/foo",
					version: "1.2.0",
					baseVersion: "1.1.0",
					changesetCount: 1,
					builds: [npmBuild],
					releaseNotes: { status: "found", content: "### Minor Changes\n\n- something" },
				},
				{
					name: "@savvy-web/bar",
					version: "0.3.0",
					baseVersion: null,
					changesetCount: null,
					builds: [
						{
							directory: "/repo/dist/github",
							packedBytes: 800,
							unpackedBytes: 2500,
							fileCount: 6,
							sbom: { componentCount: 3, ntiaCompliant: false, missingNtiaFields: ["Supplier"] },
							targets: [
								{
									registry: "https://npm.pkg.github.com/",
									status: "ready",
									access: "public",
									provenance: true,
								},
							],
						},
					],
					releaseNotes: { status: "no-changelog" },
				},
			],
			checkRun: { url: "https://example.com/check/1", conclusion: "success" },
			dryRun: false,
		});

		expect(output.phase).toBe("validation");
		expect(output.success).toBe(true);
		expect(output.outcome).toBe("validated");
		expect(output.failure).toBeNull();
		expect(output.totals.workspaces).toBe(2);
		expect(output.totals.errorFindings).toBe(0);
		expect(output.$schema).toBe(SCHEMA_URL);
		expect(output.schemaVersion).toBe(SCHEMA_VERSION);
		expect(output.dryRun).toBe(false);
		expect(output.validation.buildValidation).toEqual({ passed: true, packageCount: 2 });
		expect(output.validation.checks).toEqual([
			{ name: "Build Validation", status: "pass", outcome: "Build passed", url: "https://example.com/check/1" },
			{ name: "Publish Validation", status: "pass", outcome: "2/2 target(s) ready", url: null },
		]);
		expect(output.validation.errors).toEqual([]);
		expect(output.validation.warnings).toEqual([]);
		// Per-registry counts, not booleans: a registry with no target is ABSENT,
		// which is what tells "nothing to publish" apart from "all targets passed".
		// Split per registry, where `totalTargets: 2` lumped both together and
		// could not say which registry either belonged to.
		expect(output.validation.registries).toEqual({
			npm: { resolved: 1, ready: 1 },
			"github-packages": { resolved: 1, ready: 1 },
		});

		const [foo, bar] = output.validation.order.map((n) => output.validation.workspaces[n]);
		expect(output.validation.order).toEqual(["@savvy-web/foo", "@savvy-web/bar"]);
		// No `name` field — the map key carries it, so it cannot disagree.
		expect(foo).toEqual({
			version: "1.2.0",
			baseVersion: "1.1.0",
			bumpType: "minor",
			changesetCount: 1,
			ready: true,
			kind: "github-with-packages",
			builds: [
				{
					directory: "/repo/dist/npm",
					packedBytes: 700,
					unpackedBytes: 2300,
					fileCount: 5,
					sbom: { componentCount: 3, ntiaCompliant: true, missingNtiaFields: [] },
					targets: [{ registry: "https://registry.npmjs.org/", status: "ready", access: "public", provenance: false }],
				},
			],
			releaseNotes: { status: "found", content: "### Minor Changes\n\n- something" },
		});
		// A null base version is a brand-new package.
		expect(bar?.bumpType).toBe("new");
		expect(bar?.builds[0]?.sbom).toEqual({
			componentCount: 3,
			ntiaCompliant: false,
			missingNtiaFields: ["Supplier"],
		});
		expect(output.validation.checkRun).toEqual({ url: "https://example.com/check/1", conclusion: "success" });
	});

	it("marks a branch with no packages as a no-op", () => {
		const output = toValidationOutput({
			buildsPassed: true,
			packageCount: 0,
			npmReady: true,
			githubPackagesReady: true,
			totalTargets: 0,
			readyTargets: 0,
			checks: [],
			findings: [],
			validationPackages: [],
			checkRun: null,
			dryRun: false,
		});

		// A run with nothing to validate is a SUCCESS. The old flags reported it
		// as `succeeded: false`, because `succeeded` was `!noop && ...` — the same
		// conflation of "empty" with "failed" that `noop` carried elsewhere.
		expect(output.outcome).toBe("nothing-to-release");
		expect(output.success).toBe(true);
		expect(output.failure).toBeNull();
		expect(output.validation.workspaces).toEqual({});
		expect(output.validation.order).toEqual([]);
		expect(output.validation.checkRun).toBeNull();
	});

	// The effected shape, end to end: a wave whose every workspace is a private
	// tracking package. This is the case the whole alignment exists for, so it
	// asserts the full payload rather than one field — a regression in any one
	// of `kind`, `registries`, `errors`/`warnings` or `order` reads as a
	// different lie about the same wave.
	it("projects an all-private wave the way the publish phase would describe it", () => {
		const output = toValidationOutput({
			buildsPassed: true,
			packageCount: 2,
			npmReady: true,
			githubPackagesReady: true,
			totalTargets: 0,
			readyTargets: 0,
			checks: [
				{ name: "Build Validation", status: "pass", outcome: "Build passed", url: null },
				{ name: "Publish Validation", status: "pass", outcome: "No targets", url: null },
			],
			findings: [],
			validationPackages: [
				{
					name: "@effected/claude-code-plugin",
					version: "0.14.0",
					baseVersion: "0.13.1",
					changesetCount: 1,
					builds: [],
					releaseNotes: { status: "no-changelog" },
				},
				{
					name: "@effected/copilot-plugin",
					version: "0.1.0",
					baseVersion: "0.0.0",
					changesetCount: 1,
					builds: [],
					releaseNotes: { status: "no-changelog" },
				},
			],
			checkRun: null,
			dryRun: false,
		});

		expect(output.success).toBe(true);
		expect(output.outcome).toBe("validated");

		// Both workspaces carry the publish phase's own word for what they are.
		expect(output.validation.order).toEqual(["@effected/claude-code-plugin", "@effected/copilot-plugin"]);
		for (const name of output.validation.order) {
			expect(output.validation.workspaces[name]?.kind).toBe("github-only");
			expect(output.validation.workspaces[name]?.ready).toBe(true);
			expect(output.validation.workspaces[name]?.builds).toEqual([]);
		}

		// No registry has a target, so the map is EMPTY rather than carrying two
		// booleans that both read `true`. This is the misreport the map exists to
		// make impossible.
		expect(output.validation.registries).toEqual({});

		// Split findings: both empty, and discriminable without a predicate.
		expect(output.validation.errors).toEqual([]);
		expect(output.validation.warnings).toEqual([]);

		// The check counts read `status`, not the human `outcome` sentence.
		expect(output.totals.checksPassed).toBe(2);
		expect(output.totals.checksFailed).toBe(0);
		expect(output.totals).toMatchObject({ workspaces: 2, githubOnly: 2, githubWithPackages: 0 });
		expect(output.summary).toContain("2 workspace(s) validated");
		expect(output.summary).toContain("2 GitHub release only");
		expect(output.summary).toContain("2 check(s) passed");
	});

	it("projects a version-only package with no builds", () => {
		const output = toValidationOutput({
			buildsPassed: true,
			packageCount: 1,
			npmReady: true,
			githubPackagesReady: true,
			totalTargets: 0,
			readyTargets: 0,
			checks: [],
			findings: [],
			validationPackages: [
				{
					name: "@savvy-web/foo",
					version: "1.2.1",
					baseVersion: "1.2.0",
					changesetCount: 1,
					builds: [],
					releaseNotes: { status: "found", content: "### Patch Changes\n\n- something" },
				},
			],
			checkRun: null,
			dryRun: false,
		});

		const pkg = output.validation.order.map((n) => output.validation.workspaces[n])[0];
		// `kind`, in the same vocabulary the publish phase uses, replacing the
		// `versionOnly` boolean that named the same fact in a word only this
		// phase understood.
		expect(pkg?.kind).toBe("github-only");
		expect(pkg?.ready).toBe(true);
		expect(pkg?.builds).toEqual([]);
		expect(pkg?.bumpType).toBe("patch");
	});

	it("derives an unknown bumpType for a non-semver base version", () => {
		const output = toValidationOutput({
			buildsPassed: true,
			packageCount: 1,
			npmReady: true,
			githubPackagesReady: true,
			totalTargets: 0,
			readyTargets: 0,
			checks: [],
			findings: [],
			validationPackages: [
				// A two-part base version is not a three-part semver string.
				{
					name: "@savvy-web/foo",
					version: "1.2.0",
					baseVersion: "1.0",
					changesetCount: 1,
					builds: [],
					releaseNotes: { status: "found", content: "### Patch Changes\n\n- something" },
				},
			],
			checkRun: null,
			dryRun: false,
		});

		expect(output.validation.order.map((n) => output.validation.workspaces[n])[0]?.bumpType).toBe("unknown");
	});

	it("flags failed builds and an error finding as a failure", () => {
		const output = toValidationOutput({
			buildsPassed: false,
			packageCount: 1,
			npmReady: false,
			githubPackagesReady: false,
			totalTargets: 1,
			readyTargets: 0,
			checks: [
				{ name: "Build Validation", status: "error", outcome: "Build failed", url: null },
				{ name: "Publish Validation", status: "error", outcome: "0/1 target(s) ready", url: null },
			],
			findings: [
				{
					severity: "error",
					check: "Publish Validation",
					scope: { package: "@savvy-web/foo", directory: "/repo/dist/npm" },
					message: "dry-run failed: boom",
				},
			],
			validationPackages: [
				{
					name: "@savvy-web/foo",
					version: "1.2.0",
					baseVersion: "1.1.0",
					changesetCount: 1,
					builds: [
						{
							directory: "/repo/dist/npm",
							packedBytes: null,
							unpackedBytes: null,
							fileCount: null,
							sbom: null,
							targets: [
								{
									registry: "https://registry.npmjs.org/",
									status: "failed",
									access: "public",
									provenance: false,
								},
							],
						},
					],
					releaseNotes: { status: "no-changelog" },
				},
			],
			checkRun: { url: "https://example.com/check/2", conclusion: "failure" },
			dryRun: true,
		});

		expect(output.success).toBe(false);
		// A failed build cascades: the publish dry-runs never ran, so naming the
		// build is more useful than reporting the checks it took down with it.
		expect(output.outcome).toBe("build-failed");
		expect(output.failure?.stage).toBe("build");
		expect(output.dryRun).toBe(true);
		expect(output.validation.buildValidation.passed).toBe(false);
		// The failed target is counted, not flattened into a boolean.
		expect(output.validation.registries.npm).toEqual({ resolved: 1, ready: 0 });
		expect(output.validation.warnings).toEqual([]);
		expect(output.validation.errors).toEqual([
			{
				severity: "error",
				check: "Publish Validation",
				scope: { package: "@savvy-web/foo", directory: "/repo/dist/npm" },
				message: "dry-run failed: boom",
			},
		]);
		// A build with a failed target makes the package not ready.
		expect(output.validation.order.map((n) => output.validation.workspaces[n])[0]?.ready).toBe(false);
		expect(output.validation.checkRun).toEqual({ url: "https://example.com/check/2", conclusion: "failure" });
	});

	it("keeps a run with only warning findings succeeded", () => {
		const output = toValidationOutput({
			buildsPassed: true,
			packageCount: 1,
			npmReady: true,
			githubPackagesReady: true,
			totalTargets: 1,
			readyTargets: 1,
			checks: [],
			findings: [
				{
					severity: "warning",
					check: "SBOM Preview",
					scope: { package: "@savvy-web/foo", directory: "/repo/dist/npm" },
					message: "SBOM generated but missing NTIA fields: Supplier",
				},
			],
			validationPackages: [
				{
					name: "@savvy-web/foo",
					version: "1.2.0",
					baseVersion: "1.1.0",
					changesetCount: 1,
					builds: [npmBuild],
					releaseNotes: { status: "found", content: "### Patch Changes\n\n- something" },
				},
			],
			checkRun: null,
			dryRun: false,
		});

		// A warning finding does not fail the run — only an `error` finding does.
		expect(output.success).toBe(true);
		expect(output.outcome).toBe("validated");
		expect(output.failure).toBeNull();
		expect(output.totals.warningFindings).toBe(1);
		expect(output.totals.errorFindings).toBe(0);
	});
});

/** Minimal TargetPublishResult fixture — only the fields the projection reads. */
const target = ({
	targetName,
	...over
}: Record<string, unknown> & { targetName?: string }): PackagePublishResult["targets"][number] =>
	({
		target: {
			name: targetName ?? "@savvy-web/foo",
			protocol: "npm",
			registry: "https://npm.pkg.github.com/",
			directory: "/x",
			access: "public",
			provenance: true,
			tag: "latest",
			tokenEnv: null,
		},
		success: true,
		...over,
		// biome-ignore lint/suspicious/noExplicitAny: minimal TargetPublishResult fixture
	}) as any;

describe("toPublishOutput", () => {
	/** A one-workspace plan of the given kind. */
	const planOf = (
		name: string,
		version: string,
		kind: "github-with-packages" | "github-only",
		resolvedPackages: number,
	): PublishWorkspacePlan[] => [{ name, version, kind, resolvedPackages }];

	const emptyResult: PublishPackagesResult = {
		success: true,
		packages: [],
		totalPackages: 0,
		successfulPackages: 0,
		totalTargets: 0,
		successfulTargets: 0,
	};

	it("projects a clean publish, keyed by workspace name", () => {
		const pkg: PackagePublishResult = {
			name: "@savvy-web/foo",
			version: "1.2.0",
			targets: [
				target({
					success: true,
					registryUrl: "https://github.com/foo/pkgs",
					tarballDigest: "sha256:deadbeef",
				}),
			],
		};
		const output = toPublishOutput({
			plan: planOf("@savvy-web/foo", "1.2.0", "github-with-packages", 1),
			publishResult: {
				...emptyResult,
				packages: [pkg],
				totalPackages: 1,
				successfulPackages: 1,
				totalTargets: 1,
				successfulTargets: 1,
			},
			tags: [{ name: "@savvy-web/foo@1.2.0", packageName: "@savvy-web/foo", version: "1.2.0" }],
			releases: [{ tag: "@savvy-web/foo@1.2.0", url: "https://example.com/r", id: 7, assets: [] }],
			tagShas: { "@savvy-web/foo@1.2.0": "abc123" },
			dryRun: false,
			failure: null,
		});

		expect(output.phase).toBe("publish");
		expect(output.success).toBe(true);
		expect(output.outcome).toBe("released");
		expect(output.failure).toBeNull();

		// The map is keyed by name — a consumer looks a workspace up directly
		// instead of scanning an array and cross-referencing two more.
		const ws = output.publish.workspaces["@savvy-web/foo"];
		expect(ws?.outcome).toBe("published");
		expect(ws?.success).toBe(true);
		expect(ws?.tag).toEqual({ name: "@savvy-web/foo@1.2.0", sha: "abc123" });
		expect(output.publish.order).toEqual(["@savvy-web/foo"]);
	});

	// `recovered` and `published` are BOTH successes. Splitting `success` from
	// `outcome` is what lets a consumer gate on the boolean while still being
	// able to tell the two apart.
	it("reports an already-published-identical target as recovered, and still a success", () => {
		const pkg: PackagePublishResult = {
			name: "@savvy-web/foo",
			version: "1.2.0",
			targets: [
				target({
					success: true,
					alreadyPublished: true,
					alreadyPublishedReason: "identical",
					recovery: { localDigest: "sha512-x", remoteDigest: "sha512-x" },
				}),
			],
		};
		const output = toPublishOutput({
			plan: planOf("@savvy-web/foo", "1.2.0", "github-with-packages", 1),
			publishResult: {
				...emptyResult,
				packages: [pkg],
				totalPackages: 1,
				successfulPackages: 1,
				totalTargets: 1,
				successfulTargets: 1,
			},
			tags: [{ name: "@savvy-web/foo@1.2.0", packageName: "@savvy-web/foo", version: "1.2.0" }],
			releases: [{ tag: "@savvy-web/foo@1.2.0", url: "https://example.com/r", id: 7, assets: [] }],
			tagShas: {},
			dryRun: false,
			failure: null,
		});

		const ws = output.publish.workspaces["@savvy-web/foo"];
		expect(ws?.outcome).toBe("recovered");
		expect(ws?.success).toBe(true);
		expect(ws?.packages[0]?.outcome).toBe("recovered");
		expect(ws?.packages[0]?.success).toBe(true);
		expect(output.totals.packagesRecovered).toBe(1);
		expect(output.success).toBe(true);
	});

	// A digest MISMATCH is the one "already published" case that must not be
	// treated as done — the registry holds different bytes under this version.
	it("reports a content-mismatch target as failed, never recovered", () => {
		const pkg: PackagePublishResult = {
			name: "@savvy-web/foo",
			version: "1.2.0",
			targets: [
				target({
					success: false,
					alreadyPublished: true,
					alreadyPublishedReason: "different",
					error: "integrity mismatch",
				}),
			],
		};
		const output = toPublishOutput({
			plan: planOf("@savvy-web/foo", "1.2.0", "github-with-packages", 1),
			publishResult: { ...emptyResult, success: false, packages: [pkg], totalPackages: 1, totalTargets: 1 },
			tags: [],
			releases: [],
			tagShas: {},
			dryRun: false,
			failure: { stage: "publish", reason: "integrity mismatch" },
		});

		const ws = output.publish.workspaces["@savvy-web/foo"];
		expect(ws?.packages[0]?.outcome).toBe("failed");
		expect(ws?.packages[0]?.success).toBe(false);
		expect(ws?.packages[0]?.error).toBe("integrity mismatch");
		expect(output.outcome).toBe("failed");
		expect(output.success).toBe(false);
	});

	// The effected shape: a private tracking workspace. It publishes nothing and
	// that is the intended, complete outcome — not a degraded registry publish.
	it("reports a github-only workspace as released, with no packages", () => {
		const output = toPublishOutput({
			plan: planOf("@effected/claude-code-plugin", "0.14.0", "github-only", 0),
			publishResult: {
				...emptyResult,
				packages: [{ name: "@effected/claude-code-plugin", version: "0.14.0", targets: [] }],
				totalPackages: 1,
				successfulPackages: 1,
			},
			tags: [
				{ name: "@effected/claude-code-plugin@0.14.0", packageName: "@effected/claude-code-plugin", version: "0.14.0" },
			],
			releases: [{ tag: "@effected/claude-code-plugin@0.14.0", url: "https://example.com/r", id: 42, assets: [] }],
			tagShas: { "@effected/claude-code-plugin@0.14.0": "abc123" },
			dryRun: false,
			failure: null,
		});

		const ws = output.publish.workspaces["@effected/claude-code-plugin"];
		expect(ws?.kind).toBe("github-only");
		expect(ws?.outcome).toBe("released");
		expect(ws?.success).toBe(true);
		expect(ws?.packages).toEqual([]);
		expect(ws?.release?.id).toBe(42);
		expect(ws?.summary).toBe("Tagged and released on GitHub; no registry target.");

		// The whole run is a SUCCESS that published nothing to a registry — the
		// case the old `noop` flag reported as "nothing happened" despite a tag
		// and a release having been created.
		expect(output.success).toBe(true);
		expect(output.outcome).toBe("released");
		expect(output.totals.githubOnly).toBe(1);
		expect(output.totals.packagesPublished).toBe(0);
		expect(output.totals.releasesCreated).toBe(1);
		expect(output.summary).toBe(
			"1 workspace(s) versioned · 0 package(s) published to a registry · 1 GitHub release(s) created",
		);
	});

	// The aborted run. Every workspace must still be present, carrying the kind
	// it was going to have — this is what the old output could not do at all,
	// because it emitted `packages: []` and dropped the build error entirely.
	it("keeps every workspace on the wire when the phase aborts at the build gate", () => {
		const output = toPublishOutput({
			plan: [
				{ name: "@effected/claude-code-plugin", version: "0.14.0", kind: "github-only", resolvedPackages: 0 },
				{ name: "@savvy-web/foo", version: "1.2.0", kind: "github-with-packages", resolvedPackages: 2 },
			],
			publishResult: { ...emptyResult, success: false, totalPackages: 2 },
			tags: [],
			releases: [],
			tagShas: {},
			dryRun: false,
			failure: { stage: "build", reason: "tsc --noEmit: 3 errors" },
		});

		expect(output.outcome).toBe("blocked");
		expect(output.success).toBe(false);
		expect(output.failure?.stage).toBe("build");
		expect(output.failure?.reason).toBe("tsc --noEmit: 3 errors");

		// Both workspaces are present, with their intended kind intact...
		expect(output.publish.order).toEqual(["@effected/claude-code-plugin", "@savvy-web/foo"]);
		expect(output.publish.workspaces["@effected/claude-code-plugin"]?.kind).toBe("github-only");
		expect(output.publish.workspaces["@savvy-web/foo"]?.kind).toBe("github-with-packages");

		// ...and both are `blocked`, which is NOT `failed`: they were never
		// attempted, and they did nothing wrong.
		for (const name of output.publish.order) {
			const ws = output.publish.workspaces[name];
			expect(ws?.outcome).toBe("blocked");
			expect(ws?.success).toBe(false);
			expect(ws?.release).toBeNull();
			expect(ws?.packages).toEqual([]);
		}
		expect(output.totals.blocked).toBe(2);
		// The intent survives the abort: two publications were going to happen.
		expect(output.totals.packagesResolved).toBe(2);
	});

	// The discriminating case for how `blockedWorkspaces` is derived: the
	// blocked workspaces are NOT a prefix of the plan. Filtering the entries and
	// then indexing back into the plan by the filtered position names the wrong
	// workspace here, while agreeing with the correct answer whenever every
	// workspace is blocked — which is what an aborted build produces, and why
	// the bug survived the abort test.
	it("names the blocked workspaces correctly when they are not a prefix of the plan", () => {
		const ok: PackagePublishResult = {
			name: "@savvy-web/first",
			version: "1.0.0",
			targets: [target({ success: true })],
		};
		const output = toPublishOutput({
			plan: [
				{ name: "@savvy-web/first", version: "1.0.0", kind: "github-with-packages", resolvedPackages: 1 },
				{ name: "@savvy-web/second", version: "1.0.0", kind: "github-with-packages", resolvedPackages: 1 },
				{ name: "@savvy-web/third", version: "1.0.0", kind: "github-with-packages", resolvedPackages: 1 },
			],
			// Only the FIRST workspace reached the publish step; the other two
			// never did, so they are blocked at positions 1 and 2.
			publishResult: { ...emptyResult, success: false, packages: [ok], totalPackages: 3, totalTargets: 1 },
			tags: [],
			releases: [],
			tagShas: {},
			dryRun: false,
			failure: { stage: "publish", reason: "aborted" },
		});

		expect(output.failure?.blockedWorkspaces).toEqual(["@savvy-web/second", "@savvy-web/third"]);
		expect(output.failure?.blockedWorkspaces).not.toContain("@savvy-web/first");
		expect(output.totals.blocked).toBe(2);
	});

	it("reports a mixed wave as partial", () => {
		const ok: PackagePublishResult = {
			name: "@savvy-web/ok",
			version: "1.0.0",
			targets: [target({ success: true })],
		};
		const bad: PackagePublishResult = {
			name: "@savvy-web/bad",
			version: "1.0.0",
			targets: [target({ success: false, status: "failed", error: "boom" })],
		};
		const output = toPublishOutput({
			plan: [
				{ name: "@savvy-web/ok", version: "1.0.0", kind: "github-with-packages", resolvedPackages: 1 },
				{ name: "@savvy-web/bad", version: "1.0.0", kind: "github-with-packages", resolvedPackages: 1 },
			],
			publishResult: { ...emptyResult, success: false, packages: [ok, bad], totalPackages: 2, totalTargets: 2 },
			tags: [],
			releases: [],
			tagShas: {},
			dryRun: false,
			failure: { stage: "publish", reason: "Published 1/2 target(s)" },
		});

		expect(output.outcome).toBe("partial");
		expect(output.success).toBe(false);
		expect(output.publish.workspaces["@savvy-web/bad"]?.outcome).toBe("failed");
		expect(output.totals.packagesFailed).toBe(1);
		expect(output.totals.packagesPublished).toBe(1);
	});

	// `nothing-to-release` is the ONLY empty case, and it is a success —
	// nothing failed. This is what replaces `noop`.
	it("reports an empty wave as nothing-to-release, and as a success", () => {
		const output = toPublishOutput({
			plan: [],
			publishResult: emptyResult,
			tags: [],
			releases: [],
			tagShas: {},
			dryRun: false,
			failure: null,
		});

		expect(output.outcome).toBe("nothing-to-release");
		expect(output.success).toBe(true);
		expect(output.totals.workspaces).toBe(0);
		expect(output.publish.workspaces).toEqual({});
		expect(output.publish.order).toEqual([]);
	});

	it("carries the published name from the target, not the workspace", () => {
		const pkg: PackagePublishResult = {
			name: "@savvy-web/workspace-name",
			version: "1.0.0",
			targets: [target({ success: true, targetName: "@savvy-web/published-under-another-name" })],
		};
		const output = toPublishOutput({
			plan: planOf("@savvy-web/workspace-name", "1.0.0", "github-with-packages", 1),
			publishResult: { ...emptyResult, packages: [pkg], totalPackages: 1, totalTargets: 1, successfulTargets: 1 },
			tags: [],
			releases: [],
			tagShas: {},
			dryRun: false,
			failure: null,
		});

		expect(output.publish.workspaces["@savvy-web/workspace-name"]?.packages[0]?.name).toBe(
			"@savvy-web/published-under-another-name",
		);
	});
});
