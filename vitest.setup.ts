/**
 * Global Vitest setup — runs once before all test files, in the process the
 * fork pool inherits its environment from.
 *
 * @remarks
 * Keeps the suite hermetic when it runs INSIDE a GitHub Actions runner: the
 * entry points (`src/pre.ts`, `src/main.ts`, `src/post.ts`) execute `Action.run`
 * behind a `GITHUB_ACTIONS` guard, so a CI test process that imports them with
 * the variable set would run the action mid-suite. `__test__/pre.test.ts` and
 * `__test__/post.test.ts` import those modules directly, so under `pnpm ci:test`
 * — where the runner sets `GITHUB_ACTIONS=1` — this is not hypothetical.
 *
 * Ambient `INPUT_*` variables would likewise leak the workflow's own inputs
 * into `ActionInput` reads, and `STATE_*` the previous phase's state.
 */
export function setup(): void {
	delete process.env.GITHUB_ACTIONS;
	for (const name of Object.keys(process.env)) {
		if (name.startsWith("INPUT_") || name.startsWith("STATE_")) {
			delete process.env[name];
		}
	}
}
