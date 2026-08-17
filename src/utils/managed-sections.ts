// Per-section state for the release PR body and its sticky comments.
//
// The problem this exists for: both the sticky comment and the PR's managed
// region are written only on COMPLETION. From the moment a new build validation
// starts until it finishes, the previous result is displayed as current, with
// nothing to say otherwise. The stale-body gate that shipped a PR describing
// versions that had already moved was one instance; this is the general form.
//
// Five rules, in the order they matter:
//
//  1. The `running` transition is written BEFORE the work. `withSection` exists
//     so a caller cannot get this wrong — the write is not the caller's to
//     order.
//  2. A recompute does NOT blank the section. The prior result stays, marked
//     superseded, because a reader mid-run is better served by a stale answer
//     labelled stale than by an empty placeholder.
//  3. The commit sha is stamped, not just the run id. Sha is what makes
//     staleness detectable INDEPENDENT of state — including when a run dies
//     without ever writing a terminal state.
//  4. Sections are independent. One recomputing must not re-render its
//     neighbours.
//  5. Writes are monotonic. A slower OLDER run finishing last must not
//     overwrite a newer run's result.
//
// REGION MECHANICS ARE THE KIT'S (issue #258, landed).
//
// The ~80 lines that used to scan and splice regions here — `regionStart`,
// `regionEnd`, `readRegion`, `stripRegion` and the splice in `upsertSection` —
// are gone. `ManagedDocument` from `@effected/github-actions` owns the region
// grammar now, and its `@effected/templates` engine is better tested than this
// module ever was: idempotence, CRLF, BOM and marker injection, with a recorded
// surviving-mutant history.
//
// What each rule became:
//
//  - Rule 4 is native. `withRegionsResult` replaces named regions in place and
//    leaves every other byte — neighbouring sections, human prose — untouched.
//  - Rule 3 got BETTER out of the swap rather than merely surviving it. The
//    banner is now its own region (`<key>-banner`), so refreshing every banner
//    on a write rewrites only the banner regions and leaves each section's
//    content and stamp byte-identical. The old whole-section re-render is what
//    made rule 4 and rule 3 pull against each other.
//  - The stamp moved out of an in-content HTML comment into REGION METADATA,
//    which round-trips verbatim and survives writes by parties that do not know
//    about it. `at` and `runId` are deliberately spelled bare: those are the two
//    keys `CheckDocument`'s own drop rule reads, so a later swap onto it
//    inherits rule 5 rather than re-deriving it.
//  - Rule 5 delegates to `CheckDocumentStamp.isAtLeastAsRecent`, which is this
//    module's old comparator plus two refinements it lacked: a blank `runId`
//    orders lexically instead of as `Number("") === 0`, and `at` is compared
//    `Date.parse`-aware so offset spellings order correctly.
//  - Rules 1 and 2 are untouched — `withSection`'s exit-aware finalizer and the
//    retained previous body are above the region layer, not part of it.
//
// The wire formats are incompatible: ours was
// `<!-- silk-release:section:<key>:start -->`, the kit's is
// `<!-- --- BEGIN <ns>.<key>.<region> MANAGED REGION --- -->`, and the kit
// scanner preserves the old markers as prose. So every read path runs
// `migrateLegacySections` first — a one-shot, idempotent, content-preserving
// conversion of any legacy region it finds. See its docs for why stripping
// rather than converting would have been a data-loss bug.

import { CheckDocumentStamp, ManagedDocument } from "@effected/github-actions";
import { Effect, Exit, Option, Result } from "effect";

/**
 * What a section is doing.
 *
 * @remarks
 * `failed` and `skipped` are deliberately separate: "we tried and it broke" and
 * "not applicable here" render identically today and mean opposite things.
 *
 * @public
 */
export type SectionState = "pending" | "running" | "complete" | "failed" | "skipped" | "cancelled";

/**
 * When a section's content was produced, and against what.
 *
 * @public
 */
export interface SectionStamp {
	readonly state: SectionState;
	/** The commit the content describes. The field that detects staleness. */
	readonly sha: string;
	/** The workflow run that wrote it. */
	readonly runId: string;
	/** ISO-8601 write time — the monotonic ordering key. */
	readonly at: string;
}

/**
 * One independently-written region of a body.
 *
 * @public
 */
