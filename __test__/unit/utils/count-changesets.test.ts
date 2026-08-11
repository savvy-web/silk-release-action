/**
 * Unit tests for {@link countChangesetsPerPackage}.
 *
 * @remarks
 * Driven through `Git.layerTest` — an in-memory double whose unstubbed members
 * die naming themselves, so a test proves it touched nothing but `lsTree` and
 * `show`. No real git is exercised.
 *
 * The frontmatter cases go beyond the predecessor's coverage on purpose: the
 * line regex this replaced could only read `name: bump` with optional quotes,
 * so anything else yaml permits — a flow mapping, a key whose quotes contain a
 * colon — silently counted as zero. Those are the shapes pinned below.
 */

import { Git, GitCommandError, LsTreeEntry } from "@effected/git";
import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";

import { countChangesetsPerPackage } from "../../../src/utils/count-changesets.js";

const blob = (path: string): LsTreeEntry =>
	LsTreeEntry.make({ mode: "100644", type: "blob", oid: "0".repeat(40), path });

interface GitFixture {
	/** Entries `lsTree` reports, or `"fail"` to make the call fail. */
	readonly entries: ReadonlyArray<LsTreeEntry> | "fail";
	/** File contents by path; an absent path answers `Option.none`. */
	readonly files?: Readonly<Record<string, string>>;
	/** Paths whose `show` should fail outright rather than answer `none`. */
	readonly showFailures?: ReadonlyArray<string>;
}

/** Every `lsTree` call, so the ref and pathspec can be asserted. */
const lsTreeCalls: Array<{ ref: string; pathspec: ReadonlyArray<string> | undefined }> = [];
/** Every `show` call, so the ref can be asserted. */
const showCalls: Array<{ ref: string; path: string }> = [];

const gitLayer = (f: GitFixture) =>
	Git.layerTest({
		lsTree: (_cwd, ref, options) =>
			Effect.suspend(() => {
				lsTreeCalls.push({ ref, pathspec: options?.pathspec });
				return f.entries === "fail"
					? Effect.fail(
							new GitCommandError({ kind: "failed", args: ["ls-tree"], cwd: ".", exitCode: 128, stderr: "boom" }),
						)
					: Effect.succeed(f.entries);
			}),
		show: (_cwd, ref, path) =>
			Effect.suspend(() => {
				showCalls.push({ ref, path });
				if (f.showFailures?.includes(path) === true) {
					return Effect.fail(
						new GitCommandError({ kind: "failed", args: ["show"], cwd: ".", exitCode: 128, stderr: "boom" }),
					);
				}
				const found = f.files?.[path];
				return Effect.succeed(found === undefined ? Option.none<string>() : Option.some(found));
			}),
	});

const run = (f: GitFixture, targetBranch = "main"): Promise<ReadonlyMap<string, number>> => {
	lsTreeCalls.length = 0;
	showCalls.length = 0;
	return Effect.runPromise(countChangesetsPerPackage(targetBranch).pipe(Effect.provide(gitLayer(f))));
};

const frontmatter = (lines: ReadonlyArray<string>, summary = "A change"): string =>
	["---", ...lines, "---", "", summary, ""].join("\n");

