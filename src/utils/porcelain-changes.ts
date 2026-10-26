// Turn a `git status --porcelain -z` listing into the file changes a Git Data
// API commit carries.
//
// This lived twice — once in `create-release-branch.ts`, once in
// `update-release-branch.ts` — byte for byte, and both copies carried the same
// two defects. One copy exists now so a fix lands in both paths.

import type { StatusEntry } from "@effected/git";
import type { FileChange } from "@effected/github";
import { FileContent, FileDeletion } from "@effected/github";
import { Effect, FileSystem } from "effect";

/**
 * Whatever `readFileString` fails with, derived rather than named.
 *
 * @remarks
 * The concrete error type lives in core's `FileSystem`, and spelling it by hand
 * invites drift. This follows the member.
 */
export type FileReadError = Effect.Error<ReturnType<FileSystem.FileSystem["readFileString"]>>;

/** Status letters that mean the entry is gone from the tree. */
const DELETION_CODES = new Set(["D", "DD", "AD"]);

/**
 * Convert porcelain entries into {@link FileChange}s.
 *
 * @remarks
 * **The hand-rolled `-z` parse is gone.** This used to take raw stdout and
 * split it on NUL itself, and the rename case was a documented defect: without
 * `-z`, git renders a rename inline as `R  old -> new`, and the predecessor
 * split on `" -> "` to recover the new path. Under `-z` there is no arrow — git
 * emits the new path in the entry and the **original path as its own following
 * NUL-terminated field** — so the split never fired, the trailing original path
 * arrived on the next iteration looking like an ordinary entry, was read from
 * disk where it no longer exists, and was committed as a zero-length file.
 *
 * `Git.status` now does that parsing, exposing the original path as
 * {@link StatusEntry.origPath}. It is ignored here rather than parsed, because
 * nothing downstream needs it: the deletion of the source is already implied by
 * the tree the commit builds.
 *
 * **A failed read is a failure, not empty content.** The predecessor caught
 * every `readFileString` error into `""`. A transient read failure therefore
 * did not stop the release — it committed the file **truncated to zero bytes**,
 * and reported success. That is the same shape as the `git status` failure that
 * once closed a live release PR and deleted its branch: an error swallowed into
 * a plausible-looking empty value. Read errors now propagate.
 *
 * @param entries - The listing `Git.status` returned.
 * @returns The changes to commit, in the order git reported them.
 *
 * @public
 */
export const collectPorcelainChanges = (
	entries: ReadonlyArray<StatusEntry>,
): Effect.Effect<FileChange[], FileReadError, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const changes: FileChange[] = [];

		for (const entry of entries) {
			const filePath = entry.path;
			if (filePath === "") continue;

			// The two status columns, read as one code the way git's own porcelain
			// documentation reads them (" D" and "D " both mean deleted, "DD" and
			// "AD" are unmerged-with-deletion states).
			const statusCode = `${entry.x}${entry.y}`.trim();
			if (DELETION_CODES.has(statusCode)) {
				changes.push(FileDeletion.make({ path: filePath }));
				continue;
			}

			// No `catch` here — see the remarks. A read that fails must fail the
			// release rather than commit an empty file.
			const content = yield* fs.readFileString(filePath);
			const statResult = yield* Effect.result(fs.stat(filePath));
			const isExecutable = statResult._tag === "Success" && (Number(statResult.success.mode ?? 0n) & 0o111) !== 0;
			changes.push(FileContent.make({ path: filePath, mode: isExecutable ? "100755" : "100644", content }));
		}

		return changes;
	});
