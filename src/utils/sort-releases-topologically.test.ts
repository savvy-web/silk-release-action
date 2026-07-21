/**
 * Unit tests for {@link sortReleasesTopologically} — the shared topological
 * ordering helper used by the Phase-3 publish flow, the Phase-2 validation
 * flow, and the Phase-3 orchestrator so every step (tag strategy, build &
 * SBOM, publish, releases) surfaces packages in dependency-first order.
 */

import { WorkspaceDiscovery, WorkspacePackage } from "@effected/workspaces";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { sortReleasesTopologically } from "./sort-releases-topologically.js";

/** Build a WorkspacePackage fixture whose workspace dependency edges point at `deps`. */
const pkg = (name: string, deps: ReadonlyArray<string> = []): WorkspacePackage =>
	WorkspacePackage.make({
		name,
		version: "1.0.0",
		path: `/repo/${name}`,
		packageJsonPath: `/repo/${name}/package.json`,
		relativePath: name,
		workspaceRoot: "/repo",
		dependencies: Object.fromEntries(deps.map((d) => [d, "workspace:*"])),
	});

/**
 * WorkspaceDiscovery test layer whose `listPackages` returns the given packages.
 *
 * `sortReleasesTopologically` builds a real `DependencyGraph` from these, so the
 * fixtures' dependency edges — not a mocked sorter — drive the topological order.
 */
const makeDiscoveryLayer = (packages: ReadonlyArray<WorkspacePackage>): Layer.Layer<WorkspaceDiscovery> =>
	Layer.succeed(WorkspaceDiscovery, {
		info: () => Effect.die("not implemented"),
		listPackages: () => Effect.succeed(packages),
		importerMap: () => Effect.die("not implemented"),
		getPackage: () => Effect.die("not implemented"),
		resolveFile: () => Effect.die("not implemented"),
		resolveFiles: () => Effect.die("not implemented"),
		refresh: () => Effect.void,
	});

describe("sortReleasesTopologically", () => {
	it("orders names dependency-first using the workspace dependency graph", async () => {
		// dep depends on nothing; a and b each depend on dep.
		const layer = makeDiscoveryLayer([
			pkg("@scope/dep"),
			pkg("@scope/a", ["@scope/dep"]),
			pkg("@scope/b", ["@scope/dep"]),
		]);

		// Caller passes them in detection (alphabetical) order.
		const result = await Effect.runPromise(
			sortReleasesTopologically(["@scope/a", "@scope/b", "@scope/dep"]).pipe(Effect.provide(layer)),
		);

		expect(result).toEqual(["@scope/dep", "@scope/a", "@scope/b"]);
	});

	it("keeps only the requested packages, dropping non-released transitive deps", async () => {
		// a → dep → non-released. sortSubset pulls the whole transitive closure;
		// the non-released dependency must be filtered back out.
		const layer = makeDiscoveryLayer([
			pkg("@scope/non-released"),
			pkg("@scope/dep", ["@scope/non-released"]),
			pkg("@scope/a", ["@scope/dep"]),
		]);

		const result = await Effect.runPromise(
			sortReleasesTopologically(["@scope/a", "@scope/dep"]).pipe(Effect.provide(layer)),
		);

		expect(result).toEqual(["@scope/dep", "@scope/a"]);
	});

	it("falls back to the input order when the sort fails", async () => {
		// a ↔ b form a cycle, so DependencyGraph.sortSubset fails with a
		// CyclicDependencyError and the helper returns the input order unchanged.
		const layer = makeDiscoveryLayer([pkg("@scope/a", ["@scope/b"]), pkg("@scope/b", ["@scope/a"]), pkg("@scope/dep")]);

		const result = await Effect.runPromise(
			sortReleasesTopologically(["@scope/a", "@scope/b", "@scope/dep"]).pipe(Effect.provide(layer)),
		);

		expect(result).toEqual(["@scope/a", "@scope/b", "@scope/dep"]);
	});
});
