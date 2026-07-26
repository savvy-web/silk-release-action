// A coalescing queue for comment-section updates.
//
// Sections are produced as work finishes — a check run resolves, a package
// finishes validating — which is bursty and unpredictable. Writing the comment
// on each one means many API calls in quick succession, several of them
// immediately superseded, and a reader watching the page see it flicker through
// intermediate states.
//
// So updates are enqueued rather than written. A background fiber waits for the
// first change, opens a window, and writes ONCE with everything that arrived
// during it. A burst of eight updates inside one window costs one API call; a
// lone update still lands a window later, which is the responsiveness the
// batching is trading against.

import type { Scope } from "effect";
import { Duration, Effect, Option, Queue, Ref } from "effect";
import type { Section } from "./managed-sections.js";
import { upsertSection } from "./managed-sections.js";

/** How long to let updates accumulate before writing. */
export const DEFAULT_WINDOW = Duration.seconds(10);

/**
 * The most a single drain will take.
 *
 * @remarks
 * A bound rather than "everything", so a pathological producer cannot make one
 * write unboundedly large. Anything beyond it is left for the next window
 * rather than dropped.
 */
const MAX_PER_DRAIN = 256;

/**
 * A queue of pending section updates.
 *
 * @public
 */
export interface SectionQueue {
	/** Record a section's new state. Returns as soon as it is queued. */
	readonly update: (section: Section) => Effect.Effect<void>;
	/**
	 * Write everything pending, now, without waiting for the window.
	 *
	 * @remarks
	 * For the point where a caller needs the comment to be current before it
	 * does something else observable — reporting a phase complete, say. The
	 * scope's finalizer calls this too, so an ordinary exit does not need it.
	 */
	readonly flush: Effect.Effect<void>;
}

/**
 * Keep only the last update per section key, preserving first-seen order.
 *
 * @remarks
 * Two updates to one key inside a window mean the earlier is already obsolete —
 * writing both would render an intermediate state that no reader asked for.
 * Order is first-seen rather than last-written so a section does not jump
 * position in the comment because it happened to be updated twice.
 */
const coalesce = (sections: ReadonlyArray<Section>): ReadonlyArray<Section> => {
	const byKey = new Map<string, Section>();
	for (const section of sections) byKey.set(section.key, section);
	return [...byKey.values()];
};

/**
 * Start a coalescing writer for one comment.
 *
 * @remarks
 * **The finalizer is the load-bearing part.** A job that ends with updates still
 * queued must write them, or the comment is left describing a state the run has
 * already moved past — which is the exact staleness this whole construct exists
 * to prevent, reintroduced by the thing meant to prevent it. `addFinalizer`
 * runs on every exit the runtime controls, including an interrupt.
 *
 * It cannot cover a process the runner kills outright (a job timeout, a
 * cancelled workflow). Nothing in-process can. That is the cost of batching,
 * and it is bounded by the window: at worst a reader sees a comment up to one
 * window stale, carrying a stamp that says so.
 *
 * A failed write is logged and dropped, not retried. The next window rewrites
 * the whole body from current state anyway, so a retry would race it — and the
 * final flush is the backstop for the last one.
 *
 * @param options - Where to write, how to read back, and how long a window is.
 * @returns The queue handle; the writer stops when the scope closes.
 *
 * @public
 */
export const makeSectionQueue = (options: {
	/** The commit the sections describe, for staleness stamping. */
	readonly headSha: string;
	/** Read the comment's current body, so a rewrite preserves its neighbours. */
	readonly read: Effect.Effect<string>;
	/** Write the assembled body. Infallible by contract — see the remarks. */
	readonly publish: (body: string) => Effect.Effect<void>;
	/** How long to accumulate. Defaults to {@link DEFAULT_WINDOW}. */
	readonly window?: Duration.Duration;
}): Effect.Effect<SectionQueue, never, Scope.Scope> =>
	Effect.gen(function* () {
		const queue = yield* Queue.unbounded<Section>();
		const window = options.window ?? DEFAULT_WINDOW;

		// Sections taken from the queue but not yet written.
		//
		// The writer takes the first change, then sleeps out the window — which
		// puts that change in neither the queue nor the comment. If the scope
		// closed there, the finalizer would drain an empty queue and the update
		// would be lost, which is precisely the data loss the finalizer exists to
		// prevent. Holding it here keeps it reachable throughout.
		const inFlight = yield* Ref.make<ReadonlyArray<Section>>([]);

		/** Fold a batch into the comment and write it once. */
		const writeBatch = (batch: ReadonlyArray<Section>) =>
			Effect.gen(function* () {
				if (batch.length === 0) return;
				const existing = yield* options.read;
				const body = coalesce(batch).reduce((acc, section) => upsertSection(acc, section, options.headSha), existing);
				yield* options.publish(body);
				yield* Effect.logDebug(`section-queue: wrote ${coalesce(batch).length} section(s)`);
			});

		/**
		 * Everything pending: what is held in flight, plus whatever is queued.
		 *
		 * @remarks
		 * Polled one at a time rather than `takeBetween(queue, 0, n)`. That reads
		 * like a non-blocking take-all and is not: `min: 0` is satisfied by taking
		 * **nothing**, so it returns `[]` against a queue with items in it —
		 * verified by probe, after it silently emptied every batch here. `poll`
		 * returns `None` only when the queue really is empty.
		 */
		const drain = Effect.gen(function* () {
			const held = yield* Ref.getAndSet(inFlight, []);
			const queued: Array<Section> = [];
			while (queued.length < MAX_PER_DRAIN) {
				const next = yield* Queue.poll(queue);
				if (Option.isNone(next)) break;
				queued.push(next.value);
			}
			return [...held, ...queued];
		});

		// Wait for a change, open the window, then write everything that arrived.
		//
		// `take` first rather than a fixed tick: an idle run should make no API
		// calls at all, and a poll loop would make one per window regardless.
		const loop = Effect.gen(function* () {
			const first = yield* Queue.take(queue);
			yield* Ref.set(inFlight, [first]);
			yield* Effect.sleep(window);
			yield* writeBatch(yield* drain);
		}).pipe(Effect.forever);

		yield* Effect.forkScoped(loop);

		// Whatever is still queued when the scope closes, written once.
		yield* Effect.addFinalizer(() => drain.pipe(Effect.flatMap(writeBatch), Effect.ignore));

		return {
			update: (section: Section) => Queue.offer(queue, section).pipe(Effect.asVoid),
			flush: drain.pipe(Effect.flatMap(writeBatch)),
		};
	});
