/**
 * The main-phase program: pure composition.
 *
 * @remarks
 * This module holds ONLY the pipeline — read the inputs once, resolve the
 * workflow phase, and run the one step that phase names. No I/O of its own
 * beyond what those three things require, no formatting (that is
 * `release/report.ts` and friends), no step bodies (those are `steps/*`).
 *
 * `detectWorkflowPhase` reads the GitHub event context through `GitHubClient`
 * + `ActionEnvironment`, honouring an explicit `phase` input when set, and
 * routes to the matching step:
 *
 * - `branch-management` — create/update the release branch and PR (Phase 1)
 * - `validation` — build validation, publish dry-runs, release-notes preview (Phase 2)
 * - `publishing` — multi-registry publish, GitHub releases, SBOM/attestation (Phase 3)
 * - `close-issues` — close issues linked to the merged release PR
 *
 * An absent or unrecognized phase falls through to a no-op.
 *
 * Exported so tests can run it against test layers without module-level
 * execution; `main.ts` does nothing but guard and run it.
 *
 * @module program
 */

import { GitHubToken } from "@effected/github-actions";
import { Effect, Option } from "effect";
import { readInputs } from "./schema/inputs.js";
import { branchManagement } from "./steps/branch-management.js";
import { runCloseIssues } from "./steps/close-issues.js";
import { runPublishing } from "./steps/publishing.js";
import { runValidation } from "./steps/validation.js";
import { detectWorkflowPhase } from "./utils/detect-workflow-phase.js";
import { ensureNpmCacheEnv } from "./utils/npm-cache.js";

/**
 * The main-phase program `Action.run` executes.
 *
 * @public
 */
export const main = Effect.gen(function* () {
	// Redirect npm's cache off the potentially root-owned `~/.npm/_cacache` on
	// GitHub's macOS runners, before any phase (including Phase 2 dry-runs and
	// npm view calls) runs a single npm command. See `utils/npm-cache.ts`.
	ensureNpmCacheEnv();

	// The installation token provisioned by pre.ts, read back for the identity
	// diagnostics below. Nothing is bridged into the process environment:
	// `process.env.GITHUB_TOKEN` is never set here, and the `STATE_token` bridge
	// that stood here is DELETED, not moved.
	//
	// It existed so `utils/tokens.ts` could hand the raw token to
	// `native-version.ts`, whose changelog worker reaches for
	// `process.env.GITHUB_TOKEN`. That module now calls `GitHubToken.read()`
	// itself — the same member on the line below — and sets the variable only
	// for the duration of the apply. So the credential no longer sits in the
	// process environment of every subsequent operation as a second plaintext
	// copy, and `utils/tokens.ts` is gone entirely; it was down to one function
	// with one caller.
	const installationToken = yield* GitHubToken.read();

	// The `STATE_githubToken` bridge that stood here is DELETED, not moved.
	//
	// It wrote the workflow's `github-token` into the process environment as
	// PLAINTEXT — no `Secret` member anywhere on that path — for
	// `tokens.ts`'s `packagesToken()`, whose only consumer was
	// `registry-auth.setupRegistryAuth`. That module was deleted at 0f91109
	// (#90) along with the `custom-registries` implementation, so
	// `packagesToken()` has had no production caller since. Its own test file
	// was the only thing importing it.
	//
	// So this was an unmasked secret written into the environment of every
	// subsequent in-process operation, to serve a function nobody called. The
	// token is still persisted to `ActionState` by `pre` and still read from
	// there by anything that needs it; nothing lost but the exposure.

	// Identity diagnostics — the App identity resolved by `provision`.
	if (installationToken.appName !== undefined || installationToken.appSlug !== undefined) {
		yield* Effect.logInfo(`Using GitHub App token (${installationToken.appName ?? installationToken.appSlug})`);
	}

	// Every `action.yml` input, decoded ONCE, here. The defaults live in
	// `action.yml` and are mirrored in `schema/inputs.ts`; no call site below
	// restates one, which is what stops the six copies of
	// `"changeset-release/main"` this replaced from drifting apart.
	const inputs = yield* readInputs;

	// Routing. `inputs.phase` is an `Option<WorkflowPhase>` DECODED against the
	// literal union, not `explicitInput as WorkflowPhase`. Under the cast a typo
	// (`publshing`) satisfied the type, missed every arm of the switch below,
	// fell through to `default:` and returned — the whole release silently did
	// nothing and the job went green. The decode fails the run instead.
	const phaseResult = yield* detectWorkflowPhase({
		releaseBranch: inputs.releaseBranch,
		targetBranch: inputs.targetBranch,
		...(Option.isSome(inputs.phase) && { explicitPhase: inputs.phase.value }),
	});

	yield* Effect.logInfo(`Phase: ${phaseResult.phase} — ${phaseResult.reason}`);

	switch (phaseResult.phase) {
		case "branch-management":
			yield* branchManagement(inputs);
			return;
		case "validation":
			yield* runValidation(inputs);
			return;
		case "publishing":
			yield* runPublishing(inputs, phaseResult.mergedReleasePRNumber);
			return;
		case "close-issues":
			yield* runCloseIssues();
			return;
		default:
			yield* Effect.logInfo(`No-op phase: ${phaseResult.reason}`);
			return;
	}
});
