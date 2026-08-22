/**
 * The `action.yml` ↔ code sync guard for OUTPUTS.
 *
 * Same three legs as the inputs guard. The divergence this one was written
 * for was code-only AND miscased: `closed_issues_count`, `failed_issues_count`
 * and `closed_issues` were written by `close-linked-issues.ts`, declared
 * nowhere, and spelled in snake_case against a manifest that is uniformly
 * kebab-case.
 */

import { describe, expect, it } from "@effect/vitest";
import type { ActionOutputsShape } from "@effected/github-actions";
import { ActionOutputs } from "@effected/github-actions";
import { Effect } from "effect";
import {
	MAIN_SCALAR_OUTPUT_NAMES,
	OUTPUT_NAMES,
	PRE_OUTPUT_NAMES,
	STRUCTURED_OUTPUT_NAME,
	emitMainScalarOutputs,
	initialMainScalarOutputs,
} from "../src/schema/outputs.js";
import { declaredOutputNames, scanOutputWriteReceivers, scanOutputWrites } from "./utils/manifest.js";

/**
 * Records every `set` call; every other member keeps the kit double's
 * die-loudly default, so an unstubbed call names itself instead of passing.
 *
 * @remarks
 * Recording happens inside `Effect.sync`, never eagerly at construction — a
 * described-but-never-run call must not appear in the recording.
 */
const recordingOutputs = (sets: Array<{ name: string; value: string }>): ActionOutputsShape =>
	ActionOutputs.makeTest({
		set: (name: string, value: string) =>
			Effect.sync(() => {
				sets.push({ name, value });
			}),
	});

describe("OUTPUT_NAMES", () => {
	it("should match the outputs action.yml declares", () => {
		expect([...OUTPUT_NAMES].sort()).toEqual([...declaredOutputNames()].sort());
	});

	it("should be partitioned exactly by the pre, structured and main-scalar sets", () => {
		// The partition is what stops `result` going missing by being everyone
		// else's responsibility — it belongs to no fold, so only this holds it.
		const partition = [...PRE_OUTPUT_NAMES, STRUCTURED_OUTPUT_NAME, ...MAIN_SCALAR_OUTPUT_NAMES];
		expect(partition.sort()).toEqual([...OUTPUT_NAMES].sort());
		expect(new Set(partition).size).toBe(partition.length);
	});
});

describe("action.yml ↔ src/ output writes", () => {
	it("should never write an output action.yml does not declare", () => {
		const declared = declaredOutputNames();
		const undeclared = [...scanOutputWrites().names.entries()]
			.filter(([name]) => !declared.includes(name))
			.map(([name, files]) => `${name} (written in ${files.join(", ")})`);
		expect(undeclared).toEqual([]);
	});

	it("should write every output action.yml declares", () => {
		const written = new Set(scanOutputWrites().names.keys());
		expect(declaredOutputNames().filter((name) => !written.has(name))).toEqual([]);
	});

	it("should spell every declared output in kebab-case", () => {
		// The miscase that let three snake_case outputs sit undeclared. A
		// consumer reading `closed-issues-count` from the docs got nothing.
		expect(declaredOutputNames().filter((name) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))).toEqual([]);
	});

	it("should resolve every output name to a literal", () => {
		expect(scanOutputWrites().unresolved).toEqual([]);
	});

	it("should bind the outputs service as `outputs` at every write site", () => {
		// The scan above is anchored on that receiver to avoid colliding with
		// the dozen `Map.set(identifier, …)` calls in src/, so the convention has
		// to be asserted rather than assumed.
		//
		// Asserted receiver-by-receiver, NOT by the size of that scan: an output
		// written at two sites still appears once when one site renames its
		// binding, so the size check passed against a deliberately renamed
		// receiver. This form kills that mutant.
		const offenders = scanOutputWriteReceivers(OUTPUT_NAMES).filter((entry) => !entry.startsWith("outputs "));
		expect(offenders).toEqual([]);
	});
});

describe("emitMainScalarOutputs", () => {
	it.effect("should write every main scalar output exactly once", () =>
		Effect.gen(function* () {
			const sets: Array<{ name: string; value: string }> = [];
			yield* emitMainScalarOutputs(recordingOutputs(sets), initialMainScalarOutputs);
			expect(sets.map((entry) => entry.name).sort()).toEqual([...MAIN_SCALAR_OUTPUT_NAMES].sort());
			expect(sets.length).toBe(MAIN_SCALAR_OUTPUT_NAMES.length);
		}),
	);

	it.effect("should render the all-disabled baseline as a documented no-op", () =>
		Effect.gen(function* () {
			const sets: Array<{ name: string; value: string }> = [];
			yield* emitMainScalarOutputs(recordingOutputs(sets), initialMainScalarOutputs);
			const byName = new Map(sets.map((entry) => [entry.name, entry.value]));
			expect(byName.get("phase")).toBe("none");
			expect(byName.get("status")).toBe("no-op");
			expect(byName.get("succeeded")).toBe("true");
			expect(byName.get("package-count")).toBe("0");
			// `null` is "no PR involved" — distinct from PR number zero.
			expect(byName.get("release-pr-number")).toBe("");
			expect(byName.get("closed-issues-count")).toBe("0");
			expect(byName.get("closed-issues")).toBe("[]");
		}),
	);

	it.effect("should render a real release PR number rather than the empty sentinel", () =>
		Effect.gen(function* () {
			const sets: Array<{ name: string; value: string }> = [];
			yield* emitMainScalarOutputs(recordingOutputs(sets), { ...initialMainScalarOutputs, releasePrNumber: 0 });
			expect(new Map(sets.map((e) => [e.name, e.value])).get("release-pr-number")).toBe("0");
		}),
	);
});
