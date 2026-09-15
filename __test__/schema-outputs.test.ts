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
import { ActionLogger, ActionOutputs } from "@effected/github-actions";
import { Effect, Logger } from "effect";
import {
	MAIN_SCALAR_OUTPUT_NAMES,
	OUTPUT_NAMES,
	PRE_OUTPUT_NAMES,
	STRUCTURED_OUTPUT_NAME,
	emitMainScalarOutputs,
	emitReleaseOutput,
	initialMainScalarOutputs,
} from "../src/schema/outputs.js";
import type { ReleaseOutput } from "../src/schema/release-output.js";
import { SCHEMA_URL, SCHEMA_VERSION } from "../src/schema/release-output.js";
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

describe("emitReleaseOutput", () => {
	const sample: ReleaseOutput = {
		$schema: SCHEMA_URL,
		schemaVersion: SCHEMA_VERSION,
		phase: "branch-management",
		success: true,
		outcome: "branch-created",
		summary: "1 changeset file(s) · 1 workspace(s) to version · release PR #1 created",
		dryRun: false,
		failure: null,
		totals: { changesetFiles: 1, workspaces: 1 },
		branchManagement: {
			releaseBranch: {
				name: "changeset-release/main",
				existed: true,
				created: false,
				updated: true,
				hasConflicts: false,
			},
			releasePr: { number: 42, url: "https://example.com/pr/42", action: "updated" },
			changesets: {
				count: 1,
				packages: [
					{ name: "@savvy-web/foo", bumpType: "minor", changesetCount: 1, oldVersion: "1.0.0", newVersion: "1.1.0" },
				],
			},
		},
	};

	/** Records `set` and `setJson` (as the encoded text the runner would see) plus every log line and group name. */
	const harness = () => {
		const sets: Array<{ name: string; value: string }> = [];
		const groups: Array<string> = [];
		const logs: Array<string> = [];
		const outputs = ActionOutputs.makeTest({
			set: (name: string, value: string) =>
				Effect.sync(() => {
					sets.push({ name, value });
				}),
			setJson: (name: string, value: unknown) =>
				Effect.sync(() => {
					sets.push({ name, value: JSON.stringify(value) });
				}),
		});
		const layer = ActionLogger.layerTest({
			group: <A, E, R>(name: string, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
				Effect.sync(() => {
					groups.push(name);
				}).pipe(Effect.andThen(effect)),
		});
		const recorder = Logger.make(({ message }) => {
			logs.push(Array.isArray(message) ? message.map(String).join(" ") : String(message));
		});
		return { sets, groups, logs, layer, loggerLayer: Logger.layer([recorder]), outputs };
	};

	it.effect("should log the encoded result inside a collapsed group before setting it", () =>
		Effect.gen(function* () {
			const h = harness();
			yield* emitReleaseOutput(h.outputs, sample, { packageCount: 1, releasePrNumber: 42 }).pipe(
				Effect.provide(h.layer),
				Effect.provide(h.loggerLayer),
			);
			expect(h.groups).toEqual(["Structured result output"]);
			const logged = h.logs.find((line) => line.includes('"schemaVersion"'));
			expect(logged).toBeDefined();
			// Pretty-printed — the runner collapses the group, so readability wins over one-line copy-paste.
			expect(logged).toContain("\n  ");
			// The same document `setJson` published, byte-for-byte modulo whitespace.
			const result = h.sets.find((entry) => entry.name === "result");
			expect(result).toBeDefined();
			expect(JSON.parse(logged ?? "")).toEqual(JSON.parse(result?.value ?? ""));
			expect(JSON.parse(result?.value ?? "")).toEqual(sample);
		}),
	);
});
