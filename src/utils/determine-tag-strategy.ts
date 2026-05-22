import { Effect } from "effect";
import type { PublishabilityDetector, WorkspaceDiscovery } from "workspaces-effect";
import { ChangesetConfig } from "../release/changeset-config.js";
import type { PackagePublishResult } from "../release/types.js";
import { listPublishablePackages } from "./release-summary-helpers.js";

/**
 * Tag strategy result
 */
export interface TagStrategyResult {
	/** Strategy type: 'single' for one tag, 'multiple' for per-package tags */
	strategy: "single" | "multiple";
	/** Tags to create */
	tags: TagInfo[];
	/** Whether all packages have the same version (fixed versioning) */
	isFixedVersioning: boolean;
}

/**
 * Information about a single tag
 */
export interface TagInfo {
	/** Git tag name (e.g., 'v1.0.0' or '@scope/pkg@1.0.0') */
	name: string;
	/** Package name associated with this tag */
	packageName: string;
	/** Version for this tag */
	version: string;
}

/**
 * Determines if the repository requires per-package tags (is a "monorepo" for tagging purposes).
 *
 * @remarks
 * A repository needs per-package tags when:
 * - Multiple publishable packages exist AND they are NOT all in the same fixed group
 *
 * A repository uses single version tags when:
 * - Only 1 publishable package exists, OR
 * - All publishable packages are in the same fixed group
 *
 * Resolved through the single `PublishabilityDetector` (which already honors changeset ignore).
 *
 * @returns Effect resolving to true if per-package tags are needed, false for single version tag
 */
export const isMonorepoForTagging = (
	workspaceRoot: string,
): Effect.Effect<boolean, never, WorkspaceDiscovery | PublishabilityDetector | ChangesetConfig> =>
	Effect.gen(function* () {
		const publishable = yield* listPublishablePackages(workspaceRoot);
		if (publishable.length <= 1) return false;
		const fixed = yield* (yield* ChangesetConfig).fixed(workspaceRoot);
		const publishableNames = new Set(publishable.map((p) => p.name));
		for (const group of fixed) {
			if ([...publishableNames].every((name) => group.includes(name))) return false;
		}
		return true;
	});

/**
 * Determine the tagging strategy for releases
 *
 * @remarks
 * Tagging strategy rules:
 * - Single-package repo → single tag: `v1.0.0`
 * - Monorepo with all packages in same fixed group → single tag: `v1.0.0`
 * - Monorepo with independent/linked versioning → per-package tags: `@scope/pkg@1.0.0`
 *
 * @param publishResults - Results from publishing packages
 * @param needsPerPackageTags - Whether the repo requires per-package tags (from {@link isMonorepoForTagging})
 * @returns Tag strategy with tags to create
 */
export function determineTagStrategy(
	publishResults: PackagePublishResult[],
	needsPerPackageTags: boolean,
): TagStrategyResult {
	// Filter to only successful packages: those with at least one successful target,
	// or version-only packages (empty targets array - nothing to fail)
	const successfulPackages = publishResults.filter(
		(pkg) => pkg.targets.length === 0 || pkg.targets.some((t) => t.success),
	);

	if (successfulPackages.length === 0) {
		return {
			strategy: "single",
			tags: [],
			isFixedVersioning: true,
		};
	}

	// needsPerPackageTags is passed in from the caller (computed via isMonorepoForTagging)

	if (!needsPerPackageTags) {
		// Single-package repo or all packages in same fixed group
		// Check if all released packages have same version (should be true for fixed)
		const versions = new Set(successfulPackages.map((pkg) => pkg.version));
		const isFixedVersioning = versions.size === 1;

		if (isFixedVersioning) {
			const version = successfulPackages[0].version;
			const tag = version;
			const packageNames =
				successfulPackages.length === 1 ? successfulPackages[0].name : successfulPackages.map((p) => p.name).join(", ");

			return {
				strategy: "single",
				tags: [
					{
						name: tag,
						packageName: packageNames,
						version,
					},
				],
				isFixedVersioning: true,
			};
		}

		// Edge case: multiple packages released with different versions but not a monorepo
		// This shouldn't happen in practice, but handle it by using highest version
		const highestVersion = [...versions].sort().pop() || successfulPackages[0].version;

		return {
			strategy: "single",
			tags: [
				{
					name: highestVersion,
					packageName: successfulPackages.map((p) => p.name).join(", "),
					version: highestVersion,
				},
			],
			isFixedVersioning: false,
		};
	}

	// Monorepo with independent/linked versioning - create tag per package
	const tags = successfulPackages.map((pkg) => {
		// Use npm-style tags for scoped packages: @scope/pkg@1.0.0
		// Use v-prefix for non-scoped: pkg@v1.0.0
		const tag = pkg.name.startsWith("@") ? `${pkg.name}@${pkg.version}` : `${pkg.name}@v${pkg.version}`;

		return {
			name: tag,
			packageName: pkg.name,
			version: pkg.version,
		};
	});

	// Check if all released packages happen to have same version
	const versions = new Set(successfulPackages.map((pkg) => pkg.version));
	const isFixedVersioning = versions.size === 1;

	return {
		strategy: "multiple",
		tags,
		isFixedVersioning,
	};
}

/**
 * Determine the release type based on version changes
 *
 * @remarks
 * Analyzes the version changes to determine if this is a major, minor, or patch release.
 * For multiple packages with different bump types, returns the highest (major > minor > patch).
 *
 * @param publishResults - Results from publishing packages
 * @param bumpTypes - Map of package name to bump type
 * @returns Release type: 'major', 'minor', or 'patch'
 */
export function determineReleaseType(
	publishResults: PackagePublishResult[],
	bumpTypes: Map<string, string>,
): "major" | "minor" | "patch" {
	// Include version-only packages (empty targets) in release type determination
	const successfulPackages = publishResults.filter(
		(pkg) => pkg.targets.length === 0 || pkg.targets.some((t) => t.success),
	);

	// Get bump types for successful packages
	const bumps = successfulPackages
		.map((pkg) => bumpTypes.get(pkg.name))
		.filter((bump): bump is string => bump !== undefined);

	// Return highest bump type
	if (bumps.includes("major")) return "major";
	if (bumps.includes("minor")) return "minor";
	return "patch";
}
