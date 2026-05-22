import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { Effect } from "effect";
import {
	PublishabilityDetector,
	WorkspaceDiscovery,
	findWorkspaceRootSync,
	getWorkspacePackagesSync,
} from "workspaces-effect";
import { isIgnoredPackage } from "./detect-repo-type.js";

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
	/** Package names/patterns excluded from releases (e.g. `["@libraries/*"]`). */
	ignore?: string[];
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

/** A publishable workspace package and the count of its resolved publish targets. */
export interface PublishablePackage {
	readonly name: string;
	readonly version: string;
	readonly path: string;
	readonly targetCount: number;
}

/**
 * The publishable, non-ignored packages, resolved through the single
 * PublishabilityDetector (which already honors changeset ignore). Replaces the
 * synchronous getAllWorkspacePackages + target-count reimplementation.
 */
export const listPublishablePackages = (
	workspaceRoot: string,
): Effect.Effect<ReadonlyArray<PublishablePackage>, never, WorkspaceDiscovery | PublishabilityDetector> =>
	Effect.gen(function* () {
		const discovery = yield* WorkspaceDiscovery;
		const detector = yield* PublishabilityDetector;
		const packages = yield* discovery.listPackages().pipe(Effect.orDie);
		const out: PublishablePackage[] = [];
		for (const pkg of packages) {
			const targets = yield* detector.detect(pkg, workspaceRoot);
			if (targets.length > 0) {
				out.push({ name: pkg.name, version: pkg.version, path: pkg.path, targetCount: targets.length });
			}
		}
		return out;
	});

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

/**
 * The shared "is this package publishable" predicate.
 *
 * @remarks
 * A package is publishable when it carries explicit publish config
 * (`publishConfig.access` or `publishConfig.targets`) or is simply not marked
 * private. This mirrors the silk publishability rules; `determineTagStrategy`
 * uses the same predicate so tag strategy and release-PR-title detection stay
 * in lockstep.
 *
 * @param pkg - The workspace package to test.
 * @returns True when the package would be published.
 */
export function isPublishablePackage(pkg: WorkspacePackageInfo): boolean {
	return pkg.hasPublishConfig || pkg.targetCount > 0 || !pkg.private;
}

/**
 * The workspace packages that can actually release — every workspace that
 * {@link isPublishablePackage} and is not excluded by the changeset `ignore`
 * list.
 *
 * @remarks
 * Honouring `ignore` matters for repos like rslib-builder, whose example
 * packages carry `publishConfig` (so they look publishable) but are excluded
 * from releases via `ignore: ["@libraries/*", "@rspress/*"]`. Without this they
 * would be miscounted as releasable and skew the release-PR-title format.
 *
 * @returns The subset of {@link getAllWorkspacePackages} that would publish and is not changeset-ignored.
 */
export function getPublishablePackages(): WorkspacePackageInfo[] {
	const ignorePatterns = readChangesetConfig()?.ignore ?? [];
	return getAllWorkspacePackages().filter(
		(pkg) => isPublishablePackage(pkg) && !isIgnoredPackage(pkg.name, ignorePatterns),
	);
}

/**
 * The publishable packages whose `package.json` changed in this version bump —
 * i.e. the packages that will actually release.
 *
 * @remarks
 * After `changeset version` runs, only released packages have a bumped
 * `package.json`. This narrows the publishable set to those by matching their
 * repo-root-relative `package.json` path against the changed files. Paths are
 * normalised to POSIX separators to match `git status` output.
 *
 * @param publishablePackages - The publishable workspaces (see {@link getPublishablePackages}).
 * @param changedFiles - `git status --porcelain` output for the version bump.
 * @param repoRoot - The directory the workspace paths and git output resolve against (usually `process.cwd()`).
 * @returns The publishable packages whose `package.json` is in the changed set.
 */
export function getReleasingPackages(
	publishablePackages: ReadonlyArray<PublishablePackage>,
	changedFiles: string,
	repoRoot: string,
): PublishablePackage[] {
	const changedPaths = new Set(
		changedFiles
			.split("\n")
			// Strip the leading porcelain status code (e.g. " M ", "M  ", "?? ").
			.map((line) => line.replace(/^\s*\S+\s+/, "").trim())
			.filter((path) => path.length > 0),
	);
	return publishablePackages.filter((pkg) => {
		const rel = relative(repoRoot, pkg.path).split(sep).join("/");
		const pkgJson = rel === "" ? "package.json" : `${rel}/package.json`;
		return changedPaths.has(pkgJson);
	});
}

/**
 * Default character cap for a listed `release: name@version, …` PR title before
 * it collapses to `release: <count> packages`. Sized to stay within the
 * conventional-commit header length while still showing a couple of packages.
 */
export const RELEASE_TITLE_MAX_LENGTH = 100;

