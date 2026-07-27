// Phase-2 validation orchestrator.
//
// Enumerates workspace packages, diffs versions against the target branch to
// discover which packages are being released, resolves publish targets, groups
// them by build directory, runs a real dry-run per build directory via
// `PackagePublish.dryRun`, generates one SBOM per build directory via `Sbom`
// (with `sbom-config` metadata applied), and assembles a `ValidationReport`.
//
// The report is build-centric: the per-package `validationPackages` carry the
// builds, sizes, SBOMs, and registry targets. `main.ts` projects them into the
// canonical `ValidationOutput`, which is both emitted and rendered to the
// sticky comment — this module does not render markdown.

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { ActionLogger } from "@effected/github-actions";
import { PackagePublish, classifyRegistry } from "@effected/npm";
import { Package } from "@effected/package-json";
import type { Component, SbomMetadataOptions } from "@effected/sbom";
import { Contact, NtiaReport, Sbom, SbomMetadata, SbomMetadataSource, Supplier } from "@effected/sbom";
import type { PublishTarget, WorkspacePackage } from "@effected/workspaces";
import { WorkspaceDiscovery, WorkspaceSnapshots } from "@effected/workspaces";
import { Clock, Effect } from "effect";
import type { SBOMMetadataConfig } from "../types/sbom-config.js";
import { countChangesetsPerPackage } from "../utils/count-changesets.js";
import { extractReleaseNotes } from "../utils/extract-release-notes.js";
import { getGroupId } from "../utils/group-id.js";
import type { ConfigSource } from "../utils/load-release-config.js";
import { loadSBOMConfig } from "../utils/load-release-config.js";
import { registryShortLabel } from "../utils/registry-label.js";
import { sortReleasesTopologically } from "../utils/sort-releases-topologically.js";
import { ChangesetConfig } from "./changeset-config.js";
import { ValidationError } from "./errors.js";
import { humanizeSize } from "./report.js";
import { resolvePublishableTargets } from "./resolve-targets.js";
import type {
	BuildSbom,
	BuildTargetResult,
	PackageBuildResult,
	ValidationFinding,
	ValidationPackageResult,
} from "./types.js";

// ─── Public interfaces ────────────────────────────────────────────────────────

/**
 * Input arguments for {@link runValidation}.
 *
 * @public
 */
export interface ValidationInputArgs {
	readonly packageManager: string;
	readonly targetBranch: string;
	readonly dryRun: boolean;
}

/**
 * Aggregated validation report returned by {@link runValidation}.
 *
 * @public
 */
export interface ValidationReport {
	/** Whether all publish dry-runs passed. */
	readonly publishOk: boolean;
	/** Whether all npm targets passed. */
	readonly npmReady: boolean;
	/** Whether all GitHub Packages targets passed. */
	readonly githubPackagesReady: boolean;
	/** Total number of publish targets across all packages. */
	readonly totalTargets: number;
	/** Number of targets that passed dry-run. */
	readonly readyTargets: number;
	/** True when every changing package has no publish targets (version-only). */
	readonly hasVersionOnlyPackages: boolean;
	/** Per-package summary for the release output. */
	readonly packages: ReadonlyArray<{ readonly name: string; readonly version: string; readonly ready: boolean }>;
	/** Build-centric per-package validation results (builds → SBOM + targets). */
	readonly validationPackages: ReadonlyArray<ValidationPackageResult>;
	/** Whether SBOM generation passed for all applicable build directories. */
	readonly sbomOk: boolean;
	/** Human-readable SBOM status line. */
	readonly sbomSummary: string;
	/** Structured error/warning findings produced by the validation checks. */
	readonly findings: ReadonlyArray<ValidationFinding>;
	/**
	 * Debug-only — the resolved `sbom-config` metadata per build, keyed by
	 * `${pkg.name}:${build.directory}`. Threaded to the SBOM Preview check-run
	 * summary so config-or-mapping bugs are immediately visible; intentionally
	 * NOT exposed on the public `ValidationOutput` schema.
	 *
	 * Every populated value is the `SbomMetadata` actually threaded onto the
	 * emitted BOM, and the map only records builds the validation loop
	 * processed. A missing key for a known build means that build was filtered
	 * out before SBOM generation (e.g. version-only package with no publish
	 * targets). An entirely empty map signals "no sbom-config was resolved at
	 * all" (no released packages, or every released package was version-only).
	 */
	readonly resolvedSbomConfig: ReadonlyMap<string, SbomMetadata>;
	/**
	 * Debug-only — where the `sbom-config` was loaded from this run.
	 *
	 * `"input"` = the `sbom-config` action input was non-empty;
	 * `"local"` = `.github/silk-release.json[c]` matched;
	 * `"variable"` = the `SILK_RELEASE_SBOM_TEMPLATE` env var was set;
	 * `"none"` = no source supplied a config.
	 *
	 * Surfaced on the SBOM Preview check-run summary so a reader can see at a
	 * glance which source the action chose — invaluable when the NTIA warning
	 * fires despite a template being passed in by the caller.
	 *
	 * `null` only for the early-return path (no released packages), where the
	 * config is never consulted.
	 */
	readonly sbomConfigSource: ConfigSource | null;
}

