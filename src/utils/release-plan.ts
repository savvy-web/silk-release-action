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
	readonly releases: ReadonlyArray<BumpedRelease | NoneRelease>;
	/** One entry per `.changeset/*.md` file. */
	readonly changesets: ReadonlyArray<{ readonly id: string }>;
}

/** A package the plan will actually version. */
export interface BumpedRelease {
	readonly name: string;
	readonly type: "major" | "minor" | "patch";
	readonly oldVersion: string;
	readonly newVersion: string;
	/** The changeset files naming this package; empty for a dependency-driven release. */
	readonly changesets: ReadonlyArray<string>;
}

/**
 * A package the plan touched without bumping — see {@link toReleasePlanReport}'s remarks.
 *
 * @remarks
 * Versions are optional on this arm and only on this arm: a package considered
 * and not versioned has no old or new version to report, which is why the plan
 * cannot be modelled as one flat shape.
 */
export interface NoneRelease {
	readonly name: string;
	readonly type: "none";
	readonly oldVersion: string | undefined;
	readonly newVersion: string | undefined;
	readonly changesets: ReadonlyArray<string>;
}

/** One package in the reported plan. */
export interface PlannedPackage {
	readonly name: string;
	readonly bumpType: "major" | "minor" | "patch";
	/** Zero when the package releases only because a dependency did. */
	readonly changesetCount: number;
	readonly oldVersion: string;
	readonly newVersion: string;
	/**
	 * Publish targets this package will publish to, resolved WITHOUT a build.
	 *
	 * @remarks
	 * Zero means the package is `github-only` — versioned, tagged and released
	 * on GitHub, publishing to no registry. Resolvable in Phase 1 because
	 * publishability is declared in `package.json` (`publishConfig`), not
	 * discovered by building: only *readiness* needs the build, which is why
	 * Phase 2 replaces this count with an `n/m ready` figure.
	 *
	 * The one thing a pre-build count cannot apply is the built-`package.json`
	 * private filter, which drops a target whose build output is marked
	 * private. Such a target is counted here and dropped in Phases 2 and 3, so
	 * this is the DECLARED target count, and it is an upper bound.
	 */
	readonly targetCount: number;
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
 * @param targetCounts - Publish-target count per package name, resolved
 *   without a build (see {@link PlannedPackage.targetCount}). A package absent
 *   from the map is `github-only` — it publishes nowhere — which is the
 *   correct reading for a private tracking package.
 * @returns The packages this release covers, and the changeset file count.
 *
 * @public
 */
export const toReleasePlanReport = (
	plan: PlanLike,
	targetCounts: ReadonlyMap<string, number> = new Map(),
): ReleasePlanReport => ({
	// A `"none"` release is dropped, not reported as a bump.
	//
	// The plan can carry a package it considered and decided not to version —
	// most often one whose only dependency change was itself a `none`. Reporting
	// it would put a package in "what will be released" that gets no new version
	// and no changelog entry, and there is no honest bump level to show for it.
	packages: plan.releases
		.filter((release): release is BumpedRelease => release.type !== "none")
		.map((release) => ({
			name: release.name,
			bumpType: release.type,
			changesetCount: release.changesets.length,
			oldVersion: release.oldVersion,
			newVersion: release.newVersion,
			targetCount: targetCounts.get(release.name) ?? 0,
		})),
	changesetFileCount: plan.changesets.length,
});