export interface Section {
	/** Stable id; also the region key. */
	readonly key: string;
	/** Heading shown to a reader. */
	readonly title: string;
	readonly stamp: SectionStamp;
	/** The last rendered result. Retained across a recompute — see rule 2. */
	readonly body: string;
}

/** The managed document these sections live in. */
const NAMESPACE = "silk-release";
const DOCUMENT_KEY = "sections";

/**
 * The suffix that makes a region a section's banner rather than a section.
 *
 * @remarks
 * **Reserved.** A section key ending in this would collide with its
 * neighbour's banner, so {@link renderSection} rejects one rather than letting
 * the collision surface later as a section that silently overwrites a banner.
 * Nothing in this repository comes close — the three keys are `release-plan`,
 * `validation-status` and `validation-details` — but the rule is cheap and the
 * failure it prevents is not.
 */
const BANNER_SUFFIX = "-banner";

const bannerKey = (key: string): string => `${key}${BANNER_SUFFIX}`;
const isBannerKey = (key: string): boolean => key.endsWith(BANNER_SUFFIX);

/** The states a stamp may carry, for validating one read back off a region. */
const SECTION_STATES: ReadonlySet<string> = new Set([
	"pending",
	"running",
	"complete",
	"failed",
	"skipped",
	"cancelled",
] satisfies ReadonlyArray<SectionState>);

const isSectionState = (value: string): value is SectionState => SECTION_STATES.has(value);

/**
 * The stamp as region metadata.
 *
 * @remarks
 * Four flat `name="value"` attributes rather than one JSON blob: the kit's
 * marker grammar forbids `"` in a value, so a JSON object could not be written
 * there at all, and flat keys are what let `at`/`runId` be read by anything
 * else that understands the kit's stamp — `CheckDocument`'s drop rule above
 * all.
 *
 * @internal
 */
const encodeStamp = (stamp: SectionStamp): Record<string, string> => ({
	state: stamp.state,
	sha: stamp.sha,
	runId: stamp.runId,
	at: stamp.at,
});

/**
 * A stamp read back off region metadata, or `undefined` when unreadable.
 *
 * @remarks
 * A region whose `state` is not one of the known six is dropped rather than
 * passed through: {@link renderBanner}'s fallback arm would otherwise render a
 * garbled value as "up to date", which is a false claim about unreadable data.
 *
 * @internal
 */
const decodeStamp = (meta: Readonly<Record<string, string>>): SectionStamp | undefined => {
	const { state, sha, at, runId } = meta;
	if (state === undefined || sha === undefined || at === undefined) return undefined;
	if (!isSectionState(state)) return undefined;
	return { state, sha, at, runId: runId ?? "" };
};

const shortSha = (sha: string): string => (sha.length > 7 ? sha.slice(0, 7) : sha);

/**
 * The one-line status banner a reader actually looks at.
 *
 * @remarks
 * **Rule 3 lives here.** A section whose stamped sha is not the branch head is
 * reported stale *regardless of its state* — which is what covers the run that
 * died before writing a terminal state, the case a state field alone cannot
 * express.
 *
 * @public
 */
export const renderBanner = (stamp: SectionStamp, headSha: string, commitUrl?: (sha: string) => string): string => {
	const stale = headSha !== "" && stamp.sha !== "" && stamp.sha !== headSha;
	// A linked sha where a URL builder is available, bare where it is not — the
	// banner must render the same either way, so the link is decoration rather
	// than structure.
	const ref = (sha: string): string =>
		commitUrl === undefined ? `\`${shortSha(sha)}\`` : `[\`${shortSha(sha)}\`](${commitUrl(sha)})`;

	switch (stamp.state) {
		case "running":
			return `<sub>⏳ Re-running — showing the previous result for ${ref(stamp.sha)}, which may be out of date.</sub>`;
		case "failed":
			return stale
				? `<sub>❌ Failed for ${ref(stamp.sha)} — the branch has moved to ${ref(headSha)} since.</sub>`
				: `<sub>❌ Failed for ${ref(stamp.sha)}.</sub>`;
		case "skipped":
			return `<sub>⏭️ Skipped — not applicable for ${ref(stamp.sha)}.</sub>`;
		case "cancelled":
			return `<sub>🛑 Cancelled before it finished — showing the previous result for ${ref(stamp.sha)}.</sub>`;
		case "pending":
			return "<sub>🕓 Not yet run.</sub>";
		default:
			return stale
				? `<sub>⚠️ Out of date — computed for ${ref(stamp.sha)}, the branch is now ${ref(headSha)}.</sub>`
				: `<sub>Up to date as of ${ref(stamp.sha)}</sub>`;
	}
};

