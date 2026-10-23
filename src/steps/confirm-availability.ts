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
 * This step polls the exact `name@version` of every successful target on an
 * npm-protocol registry — registry.npmjs.org, GitHub Packages and custom
 * registries such as pnpr — concurrently, until each resolves or its ceiling
 * elapses. JSR has no such read and is `skipped` as `not-probed`.
 *
 * **Two ceilings.** npm keeps `registry-confirm-timeout` (default 180s) and
 * its 5s → 30s backoff: the wait there is for a hold to elapse. GitHub
 * Packages and pnpr have no publish hold that we know of, so for them
 * confirmation proves the version is installable at all, and a version that
 * is not there within seconds is not going to appear by waiting three
 * minutes. They get {@link NO_HOLD_CEILING_SECONDS} (20s) — probes at roughly
 * 0s, 2s, 6s and 14s — capped by `registry-confirm-timeout`, so a smaller
 * input still wins and `0` still disables everything. 20s sits in the middle
 * of the 15–30s budget: four reads, enough to ride out one slow replica or a
 * CDN miss, short enough that a mixed wave never waits on its non-npm half.
 *
 * **Credentials.** Each registry is read with the credential its publish used
 * ({@link resolveReadCredential}): `npm-token` for npm, `github-token` for
 * GitHub Packages, the target's `custom-registries` `_authToken` (or the
 * `registry-env` fallback) for a custom registry. npm alone is read
 * anonymously when no token is supplied, as before; GitHub Packages and a
 * custom registry with no credential are `skipped` as `no-read-credential`
 * without a read, because an anonymous miss there is a 401, not a hold. A
 * 401 or 403 on any read is likewise not a hold: it ends that target's probe
 * at once as `skipped` with `read-denied`.
 *
 * Failure posture: **never fails**, and never flips a boolean. The packages
 * are published; a version still unresolved at its ceiling is reported as
 * `held` beside the package and counted in `totals.packagesHeld`, a confirmed
 * one in `totals.packagesConfirmed`, for every probed registry. The one
 * fallible call, the registry read, is absorbed into a miss or a denial (see
 * {@link probeOne}).
 *
 * The tokens arrive as options rather than being read here: inputs are
 * decoded once, in `schema/inputs.ts` (`Inputs.npmToken`,
 * `Inputs.githubToken`, `Inputs.customRegistries`), and
 * `__test__/schema-inputs.test.ts` pins that every other reader is a
 * sanctioned exception with a reason. This step has none — its caller already
 * holds the decoded record.
 *
 * @module steps/confirm-availability
 */

import type { ActionLogger } from "@effected/github-actions";
import type { RegistryCredential, RegistryKind } from "@effected/npm";
import { NpmRegistry, classifyRegistry } from "@effected/npm";
import { Clock, Duration, Effect, Option, Schedule } from "effect";
import { resolveReadCredential } from "../release/resolve-targets.js";
import type { AvailabilitySkipReason, PublishCredentialSource, TargetAvailability } from "../release/types.js";
import { availabilityKey } from "../release/types.js";
import type { CustomRegistryAuth } from "../utils/custom-registries.js";
import { grouped } from "../utils/grouped.js";

/**
 * One published (registry, name, version) target to confirm.
 *
 * @public
 */
export interface AvailabilityTarget {
	readonly name: string;
	readonly version: string;
	/** Registry URL, or `null` for JSR, which is never probed. */
	readonly registry: string | null;
}

/**
 * Options for {@link confirmAvailability}.
 *
 * @public
 */
export interface ConfirmAvailabilityOptions {
	/**
	 * How long to wait for each npm version, in seconds; `0` disables the probe
	 * for every registry.
	 *
	 * @remarks
	 * Whole seconds from the `registry-confirm-timeout` input in production.
	 * Converted to a `Duration` internally via milliseconds, so a fractional
	 * value is honoured — which is what lets a test use a real clock and a
	 * ceiling of tens of milliseconds. Also the cap on the no-hold ceiling.
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
	 * The `github-token` input as decoded by `schema/inputs.ts`, or `null`/`""`
	 * when none was supplied — the credential a GitHub Packages publish used.
	 * Without it a GitHub Packages target is `no-read-credential`.
	 */
	readonly githubToken: string | null;
	/**
	 * The parsed `custom-registries` input — each custom registry's publish
	 * `_authToken`, which is also its read credential today. A custom target
	 * with no entry (and no `registry-env` fallback) is `no-read-credential`.
	 *
	 * @remarks
	 * OPS-143: once pnpr publishes with a publish-only workload token, the read
	 * credential becomes a separate, optional pairing on the entry; see the
	 * seam in `resolveReadCredential`.
	 */
	readonly customRegistries: ReadonlyArray<CustomRegistryAuth>;
	/**
	 * Retry cadence between probes, for every registry. Defaults to jittered
	 * exponential backoff from 5s capped at 30s on npm, and from 2s capped at
	 * 8s elsewhere. Injectable for tests.
	 */
	readonly schedule?: Schedule.Schedule<unknown>;
	/**
	 * The no-hold ceiling in seconds; defaults to {@link NO_HOLD_CEILING_SECONDS}.
	 * Injectable so a real-clock test can make it tens of milliseconds.
	 */
	readonly noHoldCeilingSeconds?: number;
}

