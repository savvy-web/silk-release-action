/**
 * npm cache redirect for GitHub-hosted macOS runners.
 *
 * @remarks
 * GitHub's macOS runner images ship a partially root-owned `~/.npm/_cacache`.
 * npm hard-fails with `EACCES` (errno -13, exit 243, "Your cache folder
 * contains root-owned files") before doing any work, so `npm pack` /
 * `npm publish` / `npm view` all die on macOS runners. The predecessor
 * library (`@savvy-web/github-action-effects` 2.2.1, savvy-web/systems commit
 * `546c57d9`) fixed this by splicing `--cache <RUNNER_TEMP>/silk-npm-cache`
 * into every npm invocation. The v4 rebuild moved npm execution onto
 * `@effected/npm` (`NpmExecutor.dlx("npm@11")`), which offers no arg-splicing
 * seam — but npm honors the `npm_config_cache` environment variable in every
 * dispatch form, including `pnpm dlx npm@11`, and spawned children inherit
 * `process.env`.
 */

import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The directory npm should use as its cache, redirected off the
 * potentially root-owned `~/.npm/_cacache`.
 *
 * @param env - Environment record to read `RUNNER_TEMP` from. Defaults to
 *   `process.env`.
 * @returns `<RUNNER_TEMP>/silk-npm-cache`, or `<os.tmpdir()>/silk-npm-cache`
 *   when `RUNNER_TEMP` is unset (e.g. running outside a GitHub Actions job).
 */
export function npmCacheDir(env: Readonly<Record<string, string | undefined>> = process.env): string {
	return join(env.RUNNER_TEMP ?? tmpdir(), "silk-npm-cache");
}

/**
 * Set `npm_config_cache` on `env` to {@link npmCacheDir}'s result, unless
 * `env.npm_config_cache` is already set — an explicitly configured cache is
 * always respected.
 *
 * @param env - Environment record to mutate in place. Defaults to
 *   `process.env`.
 */
export function ensureNpmCacheEnv(env: Record<string, string | undefined> = process.env): void {
	if (env.npm_config_cache === undefined) {
		env.npm_config_cache = npmCacheDir(env);
	}
}
