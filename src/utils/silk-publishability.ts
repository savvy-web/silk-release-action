/**
 * Silk-flavored publishability rules.
 *
 * @remarks
 * The vanilla `PublishabilityDetectorLive` from `workspaces-effect` treats
 * `package.json#private: true` as "not publishable" full stop. The silk-suite
 * convention extends that:
 *
 * 1. A private package whose `publishConfig.access` is set is still
 *    publishable to one target.
 * 2. A private package with `publishConfig.targets` (an array of target
 *    specs) is publishable to one or more targets — string targets inherit
 *    parent access, object targets may override.
 * 3. Shorthand target names (e.g., `"npm"` / `"github"` / `"jsr"`) are
 *    accepted as string-form targets; the consumer maps shorthand to a
 *    registry URL at publish time.
 *
 * This mirrors the canonical implementation at
 * `pnpm-config-dependency-action/src/services/publishability.ts` so that the
 * workflow-release-action agrees with the dependency-update action about
 * which packages count as publishable.
 */

import { PublishTarget } from "workspaces-effect";

const DEFAULT_REGISTRY = "https://registry.npmjs.org/";

/**
 * Raw `publishConfig.targets` entry: either a shorthand/url string, or a
 * partial spec that may override access/registry.
 */
export type RawTargetSpec =
	| string
	| {
			readonly access?: "public" | "restricted";
			readonly protocol?: string;
			readonly registry?: string;
	  };

/**
 * Subset of `publishConfig` needed for publishability rules.
 */
export interface RawPublishConfig {
	readonly access?: "public" | "restricted";
	readonly registry?: string;
	readonly directory?: string;
	readonly targets?: ReadonlyArray<RawTargetSpec>;
}

/**
 * Subset of `package.json` needed for publishability rules.
 */
export interface RawPackageJson {
	readonly name?: string;
	readonly version?: string;
	readonly private?: boolean;
	readonly publishConfig?: RawPublishConfig;
}

function resolveTargetAccess(
	target: RawTargetSpec,
	parentAccess: "public" | "restricted" | undefined,
): "public" | "restricted" | undefined {
	if (typeof target === "string") return parentAccess;
	return target.access ?? parentAccess;
}

/**
 * Apply the silk publishability rules to a parsed package.json.
 *
 * @param pkgName - Package name (used to populate `PublishTarget.name`)
 * @param raw - Parsed package.json contents
 * @returns Publish targets. Empty array means "not publishable".
 *
 * @remarks
 * Rules:
 * - `private !== true` → one public target (with defaults)
 * - `private === true` + `publishConfig.targets` → one target per spec that
 *   resolves to public/restricted access
 * - `private === true` + `publishConfig.access` (no targets) → one target
 * - Otherwise → `[]`
 */
export function silkDetect(pkgName: string, raw: RawPackageJson): ReadonlyArray<PublishTarget> {
	if (raw.private !== true) {
		return [
			new PublishTarget({
				name: pkgName,
				registry: raw.publishConfig?.registry ?? DEFAULT_REGISTRY,
				directory: raw.publishConfig?.directory ?? ".",
				access: raw.publishConfig?.access ?? "public",
			}),
		];
	}

	const pc = raw.publishConfig;
	if (!pc) return [];

	if (pc.targets && pc.targets.length > 0) {
		const results: PublishTarget[] = [];
		for (const target of pc.targets) {
			const access = resolveTargetAccess(target, pc.access);
			if (access !== "public" && access !== "restricted") continue;
			const registry =
				typeof target === "string"
					? (pc.registry ?? DEFAULT_REGISTRY)
					: (target.registry ?? pc.registry ?? DEFAULT_REGISTRY);
			results.push(
				new PublishTarget({
					name: pkgName,
					registry,
					directory: pc.directory ?? ".",
					access,
				}),
			);
		}
		return results;
	}

	if (pc.access === "public" || pc.access === "restricted") {
		return [
			new PublishTarget({
				name: pkgName,
				registry: pc.registry ?? DEFAULT_REGISTRY,
				directory: pc.directory ?? ".",
				access: pc.access,
			}),
		];
	}

	return [];
}

/**
 * Convenience predicate built on top of {@link silkDetect}.
 *
 * @returns True when the package resolves to one or more publish targets.
 */
export function isSilkPublishable(pkgName: string, raw: RawPackageJson): boolean {
	return silkDetect(pkgName, raw).length > 0;
}
