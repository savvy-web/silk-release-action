/**
 * Phase 1 guard: a changeset the apply consumed must be gone from
 * `.changeset/` before the release commit is built (issue #558).
 *
 * @remarks
 * A changeset that names a package the apply just released, and is still at
 * `.changeset/<id>.md` afterwards, is planned again on the next run — the
 * package is released a second time from the same changeset, and nothing
 * fails. That shipped once (spencerbeggs/effected#1297: 45 changesets
 * consumed, 44 deleted). The engine has two quiet paths to it: a delete that
 * did not land, and its rule that a changeset naming any skipped package
 * (ignored, unversioned private, version-less or undiscovered) is kept on
 * disk while its other packages still release.
 *
 * The check is deliberately independent of the engine's own bookkeeping: it
 * reads what is on disk after the apply rather than trusting the engine's
 * `touchedFiles`. A pre-release moves consumed changesets to `.changeset/pre/`,
 * so entries under `pre/` are never leftovers.
 *
 * Failure posture: **fails the phase.** A leftover fails with
 * {@link ConsumedChangesetError} `reason: "leftover"`; a `.changeset/` that
 * cannot be listed fails with `reason: "unreadable"` rather than passing,
 * because a guard that disables itself on error is a run that is green for a
 * check that never ran. A single file that will not parse is logged and
 * skipped: the apply itself parsed every changeset it consumed.
 */

import { PendingChangesets } from "@effected/changesets";
import type { FileSystem, Path } from "effect";
import { Data, Effect } from "effect";

/**
 * A consumed changeset survived the apply, or `.changeset/` could not be read
 * to check.
 *
 * @public
 */
export class ConsumedChangesetError extends Data.TaggedError("ConsumedChangesetError")<{
	readonly reason: "leftover" | "unreadable";
	/** The leftover files, relative to `.changeset/`; empty for `unreadable`. */
	readonly files: ReadonlyArray<string>;
	readonly message: string;
	readonly cause?: unknown;
}> {}

/**
 * A pending changeset, reduced to what the guard reads.
 *
 * @public
 */
export interface ChangesetOnDisk {
	/** The file name relative to `.changeset/`, `pre/<name>.md` under a pre-release. */
	readonly file: string;
	/** Package name to requested bump. */
	readonly releases: ReadonlyMap<string, string>;
}

/**
 * The changesets still on disk that name a package the apply released.
 *
 * @param onDisk - The changesets present after the apply.
 * @param released - The names of the packages the apply released.
 * @returns The leftover files, relative to `.changeset/`, in the order given.
 *
 * @public
 */
export const leftoverConsumedChangesets = (
	onDisk: ReadonlyArray<ChangesetOnDisk>,
	released: ReadonlyArray<string>,
): string[] => {
	const releasedNames = new Set(released);
	return onDisk
		.filter(
			(changeset) =>
				!changeset.file.startsWith("pre/") &&
				[...changeset.releases].some(([name, type]) => type !== "none" && releasedNames.has(name)),
		)
		.map((changeset) => changeset.file);
};

/**
 * Fail when a changeset the apply consumed is still in `.changeset/`.
 *
 * @param root - The workspace root the apply ran in.
 * @param released - The names of the packages the apply released.
 *
 * @public
 */
export const verifyConsumedChangesetsRemoved = (
	root: string,
	released: ReadonlyArray<string>,
): Effect.Effect<void, ConsumedChangesetError, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		if (released.length === 0) return;
		const settled = yield* PendingChangesets.readSettled(root).pipe(
			Effect.mapError(
				(cause) =>
					new ConsumedChangesetError({
						reason: "unreadable",
						files: [],
						message: `could not list .changeset/ to check the apply removed its changesets: ${cause.message}`,
						cause,
					}),
			),
		);
		for (const failure of settled.failures) {
			yield* Effect.logWarning(
				`[changesets] .changeset/${failure.file} could not be read to check it was consumed: ${failure.error.message}`,
			);
		}
		const leftover = leftoverConsumedChangesets(settled.changesets, released);
		if (leftover.length === 0) return;
		return yield* new ConsumedChangesetError({
			reason: "leftover",
			files: leftover,
			message:
				`the apply released packages these changesets name but left them in .changeset/: ` +
				`${leftover.join(", ")} — committing them would release the same changes again on the next run`,
		});
	});
