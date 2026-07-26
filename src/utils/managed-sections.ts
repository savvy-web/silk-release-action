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
// A marker-delimited managed-section construct is being built upstream. It has
// NOT landed in the installed kit — checked, not assumed: `@effected/github`'s
// `CommentMarker` is namespace+key for finding a WHOLE sticky comment
// (`html`/`matches`, and `PullRequestComment.upsert` replaces the entire body),
// and `@effected/markdown`'s `DocumentSection`/`firstSection` are heading-based
// READ queries. Neither is a create-or-update region. This is shaped to be
// swapped for the upstream construct when it exists.

import { Effect, Exit } from "effect";

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
	/** Stable id; also the marker name. */
	readonly key: string;
	/** Heading shown to a reader. */
	readonly title: string;
	readonly stamp: SectionStamp;
	/** The last rendered result. Retained across a recompute — see rule 2. */
	readonly body: string;
}

const start = (key: string): string => `<!-- silk-release:section:${key}:start -->`;
const end = (key: string): string => `<!-- silk-release:section:${key}:end -->`;
const STAMP_RE = /<!-- silk-release:stamp (\{.*?\}) -->/;

/**
 * Delimits the banner so a read can tell it from the body.
 *
 * @remarks
 * The banner is regenerated on every render, so it must never be mistaken for
 * retained content — a read that swallowed it would re-emit it, and the next
 * render would append another. Position alone is not enough to tell them apart:
 * it was inferred from a fixed line offset, and moving the banner below the
 * body silently broke that, duplicating it on every write.
 */
const BANNER_MARKER = "<!-- silk-release:banner -->";

/**
 * The stamp, encoded so it can be read back off a rendered body.
 *
 * @remarks
 * An HTML comment rather than a visible line: it is machinery, and a reader
 * should see the state banner instead.
 */
const encodeStamp = (stamp: SectionStamp): string => `<!-- silk-release:stamp ${JSON.stringify(stamp)} -->`;

const decodeStamp = (text: string): SectionStamp | undefined => {
	const match = STAMP_RE.exec(text);
	if (match?.[1] === undefined) return undefined;
	try {
		const parsed: unknown = JSON.parse(match[1]);
		if (parsed === null || typeof parsed !== "object") return undefined;
		const s = parsed as Partial<SectionStamp>;
		if (typeof s.state !== "string" || typeof s.sha !== "string" || typeof s.at !== "string") return undefined;
		return { state: s.state, sha: s.sha, runId: String(s.runId ?? ""), at: s.at };
	} catch {
		return undefined;
	}
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

/**
 * Render one section, markers included.
 *
 * @public
 */
export const renderSection = (section: Section, headSha: string, commitUrl?: (sha: string) => string): string =>
	[
		start(section.key),
		encodeStamp(section.stamp),
		`### ${section.title}`,
		"",
		section.body,
		"",
		// Provenance last, as a footnote. Above the content it pushed the thing a
		// reader came for below the fold on every section.
		BANNER_MARKER,
		renderBanner(section.stamp, headSha, commitUrl),
		end(section.key),
	].join("\n");

/** Every section key present in a body, in the order they appear. */
const SECTION_KEY_RE = /<!-- silk-release:section:([^:]+):start -->/g;

/**
 * Recompute every section's staleness banner against the current head.
 *
 * @remarks
 * **A banner is rendered into the text, so it freezes at write time.** A section
 * nobody rewrites keeps whatever it said when it was last written — which was
 * computed against the head *as of that run*. On a later commit, a section left
 * alone goes on claiming `✅ Up to date as of <old sha>` while the branch has
 * moved, which is a false claim rather than merely a stale one.
 *
 * Refreshing them all on any write costs nothing — the write is already a
 * whole-body rewrite — and it is what makes the stamp's promise good. It does
 * mean a write touches sections it does not own, but only their banners: each
 * section's stamp and body are re-rendered from what was already there, so no
 * other phase's content changes.
 *
 * @param body - The comment body.
 * @param headSha - The commit sections should be measured against.
 * @returns The body with every banner recomputed.
 *
 * @public
 */
export const refreshBanners = (body: string, headSha: string, commitUrl?: (sha: string) => string): string => {
	const keys = [...body.matchAll(SECTION_KEY_RE)]
		.map((match) => match[1])
		.filter((key): key is string => key !== undefined);
	return keys.reduce((acc, key) => {
		const section = readSection(acc, key);
		return section === undefined ? acc : upsertSection(acc, section, headSha, commitUrl);
	}, body);
};

/**
 * Read a section back out of a body.
 *
 * @public
 */
export const readSection = (body: string, key: string): Section | undefined => {
	const from = body.indexOf(start(key));
	const to = body.indexOf(end(key));
	if (from === -1 || to === -1 || to < from) return undefined;

	const inner = body.slice(from + start(key).length, to);
	const stamp = decodeStamp(inner);
	if (stamp === undefined) return undefined;

	// The retained result is what sits between the heading and the banner.
	// Both edges are found explicitly: the banner marker rather than a line
	// offset, so the layout can change without silently redefining "body".
	const beforeBanner = inner.includes(BANNER_MARKER) ? inner.slice(0, inner.indexOf(BANNER_MARKER)) : inner;
	const lines = beforeBanner.split("\n");
	const headingIdx = lines.findIndex((l) => l.startsWith("### "));
	const title = headingIdx === -1 ? key : (lines[headingIdx]?.slice(4) ?? key);
	const bodyStart = headingIdx === -1 ? 0 : headingIdx + 1;
	return { key, title, stamp, body: lines.slice(bodyStart).join("\n").trim() };
};

/**
 * Is `incoming` at least as recent as `existing`?
 *
 * @remarks
 * **Rule 5.** Two runs in flight, the older finishing last, must not overwrite
 * the newer one's result. `at` orders them; `runId` breaks a tie, numerically
 * when both parse and lexically otherwise. Equal stamps are allowed through so
 * a run can refine its own section.
 *
 * @public
 */
export const isAtLeastAsRecent = (incoming: SectionStamp, existing: SectionStamp): boolean => {
	if (incoming.at !== existing.at) return incoming.at >= existing.at;
	const a = Number(incoming.runId);
	const b = Number(existing.runId);
	if (Number.isFinite(a) && Number.isFinite(b) && a !== b) return a >= b;
	return incoming.runId >= existing.runId;
};

/**
 * Write `section` into `body`, replacing only its own region.
 *
 * @remarks
 * **Rules 4 and 5.** Other sections and any human prose are untouched, and an
 * older write is DROPPED rather than applied — the body comes back byte-identical
 * so a caller can skip the API call entirely.
 *
 * @public
 */
export const upsertSection = (
	body: string,
	section: Section,
	headSha: string,
	commitUrl?: (sha: string) => string,
): string => {
	const existing = readSection(body, section.key);
	if (existing !== undefined && !isAtLeastAsRecent(section.stamp, existing.stamp)) {
		return body;
	}

	const rendered = renderSection(section, headSha, commitUrl);
	const from = body.indexOf(start(section.key));
	const to = body.indexOf(end(section.key));
	if (from !== -1 && to !== -1 && to > from) {
		return `${body.slice(0, from)}${rendered}${body.slice(to + end(section.key).length)}`;
	}
	const trimmed = body.trim();
	return trimmed === "" ? rendered : `${trimmed}\n\n${rendered}`;
};

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
