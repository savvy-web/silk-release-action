/**
 * The npm pin × `@effected/npm` pair, proven against recorded npm output.
 *
 * `NPM_EXECUTOR` (`src/release/publish.ts`) pins which npm every pack and
 * publish runs through, and the installed `@effected/npm` decodes that npm's
 * `pack --json`. The two are versioned independently and only meet at
 * runtime: npm 12.0.0 changed `pack --json` from an array to a name-keyed
 * object, and `@effected/npm` < 0.14.2 failed every package with
 * `PublishError kind:"output"` while `npm pack` exited 0 and the tarball was
 * written (savvy-web/silk-release-action#424).
 *
 * The suite runs the REAL `PackagePublish.layer` and the real pnpm
 * `LocalExec` launcher — only the spawner is scripted, replaying output
 * recorded from the actual binaries (`pnpm dlx npm@<v> pack --dry-run --json`
 * in `__test__/integration/fixtures/public-package`, 2026-09-19). So the
 * decoder under test is the installed kit's, the argv under test is the one
 * the action ships, and the fixture contains the disputed case — the
 * name-keyed object — not a hand-written approximation of it. What it cannot
 * see is npm 12.x changing shape again after 12.0.2; re-record the fixture
 * whenever the pin moves.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { LocalExec, ScriptedSpawner } from "@effected/commands";
import { PackagePublish, PublishError } from "@effected/npm";
import { Effect, Layer } from "effect";
import { NPM_EXECUTOR, npmPublishExecutor } from "../../../src/release/publish.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const packageDir = fileURLToPath(new URL("../../integration/fixtures/public-package", import.meta.url));

const fixture = (name: string): string =>
	readFileSync(fileURLToPath(new URL(`fixtures/npm-pack-json/${name}`, import.meta.url)), "utf8");

/** npm 11: an array of pack entries. */
const NPM_11_OUTPUT = fixture("npm-11.19.1.json");
/** npm 12: an object keyed by package name — the shape that broke 0.14.1. */
const NPM_12_OUTPUT = fixture("npm-12.0.2.json");

/**
 * The real publish service over a spawner that answers `pnpm dlx npm@… pack`
 * with the given recorded output. `NodeServices.layer` also carries a real
 * `ChildProcessSpawner`; the scripted one is merged LAST so it wins.
 */
const makeHarness = (stdout: string) => {
	const spawner = ScriptedSpawner.make((command) =>
		command === "pnpm" ? { exit: 0, stdout, stderr: "" } : ScriptedSpawner.notFound(command),
	);
	const layer = PackagePublish.layer.pipe(
		Layer.provide(
			Layer.mergeAll(NodeServices.layer, LocalExec.layerFor("pnpm", { directory: repoRoot }), spawner.layer),
		),
	);
	return { spawner, layer };
};

describe("npm pin × @effected/npm pack --json", () => {
	// Plain `it`: nothing to run, only the spec the action ships to read — not a
	// copy of it, so a drift here is a drift in `publish.ts`.
	it("the pinned npm line is 12.x", () => {
		expect(JSON.stringify(NPM_EXECUTOR)).toContain("npm@12");
	});

	it.effect("dispatches `pack --dry-run --json` as `pnpm dlx npm@12`, never the ambient npm", () =>
		Effect.gen(function* () {
			const { spawner, layer } = makeHarness(NPM_12_OUTPUT);
			const publish = yield* PackagePublish.pipe(Effect.provide(layer));
			yield* publish.dryRun(packageDir, { executor: NPM_EXECUTOR });

			const spawn = spawner.spawns[0];
			expect(spawn?.command).toBe("pnpm");
			expect(spawn?.args.slice(0, 2)).toEqual(["dlx", "npm@12"]);
			expect(spawn?.args).toContain("pack");
			expect(spawn?.args).toContain("--json");
		}),
	);

	it.effect("decodes npm 12's name-keyed `pack --json` (the shape that broke @effected/npm 0.14.1)", () =>
		Effect.gen(function* () {
			const { layer } = makeHarness(NPM_12_OUTPUT);
			const publish = yield* PackagePublish.pipe(Effect.provide(layer));
			const outcome = yield* publish.dryRun(packageDir, { executor: NPM_EXECUTOR });

			expect(outcome.ok).toBe(true);
			expect(outcome.fileCount).toBe(2);
			expect(outcome.unpackedSize).toBe(197);
		}),
	);

	it.effect("still decodes npm 11's array-shaped `pack --json`", () =>
		Effect.gen(function* () {
			const { layer } = makeHarness(NPM_11_OUTPUT);
			const publish = yield* PackagePublish.pipe(Effect.provide(layer));
			const outcome = yield* publish.dryRun(packageDir, { executor: NPM_EXECUTOR });

			expect(outcome.ok).toBe(true);
			expect(outcome.fileCount).toBe(2);
			expect(outcome.unpackedSize).toBe(197);
		}),
	);

	// The publish executor's `--prefix` must reach npm's argv through the real
	// kit, not only sit on the value: `withExtraArgs` is the kit's seam, and
	// this is where a kit change that stopped honouring it would show.
	it.effect("dispatches `publish` with `--prefix`, so npm never reads the repository's devEngines", () =>
		Effect.gen(function* () {
			const { spawner, layer } = makeHarness("");
			const publish = yield* PackagePublish.pipe(Effect.provide(layer));
			yield* publish.publishTarball("/abs/pkg-1.0.0.tgz", {
				registry: "https://registry.npmjs.org/",
				executor: npmPublishExecutor("/runner/_temp/silk-npm-prefix"),
			});

			const args = spawner.spawns[0]?.args ?? [];
			expect(args.slice(0, 2)).toEqual(["dlx", "npm@12"]);
			expect(args).toContain("publish");
			const at = args.indexOf("--prefix");
			expect(at).toBeGreaterThan(args.indexOf("publish"));
			expect(args[at + 1]).toBe("/runner/_temp/silk-npm-prefix");
		}),
	);

	// Positive control: the decoder discriminates. An output that is neither
	// shape must surface as the typed `output` failure 0.14.1 raised on npm 12,
	// so the two green cases above cannot be green by never inspecting stdout.
	it.effect("fails typed with kind `output` on unreadable output", () =>
		Effect.gen(function* () {
			const { layer } = makeHarness("not json");
			const publish = yield* PackagePublish.pipe(Effect.provide(layer));
			const error = yield* publish.dryRun(packageDir, { executor: NPM_EXECUTOR }).pipe(Effect.flip);

			expect(error).toBeInstanceOf(PublishError);
			expect(error.kind).toBe("output");
		}),
	);
});
