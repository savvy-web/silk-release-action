/**
 * Phase 1 native versioning: validate the changeset config, then drive the
 * bundled silk-effects `ReleasePlanner.apply` — the same engine `savvy
 * changeset version` runs — with the configured changelog id mapped onto an
 * action-shipped module so no consumer `node_modules` is required.
 *
 * @remarks
 * The changelog generator's GitHub-info fetch (upstream
 * `@changesets/get-github-info`) reads `process.env.GITHUB_TOKEN` directly.
 * The action deliberately never sets that variable, so it is set from the App
 * token — read from `ActionState` through `GitHubToken.read()`, the same kit
 * member `main.ts` uses — only for the duration of the apply call, and
 * restored afterward. `apply` is not idempotent (it deletes consumed
 * changesets), so the transient-failure retry resets the working tree first.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Retry } from "@effected/commands";
import type { GitCommandError, NotARepositoryError, UnknownRefError } from "@effected/git";
import { Git } from "@effected/git";
import type { ActionOutputs, ActionState, ActionStateError, GitHubTokenError } from "@effected/github-actions";
import { GitHubToken, Secret } from "@effected/github-actions";
import { Changesets } from "@savvy-web/silk-effects";
import { Duration, Effect, FileSystem } from "effect";

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

/**
 * Whether a release-plan failure looks transient enough to reset and retry.
 *
 * @remarks
 * The pattern list is the kit's `Retry.TRANSIENT_PATTERNS` (11 entries), a
 * strict superset of the 5 this module used to carry — it adds `ECONNABORTED`,
 * `ECONNREFUSED`, `EHOSTUNREACH`, `ENETUNREACH`, `EPIPE` and `socket hang up`.
 * A deliberate widening, in the intended direction.
 *
 * The kit's `Retry.isTransient` **classifier** cannot be used: it takes a
 * `CommandFailedError` and reads `kind`/`stderr`/`stdout`/`cause`, none of
 * which a silk-effects `ReleasePlanError` has. Only the pattern list transfers.
 *
 * Comparison is case-insensitive to match the kit's own `matches`, which
 * lowercases both sides. The list this replaces compared case-sensitively.
 */
const isTransient = (reason: string): boolean => {
	const haystack = reason.toLowerCase();
	return Retry.TRANSIENT_PATTERNS.some((pattern) => haystack.includes(pattern.toLowerCase()));
};

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
const withGithubTokenEnv = <A, E, R>(
	use: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | ActionStateError | GitHubTokenError, R | ActionOutputs | ActionState> =>
	Effect.acquireUseRelease(
		Effect.gen(function* () {
			const previous = process.env.GITHUB_TOKEN;
			// `Secret.forProcessEnv`, NOT a bare `Redacted.value`. Declassification
			// lives in one kit module, and this is its member for a value bound for
			// the AMBIENT environment — as opposed to `forChildEnv` (a child's
			// environment), `forRunnerFile` (`GITHUB_STATE` / `GITHUB_OUTPUT`) or
			// `forSigning` (stays in this process). It masks the token with the
			// runner on the way out, so if it ever surfaces in a stack trace, a
			// serialized error or a debug log of outgoing headers, it comes out
			// redacted.
			//
			// `ActionEnvironment.withEnv` is deliberately NOT used here, and cannot
			// be: it is fiber-local and "`process.env` is never mutated"
			// (ActionEnvironment.ts). `@changesets/get-github-info` reads
			// `process.env.GITHUB_TOKEN` off the real ambient environment, so a
			// fiber-local override is invisible to it.
			//
			// The kit still declines to do the mutation itself — a write from
			// inside would be invisible to the seeding every consumer's assumptions
			// rest on — so the assignment below and the restore arm at the bottom
			// are ours to own. That is the documented division for this member, not
			// a workaround.
			//
			// The SOURCE is `GitHubToken.read()` — the persisted App token, straight
			// from `ActionState`. It used to arrive through a `process.env.STATE_token`
			// bridge that `main.ts` wrote and `utils/tokens.ts` read back: a second
			// plaintext copy of the credential, living for the whole process, to
			// hand one function a value the kit already serves. `read()` also fails
			// typed when the token is spent, which the bridge answered as `""`.
			const installation = yield* GitHubToken.read();
			process.env.GITHUB_TOKEN = yield* Secret.forProcessEnv(installation.token);
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
	| ActionStateError
	| Changesets.ReleasePlanError
	| Changesets.ConfigurationError
	| GitCommandError
	| NotARepositoryError
	| UnknownRefError
	| GitHubTokenError,
	ActionOutputs | ActionState | Changesets.ReleasePlanner | Changesets.ConfigInspector | Git | FileSystem.FileSystem
> =>
	Effect.gen(function* () {
		yield* requireValidConfig(cwd);
		const git = yield* Git;
		const planner = yield* Changesets.ReleasePlanner;

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
		// Not a bare `Effect.retry`: `apply` is NOT idempotent — it deletes the
		// changesets it consumes — so a retry on a half-applied tree would corrupt
		// the release. The tree must be reset first.
		//
		// Both members FAIL LOUDLY on a non-zero exit (a typed `GitCommandError`),
		// matching the `Run.text` they replace: a reset that silently did nothing
		// would hand the retry the same dirty tree.
		//
		// Both are pinned to `cwd` — the SAME directory `requireValidConfig` and
		// `planner.apply` operate on. Without it they run in the ambient process
		// CWD, so when `cwd !== process.cwd()` the reset cleans the wrong tree and
		// the retry then re-applies onto a still half-applied release tree.
		yield* git.restore(cwd, ["."]);
		yield* git.clean(cwd, { directories: true });
		yield* Effect.sleep(Duration.seconds(1));
		return yield* applyOnce();
	});