/**
 * How long to wait on a registry with no publish hold (GitHub Packages, a
 * custom registry), before `registry-confirm-timeout` caps it.
 *
 * @public
 */
export const NO_HOLD_CEILING_SECONDS = 20;

/**
 * The effective ceiling, in milliseconds, for a registry with no publish hold.
 *
 * @param ceilingSeconds - The `registry-confirm-timeout` value; always the cap.
 * @param noHoldSeconds - The no-hold budget; {@link NO_HOLD_CEILING_SECONDS} by default.
 * @returns `min(ceilingSeconds, noHoldSeconds)` in whole milliseconds.
 *
 * @internal
 */
export const noHoldCeilingMs = (ceilingSeconds: number, noHoldSeconds: number = NO_HOLD_CEILING_SECONDS): number =>
	Math.round(Math.min(ceilingSeconds, noHoldSeconds) * 1000);

const skipped = (reason: AvailabilitySkipReason, waitedMs = 0): TargetAvailability => ({
	status: "skipped",
	waitedMs,
	tarball: null,
	reason,
});

/**
 * 5s, 10s, 20s, 30s, 30s … with jitter — the observed hold is bimodal, mostly
 * short. `Schedule.min` takes the smaller delay of the pair at each step, so
 * `spaced("30 seconds")` is the cap on the exponential.
 */
const npmSchedule: Schedule.Schedule<unknown> = Schedule.jittered(
	Schedule.min([Schedule.exponential("5 seconds"), Schedule.spaced("30 seconds")]),
);

/** 2s, 4s, 8s, 8s … with jitter: four reads inside the 20s no-hold ceiling. */
const noHoldSchedule: Schedule.Schedule<unknown> = Schedule.jittered(
	Schedule.min([Schedule.exponential("2 seconds"), Schedule.spaced("8 seconds")]),
);

/** One target the step will actually read, with everything its probe needs. */
interface ProbePlan {
	readonly target: AvailabilityTarget & { readonly registry: string };
	readonly kind: RegistryKind;
	readonly credential: RegistryCredential | null;
	readonly source: PublishCredentialSource | null;
	readonly ceiling: Duration.Duration;
	readonly schedule: Schedule.Schedule<unknown>;
}

/** What one read answered. */
type Read =
	| { readonly _tag: "found"; readonly tarball: string | null }
	| { readonly _tag: "miss" }
	| { readonly _tag: "denied"; readonly status: number };

const isDenial = (status: number | undefined): status is number => status === 401 || status === 403;

