/**
 * ChangesetConfig service.
 *
 * Reads .changeset/config.json from the workspace root and exposes
 * mode (silk | vanilla | none) and versionPrivate (whether
 * privatePackages.version is enabled).
 *
 * @module services/changeset-config
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Context, Effect, Layer } from "effect";
import { matchesIgnorePattern } from "../utils/detect-repo-type.js";

export type ChangesetMode = "silk" | "vanilla" | "none";

interface ChangesetConfigJson {
	readonly changelog?: string | ReadonlyArray<unknown>;
	readonly privatePackages?: { readonly version?: boolean };
	readonly ignore?: ReadonlyArray<string>;
	readonly fixed?: ReadonlyArray<ReadonlyArray<string>>;
}

// ══════════════════════════════════════════════════════════════════════════════
// Service Interface
// ══════════════════════════════════════════════════════════════════════════════

export class ChangesetConfig extends Context.Tag("ChangesetConfig")<
	ChangesetConfig,
	{
		readonly mode: (workspaceRoot: string) => Effect.Effect<ChangesetMode>;
		readonly versionPrivate: (workspaceRoot: string) => Effect.Effect<boolean>;
		/** Returns the raw `ignore` array from `.changeset/config.json`, or `[]` if absent. */
		readonly ignorePatterns: (workspaceRoot: string) => Effect.Effect<ReadonlyArray<string>>;
		/** Returns `true` if `name` matches any pattern in the changeset `ignore` list. */
		readonly isIgnored: (name: string, workspaceRoot: string) => Effect.Effect<boolean>;
		/** Returns the raw `fixed` groups from `.changeset/config.json`, or `[]` if absent. */
		readonly fixed: (workspaceRoot: string) => Effect.Effect<ReadonlyArray<ReadonlyArray<string>>>;
	}
>() {}

// ══════════════════════════════════════════════════════════════════════════════
// Live Layer
// ══════════════════════════════════════════════════════════════════════════════

const SILK_PREFIX = "@savvy-web/changesets";

const readConfig = (workspaceRoot: string): ChangesetConfigJson | null => {
	const path = join(workspaceRoot, ".changeset", "config.json");
	if (!existsSync(path)) return null;
	try {
		const raw = readFileSync(path, "utf-8");
		return JSON.parse(raw) as ChangesetConfigJson;
	} catch {
		return null;
	}
};

const detectMode = (config: ChangesetConfigJson | null): ChangesetMode => {
	if (config === null) return "none";
	const cl = config.changelog;
	if (typeof cl === "string" && cl.startsWith(SILK_PREFIX)) return "silk";
	if (Array.isArray(cl) && typeof cl[0] === "string" && cl[0].startsWith(SILK_PREFIX)) return "silk";
	return "vanilla";
};

/**
 * Live layer with per-workspace-root caching. The cache is layer-scoped:
 * each layer instance gets its own Map, so tests that provide a fresh
 * ChangesetConfigLive per case don't share state. In production, the layer
 * lives for the action's lifetime, so each .changeset/config.json is read
 * at most once per workspaceRoot.
 */
export const ChangesetConfigLive = Layer.effect(
	ChangesetConfig,
	Effect.sync(() => {
		const cache = new Map<string, ChangesetConfigJson | null>();
		const cachedRead = (workspaceRoot: string): ChangesetConfigJson | null => {
			if (cache.has(workspaceRoot)) return cache.get(workspaceRoot) ?? null;
			const config = readConfig(workspaceRoot);
			cache.set(workspaceRoot, config);
			return config;
		};
		return {
			mode: (workspaceRoot) => Effect.sync(() => detectMode(cachedRead(workspaceRoot))),
			versionPrivate: (workspaceRoot) =>
				Effect.sync(() => cachedRead(workspaceRoot)?.privatePackages?.version === true),
			ignorePatterns: (workspaceRoot) => Effect.sync(() => cachedRead(workspaceRoot)?.ignore ?? []),
			isIgnored: (name, workspaceRoot) =>
				Effect.sync(() => (cachedRead(workspaceRoot)?.ignore ?? []).some((p) => matchesIgnorePattern(name, p))),
			fixed: (workspaceRoot) => Effect.sync(() => cachedRead(workspaceRoot)?.fixed ?? []),
		};
	}),
);
