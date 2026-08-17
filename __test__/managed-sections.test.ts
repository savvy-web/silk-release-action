// Tests for per-section staleness state.
//
// Rules 1, 2 and 5 are the ones that carry the feature. Each has a mutation
// recorded against it in the report: reorder the `running` write to after the
// work (rule 1), blank instead of retaining (rule 2), drop the monotonic guard
// (rule 5).

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { Section, SectionStamp } from "../src/utils/managed-sections.js";
import {
	isAtLeastAsRecent,
	readSection,
	refreshBanners,
	renderBanner,
	renderSection,
	upsertSection,
	withSection,
} from "../src/utils/managed-sections.js";

const HEAD = "abc1234def5678";
const OLD_SHA = "0000111222333";

const stamp = (over: Partial<SectionStamp> = {}): SectionStamp => ({
	state: "complete",
	sha: HEAD,
	runId: "100",
	at: "2026-07-26T12:00:00.000Z",
	...over,
});

const section = (over: Partial<Section> = {}): Section => ({
	key: "build-validation",
	title: "Build Validation",
	stamp: stamp(),
	body: "3 packages built.",
	...over,
});

describe("rule 3 — the sha detects staleness independent of state", () => {
	it("reports a complete section as out of date when the branch has moved", () => {
		const banner = renderBanner(stamp({ state: "complete", sha: OLD_SHA }), HEAD);
		expect(banner).toContain("Out of date");
		expect(banner).toContain("0000111");
		expect(banner).toContain("abc1234");
	});

	it("reports a complete section at the head as up to date", () => {
		expect(renderBanner(stamp({ state: "complete", sha: HEAD }), HEAD)).toContain("Up to date");
	});

	it("still flags staleness for a run that died at `running` — no terminal state was ever written", () => {
		// The case a state field alone cannot express: the section says `running`
		// forever, and only the sha reveals it describes an older commit.
		const banner = renderBanner(stamp({ state: "running", sha: OLD_SHA }), HEAD);
		expect(banner).toContain("may be out of date");
		expect(banner).toContain("0000111");
	});

	it("distinguishes failed from skipped", () => {
		const failed = renderBanner(stamp({ state: "failed" }), HEAD);
		const skipped = renderBanner(stamp({ state: "skipped" }), HEAD);
		expect(failed).toContain("Failed");
		expect(skipped).toContain("Skipped");
		expect(failed).not.toBe(skipped);
	});
});

describe("rule 4 — sections are independent", () => {
	it("rewrites only its own region, leaving neighbours and human prose intact", () => {
		const human = "Reviewer note: hold until Friday.";
		let body = upsertSection(human, section({ key: "a", title: "A", body: "result A" }), HEAD);
		body = upsertSection(body, section({ key: "b", title: "B", body: "result B" }), HEAD);

		const updated = upsertSection(
			body,
			section({ key: "a", title: "A", body: "result A v2", stamp: stamp({ at: "2026-07-26T13:00:00.000Z" }) }),
			HEAD,
		);

		expect(updated).toContain("Reviewer note: hold until Friday.");
		expect(readSection(updated, "a")?.body).toContain("result A v2");
		expect(readSection(updated, "b")?.body).toContain("result B");
	});

	it("round-trips a section through render and read", () => {
		const body = upsertSection("", section(), HEAD);
		const back = readSection(body, "build-validation");
		expect(back?.stamp.state).toBe("complete");
		expect(back?.stamp.sha).toBe(HEAD);
		expect(back?.body).toContain("3 packages built.");
	});
});

