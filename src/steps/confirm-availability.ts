/**
 * Post-publish registry confirmation (issue #301).
 *
 * @remarks
 * A 200 from `npm publish` is not the same as the version being installable:
 * npm's publish-time malware scan holds a new version back from the registry
 * while it runs — usually under three minutes, occasionally far longer. The
 * downstream dispatch this action triggers lands inside that hold and fails
 * with `ERR_PNPM_NO_MATCHING_VERSION`.
 *
 * This step polls the exact `name@version` of every successful npm target,
 * concurrently, until each resolves or a ceiling elapses. It NEVER fails the
 * release — the packages are published — and it never flips a boolean: a
 * version still unresolved at the ceiling is reported as `held` beside the
 * package, and counted in `totals.packagesHeld`, so a consumer can decide
 * whether to wait, retry or defer.
 *
 * Failure posture: **never fails**. The one fallible call, the registry read,
 * is absorbed into a miss (see {@link probeOne}).
 *
 * The npm token arrives as an option rather than being read here: inputs are
 * decoded once, in `schema/inputs.ts` (`Inputs.npmToken`), and
 * `__test__/schema-inputs.test.ts` pins that every other reader is a
 * sanctioned exception with a reason. This step has none — its caller already
 * holds the decoded record.
 *
 * @module steps/confirm-availability
 */

import type { RegistryCredential } from "@effected/npm";
import { NpmRegistry, classifyRegistry } from "@effected/npm";
import { Clock, Duration, Effect, Option, Redacted, Schedule } from "effect";
import type { TargetAvailability } from "../release/types.js";
import { availabilityKey } from "../release/types.js";

/**
 * One published (registry, name, version) target to confirm.
 *
 * @public
 */
export interface AvailabilityTarget {
	readonly name: string;
	readonly version: string;
	/** Registry URL, or `null` for JSR; only `classifyRegistry(...) === "npm"` targets are probed. */
	readonly registry: string | null;
}

/**
 * Options for {@link confirmAvailability}.
 *
 * @public
 */
export interface ConfirmAvailabilityOptions {
	/**
	 * How long to wait for each version, in seconds; `0` disables the probe.
	 *
	 * @remarks
	 * Whole seconds from the `registry-confirm-timeout` input in production.
	 * Converted to a `Duration` internally via milliseconds, so a fractional
	 * value is honoured — which is what lets a test use a real clock and a
	 * ceiling of tens of milliseconds.
	 */
	readonly ceilingSeconds: number;
	readonly dryRun: boolean;
	/**
	 * The `npm-token` input as decoded by `schema/inputs.ts`, or `null`/`""`
	 * when none was supplied.
	 *
	 * @remarks
	 * Required, not optional: a private scoped package needs the token to be
	 * readable at all, and without it a hold and a 404 look alike. Making the
	 * caller spell `null` keeps an anonymous probe a decision rather than an
	 * omission.
	 */
	readonly npmToken: string | null;
	/**
	 * Retry cadence between probes. Defaults to jittered exponential backoff
	 * from 5s capped at 30s. Injectable for tests.
	 */
	readonly schedule?: Schedule.Schedule<unknown>;
}

const SKIPPED: TargetAvailability = { status: "skipped", waitedMs: 0, tarball: null };

/**
 * 5s, 10s, 20s, 30s, 30s … with jitter — the observed hold is bimodal, mostly
 * short. `Schedule.min` takes the smaller delay of the pair at each step, so
 * `spaced("30 seconds")` is the cap on the exponential.
 */
const defaultSchedule: Schedule.Schedule<unknown> = Schedule.jittered(
	Schedule.min([Schedule.exponential("5 seconds"), Schedule.spaced("30 seconds")]),
);

