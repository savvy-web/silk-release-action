import { relative, sep } from "node:path";
import type { PublishablePackage } from "@savvy-web/silk-effects";
import { SilkPublishability } from "@savvy-web/silk-effects";
import type { Effect } from "effect";
import type { PublishabilityDetector, WorkspaceDiscovery } from "workspaces-effect";

export type { PublishablePackage };

/**
 * The publishable, non-ignored packages, resolved through the single
 * `PublishabilityDetector` (which already honors changeset ignore). Delegates to
 * the shared `@savvy-web/silk-effects` implementation.
 */
export const listPublishablePackages = (
	workspaceRoot: string,
): Effect.Effect<ReadonlyArray<PublishablePackage>, never, WorkspaceDiscovery | PublishabilityDetector> =>
	SilkPublishability.listPublishable(workspaceRoot);

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
 * @param publishablePackages - The publishable workspaces (see {@link listPublishablePackages}).
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
