/**
 * Main entry point: guard and run, nothing else.
 *
 * @remarks
 * The program lives in `program.ts` so tests import it without module-level
 * execution, and the layer graph lives in `layers/app.ts`. The
 * `GITHUB_ACTIONS` guard is the uniform entry idiom on every entry file.
 *
 * @module main
 */

import { Action } from "@effected/github-actions";
import { MainLive } from "./layers/app.js";
import { main } from "./program.js";

/* v8 ignore next 3 -- entry-point guard, only runs in GitHub Actions */
if (process.env.GITHUB_ACTIONS) {
	await Action.run(main, { layer: MainLive });
}
