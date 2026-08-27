/**
 * Pure projection functions: internal release-pipeline result types in,
 * `ReleaseOutput` phase structs out.
 *
 * @remarks
 * Each projection takes an explicit input interface — the deliberate seam
 * between sprawling internal types and the published `ReleaseOutput` contract.
 * `main.ts` adapts internal results into these inputs; the projections stay
 * pure and independently testable. Curation (dropping internal noise,
 * normalising per-target status) happens here.
 */

import { classifyRegistry, registryDisplayName } from "@effected/npm";
import type {
	PackagePublishResult,
	PublishFailureInput,
	PublishPackagesResult,
	PublishWorkspacePlan,
	ReleaseInfo,
	TagInfo,
	ValidationFinding,
	ValidationPackageResult,
} from "../release/types.js";
import {
	summarizeBranchManagement,
	summarizeReleaseWave,
	summarizeValidation,
	summarizeWorkspace,
	tallyReleaseKinds,
} from "../utils/release-kind.js";
import type { BranchManagementOutput, PublishOutput, ValidationOutput } from "./release-output.js";
import { SCHEMA_URL, SCHEMA_VERSION } from "./release-output.js";

/** Input for {@link toBranchManagementOutput}. */
export interface BranchManagementInput {
	readonly releaseBranchName: string;
	readonly existed: boolean;
	readonly created: boolean;
	readonly updated: boolean;
	readonly hasConflicts: boolean;
	readonly releasePr: { readonly number: number; readonly url: string; readonly action: "created" | "updated" } | null;
	readonly changesets: ReadonlyArray<{
		readonly name: string;
		readonly bumpType: "major" | "minor" | "patch";
		/** Zero when the package releases only because a dependency did. */
		readonly changesetCount: number;
		readonly oldVersion: string;
		readonly newVersion: string;
	}>;
	/**
	 * The number of changeset **files** observed in `.changeset/`.
	 *
	 * @remarks
	 * Carried separately because it is not `changesets.length`, which counts
	 * *packages*. One file may name several packages, and two files may name the
	 * same one — so the two numbers diverge in both directions. The schema
	 * documents `count` as "the number of changeset files observed in the
	 * `.changeset/` directory"; deriving it from the package list reported that
	 * field wrongly whenever a release was not one-file-one-package.
	 */
	readonly changesetFileCount: number;
	readonly dryRun: boolean;
}

/**
 * Project a branch-management run into a {@link BranchManagementOutput}.
 *
 * @param input - The branch-management run facts to project.
 * @returns The phase-discriminated branch-management output struct.
 */
export const toBranchManagementOutput = (input: BranchManagementInput): BranchManagementOutput => {
	// A conflicted branch is the phase's one failure mode; everything else is a
	// success with a different shape. `nothing-to-release` in particular is a
	// SUCCESS — the old `noop` flag reported it in a way that read as an absence
	// of work rather than a correct, complete run with nothing to do.
	const outcome: BranchManagementOutput["outcome"] = input.hasConflicts
		? "conflicted"
		: input.changesets.length === 0
			? "nothing-to-release"
			: input.created
				? "branch-created"
				: input.updated
					? "branch-updated"
					: "branch-unchanged";
	const success = outcome !== "conflicted";
	return {
		$schema: SCHEMA_URL,
		schemaVersion: SCHEMA_VERSION,
		phase: "branch-management",
		success,
		outcome,
		summary: summarizeBranchManagement({
			outcome,
			changesetFiles: input.changesetFileCount,
			workspaces: input.changesets.length,
			prNumber: input.releasePr?.number ?? null,
		}),
		dryRun: input.dryRun,
		failure: input.hasConflicts
			? { stage: "branch", reason: "The release branch could not be updated — the merge conflicted." }
			: null,
		totals: { changesetFiles: input.changesetFileCount, workspaces: input.changesets.length },
		branchManagement: {
			releaseBranch: {
				name: input.releaseBranchName,
				existed: input.existed,
				created: input.created,
				updated: input.updated,
				hasConflicts: input.hasConflicts,
			},
			releasePr: input.releasePr,
			changesets: {
				count: input.changesetFileCount,
				// Explicit projection — only forward the fields the schema declares.
				packages: input.changesets.map((c) => ({
					name: c.name,
					bumpType: c.bumpType,
					changesetCount: c.changesetCount,
					oldVersion: c.oldVersion,
					newVersion: c.newVersion,
				})),
			},
		},
	};
};

