// The "what will be released" table, shared by the phase that plans a release
// and the phase that validates it.
//
// Phase 1 knows every column except `targets` — the release plan carries the
// version transition, the bump and how many changesets named each package. Only
// publish-readiness has to wait for Phase 2, so the table is rendered once with
// that column pending and re-rendered when validation fills it in, rather than
// withheld until everything is known.

import { GitHubMarkdown } from "@effected/github-actions";
import { Schema } from "effect";
import { releaseKindCell, releaseKindIcon } from "./release-kind.js";

/**
 * One row of the release table.
 *
 * @remarks
 * The **display** shape, not the domain shape. `versions` is a single column
 * because a reader compares `1.2.2 → 1.2.3` as one fact, and a schema table is
 * one column per field.
 *
 * @public
 */
export const ReleaseRow = Schema.Struct({
	status: Schema.String.annotate({ title: "" }),
	name: Schema.String.annotate({ title: "Package" }),
	versions: Schema.String.annotate({ title: "Current → Next" }),
	bump: Schema.Literals(["major", "minor", "patch"]).annotate({ title: "Bump" }),
	changesetCount: Schema.Number.annotate({ title: "Changesets" }),
	targets: Schema.String.annotate({ title: "Targets" }),
});

/**
 * One row of the release table.
 *
 * @public
 */
export type ReleaseRow = typeof ReleaseRow.Type;

/** Bump severity, most disruptive first. */
const BUMP_ICON = { major: "🔴", minor: "🟡", patch: "🟢" } as const;

/**
 * The release table renderer.
 *
 * @remarks
 * `changesetCount` **requires** a `format` and the type enforces it: its
 * encoded side is a number, so there is no string projection to borrow. That
 * obligation is welcome here — the column does not render the number verbatim.
 * **Zero means "no changeset named this package; it releases because a
 * dependency did"**, which reads as an em dash rather than a `0`, because `0`
 * invites the reading "this release is empty".
 *
 * @public
 */
export const releaseTable = GitHubMarkdown.tableFor(ReleaseRow, {
	columns: {
		changesetCount: { format: (count) => (count === 0 ? "—" : String(count)) },
		bump: { format: (bump) => `${BUMP_ICON[bump]} ${bump}` },
	},
});

/**
 * The legend for the icons the table uses.
 *
 * @public
 */
export const RELEASE_TABLE_LEGEND =
	"Legend: ✅ Ready · ⏳ Pending · 🏷️ GitHub release only · ⏭️ Skipped · ⚠️ Warning · ❌ Failed · " +
	"🔴 major · 🟡 minor · 🟢 patch";

/**
 * The release plan as table rows, with publish-readiness left pending.
 *
 * @remarks
 * Phase 1's projection. The `targets` column carries the RESOLVED target shape,
 * not a placeholder: publishability is declared in `package.json`, so what a
 * package publishes to is knowable before anything is built. Only how many
 * targets are READY needs the build, which is what Phase 2 replaces this cell
 * with. Rendering both facts as `pending` hid a decided one behind an undecided
 * one, and made a package that publishes nowhere indistinguishable from one
 * nobody had looked at yet.
 *
 * No icon on a count: the status column already carries the hourglass
 * for the row, and repeating it here both duplicated the signal and widened the
 * column enough to unsettle the table's layout.
 *
 * @param packages - The release plan, as Phase 1 reports it.
 * @returns Rows ready for {@link releaseTable}.
 *
 * @public
 */
export const toPendingReleaseRows = (
	packages: ReadonlyArray<{
		readonly name: string;
		readonly bumpType: "major" | "minor" | "patch";
		readonly changesetCount: number;
		readonly oldVersion: string;
		readonly newVersion: string;
		readonly targetCount: number;
	}>,
): ReadonlyArray<ReleaseRow> =>
	packages.map((pkg) => ({
		status: "⏳",
		name: pkg.name,
		versions: `${pkg.oldVersion} → ${pkg.newVersion}`,
		bump: pkg.bumpType,
		changesetCount: pkg.changesetCount,
		// Phase 1 knows WHAT will be published without building anything —
		// publishability is declared in `package.json`, not discovered by
		// compiling. Only READINESS needs the build, so this column carries the
		// resolved shape now and Phase 2 replaces it with `n/m ready`. It read
		// `pending` for both facts before, which hid a decided one behind an
		// undecided one.
		targets: pkg.targetCount === 0 ? releaseKindCell("github-only") : `${pkg.targetCount} target(s)`,
	}));

