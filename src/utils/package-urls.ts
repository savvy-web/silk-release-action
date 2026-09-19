/**
 * Human-facing package page per registry kind.
 *
 * @remarks
 * Pure derivation from the target's identity. The tarball URL is NOT derived
 * here — it comes from the registry's own manifest via the availability probe,
 * because registries disagree on tarball layout and a guessed URL that 404s
 * is worse than null.
 */

import { classifyRegistry } from "@effected/npm";

/** Input for {@link packagePageUrl}. */
export interface PackagePageArgs {
	/** Registry URL as resolved on the target; `null` for JSR. */
	readonly registry: string | null;
	readonly name: string;
	readonly version: string;
	readonly owner: string;
	readonly repo: string;
}

const unscoped = (name: string): string => (name.startsWith("@") ? (name.split("/")[1] ?? name) : name);

/**
 * The web page for a published package version, or `null` when the registry
 * kind exposes no known page (custom registries).
 *
 * @param args - The package's identity and the target's owning repository.
 * @returns The page URL, or `null` for a custom registry.
 *
 * @public
 */
export const packagePageUrl = (args: PackagePageArgs): string | null => {
	if (args.registry === null) return `https://jsr.io/${args.name}@${args.version}`;
	switch (classifyRegistry(args.registry)) {
		case "npm":
			return `https://www.npmjs.com/package/${args.name}/v/${args.version}`;
		case "github-packages":
			return `https://github.com/${args.owner}/${args.repo}/pkgs/npm/${unscoped(args.name)}`;
		case "jsr":
			return `https://jsr.io/${args.name}@${args.version}`;
		default:
			return null;
	}
};