/** One row of the validation checks table, as the projection input. */
export interface ValidationCheckInput {
	readonly name: string;
	readonly status: "pass" | "warning" | "error";
	readonly outcome: string;
	readonly url: string | null;
}

/** Input for {@link toValidationOutput}. */
export interface ValidationInput {
	/** Whether the build-validation step passed. */
	readonly buildsPassed: boolean;
	/** Number of released packages the build-validation step covered. */
	readonly packageCount: number;
	/** Whether every npm target is publish-ready. */
	readonly npmReady: boolean;
	/** Whether every GitHub Packages target is publish-ready. */
	readonly githubPackagesReady: boolean;
	/** Total number of registry targets across every build. */
	readonly totalTargets: number;
	/** Number of registry targets that passed dry-run. */
	readonly readyTargets: number;
	/** The five-row checks table outcomes. */
	readonly checks: ReadonlyArray<ValidationCheckInput>;
	/** Every non-pass outcome the validation checks produced. */
	readonly findings: ReadonlyArray<ValidationFinding>;
	/** Build-centric per-package validation results (builds → SBOM + targets). */
	readonly validationPackages: ReadonlyArray<ValidationPackageResult>;
	/** The unified validation check run, or `null` when none was created. */
	readonly checkRun: {
		readonly url: string;
		readonly conclusion: "success" | "failure" | "neutral" | "cancelled" | "skipped" | "timed_out" | "action_required";
	} | null;
	readonly dryRun: boolean;
}

/**
 * Derive the semver bump type for a released package.
 *
 * @remarks
 * A `null` base version means the package is brand-new on the target branch
 * (`"new"`). Otherwise the major/minor/patch deltas are compared; a version
 * that is not a three-part semver string yields `"unknown"`.
 */
const deriveBumpType = (
	baseVersion: string | null,
	version: string,
): "major" | "minor" | "patch" | "new" | "unknown" => {
	if (baseVersion === null) return "new";
	const oldParts = baseVersion.split(".").map(Number);
	const newParts = version.split(".").map(Number);
	if (oldParts.length < 3 || newParts.length < 3 || [...oldParts, ...newParts].some(Number.isNaN)) {
		return "unknown";
	}
	if ((newParts[0] ?? 0) > (oldParts[0] ?? 0)) return "major";
	if (newParts[0] === oldParts[0] && (newParts[1] ?? 0) > (oldParts[1] ?? 0)) return "minor";
	return "patch";
};

/**
 * Project one build-centric {@link ValidationPackageResult} into the schema's
 * publish-package struct. A package with no builds is version-only.
 */
const toValidationPublishPackage = (
	pkg: ValidationPackageResult,
): ValidationOutput["validation"]["publish"]["packages"][number] => {
	const versionOnly = pkg.builds.length === 0;
	return {
		name: pkg.name,
		version: pkg.version,
		baseVersion: pkg.baseVersion,
		bumpType: deriveBumpType(pkg.baseVersion, pkg.version),
		changesetCount: pkg.changesetCount,
		// A version-only package is ready; a package with builds is ready when
		// every registry target of every build passed dry-run.
		ready: versionOnly || pkg.builds.every((b) => b.targets.every((t) => t.status !== "failed")),
		versionOnly,
		builds: pkg.builds.map((build) => ({
			directory: build.directory,
			packedBytes: build.packedBytes,
			unpackedBytes: build.unpackedBytes,
			fileCount: build.fileCount,
			sbom:
				build.sbom === null
					? null
					: {
							componentCount: build.sbom.componentCount,
							ntiaCompliant: build.sbom.ntiaCompliant,
							missingNtiaFields: build.sbom.missingNtiaFields,
						},
			targets: build.targets.map((t) => ({
				registry: t.registry,
				status: t.status,
				access: t.access,
				provenance: t.provenance,
			})),
		})),
		releaseNotes: pkg.releaseNotes,
	};
};

