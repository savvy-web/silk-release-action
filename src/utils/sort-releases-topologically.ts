import { DependencyGraph, WorkspaceDiscovery } from "@effected/workspaces";
import { Effect } from "effect";

/**
 * Order a set of released package names topologically (dependencies first).
 *
 * @remarks
 * `listPackages` / PR-and-commit detection return packages in workspace glob
 * order (alphabetical), not dependency order. Phase-3 publishing, Phase-2
 * dry-run/SBOM validation, and the Phase-3 orchestrator all need the *same*
 * dependency-first ordering so that registry publishes, GitHub releases, tag
 * creation, and build/SBOM steps surface packages consistently.
 *
 * `DependencyGraph.sortSubset` returns the transitive-dependency closure of
 * the requested names, so the closure is filtered back down to only the
 * requested (released) packages — a non-bumped dependency pulled into the
 * closure is not a release target.
 *
 * A cyclic (or otherwise unsortable) graph falls back to the input order
 * rather than aborting the release, emitting a warning so the degraded
 * ordering is visible in the logs.
 *
 * @param names - Released package names in detection order
 * @returns Effect resolving to the same names in dependency-first order
 */
export const sortReleasesTopologically = (
	names: ReadonlyArray<string>,
): Effect.Effect<ReadonlyArray<string>, never, WorkspaceDiscovery> =>
	Effect.gen(function* () {
		const discovery = yield* WorkspaceDiscovery;
		const requested = new Set(names);
		return yield* Effect.gen(function* () {
			const packages = yield* discovery.listPackages();
			const graph = DependencyGraph.make({ packages: [...packages] });
			const closure = yield* graph.sortSubset(names);
			return closure.filter((name) => requested.has(name));
		}).pipe(
			Effect.catch((e) =>
				Effect.gen(function* () {
					yield* Effect.logWarning(`Topological sort failed, using detection order: ${String(e)}`);
					return names;
				}),
			),
		);
	});
