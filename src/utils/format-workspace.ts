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

import type { CommandFailedError, CommandOutputError } from "@effected/commands";
import { Run, Tool, ToolDiscovery } from "@effected/commands";
import { Effect, FileSystem } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import { ChildProcess } from "effect/unstable/process";

/** Conditionally format the working tree with the standalone Biome binary. @public */
export const formatWorkspaceWithBiome = (): Effect.Effect<
	void,
	CommandFailedError | CommandOutputError,
	ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | ToolDiscovery
> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const tools = yield* ToolDiscovery;

		let hasConfig = false;
		for (const candidate of ["biome.jsonc", "biome.json"]) {
			if (hasConfig) break;
			hasConfig = yield* fs.exists(candidate).pipe(Effect.orElseSucceed(() => false));
		}
		if (!hasConfig) return;

		// `ToolDiscovery.isAvailable` replaces a `biome --version` probe that read
		// its own FAILURE as "absent", conflating a missing binary with one that
		// ran and exited non-zero. The kit separates them at the right seam: a
		// spawn that completes proves existence *whatever the exit code*, and only
		// a spawn failure proves absence. It also never fails, so there is no
		// error arm to misinterpret.
		if (!(yield* tools.isAvailable(Tool.named("biome")))) {
			yield* Effect.logWarning("biome.json(c) present but biome is not on PATH; skipping post-version format");
			return;
		}

		yield* Effect.logInfo("Formatting version output with Biome");
		// `Run.text`, not `Run.collect`: `text` treats a non-zero exit as a typed
		// FAILURE, which keeps this branch structurally identical to the
		// `execCapture` version it replaces. `collect` would demote a non-zero exit
		// to a success value and force the prose test into a different arm.
		const format = yield* Effect.result(Run.text(ChildProcess.make("biome", ["format", "--write", "."])));
		if (format._tag === "Failure") {
			// Narrowed to `CommandFailedError`: a `CommandOutputError` means the
			// output could not be USED (over the byte ceiling), which is never the
			// unresolvable-config case and carries no `stderr` to match against. It
			// falls straight through to the failure below.
			//
			// Still a PROSE match, deliberately. Biome reports an unresolvable
			// `extends` only in its message text; the kit's `kind` discriminant
			// (`nonZero` / `spawn` / `timeout`) cannot distinguish it from any other
			// non-zero exit, and there is no structured alternative to reach for.
			// `stderr` carries the full captured text; `message` only carries a tail
			// of it, so both are searched.
			const failure = format.failure;
			const detail =
				failure._tag === "CommandFailedError" ? `${failure.stderr ?? ""} ${failure.message}` : failure.message;
			if (failure._tag === "CommandFailedError" && /could not resolve|module not found/i.test(detail)) {
				yield* Effect.logWarning(
					`biome config depends on installed packages, unavailable in a zero-install phase; skipping post-version format: ${detail.trim()}`,
				);
				return;
			}
			return yield* Effect.fail(failure);
		}
	});
