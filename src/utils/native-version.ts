/**
 * Phase 1 native versioning: validate the changeset config, then drive the
 * bundled silk-effects `ReleasePlanner.apply` — the same engine `savvy
 * changeset version` runs — with the configured changelog id mapped onto an
 * action-shipped module so no consumer `node_modules` is required.
 *
 * @remarks
 * The changelog generator's GitHub-info fetch (upstream
 * `@changesets/get-github-info`) reads `process.env.GITHUB_TOKEN` directly.
 * The action deliberately never sets that variable (see `tokens.ts`), so it
 * is set from the App token only for the duration of the apply call and
 * restored afterward. `apply` is not idempotent (it deletes consumed
 * changesets), so the transient-failure retry resets the working tree first.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CommandRunnerError } from "@savvy-web/github-action-effects";
import { CommandRunner } from "@savvy-web/github-action-effects";
import { Changesets } from "@savvy-web/silk-effects";
import { Duration, Effect, FileSystem, Redacted } from "effect";
import { appToken } from "./tokens.js";

/** At runtime `import.meta.url` is `dist/main.js`, so this resolves into `dist/`. */
const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Known changelog ids → action-shipped module absolute paths. An id outside
 * this map fails inside `ReleasePlanner.apply` with a typed error naming it.
 */
export const CHANGELOG_MODULES: Readonly<Record<string, string>> = {
	"@savvy-web/changelog": resolve(HERE, "changelog-silk.js"),
	"@savvy-web/silk/changesets/changelog": resolve(HERE, "changelog-silk.js"),
	"@savvy-web/changesets/changelog": resolve(HERE, "changelog-silk.js"),
	"@changesets/cli/changelog": resolve(HERE, "changelog-default.js"),
};

/** Reason substrings treated as transient (mirrors the removed execWithRetry). */
const TRANSIENT_REASONS = ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "fetch failed"];

const isTransient = (reason: string): boolean => TRANSIENT_REASONS.some((code) => reason.includes(code));

/**
 * Require a valid `.changeset/config.json` when one exists (absent config
 * proceeds, matching the savvy CLI's version gate).
 *
 * @internal
 */
const requireValidConfig = (
	cwd: string,
): Effect.Effect<void, Changesets.ConfigurationError, Changesets.ConfigInspector | FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const configPath = resolve(cwd, ".changeset", "config.json");
		const hasConfig = yield* fs.exists(configPath).pipe(Effect.orElseSucceed(() => false));
		if (!hasConfig) return;
		const inspector = yield* Changesets.ConfigInspector;
		yield* inspector.inspect(cwd);
	});

/**
 * Set `GITHUB_TOKEN` from the App token around `use`, restoring the prior
 * state after.
 *
 * @remarks
 * When the App token is non-empty it is set unconditionally, overriding any
 * ambient `GITHUB_TOKEN` already present in the job environment for the
 * duration of the apply, so the changelog GitHub-info fetch always uses the
 * action's own identity rather than whatever token the job happens to export.
 * @remarks
 * This mutates shared process env and is not parallel-safe. Phase 1 runs
 * strictly sequentially — do not invoke concurrent applies while this is in
 * effect.
 */
const withGithubTokenEnv = <A, E, R>(use: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
	Effect.acquireUseRelease(
		Effect.sync(() => {
			const previous = process.env.GITHUB_TOKEN;
			const token = Redacted.value(appToken());
			if (token !== "") {
				process.env.GITHUB_TOKEN = token;
			}
			return previous;
		}),
		() => use,
		(previous) =>
			Effect.sync(() => {
				if (previous === undefined) delete process.env.GITHUB_TOKEN;
				else process.env.GITHUB_TOKEN = previous;
			}),
	);

/**
 * Natively apply pending changesets with a single reset-then-retry on
 * transient network failure.
 *
 * @public
 */
export const runNativeVersion = (
	cwd: string,
): Effect.Effect<
	Changesets.AppliedRelease,
	Changesets.ReleasePlanError | Changesets.ConfigurationError | CommandRunnerError,
	Changesets.ReleasePlanner | Changesets.ConfigInspector | CommandRunner | FileSystem.FileSystem
> =>
	Effect.gen(function* () {
		yield* requireValidConfig(cwd);
		const planner = yield* Changesets.ReleasePlanner;
		const runner = yield* CommandRunner;

		// A thunk, not a constructed Effect: `planner.apply` must be invoked fresh
		// on the retry so a stateful test double (or the live service) actually
		// runs again, rather than re-running the first attempt's already-settled
		// Effect value.
		const applyOnce = () => withGithubTokenEnv(planner.apply(cwd, { changelogModules: CHANGELOG_MODULES }));

		const first = yield* Effect.result(applyOnce());
		if (first._tag === "Success") return first.success;
		if (!isTransient(first.failure.reason)) return yield* Effect.fail(first.failure);

		yield* Effect.logWarning(
			`Native version failed transiently (${first.failure.reason}); resetting and retrying once`,
		);
		yield* runner.exec("git", ["checkout", "--", "."]);
		yield* runner.exec("git", ["clean", "-fd"]);
		yield* Effect.sleep(Duration.seconds(1));
		return yield* applyOnce();
	});
