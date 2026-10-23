/**
 * Unit tests for `resolvePublishTargetSpecs` — the per-target release filter.
 *
 * @remarks
 * Runs the REAL silk-effects detector (`SilkPublishability.layer`) over an
 * in-memory volume seeded with the `package.json` / `dist/prod/targets.json`
 * files the real code reads, so the join from a detected target back to its
 * `publishConfig.targets` declaration is exercised rather than assumed.
 */

import { describe, expect, it } from "@effect/vitest";
import { MemoryFileSystem } from "@effected/memfs";
import { WorkspacePackage } from "@effected/workspaces";
import { SilkPublishability } from "@savvy-web/silk-effects";
import { Effect, Layer } from "effect";
import { resolvePublishTargetSpecs } from "../../../src/release/resolve-targets.js";

const ROOT = "/ws";
const PKG_PATH = "/ws/pkg";

const wsPkg = WorkspacePackage.make({
	name: "@scope/pkg",
	version: "1.2.0",
	path: PKG_PATH,
	packageJsonPath: `${PKG_PATH}/package.json`,
	relativePath: "pkg",
	workspaceRoot: ROOT,
});

const PNPR = "https://pnpr.example.com/";

const manifest = {
	name: "@scope/pkg",
	version: "1.2.0",
	private: true,
	publishConfig: {
		access: "public",
		targets: {
			npm: { releases: "stable" },
			pnpr: { registry: PNPR, releases: "all" },
		},
	},
};

const volume = (files: Record<string, unknown>) =>
	MemoryFileSystem.layerWith(
		Object.fromEntries(
			Object.entries(files).map(([path, content]) => [
				path,
				MemoryFileSystem.file(typeof content === "string" ? content : JSON.stringify(content)),
			]),
		),
	);

const resolveWith = (files: Record<string, unknown>, version: string) =>
	resolvePublishTargetSpecs(wsPkg, version).pipe(
		Effect.provide(SilkPublishability.layer.pipe(Layer.provideMerge(volume(files)))),
	);

describe("resolvePublishTargetSpecs", () => {
	it.effect("filters a stable-only target out of a prerelease and tags the rest with the prerelease channel", () =>
		Effect.gen(function* () {
			const resolved = yield* resolveWith({ [`${PKG_PATH}/package.json`]: manifest }, "1.2.0-beta.0");

			expect(resolved.targets.map((t) => t.registry)).toEqual([PNPR]);
			expect(resolved.targets[0]?.distTag).toBe("beta");
			expect(resolved.releaseFiltered.map((t) => t.registry)).toEqual(["https://registry.npmjs.org"]);
			// The filtered spec carries its own declared channel and the version-derived tag.
			expect(resolved.releaseFiltered[0]?.releases).toBe("stable");
			expect(resolved.releaseFiltered[0]?.distTag).toBe("beta");
			expect(resolved.targets[0]?.releases).toBe("all");
			expect(resolved.targetError).toBeUndefined();
		}),
	);

	it.effect("keeps every target at latest for a stable version", () =>
		Effect.gen(function* () {
			const resolved = yield* resolveWith({ [`${PKG_PATH}/package.json`]: manifest }, "1.2.0");

			expect(resolved.targets).toHaveLength(2);
			expect(resolved.targets.map((t) => t.distTag)).toEqual(["latest", "latest"]);
			expect(resolved.releaseFiltered).toEqual([]);
		}),
	);

	it.effect("reports a binding mismatch as targetError with nothing resolved, without failing", () =>
		Effect.gen(function* () {
			const binding = {
				groups: [{ id: "npm", name: "@scope/pkg", dir: "dist/prod/npm/pkg" }],
				targets: [
					{ id: "npm", group: "npm", name: "@scope/pkg", registry: "https://registry.npmjs.org" },
					{ id: "gh", group: "ghost", name: "@scope/pkg", registry: "https://npm.pkg.github.com" },
				],
			};
			const resolved = yield* resolveWith(
				{ [`${PKG_PATH}/package.json`]: manifest, [`${PKG_PATH}/dist/prod/targets.json`]: binding },
				"1.2.0",
			);

			// Pinned on the tag and fields: the message is prose upstream may reword.
			expect(resolved.targetError?._tag).toBe("PublishTargetBindingError");
			const error = resolved.targetError?._tag === "PublishTargetBindingError" ? resolved.targetError : undefined;
			expect(error?.pkg).toBe("@scope/pkg");
			expect(error?.boundDirectories.length).toBeGreaterThan(0);
			expect(error?.boundDirectories).not.toContain(error?.directory);
			expect(resolved.targets).toEqual([]);
			expect(resolved.releaseFiltered).toEqual([]);
		}),
	);

	// A bundler older than the `releases` field (silk-integration builds with
	// @savvy-web/bundler 2.5.4) writes a binding with no `releases` key. The
	// declared channel must survive the build rather than widen to "all".
	it.effect("keeps the manifest's releases channel when the built binding omits it", () =>
		Effect.gen(function* () {
			const binding = {
				groups: [
					{ id: "npm", name: "@scope/pkg", dir: "dist/prod/npm/pkg" },
					{ id: "pnpr", name: "@scope/pkg", dir: "dist/prod/pnpr/pkg" },
				],
				targets: [
					{ id: "npm", group: "npm", name: "@scope/pkg", registry: "https://registry.npmjs.org" },
					{ id: "pnpr", group: "pnpr", name: "@scope/pkg", registry: PNPR },
				],
			};
			const resolved = yield* resolveWith(
				{
					[`${PKG_PATH}/package.json`]: {
						...manifest,
						publishConfig: {
							...manifest.publishConfig,
							targets: { npm: {}, pnpr: { registry: PNPR, releases: "prerelease" } },
						},
					},
					[`${PKG_PATH}/dist/prod/targets.json`]: binding,
				},
				"1.2.0",
			);

			expect(resolved.targetError).toBeUndefined();
			expect(resolved.targets.map((t) => t.registry)).toEqual(["https://registry.npmjs.org"]);
			expect(resolved.releaseFiltered.map((t) => t.registry)).toEqual([PNPR]);
			expect(resolved.releaseFiltered[0]?.releases).toBe("prerelease");
		}),
	);

	it.effect("reports an unknown releases channel as targetError instead of guessing one", () =>
		Effect.gen(function* () {
			const resolved = yield* resolveWith(
				{
					[`${PKG_PATH}/package.json`]: {
						...manifest,
						publishConfig: { ...manifest.publishConfig, targets: { npm: { releases: "final" } } },
					},
				},
				"1.2.0",
			);

			// Pinned on the tag and fields: the message is prose upstream may reword.
			expect(resolved.targetError?._tag).toBe("ReleaseChannelError");
			const error = resolved.targetError?._tag === "ReleaseChannelError" ? resolved.targetError : undefined;
			expect(error?.pkg).toBe("@scope/pkg");
			expect(error?.id).toBe("npm");
			expect(error?.value).toBe('"final"');
			expect(resolved.targets).toEqual([]);
			expect(resolved.releaseFiltered).toEqual([]);
			expect(resolved.declared).toHaveLength(1);
		}),
	);
});
