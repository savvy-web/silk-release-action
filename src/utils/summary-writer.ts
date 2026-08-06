import type { MarkdownEntryOrPrimitive } from "ts-markdown";
import { codeblock, h2, h3, h4, table, tsMarkdown, ul } from "ts-markdown";

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
 */
export const summaryWriter = {
	/**
	 * Build a markdown table from rows.
	 * First row is treated as headers.
	 */
	table(headers: string[], rows: string[][]): string {
		return tsMarkdown([
			table({
				columns: headers,
				rows: rows.map((row) => {
					const rowObj: Record<string, string> = {};
					headers.forEach((header, index) => {
						rowObj[header] = row[index] ?? "";
					});
					return rowObj;
				}),
			}),
		]);
	},

	/**
	 * Build a key-value table (Property | Value format)
	 */
	keyValueTable(entries: Array<{ key: string; value: string }>): string {
		return tsMarkdown([
			table({
				columns: ["Property", "Value"],
				rows: entries.map((entry) => ({
					Property: entry.key,
					Value: entry.value,
				})),
			}),
		]);
	},

	/**
	 * Build a markdown bulleted list
	 */
	list(items: string[]): string {
		return tsMarkdown([ul(items)]);
	},

	/**
	 * Build a markdown heading
	 */
	heading(text: string, level: 2 | 3 | 4 = 2): string {
		switch (level) {
			case 2:
				return tsMarkdown([h2(text)]);
			case 3:
				return tsMarkdown([h3(text)]);
			case 4:
				return tsMarkdown([h4(text)]);
		}
	},

	/**
	 * Build a markdown code block
	 */
	codeBlock(code: string, lang: string = ""): string {
		return tsMarkdown([codeblock(code, lang ? { language: lang, fenced: true } : { fenced: true })]);
	},

	/**
	 * Build a complete summary section with heading and content.
	 */
	section(headingText: string, level: 2 | 3, content: string): string {
		const entries: MarkdownEntryOrPrimitive[] = [];

		if (level === 2) {
			entries.push(h2(headingText));
		} else {
			entries.push(h3(headingText));
		}

		// Content is already rendered markdown, add blank line between heading and content
		return `${tsMarkdown(entries)}\n\n${content}`;
	},

	/**
	 * Build a summary with multiple sections.
	 */
	build(sections: Array<{ heading?: string; level?: 2 | 3 | 4; content: string }>): string {
		const parts: string[] = [];

		for (const section of sections) {
			if (section.heading) {
				const level = section.level ?? 2;
				switch (level) {
					case 2:
						parts.push(tsMarkdown([h2(section.heading)]));
						break;
					case 3:
						parts.push(tsMarkdown([h3(section.heading)]));
						break;
					case 4:
						parts.push(tsMarkdown([h4(section.heading)]));
						break;
				}
				// Add blank line after heading
				parts.push("");
			}
			parts.push(section.content);
			parts.push("");
		}

		return parts.join("\n");
	},
};
