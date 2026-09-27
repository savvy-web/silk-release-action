/**
 * Pure rules of the snapshot phase: where it may run, and how its versions
 * are spelled.
 *
 * @module utils/snapshot
 */

import type { PublishPackagesResult, TargetPublishResult } from "../release/types.js";
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

/**
 * A published snapshot package whose manifest pins an internal dependency
 * at a snapshot version that was not published in the same run.
 *
 * @public
 */
export interface DanglingDependency {
	/** The published package that carries the pin. */
	readonly dependent: string;
	/** The dependent's snapshot version. */
	readonly dependentVersion: string;
	/** The bumped internal dependency that was not published. */
	readonly dependency: string;
	/** The dependency's snapshot version: the pin that will not install. */
	readonly version: string;
}

/**
 * Whether a target's version is on its registry after the run.
 *
 * @remarks
 * The same classification `toSnapshotOutput` uses for its `published` list:
 * an upload, or a version already present at an identical digest. A
 * never-published or dry-run skip, a failure, and a reasonless skip are not.
 */
const landed = (t: TargetPublishResult): boolean =>
	t.success &&
	t.skipReason !== "never-published" &&
	t.skipReason !== "dry-run" &&
	!(t.status === "skipped" && t.skipReason === undefined);

/**
 * Find every published snapshot package that depends on a sibling bumped in
 * this snapshot but not published by it.
 *
 * @remarks
 * Changesets bumps the dependents of every bumped package, and the build
 * pins each internal dependency to its exact snapshot version. A dependency
 * that was skipped (never published), failed, or not uploaded therefore
 * leaves its published dependents with a pin no registry can satisfy, and an
 * `overrides:` block naming the dependent fails with `ETARGET`. Pure; a
 * finding, never a verdict — it changes no `success` or `outcome`.
 *
 * @param releases - The applied snapshot bumps.
 * @param runtimeDependencies - Each bumped package's runtime dependency names
 * (production, peer and optional; never dev, which a consumer never installs).
 * @param publishResult - The publish loop's result.
 * @returns One entry per dangling (dependent, dependency) pair, in release order.
 *
 * @public
 */
export const findDanglingDependencies = (
	releases: ReadonlyArray<{ readonly name: string; readonly newVersion: string }>,
	runtimeDependencies: ReadonlyMap<string, ReadonlyArray<string>>,
	publishResult: PublishPackagesResult,
): ReadonlyArray<DanglingDependency> => {
	const bumped = new Map(releases.map((r) => [r.name, r.newVersion]));
	const published = new Set(publishResult.packages.filter((p) => p.targets.some(landed)).map((p) => p.name));
	const dangling: DanglingDependency[] = [];
	for (const release of releases) {
		if (!published.has(release.name)) continue;
		for (const dependency of runtimeDependencies.get(release.name) ?? []) {
			const version = bumped.get(dependency);
			if (version === undefined || published.has(dependency)) continue;
			dangling.push({ dependent: release.name, dependentVersion: release.newVersion, dependency, version });
		}
	}
	return dangling;
};
