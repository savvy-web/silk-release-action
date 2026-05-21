/**
 * Count changesets per package by reading the **target branch's** `.changeset`
 * directory.
 *
 * @remarks
 * Phase 1's `changeset version` consumes `.changeset/*.md` on the release
 * branch, so they are gone there by the time Phase 2 runs. The target branch
 * still carries them until the release PR merges, so this helper reads them via
 * `git ls-tree` / `git show` against that branch.
 *
 * Counting is best-effort: any git or parse failure for an individual file is
 * skipped, and a total failure (e.g. `git ls-tree` errors) yields an empty
 * map. The returned effect never fails — callers treat a missing package entry
 * as "—".
 *
 * @module utils/count-changesets
 */

import type { CommandRunner } from "@savvy-web/github-action-effects";
import { Effect } from "effect";

/**
 * Parse the per-package names attributed by a single changeset file's YAML
 * frontmatter (the block between the first two `---` lines).
 *
 * Each frontmatter line is `"<pkg>": <bump>` (quotes optional). Returns the
 * package names found; lines that do not match the expected shape are ignored.
 *
 * @param content - Raw changeset file content.
 * @returns The package names referenced in the frontmatter.
 */
function parseChangesetPackages(content: string): ReadonlyArray<string> {
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		return [];
	}

	const [, frontmatter] = frontmatterMatch;
	const packages: string[] = [];

	for (const line of frontmatter.split("\n")) {
		const trimmed = line.trim();
		if (trimmed === "") {
			continue;
		}
		// Match: "package-name": major | 'package-name': minor | package-name: patch
		const match = trimmed.match(/^["']?([^"':]+)["']?\s*:\s*(major|minor|patch)\s*$/);
		if (match) {
			packages.push(match[1].trim());
		}
	}

	return packages;
}

/**
 * Count the changesets attributed to each package on a git branch.
 *
 * @param runner - The {@link CommandRunner} service instance.
 * @param targetBranch - Git ref whose `.changeset` directory is inspected.
 * @returns A map of package name to changeset count; an empty map on any
 *   wholesale failure. The effect never fails.
 */
export const countChangesetsPerPackage = (
	runner: typeof CommandRunner.Service,
	targetBranch: string,
): Effect.Effect<ReadonlyMap<string, number>, never, never> =>
	Effect.gen(function* () {
		// List the changeset files tracked on the target branch.
		const listing = yield* runner
			.execLines("git", ["ls-tree", "--name-only", targetBranch, ".changeset/"])
			.pipe(Effect.catchAll(() => Effect.succeed<ReadonlyArray<string>>([])));

		const changesetFiles = listing.filter((path) => {
			if (!path.endsWith(".md")) {
				return false;
			}
			const base = path.slice(path.lastIndexOf("/") + 1);
			return base.toLowerCase() !== "readme.md";
		});

		const counts = new Map<string, number>();

		for (const filePath of changesetFiles) {
			// Read each file; a per-file failure (git error or no content) is
			// skipped so one bad file does not discard the whole count.
			const content = yield* runner.execCapture("git", ["show", `${targetBranch}:${filePath}`]).pipe(
				Effect.map((output) => output.stdout),
				Effect.catchAll(() => Effect.succeed<string | null>(null)),
			);

			if (content === null) {
				continue;
			}

			for (const pkg of parseChangesetPackages(content)) {
				counts.set(pkg, (counts.get(pkg) ?? 0) + 1);
			}
		}

		return counts as ReadonlyMap<string, number>;
	});
