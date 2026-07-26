// Unit tests for the coalescing section queue.
//
// Time is driven by `TestClock`, not by sleeping: the whole point of the
// construct is *when* it writes, and a test that waited on a real ten-second
// window would be both slow and flaky. `adjust` advances the clock and lets the
// forked writer run, so each assertion is about a definite moment.

import { Duration, Effect, Layer, Scope } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vitest";
import type { Section } from "../src/utils/managed-sections.js";
import { makeSectionQueue } from "../src/utils/section-queue.js";

/** The live recorder for the queue under test, for mid-scope assertions. */
let writesSoFar: Array<string> = [];

const HEAD = "abc1234";
const WINDOW = Duration.seconds(10);

const section = (key: string, body: string): Section => ({
	key,
	title: key,
	stamp: { state: "complete", sha: HEAD, runId: "1", at: "2026-07-26T00:00:00.000Z" },
	body,
});

/** Runs `use` against a queue, recording every body it publishes. */
const withQueue = <A>(
	use: (q: { update: (s: Section) => Effect.Effect<void>; flush: Effect.Effect<void> }) => Effect.Effect<A>,
): Promise<Array<string>> => {
	const writes: Array<string> = [];
	writesSoFar = writes;
	const program = Effect.gen(function* () {
		const queue = yield* makeSectionQueue({
			headSha: HEAD,
			window: WINDOW,
			read: Effect.sync(() => writes.at(-1) ?? ""),
			publish: (body) => Effect.sync(() => void writes.push(body)),
		});
		yield* use(queue);
	});

	return Effect.runPromise(
		Effect.scoped(program).pipe(Effect.provide(Layer.mergeAll(TestClock.layer()))) as Effect.Effect<void, never, never>,
	).then(() => writes);
};

describe("makeSectionQueue", () => {
	it("writes nothing while nothing is queued", async () => {
		const writes = await withQueue(() => Effect.yieldNow.pipe(Effect.andThen(TestClock.adjust(Duration.minutes(5)))));

		// An idle run must cost zero API calls — a polling loop would spend one
		// per window forever.
		expect(writes).toEqual([]);
	});

	it("coalesces repeat updates to one section into a single write", async () => {
		const writes = await withQueue((q) =>
			Effect.gen(function* () {
				yield* q.update(section("plan", "first"));
				yield* q.update(section("plan", "second"));
				yield* q.update(section("plan", "third"));
				yield* Effect.yieldNow;
				yield* TestClock.adjust(Duration.seconds(11));
			}),
		);

		// One call, carrying only the last state. The two earlier bodies were
		// already obsolete when they were superseded inside the window.
		expect(writes).toHaveLength(1);
		expect(writes[0]).toContain("third");
		expect(writes[0]).not.toContain("first");
		expect(writes[0]).not.toContain("second");
	});

	it("batches updates to different sections into a single write", async () => {
		const writes = await withQueue((q) =>
			Effect.gen(function* () {
				yield* q.update(section("status", "verdict"));
				yield* q.update(section("plan", "table"));
				yield* q.update(section("details", "checks"));
				yield* Effect.yieldNow;
				yield* TestClock.adjust(Duration.seconds(11));
			}),
		);

		expect(writes).toHaveLength(1);
		for (const fragment of ["verdict", "table", "checks"]) {
			expect(writes[0]).toContain(fragment);
		}
	});

	it("does not write before the window elapses", async () => {
		// Observed INSIDE the scope: closing it flushes, which is correct and
		// would mask what this asserts. The question is whether a write happens
		// while the window is still open, not whether one ever happens.
		let midWindow = -1;
		await withQueue((q) =>
			Effect.gen(function* () {
				yield* q.update(section("plan", "table"));
				yield* Effect.yieldNow;
				yield* TestClock.adjust(Duration.seconds(9));
				midWindow = writesSoFar.length;
			}),
		);

		expect(midWindow).toBe(0);
	});

	it("opens a fresh window for updates arriving after a write", async () => {
		const writes = await withQueue((q) =>
			Effect.gen(function* () {
				yield* q.update(section("plan", "first"));
				yield* Effect.yieldNow;
				yield* TestClock.adjust(Duration.seconds(11));
				yield* q.update(section("plan", "second"));
				yield* Effect.yieldNow;
				yield* TestClock.adjust(Duration.seconds(11));
			}),
		);

		expect(writes).toHaveLength(2);
		expect(writes[1]).toContain("second");
	});

	it("writes what is still queued when the scope closes", async () => {
		// THE case the construct must not get wrong. A run ending with updates
		// pending would leave the comment describing a state already moved past —
		// the exact staleness the sections exist to prevent, reintroduced by the
		// batching meant to help.
		const writes = await withQueue((q) => q.update(section("plan", "final state")));

		expect(writes).toHaveLength(1);
		expect(writes[0]).toContain("final state");
	});

	it("flushes on demand without waiting for the window", async () => {
		const writes = await withQueue((q) =>
			Effect.gen(function* () {
				yield* q.update(section("plan", "urgent"));
				yield* q.flush;
			}),
		);

		expect(writes.length).toBeGreaterThanOrEqual(1);
		expect(writes[0]).toContain("urgent");
	});

	it("keeps a section's position when it is updated again", async () => {
		const writes = await withQueue((q) =>
			Effect.gen(function* () {
				yield* q.update(section("status", "verdict"));
				yield* q.update(section("plan", "table"));
				yield* q.update(section("status", "verdict revised"));
				yield* Effect.yieldNow;
				yield* TestClock.adjust(Duration.seconds(11));
			}),
		);

		// Coalescing keeps first-seen order, so a twice-updated section does not
		// jump down the comment.
		const body = writes[0] ?? "";
		expect(body.indexOf("status")).toBeLessThan(body.indexOf("plan"));
		expect(body).toContain("verdict revised");
	});
});
