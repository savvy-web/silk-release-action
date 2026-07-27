// Pack a bundler `meta/` folder into a gzip tarball release asset.
import { basename, dirname } from "node:path";
import type { CommandFailedError, CommandOutputError } from "@effected/commands";
import { Run } from "@effected/commands";
import { Effect } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import { ChildProcess } from "effect/unstable/process";

/**
 * Create `<outPath>` as a gzip tarball whose single top-level entry is the
 * `meta/` folder. Uses `tar -C <parent> <metaBasename>` so the archive root is
 * the folder name, not the absolute path.
 *
 * @remarks
 * `Run.text`, not `Run.collect`: `tar` producing the asset is a precondition for
 * uploading it, so a non-zero exit must be a typed failure rather than a value
 * the caller has to remember to inspect. The predecessor's `execCapture` had
 * the same semantics, and its captured stdout was discarded — `tar -czf` writes
 * to the file, not to the terminal.
 *
 * @param metaDir - Absolute path to the group's `meta/` folder.
 * @param outPath - Absolute path to write the `.meta.tgz` to.
 */
export const tarMetaFolder = (
	metaDir: string,
	outPath: string,
): Effect.Effect<void, CommandFailedError | CommandOutputError, ChildProcessSpawner.ChildProcessSpawner> =>
	Effect.asVoid(Run.text(ChildProcess.make("tar", ["-czf", outPath, "-C", dirname(metaDir), basename(metaDir)])));
