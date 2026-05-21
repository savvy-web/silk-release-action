import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findWorkspaceRootSync, getWorkspacePackagesSync } from "workspaces-effect";

/** Minimal raw package.json shape needed to read publishConfig. */
interface RawPackageJson {
	name?: string;
	version?: string;
	private?: boolean;
	publishConfig?: {
		access?: "public" | "restricted";
		registry?: string;
		directory?: string;
		/** Silk-specific: explicit list of publish targets (e.g. `["npm", "github"]`). */
		targets?: unknown[];
	};
}

/**
 * Changeset configuration
 */
export interface ChangesetConfig {
	fixed?: string[][];
	linked?: string[][];
}

/**
 * Workspace package info
 */
export interface WorkspacePackageInfo {
	/** Package name */
	name: string;
	/** Package version */
	version: string;
	/** Package path */
	path: string;
	/** Whether package is private */
	private: boolean;
	/** Whether package has publishConfig.access */
	hasPublishConfig: boolean;
	/** Access level if configured */
	access?: "public" | "restricted" | undefined;
	/** Number of publish targets */
	targetCount: number;
}

/**
 * Read the changeset configuration file
 *
 * @returns Changeset config or null if not found/readable
 */
export function readChangesetConfig(): ChangesetConfig | null {
	const configPath = join(process.cwd(), ".changeset", "config.json");

	try {
		if (existsSync(configPath)) {
			const content = readFileSync(configPath, "utf8");
			return JSON.parse(content) as ChangesetConfig;
		}
	} catch {
		// ignore — no config is a valid state
	}

	return null;
}

/**
 * Get all workspace packages including their publish configuration
 *
 * @returns Array of workspace package info
 */
export function getAllWorkspacePackages(): WorkspacePackageInfo[] {
	const cwd = process.cwd();
	const workspaceRoot = findWorkspaceRootSync(cwd);

	if (!workspaceRoot) {
		return [];
	}

	const workspaces = getWorkspacePackagesSync(workspaceRoot);
	const packages: WorkspacePackageInfo[] = [];

	for (const workspace of workspaces) {
		// `workspaces-effect`'s typed PublishConfig doesn't carry `targets`, so
		// re-read the raw package.json to compute target counts under silk rules.
		const rawPath = join(workspace.path, "package.json");
		let rawPkg: RawPackageJson = {};
		try {
			rawPkg = JSON.parse(readFileSync(rawPath, "utf8")) as RawPackageJson;
		} catch {
			// ignore — treat as empty publish config
		}

		const hasPublishConfig = rawPkg.publishConfig?.access !== undefined;
		// targetCount: mirrors the silk publishability rules without needing
		// the Effect-based publishability.ts service.
		//   - `publishConfig.targets` is a non-empty array → count its length
		//     (e.g. ["npm", "github"] → 2)
		//   - `publishConfig.access` is set but no explicit targets array →
		//     one implicit target (the default npm/GitHub Packages registry)
		//   - neither → 0 (not publishable)
		const rawTargets = rawPkg.publishConfig?.targets;
		const targetCount =
			Array.isArray(rawTargets) && rawTargets.length > 0 ? rawTargets.length : hasPublishConfig ? 1 : 0;

		packages.push({
			name: workspace.name,
			version: workspace.version || "0.0.0",
			path: workspace.path,
			private: workspace.private === true,
			hasPublishConfig,
			access: rawPkg.publishConfig?.access,
			targetCount,
		});
	}

	return packages;
}