/** A section's own region content: heading, then the retained result. */
const sectionContent = (section: Section): string => `### ${section.title}\n\n${section.body}`;

/**
 * The region entries one section contributes: its content and its banner.
 *
 * @remarks
 * Provenance goes in the *second* region so it renders below the content. Above
 * it, it pushed the thing a reader came for below the fold on every section.
 *
 * @internal
 */
const entriesFor = (
	section: Section,
	headSha: string,
	commitUrl?: (sha: string) => string,
): ReadonlyArray<readonly [string, string, Readonly<Record<string, string>>?]> => [
	[section.key, sectionContent(section), encodeStamp(section.stamp)],
	[bannerKey(section.key), renderBanner(section.stamp, headSha, commitUrl)],
];

// ─── Legacy wire format (issue #258 migration) ────────────────────────────────

const legacyStart = (key: string): string => `<!-- silk-release:section:${key}:start -->`;
const legacyEnd = (key: string): string => `<!-- silk-release:section:${key}:end -->`;
const LEGACY_KEY_RE = /<!-- silk-release:section:([^:]+):start -->/g;
const LEGACY_STAMP_RE = /<!-- silk-release:stamp (\{.*?\}) -->/;
const LEGACY_BANNER_START = "<!-- silk-release:banner:start -->";
const LEGACY_BANNER_END = "<!-- silk-release:banner:end -->";

/** A stamp decoded from the legacy in-content JSON comment. */
const decodeLegacyStamp = (text: string): SectionStamp | undefined => {
	const match = LEGACY_STAMP_RE.exec(text);
	if (match?.[1] === undefined) return undefined;
	try {
		const parsed: unknown = JSON.parse(match[1]);
		if (parsed === null || typeof parsed !== "object") return undefined;
		const s = parsed as Partial<SectionStamp>;
		if (typeof s.state !== "string" || typeof s.sha !== "string" || typeof s.at !== "string") return undefined;
		if (!isSectionState(s.state)) return undefined;
		return { state: s.state, sha: s.sha, runId: String(s.runId ?? ""), at: s.at };
	} catch {
		return undefined;
	}
};

/**
 * Convert every legacy region in a body into a {@link Section}, and remove it.
 *
 * @remarks
 * **The one-shot wire-format migration, and it converts rather than strips.**
 * Stripping would have been a data-loss bug of exactly the kind rule 2 exists
 * to prevent: no single run owns every section, so the first run after the swap
 * would have deleted the two sections it does not write and re-added only its
 * own. Carrying the content across means a release PR mid-flight keeps every
 * result it had, under the same keys, with the same stamps.
 *
 * **Idempotent by construction.** It matches only the legacy marker, which the
 * conversion removes, so a second pass finds nothing and returns the body
 * unchanged — the property that lets it run unconditionally on every read path
 * instead of behind a one-time flag nobody could safely retire.
 *
 * A legacy region whose stamp will not decode is **left exactly where it is**,
 * markers and all. It carries no readable provenance, so this module cannot
 * manage it — but "cannot manage" is not "may delete". Removing it was a real
 * data-loss bug caught by test: a hand-written or truncated region, or one
 * another tool wrote under the same marker spelling, would have vanished on the
 * first write after the swap. Left in place it survives as prose, which is what
 * the kit's scanner does with every marker it does not own.
 *
 * @param body - The document as it exists on GitHub right now.
 * @returns The body with legacy regions excised, and the sections recovered
 *   from them in document order.
 *
 * @internal
 */
