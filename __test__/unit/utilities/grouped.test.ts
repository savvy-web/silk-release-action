/**
 * Unit tests for the nesting-aware log-group wrapper.
 *
 * @remarks
 * GitHub Actions has no nested groups: a second `##[group]` implicitly closes
 * the open one, so the outer group renders as an empty header and its
 * `##[endgroup]` lands stray. The kit's `ActionLogger.group` does not track
 * nesting (spencerbeggs/effected#1059), so `grouped` does. These cases record
 * every `group` call through an `ActionLogger.layerTest` override and capture
 * `Effect.log*` lines through a custom `Logger`, then assert on the pairs.
 */

import { describe, expect, it } from "@effect/vitest";
import { ActionLogger } from "@effected/github-actions";
import { Effect, Logger } from "effect";
import { grouped, headed } from "../../../src/utils/grouped.js";

interface Recording {
	readonly events: string[];
	readonly provide: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, Exclude<R, ActionLogger>>;
}

const record = (): Recording => {
	const events: string[] = [];
	const layer = ActionLogger.layerTest({
		group: (name, effect) =>
			Effect.sync(() => events.push(`group:${name}`)).pipe(
				Effect.andThen(effect),
				Effect.ensuring(Effect.sync(() => events.push(`endgroup:${name}`))),
			),
	});
	const capture = Logger.make<unknown, void>(({ message }) => {
		events.push(`log:${Array.isArray(message) ? message.join(" ") : String(message)}`);
	});
	return {
		events,
		provide: (effect) => effect.pipe(Effect.provide(layer), Effect.provide(Logger.layer([capture]))),
	};
};

describe("grouped", () => {
	it.effect("opens a group when none is open", () =>
		Effect.gen(function* () {
			const rec = record();
			yield* rec.provide(grouped("Build", Effect.logInfo("built")));
			expect(rec.events).toEqual(["group:Build", "log:built", "endgroup:Build"]);
		}),
	);

	it.effect("emits exactly one group pair when nested, and a plain header for the inner name", () =>
		Effect.gen(function* () {
			const rec = record();
			yield* rec.provide(grouped("Outer", grouped("Inner", Effect.logInfo("body"))));
			expect(rec.events.filter((e) => e.startsWith("group:"))).toEqual(["group:Outer"]);
			expect(rec.events.filter((e) => e.startsWith("endgroup:"))).toEqual(["endgroup:Outer"]);
			const header = rec.events.findIndex((e) => e.startsWith("log:") && e.includes("Inner"));
			expect(header).toBeGreaterThan(0);
			expect(rec.events.indexOf("log:body")).toBeGreaterThan(header);
		}),
	);

	it.effect("opens a fresh group again after the previous one has closed", () =>
		Effect.gen(function* () {
			const rec = record();
			yield* rec.provide(Effect.andThen(grouped("A", Effect.void), grouped("B", Effect.void)));
			expect(rec.events).toEqual(["group:A", "endgroup:A", "group:B", "endgroup:B"]);
		}),
	);

	it.effect("returns the body's value through both the group and the nested path", () =>
		Effect.gen(function* () {
			const rec = record();
			const value = yield* rec.provide(grouped("Outer", grouped("Inner", Effect.succeed(42))));
			expect(value).toBe(42);
		}),
	);
});

describe("headed", () => {
	it.effect("prints a header line and opens no group, so inner groups are top level", () =>
		Effect.gen(function* () {
			const rec = record();
			yield* rec.provide(headed("Phase 3: Publishing", grouped("Publish · a@1.0.0", Effect.logInfo("up"))));
			expect(rec.events[0]).toMatch(/^log:.*Phase 3: Publishing/);
			expect(rec.events.slice(1)).toEqual(["group:Publish · a@1.0.0", "log:up", "endgroup:Publish · a@1.0.0"]);
		}),
	);
});