const probeOne = (plan: ProbePlan): Effect.Effect<TargetAvailability, never, NpmRegistry> =>
	Effect.gen(function* () {
		const { target } = plan;
		const registry = yield* NpmRegistry;
		const started = yield* Clock.currentTimeMillis;
		const read: Effect.Effect<Read> = registry
			.version(target.name, target.version, {
				registry: target.registry,
				...(plan.credential !== null ? { credential: plan.credential } : {}),
			})
			.pipe(
				Effect.map(
					(found): Read =>
						Option.isSome(found) ? { _tag: "found", tarball: found.value.tarball ?? null } : { _tag: "miss" },
				),
				// A 401/403 is a verdict about the credential, not about the
				// version, and retrying it cannot change the answer. Any other read
				// error is a miss: the registry front is exactly what is flaky
				// during a hold.
				Effect.catch((e) =>
					Effect.succeed<Read>(
						e.kind === "status" && isDenial(e.status) ? { _tag: "denied", status: e.status } : { _tag: "miss" },
					),
				),
			);
		// `repeat` runs the read once before consulting the schedule, so the
		// first probe is immediate; `timeoutOption` interrupts the loop at the
		// ceiling and answers `none` in place of the last read.
		const outcome = yield* read.pipe(
			Effect.repeat({ schedule: plan.schedule, until: (r) => r._tag !== "miss" }),
			Effect.timeoutOption(plan.ceiling),
		);
		const waitedMs = (yield* Clock.currentTimeMillis) - started;
		const label = `${target.name}@${target.version}`;
		if (Option.isSome(outcome) && outcome.value._tag === "found") {
			yield* Effect.logInfo(`  🔎 ${label} · resolvable on ${target.registry} after ${Math.round(waitedMs / 1000)}s`);
			return { status: "confirmed", waitedMs, tarball: outcome.value.tarball, reason: null };
		}
		if (Option.isSome(outcome) && outcome.value._tag === "denied") {
			yield* Effect.logWarning(
				`${label} published, but ${target.registry} refused the confirmation read with HTTP ${outcome.value.status}` +
					(plan.source !== null ? ` — the ${plan.source} credential cannot read it` : "") +
					"; not a hold, reported as skipped (read-denied)",
			);
			return skipped("read-denied", waitedMs);
		}
		yield* Effect.logWarning(
			plan.kind === "npm"
				? `${label} published but not yet resolvable on ${target.registry} after ${Duration.toSeconds(plan.ceiling)}s — npm may be holding it for publish-time scanning; reported as held`
				: `${label} published but not resolvable on ${target.registry} after ${Duration.toSeconds(plan.ceiling)}s — this registry has no publish hold, so the version may not be installable; reported as held`,
		);
		return { status: "held", waitedMs, tarball: null, reason: null };
	});

/** Why a target was not confirmed, as the run summary says it — in the order the summary lists them. */
const SKIP_REASON_TEXT: Record<AvailabilitySkipReason, string> = {
	"read-denied": "denied the read (401/403)",
	"no-read-credential": "with no read credential",
	"not-probed": "on JSR, which is not probed",
	disabled: "registry-confirm-timeout is 0",
	"dry-run": "dry run",
	"not-published": "not published this run",
	"not-reached": "publishing stopped before it",
};

/**
 * The one line every run prints, on every path.
 *
 * @remarks
 * Before this line existed, a run that probed nothing — no npm target, a
 * ceiling of `0`, a dry run — logged nothing at all, so a workflow that set
 * `registry-confirm-timeout: 180` could not tell from the log whether
 * confirmation had run. A run-wide skip (every entry sharing one reason that
 * is `dry-run` or `disabled`) says so in one clause; otherwise the line counts
 * confirmed, held and skipped, and names each skip reason with its count, in
 * a fixed order. When something was probed it closes with the ceiling, and
 * with the no-hold ceiling too when a no-hold registry was among the probes.
 *
 * @param result - Every target's availability entry.
 * @param ceilingSeconds - The `registry-confirm-timeout` value.
 * @param noHoldSeconds - The no-hold ceiling, when a no-hold registry was probed.
 * @returns The summary line.
 *
 * @internal
 */
export const summarizeConfirmation = (
	result: ReadonlyMap<string, TargetAvailability>,
	ceilingSeconds: number,
	noHoldSeconds?: number,
): string => {
	const prefix = "🔎 Registry confirmation:";
	const entries = [...result.values()];
	if (entries.length === 0) return `${prefix} nothing to confirm — no registry target was published`;
	const reasons = new Map<AvailabilitySkipReason, number>();
	let confirmed = 0;
	let held = 0;
	for (const e of entries) {
		if (e.status === "confirmed") confirmed += 1;
		else if (e.status === "held") held += 1;
		else if (e.reason !== null) reasons.set(e.reason, (reasons.get(e.reason) ?? 0) + 1);
	}
	const skippedCount = [...reasons.values()].reduce((a, b) => a + b, 0);
	const runWide = [...reasons.keys()].find((r) => r === "dry-run" || r === "disabled");
	if (runWide !== undefined && skippedCount === entries.length) {
		return `${prefix} skipped — ${SKIP_REASON_TEXT[runWide]} (${entries.length} registry target(s))`;
	}
	const why = (Object.keys(SKIP_REASON_TEXT) as AvailabilitySkipReason[])
		.flatMap((reason) => {
			const n = reasons.get(reason);
			return n === undefined ? [] : [`${n} ${SKIP_REASON_TEXT[reason]}`];
		})
		.join("; ");
	const probed = confirmed + held > 0 || reasons.has("read-denied");
	return (
		`${prefix} ${confirmed} confirmed · ${held} held · ${skippedCount} skipped` +
		(why !== "" ? ` (${why})` : "") +
		(probed
			? ` · ceiling ${ceilingSeconds}s` +
				(noHoldSeconds !== undefined ? ` (${noHoldSeconds}s on registries with no publish hold)` : "")
			: "")
	);
};