export const migrateLegacySections = (
	body: string,
): { readonly text: string; readonly recovered: ReadonlyArray<Section> } => {
	const keys = [...body.matchAll(LEGACY_KEY_RE)]
		.map((match) => match[1])
		.filter((key): key is string => key !== undefined);
	if (keys.length === 0) return { text: body, recovered: [] };

	const recovered: Section[] = [];
	let text = body;

	for (const key of keys) {
		const from = text.indexOf(legacyStart(key));
		const to = text.indexOf(legacyEnd(key), from === -1 ? 0 : from);
		if (from === -1 || to === -1 || to < from) continue;

		const inner = text.slice(from + legacyStart(key).length, to);

		// Decode BEFORE excising. An undecodable region is left in place — see the
		// remarks — so the excision has to be conditional on having somewhere to
		// carry the content to.
		const stamp = decodeLegacyStamp(inner);
		if (stamp === undefined) continue;

		text = `${text.slice(0, from)}${text.slice(to + legacyEnd(key).length)}`;

		// The banner was its own delimited region inside the content; drop it
		// wholesale rather than cutting around it, because it is regenerated on
		// every render and re-emitting it would duplicate it.
		const bannerFrom = inner.indexOf(LEGACY_BANNER_START);
		const bannerTo = inner.indexOf(LEGACY_BANNER_END, bannerFrom === -1 ? 0 : bannerFrom);
		const withoutBanner =
			bannerFrom === -1 || bannerTo === -1 || bannerTo < bannerFrom
				? inner
				: `${inner.slice(0, bannerFrom)}${inner.slice(bannerTo + LEGACY_BANNER_END.length)}`;

		const lines = withoutBanner.split("\n");
		const headingIdx = lines.findIndex((l) => l.startsWith("### "));
		const title = headingIdx === -1 ? key : (lines[headingIdx]?.slice(4) ?? key);
		const sectionBody = lines
			.slice(headingIdx === -1 ? 0 : headingIdx + 1)
			.join("\n")
			.trim();

		recovered.push({ key, title, stamp, body: sectionBody });
	}

	// Trim only when something was actually excised: an untouched body must come
	// back byte-identical, or every read path would report a spurious change.
	return { text: recovered.length === 0 ? text : text.trim(), recovered };
};

// ─── Reading and writing ──────────────────────────────────────────────────────

/**
 * The migrated body as a parsed document, plus what the migration recovered.
 *
 * @remarks
 * **A structurally corrupt document degrades to `undefined`, and every caller
 * turns that into "leave the body exactly as it is".** `parseResult` fails only
 * on a region layout that cannot be read unambiguously — which is a document a
 * human edited into a shape where any repair would destroy something they
 * wrote. Dropping our write is the only move that cannot lose their content.
 *
 * @internal
 */
const open = (
	body: string,
): { readonly doc: ManagedDocument; readonly recovered: ReadonlyArray<Section> } | undefined => {
	const { text, recovered } = migrateLegacySections(body);
	const parsed = ManagedDocument.parseResult({ namespace: NAMESPACE, key: DOCUMENT_KEY, text });
	if (Result.isFailure(parsed)) return undefined;
	return { doc: parsed.success, recovered };
};

/** Apply region entries, or `undefined` when the kit refuses them. */
const apply = (
	doc: ManagedDocument,
	entries: ReadonlyArray<readonly [string, string, Readonly<Record<string, string>>?]>,
): string | undefined => {
	const next = doc.withRegionsResult(entries);
	return Result.isFailure(next) ? undefined : next.success.text;
};

/**
 * Every section a document carries, in document order.
 *
 * @internal
 */
const readSections = (doc: ManagedDocument): ReadonlyArray<Section> =>
	doc.regions.flatMap((region) => {
		if (isBannerKey(region.key)) return [];
		const stamp = decodeStamp(region.meta);
		if (stamp === undefined) return [];
		const lines = region.content.split("\n");
		const headingIdx = lines.findIndex((l) => l.startsWith("### "));
		const title = headingIdx === -1 ? region.key : (lines[headingIdx]?.slice(4) ?? region.key);
		const body = lines
			.slice(headingIdx === -1 ? 0 : headingIdx + 1)
			.join("\n")
			.trim();
		return [{ key: region.key, title, stamp, body }];
	});

/**
 * Render one section as a standalone document fragment, markers included.
 *
 * @remarks
 * Rendering into an empty document rather than concatenating markers by hand:
 * the result then carries the document sentinel, so a caller that pastes it
 * beside human prose produces text {@link readSection} and
 * {@link upsertSection} read back as a real document.
 *
 * @public
 */
