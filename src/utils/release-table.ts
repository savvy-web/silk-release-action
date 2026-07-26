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
	"Legend: ✅ Ready · ⏳ Pending · ⏭️ Skipped · ⚠️ Warning · ❌ Failed · 🔴 major · 🟡 minor · 🟢 patch";

/**
 * The release plan as table rows, with publish-readiness left pending.
 *
 * @remarks
 * Phase 1's projection. `targets` is the one column the release plan cannot
 * answer — validation has not run — so it renders as pending rather than as a
 * guess or a blank. A blank would be indistinguishable from "no targets".
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
	}>,
): ReadonlyArray<ReleaseRow> =>
	packages.map((pkg) => ({
		status: "⏳",
		name: pkg.name,
		versions: `${pkg.oldVersion} → ${pkg.newVersion}`,
		bump: pkg.bumpType,
		changesetCount: pkg.changesetCount,
		targets: "⏳ pending validation",
	}));