/** A non-empty token, or `null`: the runner spells an unsupplied input `""`. */
const present = (token: string | null): string | null => (token !== null && token !== "" ? token : null);

/**
 * Probe every published target on an npm-protocol registry for its exact
 * version. Never fails; see the module remarks.
 *
 * @remarks
 * Every target gets an entry. JSR is `skipped` as `not-probed`, a GitHub
 * Packages or custom target with no read credential as `no-read-credential`,
 * both without a registry call; everything is `skipped` when `dryRun` is set
 * or `ceilingSeconds` is `0`. The rest are probed concurrently, so the
 * wall-clock cost is the slowest target, not the sum — and a no-hold
 * registry's short ceiling never waits on npm's.
 *
 * @param targets - The successfully published targets.
 * @param options - Ceiling, dry-run flag, read credentials and (for tests) the cadence and no-hold ceiling.
 * @returns One {@link TargetAvailability} per target, keyed by {@link availabilityKey}.
 *
 * @public
 */
export const confirmAvailability = (
	targets: ReadonlyArray<AvailabilityTarget>,
	options: ConfirmAvailabilityOptions,
): Effect.Effect<ReadonlyMap<string, TargetAvailability>, never, NpmRegistry | ActionLogger> =>
	Effect.gen(function* () {
		const result = new Map<string, TargetAvailability>();
		const keyOf = (t: AvailabilityTarget): string => availabilityKey(t.registry, t.name, t.version);
		// Dry-run wins over a ceiling of 0: it is the reason there is nothing to
		// confirm at all.
		const runWide: AvailabilitySkipReason | null = options.dryRun
			? "dry-run"
			: options.ceilingSeconds <= 0
				? "disabled"
				: null;
		if (runWide !== null) {
			for (const t of targets) result.set(keyOf(t), skipped(runWide));
			yield* Effect.logInfo(summarizeConfirmation(result, options.ceilingSeconds));
			return result;
		}

		const npmToken = present(options.npmToken);
		const githubToken = present(options.githubToken);
		const noHoldSeconds = Math.min(options.ceilingSeconds, options.noHoldCeilingSeconds ?? NO_HOLD_CEILING_SECONDS);
		const plans: ProbePlan[] = [];
		// Every target is entered in input order; a probed one is overwritten
		// below, which keeps its position.
		for (const t of targets) {
			const kind = t.registry === null ? "jsr" : classifyRegistry(t.registry);
			if (t.registry === null || kind === "jsr") {
				result.set(keyOf(t), skipped("not-probed"));
				continue;
			}
			const resolved = resolveReadCredential(t.registry, npmToken, githubToken, options.customRegistries);
			// npm alone reads anonymously: a public package needs no credential.
			// Anywhere else an anonymous read is a guaranteed 401, so it is not
			// made at all.
			if (resolved === null && kind !== "npm") {
				result.set(keyOf(t), skipped("no-read-credential"));
				continue;
			}
			result.set(keyOf(t), skipped("not-reached"));
			plans.push({
				target: { ...t, registry: t.registry },
				kind,
				credential: resolved?.credential ?? null,
				source: resolved?.source ?? null,
				ceiling: Duration.millis(
					kind === "npm"
						? Math.round(options.ceilingSeconds * 1000)
						: noHoldCeilingMs(options.ceilingSeconds, noHoldSeconds),
				),
				schedule: options.schedule ?? (kind === "npm" ? npmSchedule : noHoldSchedule),
			});
		}
		const anyNoHold = plans.some((p) => p.kind !== "npm");
		if (plans.length === 0) {
			yield* Effect.logInfo(summarizeConfirmation(result, options.ceilingSeconds));
			return result;
		}

		// The group opens here, past the early returns, so a dry-run, a ceiling
		// of 0 or a wave with nothing to read never leaves an empty heading.
		const outcomes = yield* grouped(
			"Confirm registry availability",
			Effect.logInfo(
				`Confirming ${plans.length} version(s) on their registries (ceiling ${options.ceilingSeconds}s` +
					(anyNoHold ? `; ${noHoldSeconds}s on registries with no publish hold` : "") +
					")",
			).pipe(Effect.andThen(Effect.forEach(plans, probeOne, { concurrency: "unbounded" }))),
		);
		plans.forEach((p, i) => {
			const outcome = outcomes[i];
			if (outcome !== undefined) result.set(keyOf(p.target), outcome);
		});
		yield* Effect.logInfo(summarizeConfirmation(result, options.ceilingSeconds, anyNoHold ? noHoldSeconds : undefined));
		return result;
	});
