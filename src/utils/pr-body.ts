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
 * Opening marker of the closing-reference region.
 *
 * @remarks
 * Emitted with an `owned` attribute listing the ids THIS action put there —
 * see {@link buildReferencesRegion} for why merely knowing the region's
 * contents is not enough to merge it safely.
 */
export const REFERENCES_START = "<!-- silk-release:references:start -->";
/** Closing marker of the closing-reference region. */
export const REFERENCES_END = "<!-- silk-release:references:end -->";

/**
 * The opening marker up to its attributes, for locating a region whose
 * `owned` list is unknown.
 *
 * @remarks
 * {@link REFERENCES_START} is the plain form an author writes by hand; this
 * action emits an attributed one. Match on this prefix, never on the plain
 * constant, or a region this action wrote will not be found.
 *
 * @public
 */
export const REFERENCES_START_PREFIX = "<!-- silk-release:references:start";

/**
 * The reference region's current content, or `""` when it is empty or absent.
 *
 * @remarks
 * Symmetric to {@link extractSummary}, and for the same reason: the managed
 * region is regenerated on every run, so anything an agent added here would be
 * deleted the moment a commit landed on the release branch — destructive and
 * silent, with no signal back to whoever wrote it.
 *
 * @param existing - The current PR description.
 * @returns The reference region's content, trimmed.
 *
 * @public
 */
export const extractReferences = (existing: string): string => {
	const from = existing.indexOf(REFERENCES_START_PREFIX);
	const to = existing.indexOf(REFERENCES_END);
	if (from === -1 || to === -1 || to < from) return "";
	// Past the end of the opening marker, whatever attributes it carries.
	const openEnd = existing.indexOf("-->", from);
	if (openEnd === -1 || openEnd > to) return "";
	return existing.slice(openEnd + "-->".length, to).trim();
};

/**
 * The ids the previous run's opening marker claims as its own.
 *
 * @remarks
 * An absent or malformed attribute reads as "none", which degrades to treating
 * every reference in the region as agent-authored. That preserves too much
 * rather than deleting someone's work — the safe direction to fail.
 *
 * @internal
 */
const extractOwnedIds = (existing: string): ReadonlySet<number> => {
	const from = existing.indexOf(REFERENCES_START_PREFIX);
	if (from === -1) return new Set();
	const openEnd = existing.indexOf("-->", from);
	if (openEnd === -1) return new Set();
	const attributes = existing.slice(from + REFERENCES_START_PREFIX.length, openEnd);
	// Anchored to an attribute boundary: an unanchored match also finds
	// `data-owned="…"` and `unowned="…"`, which would let an unrelated attribute
	// claim an agent's reference as ours and get it dropped on the next run.
	const owned = /(?:^|\s)owned="([\d,\s]*)"/.exec(attributes)?.[1];
	if (owned === undefined) return new Set();
	return new Set(
		owned
			.split(",")
			.map((part) => part.trim())
			.filter((part) => part !== "")
			.map(Number),
	);
};

/**
 * Issue ids carried by a reference region's bare closing lines.
 *
 * @remarks
 * Anchored per line so a number mentioned in passing is not mistaken for a
 * closing reference — matching what GitHub itself links on.
 *
 * Every keyword GitHub accepts is matched, not just the present-tense plural
 * this action happens to emit: `close`/`closed`, `fix`/`fixed`,
 * `resolve`/`resolved` and an optional colon are all valid, and a reference
 * this parser fails to recognise is one it silently deletes on the next run.
 *
 * @internal
 */
const parseReferenceIds = (region: string): ReadonlyArray<number> =>
	region
		.split("\n")
		.map((line) => /^(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\s+#(\d+)$/i.exec(line.trim())?.[1])
		.filter((id): id is string => id !== undefined)
		.map(Number);

/**
 * The marker-delimited reference region, merging this run's references with
 * any an agent added.
 *
 * @remarks
 * The region is always emitted, empty or not, so an agent always has a target
 * to write into — the same reservation {@link SUMMARY_START} makes.
 *
 * **Who wins, and why.** This action decides every issue it knows about: an
 * issue in `linkedIssues` is emitted when open and dropped when closed, and a
 * carried line cannot resurrect one it deliberately dropped.
 *
 * **Why the `owned` attribute exists.** "Not in `linkedIssues`" is NOT enough
 * to identify an agent's addition. A reference this action emitted last run
 * also disappears from `linkedIssues` when the release stops tracking that
 * issue, and treating it as agent-authored would preserve it forever —
 * re-linking, and on merge auto-closing, an issue the release deliberately
 * dropped. Recording the ids each run emitted lets the next one subtract them,
 * so what carries through is exactly what this action never wrote.
 *
 * @internal
 */
const buildReferencesRegion = (args: {
	readonly linkedIssues: ReadonlyArray<LinkedIssueRef>;
	readonly carriedReferences: string;
	readonly previouslyOwned: ReadonlySet<number>;
}): string => {
	const known = new Set(args.linkedIssues.map((issue) => issue.number));
	// Deduplicated: two refs for one issue would otherwise render the reference
	// twice and emit `owned="170,170"`.
	const ownedNow = [...new Set(args.linkedIssues.filter(isOpen).map((issue) => issue.number))];

	const agentAdded = [...new Set(parseReferenceIds(args.carriedReferences))]
		.filter((id) => !args.previouslyOwned.has(id) && !known.has(id))
		.sort((a, b) => a - b);

	const lines = [...ownedNow, ...agentAdded].map((id) => `Closes #${id}`).join("\n");
	const open = `<!-- silk-release:references:start owned="${ownedNow.join(",")}" -->`;

	return `${open}\n${lines === "" ? "" : `${lines}\n`}${REFERENCES_END}`;
};

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
	/**
	 * The reference region's current content, from {@link extractReferences}.
	 *
	 * @remarks
	 * The PR's previous description, verbatim.
	 *
	 * @remarks
	 * The WHOLE prior body rather than an extracted region: merging references
	 * needs both the region's lines and the `owned` attribute on its opening
	 * marker, and two separate parameters would eventually be passed
	 * inconsistently. Optional because a PR being created has no prior body.
	 *
	 * Note this is only read for references — `summary` stays an explicit
	 * parameter, because its owner decides what it says and this function must
	 * not quietly overrule a caller that passed one.
	 */
	readonly priorBody?: string;
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
	//
	// Emitted unconditionally now that markers delimit it: an empty region is
	// still an addressable one, and a release with nothing linked is exactly
	// when an agent is most likely to want to add a reference.
	const priorBody = args.priorBody ?? "";
	parts.push(
		buildReferencesRegion({
			linkedIssues: args.linkedIssues,
			carriedReferences: extractReferences(priorBody),
			previouslyOwned: extractOwnedIds(priorBody),
		}),
	);

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