const probeOne = (
	target: AvailabilityTarget,
	credential: RegistryCredential | null,
	ceiling: Duration.Duration,
	schedule: Schedule.Schedule<unknown>,
): Effect.Effect<TargetAvailability, never, NpmRegistry> =>
	Effect.gen(function* () {
		const registry = yield* NpmRegistry;
		const started = yield* Clock.currentTimeMillis;
		const read = registry
			.version(target.name, target.version, {
				...(target.registry !== null ? { registry: target.registry } : {}),
				...(credential !== null ? { credential } : {}),
			})
			// A read error is a miss, not a verdict: the registry front is exactly
			// what is flaky during a hold.
			.pipe(Effect.catch(() => Effect.succeedNone));
		// `repeat` runs the read once before consulting the schedule, so the
		// first probe is immediate; `timeoutOption` interrupts the loop at the
		// ceiling and answers `none` in place of the (nested) read result.
		const outcome = yield* read.pipe(Effect.repeat({ schedule, until: Option.isSome }), Effect.timeoutOption(ceiling));
		const waitedMs = (yield* Clock.currentTimeMillis) - started;
		const published = Option.flatten(outcome);
		if (Option.isSome(published)) {
			yield* Effect.logInfo(`  🔎 ${target.name}@${target.version} · resolvable after ${Math.round(waitedMs / 1000)}s`);
			return { status: "confirmed", waitedMs, tarball: published.value.tarball ?? null };
		}
		yield* Effect.logWarning(
			`${target.name}@${target.version} published but not yet resolvable on ${target.registry} after ${Duration.toSeconds(ceiling)}s — npm may be holding it for publish-time scanning; reported as held`,
		);
		return { status: "held", waitedMs, tarball: null };
	});

/**
 * Probe every npm target for its exact version. Never fails; see the module
 * remarks.
 *
 * @remarks
 * Every target gets an entry: non-npm targets (JSR, GitHub Packages, custom
 * registries) are `skipped` without a registry call, as is everything when
 * `dryRun` is set or `ceilingSeconds` is `0`. The npm targets are probed
 * concurrently, so the wall-clock cost is the slowest hold, not the sum.
 *
 * @param targets - The successfully published targets.
 * @param options - Ceiling, dry-run flag, npm token and (for tests) the retry cadence.
 * @returns One {@link TargetAvailability} per target, keyed by {@link availabilityKey}.
 *
 * @public
 */
export const confirmAvailability = (
	targets: ReadonlyArray<AvailabilityTarget>,
	options: ConfirmAvailabilityOptions,
): Effect.Effect<ReadonlyMap<string, TargetAvailability>, never, NpmRegistry> =>
	Effect.gen(function* () {
		const result = new Map<string, TargetAvailability>();
		const probe = !options.dryRun && options.ceilingSeconds > 0;
		const npmTargets = targets.filter((t) => t.registry !== null && classifyRegistry(t.registry) === "npm");
		for (const t of targets) result.set(availabilityKey(t.registry, t.name, t.version), SKIPPED);
		if (!probe || npmTargets.length === 0) return result;

		// `Inputs.npmToken` defaults to "" for an unsupplied input; treat it as
		// absent, as `publish.ts` does.
		const credential: RegistryCredential | null =
			options.npmToken !== null && options.npmToken !== ""
				? { kind: "token", token: Redacted.make(options.npmToken) }
				: null;

		const ceiling = Duration.millis(Math.round(options.ceilingSeconds * 1000));
		const schedule = options.schedule ?? defaultSchedule;
		yield* Effect.logInfo(
			`Confirming ${npmTargets.length} npm version(s) on the registry (ceiling ${options.ceilingSeconds}s)`,
		);
		const outcomes = yield* Effect.forEach(npmTargets, (t) => probeOne(t, credential, ceiling, schedule), {
			concurrency: "unbounded",
		});
		npmTargets.forEach((t, i) => {
			const outcome = outcomes[i];
			if (outcome !== undefined) result.set(availabilityKey(t.registry, t.name, t.version), outcome);
		});
		return result;
	});
