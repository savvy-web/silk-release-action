// Turn `git status --porcelain -z` into the file changes a Git Data API commit
// carries.
//
// This lived twice — once in `create-release-branch.ts`, once in
// `update-release-branch.ts` — byte for byte, and both copies carried the same
// two defects. One copy exists now so a fix lands in both paths.

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
 * Parse `-z` porcelain output into {@link FileChange}s.
 *
 * @remarks
 * **The `-z` rename shape is not the human one.** Without `-z`, git renders a
 * rename inline as `R  old -> new`, and the predecessor split on `" -> "` to
 * recover the new path. Under `-z` there is no arrow: git emits the new path in
 * the entry and the **original path as its own following NUL-terminated field**.
 *
 * So the split never fired, and the trailing original path arrived on the next
 * iteration looking like an ordinary entry whose status letters were really the
 * first two characters of a path. It was then read from disk — where it no
 * longer exists, because it was renamed — and, thanks to the second defect
 * below, committed as an empty file. A rename could therefore add a
 * zero-length copy of its own source path to the release commit.
 *
 * The original-path field is consumed here rather than parsed, because nothing
 * downstream needs it: the deletion of the source is already implied by the
 * tree the commit builds.
 *
 * **A failed read is a failure, not empty content.** The predecessor caught
 * every `readFileString` error into `""`. A transient read failure therefore
 * did not stop the release — it committed the file **truncated to zero bytes**,
 * and reported success. That is the same shape as the `git status` failure that
 * once closed a live release PR and deleted its branch: an error swallowed into
 * a plausible-looking empty value. Read errors now propagate.
 *
 * @returns The changes to commit, in the order git reported them.
 *
 * @public
 */
export const collectPorcelainChanges = (
	stdout: string,
): Effect.Effect<FileChange[], FileReadError, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const fields = stdout.split("\0");
		const changes: FileChange[] = [];

		for (let i = 0; i < fields.length; i++) {
			const entry = fields[i];
			if (entry.length === 0) continue;

			const statusCode = entry.substring(0, 2).trim();
			const filePath = entry.substring(3);

			// A rename or copy in the index is followed by its original path as a
			// separate field. Consume it so it is not read as an entry of its own.
			if (entry[0] === "R" || entry[0] === "C") i += 1;

			if (filePath === "") continue;

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