describe("countChangesetsPerPackage", () => {
	it("counts changesets per package across the target branch's .changeset directory", async () => {
		const counts = await run({
			entries: [blob(".changeset/README.md"), blob(".changeset/aaa.md"), blob(".changeset/bbb.md")],
			files: {
				".changeset/aaa.md": frontmatter(['"@scope/alpha": minor']),
				".changeset/bbb.md": frontmatter(['"@scope/alpha": patch', '"@scope/beta": major']),
			},
		});

		expect(counts.get("@scope/alpha")).toBe(2);
		expect(counts.get("@scope/beta")).toBe(1);
		expect(counts.size).toBe(2);
	});

	it("scopes the listing to the .changeset directory on the target branch", async () => {
		await run({ entries: [], files: {} }, "release/next");

		expect(lsTreeCalls).toEqual([{ ref: "release/next", pathspec: [".changeset/"] }]);
	});

	it("reads each file at the target branch ref", async () => {
		await run(
			{ entries: [blob(".changeset/x.md")], files: { ".changeset/x.md": frontmatter(["'pkg-x': major"]) } },
			"release/next",
		);

		expect(showCalls).toEqual([{ ref: "release/next", path: ".changeset/x.md" }]);
	});

	it("skips README.md when listing changeset files", async () => {
		const counts = await run({
			entries: [blob(".changeset/README.md"), blob(".changeset/only.md")],
			files: {
				".changeset/README.md": frontmatter(['"never-counted": patch']),
				".changeset/only.md": frontmatter(['"pkg-a": patch']),
			},
		});

		expect(counts.get("pkg-a")).toBe(1);
		expect(counts.has("never-counted")).toBe(false);
		expect(counts.size).toBe(1);
	});

	it("skips tree entries that are not blobs", async () => {
		const counts = await run({
			entries: [
				LsTreeEntry.make({ mode: "040000", type: "tree", oid: "1".repeat(40), path: ".changeset/nested.md" }),
				blob(".changeset/real.md"),
			],
			files: { ".changeset/real.md": frontmatter(['"pkg-real": patch']) },
		});

		expect(counts.get("pkg-real")).toBe(1);
		expect(counts.size).toBe(1);
	});

	it("returns an empty map when lsTree fails", async () => {
		const counts = await run({ entries: "fail" });

		expect(counts.size).toBe(0);
	});

	it("skips a file whose show fails but keeps the rest", async () => {
		const counts = await run({
			entries: [blob(".changeset/good.md"), blob(".changeset/bad.md")],
			files: { ".changeset/good.md": frontmatter(['"pkg-good": minor']) },
			showFailures: [".changeset/bad.md"],
		});

		expect(counts.get("pkg-good")).toBe(1);
		expect(counts.size).toBe(1);
	});

	it("skips a file that is absent at the ref", async () => {
		// `show` answers `Option.none`, NOT a nullable — `?? null` against it
		// would never fire and the file would be parsed as the string "[object
		// Object]", counting nothing but also never being skipped.
		const counts = await run({
			entries: [blob(".changeset/gone.md"), blob(".changeset/here.md")],
			files: { ".changeset/here.md": frontmatter(['"pkg-here": patch']) },
		});

		expect(counts.get("pkg-here")).toBe(1);
		expect(counts.size).toBe(1);
	});
});

describe("countChangesetsPerPackage - frontmatter shapes", () => {
	it("reads an unquoted key", async () => {
		const counts = await run({
			entries: [blob(".changeset/a.md")],
			files: { ".changeset/a.md": frontmatter(["pkg-plain: minor"]) },
		});
		expect(counts.get("pkg-plain")).toBe(1);
	});

	it("reads a single-quoted key", async () => {
		const counts = await run({
			entries: [blob(".changeset/a.md")],
			files: { ".changeset/a.md": frontmatter(["'@scope/pkg': major"]) },
		});
		expect(counts.get("@scope/pkg")).toBe(1);
	});

	it("reads a yaml flow mapping", async () => {
		// The line regex this replaced could not read this shape at all: the
		// whole mapping is one line and matches nothing, so the changeset
		// counted as zero packages.
		const counts = await run({
			entries: [blob(".changeset/a.md")],
			files: { ".changeset/a.md": frontmatter(['{ "@scope/alpha": minor, "@scope/beta": patch }']) },
		});
		expect(counts.get("@scope/alpha")).toBe(1);
		expect(counts.get("@scope/beta")).toBe(1);
	});

	it("skips an entry whose value is not a bump level but keeps its siblings", async () => {
		const counts = await run({
			entries: [blob(".changeset/a.md")],
			files: { ".changeset/a.md": frontmatter(['"pkg-ok": minor', '"pkg-weird": none']) },
		});
		expect(counts.get("pkg-ok")).toBe(1);
		expect(counts.has("pkg-weird")).toBe(false);
	});

	it("returns nothing for a file with no frontmatter", async () => {
		const counts = await run({
			entries: [blob(".changeset/a.md")],
			files: { ".changeset/a.md": "Just a summary, no frontmatter.\n" },
		});
		expect(counts.size).toBe(0);
	});

	it("returns nothing for unparseable frontmatter", async () => {
		const counts = await run({
			entries: [blob(".changeset/a.md")],
			files: { ".changeset/a.md": "---\n\tthis: [is not\n---\n\nsummary\n" },
		});
		expect(counts.size).toBe(0);
	});
});
