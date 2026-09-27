/**
 * Pure rules of the snapshot phase: where it may run, and how its versions
 * are spelled.
 *
 * @module utils/snapshot
 */

import type { BranchRefs } from "../schema/inputs.js";

/**
 * The changesets prerelease template for a snapshot, combined with
 * `useCalculatedVersion: true`, so the next release number stays in front:
 * `0.12.0-next-20260927051500`, not changesets' `0.0.0-…` default.
 *
 * @public
 */
export const SNAPSHOT_PRERELEASE_TEMPLATE = "{tag}-{datetime}" as const;

/**
 * The ref guard's answer.
 *
 * @public
 */
export type SnapshotRefCheck =
	| { readonly ok: true; readonly branch: string }
	| { readonly ok: false; readonly reason: string };

const HEADS = "refs/heads/";

/**
 * Decide whether a snapshot may run from `ref`.
 *
 * @remarks
 * Reads the FULL ref (`GITHUB_REF`), never the short name. A dispatch can
 * target a tag, and a tag named `main` may point at a main commit, so a
 * short-name check would pass it. Only `refs/heads/*` is accepted, and never
 * the target or release branch: a snapshot is for unmerged work, and the
 * release branch's versions belong to the release.
 *
 * @param ref - The full git ref, e.g. `refs/heads/feat/x`.
 * @param branches - The decoded release/target branch names.
 * @returns The short branch name, or a refusal reason.
 *
 * @public
 */
export const checkSnapshotRef = (ref: string, branches: BranchRefs): SnapshotRefCheck => {
	if (!ref.startsWith(HEADS) || ref.length === HEADS.length) {
		return {
			ok: false,
			reason: `snapshots publish from a branch; ${ref} is not a branch ref — dispatch the workflow from a feature branch`,
		};
	}
	const branch = ref.slice(HEADS.length);
	if (branch === branches.targetBranch) {
		return {
			ok: false,
			reason: `${branch} is the target branch; snapshots are for unmerged work — dispatch from a feature branch`,
		};
	}
	if (branch === branches.releaseBranch) {
		return {
			ok: false,
			reason: `${branch} is the release branch; its versions belong to the release, not a snapshot`,
		};
	}
	return { ok: true, branch };
};
