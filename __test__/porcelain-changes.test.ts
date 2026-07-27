/**
 * Tests for `-z` porcelain parsing.
 *
 * @remarks
 * Both behaviours here were defects, duplicated byte for byte across
 * `create-release-branch.ts` and `update-release-branch.ts`, and both are
 * invisible to the typechecker:
 *
 * 1. **A rename's original path is a separate NUL field under `-z`**, not an
 *    inline `old -> new`. The predecessor split on `" -> "`, which never
 *    matched, so the trailing original path was parsed as an entry of its own.
 * 2. **A failed read must fail**, not become `""`. Swallowing it committed the
 *    file truncated to zero bytes and reported success.
 *
 * They compounded: the phantom entry from (1) named a path that no longer
 * existed, so (2) turned it into an empty file added to the release commit.
 */

import type { Layer } from "effect";
import { Effect, FileSystem } from "effect";
import { describe, expect, it } from "vitest";
import { collectPorcelainChanges } from "../src/utils/porcelain-changes.js";

/** A `FileSystem` whose reads answer from a map, and fail for anything absent. */
const fsLayer = (
	files: Record<string, string>,
	executable: ReadonlyArray<string> = [],
): Layer.Layer<FileSystem.FileSystem> =>
	FileSystem.layerNoop({
		readFileString: (path: string) =>
			path in files ? Effect.succeed(files[path]) : Effect.fail(new Error(`ENOENT: ${path}`) as never),
		stat: (path: string) => Effect.succeed({ mode: BigInt(executable.includes(path) ? 0o100755 : 0o100644) } as never),
	});

const run = (stdout: string, files: Record<string, string>, executable?: ReadonlyArray<string>) =>
	Effect.runPromise(collectPorcelainChanges(stdout).pipe(Effect.provide(fsLayer(files, executable))));

describe("collectPorcelainChanges", () => {
	it("reads a modified file's content", async () => {
		const changes = await run("M  package.json\0", { "package.json": "{}" });
		expect(changes).toHaveLength(1);
		expect(changes[0]).toMatchObject({ path: "package.json", content: "{}", mode: "100644" });
	});

	it("records a deletion without reading it", async () => {
		// No entry in the file map — a deletion must not attempt a read.
		const changes = await run("D  gone.txt\0", {});
		expect(changes).toHaveLength(1);
		expect(changes[0]).toMatchObject({ path: "gone.txt" });
		expect(changes[0]).not.toHaveProperty("content");
	});

	it("consumes a rename's original path instead of treating it as an entry", async () => {
		// The production shape: `R  new\0old\0`. `old` no longer exists on disk.
		// The predecessor read it, failed, swallowed the failure to "", and added
		// a zero-length file at the source path to the release commit.
		const changes = await run("R  new-name.ts\0old-name.ts\0", { "new-name.ts": "export {};" });

		expect(changes).toHaveLength(1);
		expect(changes[0]).toMatchObject({ path: "new-name.ts", content: "export {};" });
	});

	it("consumes a copy's original path the same way", async () => {
		const changes = await run("C  copy.ts\0source.ts\0", { "copy.ts": "1" });
		expect(changes.map((c) => c.path)).toEqual(["copy.ts"]);
	});

	it("keeps parsing entries after a rename", async () => {
		// The index must advance by exactly one extra field, not swallow the next
		// real entry.
		const changes = await run("R  new.ts\0old.ts\0M  after.ts\0", { "new.ts": "a", "after.ts": "b" });
		expect(changes.map((c) => c.path)).toEqual(["new.ts", "after.ts"]);
	});

	it("FAILS when a file cannot be read, rather than committing it empty", async () => {
		// The whole point. An empty string here is a truncated file in the release
		// commit, shipped under a green run.
		await expect(run("M  unreadable.ts\0", {})).rejects.toThrow();
	});

	it("marks an executable file 100755", async () => {
		const changes = await run("M  run.sh\0", { "run.sh": "#!/bin/sh" }, ["run.sh"]);
		expect(changes[0]).toMatchObject({ mode: "100755" });
	});
});
