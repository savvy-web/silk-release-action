// The release plan, projected into what Phase 1 reports.
//
// Extracted from `main.ts` so it can be tested: this mapping is where the
// action decides which packages a release covers and how many changesets asked
// for it, and both halves have been wrong in production. It is a pure function
// of `ReleasePlanner.preview`'s result and nothing else.

/** The shape this projection reads from `ChangesetPreview`. */
export interface PreviewLike {
	/** One entry per package the release will version. */
	readonly releases: ReadonlyArray<{
		readonly name: string;
		readonly type: "major" | "minor" | "patch";
		readonly oldVersion: string;
		readonly newVersion: string;
		/** The changeset files naming this package; empty for a dependency-driven release. */
		readonly changesetIds: ReadonlyArray<string>;
	}>;
	/** One entry per `.changeset/*.md` file. */
	readonly changesets: ReadonlyArray<{ readonly id: string }>;
}

/** One package in the reported plan. */
export interface PlannedPackage {
	readonly name: string;
	readonly bumpType: "major" | "minor" | "patch";
	/** Zero when the package releases only because a dependency did. */
	readonly changesetCount: number;
	readonly oldVersion: string;
	readonly newVersion: string;
}

/** What Phase 1 reports about the release it is about to cut. */
export interface ReleasePlanReport {
	readonly packages: ReadonlyArray<PlannedPackage>;
	/**
	 * The number of changeset **files**.
	 *
	 * @remarks
	 * Deliberately not `packages.length`. One file may name several packages and
	 * two files may name the same one, so the two numbers diverge in **both**
	 * directions — deriving either from the other misreports whichever is asked
	 * for.
	 */
	readonly changesetFileCount: number;
}

/**
 * Project a release plan into Phase 1's report.
 *
 * @remarks
 * Reads the **plan**, not the changeset files. If a changeset names A and B
 * depends on A, both are versioned and both get changelogs, but only A has a
 * changeset — so B appears here with `changesetCount: 0` rather than being
 * absent. A report built from the files alone could not see B at all.
 *
 * @param preview - The result of `ReleasePlanner.preview`.
 * @returns The packages this release covers, and the changeset file count.
 *
 * @public
 */
export const toReleasePlanReport = (preview: PreviewLike): ReleasePlanReport => ({
	packages: preview.releases.map((release) => ({
		name: release.name,
		bumpType: release.type,
		changesetCount: release.changesetIds.length,
		oldVersion: release.oldVersion,
		newVersion: release.newVersion,
	})),
	changesetFileCount: preview.changesets.length,
});
