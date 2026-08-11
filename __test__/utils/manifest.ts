/**
 * Manifest parsing and source scanning for the `action.yml` sync guards.
 *
 * Helper code only — this directory is NEVER collected by the runner (see
 * `__test__/CLAUDE.md`), so nothing here may be a `*.test.ts` file.
 *
 * The two guards that use this need three independent legs, because any two
 * agreeing while the third drifts is precisely how this repo shipped a
 * `build-command` read no workflow could set and a `custom-registries` input
 * nothing implemented:
 *
 *  1. the manifest — {@link declaredInputNames} / {@link declaredOutputNames}
 *  2. the NAMES tuples in `src/schema/*`
 *  3. what `src/` actually reads and writes — {@link scanInputReads} /
 *     {@link scanOutputWrites}
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Every non-test TypeScript module under `src/`.
 */
const sourceFiles = (directory: string = join(repoRoot, "src")): ReadonlyArray<string> => {
	const out: string[] = [];
	for (const entry of readdirSync(directory)) {
		const path = join(directory, entry);
		if (statSync(path).isDirectory()) {
			out.push(...sourceFiles(path));
		} else if (path.endsWith(".ts") && !path.endsWith(".test.ts") && !path.endsWith(".d.ts")) {
			out.push(path);
		}
	}
	return out;
};

/**
 * The keys of a top-level `action.yml` block, read from the file itself.
 *
 * @remarks
 * A deliberate few-line parse rather than a YAML dependency. The block is
 * two-space-indented `name:` keys between the top-level key and the next
 * top-level key; comment lines and the deeper-indented body of a `|` block
 * scalar are both excluded by the indentation match, so a description
 * containing a colon cannot be mistaken for a declaration.
 */
const declaredNames = (blockKey: string): ReadonlyArray<string> => {
	const source = readFileSync(join(repoRoot, "action.yml"), "utf8");
	const lines = source.split("\n");
	const start = lines.indexOf(blockKey);
	if (start === -1) throw new Error(`action.yml has no top-level \`${blockKey}\` block`);
	const names: string[] = [];
	for (const line of lines.slice(start + 1)) {
		if (/^\S/.test(line)) break;
		const match = /^ {2}([A-Za-z0-9-]+):\s*$/.exec(line);
		if (match?.[1] !== undefined) names.push(match[1]);
	}
	return names;
};

/**
 * The input names `action.yml` declares.
 */
export const declaredInputNames = (): ReadonlyArray<string> => declaredNames("inputs:");

/**
 * The output names `action.yml` declares.
 */
export const declaredOutputNames = (): ReadonlyArray<string> => declaredNames("outputs:");

/**
 * What a source scan found: each name mapped to the modules mentioning it,
 * plus any call the scan could not resolve to a literal.
 */
export interface ScanResult {
	readonly names: ReadonlyMap<string, ReadonlyArray<string>>;
	/**
	 * Calls whose name argument was neither a string literal nor a
	 * same-file `const NAME = "literal"`.
	 *
	 * @remarks
	 * Asserted empty rather than tolerated. A dynamic input name is not
	 * forbidden in principle, but it makes the manifest unenforceable — so it
	 * has to be a deliberate, visible decision rather than something that
	 * quietly weakens the guard.
	 */
	readonly unresolved: ReadonlyArray<string>;
}

/**
 * Remove comments, so prose ABOUT a call is not counted AS a call.
 *
 * @remarks
 * The same phantom-edge problem `@effected/github-actions` documents for its
 * `Secret` scanner: TSDoc explaining that a module no longer calls
 * `ActionInput.boolean("dry-run")` is, to a regex, indistinguishable from the
 * call it describes. This bit for real — the `main.ts` fold was reported
 * incomplete by a comment that existed only to say it was complete.
 *
 * **Full-line `//` comments first, then block comments.** Two deliberate
 * choices:
 *
 *  - Only FULL-LINE `//` comments are stripped, never trailing ones, because
 *    `//` also appears inside string literals (`"https://registry…"`) and
 *    stripping to end-of-line there would eat real code.
 *  - Line comments go first: prose inside one containing `/*` would otherwise
 *    open a phantom block comment and swallow everything up to the next `*` + `/`,
 *    silently emptying the scan. Failing that way is invisible, which for a
 *    guard is the worst direction.
 */
