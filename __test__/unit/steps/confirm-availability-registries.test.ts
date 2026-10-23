/**
 * `confirmAvailability` beyond registry.npmjs.org — GitHub Packages and custom
 * registries, read with the credential the publish used.
 *
 * @remarks
 * The double is a small layer over the `NpmRegistry` service interface,
 * because the kit's `layerSeeded` ignores `credential`: it cannot say "this
 * registry answers 401 without a token". {@link authRegistry} wraps
 * `makeSeeded` with exactly that rule and records every read, so each case
 * pins the number of reads and the credential each one carried — a probe that
 * went anonymous, retried a denial, or used the wrong token goes red.
 *
 * Time-driving cases run under `it.live` with a one-millisecond schedule and
 * fractional ceilings, as `__test__/confirm-availability.test.ts` does;
 * `it.effect`'s virtual clock would never let a ceiling elapse.
 */

import { describe, expect, it } from "@effect/vitest";
import { ActionLogger } from "@effected/github-actions";
import type { RegistrySeed } from "@effected/npm";
import { NpmRegistry, RegistryReadError } from "@effected/npm";
import { Effect, Layer, Logger, Option, Redacted, Schedule } from "effect";
import { availabilityKey } from "../../../src/release/types.js";
import type { ConfirmAvailabilityOptions } from "../../../src/steps/confirm-availability.js";
import { confirmAvailability, noHoldCeilingMs } from "../../../src/steps/confirm-availability.js";
import type { CustomRegistryAuth } from "../../../src/utils/custom-registries.js";

const NPM = "https://registry.npmjs.org/";
const GHP = "https://npm.pkg.github.com/";
const PNPR = "https://registry.savvyweb.systems/";

const npmTarget = { name: "@savvy-web/foo", version: "1.2.0", registry: NPM };
const ghpTarget = { name: "@savvy-web/foo", version: "1.2.0", registry: GHP };
const pnprTarget = { name: "@savvy-web/foo", version: "1.2.0", registry: PNPR };
const jsrTarget = { name: "@savvy-web/foo", version: "1.2.0", registry: null };
const keyOf = (t: { registry: string | null; name: string; version: string }) =>
	availabilityKey(t.registry, t.name, t.version);

const seededEverywhere: RegistrySeed = {
	registries: {
		[NPM]: { "@savvy-web/foo": { "1.2.0": { tarball: `${NPM}@savvy-web/foo/-/foo-1.2.0.tgz` } } },
		[GHP]: { "@savvy-web/foo": { "1.2.0": { tarball: `${GHP}download/@savvy-web/foo/1.2.0/abc` } } },
		[PNPR]: { "@savvy-web/foo": { "1.2.0": { tarball: `${PNPR}@savvy-web/foo/-/foo-1.2.0.tgz` } } },
	},
};

interface Read {
	readonly registry: string | undefined;
	readonly token: string | null;
}

/**
 * A seeded registry world in which each registry in `requires` answers 401 to
 * an anonymous read and 403 to a wrong token; every other read is served from
 * the seed. `failWith` overrides the answer for one registry outright.
 */
const authRegistry = (
	seed: RegistrySeed,
	requires: Readonly<Record<string, string>>,
	failWith: Readonly<Record<string, number>> = {},
) => {
	const seeded = NpmRegistry.makeSeeded(seed);
	const reads: Read[] = [];
	const layer = NpmRegistry.layerTest({
		version: (name, version, target) =>
			Effect.suspend(() => {
				const registry = target?.registry;
				const credential = target?.credential;
				const token = credential?.kind === "token" ? Redacted.value(credential.token) : null;
				reads.push({ registry, token });
				const deny = (status: number) =>
					Effect.fail(new RegistryReadError({ kind: "status", status, package: name, registry: registry ?? NPM }));
				const forced = registry !== undefined ? failWith[registry] : undefined;
				if (forced !== undefined) return deny(forced);
				const expected = registry !== undefined ? requires[registry] : undefined;
				if (expected !== undefined) {
					if (token === null) return deny(401);
					if (token !== expected) return deny(403);
				}
				return seeded.version(name, version, target);
			}),
	});
	return { layer, reads };
};

