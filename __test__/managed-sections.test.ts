// Tests for per-section staleness state.
//
// Rules 1, 2 and 5 are the ones that carry the feature. Each has a mutation
// recorded against it in the report: reorder the `running` write to after the
// work (rule 1), blank instead of retaining (rule 2), drop the monotonic guard
// (rule 5).

import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { Section, SectionStamp } from "../src/utils/managed-sections.js";
import {
	isAtLeastAsRecent,
	readSection,
	renderBanner,
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

	it("publishes `running` before the work runs, and `complete` after", async () => {
		tick = 0;
		const { writes, publish } = capture();
		const order: string[] = [];

		await Effect.runPromise(
			withSection(
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
			),
		);

		// THE load-bearing assertion. If the `running` write moves to after the
		// work, the stale window survives and the feature is decorative.
		expect(order).toEqual(["publish:running", "work", "publish:complete"]);
		expect(writes.map((w) => w.state)).toEqual(["running", "complete"]);
	});

	it("retains the PREVIOUS result while running — it does not blank", async () => {
		tick = 0;
		const { writes, publish } = capture();

		await Effect.runPromise(
			withSection(
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
			),
		);

		expect(writes[0]?.state).toBe("running");
		expect(writes[0]?.body).toBe("PREVIOUS RESULT");
		expect(writes[0]?.body).not.toBe("");
		expect(writes[1]?.body).toBe("NEW RESULT");
	});

	const runWith = async <A, E>(work: Effect.Effect<A, E>) => {
		tick = 0;
		const { writes, publish } = capture();
		const exit = await Effect.runPromiseExit(
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
	};

	// ─── the exit paths ────────────────────────────────────────────────────
	// A `tap`/`tapError` pair fires on success and typed failure ONLY. These
	// three are what force an exit-aware finalizer instead: a section left at
	// `running` reads as "in progress" forever, which is the most misleading
	// state of the six.

	it("TYPED FAILURE → the section reads `failed`, never `running`", async () => {
		const { writes, exit } = await runWith(Effect.fail("boom" as const));

		expect(exit._tag).toBe("Failure");
		expect(writes.map((w) => w.state)).toEqual(["running", "failed"]);
		expect(writes[1]?.body).toBe("PREVIOUS RESULT");
	});

	it("DEFECT → the section reads `failed`, never `running`", async () => {
		// A `tapError` never sees this.
		const { writes, exit } = await runWith(Effect.die(new Error("unexpected")));

		expect(exit._tag).toBe("Failure");
		expect(writes.map((w) => w.state)).toEqual(["running", "failed"]);
		expect(writes[1]?.body).toBe("PREVIOUS RESULT");
	});

	it("INTERRUPT → the section reads `cancelled`, never `running`", async () => {
		// THE mutation target. Neither `tap` nor `tapError` fires here, so a
		// `tap`/`tapError` implementation leaves the section at `running` and this
		// test dies — which is the whole point of the bracket.
		const { writes, exit } = await runWith(Effect.interrupt);

		expect(exit._tag).toBe("Failure");
		expect(writes.map((w) => w.state)).toEqual(["running", "cancelled"]);
		expect(writes[1]?.body).toBe("PREVIOUS RESULT");
	});

	it("renders `cancelled` distinctly from `failed`", () => {
		const cancelled = renderBanner(stamp({ state: "cancelled" }), HEAD);
		const failed = renderBanner(stamp({ state: "failed" }), HEAD);
		expect(cancelled).toContain("Cancelled");
		expect(cancelled).not.toBe(failed);
	});
});