describe("stamp decoding validates the state", () => {
	// A stamp is machine-written, but it lives in a PR body anyone can edit. A
	// state outside the known six used to pass straight through `decodeStamp`
	// and fall into `renderBanner`'s fallback arm, which rendered the garbled
	// value as "Up to date" — a false claim about unreadable data.

	it("drops a stamp whose state is not one of the known six", () => {
		const garbled = upsertSection("", section(), HEAD).replace('state="complete"', 'state="garbled"');

		expect(readSection(garbled, "build-validation")).toBeUndefined();
	});

	it("leaves a region with an unreadable stamp alone on a banner refresh, instead of claiming it is up to date", () => {
		const garbled = upsertSection("", section(), HEAD).replace('state="complete"', 'state="garbled"');

		expect(refreshBanners(garbled, HEAD)).toBe(garbled);
	});

	it("lets a fresh write replace a region whose stamp is unreadable", () => {
		// The monotonic guard compares stamps; with no readable existing stamp
		// there is nothing to be older than, so the write proceeds — the garbled
		// region is recovered rather than wedged.
		const garbled = upsertSection("", section(), HEAD).replace('state="complete"', 'state="garbled"');

		const replaced = upsertSection(garbled, section({ body: "fresh result" }), HEAD);

		expect(readSection(replaced, "build-validation")?.body).toContain("fresh result");
	});
});

describe("rule 5 — writes are monotonic", () => {
	it("drops a write whose stamp is OLDER than what is already there", () => {
		const newer = upsertSection("", section({ body: "newer", stamp: stamp({ at: "2026-07-26T13:00:00.000Z" }) }), HEAD);

		const attempted = upsertSection(
			newer,
			section({ body: "older — a slow run finishing last", stamp: stamp({ at: "2026-07-26T12:00:00.000Z" }) }),
			HEAD,
		);

		// Byte-identical: the caller can skip the API call entirely.
		expect(attempted).toBe(newer);
		expect(attempted).toContain("newer");
		expect(attempted).not.toContain("a slow run finishing last");
	});

	it("accepts a write that is newer", () => {
		const first = upsertSection("", section({ body: "first" }), HEAD);
		const second = upsertSection(
			first,
			section({ body: "second", stamp: stamp({ at: "2026-07-26T13:00:00.000Z" }) }),
			HEAD,
		);
		expect(second).toContain("second");
		expect(second).not.toContain("first");
	});

	it("breaks an equal-timestamp tie on the numeric run id", () => {
		expect(isAtLeastAsRecent(stamp({ runId: "101" }), stamp({ runId: "100" }))).toBe(true);
		expect(isAtLeastAsRecent(stamp({ runId: "99" }), stamp({ runId: "100" }))).toBe(false);
		// Lexically "99" > "100"; numerically it is not. The comparison must be numeric.
		expect(isAtLeastAsRecent(stamp({ runId: "99" }), stamp({ runId: "100" }))).not.toBe("99" >= "100");
	});
});

