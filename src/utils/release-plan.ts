// The release plan, projected into what Phase 1 reports.
//
// Extracted from `main.ts` so it can be tested: this mapping is where the
// action decides which packages a release covers and how many changesets asked
// for it, and both halves have been wrong in production. It is a pure function
// of `ReleasePlanner.preview`'s result and nothing else.

/**
 * The shape this projection reads from `ReleasePlanner.plan`.
 *
 * @remarks
 * `plan`, not `preview`. Both describe the same release, but `preview` also
 * renders each package's changelog entry, which means resolving the configured
 * changelog module from `node_modules` — and **Phase 1 is the zero-install
 * phase**, so there is nothing to resolve it from. `apply` sidesteps this with
 * a `changelogModules` option that maps ids to bundled paths; `preview` has no
 * such option, so it dies inside module resolution. `plan` renders nothing and
 * needs nothing.
 */
export interface PlanLike {
	/** One entry per package the release will version. */
	readonly releases: ReadonlyArray<{
		readonly name: string;
		/** `"none"` is a package the plan touched without bumping — see the remarks. */
		readonly type: "major" | "minor" | "patch" | "none";
		readonly oldVersion: string;
		readonly newVersion: string;
		/** The changeset files naming this package; empty for a dependency-driven release. */
		readonly changesets: ReadonlyArray<string>;
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
 * @param plan - The result of `ReleasePlanner.plan`.
 * @returns The packages this release covers, and the changeset file count.
 *
 * @public
 */
export const toReleasePlanReport = (plan: PlanLike): ReleasePlanReport => ({
	// A `"none"` release is dropped, not reported as a bump.
	//
	// The plan can carry a package it considered and decided not to version —
	// most often one whose only dependency change was itself a `none`. Reporting
	// it would put a package in "what will be released" that gets no new version
	// and no changelog entry, and there is no honest bump level to show for it.
	packages: plan.releases
		.filter(
			(release): release is typeof release & { readonly type: "major" | "minor" | "patch" } => release.type !== "none",
		)
		.map((release) => ({
			name: release.name,
			bumpType: release.type,
			changesetCount: release.changesets.length,
			oldVersion: release.oldVersion,
			newVersion: release.newVersion,
		})),
	changesetFileCount: plan.changesets.length,
});
