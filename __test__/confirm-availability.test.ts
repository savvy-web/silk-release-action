/**
 * `confirmAvailability` — the bounded post-publish registry probe (issue #301).
 *
 * @remarks
 * The time-driving cases run under `it.live`, NOT `it.effect`: `it.effect`
 * installs a virtual `TestClock`, under which the retry cadence and the
 * ceiling never advance and the test hangs to the Vitest timeout
 * (`__test__/CLAUDE.effect-vitest.md`, "Time and `it.effect` do not mix").
 * The schedule is injectable so the cadence is one millisecond, and the
 * `held` case uses a sub-second ceiling — real time, but tens of milliseconds
 * of it. The `calls()` counts are the discriminators: every case pins how many
 * registry reads happened, so a probe that skipped, looped or stopped early
 * goes red.
 *
 * `it.live` provides no `TestConsole`, so `Logger.layer([])` keeps the step's
 * log lines out of the reporter. The npm token is an option, not an input
 * read (see the module remarks), so no `ActionInput` layer is needed.
 */

import { describe, expect, it } from "@effect/vitest";
import { ActionLogger } from "@effected/github-actions";
import { NpmRegistry, PublishedVersion, RegistryReadError } from "@effected/npm";
import { Effect, Layer, Logger, Option, Schedule } from "effect";
import { availabilityKey } from "../src/release/types.js";
import { confirmAvailability } from "../src/steps/confirm-availability.js";

const NPM = "https://registry.npmjs.org/";
const target = { name: "@savvy-web/foo", version: "1.2.0", registry: NPM };
const key = availabilityKey(NPM, "@savvy-web/foo", "1.2.0");

/** A registry that answers None `misses` times, then Some with a tarball. */
const registryAfter = (misses: number) => {
	let calls = 0;
	const layer = NpmRegistry.layerTest({
		version: (name, version) =>
			Effect.sync(() => {
				calls += 1;
				return calls > misses
					? Option.some(PublishedVersion.make({ name, version, tarball: `${NPM}${name}/-/foo-${version}.tgz` }))
					: Option.none();
			}),
	});
	return { layer, calls: () => calls };
};

const fast = Schedule.spaced("1 millis");
const base = Layer.mergeAll(Logger.layer([]), ActionLogger.layerTest());

