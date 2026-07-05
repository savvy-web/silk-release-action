/**
 * Post-version formatting: when the repo carries a Biome config, run the
 * standalone `biome` binary (installed by silk-runtime-action) over the
 * working tree — replacing the `&& biome format --write .` tail of the
 * removed consumer `ci:version` script.
 *
 * @remarks
 * Missing binary with a present config is a warning, not a failure: Phase 1
 * must stay usable on runners that skip Biome setup. Likewise a config the
 * standalone binary cannot resolve — silk-suite repos `extends` the
 * `@savvy-web/silk/biome` package, which only exists with `node_modules`
 * installed, and Phase 1 is deliberately zero-install — is a warning, not a
 * failure. Any other non-zero format exit is a failure — the repo asked for
 * formatting and it genuinely errored.
 */

import { FileSystem } from "@effect/platform";
import type { CommandRunnerError } from "@savvy-web/github-action-effects";
import { CommandRunner } from "@savvy-web/github-action-effects";
import { Effect } from "effect";

/** Conditionally format the working tree with the standalone Biome binary. @public */
export const formatWorkspaceWithBiome = (): Effect.Effect<
	void,
	CommandRunnerError,
	CommandRunner | FileSystem.FileSystem
> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const runner = yield* CommandRunner;

		const hasConfig = yield* Effect.reduce(["biome.jsonc", "biome.json"], false, (found, candidate) =>
			found ? Effect.succeed(true) : fs.exists(candidate).pipe(Effect.orElseSucceed(() => false)),
		);
		if (!hasConfig) return;

		const probe = yield* Effect.either(runner.execCapture("biome", ["--version"]));
		if (probe._tag === "Left") {
			yield* Effect.logWarning("biome.json(c) present but biome is not on PATH; skipping post-version format");
			return;
		}

		yield* Effect.logInfo("Formatting version output with Biome");
		const format = yield* Effect.either(runner.execCapture("biome", ["format", "--write", "."]));
		if (format._tag === "Left") {
			const detail = `${format.left.stderr ?? ""} ${format.left.reason}`;
			if (/could not resolve|module not found/i.test(detail)) {
				yield* Effect.logWarning(
					`biome config depends on installed packages, unavailable in a zero-install phase; skipping post-version format: ${detail.trim()}`,
				);
				return;
			}
			return yield* Effect.fail(format.left);
		}
	});