describe("rules 1 and 2 — `running` is written BEFORE the work, and the prior result is retained", () => {
	const capture = () => {
		const writes: Array<{ state: string; body: string; at: string }> = [];
		const publish = (s: Section) =>
			Effect.sync(() => {
				writes.push({ state: s.stamp.state, body: s.body, at: s.stamp.at });
			});
		return { writes, publish };
	};

	let tick = 0;
	const now = () => `2026-07-26T12:00:0${tick++}.000Z`;

	it.effect("publishes `running` before the work runs, and `complete` after", () =>
		Effect.gen(function* () {
			tick = 0;
			const { writes, publish } = capture();
			const order: string[] = [];

			yield* withSection(
				{
					key: "build-validation",
					title: "Build Validation",
					sha: HEAD,
					runId: "100",
					now,
					previousBody: "PREVIOUS RESULT",
					render: (v: string) => v,
					publish: (s) => {
						order.push(`publish:${s.stamp.state}`);
						return publish(s);
					},
				},
				Effect.sync(() => {
					order.push("work");
					return "NEW RESULT";
				}),
			);

			// THE load-bearing assertion. If the `running` write moves to after the
			// work, the stale window survives and the feature is decorative.
			expect(order).toEqual(["publish:running", "work", "publish:complete"]);
			expect(writes.map((w) => w.state)).toEqual(["running", "complete"]);
		}),
	);

	it.effect("retains the PREVIOUS result while running — it does not blank", () =>
		Effect.gen(function* () {
			tick = 0;
			const { writes, publish } = capture();

			yield* withSection(
				{
					key: "build-validation",
					title: "Build Validation",
					sha: HEAD,
					runId: "100",
					now,
					previousBody: "PREVIOUS RESULT",
					render: (v: string) => v,
					publish,
				},
				Effect.succeed("NEW RESULT"),
			);

			expect(writes[0]?.state).toBe("running");
			expect(writes[0]?.body).toBe("PREVIOUS RESULT");
			expect(writes[0]?.body).not.toBe("");
			expect(writes[1]?.body).toBe("NEW RESULT");
		}),
	);

	const runWith = <A, E>(work: Effect.Effect<A, E>) =>
		Effect.gen(function* () {
			tick = 0;
			const { writes, publish } = capture();
			const exit = yield* Effect.exit(
				withSection(
					{
						key: "build-validation",
						title: "Build Validation",
						sha: HEAD,
						runId: "100",
						now,
						previousBody: "PREVIOUS RESULT",
						render: (v: unknown) => String(v),
						publish,
					},
					work,
				),
			);
			return { writes, exit };
		});

	// ─── the exit paths ────────────────────────────────────────────────────
	// A `tap`/`tapError` pair fires on success and typed failure ONLY. These
	// three are what force an exit-aware finalizer instead: a section left at
	// `running` reads as "in progress" forever, which is the most misleading
	// state of the six.

	it.effect("TYPED FAILURE → the section reads `failed`, never `running`", () =>
		Effect.gen(function* () {
			const { writes, exit } = yield* runWith(Effect.fail("boom" as const));

			expect(exit._tag).toBe("Failure");
			expect(writes.map((w) => w.state)).toEqual(["running", "failed"]);
			expect(writes[1]?.body).toBe("PREVIOUS RESULT");
		}),
	);

	it.effect("DEFECT → the section reads `failed`, never `running`", () =>
		Effect.gen(function* () {
			// A `tapError` never sees this.
			const { writes, exit } = yield* runWith(Effect.die(new Error("unexpected")));

			expect(exit._tag).toBe("Failure");
			expect(writes.map((w) => w.state)).toEqual(["running", "failed"]);
			expect(writes[1]?.body).toBe("PREVIOUS RESULT");
		}),
	);

	it.effect("INTERRUPT → the section reads `cancelled`, never `running`", () =>
		Effect.gen(function* () {
			// THE mutation target. Neither `tap` nor `tapError` fires here, so a
			// `tap`/`tapError` implementation leaves the section at `running` and this
			// test dies — which is the whole point of the bracket.
			const { writes, exit } = yield* runWith(Effect.interrupt);

			expect(exit._tag).toBe("Failure");
			expect(writes.map((w) => w.state)).toEqual(["running", "cancelled"]);
			expect(writes[1]?.body).toBe("PREVIOUS RESULT");
		}),
	);

	it("renders `cancelled` distinctly from `failed`", () => {
		const cancelled = renderBanner(stamp({ state: "cancelled" }), HEAD);
		const failed = renderBanner(stamp({ state: "failed" }), HEAD);
		expect(cancelled).toContain("Cancelled");
		expect(cancelled).not.toBe(failed);
	});
});

