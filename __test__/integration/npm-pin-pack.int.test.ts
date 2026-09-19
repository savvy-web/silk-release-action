/**
 * The npm pin × `@effected/npm` pair, proven against the real binary.
 *
 * `NPM_EXECUTOR` (`src/release/publish.ts`) pins which npm every pack and
 * publish runs through, and the installed `@effected/npm` decodes that npm's
 * `pack --json`. The two are versioned independently and only meet at
 * runtime: npm 12.0.0 changed `pack --json` from an array to a name-keyed
 * object, and `@effected/npm` < 0.14.2 failed every package with
 * `PublishError kind:"output"` while `npm pack` exited 0 and the tarball was
 * written (savvy-web/silk-release-action#424). No unit double can see that
 * break, so this suite fetches the pinned npm through the same pnpm `dlx`
 * launcher the action uses and drives `PackagePublish.dryRun` against a
 * fixture package — the exact call `publish-validation` makes.
 *
 * Network: the first run fetches the npm tarball through pnpm's store; later
 * runs are served from the store.
 */

import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { LocalExec } from "@effected/commands";
import { PackagePublish } from "@effected/npm";
import { Effect, Layer } from "effect";
import { NPM_EXECUTOR } from "../../src/release/publish.js";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixtureDir = fileURLToPath(new URL("fixtures/public-package", import.meta.url));

const PackagePublishLive = PackagePublish.layer.pipe(
	Layer.provide(LocalExec.layerFor("pnpm", { directory: repoRoot })),
	Layer.provide(NodeServices.layer),
);

// A cold pnpm store has to fetch the npm tarball before the first `--version`.
const NETWORK_TIMEOUT_MS = 180_000;

describe("npm pin × @effected/npm pack --json", () => {
	// Plain `it`: nothing to run, only the spec the action ships to read — not a
	// copy of it, so a drift here is a drift in `publish.ts`.
	it("the pinned npm line is 12.x", () => {
		expect(JSON.stringify(NPM_EXECUTOR)).toContain("npm@12");
	});

	it.effect(
		"`PackagePublish.dryRun` through the pinned executor decodes the real `pack --json` output",
		() =>
			Effect.gen(function* () {
				const publish = yield* PackagePublish;
				const outcome = yield* publish.dryRun(fixtureDir, { executor: NPM_EXECUTOR });
				expect(outcome.ok).toBe(true);
				expect(outcome.fileCount).toBeGreaterThan(0);
			}).pipe(Effect.provide(PackagePublishLive)),
		NETWORK_TIMEOUT_MS,
	);
});
