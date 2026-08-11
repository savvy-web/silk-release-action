/**
 * Which package manager owns this workspace.
 *
 * @module utils/detect-package-manager
 */

import { PackageManagerDetector } from "@effected/workspaces";
import { Effect } from "effect";

/**
 * Which package manager owns this workspace.
 *
 * @remarks
 * Delegates to `@effected/workspaces`' `PackageManagerDetector`, which owns
 * this question for the whole kit. The hand-rolled version this replaces read
 * only the top-level `packageManager` field (through a bare `JSON.parse` in a
 * `try`/`catch`) and then probed lockfiles; the detector additionally consults
 * `devEngines.packageManager`, which is **authoritative for the name** —
 * corepack *errors* when a top-level `packageManager` disagrees with it. This
 * repo's own `package.json` carries both, so the old code could disagree with
 * corepack about a workspace it was invoked on.
 *
 * A detection failure falls back to `"npm"`, preserving the prior behaviour and
 * its reasoning: defaulting to `"npm"` on a no-signal repo is honest, where the
 * `"pnpm"` default before it risked invoking a manager the workspace does not
 * actually use.
 *
 * @public
 */
export const detectPackageManager: Effect.Effect<"npm" | "pnpm" | "yarn" | "bun", never, PackageManagerDetector> =
	Effect.gen(function* () {
		const detector = yield* PackageManagerDetector;
		const detected = yield* Effect.result(detector.detect(process.cwd()));
		if (detected._tag === "Success") return detected.success.name;
		yield* Effect.logDebug(`Package-manager detection found no signal; defaulting to npm`);
		return "npm" as const;
	});