describe("refreshBanners", () => {
	const at = (state: "complete" | "pending", sha: string, at: string) => ({ state, sha, runId: "1", at });
	const sec = (key: string, sha: string, when: string) => ({
		key,
		title: key,
		stamp: at("complete", sha, when),
		body: `${key} body`,
	});

	it("marks a section stale once the branch moves past its sha", () => {
		// Written when `old1234` was head…
		const body = upsertSection("", sec("plan", "old1234", "2026-01-01T00:00:00.000Z"), "old1234");
		expect(body).toContain("Up to date");

		// …and the branch has since moved. Left alone, the section goes on
		// claiming it is current — a false statement, not merely an old one.
		const refreshed = refreshBanners(body, "new5678");
		expect(refreshed).not.toContain("Up to date");
	});

	it("refreshes every section, not just the one last written", () => {
		let body = upsertSection("", sec("a", "old1234", "2026-01-01T00:00:00.000Z"), "old1234");
		body = upsertSection(body, sec("b", "old1234", "2026-01-01T00:00:00.000Z"), "old1234");

		const refreshed = refreshBanners(body, "new5678");

		// Both banners recomputed — the bug was that only the written one was.
		expect(refreshed.match(/Up to date/g)).toBeNull();
		expect(refreshed).toContain("a body");
		expect(refreshed).toContain("b body");
	});

	it("leaves each section's stamp and body untouched", () => {
		const body = upsertSection("", sec("plan", "old1234", "2026-01-01T00:00:00.000Z"), "old1234");
		const refreshed = refreshBanners(body, "new5678");

		// Only the banner is recomputed; a refresh must not rewrite another
		// phase's content or advance its stamp.
		expect(refreshed).toContain('sha="old1234"');
		expect(refreshed).toContain("plan body");
	});

	it("is a no-op on a body with no sections", () => {
		expect(refreshBanners("just prose", "new5678")).toBe("just prose");
	});
});

// ─── Issue #258: the one-shot wire-format migration ───────────────────────────
//
// The kit's region scanner does not see the old `silk-release:section:<key>`
// markers and preserves them as prose, so a swap without a conversion would
// leave every open release PR carrying orphan regions nothing updates, plus a
// fresh set appended below them.
describe("legacy wire-format migration", () => {
	const legacy = (key: string, title: string, body: string, over: Partial<SectionStamp> = {}): string =>
		[
			`<!-- silk-release:section:${key}:start -->`,
			`<!-- silk-release:stamp ${JSON.stringify(stamp(over))} -->`,
			`### ${title}`,
			"",
			body,
			"",
			"<!-- silk-release:banner:start -->",
			"<sub>Up to date as of `abc1234`</sub>",
			"<!-- silk-release:banner:end -->",
			`<!-- silk-release:section:${key}:end -->`,
		].join("\n");

	it("carries a legacy section's title, body and stamp into the new format", () => {
		const migrated = refreshBanners(legacy("release-plan", "What will be released", "@scope/a 1.0.0 → 1.1.0"), HEAD);

		expect(migrated).toContain("silk-release.sections.release-plan ");
		expect(migrated).not.toContain("silk-release:section:release-plan:start");
		expect(migrated).not.toContain("silk-release:stamp");

		const back = readSection(migrated, "release-plan");
		expect(back?.title).toBe("What will be released");
		expect(back?.body).toContain("@scope/a 1.0.0 → 1.1.0");
		expect(back?.stamp.sha).toBe(HEAD);
		expect(back?.stamp.runId).toBe("100");
	});

	it("is idempotent — a second pass changes nothing", () => {
		const once = refreshBanners(legacy("release-plan", "Plan", "the plan"), HEAD);
		expect(refreshBanners(once, HEAD)).toBe(once);
	});

	it("does not duplicate the banner it converted", () => {
		const migrated = refreshBanners(legacy("release-plan", "Plan", "the plan"), HEAD);

		// The legacy banner was regenerated on every render, so carrying it into
		// the body would have re-emitted it AND rendered a fresh one beside it.
		expect(migrated.match(/Up to date as of/g)).toHaveLength(1);
	});

	it("preserves human prose on both sides of a legacy region", () => {
		const body = `Above.\n\n${legacy("release-plan", "Plan", "the plan")}\n\nBelow.`;
		const migrated = upsertSection(body, section(), HEAD);

		expect(migrated).toContain("Above.");
		expect(migrated).toContain("Below.");
		expect(migrated).toContain("the plan");
	});

	it("reads a section that is still in the legacy format", () => {
		// Rule 2 depends on this: the retained previous body is read off the live
		// comment, so a mid-flight release PR whose sections have not been
		// converted yet must not read as an absent section and blank on the next
		// write.
		const back = readSection(legacy("release-plan", "Plan", "the previous result"), "release-plan");

		expect(back?.body).toContain("the previous result");
		expect(back?.stamp.state).toBe("complete");
	});

	it("converts a neighbour it does not own, rather than dropping it", () => {
		const body = legacy("release-plan", "Plan", "someone else's section");
		const migrated = upsertSection(body, section(), HEAD);

		// The write owns `build-validation`; `release-plan` belongs to another
		// phase. Migration must carry it across, because no single run writes
		// every section — the first run after the swap would otherwise delete the
		// two it does not own.
		expect(migrated).toContain("someone else's section");
		expect(readSection(migrated, "build-validation")?.body).toContain("3 packages built.");
	});

	it("leaves a legacy region whose stamp will not decode exactly where it is", () => {
		// It carries no readable provenance, so this module cannot manage it —
		// which is not a licence to delete it. A hand-written or truncated region
		// survives as prose.
		const orphan =
			"<!-- silk-release:section:mystery:start -->\nhand-written\n<!-- silk-release:section:mystery:end -->";
		const migrated = upsertSection(`Prose.\n\n${orphan}`, section(), HEAD);

		expect(migrated).toContain("hand-written");
		expect(migrated).toContain("silk-release:section:mystery:start");
	});

	it("still migrates when the incoming write is dropped as stale", () => {
		// Rule 5 withholds the stale run's RESULT, not the wire-format conversion
		// the document needs regardless of who is writing.
		const body = legacy("release-plan", "Plan", "the newer run's result", { at: "2026-08-01T00:00:00.000Z" });
		const older: Section = {
			key: "release-plan",
			title: "Plan",
			stamp: stamp({ at: "2026-01-01T00:00:00.000Z" }),
			body: "the older run's result",
		};
		const migrated = upsertSection(body, older, HEAD);

		expect(migrated).toContain("silk-release.sections.release-plan ");
		expect(migrated).toContain("the newer run's result");
		expect(migrated).not.toContain("the older run's result");
	});
});

