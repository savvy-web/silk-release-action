/**
 * The snapshot phase's job-summary markdown: the one rendering surface for it.
 *
 * @remarks
 * Built from the kit's `GitHubMarkdown`, not a hand-rolled writer, and pure.
 * The step writes the result through `ActionOutputs.summary`.
 *
 * @module utils/snapshot-summary
 */

import { GitHubMarkdown } from "@effected/github-actions";
import type { SnapshotOutput } from "../schema/release-output.js";

/**
 * A ready-to-paste pnpm `overrides:` block, one line per package name.
 *
 * @remarks
 * Deduped by name: one package published to npm and GitHub Packages is one
 * override, since both carry the same version.
 *
 * @param published - The snapshot output's `published` list.
 * @returns The YAML block body, without fences.
 *
 * @public
 */
export const renderOverrides = (published: SnapshotOutput["published"]): string => {
	const seen = new Map<string, string>();
	for (const p of published) if (!seen.has(p.name)) seen.set(p.name, p.version);
	return ["overrides:", ...[...seen].map(([name, version]) => `  "${name}": "${version}"`)].join("\n");
};

/**
 * Render the snapshot job summary.
 *
 * @param output - The emitted snapshot output.
 * @param branch - The dispatched branch; empty when the run was refused before it was known.
 * @returns GitHub-flavoured markdown.
 *
 * @public
 */
export const renderSnapshotSummary = (output: SnapshotOutput, branch: string): string => {
	const code = GitHubMarkdown.code;
	const parts: string[] = [
		GitHubMarkdown.heading(`Snapshot ${code(output.tag)}${branch === "" ? "" : ` of ${code(branch)}`}`, 2),
		output.summary,
	];
	if (output.dryRun) parts.push("**Dry run** — nothing was published to any registry.");
	if (output.published.length > 0) {
		parts.push(
			GitHubMarkdown.table(
				["Package", "Version", "Registry", "Tag"],
				output.published.map((p) => [code(p.name), code(p.version), p.registry.name, code(p.tag)]),
			),
		);
		parts.push(
			"Pin these exact versions in a downstream `pnpm-workspace.yaml`, never the tag: a failed or re-run " +
				"snapshot can leave a partial set published under it, so the tag alone is not a consistent set.",
		);
		parts.push(GitHubMarkdown.codeBlock(renderOverrides(output.published), "yaml"));
	}
	if (output.skipped.length > 0) {
		parts.push(
			GitHubMarkdown.table(
				["Skipped", "Version", "Reason"],
				output.skipped.map((s) => [code(s.name), code(s.version), code(s.reason)]),
			),
		);
	}
	if (output.failed.length > 0) {
		parts.push(
			GitHubMarkdown.table(
				["Failed", "Version", "Registry", "Error"],
				output.failed.map((f) => [code(f.name), code(f.version), f.registry.name, f.error]),
			),
		);
	}
	return parts.join("\n\n");
};