/**
 * One validated package, as much of it as the table renders.
 *
 * @remarks
 * Exported because it is the parameter type of {@link toValidatedReleaseRows} —
 * a consumer of that function could not otherwise name the shape it must build.
 *
 * @public
 */
export interface ValidatedPackage {
	readonly name: string;
	readonly version: string;
	readonly baseVersion: string | null;
	readonly changesetCount: number | null;
	readonly builds: ReadonlyArray<{
		readonly targets: ReadonlyArray<{ readonly status: "ready" | "skipped" | "failed" }>;
	}>;
}

/**
 * Fill in the column Phase 1 had to leave pending.
 *
 * @remarks
 * A package with **no builds** is `github-release` kind — it is versioned,
 * changelogged, tagged and given a GitHub release, and publishes to no
 * registry — which is `🏷️ GitHub release only`, not a failure and not a
 * zero-of-zero ready. Reporting `0/0 ready` would read as a problem where
 * there is none, and the previous `⏭️ no targets` read as a skip.
 *
 * A **skipped** target counts as neither ready nor failed. It is most often
 * "already published, identical", which is a success for the release even
 * though nothing was uploaded, so folding it into either bucket would mislead.
 *
 * `baseVersion` is `null` for a package that does not yet exist on the target
 * branch. That renders as `new → <version>` rather than `null → <version>`.
 *
 * @param packages - The validated packages, build-centric.
 * @returns Rows ready for {@link releaseTable}.
 *
 * @public
 */
export const toValidatedReleaseRows = (packages: ReadonlyArray<ValidatedPackage>): ReadonlyArray<ReleaseRow> =>
	packages.map((pkg) => {
		const targets = pkg.builds.flatMap((build) => build.targets);
		const ready = targets.filter((t) => t.status === "ready").length;
		const failed = targets.filter((t) => t.status === "failed").length;

		// `🏷️ GitHub release only`, not `⏭️ no targets`. The old cell described
		// the mechanism ("no targets") in the vocabulary of a skip, and `⏭️` in
		// the status column reinforced it — so a private tracking package, whose
		// entire release is a tag and a GitHub release BY DESIGN, read as a
		// package that had been passed over. Nothing is skipped here.
		const targetsCell =
			targets.length === 0
				? releaseKindCell("github-only")
				: failed > 0
					? `❌ ${failed}/${targets.length} failed`
					: `✅ ${ready}/${targets.length} ready`;

		return {
			status: failed > 0 ? "❌" : targets.length === 0 ? releaseKindIcon("github-only") : "✅",
			name: pkg.name,
			versions: `${pkg.baseVersion ?? "new"} → ${pkg.version}`,
			// The bump is derived from the versions rather than carried: by Phase 2
			// the changeset files are gone, so the plan that declared it no longer
			// exists to be read.
			bump: deriveBump(pkg.baseVersion, pkg.version),
			changesetCount: pkg.changesetCount ?? 0,
			targets: targetsCell,
		};
	});

/**
 * The bump implied by a version transition.
 *
 * @remarks
 * Phase 2 has no changeset files to read — `apply` consumed them — so the bump
 * is recovered from the two versions. A new package or an unparseable version
 * reports `patch`: the column describes severity, and overstating it would be
 * worse than understating it.
 */
/**
 * The numeric `major.minor.patch` core of a SemVer string, as numbers.
 *
 * @remarks
 * Splitting the raw string on `.` breaks on any prerelease or build suffix:
 * `"2.0.0-rc.1"` yields `["2", "0", "0-rc", "1"]`, whose third element is
 * `NaN`, which sent {@link deriveBump}'s guard down the `patch` path and
 * rendered a major transition as `🟢 patch`. Trimming at the first `-` or `+`
 * first keeps the severity honest for prereleases.
 */
const semverCore = (version: string): ReadonlyArray<number> => {
	const core = version.split("-")[0]?.split("+")[0] ?? "";
	return core.split(".").map(Number);
};

const deriveBump = (baseVersion: string | null, version: string): "major" | "minor" | "patch" => {
	if (baseVersion === null) return "patch";
	const before = semverCore(baseVersion);
	const after = semverCore(version);
	if (before.length < 3 || after.length < 3 || [...before, ...after].some(Number.isNaN)) return "patch";
	if ((after[0] ?? 0) > (before[0] ?? 0)) return "major";
	if (after[0] === before[0] && (after[1] ?? 0) > (before[1] ?? 0)) return "minor";
	return "patch";
};