/**
 * Project a validation run into a {@link ValidationOutput}.
 *
 * @remarks
 * This is the single curation seam between the internal build-centric
 * validation results and the published, build-centric `ValidationOutput`
 * contract — internal results in, schema struct out.
 *
 * @param input - The validation run facts to project.
 * @returns The phase-discriminated validation output struct.
 */
export const toValidationOutput = (input: ValidationInput): ValidationOutput => {
	const errorFindings = input.findings.filter((f) => f.severity === "error").length;
	const warningFindings = input.findings.filter((f) => f.severity === "warning").length;
	// A build failure cascades: the publish dry-runs never ran, so naming the
	// build is more useful than reporting the downstream checks it took with it.
	const outcome: ValidationOutput["outcome"] = !input.buildsPassed
		? "build-failed"
		: errorFindings > 0
			? "checks-failed"
			: input.packageCount === 0
				? "nothing-to-release"
				: "validated";
	// `nothing-to-release` is a SUCCESS. The old `succeeded` flag was
	// `!noop && buildsPassed && publishOk`, which reported a clean run with
	// nothing to validate as NOT succeeded — the same conflation of "empty" with
	// "failed" that `noop` carried on the publish phase.
	const success = outcome === "validated" || outcome === "nothing-to-release";
	const kinds = tallyReleaseKinds(input.validationPackages.map((pkg) => pkg.builds.length));
	const totals = {
		workspaces: input.packageCount,
		githubOnly: kinds.githubRelease,
		githubWithPackages: kinds.registry,
		// `status`, NOT `outcome`. `outcome` is the human sentence shown in the
		// check table ("Build passed", "No targets"); `status` is the verdict.
		// Counting `outcome === "success"` matched nothing, so a run with five
		// passing checks reported `0 check(s) passed`.
		checksPassed: input.checks.filter((c) => c.status === "pass").length,
		checksWarning: input.checks.filter((c) => c.status === "warning").length,
		checksFailed: input.checks.filter((c) => c.status === "error").length,
		errorFindings,
		warningFindings,
	};
	return {
		$schema: SCHEMA_URL,
		schemaVersion: SCHEMA_VERSION,
		phase: "validation",
		success,
		outcome,
		summary: summarizeValidation({ outcome, totals }),
		dryRun: input.dryRun,
		failure:
			outcome === "build-failed"
				? { stage: "build", reason: `${input.packageCount} workspace(s) checked; at least one build failed.` }
				: outcome === "checks-failed"
					? { stage: "publish-validation", reason: `${errorFindings} error finding(s) across the validation checks.` }
					: null,
		totals,
		validation: {
			buildValidation: { passed: input.buildsPassed, packageCount: input.packageCount },
			checks: input.checks.map((c) => ({ name: c.name, status: c.status, outcome: c.outcome, url: c.url })),
			findings: input.findings.map((f) => ({
				severity: f.severity,
				check: f.check,
				scope: f.scope === null ? null : { package: f.scope.package, directory: f.scope.directory },
				message: f.message,
			})),
			publish: {
				npmReady: input.npmReady,
				githubPackagesReady: input.githubPackagesReady,
				totalTargets: input.totalTargets,
				readyTargets: input.readyTargets,
				packages: input.validationPackages.map(toValidationPublishPackage),
			},
			checkRun: input.checkRun,
		},
	};
};

/** Input for {@link toPublishOutput}. */
export interface PublishInput {
	/** Every workspace in the wave, in dependency-first order. */
	readonly plan: ReadonlyArray<PublishWorkspacePlan>;
	readonly publishResult: PublishPackagesResult;
	readonly tags: ReadonlyArray<TagInfo>;
	readonly releases: ReadonlyArray<ReleaseInfo>;
	/** Resolved tag-name → commit SHA, keyed by `TagInfo.name`. */
	readonly tagShas: Readonly<Record<string, string>>;
	readonly dryRun: boolean;
	/** Null on a clean run. */
	readonly failure: PublishFailureInput | null;
}

type PackageOutcome = "published" | "recovered" | "failed" | "blocked";

