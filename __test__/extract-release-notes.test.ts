/**
 * Unit tests for `extractReleaseNotes`.
 *
 * Covers the four discriminated outcomes (`found`, `no-changelog`,
 * `version-not-found`, `error`) and the "first-H2-to-second-H2" rule across
 * both heading formats: `## 5.0.13` (fixed-release) and
 * `## @scope/pkg@5.0.13` (multi-package tagged).
 */

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { extractReleaseNotes, extractVersionReleaseNotes } from "../src/utils/extract-release-notes.js";

let pkgPath: string;

beforeEach(() => {
	pkgPath = mkdtempSync(join(tmpdir(), "extract-release-notes-"));
	// `extractReleaseNotes` reads `CHANGELOG.md` from this directory.
	mkdirSync(pkgPath, { recursive: true });
});

const writeChangelog = (body: string): void => {
	writeFileSync(join(pkgPath, "CHANGELOG.md"), body, "utf-8");
};

describe("extractReleaseNotes - found", () => {
	it("extracts the body between the first H2 and the second H2 (fixed-release heading)", () => {
		writeChangelog("# Changelog\n\n## 5.0.13\n\n### Patch Changes\n\n- Fix a bug\n\n## 5.0.12\n\n- previous\n");
		const result = extractReleaseNotes(pkgPath);
		expect(result.status).toBe("found");
		if (result.status !== "found") return;
		expect(result.content).toContain("### Patch Changes");
		expect(result.content).toContain("- Fix a bug");
		expect(result.content).not.toContain("## 5.0.13"); // heading itself excluded
		expect(result.content).not.toContain("previous"); // second section excluded
	});

	it("extracts the body when the first H2 is the multi-package tagged shape", () => {
		writeChangelog(
			"# Changelog\n\n## @savvy-web/standalone-package@0.9.5\n\n- New feature\n\n## @savvy-web/standalone-package@0.9.4\n\n- old\n",
		);
		const result = extractReleaseNotes(pkgPath);
		expect(result.status).toBe("found");
		if (result.status !== "found") return;
		expect(result.content).toContain("- New feature");
		expect(result.content).not.toContain("old");
	});

	it("includes H3 sub-headings and runs to end-of-file when only one H2 exists", () => {
		// First-release CHANGELOG — no prior version section to terminate at.
		writeChangelog("# Changelog\n\n## 0.1.0\n\n### Minor Changes\n\n- Initial release.\n");
		const result = extractReleaseNotes(pkgPath);
		expect(result.status).toBe("found");
		if (result.status !== "found") return;
		expect(result.content).toContain("### Minor Changes");
		expect(result.content).toContain("- Initial release.");
	});

	it("includes nested H3 sub-sections — only H2 terminates a release section", () => {
		writeChangelog(
			"# Changelog\n\n## 1.2.3\n\n### Patch Changes\n\n- Fix\n\n### Other\n\n- [`abc`] Tetsing flow\n\n## 1.2.2\n\n- old\n",
		);
		const result = extractReleaseNotes(pkgPath);
		expect(result.status).toBe("found");
		if (result.status !== "found") return;
		expect(result.content).toContain("### Patch Changes");
		expect(result.content).toContain("### Other");
		expect(result.content).toContain("Tetsing flow");
		expect(result.content).not.toContain("old");
	});
});

describe("extractReleaseNotes - fenced code blocks", () => {
	it("does not treat a `## ` line inside a fenced code block as a section boundary", () => {
		// REGRESSION. The hand-rolled `/^## /` line scan this replaced saw the
		// `## 5.0.12` inside the fence as the next release heading and truncated
		// the entry there, dropping everything after it. Sections are delimited
		// by root-level headings, and a line inside a fence is not one.
		writeChangelog(
			[
				"# Changelog",
				"",
				"## 5.0.13",
				"",
				"- Documented the changelog format:",
				"",
				"```markdown",
				"## 5.0.12",
				"```",
				"",
				"- A bullet AFTER the fence",
				"",
				"## 5.0.12",
				"",
				"- genuinely the previous release",
				"",
			].join("\n"),
		);
		const result = extractReleaseNotes(pkgPath);
		expect(result.status).toBe("found");
		if (result.status !== "found") return;
		expect(result.content).toContain("A bullet AFTER the fence");
		expect(result.content).not.toContain("genuinely the previous release");
	});
});

describe("extractVersionReleaseNotes", () => {
	const changelogPath = (): string => join(pkgPath, "CHANGELOG.md");

	it("returns the section for the requested version, not the newest one", () => {
		// The whole reason this is a separate function: Phase 3 falls back to the
		// repo-root CHANGELOG, whose newest entry may belong to another package.
		// Taking the first H2 there would attach the wrong notes to a release.
		writeChangelog("# Changelog\n\n## 2.0.0\n\n- newest\n\n## 1.2.3\n\n- the one we asked for\n");
		expect(extractVersionReleaseNotes(changelogPath(), "1.2.3")).toBe("- the one we asked for");
	});

	it("matches the multi-package tagged heading shape", () => {
		writeChangelog("# Changelog\n\n## @scope/pkg@1.2.3\n\n- scoped body\n");
		expect(extractVersionReleaseNotes(changelogPath(), "1.2.3")).toBe("- scoped body");
	});

	it("returns undefined when the version has no section", () => {
		writeChangelog("# Changelog\n\n## 2.0.0\n\n- newest\n");
		expect(extractVersionReleaseNotes(changelogPath(), "1.2.3")).toBeUndefined();
	});

	it("returns undefined when the version's section is empty", () => {
		writeChangelog("# Changelog\n\n## 1.2.3\n\n## 1.2.2\n\n- old\n");
		expect(extractVersionReleaseNotes(changelogPath(), "1.2.3")).toBeUndefined();
	});

	it("returns undefined when the CHANGELOG does not exist", () => {
		expect(extractVersionReleaseNotes(join(pkgPath, "CHANGELOG.md"), "1.2.3")).toBeUndefined();
	});

	it("treats the version as a literal, not a regex", () => {
		// `1.2.3` as a pattern would also match `1x2x3`; the dots are escaped.
		writeChangelog("# Changelog\n\n## 1x2x3\n\n- not a version\n");
		expect(extractVersionReleaseNotes(changelogPath(), "1.2.3")).toBeUndefined();
	});
});

describe("extractReleaseNotes - failure paths", () => {
	it("returns no-changelog when CHANGELOG.md does not exist", () => {
		const result = extractReleaseNotes(pkgPath);
		expect(result.status).toBe("no-changelog");
	});

	it("returns version-not-found when the file has no H2 sections", () => {
		writeChangelog("# Changelog\n\nNo releases yet.\n");
		const result = extractReleaseNotes(pkgPath);
		expect(result.status).toBe("version-not-found");
		if (result.status !== "version-not-found") return;
		expect(result.reason).toMatch(/no H2 section/);
	});

	it("returns version-not-found when the first H2's section is empty", () => {
		writeChangelog("# Changelog\n\n## 1.2.3\n\n## 1.2.2\n\n- old\n");
		const result = extractReleaseNotes(pkgPath);
		expect(result.status).toBe("version-not-found");
		if (result.status !== "version-not-found") return;
		expect(result.reason).toMatch(/no content/);
	});
});
