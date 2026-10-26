/**
 * `Git.status(cwd, { untrackedFiles: "all" })` against a real `git` binary.
 *
 * @remarks
 * Both commit paths read the working tree this way and hand every entry to
 * `collectPorcelainChanges`, which reads each path as a file. The plain
 * `normal` mode collapses a directory of only untracked files to ONE `?? dir/`
 * entry, and reading that path failed the release. This pins the two facts the
 * commit paths rest on: the `all` mode lists such a directory file by file, and
 * it leaves ignored files out. Both are git's behaviour through the kit, not
 * ours, so this asks git.
 *
 * The repo shape is changesets v3's pre mode after `changeset version`: a
 * tracked changeset deleted, and the same file now untracked under
 * `.changeset/pre/` (silk-integration run 39988107872).
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { Git } from "@effected/git";
import { Effect, Layer } from "effect";

const dirs: Array<string> = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const git = (cwd: string, ...args: Array<string>) =>
	execFileSync("git", args, { cwd, stdio: "ignore", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" } });

/** A repo whose only pending change is pre mode moving one changeset. */
const preModeRepo = (): string => {
	const dir = mkdtempSync(join(tmpdir(), "porcelain-real-git-"));
	dirs.push(dir);
	git(dir, "init", "-q");
	mkdirSync(join(dir, ".changeset"));
	writeFileSync(join(dir, ".changeset", "beta-wave.md"), "---\n---\n");
	writeFileSync(join(dir, ".gitignore"), "*.log\n");
	git(dir, "add", ".");
	git(dir, "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", "commit", "-qm", "init");
	mkdirSync(join(dir, ".changeset", "pre"));
	renameSync(join(dir, ".changeset", "beta-wave.md"), join(dir, ".changeset", "pre", "beta-wave.md"));
	// An ignored file inside the untracked directory must not be committed.
	writeFileSync(join(dir, ".changeset", "pre", "debug.log"), "noise");
	return dir;
};

const GitLive = Git.layer.pipe(Layer.provide(NodeServices.layer));

describe("Git.status with untrackedFiles: all, against real git", () => {
	it.effect("lists pre mode's untracked `.changeset/pre/` file by file, leaving ignored files out", () =>
		Effect.gen(function* () {
			const dir = preModeRepo();
			const g = yield* Git;

			// The premise the option exists for: the `normal` mode collapses the
			// directory, trailing slash included.
			const collapsed = yield* g.status(dir, { untrackedFiles: "normal" });
			expect(collapsed.map((e) => `${e.x}${e.y} ${e.path}`)).toContain("?? .changeset/pre/");

			const entries = yield* g.status(dir, { untrackedFiles: "all" });

			expect(entries.map((e) => `${e.x}${e.y} ${e.path}`).sort()).toEqual([
				" D .changeset/beta-wave.md",
				"?? .changeset/pre/beta-wave.md",
			]);
		}).pipe(Effect.provide(GitLive)),
	);
});
