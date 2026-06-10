/**
 * Group-keyed asset-naming helpers for the bundler prod layout
 * (`dist/prod/<group>/pkg`). The group id distinguishes byte-variant build
 * groups; `npm: true` + `github: true` collapse into one group, so registries
 * that share bytes share a group token.
 *
 * @module utils/group-id
 */

/**
 * Derive the byte-group id from a build directory.
 *
 * `dist/prod/npm/pkg` → `npm`. Falls back to the last path segment when the
 * directory does not end in `/pkg` (legacy / non-prod inputs).
 */
export function getGroupId(directory: string): string {
	const parts = directory.split("/").filter(Boolean);
	const last = parts[parts.length - 1];
	if (last === "pkg" && parts.length >= 2) return parts[parts.length - 2] as string;
	return last ?? "dist";
}

/**
 * Insert a group token into an asset file name, before its extension.
 *
 * @param fileName - e.g. `savvy-web-templates-0.1.1.tgz`
 * @param group - the group id, e.g. `npm`
 * @param ext - optional compound extension to produce instead of the file's
 *   own. When provided, the file's trailing occurrence of `ext` (or a trailing
 *   `.tgz`) is stripped, then `.${group}${ext}` is appended
 *   (e.g. `…-0.1.1.tgz` + `.meta.tgz` → `…-0.1.1.npm.meta.tgz`,
 *   `templates.api.json` + `.api.json` → `templates.npm.api.json`).
 *   When omitted, the group is inserted before the FINAL extension only (the
 *   last dot). For compound extensions like `.api.json`/`.sbom.json`/`.meta.tgz`,
 *   pass the matching `ext` argument; calling without `ext` on such a name
 *   inserts the token before the last component only (e.g. `templates.api.json`
 *   becomes `templates.api.github.json`).
 */
export function insertGroupToken(fileName: string, group: string, ext?: string): string {
	if (ext !== undefined) {
		let base = fileName;
		if (base.endsWith(ext)) base = base.slice(0, -ext.length);
		else if (base.endsWith(".tgz")) base = base.slice(0, -".tgz".length);
		return `${base}.${group}${ext}`;
	}
	const dot = fileName.lastIndexOf(".");
	if (dot <= 0) return `${fileName}.${group}`;
	return `${fileName.slice(0, dot)}.${group}${fileName.slice(dot)}`;
}
