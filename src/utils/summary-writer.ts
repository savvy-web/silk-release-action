import { GitHubMarkdown } from "@effected/github-actions";

/**
 * Builders for job-summary markdown.
 *
 * @remarks
 * This module BUILDS summary markdown; it does not write it. Emission goes
 * through `ActionOutputs.summary`, which owns the `EFFECTED_EOF` delimiter
 * discipline — every caller here already does that
 * (`outputs.summary(summaryWriter.build(...))`).
 *
 * A `write` member used to live here, reading `process.env.GITHUB_STEP_SUMMARY`
 * and `appendFileSync`-ing to it directly. It had no production caller — only
 * its own test — and it violated two kit invariants: nothing reads `process.env`
 * outside `ActionEnvironment`, and the job summary goes through `ActionOutputs`.
 * Removed 2026-08-05. If a write seam is ever needed here again, it is
 * `ActionOutputs.summary`, not a second path to the same file.
 *
 * The constructs themselves are `GitHubMarkdown` from `@effected/github-actions`
 * — the same writer `release-table.ts` already renders through. `ts-markdown`
 * was a second markdown engine rendering the same four constructs, and it
 * escaped worse: it HTML-entity-escaped a pipe in a cell, passed a newline
 * through raw (breaking the row), let a repeated header collapse two columns
 * into one value, and emitted a three-backtick fence around content that itself
 * contained one. Only `section` and `build` stay local: they are pure
 * composition (a heading plus content, and sections joined) with no kit
 * equivalent, and they are the shape nine call sites depend on.
 */
export const summaryWriter = {
	/**
	 * Build a markdown table from rows.
	 * First row is treated as headers.
	 */
	table(headers: string[], rows: string[][]): string {
		return GitHubMarkdown.table(headers, rows);
	},

	/**
	 * Build a key-value table (Property | Value format)
	 */
	keyValueTable(entries: Array<{ key: string; value: string }>): string {
		return GitHubMarkdown.table(
			["Property", "Value"],
			entries.map((entry) => [entry.key, entry.value]),
		);
	},

	/**
	 * Build a markdown bulleted list
	 */
	list(items: string[]): string {
		return GitHubMarkdown.list(items);
	},

	/**
	 * Build a markdown heading
	 */
	heading(text: string, level: 2 | 3 | 4 = 2): string {
		return GitHubMarkdown.heading(text, level);
	},

	/**
	 * Build a markdown code block
	 */
	codeBlock(code: string, lang: string = ""): string {
		return GitHubMarkdown.codeBlock(code, lang);
	},

	/**
	 * Build a complete summary section with heading and content.
	 */
	section(headingText: string, level: 2 | 3, content: string): string {
		// Content is already rendered markdown, add blank line between heading and content
		return `${GitHubMarkdown.heading(headingText, level)}\n\n${content}`;
	},

	/**
	 * Build a summary with multiple sections.
	 */
	build(sections: Array<{ heading?: string; level?: 2 | 3 | 4; content: string }>): string {
		const parts: string[] = [];

		for (const section of sections) {
			if (section.heading) {
				parts.push(GitHubMarkdown.heading(section.heading, section.level ?? 2));
				// Add blank line after heading
				parts.push("");
			}
			parts.push(section.content);
			parts.push("");
		}

		return parts.join("\n");
	},
};
