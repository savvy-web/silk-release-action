// The release PR's generated description.
//
// Shared by both Phase-1 branch paths. `create-release-branch` used to send
// `body: ""` while `update-release-branch` built a real body, so a **first**
// release PR linked no issues at all — observed on `savvy-web/silk-integration`
// PR #242 (and #232 before it): empty body, `closingIssuesReferences: []`.
//
// **What actually triggers GitHub's linking is a bare `Closes #N` line**, which
// is why `buildManagedPrBody` emits one per open issue as plain text.
// The rich `Linked Issues` list is for humans and carries the issue titles; it
// is deliberately not relied on for linking.
//
// This is a narrow, local body builder, not a document primitive. A
// marker-delimited managed-section construct is being built upstream; this is
// sized to be replaced by it.

import { workflowRunUrl } from "./github-urls.js";
import { summaryWriter } from "./summary-writer.js";

/** Opening marker of the region this module owns. */
export const MANAGED_START = "<!-- silk-release:start -->";
/** Closing marker of the region this module owns. */
export const MANAGED_END = "<!-- silk-release:end -->";

/**
 * The fence language for the proposed squash-commit block.
 *
 * @remarks
 * Not a GFM language and apparently undocumented, but GitHub renders it. It is
 * a target for AI integrations to read and rewrite into the eventual
 * squash-commit message. **Do not "correct" it to `text`.**
 */
export const SQUASH_FENCE_LANGUAGE = "proposed-squash-commit";

const FENCE = "```";

/**
 * The minimum an issue must carry to appear in the PR body.
 *
 * @remarks
 * Structural rather than a shared class, so both branch paths satisfy it with
 * the `LinkedIssue` shapes they already have. The wider dedup of those two
 * shapes is a separate change.
 *
 * @public
 */
export interface LinkedIssueRef {
	readonly number: number;
	readonly title: string;
	readonly state: string;
}

/** Whether an issue should attract a closing reference — closed ones must not. */
const isOpen = (issue: LinkedIssueRef): boolean => issue.state !== "closed";

/**
 * The human-readable issue list, with titles.
 *
 * @remarks
 * Closed issues are struck through and carry no `Closes` keyword: re-closing a
 * closed issue is noise, and the keyword is what GitHub acts on.
 *
 * @public
 */
export const buildLinkedIssuesSection = (linkedIssues: ReadonlyArray<LinkedIssueRef>): string => {
	if (linkedIssues.length === 0) return "";
	const items = linkedIssues.map((issue) =>
		isOpen(issue) ? `Closes #${issue.number}: ${issue.title}` : `~~#${issue.number}: ${issue.title}~~ (already closed)`,
	);
	return summaryWriter.build([{ heading: "Linked Issues", content: summaryWriter.list(items) }]);
};

/**
 * The bare `Closes #N` lines GitHub's linker reads.
 *
 * @remarks
 * One per open issue, each on its own line with nothing before or after it.
 * This is the load-bearing part of the body.
 *
 * **The form is empirically verified, not inferred from GitHub's docs.**
 * `savvy-web/silk-integration` PR #243 was constructed by hand as a deliberate
 * experiment to answer exactly this question: a body containing only a bare
 * `Closes #168` reported `closingIssuesReferences: [168]`. PRs #242 and #232 —
 * created by this action with an empty body — reported none.
 *
 * A reference **inside a fenced block does not count**, which is why the
 * proposed-squash-commit block carries its own copy and these lines are emitted
 * separately rather than shared. Do not "deduplicate" the two.
 *
 * @public
 */
export const buildClosingReferences = (linkedIssues: ReadonlyArray<LinkedIssueRef>): string =>
	linkedIssues
		.filter(isOpen)
		.map((issue) => `Closes #${issue.number}`)
		.join("\n");

/**
 * The proposed squash-commit message, fenced for an AI integration to rewrite.
 *
 * @remarks
 * Carries its own `Closes` references because the squash commit needs them too
 * — a reference inside a fenced block is inert to GitHub's linker, which is
 * precisely why the plain-text lines outside it are separate rather than
 * shared.
 */
const buildSquashBlock = (args: {
	readonly subject: string;
	readonly linkedIssues: ReadonlyArray<LinkedIssueRef>;
	readonly signoff: string;
}): string => {
	const closing = buildClosingReferences(args.linkedIssues);
	const message = [args.subject, closing, args.signoff].filter((part) => part !== "").join("\n\n");
	return `${FENCE}${SQUASH_FENCE_LANGUAGE}\n${message}\n${FENCE}`;
};

/**
 * Build the region of the PR description this action owns.
 *
 * @remarks
 * Delimited by {@link MANAGED_START} / {@link MANAGED_END} so
 * {@link upsertManagedRegion} can regenerate it without touching anything a
 * human wrote around it.
 *
 * @public
 */
export const buildManagedPrBody = (args: {
	readonly subject: string;
	readonly linkedIssues: ReadonlyArray<LinkedIssueRef>;
	readonly signoff: string;
	readonly owner: string;
	readonly repo: string;
	readonly runId: string;
	/** The GitHub instance this run executes against; see `resolveServerUrl`. */
	readonly serverUrl: string;
}): string => {
	const sections: Array<{ heading?: string; level?: 2 | 3; content: string }> = [];

	if (args.linkedIssues.length > 0) {
		sections.push({ content: buildLinkedIssuesSection(args.linkedIssues) });
	}
	// No "Release PR" preamble and no "Version Changes" listing.
	//
	// The preamble told a reader what the PR's title, branch and author already
	// say. The listing was a `git status --porcelain` dump — two lines per
	// package, naming `CHANGELOG.md` and `package.json` for every release — which
	// says nothing the release table does not say better: the table names the
	// packages, their versions, and their bumps, and it is on the same page.
	//
	// The file-level view still exists where it earns its place — the check-run
	// and job summaries — which build it from their own scope.
	sections.push({
		content: buildSquashBlock({ subject: args.subject, linkedIssues: args.linkedIssues, signoff: args.signoff }),
	});

	// The plain-text closing references, OUTSIDE the fence. This is the line
	// GitHub links on; everything above is presentation.
	const closing = buildClosingReferences(args.linkedIssues);
	if (closing !== "") sections.push({ content: closing });

	sections.push({
		content: `---\n🤖 Generated with [GitHub Actions](${workflowRunUrl(args.serverUrl, args.owner, args.repo, args.runId)})`,
	});

	return `${MANAGED_START}\n${summaryWriter.build(sections).trim()}\n${MANAGED_END}`;
};

/**
 * Put `managed` into `existing`, replacing a previous managed region and
 * leaving everything else alone.
 *
 * @remarks
 * **Human edits outside the markers survive.** The predecessor spliced on a
 * `## Linked Issues` heading, which silently ate any content a human happened
 * to put under a heading of that name and could not tell our text from theirs.
 * An explicit marker pair can.
 *
 * A body with no markers keeps its content and gains the region **below** it,
 * so an existing hand-written description is not displaced.
 *
 * @public
 */
export const upsertManagedRegion = (existing: string, managed: string): string => {
	const start = existing.indexOf(MANAGED_START);
	const end = existing.indexOf(MANAGED_END);

	if (start !== -1 && end !== -1 && end > start) {
		const before = existing.slice(0, start);
		const after = existing.slice(end + MANAGED_END.length);
		return `${before}${managed}${after}`.trim();
	}

	const trimmed = existing.trim();
	return trimmed === "" ? managed : `${trimmed}\n\n${managed}`;
};
