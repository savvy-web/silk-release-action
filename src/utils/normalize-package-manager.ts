/**
 * The four package managers whose npm executor the publish/pack/dry-run paths
 * dispatch through (see `PackagePublish` in `@savvy-web/github-action-effects`).
 *
 * @public
 */
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

/**
 * Narrow the loosely-typed `packageManager` action input into the four-value
 * enum the library's `PackagePublish` methods accept.
 *
 * @remarks
 * Anything unrecognised falls back to `"npm"` — matching the lockfile-detection
 * fallback chain in the workspace detector. Shared by the publish phase
 * (`publish.ts`) and the validation phase (`validation.ts`) so the dry-run and
 * the live publish dispatch through the SAME npm executor.
 *
 * @param pm - The raw `packageManager` input string.
 * @returns The narrowed {@link PackageManager}.
 *
 * @public
 */
export const normalizePackageManager = (pm: string): PackageManager => {
	if (pm === "pnpm" || pm === "yarn" || pm === "bun" || pm === "npm") return pm;
	return "npm";
};