/**
 * Classify one target result into a package outcome.
 *
 * @remarks
 * `recovered` is the rename of what the internal model calls a `skipped`
 * already-published-identical target. It is a SUCCESS: the version is on the
 * registry at the digest this run would have uploaded. Calling it "skipped"
 * made a successful recovery indistinguishable from work that was declined.
 *
 * A digest MISMATCH is `failed`, never `recovered` — the registry has
 * different bytes under this version, which is the one case where "already
 * published" must not be treated as done.
 */
const classifyPackage = (t: PackagePublishResult["targets"][number]): PackageOutcome => {
	if (t.status === "failed") return "failed";
	if (t.alreadyPublished === true && t.alreadyPublishedReason === "different") return "failed";
	if (t.status === "skipped" || t.alreadyPublished === true) return "recovered";
	if (t.status === "published") return "published";
	return t.success ? "published" : "failed";
};

/** Map an internal target result onto one published-package entry. */
const toPublishedPackage = (
	workspaceVersion: string,
	t: PackagePublishResult["targets"][number],
): PublishOutput["publish"]["workspaces"][string]["packages"][number] => {
	const outcome = classifyPackage(t);
	const registry = t.target.registry ?? "jsr";
	return {
		// The name on the TARGET, not the workspace — a workspace may publish
		// under a different name per registry.
		name: t.target.name,
		version: workspaceVersion,
		success: outcome === "published" || outcome === "recovered",
		outcome,
		registry: {
			name: registryDisplayName(registry),
			type: classifyRegistry(registry),
			url: registry,
		},
		url: t.registryUrl ?? null,
		error: outcome === "failed" ? (t.error ?? null) : null,
		recovery:
			t.recovery !== undefined ? { localDigest: t.recovery.localDigest, remoteDigest: t.recovery.remoteDigest } : null,
		tarballDigest: t.tarballDigest ?? null,
		attestations: {
			provenanceUrl: t.attestationUrl ?? null,
			sbomUrl: t.sbomAttestationUrl ?? null,
			githubAttestationUrl: null,
			provenanceRecovered: t.recovered !== undefined ? t.recovered.provenance : null,
			sbomRecovered: t.recovered !== undefined ? t.recovered.sbom : null,
		},
	};
};

/**
 * Project a publish run into a {@link PublishOutput}.
 *
 * @remarks
 * The **workspace** is the unit, not the package. A workspace is what a
 * changeset names, what gets a version, a tag and a GitHub release; the
 * packages it puts on registries are artifacts beneath it. One workspace can
 * publish the same version under several names to several registries, and a
 * private tracking workspace publishes none at all — neither is expressible
 * with the package as the top level.
 *
 * Every level carries two orthogonal fields: `success` (the boolean gate) and
 * `outcome` (what specifically happened). A recovered publish and a fresh
 * upload are both `success: true`.
 *
 * @param input - The publish run results to project.
 * @returns The phase-discriminated publish output struct.
 */
