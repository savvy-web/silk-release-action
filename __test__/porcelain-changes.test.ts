/**
 * Tests for the porcelain-entry → {@link FileChange} conversion.
 *
 * @remarks
 * The `-z` splitting these tests used to drive is gone: `Git.status` owns it
 * now, and the inputs below are the {@link StatusEntry} values it produces. The
 * two behaviours the predecessor got wrong are still pinned, because both are
 * invisible to the typechecker and both were duplicated byte for byte across
 * `create-release-branch.ts` and `update-release-branch.ts`:
 *
 * 1. **A rename's original path is a field of its own, never a path to read.**
 *    The predecessor split on an inline `" -> "` that `-z` never emits, so the
 *    trailing original path was parsed as an entry in its own right. It now
 *    arrives as `origPath`, and nothing here may read it from disk.
 * 2. **A failed read must fail**, not become `""`. Swallowing it committed the
 *    file truncated to zero bytes and reported success.
 *
 * They compounded: the phantom entry from (1) named a path that no longer
 * existed, so (2) turned it into an empty file added to the release commit.
 */

import { StatusEntry } from "@effected/git";
import { MemoryFileSystem } from "@effected/memfs";
import type { FileSystem, Layer } from "effect";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { collectPorcelainChanges, expandUntrackedDirectories } from "../src/utils/porcelain-changes.js";

/**
 * A volume seeded with exactly the files the case names.
 *
 * @remarks
 * The predecessor hand-rolled this over `FileSystem.layerNoop`, and both of its
 * stubs had to lie to typecheck: the absent-file failure was
 * `new Error(...) as never`, and `stat` answered `{ mode } as never` for every
 * path — including ones nothing seeded. A real volume needs neither cast.
 * Absence now fails with the same typed `NotFound` production sees, and a
 * `stat` of an unseeded path fails rather than fabricating a mode.
 *
 * Paths arrive relative (`"package.json"`), which the volume resolves from its
 * virtual root, so the seed keys are the same names rooted at `/`.
 */
const fsLayer = (
	files: Record<string, string>,
	executable: ReadonlyArray<string> = [],
): Layer.Layer<FileSystem.FileSystem> =>
	MemoryFileSystem.layerWith(
		Object.fromEntries(
			Object.entries(files).map(([path, content]) => [
				`/${path}`,
				MemoryFileSystem.file(content, { mode: executable.includes(path) ? 0o755 : 0o644 }),
			]),
		),
	);

/** One entry as `Git.status` reports it. */
const entry = (xy: string, path: string, origPath?: string): StatusEntry =>
	StatusEntry.make({
		x: xy.charAt(0) as StatusEntry["x"],
		y: xy.charAt(1) as StatusEntry["y"],
		path,
		...(origPath !== undefined && { origPath }),
	});

const run = (entries: ReadonlyArray<StatusEntry>, files: Record<string, string>, executable?: ReadonlyArray<string>) =>
	Effect.runPromise(collectPorcelainChanges(entries).pipe(Effect.provide(fsLayer(files, executable))));

describe("collectPorcelainChanges", () => {
	it("reads a modified file's content", async () => {
		const changes = await run([entry("M ", "package.json")], { "package.json": "{}" });
		expect(changes).toHaveLength(1);
		expect(changes[0]).toMatchObject({ path: "package.json", content: "{}", mode: "100644" });
	});

	it("records a deletion without reading it", async () => {
		// No entry in the file map — a deletion must not attempt a read.
		const changes = await run([entry("D ", "gone.txt")], {});
		expect(changes).toHaveLength(1);
		expect(changes[0]).toMatchObject({ path: "gone.txt" });
		expect(changes[0]).not.toHaveProperty("content");
	});

	it("ignores a rename's original path instead of treating it as an entry", async () => {
		// The production shape: one entry, new path plus `origPath`. `old` no
		// longer exists on disk — the `fsLayer` fails any read of it — so a
		// regression that reached for it rejects rather than quietly adding a
		// zero-length file at the source path to the release commit.
		const changes = await run([entry("R ", "new-name.ts", "old-name.ts")], { "new-name.ts": "export {};" });

		expect(changes).toHaveLength(1);
		expect(changes[0]).toMatchObject({ path: "new-name.ts", content: "export {};" });
	});

	it("ignores a copy's original path the same way", async () => {
		const changes = await run([entry("C ", "copy.ts", "source.ts")], { "copy.ts": "1" });
		expect(changes.map((c) => c.path)).toEqual(["copy.ts"]);
	});

	it("keeps processing entries after a rename", async () => {
		const changes = await run([entry("R ", "new.ts", "old.ts"), entry("M ", "after.ts")], {
			"new.ts": "a",
			"after.ts": "b",
		});
		expect(changes.map((c) => c.path)).toEqual(["new.ts", "after.ts"]);
	});

	it("FAILS when a file cannot be read, rather than committing it empty", async () => {
		// The whole point. An empty string here is a truncated file in the release
		// commit, shipped under a green run.
		await expect(run([entry("M ", "unreadable.ts")], {})).rejects.toThrow();
	});

	it("marks an executable file 100755", async () => {
		const changes = await run([entry("M ", "run.sh")], { "run.sh": "#!/bin/sh" }, ["run.sh"]);
		expect(changes[0]).toMatchObject({ mode: "100755" });
	});
});

// Changesets v3 in pre mode MOVES each consumed changeset into a new, untracked
// `.changeset/pre/` directory. Plain `git status --porcelain -z` collapses an
// untracked directory into ONE entry, `?? .changeset/pre/`, and reading that
// path fails the release (silk-integration run 39988107872:
// "FileSystem.readFile (.changeset/pre/)").
describe("expandUntrackedDirectories", () => {
	const expand = (entries: ReadonlyArray<StatusEntry>, untracked: ReadonlyArray<string>) => {
		let listed = 0;
		const lister = Effect.sync(() => {
			listed += 1;
			return untracked;
		});
		return Effect.runPromise(expandUntrackedDirectories(entries, lister)).then((out) => ({ out, listed }));
	};

	it("replaces a collapsed untracked directory with the files under it", async () => {
		const { out } = await expand(
			[entry(" D", ".changeset/beta-wave.md"), entry("??", ".changeset/pre/"), entry(" M", "package.json")],
			[".changeset/pre/beta-wave.md", ".changeset/pre/other.md", "elsewhere.txt"],
		);

		expect(out.map((e) => `${e.x}${e.y} ${e.path}`)).toEqual([
			" D .changeset/beta-wave.md",
			"?? .changeset/pre/beta-wave.md",
			"?? .changeset/pre/other.md",
			" M package.json",
		]);
	});

	it("does not list untracked files when no directory was collapsed", async () => {
		const { out, listed } = await expand([entry("??", "new-file.md"), entry(" M", "package.json")], []);

		expect(listed).toBe(0);
		expect(out.map((e) => e.path)).toEqual(["new-file.md", "package.json"]);
	});

	it("commits the moved changeset as an addition next to its deletion", async () => {
		const entries = (
			await expand([entry(" D", ".changeset/a.md"), entry("??", ".changeset/pre/")], [".changeset/pre/a.md"])
		).out;
		const changes = await Effect.runPromise(
			collectPorcelainChanges(entries).pipe(Effect.provide(fsLayer({ ".changeset/pre/a.md": "---\n---\n" }))),
		);

		expect(changes.map((c) => [c.path, "content" in c])).toEqual([
			[".changeset/a.md", false],
			[".changeset/pre/a.md", true],
		]);
	});
});
