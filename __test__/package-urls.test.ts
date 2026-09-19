import { describe, expect, it } from "vitest";
import { packagePageUrl } from "../src/utils/package-urls.js";

const base = { name: "@effected/pnpm-plugin-effect", version: "0.8.12", owner: "spencerbeggs", repo: "effected" };

describe("packagePageUrl", () => {
	it("builds the npmjs.com version page for the public npm registry", () => {
		expect(packagePageUrl({ ...base, registry: "https://registry.npmjs.org/" })).toBe(
			"https://www.npmjs.com/package/@effected/pnpm-plugin-effect/v/0.8.12",
		);
	});

	it("builds the jsr.io page for a JSR target (registry null)", () => {
		expect(packagePageUrl({ ...base, registry: null })).toBe("https://jsr.io/@effected/pnpm-plugin-effect@0.8.12");
	});

	it("builds the repository packages page for GitHub Packages, by unscoped name", () => {
		expect(packagePageUrl({ ...base, registry: "https://npm.pkg.github.com/" })).toBe(
			"https://github.com/spencerbeggs/effected/pkgs/npm/pnpm-plugin-effect",
		);
	});

	it("returns null for a custom registry", () => {
		expect(packagePageUrl({ ...base, registry: "https://registry.example.com/" })).toBeNull();
	});
});