describe("confirmAvailability", () => {
	it.live("confirms a version that resolves after a few misses and records the tarball", () =>
		Effect.gen(function* () {
			const reg = registryAfter(2);
			const result = yield* confirmAvailability([target], {
				ceilingSeconds: 5,
				dryRun: false,
				npmToken: null,
				schedule: fast,
			}).pipe(Effect.provide(Layer.mergeAll(base, reg.layer)));
			const entry = result.get(key);
			expect(entry?.status).toBe("confirmed");
			expect(entry?.tarball).toBe(`${NPM}@savvy-web/foo/-/foo-1.2.0.tgz`);
			expect(entry?.waitedMs).toBeGreaterThanOrEqual(0);
			expect(reg.calls()).toBe(3);
		}),
	);

	it.live("reports held — not failed — when the ceiling elapses first", () =>
		Effect.gen(function* () {
			const reg = registryAfter(Number.POSITIVE_INFINITY);
			// Real clock, tiny ceiling: `ceilingSeconds` is whole seconds in
			// production; the step converts it to a Duration internally so a test
			// can pass a sub-second value.
			const result = yield* confirmAvailability([target], {
				ceilingSeconds: 0.05,
				dryRun: false,
				npmToken: null,
				schedule: fast,
			}).pipe(Effect.provide(Layer.mergeAll(base, reg.layer)));
			expect(result.get(key)?.status).toBe("held");
			expect(result.get(key)?.tarball).toBeNull();
			expect(result.get(key)?.waitedMs).toBeGreaterThan(0);
			expect(reg.calls()).toBeGreaterThan(1);
		}),
	);

	it.live("treats a registry read error as a miss and keeps polling", () =>
		Effect.gen(function* () {
			let calls = 0;
			const layer = NpmRegistry.layerTest({
				version: (name, version) =>
					Effect.suspend(() => {
						calls += 1;
						return calls === 1
							? Effect.fail(new RegistryReadError({ kind: "transport", package: name, registry: NPM }))
							: Effect.succeed(Option.some(PublishedVersion.make({ name, version })));
					}),
			});
			const result = yield* confirmAvailability([target], {
				ceilingSeconds: 5,
				dryRun: false,
				npmToken: null,
				schedule: fast,
			}).pipe(Effect.provide(Layer.mergeAll(base, layer)));
			expect(result.get(key)?.status).toBe("confirmed");
			// No tarball reported → null, still confirmed.
			expect(result.get(key)?.tarball).toBeNull();
			expect(calls).toBe(2);
		}),
	);

	it.effect("skips every target without a registry call when the ceiling is 0", () =>
		Effect.gen(function* () {
			const reg = registryAfter(0);
			const result = yield* confirmAvailability([target], { ceilingSeconds: 0, dryRun: false, npmToken: null }).pipe(
				Effect.provide(Layer.mergeAll(base, reg.layer)),
			);
			expect(result.get(key)).toEqual({ status: "skipped", waitedMs: 0, tarball: null });
			expect(reg.calls()).toBe(0);
		}),
	);

	it.effect("skips every target in dry-run", () =>
		Effect.gen(function* () {
			const reg = registryAfter(0);
			const result = yield* confirmAvailability([target], { ceilingSeconds: 180, dryRun: true, npmToken: null }).pipe(
				Effect.provide(Layer.mergeAll(base, reg.layer)),
			);
			expect(result.get(key)?.status).toBe("skipped");
			expect(reg.calls()).toBe(0);
		}),
	);

	it.live("skips non-npm targets and probes npm ones, concurrently", () =>
		Effect.gen(function* () {
			const reg = registryAfter(0);
			const jsr = { name: "@savvy-web/bar", version: "2.0.0", registry: null };
			const ghp = { name: "@savvy-web/baz", version: "3.0.0", registry: "https://npm.pkg.github.com/" };
			const result = yield* confirmAvailability([target, jsr, ghp], {
				ceilingSeconds: 5,
				dryRun: false,
				npmToken: null,
				schedule: fast,
			}).pipe(Effect.provide(Layer.mergeAll(base, reg.layer)));
			expect(result.get(key)?.status).toBe("confirmed");
			expect(result.get(availabilityKey(null, "@savvy-web/bar", "2.0.0"))?.status).toBe("skipped");
			expect(result.get(availabilityKey("https://npm.pkg.github.com/", "@savvy-web/baz", "3.0.0"))?.status).toBe(
				"skipped",
			);
			expect(result.size).toBe(3);
			expect(reg.calls()).toBe(1);
		}),
	);

	it.live("probes anonymously when the token is empty — the runner's spelling of unset", () =>
		Effect.gen(function* () {
			const seen: Array<string | undefined> = [];
			const layer = NpmRegistry.layerTest({
				version: (name, version, t) =>
					Effect.sync(() => {
						seen.push(t?.credential?.kind);
						return Option.some(PublishedVersion.make({ name, version }));
					}),
			});
			yield* confirmAvailability([target], { ceilingSeconds: 5, dryRun: false, npmToken: "", schedule: fast }).pipe(
				Effect.provide(Layer.mergeAll(base, layer)),
			);
			expect(seen).toEqual([undefined]);
		}),
	);

	it.live("passes the npm token through as a credential when one is supplied", () =>
		Effect.gen(function* () {
			const seen: Array<string | undefined> = [];
			const layer = NpmRegistry.layerTest({
				version: (name, version, t) =>
					Effect.sync(() => {
						seen.push(t?.credential?.kind);
						return Option.some(PublishedVersion.make({ name, version }));
					}),
			});
			yield* confirmAvailability([target], {
				ceilingSeconds: 5,
				dryRun: false,
				npmToken: "npm_secret",
				schedule: fast,
			}).pipe(Effect.provide(Layer.mergeAll(base, layer)));
			expect(seen).toEqual(["token"]);
		}),
	);
});