// ─── Internal types ───────────────────────────────────────────────────────────

/** A workspace package that has a version bump (current ≠ target-branch). */
interface ReleasedPackage {
	readonly pkg: WorkspacePackage;
	/** Version on the release branch (bumped). */
	readonly currentVersion: string;
	/** Version on the target branch (old), or `null` for a brand-new package. */
	readonly baseVersion: string | null;
}

/**
 * A build — a unique target directory of a released package and the registry
 * targets that share it.
 */
interface Build {
	/**
	 * Package-relative build directory (e.g. `dist/npm`) — the value carried
	 * into `PackageBuildResult.directory` and the `ValidationOutput`, and
	 * rendered verbatim in the comment.
	 */
	readonly directory: string;
	/**
	 * Resolved absolute path to the build directory — used for filesystem
	 * operations (the dry-run child process `cwd`, reading `package.json`).
	 */
	readonly absoluteDirectory: string;
	/** The resolved publish targets that publish from this directory. */
	readonly targets: ReadonlyArray<PublishTarget>;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Resolve a publish target's directory to an absolute filesystem path.
 *
 * `PublishabilityDetector` may return a package-relative `directory`; the
 * dry-run child process' `cwd` and the SBOM `package.json` read both need an
 * absolute path that exists on disk.
 */
function resolveTargetDir(pkg: WorkspacePackage, target: PublishTarget): string {
	return isAbsolute(target.directory) ? target.directory : join(pkg.path, target.directory);
}

/**
 * Reduce a publish target's directory to the package-relative form
 * (e.g. `dist/npm`) — the value that flows into `ValidationOutput` and the
 * rendered comment. An already-relative `target.directory` is kept as-is;
 * an absolute one is relativised against the package root.
 */
function packageRelativeTargetDir(pkg: WorkspacePackage, target: PublishTarget): string {
	return isAbsolute(target.directory) ? relative(pkg.path, target.directory) : target.directory;
}

/**
 * Group a package's resolved publish targets into builds — one per unique
 * target directory.
 *
 * The dedup map is keyed by the resolved **absolute** path (the identity of
 * the directory on disk); each {@link Build} carries both the package-relative
 * directory (for the output) and the absolute path (for filesystem ops).
 * Discovery order of the first target seen for each directory is preserved.
 */
function groupTargetsIntoBuilds(pkg: WorkspacePackage, targets: ReadonlyArray<PublishTarget>): ReadonlyArray<Build> {
	const byDirectory = new Map<string, { directory: string; absoluteDirectory: string; targets: PublishTarget[] }>();
	for (const target of targets) {
		const absoluteDirectory = resolveTargetDir(pkg, target);
		const existing = byDirectory.get(absoluteDirectory);
		if (existing === undefined) {
			byDirectory.set(absoluteDirectory, {
				directory: packageRelativeTargetDir(pkg, target),
				absoluteDirectory,
				targets: [target],
			});
		} else {
			existing.targets.push(target);
		}
	}
	return Array.from(byDirectory.values());
}

/**
 * The three outcomes of reading a built package's `package.json`.
 *
 * @remarks
 * `absent` and `undecodable` are deliberately **not** the same thing. A build
 * directory with no manifest is the shape the predecessor treated as benign —
 * it returned an empty dependency list and a dependency-free package
 * legitimately has a component-less BOM. A manifest that is present but will
 * not decode is a genuine problem with an artifact about to be published, and
 * is the one condition that degrades the SBOM.
 */
type BuiltManifest =
	| { readonly _tag: "absent" }
	| { readonly _tag: "undecodable"; readonly reason: string }
	| { readonly _tag: "present"; readonly pkg: Package };

/**
 * Read a built package's `package.json` as a decoded {@link Package}.
 *
 * @remarks
 * The built artifact's manifest is the one that actually ships, so it is the
 * source both for the BOM's components (its `dependencies`) and for the root
 * component's own metadata — not the workspace-source manifest, whose
 * dependency specifiers carry `workspace:` protocol refs.
 *
 * `Package.decode` is **strict** where the predecessor's
 * `JSON.parse(...) as PackageJsonForSBOM` was not: a non-SemVer `version`, a
 * non-SPDX `license`, or a missing `name` fails. That is the right posture for
 * an artifact about to be published — but it must not abort validation, so a
 * decode failure degrades the BOM and records a finding rather than throwing.
 */
const readBuiltManifest = (buildDirectory: string): Effect.Effect<BuiltManifest, never, never> =>
	Effect.gen(function* () {
		const pkgJsonPath = join(buildDirectory, "package.json");
		if (!existsSync(pkgJsonPath)) return { _tag: "absent" as const };

		let raw: unknown;
		try {
			raw = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
		} catch (e) {
			return { _tag: "undecodable" as const, reason: e instanceof Error ? e.message : String(e) };
		}

		const decoded = yield* Effect.result(Package.decode(raw));
		if (decoded._tag === "Failure") {
			return { _tag: "undecodable" as const, reason: decoded.failure.message };
		}
		return { _tag: "present" as const, pkg: decoded.success };
	});

/**
 * Turn the resolved `sbom-config` template into the {@link SbomMetadataOptions}
 * that `SbomMetadataSource` threads onto the BOM.
 *
 * @remarks
 * This is all that survives of the old `infer-sbom-metadata` module. The
 * *inference* half — parsing `author` / `repository` / `bugs` / `homepage` out
 * of a manifest and normalizing git URLs to HTTPS — is `SbomMetadataSource`'s
 * job now, driven by the decoded {@link Package}. What remains here is only the
 * consumer's own precedence rule: the configured template wins over anything
 * derived from the manifest.
 *
 * `nowMillis` is passed in rather than read from the wall clock, matching the
 * kit's `formatCopyright` posture — the ambient read belongs at the caller's
 * edge, which is what makes the copyright year testable.
 */
const sbomOptionsFromConfig = (config: SBOMMetadataConfig | undefined, nowMillis: number): SbomMetadataOptions => {
	const now = new Date(nowMillis);
	const options: {
		supplier?: Supplier;
		authors?: ReadonlyArray<Contact>;
		timestamp?: string;
		publisher?: string;
		copyright?: string;
		documentationUrl?: string;
	} = {
		// NTIA minimum element 7. The predecessor never set one, so every
		// generated BOM reported `timestamp` missing.
		timestamp: now.toISOString(),
	};

	const supplierName = config?.supplier?.name;
	if (supplierName !== undefined && supplierName !== "") {
		const urls = config?.supplier?.url;
		const contacts = config?.supplier?.contact;
		const urlList = urls === undefined ? undefined : Array.isArray(urls) ? urls : [urls];
		const contactList = contacts === undefined ? undefined : Array.isArray(contacts) ? contacts : [contacts];
		options.supplier = Supplier.make({
			name: supplierName,
			...(urlList !== undefined && urlList.length > 0 && { url: urlList }),
			...(contactList !== undefined &&
				contactList.length > 0 && {
					contact: contactList.map((c) =>
						Contact.make({
							...(c.name !== undefined && { name: c.name }),
							...(c.email !== undefined && { email: c.email }),
							...(c.phone !== undefined && { phone: c.phone }),
						}),
					),
				}),
		});
	}

	// `publisher` resolves explicit → supplier name → the manifest's author.
	// The kit's `rootComponent` already does the last hop, so only the first
	// two are the consumer's to decide.
	const publisher = config?.publisher ?? supplierName;
	if (publisher !== undefined && publisher !== "") options.publisher = publisher;

	const copyrightHolder = config?.copyright?.holder ?? supplierName;
	if (copyrightHolder !== undefined && copyrightHolder !== "") {
		const startYear = config?.copyright?.startYear;
		options.copyright = SbomMetadataSource.formatCopyright(copyrightHolder, {
			...(startYear !== undefined && { startYear }),
			year: now.getFullYear(),
		});
	}

	const docUrl = config?.documentationUrl;
	if (docUrl !== undefined && docUrl !== "") options.documentationUrl = docUrl;

	// NTIA minimum element 6 — who assembled the BOM. The supplier is the
	// honest answer when the template names one; the manifest's author fills in
	// otherwise, via `fromPackage`.
	if (supplierName !== undefined && supplierName !== "") {
		options.authors = [Contact.make({ name: supplierName })];
	}

	return options;
};

/**
 * Collect workspace packages that are being released (version differs from
 * target branch, or package is brand-new on the target branch).
 *
 * @remarks
 * Reads the target branch through {@link WorkspaceSnapshots} — one cached
 * snapshot per `(root, ref)` — rather than the N unbounded-concurrency
 * `git show <branch>:<pkg>/package.json` calls this replaces, each of which
 * `JSON.parse`d inside a swallowing `try`/`catch` and needed a bespoke
 * relativePath→git-path normalizer for the root-workspace shapes (`""` and
 * `"."`). The snapshot keys on package **name**, so that normalizer is gone
 * along with the platform-specific `./package.json` hazard it existed for.
 *
 * A package absent from the snapshot is brand-new on the target branch and
 * therefore released. Unlike the per-file reads, a failure to read the ref at
 * all now **fails** rather than making every package look brand-new — which
 * would have reported the entire workspace as releasing.
 *
 * Root workspaces are deliberately NOT filtered out. In a typical monorepo the
 * root is a private orchestrator whose version never changes, so it falls
 * through the version-diff check naturally. In a single-root-workspace repo
 * (pnpm-workspace.yaml `packages: [.]`) the root IS the publishable package,
 * and filtering it would silently drop the only thing the action releases.
 *
 * Packages whose names match a pattern in `.changeset/config.json`'s `ignore`
 * list are fully excluded — they must not appear in the validation report.
 */
export const detectReleasedPackages = (
	workspacePackages: ReadonlyArray<WorkspacePackage>,
	targetBranch: string,
): Effect.Effect<ReadonlyArray<ReleasedPackage>, ValidationError, ChangesetConfig | WorkspaceSnapshots> =>
	Effect.gen(function* () {
		const config = yield* ChangesetConfig;
		const snapshots = yield* WorkspaceSnapshots;
		const root = process.cwd();

		const snapshot = yield* snapshots.at(targetBranch).pipe(
			Effect.mapError(
				(e) =>
					new ValidationError({
						reason: "dry-run",
						message: `Could not read the workspace at '${targetBranch}': ${String(e)}`,
						cause: e,
					}),
			),
		);
		const baseVersions = snapshot.versions;

		const kept: ReleasedPackage[] = [];
		for (const pkg of workspacePackages) {
			const baseVersion = baseVersions.get(pkg.name) ?? null;
			// Brand-new package (absent from the target branch) → released.
			// Changed version → released. Same version → not released.
			if (baseVersion !== null && pkg.version === baseVersion) continue;
			if (yield* config.isIgnored(pkg.name, root)) continue;
			kept.push({ pkg, currentVersion: pkg.version, baseVersion });
		}
		return kept;
	});

// ─── runValidation ────────────────────────────────────────────────────────────

/**
 * Effect-based Phase-2 validation orchestrator.
 *
 * @remarks
 * Orchestrates publish dry-run validation across registries and SBOM preview
 * generation. Each released package's resolved targets are grouped by build
 * directory; per build a single dry-run determines the pack sizes and a single
 * SBOM is generated (with `sbom-config` metadata applied). Per-registry publish
 * readiness stays per target. Does NOT handle build validation, check-run
 * creation, or sticky-comment updates — those remain in the `main.ts` handler.
 *
 * The returned effect fails with {@link ValidationError} when a fatal error
 * is encountered (e.g., workspace discovery fails). Non-fatal errors per
 * build (dry-run failures, SBOM issues) are collected and reflected in the
 * returned `ValidationReport` rather than causing the effect to fail.
 *
 * @public
 */
export const runValidation = (args: ValidationInputArgs) =>
	Effect.gen(function* () {
		const discovery = yield* WorkspaceDiscovery;
		const publish = yield* PackagePublish;
		const logger = yield* ActionLogger;
		// Read once at the edge: `SbomMetadataSource.formatCopyright` takes the
		// year as an argument precisely so the ambient clock read lives here and
		// the emitted copyright is testable.
		const nowMillis = yield* Clock.currentTimeMillis;

		// NO registry tokens are resolved here, deliberately. Phase 2 read the
		// `npm-token` input and the GitHub Packages token out of `ActionState`
		// for exactly one purpose: a `setupAuth` call issued before
		// `npm pack --dry-run`. That command never contacts a registry, so the
		// credential was resolved, decrypted and written to an npmrc for a
		// process that could not use it. With the call gone, the whole block
		// goes — Phase 2 now touches no publish credential at all. Phase 3's
		// real publish still resolves both, where they are load-bearing.

		// ── Resolve the SBOM metadata template once ──────────────────────────
		// `loadSBOMConfig` looks up `.github/silk-release.json`, then the
		// `sbom-config` action input (read via `ActionInput.string("sbom-config")`
		// under the ambient `ActionInput` provider, which uses the canonical
		// GitHub Actions env-var convention `INPUT_SBOM-CONFIG` — hyphens
		// preserved, only spaces mapped to underscores), then the
		// `SILK_RELEASE_SBOM_TEMPLATE` variable. Each candidate is decoded
		// through the `SilkReleaseConfig` Effect Schema; a decode failure
		// returns `{ ok: false, error }` so the SBOM step can record a warning
		// finding and proceed with an empty resolved metadata (preserving the
		// "continue on bad template" behaviour of the prior cast).
		const sbomConfigResult = yield* loadSBOMConfig().pipe(
			Effect.catchDefect((e) => {
				const message = e instanceof Error ? e.message : String(e);
				return Effect.succeed({ ok: false as const, error: message, source: { source: "none" as const } });
			}),
		);

		let sbomConfig: SBOMMetadataConfig | undefined;
		const sbomConfigFindings: ValidationFinding[] = [];
		if (sbomConfigResult.ok) {
			sbomConfig = sbomConfigResult.config;
		} else {
			sbomConfig = undefined;
			sbomConfigFindings.push({
				severity: "warning",
				check: "SBOM Preview",
				scope: null,
				message: `Failed to parse sbom-config: ${sbomConfigResult.error}`,
			});
			yield* Effect.logWarning(`sbom-config decode failed: ${sbomConfigResult.error}`);
		}

		// ── Step 1: Discover workspace packages ──────────────────────────────

		yield* Effect.logDebug("runValidation: discovering workspace packages");
		const workspacePackages = yield* discovery.listPackages().pipe(
			Effect.mapError(
				(e) =>
					new ValidationError({
						reason: "dry-run",
						message: `Workspace discovery failed: ${e.message}`,
						cause: e,
					}),
			),
		);

		// ── Step 2: Identify released packages via version diff ───────────────
		// Phase 2 runs on the release branch where `changeset version` has
		// already consumed all .changeset/*.md files, so ChangesetAnalyzer
		// returns empty. Instead, diff each package's current version against
		// the target branch to discover what is being released.

		yield* Effect.logDebug("runValidation: detecting released packages via version diff");
		const releasedPackages = yield* detectReleasedPackages(workspacePackages, args.targetBranch).pipe(
			Effect.mapError(
				(e) =>
					new ValidationError({
						reason: "dry-run",
						message: `Version diff failed: ${e.message}`,
						cause: e,
					}),
			),
		);

		yield* Effect.logDebug(`runValidation: ${releasedPackages.length} package(s) to validate`);

		if (releasedPackages.length === 0) {
			yield* Effect.logDebug("runValidation: no packages to validate");
			// A release branch with zero version diffs against the target branch
			// is a valid-but-suspicious state. Three causes are possible: the
			// release has already merged into the target branch (benign), Phase 1
			// did not commit the expected version bumps (an upstream bug worth
			// surfacing), or workspace discovery is misconfigured. Emit a
			// warning finding so the LLM reviewer and the sticky comment surface
			// the situation — the run still succeeds.
			const noPackagesWarning: ValidationFinding = {
				severity: "warning",
				check: "Publish Validation",
				scope: null,
				message:
					"No packages have version differences against the target branch. " +
					"This is benign if the release has already merged into the target branch. " +
					"Otherwise, investigate Phase 1: the version-bump commit may be missing, " +
					"or workspace discovery may be misconfigured.",
			};
			return {
				publishOk: true,
				npmReady: true,
				githubPackagesReady: true,
				totalTargets: 0,
				readyTargets: 0,
				hasVersionOnlyPackages: false,
				packages: [],
				validationPackages: [],
				sbomOk: true,
				sbomSummary: "No packages require SBOM",
				findings: [...sbomConfigFindings, noPackagesWarning],
				resolvedSbomConfig: new Map<string, SbomMetadata>(),
				sbomConfigSource: sbomConfigResult.source,
			} satisfies ValidationReport;
		}

		// Order the released packages topologically (dependencies first) so the
		// dry-run / SBOM steps surface in the same order the Phase-3 publish runs
		// them. `listPackages` returns workspace glob order (alphabetical), not
		// dependency order; the shared helper keeps only the released packages and
		// falls back to discovery order on a cyclic graph rather than aborting.
		const releasedByName = new Map(releasedPackages.map((r) => [r.pkg.name, r] as const));
		const sortedReleasedNames = yield* sortReleasesTopologically([...releasedByName.keys()]);
		const orderedReleasedPackages = sortedReleasedNames
			.map((name) => releasedByName.get(name))
			.filter((r): r is ReleasedPackage => r !== undefined);

		// Structured findings accumulated across the publish dry-run and SBOM
		// steps. Errors fail their check; warnings are advisory. Discovery order
		// is preserved (the comment renderer reorders errors-before-warnings).
		// Seeded with any sbom-config decode warning so the SBOM Preview check
		// surfaces a malformed template up-front.
		const findings: ValidationFinding[] = [...sbomConfigFindings];

		// ── Step 3: Resolve targets, group into builds, dry-run + SBOM ────────

		yield* Effect.logDebug("runValidation: resolving publish targets, grouping into builds");

		// Per-package changeset counts read from the target branch's `.changeset`
		// directory (still present there — Phase 1 consumed them only on the
		// release branch). Best-effort: an empty map on any failure.
		const changesetCounts = yield* countChangesetsPerPackage(args.targetBranch);

		const workspaceRoot = process.cwd();
		const validationPackages: ValidationPackageResult[] = [];
		// Per-build resolved SBOM metadata, keyed by `${pkg.name}:${build.directory}`.
		// Debug-only — fed into the SBOM Preview check-run summary by `main.ts`.
		const resolvedSbomConfig = new Map<string, SbomMetadata>();
		let allPublishOk = true;
		let npmReadyAll = true;
		let githubPackagesReadyAll = true;
		let totalTargets = 0;
		let readyTargets = 0;
		let sbomOk = true;
		let sbomCount = 0;
		let sbomSuccess = 0;

		for (const { pkg, baseVersion } of orderedReleasedPackages) {
			// Resolve publish targets, then drop any whose built `package.json` is
			// `private` — validation only exercises what will actually be published.
			//
			// A `PublishTargetBindingError` means detection selected a directory the
			// package's `dist/prod/targets.json` does not bind — the #143 shape, where
			// a dev build was about to be packed. Record it as an error finding rather
			// than aborting the whole run: the check fails, auto-merge is blocked, and
			// the remaining packages still get validated and reported.
			const resolved = yield* Effect.result(resolvePublishableTargets(pkg, workspaceRoot));
			if (resolved._tag === "Failure") {
				const bindingError = resolved.failure;
				yield* Effect.logError(bindingError.message);
				findings.push({
					severity: "error",
					check: "Publish Validation",
					scope: { package: pkg.name, directory: bindingError.directory },
					message: bindingError.message,
				});
				validationPackages.push({
					name: pkg.name,
					version: pkg.version,
					baseVersion,
					changesetCount: changesetCounts.get(pkg.name) ?? null,
					builds: [],
					releaseNotes: extractReleaseNotes(pkg.path),
				});
				continue;
			}
			const targets = resolved.success;

			// Read the CHANGELOG.md `changeset version` already wrote — the
			// release branch carries the per-version section. The extractor
			// takes the body of the first H2 (always the newest entry); a
			// version-only package still has a CHANGELOG, same rule applies.
			const releaseNotes = extractReleaseNotes(pkg.path);

			if (targets.length === 0) {
				yield* Effect.logDebug(`${pkg.name}: no publish targets (version-only)`);
				validationPackages.push({
					name: pkg.name,
					version: pkg.version,
					baseVersion,
					changesetCount: changesetCounts.get(pkg.name) ?? null,
					builds: [],
					releaseNotes,
				});
				continue;
			}

			// Group the resolved targets by build directory — one build per unique
			// directory. Targets sharing a directory share one tarball and one SBOM.
			const builds = groupTargetsIntoBuilds(pkg, targets);
			const buildResults: PackageBuildResult[] = [];

			for (const build of builds) {
				const group = getGroupId(build.directory);
				// Multi-build packages (split across byte-groups) disambiguate the
				// group title with the group id, exactly like the Phase-3 publish tree.
				const groupSuffix = builds.length > 1 ? ` · ${group}` : "";

				// The tarball is a property of the DIRECTORY: identical across every
				// registry publishing it. So the dry-run runs once per build, and
				// per-registry publish readiness is decided from that single result
				// below. There is no longer a "sizing target" — the kit's `dryRun`
				// takes no registry, access or provenance, which is the honest
				// signature: `npm pack --dry-run` is not affected by any of them.

				// The built `dist/<dir>/package.json` is the artifact that actually
				// ships, so it is the source for both the BOM's components and the
				// root component's metadata. Undecodable → `Option.none`, and the
				// SBOM falls back to the workspace package's own name/version.
				const manifest = yield* readBuiltManifest(build.absoluteDirectory);
				const sbomOptions = sbomOptionsFromConfig(sbomConfig, nowMillis);

				// One collapsible group per package-build, mirroring the Phase-3 publish
				// tree: a `📦 pack` line (dry-run sizing), per-registry readiness rows,
				// and a `📄 sbom` line, capped by a group summary line.
				const buildResult = yield* logger.group(
					`Validate · ${pkg.name}@${pkg.version}${groupSuffix}`,
					Effect.gen(function* () {
						// ── 📦 pack / dry-run (sizing, one per directory) ──────────────
						const dryRunOutcome = yield* Effect.gen(function* () {
							yield* Effect.logDebug(`npm pack --dry-run in ${build.absoluteDirectory}`);

							// No `setupAuth` here, deliberately. `npm pack --dry-run` never
							// contacts a registry — it packs the directory and reports sizes
							// — so writing a token into an npmrc before it was a no-op that
							// still resolved and decrypted a credential. Phase 3's real
							// publish does its own auth setup, where it is load-bearing.
							const result = yield* publish.dryRun(build.absoluteDirectory).pipe(
								Effect.map((dryRunResult) => ({
									success: dryRunResult.ok,
									output: dryRunResult.output,
									packedSize: dryRunResult.packedSize,
									unpackedSize: dryRunResult.unpackedSize,
									fileCount: dryRunResult.fileCount,
								})),
								Effect.catch((e) =>
									Effect.succeed({
										success: false as const,
										output: e.message,
										packedSize: undefined,
										unpackedSize: undefined,
										fileCount: undefined,
									}),
								),
							);

							if (result.success) {
								yield* Effect.logInfo(
									`  \u{1F4E6} pack: ${
										result.packedSize !== undefined && result.fileCount !== undefined
											? `${humanizeSize(result.packedSize)} · ${result.fileCount} files`
											: "sized"
									}`,
								);
							} else {
								// Concise failure line (first line of npm's error); the full output
								// is carried in the per-registry finding, not spilled into the tree.
								const first = (result.output ?? "").trim().split("\n")[0] || "dry-run failed";
								yield* Effect.logWarning(`  \u{1F4E6} pack: ${first}`);
							}
							return result;
						});

						// ── ⬆ per-registry publish readiness ───────────────────────────
						// All targets share the single dry-run above, so these are
						// informational rows (not independent pass/fail steps).
						const targetResults: BuildTargetResult[] = [];
						for (const target of build.targets) {
							totalTargets++;
							const kind = classifyRegistry(target.registry);
							const label = registryShortLabel(target.registry);

							if (dryRunOutcome.success) {
								readyTargets++;
								targetResults.push({
									registry: target.registry,
									status: "ready",
									access: target.access,
									provenance: target.provenance,
								});
								yield* Effect.logInfo(`  \u{2B06} ${label} · ready`);
							} else {
								allPublishOk = false;
								if (kind === "npm") npmReadyAll = false;
								if (kind === "github-packages") githubPackagesReadyAll = false;
								const detail = (dryRunOutcome.output ?? "").trim() || "unknown error";
								targetResults.push({
									registry: target.registry,
									status: "failed",
									access: target.access,
									provenance: target.provenance,
									error: detail,
								});
								findings.push({
									severity: "error",
									check: "Publish Validation",
									scope: { package: pkg.name, directory: build.directory },
									message: `dry-run failed: ${detail}`,
								});
								yield* Effect.logWarning(`  \u{2B06} ${label} · not-ready`);
							}
						}

						// ── 📄 sbom (one per directory) ────────────────────────────────
						sbomCount++;
						// `Sbom.generate`, `Sbom.toJson` and `NtiaReport.of` are TOTAL —
						// assembling and serializing an owned model over validated values has
						// nothing to fail at. So there is no `Effect.catch` arm here and no
						// `ok: false` branch: the predecessor's `SbomError` channel existed
						// only to guard a library that might throw, and the package it
						// guarded no longer can.
						const componentInputs =
							manifest._tag === "present"
								? Array.from(manifest.pkg.dependencies, ([name, version]) => ({ name, version }))
								: [];
						const components: ReadonlyArray<Component> = componentInputs.map((input) =>
							SbomMetadataSource.componentFor(input),
						);

						yield* Effect.logDebug(
							`workspace package: ${pkg.name}@${pkg.version} · group: ${group} · ${components.length} dep(s)`,
						);

						// A missing or undecodable manifest still yields a BOM, built from
						// the workspace package's own coordinates — reproducing the
						// predecessor's `return {}` tolerance without pretending an
						// undecodable manifest was well-formed.
						const root =
							manifest._tag === "present"
								? SbomMetadataSource.rootComponent(manifest.pkg, sbomOptions)
								: SbomMetadataSource.componentFor({ name: pkg.name, version: pkg.version });
						const metadata =
							manifest._tag === "present"
								? SbomMetadataSource.fromPackage(manifest.pkg, sbomOptions)
								: SbomMetadata.make({
										...(sbomOptions.supplier !== undefined && { supplier: sbomOptions.supplier }),
										...(sbomOptions.authors !== undefined && { authors: [...sbomOptions.authors] }),
										...(sbomOptions.timestamp !== undefined && { timestamp: sbomOptions.timestamp }),
									});

						resolvedSbomConfig.set(`${pkg.name}:${build.directory}`, metadata);

						const document = Sbom.generate({ root, components, metadata });
						yield* Effect.logDebug(`generated CycloneDX BOM:\n${Sbom.toJson(document)}`);

						const ntia = NtiaReport.of(document);
						const missing = [...ntia.missing];
						const componentCount = document.components.length;

						const sbomFindings: ValidationFinding[] = [];
						if (!ntia.compliant) {
							sbomFindings.push({
								severity: "warning",
								check: "SBOM Preview",
								scope: { package: pkg.name, directory: build.directory },
								message: `SBOM generated but missing NTIA fields: ${missing.join(", ")}`,
							});
						}
						// A dependency-free package legitimately has a component-less BOM —
						// that is not a finding.

						// The one thing that can still degrade an SBOM: a manifest that is
						// PRESENT but will not decode, so the BOM carries no dependencies
						// and no manifest-derived metadata. Generation itself cannot fail,
						// and an ABSENT manifest is not a degradation — a dependency-free
						// package legitimately has a component-less BOM.
						const manifestOk = manifest._tag !== "undecodable";
						if (manifest._tag === "undecodable") {
							sbomFindings.push({
								severity: "warning",
								check: "SBOM Preview",
								scope: { package: pkg.name, directory: build.directory },
								message: `Built package.json could not be decoded (${manifest.reason}); SBOM generated without dependencies or manifest metadata`,
							});
						}
						const buildSbom: BuildSbom = {
							componentCount,
							ntiaCompliant: ntia.compliant,
							missingNtiaFields: missing,
						};
						yield* Effect.logInfo(
							`  \u{1F4C4} sbom: ${componentCount} components · NTIA ${ntia.compliant ? "\u2713" : "\u26A0"}`,
						);

						findings.push(...sbomFindings);
						if (manifestOk) {
							sbomSuccess++;
						} else {
							sbomOk = false;
						}

						// ── group summary ─────────────────────────────────────────────
						const readyCount = targetResults.filter((t) => t.status === "ready").length;
						const notReadyCount = targetResults.length - readyCount;
						const sizePart =
							dryRunOutcome.packedSize !== undefined ? humanizeSize(dryRunOutcome.packedSize) : "unsized";
						const sbomPart = !manifestOk ? "SBOM degraded" : ntia.compliant ? "SBOM ok" : "SBOM ⚠";
						const readyPart =
							notReadyCount > 0 ? `${readyCount} ready, ${notReadyCount} not-ready` : `${readyCount} ready`;
						const summary = `${readyPart} · ${sizePart} · ${sbomPart}`;
						if (notReadyCount > 0 || !manifestOk) {
							yield* Effect.logWarning(`\u274C ${summary}`);
						} else {
							yield* Effect.logInfo(`\u2705 ${summary}`);
						}

						return {
							directory: build.directory,
							packedBytes: dryRunOutcome.packedSize ?? null,
							unpackedBytes: dryRunOutcome.unpackedSize ?? null,
							fileCount: dryRunOutcome.fileCount ?? null,
							sbom: buildSbom,
							targets: targetResults,
						} satisfies PackageBuildResult;
					}),
				);

				buildResults.push(buildResult);
			}

			validationPackages.push({
				name: pkg.name,
				version: pkg.version,
				baseVersion,
				changesetCount: changesetCounts.get(pkg.name) ?? null,
				builds: buildResults,
				releaseNotes,
			});
		}

		const sbomSummary =
			sbomCount === 0
				? "No packages require SBOM"
				: sbomOk
					? `${sbomCount} SBOM(s) generated successfully`
					: `${sbomSuccess}/${sbomCount} SBOM(s) generated`;

		// ── Step 4: Assemble ValidationReport ────────────────────────────────
		// The report is build-centric — `validationPackages` carries the builds,
		// sizes, SBOMs, and registry targets. `main.ts` projects them into the
		// canonical `ValidationOutput` and renders the comment from that object;
		// this module no longer pre-renders markdown.

		const hasVersionOnlyPackages = totalTargets === 0 && validationPackages.length > 0;

		const reportPackages = validationPackages.map((p) => ({
			name: p.name,
			version: p.version,
			ready: p.builds.length === 0 || p.builds.every((b) => b.targets.every((t) => t.status !== "failed")),
		}));

		return {
			publishOk: allPublishOk,
			npmReady: npmReadyAll,
			githubPackagesReady: githubPackagesReadyAll,
			totalTargets,
			readyTargets,
			hasVersionOnlyPackages,
			packages: reportPackages,
			validationPackages,
			sbomOk,
			sbomSummary,
			findings,
			resolvedSbomConfig,
			sbomConfigSource: sbomConfigResult.source,
		} satisfies ValidationReport;
	});
