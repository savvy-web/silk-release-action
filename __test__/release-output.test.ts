/**
 * Tests for the ReleaseOutput schema module: status derivation, schema
 * round-tripping, and phase discrimination on the union.
 */

import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import type { ValidationOutput } from "../src/schema/release-output.js";
import { ReleaseOutput, SCHEMA_URL, SCHEMA_VERSION } from "../src/schema/release-output.js";

describe("ReleaseOutput schema", () => {
	const branchSample: ReleaseOutput = {
		$schema: SCHEMA_URL,
		schemaVersion: SCHEMA_VERSION,
		phase: "branch-management",
		success: true,
		outcome: "branch-created",
		summary: "1 changeset file(s) · 1 workspace(s) to version · release PR #1 created",
		dryRun: false,
		failure: null,
		totals: { changesetFiles: 1, workspaces: 1 },
		branchManagement: {
			releaseBranch: {
				name: "changeset-release/main",
				existed: true,
				created: false,
				updated: true,
				hasConflicts: false,
			},
			releasePr: { number: 42, url: "https://example.com/pr/42", action: "updated" },
			changesets: {
				count: 1,
				packages: [
					{ name: "@savvy-web/foo", bumpType: "minor", changesetCount: 1, oldVersion: "1.0.0", newVersion: "1.1.0" },
				],
			},
		},
	};

	const publishSample: ReleaseOutput = {
		$schema: SCHEMA_URL,
		schemaVersion: SCHEMA_VERSION,
		phase: "publish",
		success: true,
		outcome: "released",
		summary: "1 workspace(s) versioned · 1 package(s) published to a registry · 1 GitHub release(s) created",
		dryRun: false,
		failure: null,
		totals: {
			workspaces: 1,
			githubOnly: 0,
			githubWithPackages: 1,
			blocked: 0,
			packagesResolved: 1,
			packagesPublished: 1,
			packagesRecovered: 0,
			packagesFailed: 0,
			tagsCreated: 1,
			releasesCreated: 1,
		},
		publish: {
			order: ["@savvy-web/foo"],
			workspaces: {
				"@savvy-web/foo": {
					version: "1.2.0",
					kind: "github-with-packages",
					success: true,
					outcome: "published",
					summary: "Tagged and released on GitHub; published 1 package(s) to a registry.",
					packages: [
						{
							name: "@savvy-web/foo",
							version: "1.2.0",
							success: true,
							outcome: "published",
							registry: {
								name: "GitHub Packages",
								type: "github-packages",
								url: "https://npm.pkg.github.com/",
							},
							url: "https://github.com/orgs/savvy-web/packages/npm/package/foo",
							error: null,
							recovery: null,
							tarballDigest: "sha512-abc",
							attestations: {
								provenanceUrl: null,
								sbomUrl: null,
								githubAttestationUrl: null,
								provenanceRecovered: null,
								sbomRecovered: null,
							},
						},
					],
					tag: { name: "@savvy-web/foo@1.2.0", sha: "abc123" },
					release: {
						id: 7,
						url: "https://github.com/savvy-web/foo/releases/tag/v1.2.0",
						assets: [],
					},
				},
			},
		},
	};

	const validationSample: ValidationOutput = {
		$schema: SCHEMA_URL,
		schemaVersion: SCHEMA_VERSION,
		phase: "validation",
		success: true,
		outcome: "validated",
		summary: "1 workspace(s) validated",
		dryRun: false,
		failure: null,
		totals: {
			workspaces: 1,
			githubOnly: 0,
			githubWithPackages: 1,
			checksPassed: 1,
			checksWarning: 0,
			checksFailed: 0,
			errorFindings: 0,
			warningFindings: 0,
		},
		validation: {
			buildValidation: { passed: true, packageCount: 1 },
			checks: [{ name: "Build Validation", status: "pass", outcome: "Build passed", url: null }],
			findings: [],
			publish: {
				npmReady: true,
				githubPackagesReady: true,
				totalTargets: 1,
				readyTargets: 1,
				packages: [
					{
						name: "@savvy-web/foo",
						version: "1.2.0",
						baseVersion: "1.1.0",
						bumpType: "minor",
						changesetCount: 1,
						ready: true,
						versionOnly: false,
						builds: [
							{
								directory: "/repo/dist/npm",
								packedBytes: 700,
								unpackedBytes: 2300,
								fileCount: 5,
								sbom: { componentCount: 3, ntiaCompliant: true, missingNtiaFields: [] },
								targets: [
									{
										registry: "https://registry.npmjs.org/",
										status: "ready",
										access: "public",
										provenance: false,
									},
								],
							},
						],
						releaseNotes: { status: "found", content: "### Minor Changes\n\n- something" },
					},
				],
			},
			checkRun: { url: "https://example.com/check/1", conclusion: "success" },
		},
	};

	it("round-trips encode then decode as identity", () => {
		const encoded = Schema.encodeSync(ReleaseOutput)(branchSample);
		const decoded = Schema.decodeUnknownSync(ReleaseOutput)(encoded);
		expect(decoded).toEqual(branchSample);
	});

	it("round-trips validation encode then decode as identity", () => {
		const encoded = Schema.encodeSync(ReleaseOutput)(validationSample);
		const decoded = Schema.decodeUnknownSync(ReleaseOutput)(encoded);
		expect(decoded).toEqual(validationSample);
	});

	it("decodes a publish instance and keeps the phase block", () => {
		const decoded = Schema.decodeUnknownSync(ReleaseOutput)(publishSample);
		expect(decoded.phase).toBe("publish");
	});

	it("decodes a validation instance and keeps the phase block", () => {
		const decoded = Schema.decodeUnknownSync(ReleaseOutput)(validationSample);
		expect(decoded.phase).toBe("validation");
	});

	it("decodes a validation instance with a null checkRun", () => {
		const decoded = Schema.decodeUnknownSync(ReleaseOutput)({
			...validationSample,
			validation: { ...validationSample.validation, checkRun: null },
		});
		expect(decoded.phase).toBe("validation");
	});

	it("rejects a struct whose phase block does not match its phase literal", () => {
		const bad = { ...branchSample, phase: "publish" };
		expect(() => Schema.decodeUnknownSync(ReleaseOutput)(bad)).toThrow();
	});

	it("emits $schema as the first JSON key", () => {
		const encoded = Schema.encodeSync(ReleaseOutput)(branchSample) as Record<string, unknown>;
		expect(Object.keys(encoded)[0]).toBe("$schema");
	});
});
