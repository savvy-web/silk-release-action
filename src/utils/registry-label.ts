import { classifyRegistry } from "@effected/npm";

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
	// One exhaustive classification rather than three booleans asked in sequence.
	// `classifyRegistry` matches on the domain with a leading dot
	// (`.pkg.github.com`), so a look-alike host such as `evil-npmjs.org` no
	// longer classifies as npm — which matters, because that classification
	// decides whether a token is sent and whether provenance is requested.
	switch (classifyRegistry(registry)) {
		case "npm":
			return "npm";
		case "github-packages":
			return "github";
		case "jsr":
			return "jsr";
		default:
			return registryHost(registry);
	}
};

/**
 * Human-readable display name for a registry URL.
 *
 * @remarks
 * Replaces the predecessor's `getRegistryDisplayName`, which the kit does not
 * ship — it is pure derivation from {@link classifyRegistry} and therefore
 * presentation policy. An absent or empty registry resolves to the public npm
 * registry, matching the classifier's own rule.
 *
 * @param registry - A registry URL or bare host, or null/undefined when none is
 *   configured.
 * @returns The display name.
 *
 * @public
 */
export const registryDisplayName = (registry: string | null | undefined): string => {
	const value = registry ?? "";
	switch (classifyRegistry(value)) {
		case "npm":
			return "npm";
		case "github-packages":
			return "GitHub Packages";
		case "jsr":
			return "JSR";
		default:
			return registryHost(value);
	}
};