export const renderSection = (section: Section, headSha: string, commitUrl?: (sha: string) => string): string => {
	if (isBannerKey(section.key)) {
		throw new Error(`section key must not end in "${BANNER_SUFFIX}" — it is reserved for banners: ${section.key}`);
	}
	return upsertSection("", section, headSha, commitUrl);
};

/**
 * Recompute every section's staleness banner against the current head.
 *
 * @remarks
 * **A banner is rendered into the text, so it freezes at write time.** A section
 * nobody rewrites keeps whatever it said when it was last written — which was
 * computed against the head *as of that run*. On a later commit, a section left
 * alone goes on claiming `Up to date as of <old sha>` while the branch has
 * moved, which is a false claim rather than merely a stale one.
 *
 * Refreshing them all on any write costs nothing — the write is already a
 * whole-body rewrite — and it is what makes the stamp's promise good. Since the
 * swap onto `ManagedDocument` it costs even less than that: only the `-banner`
 * regions are rewritten, so a section's content and stamp come back
 * byte-identical and no other phase's result is touched at all.
 *
 * @param body - The comment body.
 * @param headSha - The commit sections should be measured against.
 * @returns The body with every banner recomputed.
 *
 * @public
 */
export const refreshBanners = (body: string, headSha: string, commitUrl?: (sha: string) => string): string => {
	const opened = open(body);
	if (opened === undefined) return body;

	const entries = [
		// Recovered legacy sections are re-emitted in full — they have no regions
		// in the new document yet, so refreshing "their banner" would write a
		// banner for a section that is not there.
		...opened.recovered.flatMap((section) => entriesFor(section, headSha, commitUrl)),
		...readSections(opened.doc).map(
			(section) => [bannerKey(section.key), renderBanner(section.stamp, headSha, commitUrl)] as const,
		),
	];

	// Nothing to refresh: return the body untouched rather than writing a
	// sentinel into a document that carries no managed section at all. A body of
	// pure human prose must survive a refresh byte-identical — a caller compares
	// against it to decide whether to issue an API call.
	if (entries.length === 0) return body;

	return apply(opened.doc, entries) ?? body;
};

/**
 * Read a section back out of a body.
 *
 * @remarks
 * Reads the legacy wire format too, through the same migration every write
 * path runs — so a mid-flight release PR's retained body (rule 2) survives the
 * swap instead of reading as an absent section and blanking on the next write.
 *
 * @public
 */
export const readSection = (body: string, key: string): Section | undefined => {
	const opened = open(body);
	if (opened === undefined) return undefined;

	const recovered = opened.recovered.find((section) => section.key === key);
	if (recovered !== undefined) return recovered;

	const entry = opened.doc.entry(key);
	if (Option.isNone(entry)) return undefined;
	const stamp = decodeStamp(entry.value.meta);
	if (stamp === undefined) return undefined;

	const lines = entry.value.content.split("\n");
	const headingIdx = lines.findIndex((l) => l.startsWith("### "));
	const title = headingIdx === -1 ? key : (lines[headingIdx]?.slice(4) ?? key);
	const sectionBody = lines
		.slice(headingIdx === -1 ? 0 : headingIdx + 1)
		.join("\n")
		.trim();
	return { key, title, stamp, body: sectionBody };
};

/**
 * Is `incoming` at least as recent as `existing`?
 *
 * @remarks
 * **Rule 5**, delegated to `CheckDocumentStamp.isAtLeastAsRecent` (issue #258).
 * The kit's comparator is this module's old one plus two refinements it was
 * missing: a blank `runId` orders lexically rather than as `Number("") === 0`,
 * and `at` compares as epoch milliseconds when both sides `Date.parse` cleanly,
 * so offset spellings of the same instant order correctly.
 *
 * The contract is unchanged: `at` orders, `runId` breaks ties, and equal stamps
 * pass so a run can refine its own section.
 *
 * @public
 */
export const isAtLeastAsRecent = (incoming: SectionStamp, existing: SectionStamp): boolean =>
	CheckDocumentStamp.isAtLeastAsRecent(incoming, existing);

/**
 * Write `section` into `body`, replacing only its own region.
 *
 * @remarks
 * **Rules 4 and 5.** Other sections and any human prose are untouched, and an
 * older write is DROPPED rather than applied.
 *
 * The drop returns the body **as migrated** rather than verbatim. A stale run
 * still must not publish its result, but it has no business withholding the
 * wire-format conversion from a document that needs one — and on a body with no
 * legacy markers the migration is the identity, so the byte-identical
 * compare-and-skip a caller relies on is unaffected.
 *
 * @public
 */
