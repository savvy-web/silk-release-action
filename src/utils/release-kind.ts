/**
 * How a released package reaches its audience.
 *
 * @remarks
 * A release wave is not homogeneous. Some entries are packages that publish to
 * a JavaScript registry (npm, GitHub Packages, a custom registry); others are
 * **tracking packages** that exist only so changesets has something to version
 * — private by construction, with no `publishConfig`, no build, no tarball —
 * and whose entire release is a git tag plus a GitHub release.
 *
 * Before this module the two were told apart ad hoc, by asking whether some
 * array happened to be empty, and the answer was rendered as `⏭️ no targets` —
 * which reads as "something was skipped" when in fact nothing was meant to
 * happen. Naming the distinction once lets every surface (the Phase-2 comment,
 * the publish-validation check, the Phase-3 log) describe the same wave the
 * same way.
 *
 * @module utils/release-kind
 */

/**
 * Whether a released package publishes to a registry or is release-only.
 *
 * @remarks
 * - `registry` — the package resolved at least one publish target, so merging
 *   the release PR uploads a tarball somewhere.
 * - `github-release` — the package resolved no publish targets. It is
 *   versioned, changelogged, tagged and given a GitHub release, and nothing is
 *   uploaded to any registry. This is the intended steady state for a private
 *   tracking package, **not** a degraded one.
 *
 * @public
 */
export type ReleaseKind = "registry" | "github-release";

/**
 * Classify a package by how many publish targets it resolved.
 *
 * @param targetCount - Number of resolved publish targets for the package.
 * @returns The release kind.
 *
 * @public
 */
export const releaseKindOf = (targetCount: number): ReleaseKind => (targetCount > 0 ? "registry" : "github-release");

/**
 * The short human label for a release kind.
 *
 * @param kind - The release kind.
 * @returns A label suitable for a table cell or a log line.
 *
 * @public
 */
export const releaseKindLabel = (kind: ReleaseKind): string =>
	kind === "registry" ? "Registry publish" : "GitHub release only";

/**
 * The icon for a release kind.
 *
 * @remarks
 * `🏷️` (a tag) rather than `⏭️` (skipped) for the release-only kind: nothing
 * was skipped, and the tag is literally what the package gets.
 *
 * @param kind - The release kind.
 * @returns A single emoji.
 *
 * @public
 */
export const releaseKindIcon = (kind: ReleaseKind): string => (kind === "registry" ? "\u{1F4E6}" : "\u{1F3F7}️");

/**
 * The icon and label together, as one cell.
 *
 * @param kind - The release kind.
 * @returns e.g. `🏷️ GitHub release only`.
 *
 * @public
 */
export const releaseKindCell = (kind: ReleaseKind): string => `${releaseKindIcon(kind)} ${releaseKindLabel(kind)}`;

/**
 * How many packages of each kind a wave contains.
 *
 * @public
 */
export interface ReleaseKindTally {
	/** Packages that resolved at least one publish target. */
	readonly registry: number;
	/** Packages that resolved none — tag and GitHub release only. */
	readonly githubRelease: number;
}

/**
 * Tally a wave's packages by release kind.
 *
 * @param targetCounts - Each package's resolved publish-target count.
 * @returns The per-kind counts.
 *
 * @public
 */
export const tallyReleaseKinds = (targetCounts: Iterable<number>): ReleaseKindTally => {
	let registry = 0;
	let githubRelease = 0;
	for (const count of targetCounts) {
		if (releaseKindOf(count) === "registry") registry++;
		else githubRelease++;
	}
	return { registry, githubRelease };
};

/**
 * The one-line account of what a release wave actually did.
 *
 * @remarks
 * Written so an all-private wave reads as a deliberate outcome rather than an
 * empty one. `✅ Published 0/0 target(s)` is technically true and tells a
 * reader nothing; this names the versioning, the registry uploads and the
 * GitHub releases as three separate facts, so a zero in the middle is
 * obviously the shape of the wave rather than a failure.
 *
 * @param args - The counts to render.
 * @returns One line, e.g.
 *   `2 package(s) versioned · 0 published to a registry · 2 GitHub release(s) created`.
 *
 * @public
 */
export const summarizeReleaseWave = (args: {
	/** Packages that were versioned this wave. */
	readonly versioned: number;
	/** Publish targets successfully uploaded to a registry. */
	readonly publishedTargets: number;
	/** GitHub releases created. */
	readonly githubReleases: number;
}): string =>
	`${args.versioned} package(s) versioned · ` +
	`${args.publishedTargets} published to a registry · ` +
	`${args.githubReleases} GitHub release(s) created`;
