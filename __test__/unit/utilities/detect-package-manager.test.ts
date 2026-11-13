import { describe, expect, it } from "@effect/vitest";
import { MemoryFileSystem } from "@effected/memfs";
import { PackageManagerDetector } from "@effected/workspaces";
import { Effect, Layer, Path } from "effect";
import { detectPackageManager } from "../../../src/utils/detect-package-manager.js";

/** The real detector over an in-memory volume seeded at the process's cwd, which is where it probes. */
const workspace = (files: Record<string, string>) =>
	PackageManagerDetector.layer.pipe(
		Layer.provide(
			Layer.merge(
				MemoryFileSystem.layerWith(
					Object.fromEntries(Object.entries(files).map(([name, content]) => [`${process.cwd()}/${name}`, content])),
				),
				Path.layer,
			),
		),
	);

describe("detectPackageManager", () => {
	it.effect("names pnpm for a workspace with pnpm-workspace.yaml", () =>
		Effect.gen(function* () {
			const name = yield* detectPackageManager;
			expect(name).toBe("pnpm");
		}).pipe(Effect.provide(workspace({ "package.json": '{"name":"root"}', "pnpm-workspace.yaml": "packages: []\n" }))),
	);

	it.effect("falls back to npm when the root carries no manager signal", () =>
		Effect.gen(function* () {
			const name = yield* detectPackageManager;
			expect(name).toBe("npm");
		}).pipe(Effect.provide(workspace({ "package.json": '{"name":"root"}' }))),
	);

	it.effect("refuses a yarn workspace instead of falling back to npm", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(detectPackageManager);
			expect(error._tag).toBe("UnsupportedPackageManagerError");
			expect(error.manager).toBe("yarn");
		}).pipe(Effect.provide(workspace({ "package.json": '{"name":"root"}', "yarn.lock": "# yarn lockfile v1\n" }))),
	);

	it.effect("refuses a manifest that declares yarn as its packageManager", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(detectPackageManager);
			expect(error._tag).toBe("UnsupportedPackageManagerError");
		}).pipe(Effect.provide(workspace({ "package.json": '{"name":"root","packageManager":"yarn@4.5.0"}' }))),
	);
});