const fast = Schedule.spaced("1 millis");
const PNPR_TOKEN = "pnpr-read-token";
const custom: ReadonlyArray<CustomRegistryAuth> = [{ registry: PNPR, token: Redacted.make(PNPR_TOKEN) }];

const options = (overrides: Partial<ConfirmAvailabilityOptions> = {}): ConfirmAvailabilityOptions => ({
	ceilingSeconds: 5,
	dryRun: false,
	npmToken: null,
	githubToken: "gh-secret",
	customRegistries: custom,
	schedule: fast,
	...overrides,
});

/** Run the step, capturing log lines and the groups it opened. */
const run = (
	targets: Parameters<typeof confirmAvailability>[0],
	opts: ConfirmAvailabilityOptions,
	registry: Layer.Layer<NpmRegistry>,
) =>
	Effect.gen(function* () {
		const lines: string[] = [];
		const groups: string[] = [];
		const capture = Logger.make<unknown, void>(({ message }) => {
			lines.push(Array.isArray(message) ? message.join(" ") : String(message));
		});
		const result = yield* confirmAvailability(targets, opts).pipe(
			Effect.provide(
				Layer.mergeAll(
					Logger.layer([capture]),
					ActionLogger.layerTest({
						group: (name, effect) => Effect.sync(() => void groups.push(name)).pipe(Effect.andThen(effect)),
					}),
					registry,
				),
			),
		);
		return { result, lines, groups, summary: lines.filter((l) => l.includes("Registry confirmation")) };
	});

