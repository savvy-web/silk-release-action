import { describe, expect, it } from "vitest";
import { packagePageUrl } from "../src/utils/package-urls.js";

const NAME = "@effected/pnpm-plugin-effect";
const VERSION = "0.8.12";
const repo = { owner: "spencerbeggs", repo: "effected", serverUrl: "https://github.com" };

describe("packagePageUrl", () => {
	it("builds the npmjs.com version page for the public npm registry", () => {
		expect(packagePageUrl("npm", NAME, VERSION, repo)).toBe(
			"https://www.npmjs.com/package/@effected/pnpm-plugin-effect/v/0.8.12",
		);
	});

	it("builds the jsr.io page for a JSR target", () => {
		expect(packagePageUrl("jsr", NAME, VERSION, repo)).toBe("https://jsr.io/@effected/pnpm-plugin-effect@0.8.12");
	});

	it("builds the repository packages page for GitHub Packages, by unscoped name, on the resolved host", () => {
		expect(packagePageUrl("github-packages", NAME, VERSION, { ...repo, serverUrl: "https://ghe.example.com" })).toBe(
			"https://ghe.example.com/spencerbeggs/effected/pkgs/npm/pnpm-plugin-effect",
		);
	});

	it("returns null for a custom registry", () => {
		expect(packagePageUrl("custom", NAME, VERSION, repo)).toBeNull();
	});
});