// ─── Issue #258, work item 4: the comparator's two post-handoff refinements ───
describe("rule 5 — delegated to the kit's comparator", () => {
	it('orders a blank runId lexically, not as Number("") === 0', () => {
		// The refinement the local comparator lacked: `Number("")` is `0`, which
		// made a blank runId outrank every real one at the same instant.
		const blank = stamp({ runId: "", at: "2026-07-26T12:00:00.000Z" });
		const real = stamp({ runId: "100", at: "2026-07-26T12:00:00.000Z" });

		expect(isAtLeastAsRecent(blank, real)).toBe(false);
		expect(isAtLeastAsRecent(real, blank)).toBe(true);
	});

	it("compares `at` as an instant, so offset spellings of one time order correctly", () => {
		// Same instant, two spellings. A lexical compare calls the Z form older.
		const utc = stamp({ at: "2026-07-26T12:00:00.000Z" });
		const offset = stamp({ at: "2026-07-26T14:00:00.000+02:00" });

		expect(isAtLeastAsRecent(utc, offset)).toBe(true);
		expect(isAtLeastAsRecent(offset, utc)).toBe(true);
	});

	it("lets a run refine its own section", () => {
		expect(isAtLeastAsRecent(stamp(), stamp())).toBe(true);
	});
});

describe("the banner suffix is reserved", () => {
	it("refuses a section key that would collide with a neighbour's banner", () => {
		// `<key>-banner` is where a section's banner region lives, so a section
		// named that way would silently overwrite one.
		expect(() => renderSection(section({ key: "plan-banner" }), HEAD)).toThrow(/reserved/);
	});
});