export const stripComments = (source: string): string =>
	source.replaceAll(/^[ \t]*\/\/.*$/gm, "").replaceAll(/\/\*[\s\S]*?\*\//g, "");

const scan = (pattern: RegExp): ScanResult => {
	const names = new Map<string, string[]>();
	const unresolved: string[] = [];
	for (const file of sourceFiles()) {
		const source = stripComments(readFileSync(file, "utf8"));
		// Resolve `ActionInput.string(CONFIG_INPUT_NAME)` against a same-file
		// `const CONFIG_INPUT_NAME = "sbom-config"` — the one indirection in the
		// tree today, and the reason this is not a bare literal grep.
		const constants = new Map(
			[...source.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]+)"/g)].map((m) => [m[1] as string, m[2] as string]),
		);
		const relative = file.slice(repoRoot.length);
		for (const match of source.matchAll(pattern)) {
			const name = match[1] ?? (match[2] === undefined ? undefined : constants.get(match[2]));
			if (name === undefined) {
				unresolved.push(`${relative}: ${match[2] ?? match[0]}`);
				continue;
			}
			const existing = names.get(name);
			if (existing === undefined) names.set(name, [relative]);
			else if (!existing.includes(relative)) existing.push(relative);
		}
	}
	return { names, unresolved };
};

/**
 * Every input name `src/` actually reads, via any `ActionInput` accessor.
 */
export const scanInputReads = (): ScanResult =>
	scan(
		/ActionInput\.(?:string|boolean|integer|redacted|lines|list|pairs|schema)\(\s*(?:"([^"]+)"|([A-Za-z_$][\w$]*))/g,
	);

/**
 * Every output name `src/` actually writes, via `set` or `setJson`.
 *
 * @remarks
 * Anchored on the `outputs` receiver, not a bare `.set(`. `src/` holds a dozen
 * `Map.set(identifier, …)` calls (`counts.set`, `issueMap.set`,
 * `targetsByPackage.set`, …); a receiver-agnostic pattern reports every one of
 * them as an undeclared action output, and the guard drowns in false
 * positives on its first run. The convention it depends on — the service is
 * always bound as `outputs` — is itself asserted by the write-site test, so
 * renaming the binding fails loudly instead of silently emptying this scan.
 */
export const scanOutputWrites = (): ScanResult =>
	// `\s*` around the dot is load-bearing: `emitReleaseOutput` writes the
	// structured output as `outputs\n\t.setJson("result", …)`, and a pattern
	// anchored on a literal `outputs.` silently misses it — reporting `result`
	// as a declared-but-never-written output.
	scan(/\boutputs\s*\.\s*set(?:Json)?\(\s*(?:"([^"]+)"|([A-Za-z_$][\w$]*))\s*,/g);

/**
 * Every receiver `src/` calls `.set`/`.setJson` on with one of `knownNames` as
 * a literal first argument.
 *
 * @remarks
 * {@link scanOutputWrites} is anchored on the `outputs` receiver to dodge the
 * dozen `Map.set(identifier, …)` calls in `src/`. That anchoring is only safe
 * while the convention holds, and a test asserting it via the *size* of that
 * scan cannot detect a violation: an output written at two sites still appears
 * once when one site renames its binding. (Verified — that mutant survived.)
 *
 * This scan is receiver-agnostic and filtered by name instead, so a renamed
 * binding shows up as a receiver that is not `outputs`.
 */
export const scanOutputWriteReceivers = (knownNames: ReadonlyArray<string>): ReadonlyArray<string> => {
	const found: string[] = [];
	for (const file of sourceFiles()) {
		const source = stripComments(readFileSync(file, "utf8"));
		for (const match of source.matchAll(/([A-Za-z_$][\w$]*)\s*\.\s*set(?:Json)?\(\s*"([^"]+)"\s*,/g)) {
			if (match[2] !== undefined && knownNames.includes(match[2])) {
				found.push(`${match[1]} (${file.slice(repoRoot.length)} → ${match[2]})`);
			}
		}
	}
	return found;
};
