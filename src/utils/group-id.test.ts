import { describe, expect, it } from "vitest";
import { getGroupId, insertGroupToken } from "./group-id.js";

describe("getGroupId", () => {
	it("returns the segment before /pkg for a prod build directory", () => {
		expect(getGroupId("dist/prod/npm/pkg")).toBe("npm");
		expect(getGroupId("dist/prod/github/pkg")).toBe("github");
	});
	it("handles absolute paths", () => {
		expect(getGroupId("/repo/packages/x/dist/prod/npm/pkg")).toBe("npm");
	});
	it("falls back to the last segment when there is no /pkg suffix", () => {
		expect(getGroupId("dist/npm")).toBe("npm");
	});
});

describe("insertGroupToken", () => {
	it("inserts the group before a single extension", () => {
		expect(insertGroupToken("savvy-web-templates-0.1.1.tgz", "npm")).toBe("savvy-web-templates-0.1.1.npm.tgz");
	});
	it("inserts the group before a compound .api.json extension", () => {
		expect(insertGroupToken("templates.api.json", "github", ".api.json")).toBe("templates.github.api.json");
	});
	it("inserts the group before a compound .meta.tgz extension", () => {
		expect(insertGroupToken("savvy-web-templates-0.1.1.tgz", "npm", ".meta.tgz")).toBe(
			"savvy-web-templates-0.1.1.npm.meta.tgz",
		);
	});
	it("inserts the group before a compound .sbom.json extension", () => {
		expect(insertGroupToken("templates.sbom.json", "npm", ".sbom.json")).toBe("templates.npm.sbom.json");
	});
	it("without ext, inserts before the final extension only (compound names need ext)", () => {
		expect(insertGroupToken("templates.api.json", "github")).toBe("templates.api.github.json");
	});
});