describe("confirmAvailability — GitHub Packages and custom registries", () => {
	it.live("confirms a GitHub Packages version read with the github-token", () =>
		Effect.gen(function* () {
			const reg = authRegistry(seededEverywhere, { [GHP]: "gh-secret" });
			const { result } = yield* run([ghpTarget], options(), reg.layer);
			expect(result.get(keyOf(ghpTarget))).toEqual({
				status: "confirmed",
				waitedMs: expect.any(Number),
				tarball: `${GHP}download/@savvy-web/foo/1.2.0/abc`,
				reason: null,
			});
			expect(reg.reads).toEqual([{ registry: GHP, token: "gh-secret" }]);
		}),
	);

	it.live("confirms a custom-registry version read with that registry's custom-registries token", () =>
		Effect.gen(function* () {
			const reg = authRegistry(seededEverywhere, { [PNPR]: PNPR_TOKEN });
			const { result } = yield* run([pnprTarget], options(), reg.layer);
			expect(result.get(keyOf(pnprTarget))?.status).toBe("confirmed");
			expect(reg.reads).toEqual([{ registry: PNPR, token: PNPR_TOKEN }]);
		}),
	);

	it.live(
		"skips a GitHub Packages target with no-read-credential, without a registry call, when github-token is empty",
		() =>
			Effect.gen(function* () {
				const reg = authRegistry(seededEverywhere, {});
				const { result } = yield* run([ghpTarget], options({ githubToken: "" }), reg.layer);
				expect(result.get(keyOf(ghpTarget))).toEqual({
					status: "skipped",
					waitedMs: 0,
					tarball: null,
					reason: "no-read-credential",
				});
				expect(reg.reads).toEqual([]);
			}),
	);

	it.live("skips a custom target with no-read-credential when custom-registries has no entry for it", () =>
		Effect.gen(function* () {
			const reg = authRegistry(seededEverywhere, {});
			const { result } = yield* run([pnprTarget], options({ customRegistries: [] }), reg.layer);
			expect(result.get(keyOf(pnprTarget))?.reason).toBe("no-read-credential");
			expect(reg.reads).toEqual([]);
		}),
	);

	// OPS-143: a pnpr workload registry is read with its paired `_authToken`
	// reader — the minted workload credential cannot read and never reaches
	// this step — and a workload line with no reader has nothing to read with.
	it.live("confirms a pnpr workload registry with the paired reader token", () =>
		Effect.gen(function* () {
			const reg = authRegistry(seededEverywhere, { [PNPR]: PNPR_TOKEN });
			const workload = { audience: "https://registry.savvyweb.systems" };
			const { result } = yield* run(
				[pnprTarget],
				options({ customRegistries: [{ registry: PNPR, token: Redacted.make(PNPR_TOKEN), workload }] }),
				reg.layer,
			);
			expect(result.get(keyOf(pnprTarget))?.status).toBe("confirmed");
			expect(reg.reads).toEqual([{ registry: PNPR, token: PNPR_TOKEN }]);
		}),
	);

	it.live("skips a workload-only pnpr registry with no-read-credential, without a registry call", () =>
		Effect.gen(function* () {
			const reg = authRegistry(seededEverywhere, {});
			const workload = { audience: "https://registry.savvyweb.systems" };
			const { result } = yield* run(
				[pnprTarget],
				options({ customRegistries: [{ registry: PNPR, workload }] }),
				reg.layer,
			);
			expect(result.get(keyOf(pnprTarget))?.reason).toBe("no-read-credential");
			expect(reg.reads).toEqual([]);
		}),
	);

	it.live("reports a 401 as read-denied, not held, and does not retry it", () =>
		Effect.gen(function* () {
			const reg = authRegistry(seededEverywhere, {}, { [PNPR]: 401 });
			// A sub-second ceiling, so a step that retried the denial would come
			// back `held` with many reads rather than hang to the test timeout.
			const { result } = yield* run([pnprTarget], options({ noHoldCeilingSeconds: 0.2 }), reg.layer);
			expect(result.get(keyOf(pnprTarget))).toEqual({
				status: "skipped",
				waitedMs: expect.any(Number),
				tarball: null,
				reason: "read-denied",
			});
			expect(reg.reads).toHaveLength(1);
		}),
	);

	it.live("reports a 403 — a token without read access — as read-denied", () =>
		Effect.gen(function* () {
			const reg = authRegistry(seededEverywhere, { [GHP]: "a-different-token" });
			const { result } = yield* run([ghpTarget], options({ noHoldCeilingSeconds: 0.2 }), reg.layer);
			expect(result.get(keyOf(ghpTarget))?.reason).toBe("read-denied");
			expect(reg.reads).toEqual([{ registry: GHP, token: "gh-secret" }]);
		}),
	);

	it.live("keeps polling through a 5xx — only 401 and 403 are denials", () =>
		Effect.gen(function* () {
			let calls = 0;
			const seeded = NpmRegistry.makeSeeded(seededEverywhere);
			const layer = NpmRegistry.layerTest({
				version: (name, version, target) =>
					Effect.suspend(() => {
						calls += 1;
						return calls === 1
							? Effect.fail(new RegistryReadError({ kind: "status", status: 503, package: name, registry: PNPR }))
							: seeded.version(name, version, target);
					}),
			});
			const { result } = yield* run([pnprTarget], options(), layer);
			expect(result.get(keyOf(pnprTarget))?.status).toBe("confirmed");
			expect(calls).toBe(2);
		}),
	);

	it.live("reports held when a no-hold registry never serves the version within its short ceiling", () =>
		Effect.gen(function* () {
			const reg = authRegistry({ registries: {} }, {});
			// The npm-sized ceiling is 2s; the no-hold ceiling is 50ms. A step that
			// used the npm ceiling for the custom target would take 2s.
			const started = Date.now();
			const { result } = yield* run(
				[pnprTarget],
				options({ ceilingSeconds: 2, noHoldCeilingSeconds: 0.05 }),
				reg.layer,
			);
			const elapsed = Date.now() - started;
			expect(result.get(keyOf(pnprTarget))?.status).toBe("held");
			expect(result.get(keyOf(pnprTarget))?.reason).toBeNull();
			expect(elapsed).toBeLessThan(1000);
			expect(reg.reads.length).toBeGreaterThan(1);
		}),
	);

	it.live("leaves npm on the full ceiling while a no-hold registry gives up early", () =>
		Effect.gen(function* () {
			// npm serves on the 3rd read; the custom registry never does. Both
			// polled concurrently: npm must still be confirmed after the custom
			// target's short ceiling has already elapsed.
			let npmCalls = 0;
			const layer = NpmRegistry.layerTest({
				version: (name, version, target) =>
					Effect.suspend(() => {
						if (target?.registry === NPM) {
							npmCalls += 1;
							return npmCalls < 3
								? Effect.sleep("40 millis").pipe(Effect.as(Option.none()))
								: NpmRegistry.makeSeeded(seededEverywhere).version(name, version, target);
						}
						return Effect.succeed(Option.none());
					}),
			});
			const { result } = yield* run(
				[npmTarget, pnprTarget],
				options({ ceilingSeconds: 2, noHoldCeilingSeconds: 0.03 }),
				layer,
			);
			expect(result.get(keyOf(npmTarget))?.status).toBe("confirmed");
			expect(result.get(keyOf(pnprTarget))?.status).toBe("held");
		}),
	);

	it.effect("keeps JSR skipped as not-probed", () =>
		Effect.gen(function* () {
			const reg = authRegistry(seededEverywhere, {});
			const { result, groups } = yield* run([jsrTarget], options(), reg.layer);
			expect(result.get(keyOf(jsrTarget))).toEqual({
				status: "skipped",
				waitedMs: 0,
				tarball: null,
				reason: "not-probed",
			});
			expect(reg.reads).toEqual([]);
			expect(groups).toEqual([]);
		}),
	);

	it.live("opens the confirmation group for a wave whose only probe-able target is a custom registry", () =>
		Effect.gen(function* () {
			const reg = authRegistry(seededEverywhere, { [PNPR]: PNPR_TOKEN });
			const { groups } = yield* run([pnprTarget, jsrTarget], options(), reg.layer);
			expect(groups).toEqual(["Confirm registry availability"]);
		}),
	);

	it.effect("does not open the group when every non-npm target lacks a read credential", () =>
		Effect.gen(function* () {
			const reg = authRegistry(seededEverywhere, {});
			const { groups } = yield* run(
				[ghpTarget, pnprTarget],
				options({ githubToken: null, customRegistries: [] }),
				reg.layer,
			);
			expect(groups).toEqual([]);
		}),
	);

	it.effect("still skips every target in dry-run and at a ceiling of 0, whatever the registry", () =>
		Effect.gen(function* () {
			const reg = authRegistry(seededEverywhere, {});
			const dry = yield* run([ghpTarget, pnprTarget], options({ dryRun: true }), reg.layer);
			const off = yield* run([ghpTarget, pnprTarget], options({ ceilingSeconds: 0 }), reg.layer);
			expect([...dry.result.values()].map((a) => a.reason)).toEqual(["dry-run", "dry-run"]);
			expect([...off.result.values()].map((a) => a.reason)).toEqual(["disabled", "disabled"]);
			expect(reg.reads).toEqual([]);
		}),
	);
});

