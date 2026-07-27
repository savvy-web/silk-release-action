// Extract the topmost release section from a package's `CHANGELOG.md`.
//
// Pure function — file I/O via `node:fs`, parsing via `@effected/markdown`'s
// synchronous `Result` entry point. No Effect service requirements, so
// non-Effect callers can use it directly.
//
// Rule: the **first H2** in `CHANGELOG.md` is the newest entry (changeset
// version always inserts new versions at the top), and the content runs to
// the **next H2** (or end-of-file when this is the package's first release).
// The H2 heading shape itself can be either:
//
// - `## 5.0.13` (fixed-release mode), or
// - `## @savvy-web/standalone-package@0.9.5` (multi-package tagged mode).
//
// Both formats are accepted — the extractor only locates the H2 boundaries.
// GitHub Releases later inserts the same H2 heading verbatim when posting the
// release notes, so the body extracted here is exactly what the consumer
// will see on the release page.
//
// `MarkdownDocument.sections` considers **root-level headings only**, which is
// what the hand-rolled `/^## /` line scan this replaces could not do: a `## `
// line inside a fenced code block terminated the section early, truncating any
// changelog entry that quoted one.
//
// Returns a discriminated result so the caller can render `found` content,
// an explanatory "no CHANGELOG" or "no version section" status, or a read
// error without throwing.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MarkdownDocument } from "@effected/markdown";
import { Result } from "effect";

/**
 * Discriminated outcome of {@link extractReleaseNotes}.
 *
 * @public
 */
export type ReleaseNotesExtraction =
	| { readonly status: "found"; readonly content: string }
	| { readonly status: "no-changelog" }
	| { readonly status: "version-not-found"; readonly reason: string }
	| { readonly status: "error"; readonly message: string };

/**
 * Read `packagePath/CHANGELOG.md` and return the body of its first H2 section.
 *
 * @param packagePath - Absolute path to the package directory.
 * @returns Discriminated extraction result.
 *
 * @public
 */
export function extractReleaseNotes(packagePath: string): ReleaseNotesExtraction {
	const changelogPath = join(packagePath, "CHANGELOG.md");

	if (!existsSync(changelogPath)) {
		return { status: "no-changelog" };
	}

	let changelogContent: string;
	try {
		changelogContent = readFileSync(changelogPath, "utf-8");
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { status: "error", message };
	}

	// Every string is a valid markdown document; the only failure is a
	// hardening-guard trip (nesting past the container cap).
	const parsed = MarkdownDocument.parseResult(changelogContent);
	if (Result.isFailure(parsed)) {
		return { status: "error", message: parsed.failure.message };
	}

	// `depth: 2` is equality, not a maximum — the H1 title never opens a
	// release section and an H3 sub-section never closes one.
	const section = parsed.success.firstSection({ depth: 2 });
	if (section === undefined) {
		return { status: "version-not-found", reason: "CHANGELOG has no H2 section" };
	}

	// `body` is deliberately untrimmed (it is exactly the bytes `bodyRange`
	// describes); the tidy form is the caller's to ask for.
	const content = section.body.trim();
	if (content === "") {
		return {
			status: "version-not-found",
			reason: "First H2 section has no content",
		};
	}

	return { status: "found", content };
}

/**
 * Read a CHANGELOG and return the body of the H2 section for one specific
 * version, or `undefined` when that version has no section there.
 *
 * @remarks
 * A different question from {@link extractReleaseNotes}, which always takes
 * the **newest** entry. Phase 3 walks a list of candidate changelog paths
 * (the package's own, then the repo root) looking for the one that documents
 * the version being released — so "the newest entry" would be the wrong
 * answer for the root fallback, where the top section may belong to another
 * package entirely.
 *
 * Accepts both changeset heading shapes: `## 1.0.0` and `## @scope/pkg@1.0.0`.
 *
 * @param changelogPath - Absolute path to a `CHANGELOG.md`.
 * @param version - The exact version whose section to return.
 * @returns The section body, trimmed, or `undefined` when absent.
 *
 * @public
 */
export function extractVersionReleaseNotes(changelogPath: string, version: string): string | undefined {
	if (!existsSync(changelogPath)) {
		return undefined;
	}

	let content: string;
	try {
		content = readFileSync(changelogPath, "utf-8");
	} catch {
		return undefined;
	}

	const parsed = MarkdownDocument.parseResult(content);
	if (Result.isFailure(parsed)) {
		return undefined;
	}

	const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const heading = new RegExp(`^(?:@[^@]+@)?${escaped}$`);
	const section = parsed.success.sectionByHeading(heading, { depth: 2 });
	if (section === undefined) {
		return undefined;
	}

	const body = section.body.trim();
	return body === "" ? undefined : body;
}
