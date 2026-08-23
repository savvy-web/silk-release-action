/**
 * The bundled vanilla changelog module.
 *
 * The action ships this module for repos whose changesets config names
 * `@changesets/cli/changelog`. Its implementation is silk-effects'
 * `Changesets.vanillaChangelogFunctions` re-export — not a direct
 * `@changesets/changelog-git` dependency — so the action carries one
 * changesets vendor surface instead of two.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Changesets } from "@savvy-web/silk-effects";
import { describe, expect, it } from "vitest";
import vanilla from "../../../src/changelog/default.js";

describe("src/changelog/default", () => {
	it("is silk-effects' vanilla changelog re-export", () => {
		expect(vanilla).toBe(Changesets.vanillaChangelogFunctions);
	});

	it("exposes the changesets ChangelogFunctions surface", () => {
		expect(typeof vanilla.getReleaseLine).toBe("function");
		expect(typeof vanilla.getDependencyReleaseLine).toBe("function");
	});

	it("renders a release line from a changeset summary", async () => {
		const line = await vanilla.getReleaseLine(
			{ id: "brave-pans-shout", summary: "Fix a thing", releases: [{ name: "pkg", type: "patch" }] },
			"patch",
			null,
		);
		expect(line).toContain("Fix a thing");
	});

	// The point of the swap: the action depends on silk-effects for this, not on
	// `@changesets/changelog-git` directly. Identity alone cannot see the
	// difference — both spellings resolve to the same object — so assert the
	// import edge in the source text.
	it("does not import @changesets/changelog-git directly", () => {
		const source = readFileSync(fileURLToPath(new URL("../../../src/changelog/default.ts", import.meta.url)), "utf8");
		// Strip comments: the doc block legitimately names the upstream package
		// it is explaining. Only real import edges should count.
		const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
		expect(code).not.toContain("@changesets/changelog-git");
		expect(code).toContain("@savvy-web/silk-effects");
	});
});