export const toPublishOutput = (input: PublishInput): PublishOutput => {
	const resultByName = new Map(input.publishResult.packages.map((p) => [p.name, p] as const));

	// Tag lookup: per-package tags carry the workspace name. A single shared
	// tag names no package, so it is the tag for every workspace in the wave.
	const sharedTag = input.tags.length === 1 && input.tags[0]?.packageName === "" ? input.tags[0] : undefined;
	const tagByWorkspace = new Map(
		input.tags.filter((t) => t.packageName !== "").map((t) => [t.packageName, t] as const),
	);
	const releaseByTag = new Map(input.releases.map((r) => [r.tag, r] as const));

	const workspaces: Record<string, PublishOutput["publish"]["workspaces"][string]> = {};

	for (const ws of input.plan) {
		const result = resultByName.get(ws.name);
		const packages = result === undefined ? [] : result.targets.map((t) => toPublishedPackage(ws.version, t));

		const tag = tagByWorkspace.get(ws.name) ?? sharedTag;
		const releaseInfo = tag === undefined ? undefined : releaseByTag.get(tag.name);
		// Tag and release are recorded independently. `runReleases` creates the
		// tag first and the GitHub release second, so a failure between them
		// leaves a real tag and no release — a state the output has to be able
		// to express.
		const tagEntry = tag === undefined ? null : { name: tag.name, sha: input.tagShas[tag.name] ?? "" };
		const release =
			releaseInfo === undefined
				? null
				: {
						id: releaseInfo.id,
						url: releaseInfo.url,
						assets: releaseInfo.assets.map((a) => ({ name: a.name, url: a.downloadUrl, size: a.size })),
					};

		// `blocked` is "never attempted", NOT "attempted and failed". A workspace
		// missing from the publish result never reached the publish step — the
		// phase aborted first — and it did nothing wrong.
		const attempted = result !== undefined;
		const failed = packages.filter((p) => !p.success).length;
		const succeeded = packages.filter((p) => p.success).length;

		const outcome: PublishOutput["publish"]["workspaces"][string]["outcome"] = !attempted
			? "blocked"
			: ws.kind === "github-only"
				? // Nothing was meant to be uploaded, so the release IS the outcome.
					release !== null
					? "released"
					: "failed"
				: failed > 0 && succeeded > 0
					? "partial"
					: failed > 0
						? "failed"
						: packages.every((p) => p.outcome === "recovered")
							? "recovered"
							: "published";

		const success = outcome === "released" || outcome === "published" || outcome === "recovered";

		workspaces[ws.name] = {
			version: ws.version,
			kind: ws.kind,
			success,
			outcome,
			summary: summarizeWorkspace({ kind: ws.kind, outcome, packages: packages.length, released: release !== null }),
			packages,
			tag: tagEntry,
			release,
		};
	}

	// Derived from the PLAN, not from a filtered copy of the entries. Filtering
	// first and then indexing back into `plan` by the filtered position named
	// the wrong workspaces whenever the blocked ones were not a prefix — it
	// only looked right because an aborted build blocks every workspace, so
	// filtered and unfiltered indices happened to agree.
	const blockedNames = input.plan.filter((w) => workspaces[w.name]?.outcome === "blocked").map((w) => w.name);
	const entries = Object.values(workspaces);
	const allPackages = entries.flatMap((w) => w.packages);
	const totals: PublishOutput["totals"] = {
		workspaces: input.plan.length,
		githubOnly: input.plan.filter((w) => w.kind === "github-only").length,
		githubWithPackages: input.plan.filter((w) => w.kind === "github-with-packages").length,
		blocked: blockedNames.length,
		packagesResolved: input.plan.reduce((n, w) => n + w.resolvedPackages, 0),
		packagesPublished: allPackages.filter((p) => p.outcome === "published").length,
		packagesRecovered: allPackages.filter((p) => p.outcome === "recovered").length,
		packagesFailed: allPackages.filter((p) => p.outcome === "failed").length,
		tagsCreated: input.tags.length,
		releasesCreated: input.releases.length,
	};

	// Phase outcome. `nothing-to-release` is the ONLY empty case and it is a
	// success — nothing failed. This is what replaces `noop`, which claimed
	// "nothing happened" for a wave that had cut tags and created releases.
	const okCount = entries.filter((w) => w.success).length;
	const outcome: PublishOutput["outcome"] =
		input.plan.length === 0
			? "nothing-to-release"
			: okCount === entries.length
				? "released"
				: okCount > 0
					? "partial"
					: totals.blocked === entries.length
						? "blocked"
						: "failed";
	const success = outcome === "released" || outcome === "nothing-to-release";

	return {
		$schema: SCHEMA_URL,
		schemaVersion: SCHEMA_VERSION,
		phase: "publish",
		success,
		outcome,
		summary: summarizeReleaseWave({
			workspaces: totals.workspaces,
			packagesPublished: totals.packagesPublished,
			releases: totals.releasesCreated,
		}),
		dryRun: input.dryRun,
		failure:
			input.failure === null
				? null
				: {
						stage: input.failure.stage,
						reason: input.failure.reason,
						blockedWorkspaces: blockedNames,
					},
		totals,
		publish: {
			order: input.plan.map((w) => w.name),
			workspaces,
		},
	};
};
