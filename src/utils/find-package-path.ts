import { join } from "node:path";
import { findWorkspaceRootSync, getWorkspacePackagesSync } from "workspaces-effect";
import { debug, info, warning } from "./_actions-compat.js";

/**
 * Cached workspace info to avoid repeated filesystem operations
 */
let cachedWorkspaces: Map<string, string> | null = null;

/**
 * Gets all workspace packages mapped by name to path
 *
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns Map of package name to package path
 */
function getWorkspaceMap(cwd: string = process.cwd()): Map<string, string> {
	if (cachedWorkspaces) {
		return cachedWorkspaces;
	}

	cachedWorkspaces = new Map();

	const root = findWorkspaceRootSync(cwd);
	if (!root) {
		info("No workspace root detected from cwd; package map will be empty");
		return cachedWorkspaces;
	}

	const packages = getWorkspacePackagesSync(root);
	for (const pkg of packages) {
		cachedWorkspaces.set(pkg.name, pkg.path);
		debug(`Found workspace: ${pkg.name} at ${pkg.path}`);
	}

	info(`Found ${cachedWorkspaces.size} workspace package(s)`);
	return cachedWorkspaces;
}

/**
 * Clears the workspace cache (useful for testing)
 */
export function clearWorkspaceCache(): void {
	cachedWorkspaces = null;
}

/**
 * Finds the file system path for a package
 *
 * @param packageName - Package name to find
 * @param publishSubdir - Subdirectory containing publishable files (e.g., "dist/npm")
 * @returns Package path or null if not found
 *
 * @remarks
 * Uses `workspaces-effect` to find package paths from the workspace
 * configuration. This handles cases where directory names don't match
 * package names (e.g., `@savvy-web/dependency-package` in directory
 * `dependency`).
 *
 * If `publishSubdir` is provided, it is appended to the package path to
 * locate the directory containing the publishable package.
 */
export function findPackagePath(packageName: string, publishSubdir?: string): string | null {
	const workspaceMap = getWorkspaceMap();
	const packagePath = workspaceMap.get(packageName);

	if (!packagePath) {
		warning(`Could not find workspace path for package: ${packageName}`);
		return null;
	}

	// If a publish subdirectory is specified, append it to the path
	if (publishSubdir) {
		const publishPath = join(packagePath, publishSubdir);
		debug(`Package ${packageName} publish path: ${publishPath}`);
		return publishPath;
	}

	debug(`Found package ${packageName} at: ${packagePath}`);
	return packagePath;
}

/**
 * Finds the publishable directory for a package
 *
 * @param packageName - Package name to find
 * @returns Path to the dist/npm directory for publishing, or null if not found
 *
 * @remarks
 * Returns the path to the package's dist/npm directory, which is where
 * built packages are located for publishing.
 */
export function findPublishablePath(packageName: string): string | null {
	return findPackagePath(packageName, "dist/npm");
}
