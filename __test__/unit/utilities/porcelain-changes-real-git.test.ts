/**
 * `expandUntrackedDirectories` against a real `git` binary.
 *
 * @remarks
 * The unit suite in `porcelain-changes.test.ts` feeds hand-built entries, so it
 * cannot prove the two facts the fix rests on: that real `git status
 * --porcelain` collapses a directory of only untracked files to one `?? dir/`
 * entry WITH a trailing slash, and that `Git.untrackedFiles({ relative: false })`
 * lists that directory's files as repo-root-relative paths. Both are git's
 * behaviour, not ours, so this asks git.
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
import { expandUntrackedDirectories } from "../../../src/utils/porcelain-changes.js";

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

describe("expandUntrackedDirectories with real git", () => {
	it.effect("expands git's collapsed `.changeset/pre/` entry into its non-ignored files", () =>
		Effect.gen(function* () {
			const dir = preModeRepo();
			const g = yield* Git;

			const raw = yield* g.status(dir);
			// The premise: git collapses the directory, trailing slash included.
			expect(raw.map((e) => `${e.x}${e.y} ${e.path}`)).toContain("?? .changeset/pre/");

			const expanded = yield* expandUntrackedDirectories(raw, g.untrackedFiles(dir, { relative: false }));

			expect(expanded.map((e) => `${e.x}${e.y} ${e.path}`).sort()).toEqual([
				" D .changeset/beta-wave.md",
				"?? .changeset/pre/beta-wave.md",
			]);
		}).pipe(Effect.provide(GitLive)),
	);
});
