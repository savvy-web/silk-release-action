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
 * - `github-with-packages` — the workspace resolved at least one publish target, so merging
 *   the release PR uploads a tarball somewhere.
 * - `github-only` — the workspace resolved no publish targets. It is
 *   versioned, changelogged, tagged and given a GitHub release, and nothing is
 *   uploaded to any registry. This is the intended steady state for a private
 *   tracking package, **not** a degraded one.
 *
 * @public
 */
export type ReleaseKind = "github-with-packages" | "github-only";

/**
 * Classify a package by how many publish targets it resolved.
 *
 * @param targetCount - Number of resolved publish targets for the package.
 * @returns The release kind.
 *
 * @public
 */
export const releaseKindOf = (targetCount: number): ReleaseKind =>
	targetCount > 0 ? "github-with-packages" : "github-only";

/**
 * The short human label for a release kind.
 *
 * @param kind - The release kind.
 * @returns A label suitable for a table cell or a log line.
 *
 * @public
 */
export const releaseKindLabel = (kind: ReleaseKind): string =>
	kind === "github-with-packages" ? "Registry publish" : "GitHub release only";

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
export const releaseKindIcon = (kind: ReleaseKind): string =>
	kind === "github-with-packages" ? "\u{1F4E6}" : "\u{1F3F7}️";

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
		if (releaseKindOf(count) === "github-with-packages") registry++;
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
	/** Workspaces versioned this wave. */
	readonly workspaces: number;
	/** Package publications successfully uploaded to a registry. */
	readonly packagesPublished: number;
	/** GitHub releases created. */
	readonly releases: number;
}): string =>
	`${args.workspaces} workspace(s) versioned · ` +
	`${args.packagesPublished} package(s) published to a registry · ` +
	`${args.releases} GitHub release(s) created`;

/**
 * The one-line account of what happened to a single workspace.
 *
 * @remarks
 * Derived from the workspace's own structured fields and never authored
 * independently, so the prose on the wire cannot drift from the enums beside
 * it. That is the whole contract: a reader (or an LLM) can trust `summary`
 * precisely because nothing can set it to something the data does not say.
 *
 * @param args - The workspace's kind, outcome and counts.
 * @returns One sentence.
 *
 * @public
 */
export const summarizeWorkspace = (args: {
	readonly kind: ReleaseKind;
	readonly outcome: "released" | "published" | "recovered" | "partial" | "failed" | "blocked";
	readonly packages: number;
	readonly released: boolean;
}): string => {
	switch (args.outcome) {
		case "released":
			return "Tagged and released on GitHub; no registry target.";
		case "published":
			return `Tagged and released on GitHub; published ${args.packages} package(s) to a registry.`;
		case "recovered":
			return `Already on every registry at an identical digest; ${args.packages} package(s) recovered, nothing re-uploaded.`;
		case "partial":
			return `Published some packages and failed others across ${args.packages} target(s).`;
		case "failed":
			return args.kind === "github-only"
				? "Tag or GitHub release could not be created."
				: `Failed to publish ${args.packages} package(s).`;
		case "blocked":
			return "Never attempted — the publish phase aborted before this workspace was reached.";
	}
};
