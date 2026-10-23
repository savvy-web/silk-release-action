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
			expect(result.get(key)?.reason).toBeNull();
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
			expect(result.get(key)).toEqual({ status: "skipped", waitedMs: 0, tarball: null, reason: "disabled" });
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
			expect(result.get(key)?.reason).toBe("dry-run");
			expect(reg.calls()).toBe(0);
		}),
	);

	it.effect("names dry-run, not disabled, when a dry-run also sets a ceiling of 0", () =>
		Effect.gen(function* () {
			const reg = registryAfter(0);
			const result = yield* confirmAvailability([target], { ceilingSeconds: 0, dryRun: true, npmToken: null }).pipe(
				Effect.provide(Layer.mergeAll(base, reg.layer)),
			);
			expect(result.get(key)?.reason).toBe("dry-run");
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
			expect(result.get(key)?.reason).toBeNull();
			expect(result.get(availabilityKey(null, "@savvy-web/bar", "2.0.0"))?.status).toBe("skipped");
			expect(result.get(availabilityKey(null, "@savvy-web/bar", "2.0.0"))?.reason).toBe("non-npm-registry");
			expect(result.get(availabilityKey("https://npm.pkg.github.com/", "@savvy-web/baz", "3.0.0"))?.status).toBe(
				"skipped",
			);
			expect(result.get(availabilityKey("https://npm.pkg.github.com/", "@savvy-web/baz", "3.0.0"))?.reason).toBe(
				"non-npm-registry",
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

// One line per run, on every path — including the three that probe nothing.
// Before, a run that skipped everything logged nothing, so a workflow that set
// `registry-confirm-timeout: 180` could not tell whether confirmation ran.
describe("confirmAvailability — the run summary line", () => {
	const CUSTOM = "https://registry.example.com/";
	const custom = { name: "@savvy-web/foo", version: "1.2.0", registry: CUSTOM };
	const run = (
		targets: ReadonlyArray<{ name: string; version: string; registry: string }>,
		options: { ceilingSeconds: number; dryRun: boolean },
	) =>
		Effect.gen(function* () {
			const lines: string[] = [];
			const capture = Logger.make<unknown, void>(({ message }) => {
				lines.push(Array.isArray(message) ? message.join(" ") : String(message));
			});
			yield* confirmAvailability(targets, { ...options, npmToken: null, schedule: fast }).pipe(
				Effect.provide(Layer.mergeAll(Logger.layer([capture]), ActionLogger.layerTest(), registryAfter(0).layer)),
			);
			return lines.filter((l) => l.includes("Registry confirmation"));
		});

	it.effect("says confirmation was skipped because the timeout is 0", () =>
		Effect.gen(function* () {
			const lines = yield* run([target], { ceilingSeconds: 0, dryRun: false });
			expect(lines).toHaveLength(1);
			expect(lines[0]).toMatch(/skipped/);
			expect(lines[0]).toContain("registry-confirm-timeout");
		}),
	);

	it.effect("says confirmation was skipped for a dry run", () =>
		Effect.gen(function* () {
			const lines = yield* run([target], { ceilingSeconds: 180, dryRun: true });
			expect(lines).toHaveLength(1);
			expect(lines[0]).toMatch(/dry run/);
		}),
	);

	it.effect("says why a wave with no npm target probed nothing, naming the count", () =>
		Effect.gen(function* () {
			const lines = yield* run([custom], { ceilingSeconds: 180, dryRun: false });
			expect(lines).toHaveLength(1);
			expect(lines[0]).toContain("0 confirmed");
			expect(lines[0]).toMatch(/1 skipped/);
			expect(lines[0]).toContain("registry.npmjs.org");
		}),
	);

	it.live("counts confirmed and skipped together when a wave mixes registries", () =>
		Effect.gen(function* () {
			const lines = yield* run([target, custom], { ceilingSeconds: 5, dryRun: false });
			expect(lines).toHaveLength(1);
			expect(lines[0]).toContain("1 confirmed");
			expect(lines[0]).toContain("0 held");
			expect(lines[0]).toMatch(/1 skipped/);
		}),
	);

	it.effect("says there was nothing to confirm when nothing was published", () =>
		Effect.gen(function* () {
			const lines = yield* run([], { ceilingSeconds: 180, dryRun: false });
			expect(lines).toHaveLength(1);
			expect(lines[0]).toMatch(/nothing to confirm/);
		}),
	);
});