export const upsertSection = (
	body: string,
	section: Section,
	headSha: string,
	commitUrl?: (sha: string) => string,
): string => {
	const opened = open(body);
	if (opened === undefined) return body;

	const carried = opened.recovered.filter((other) => other.key !== section.key);
	const existing =
		opened.recovered.find((other) => other.key === section.key) ?? readSectionFrom(opened.doc, section.key);

	const entries = [
		...carried.flatMap((other) => entriesFor(other, headSha, commitUrl)),
		...(existing !== undefined && !isAtLeastAsRecent(section.stamp, existing.stamp)
			? // Stale: the section keeps the newer run's result, so it is re-emitted
				// from what is already there rather than simply omitted — omitting it
				// would leave a recovered legacy section unwritten.
				entriesFor(existing, headSha, commitUrl)
			: entriesFor(section, headSha, commitUrl)),
	];

	return apply(opened.doc, entries) ?? body;
};

/** {@link readSection}, against an already-opened document. */
const readSectionFrom = (doc: ManagedDocument, key: string): Section | undefined =>
	readSections(doc).find((section) => section.key === key);

/**
 * Run `work` inside a section bracket: `running` on entry, a terminal state on
 * **every** exit path.
 *
 * @remarks
 * **Rule 1, and it is a bracket problem rather than an ordering one.** Writing
 * `running` first and `complete` after is necessary but not sufficient: a run
 * that fails, dies with a defect, or is cancelled leaves the section reading
 * `running` **forever**, which is the most misleading state of the five —
 * it says "in progress" indefinitely.
 *
 * So the terminal write is an **exit-aware finalizer**, not a `tap`/`tapError`
 * pair. That pair fires on success and typed failure only, and would miss both
 * a defect and an interrupt. `@effected/github`'s `CheckRunShape.withCheckRun`
 * makes the same argument for the same reason — a check run left `in_progress`
 * "is never reaped by GitHub and blocks branch protection until someone deletes
 * it by hand". A section left `running` is the cosmetic version of that.
 *
 * The exit map:
 *
 * | exit | state |
 * | --- | --- |
 * | success | `complete`, carrying the rendered result |
 * | typed failure | `failed`, retaining the previous body |
 * | defect | `failed`, retaining the previous body |
 * | interrupt | `cancelled`, retaining the previous body |
 *
 * Rule 2 holds on every non-success path: the previous result is retained and
 * marked, never blanked.
 *
 * `publish` is the caller's write — a PR body update, a sticky comment — so
 * this stays independent of where sections live. Its failures are **swallowed**
 * deliberately: a finalizer that could fail on the way out would replace the
 * caller's real error with a reporting one.
 *
 * @public
 */
export const withSection = <A, E, R, R2>(
	options: {
		readonly key: string;
		readonly title: string;
		readonly sha: string;
		readonly runId: string;
		readonly now: () => string;
		/** The result to retain while re-running, and on any non-success exit. */
		readonly previousBody: string;
		readonly render: (value: A) => string;
		readonly publish: (section: Section) => Effect.Effect<void, never, R2>;
	},
	work: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R | R2> =>
	Effect.gen(function* () {
		const base = { key: options.key, title: options.title };
		const write = (state: SectionState, body: string) =>
			options.publish({
				...base,
				stamp: { state, sha: options.sha, runId: options.runId, at: options.now() },
				body,
			});

		// Acquire: BEFORE the work, retaining the previous result.
		yield* write("running", options.previousBody);

		return yield* work.pipe(
			Effect.onExit((exit) => {
				if (Exit.isSuccess(exit)) return write("complete", options.render(exit.value));
				// Interrupt is checked FIRST: an interrupted fiber's cause can carry
				// both, and "cancelled" is the more accurate report of why it stopped.
				if (Exit.hasInterrupts(exit)) return write("cancelled", options.previousBody);
				// Everything else — typed failure AND defect. A defect that left the
				// section at `running` would be indistinguishable from a job still
				// working, which is the state this whole construct exists to remove.
				return write("failed", options.previousBody);
			}),
		);
	});