/** The npm scope of a package name (`@scope/pkg` → `@scope`), or null when unscoped. */
function packageScope(name: string): string | null {
	return name.startsWith("@") && name.includes("/") ? name.slice(0, name.indexOf("/")) : null;
}

/** The single npm scope shared by every name, or null when they are not all under one scope. */
function commonScope(names: ReadonlyArray<string>): string | null {
	const first = names.length > 0 ? packageScope(names[0]) : null;
	if (first === null) {
		return null;
	}
	return names.every((name) => packageScope(name) === first) ? first : null;
}

/** Drop a leading `<scope>/` from a name when present. */
function stripScope(name: string, scope: string | null): string {
	return scope !== null && name.startsWith(`${scope}/`) ? name.slice(scope.length + 1) : name;
}

/**
 * Decide the changeset release PR title from the packages that will release.
 *
 * @remarks
 * The format is chosen by the repository's versioning *topology* — whether
 * packages release on independent versions — not merely by how many release
 * this run:
 *
 * - `perPackageVersioning === false` (only one package can release, or several
 *   that are fixed to one shared version) → `release: <version>`, mirroring the
 *   commit title.
 * - `perPackageVersioning === true` (multiple packages can release on
 *   independent versions) → name the releasing packages as
 *   `release: name@version, …`, even when only one is releasing. When every
 *   *releasable* package shares one npm scope, the scope is omitted for
 *   brevity (`release: pkg-1@1.0.0, pkg-2@2.0.0`); a mixed-scope repo keeps
 *   full names to avoid ambiguity. The list collapses to
 *   `release: <count> packages` once it exceeds `maxLength` (a single package
 *   is always named rather than collapsed).
 * - Nothing releasing, but a single-package repo → `release: <root version>`
 *   (covers private repos with nothing publishable).
 * - Nothing releasing and not single-package → the configured prefix.
 *
 * `perPackageVersioning` is the same signal as `isMonorepoForTagging`, so the
 * PR title and the git tag strategy stay aligned.
 *
 * @param input - The decision inputs.
 * @param input.releasingPackages - The packages that will release (see {@link getReleasingPackages}).
 * @param input.perPackageVersioning - True when multiple packages can release on independent versions (see `isMonorepoForTagging`).
 * @param input.releasablePackages - The full set that can release, used to decide scope omission (defaults to `releasingPackages`).
 * @param input.singlePackageRepoVersion - The repo-root version, supplied only when the repo is single-package.
 * @param input.prTitlePrefix - The configured fallback prefix (e.g. `chore: release`).
 * @param input.maxLength - Title length cap before collapsing to a count (default {@link RELEASE_TITLE_MAX_LENGTH}).
 * @returns The resolved PR title.
 */
export function resolveReleasePrTitle(input: {
	readonly releasingPackages: ReadonlyArray<{ readonly name: string; readonly version: string }>;
	readonly perPackageVersioning: boolean;
	readonly releasablePackages?: ReadonlyArray<{ readonly name: string }>;
	readonly singlePackageRepoVersion?: string | undefined;
	readonly prTitlePrefix: string;
	readonly maxLength?: number;
}): string {
	const { releasingPackages, perPackageVersioning, singlePackageRepoVersion, prTitlePrefix } = input;
	const maxLength = input.maxLength ?? RELEASE_TITLE_MAX_LENGTH;

	// Single-tag repo: one package can release, or all are fixed to one shared
	// version. Use a single semver, mirroring the commit title.
	if (!perPackageVersioning) {
		const version = releasingPackages[0]?.version ?? singlePackageRepoVersion;
		return version !== undefined && version !== "" ? `release: ${version}` : prTitlePrefix;
	}

	// Independent multi-package repo: name the releasing packages explicitly,
	// even when only one is releasing this run. Omit the npm scope when every
	// releasable package shares it, for shorter, readable titles.
	if (releasingPackages.length === 0) {
		return prTitlePrefix;
	}
	const scope = commonScope((input.releasablePackages ?? releasingPackages).map((pkg) => pkg.name));
	const listed = `release: ${releasingPackages.map((pkg) => `${stripScope(pkg.name, scope)}@${pkg.version}`).join(", ")}`;
	return releasingPackages.length > 1 && listed.length > maxLength
		? `release: ${releasingPackages.length} packages`
		: listed;
}

/**
 * Render the release commit body — a bullet list of the releasing packages with
 * their full (scoped) names, one per line.
 *
 * @remarks
 * Unlike the PR title (which may omit a shared scope for brevity), the commit
 * body always uses full names so the commit is an unambiguous record of exactly
 * what released.
 *
 * @param releasingPackages - The packages that will release (see {@link getReleasingPackages}).
 * @returns A `- name@version` list joined by newlines, or an empty string when none.
 */
export function formatReleasePackageList(
	releasingPackages: ReadonlyArray<{ readonly name: string; readonly version: string }>,
): string {
	return releasingPackages.map((pkg) => `- ${pkg.name}@${pkg.version}`).join("\n");
}
