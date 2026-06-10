/**
 * Pack a bundler `meta/` folder into a gzip tarball release asset.
 *
 * @module release/meta-archive
 */
import { basename, dirname } from "node:path";
import type { CommandRunnerError } from "@savvy-web/github-action-effects";
import { CommandRunner } from "@savvy-web/github-action-effects";
import { Effect } from "effect";

/**
 * Create `<outPath>` as a gzip tarball whose single top-level entry is the
 * `meta/` folder. Uses `tar -C <parent> <metaBasename>` so the archive root is
 * the folder name, not the absolute path.
 *
 * @param metaDir - Absolute path to the group's `meta/` folder.
 * @param outPath - Absolute path to write the `.meta.tgz` to.
 */
export const tarMetaFolder = (
	metaDir: string,
	outPath: string,
): Effect.Effect<void, CommandRunnerError, CommandRunner> =>
	Effect.gen(function* () {
		const runner = yield* CommandRunner;
		yield* runner.execCapture("tar", ["-czf", outPath, "-C", dirname(metaDir), basename(metaDir)]);
	});
