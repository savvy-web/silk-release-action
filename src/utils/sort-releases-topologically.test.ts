/**
 * Unit tests for {@link sortReleasesTopologically} — the shared topological
 * ordering helper used by the Phase-3 publish flow, the Phase-2 validation
 * flow, and the Phase-3 orchestrator so every step (tag strategy, build &
 * SBOM, publish, releases) surfaces packages in dependency-first order.
 */

import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { CyclicDependencyError, TopologicalSorter } from "workspaces-effect";

import { sortReleasesTopologically } from "./sort-releases-topologically.js";

/** TopologicalSorter test layer that returns names in the pre-configured order. */
const makeSorterLayer = (orderedNames: string[]): Layer.Layer<TopologicalSorter> =>
	Layer.succeed(TopologicalSorter, {
		sort: () => Effect.succeed(orderedNames as ReadonlyArray<string>),
		sortSubset: (names: ReadonlyArray<string>) => {
			const sorted = orderedNames.filter((n) => (names as string[]).includes(n));
			const missing = (names as string[]).filter((n) => !orderedNames.includes(n));
			return Effect.succeed([...sorted, ...missing] as ReadonlyArray<string>);
		},
		levels: () => Effect.succeed([orderedNames] as ReadonlyArray<ReadonlyArray<string>>),
	});

/** TopologicalSorter test layer whose sortSubset always fails (e.g. a cycle). */
const makeFailingSorterLayer = (): Layer.Layer<TopologicalSorter> =>
	Layer.succeed(TopologicalSorter, {
		sort: () => Effect.die("sort should not be called"),
		sortSubset: () => Effect.fail(new CyclicDependencyError({ cycle: ["@scope/a", "@scope/b"] })),
		levels: () => Effect.die("levels should not be called"),
	});

describe("sortReleasesTopologically", () => {
	it("orders names dependency-first using the topological sorter", async () => {
		// Sorter knows the dependency order: dep before its dependents.
		const layer = makeSorterLayer(["@scope/dep", "@scope/a", "@scope/b"]);

		// Caller passes them in detection (alphabetical) order.
		const result = await Effect.runPromise(
			sortReleasesTopologically(["@scope/a", "@scope/b", "@scope/dep"]).pipe(Effect.provide(layer)),
		);

		expect(result).toEqual(["@scope/dep", "@scope/a", "@scope/b"]);
	});

	it("keeps only the requested packages, dropping non-released transitive deps", async () => {
		// sortSubset returns the transitive closure including a non-released dep.
		const layer = Layer.succeed(TopologicalSorter, {
			sort: () => Effect.succeed([] as ReadonlyArray<string>),
			sortSubset: () => Effect.succeed(["@scope/non-released", "@scope/dep", "@scope/a"] as ReadonlyArray<string>),
			levels: () => Effect.succeed([] as ReadonlyArray<ReadonlyArray<string>>),
		});

		const result = await Effect.runPromise(
			sortReleasesTopologically(["@scope/a", "@scope/dep"]).pipe(Effect.provide(layer)),
		);

		expect(result).toEqual(["@scope/dep", "@scope/a"]);
	});

	it("falls back to the input order when the sort fails", async () => {
		const layer = makeFailingSorterLayer();

		const result = await Effect.runPromise(
			sortReleasesTopologically(["@scope/a", "@scope/b", "@scope/dep"]).pipe(Effect.provide(layer)),
		);

		expect(result).toEqual(["@scope/a", "@scope/b", "@scope/dep"]);
	});
});
