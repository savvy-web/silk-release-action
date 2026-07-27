import { existsSync, readFileSync } from "node:fs";
import type { WorkspacePackage } from "@effected/workspaces";
import { findWorkspaceRootSync, getWorkspacePackagesSync } from "@effected/workspaces";
import { nodeSyncOps } from "@effected/workspaces/node-sync";

/**
 * Discover workspace packages from `cwd` using `@effected/workspaces`'s sync API.
 *
 * @returns Array of workspace packages (root + children), or `[]` if the cwd
 *   is not inside a project.
 */
function listWorkspacePackages(): ReadonlyArray<WorkspacePackage> {
	const root = findWorkspaceRootSync(process.cwd(), nodeSyncOps);
	if (!root) return [];
	return getWorkspacePackagesSync(root, nodeSyncOps);
}

/**
 * Relevant fields from .changeset/config.json
 */
interface ChangesetConfig {
	/** Package names/patterns to ignore from releases */
	ignore?: string[];
}

/**
 * Checks if a package name matches an ignore pattern from changeset config
 *
 * @param packageName - The package name to check
 * @param pattern - The ignore pattern (supports exact match and `@scope/*` wildcards)
 * @returns True if the package name matches the pattern
 *
 * @remarks
 * Supports two pattern formats:
 * - Exact match: `"my-package"` matches only `"my-package"`
 * - Scope wildcard: `"@scope/*"` matches any package starting with `"@scope/"`
 */
export function matchesIgnorePattern(packageName: string, pattern: string): boolean {
	if (pattern.endsWith("/*")) {
		// Scope wildcard pattern: "@scope/*" matches "@scope/anything"
		const prefix = pattern.slice(0, -1); // Remove trailing "*", keep "/"
		return packageName.startsWith(prefix);
	}
	// Exact match
	return packageName === pattern;
}

/**
 * Reads the changeset ignore patterns from config
 *
 * @returns Array of ignore patterns, empty array if config doesn't exist or has no ignore
 */
function getChangesetIgnorePatterns(): string[] {
	try {
		if (!existsSync(".changeset/config.json")) {
			return [];
		}

		const configContent = readFileSync(".changeset/config.json", "utf-8");
		const config = JSON.parse(configContent) as ChangesetConfig;

		return config.ignore ?? [];
	} catch {
		return [];
	}
}

/**
 * Checks if a package should be ignored based on changeset config
 *
 * @param packageName - The package name to check
 * @param ignorePatterns - Array of ignore patterns from changeset config
 * @returns True if the package matches any ignore pattern
 *
 * @remarks
 * Shared with the release-PR-title and tag-strategy publishability detection so
 * a changeset-ignored package (e.g. an example package with `publishConfig` that
 * is excluded from releases) is never counted as a package that can release.
 */
export function isIgnoredPackage(packageName: string, ignorePatterns: ReadonlyArray<string>): boolean {
	return ignorePatterns.some((pattern) => matchesIgnorePattern(packageName, pattern));
}

/**
 * Detects if this is effectively a single-package repository
 *
 * @returns True if there's only one publishable package (after excluding ignored packages)
 *
 * @remarks
 * A repository is considered "single-package" when:
 * - There are 0 or 1 workspace entries, OR
 * - All workspace packages except the root are in the changeset `ignore` list
 *
 * This handles cases like test fixtures in workspaces that are excluded from releases.
 */
export function isSinglePackage(): boolean {
	try {
		const workspaces = listWorkspacePackages();

		// 0 or 1 workspace = definitely single package
		if (workspaces.length <= 1) {
			return true;
		}

		// Check if all non-root packages are ignored by changesets
		const ignorePatterns = getChangesetIgnorePatterns();
		if (ignorePatterns.length === 0) {
			// No ignore patterns, so multiple packages means not single
			return false;
		}

		// Get root package name to exclude from ignore check
		let rootPackageName = "";
		try {
			const packageJsonContent = readFileSync("package.json", "utf-8");
			const packageJson = JSON.parse(packageJsonContent) as { name?: string };
			rootPackageName = packageJson.name ?? "";
		} catch {
			// If we can't read root package.json, we can't determine single-package
			return false;
		}

		// Count non-ignored, non-root packages
		const publishablePackages = workspaces.filter((ws) => {
			const name = ws.name;
			// Root package is always publishable (if versioned)
			if (name === rootPackageName) {
				return true;
			}
			// Check if this package is ignored
			return !isIgnoredPackage(name, ignorePatterns);
		});

		// Single package if only the root package is publishable
		return publishablePackages.length <= 1;
	} catch {
		// If workspace detection fails, assume single-package
		return true;
	}
}
