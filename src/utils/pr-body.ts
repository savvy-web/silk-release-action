// The release PR's generated description.
//
// Shared by both Phase-1 branch paths. `create-release-branch` used to send
// `body: ""` while `update-release-branch` built a real body, so a **first**
// release PR linked no issues at all — observed on `savvy-web/silk-integration`
// PR #242 (and #232 before it): empty body, `closingIssuesReferences: []`.
//
// **What actually triggers GitHub's linking is a bare `Closes #N` line**, which
// is why `buildManagedPrBody` emits one per open issue as plain text, outside
// any fence. The comma-joined form inside the squash block is for commitlint and
// is inert to GitHub — the two spellings are not interchangeable.
//
// This is a narrow, local body builder, not a document primitive. A
// marker-delimited managed-section construct is being built upstream; this is
// sized to be replaced by it.

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

/** Opening marker of the region an AI summariser owns. */
export const SUMMARY_START = "<!-- silk-release:summary:start -->";
/** Closing marker of the region an AI summariser owns. */
export const SUMMARY_END = "<!-- silk-release:summary:end -->";

/**
 * The summary region's current content, or `""` when it is empty or absent.
 *
 * @remarks
 * **This action never writes into the region — it only reserves it.** A
 * separate action generates the summary; this one has no AI of its own and is
 * not going to grow one.
 *
 * Extraction exists because the managed region is *regenerated* on every run.
 * Re-emitting the region empty would delete a summary the moment any commit
 * landed on the release branch, which is both destructive and silent — the
 * summariser would have no way to know its work had been discarded.
 *
 * @param existing - The current PR description.
 * @returns The summary region's content, trimmed.
 *
 * @public
 */
export const extractSummary = (existing: string): string => {
	const from = existing.indexOf(SUMMARY_START);
	const to = existing.indexOf(SUMMARY_END);
	if (from === -1 || to === -1 || to < from) return "";
	return existing.slice(from + SUMMARY_START.length, to).trim();
};

/**
 * The comma-joined closing references the **squash commit message** carries.
 *
 * @remarks
 * `Closes #1, #2` on one line — deliberately NOT the newline-separated form
 * used outside the fence. The two consumers disagree: commitlint reads a single
 * comma-joined trailer, GitHub's linker reads one bare reference per line.
 * Verified by hand in the console against a real pull request rather than
 * inferred from either project's documentation.
 *
 * Emitting one form in both places satisfies one consumer and breaks the other,
 * so the duplication below is load-bearing. Do not "simplify" it.
 *
 * @public
 */
export const buildSquashClosingReferences = (linkedIssues: ReadonlyArray<LinkedIssueRef>): string => {
	const open = linkedIssues.filter(isOpen);
	if (open.length === 0) return "";
	return `Closes ${open.map((issue) => `#${issue.number}`).join(", ")}`;
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
	const closing = buildSquashClosingReferences(args.linkedIssues);
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
	/**
	 * The summary region's current content, from {@link extractSummary}.
	 *
	 * @remarks
	 * Passed in rather than read here so this stays a pure function of its
	 * arguments. `""` reserves an empty region.
	 */
	readonly summary: string;
}): string => {
	const parts: Array<string> = [];

	// The summary region, reserved first and left to its owner.
	//
	// Emitted whether or not it has content, so a summariser has somewhere to
	// write on a PR this action created. Its existing content is carried
	// through: the managed region is rebuilt on every run, so re-emitting it
	// empty would silently delete a summary as soon as any commit landed.
	//
	// Nothing else in the body may be placed above it — a reader should meet the
	// prose summary before the machinery.
	parts.push(`${SUMMARY_START}\n${args.summary === "" ? "" : `${args.summary}\n`}${SUMMARY_END}`);

	// No preamble, no file listing, no linked-issues list, no run attribution.
	//
	// Each said something already on the page: the preamble restated the title
	// and branch, the listing dumped `git status` where the release table names
	// the same packages with their versions, the issue list duplicated the
	// closing references below it, and the attribution linked a run GitHub
	// already shows in the checks.
	parts.push(buildSquashBlock({ subject: args.subject, linkedIssues: args.linkedIssues, signoff: args.signoff }));

	// The bare references, OUTSIDE the fence and one per line. This is what
	// GitHub links on — the comma-joined form inside the fence is for
	// commitlint, and neither consumer accepts the other's spelling.
	const closing = buildClosingReferences(args.linkedIssues);
	if (closing !== "") parts.push(closing);

	return `${MANAGED_START}\n${parts.join("\n\n")}\n${MANAGED_END}`;
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
