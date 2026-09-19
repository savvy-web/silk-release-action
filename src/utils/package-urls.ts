/**
 * Human-facing package page per registry kind.
 *
 * @remarks
 * Pure derivation from the target's identity. The tarball URL is NOT derived
 * here — it comes from the registry's own manifest via the availability probe,
 * because registries disagree on tarball layout and a guessed URL that 404s
 * is worse than null.
 */

import type { RegistryKind } from "@effected/npm";
import { unscopedPackageName } from "./github-urls.js";

/** The repository (and GitHub host) a GitHub Packages page is addressed under. */
export interface PackagePageRepo {
	readonly owner: string;
	readonly repo: string;
	/** `GITHUB_SERVER_URL` as resolved by `resolveServerUrl` — never hardcoded, for GHES. */
	readonly serverUrl: string;
}

/**
 * The web page for a published package version, or `null` when the registry
 * kind exposes no known page (custom registries).
 *
 * @param kind - The registry kind, as `classifyRegistry` reports it.
 * @param name - The package name on the target.
 * @param version - The published version.
 * @param repo - The owning repository, for the GitHub Packages page.
 * @returns The page URL, or `null` for a custom registry.
 *
 * @public
 */
export const packagePageUrl = (
	kind: RegistryKind,
	name: string,
	version: string,
	repo: PackagePageRepo,
): string | null => {
	switch (kind) {
		case "npm":
			return `https://www.npmjs.com/package/${name}/v/${version}`;
		case "jsr":
			return `https://jsr.io/${name}@${version}`;
		case "github-packages":
			return `${repo.serverUrl}/${repo.owner}/${repo.repo}/pkgs/npm/${unscopedPackageName(name)}`;
		default:
			return null;
	}
};
