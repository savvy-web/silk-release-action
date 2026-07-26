/**
 * Count changesets per package by reading the **target branch's** `.changeset`
 * directory.
 *
 * @remarks
 * Phase 1's `changeset version` consumes `.changeset/*.md` on the release
 * branch, so they are gone there by the time Phase 2 runs. The target branch
 * still carries them until the release PR merges, so this helper reads them via
 * `@effected/git`'s `lsTree` / `show` against that branch — no checkout.
 *
 * Counting is best-effort: any git or parse failure for an individual file is
 * skipped, and a total failure (e.g. `lsTree` errors) yields an empty map. The
 * returned effect never fails — callers treat a missing package entry as "—".
 *
 * @module utils/count-changesets
 */

import { Git } from "@effected/git";
import { MarkdownDocument, YamlFrontmatter } from "@effected/markdown";
import { Effect, Option, Result } from "effect";

/** The bump levels a changeset entry can name. */
const BUMP_LEVELS = new Set(["major", "minor", "patch"]);

/**
 * The package names a single changeset file's YAML frontmatter attributes a
 * bump to.
 *
 * @remarks
 * The frontmatter is genuine YAML (`"@scope/pkg": minor`), so it is decoded by
 * the yaml engine rather than matched with a line regex — the shape this
 * replaced could not read a quoted key containing a colon, a flow mapping, or
 * any of the other spellings yaml permits.
 *
 * Deliberately tolerant, matching the behaviour it replaces: entries whose
 * value is not one of the three bump levels are skipped **individually**
 * rather than discarding the whole file. A changeset is hand-editable, and one
 * odd line should not silently zero a package's count.
 *
 * @internal
 */
const parseChangesetPackages = (content: string): Effect.Effect<ReadonlyArray<string>, never, never> =>
	Effect.gen(function* () {
		// Frontmatter capture is opt-in: without it a document opening with `---`
		// parses as a thematic break plus a setext heading, per CommonMark.
		const parsed = MarkdownDocument.parseResult(content, { frontmatter: true });
		if (Result.isFailure(parsed)) return [];

		const frontmatter = parsed.success.frontmatter;
		if (frontmatter === undefined) return [];

		const decoded = yield* Effect.result(YamlFrontmatter.decode(frontmatter));
		if (decoded._tag === "Failure") return [];

		const data = decoded.success;
		if (typeof data !== "object" || data === null || Array.isArray(data)) return [];

		const packages: string[] = [];
		for (const [name, bump] of Object.entries(data as Record<string, unknown>)) {
			if (typeof bump === "string" && BUMP_LEVELS.has(bump)) {
				packages.push(name.trim());
			}
		}
		return packages;
	});

/**
 * Count the changesets attributed to each package on a git branch.
 *
 * @param targetBranch - Git ref whose `.changeset` directory is inspected.
 * @returns A map of package name to changeset count; an empty map on any
 *   wholesale failure. The effect never fails.
 *
 * @public
 */
export const countChangesetsPerPackage = (
	targetBranch: string,
): Effect.Effect<ReadonlyMap<string, number>, never, Git> =>
	Effect.gen(function* () {
		const git = yield* Git;
		const cwd = process.cwd();

		// List the changeset files tracked on the target branch.
		const listing = yield* git
			.lsTree(cwd, targetBranch, { pathspec: [".changeset/"] })
			.pipe(Effect.catch(() => Effect.succeed([])));

		const changesetFiles = listing.filter((entry) => {
			if (entry.type !== "blob") return false;
			if (!entry.path.endsWith(".md")) return false;
			const base = entry.path.slice(entry.path.lastIndexOf("/") + 1);
			return base.toLowerCase() !== "readme.md";
		});

		const counts = new Map<string, number>();

		for (const entry of changesetFiles) {
			// A per-file failure (git error) or an absent blob is skipped, so one
			// bad file does not discard the whole count. `show` reports absence as
			// `Option.none` rather than an error — it is NOT a nullable string, and
			// `?? null` against it would never fire.
			const content = yield* git
				.show(cwd, targetBranch, entry.path)
				.pipe(Effect.catch(() => Effect.succeed(Option.none<string>())));

			if (Option.isNone(content)) continue;

			for (const pkg of yield* parseChangesetPackages(content.value)) {
				counts.set(pkg, (counts.get(pkg) ?? 0) + 1);
			}
		}

		return counts as ReadonlyMap<string, number>;
	});
