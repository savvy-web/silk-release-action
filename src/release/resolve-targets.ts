/**
 * Shared publish-target resolution.
 *
 * `resolvePublishableTargets` composes the `PublishabilityDetector` with the
 * built-`package.json` private filter — the exact path Phase-2 validation and
 * Phase-3 publish use to decide what is actually publishable.
 *
 * @module release/resolve-targets
 */

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { Effect } from "effect";
import type { PublishTarget, WorkspacePackage } from "workspaces-effect";
import { PublishabilityDetector } from "workspaces-effect";

/**
 * Report whether a built target directory's `package.json` is marked `private`.
 *
 * The build pipeline keeps `private: true` on dev-only build outputs and
 * rewrites it to `private: false` on real publish targets. A missing or
 * unreadable `package.json` is treated as not private.
 *
 * @param targetDir - Absolute path to the built target directory.
 * @returns `true` when the directory's `package.json` has `private: true`.
 */
export function isTargetPrivate(targetDir: string): boolean {
	const pkgJsonPath = join(targetDir, "package.json");
	if (!existsSync(pkgJsonPath)) {
		return false;
	}
	try {
		const parsed = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as { private?: boolean };
		return parsed.private === true;
	} catch {
		return false;
	}
}

/**
 * Resolve a package's publish targets via `PublishabilityDetector`, then drop
 * any whose built `package.json` is `private` — validation/publish only
 * exercise what will actually be published.
 *
 * @remarks
 * Each returned `PublishTarget.directory` is passed through unchanged from
 * `PublishabilityDetector` and may therefore be **package-relative**, not
 * absolute. The private-build filter resolves the directory internally
 * (against `pkg.path`) purely for its own `isTargetPrivate` check — the
 * returned targets are not mutated. A caller that treats `directory` as a
 * filesystem path must resolve it itself, e.g.
 * `isAbsolute(t.directory) ? t.directory : join(pkg.path, t.directory)` — this
 * is what `validation.ts` does for the dry-run `cwd` and SBOM directory.
 *
 * @param pkg - The workspace package to resolve targets for.
 * @param workspaceRoot - Absolute path to the workspace root.
 * @returns The publishable targets, with `private`-built targets removed.
 */
export const resolvePublishableTargets = (
	pkg: WorkspacePackage,
	workspaceRoot: string,
): Effect.Effect<ReadonlyArray<PublishTarget>, never, PublishabilityDetector> =>
	Effect.gen(function* () {
		const detector = yield* PublishabilityDetector;
		const targets = yield* detector.detect(pkg, workspaceRoot);
		return targets.filter((t) => !isTargetPrivate(isAbsolute(t.directory) ? t.directory : join(pkg.path, t.directory)));
	});
