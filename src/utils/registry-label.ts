import { isGitHubPackagesRegistry, isJsrRegistry, isNpmRegistry } from "@savvy-web/github-action-effects";

/**
 * The hostname of a registry URL, for a `· <host>` detail. Falls back to the
 * scheme-stripped, path-stripped raw value when the URL cannot be parsed.
 *
 * @remarks
 * Used as the `· <host>` suffix on the publish and validation log-tree rows. The
 * parse-failure fallback keeps an unparseable or bare-host registry value readable
 * rather than throwing.
 *
 * @param registry - A registry URL or bare host.
 * @returns The host portion.
 *
 * @public
 */
export const registryHost = (registry: string): string => {
	try {
		return new URL(registry).host;
	} catch {
		return registry.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
	}
};

/**
 * Compact label for a registry, used as the row label in the publish and
 * validation log trees (`npm`, `github`, `jsr`). Well-known registries collapse
 * to their short name; anything else falls back to its hostname.
 *
 * @remarks
 * Keeps the log tree compact for the common registries while preserving a stable
 * hostname fallback (via {@link registryHost}) for custom registries.
 *
 * @param registry - A registry URL or bare host.
 * @returns The short label.
 *
 * @public
 */
export const registryShortLabel = (registry: string): string => {
	if (isNpmRegistry(registry)) return "npm";
	if (isGitHubPackagesRegistry(registry)) return "github";
	if (isJsrRegistry(registry)) return "jsr";
	return registryHost(registry);
};