describe("confirmAvailability — the summary line breaks skips down by reason", () => {
	it.live("names each new reason with its count and both ceilings", () =>
		Effect.gen(function* () {
			const OTHER = "https://registry.example.com/";
			const other = { name: "@savvy-web/foo", version: "1.2.0", registry: OTHER };
			const reg = authRegistry(seededEverywhere, { [PNPR]: PNPR_TOKEN }, { [GHP]: 403 });
			const { summary } = yield* run(
				[npmTarget, pnprTarget, ghpTarget, other, jsrTarget],
				options({ ceilingSeconds: 180 }),
				reg.layer,
			);
			expect(summary).toEqual([
				"🔎 Registry confirmation: 2 confirmed · 0 held · 3 skipped " +
					"(1 denied the read (401/403); 1 with no read credential; 1 on JSR, which is not probed) " +
					"· ceiling 180s (20s on registries with no publish hold)",
			]);
		}),
	);

	it.live("omits the no-hold ceiling when only npm was probed", () =>
		Effect.gen(function* () {
			const reg = authRegistry(seededEverywhere, {});
			const { summary } = yield* run([npmTarget, jsrTarget], options({ ceilingSeconds: 180 }), reg.layer);
			expect(summary).toEqual([
				"🔎 Registry confirmation: 1 confirmed · 0 held · 1 skipped (1 on JSR, which is not probed) · ceiling 180s",
			]);
		}),
	);
});

describe("noHoldCeilingMs", () => {
	it("caps a registry with no publish hold at 20s", () => {
		expect(noHoldCeilingMs(180)).toBe(20_000);
	});

	it("never exceeds registry-confirm-timeout", () => {
		expect(noHoldCeilingMs(5)).toBe(5_000);
	});

	it("honours a fractional ceiling, for tests on a real clock", () => {
		expect(noHoldCeilingMs(180, 0.05)).toBe(50);
	});
});
