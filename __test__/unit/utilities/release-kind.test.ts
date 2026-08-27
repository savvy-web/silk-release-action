/**
 * Unit tests for the release-kind classification.
 *
 * @remarks
 * The module exists to name a distinction the pipeline previously made ad hoc,
 * by asking whether some array happened to be empty and rendering the answer
 * as `⏭️ no targets`. These cases pin the two things that made that reading
 * wrong: a package with no publish targets is `github-release` kind (a
 * complete, intended release), and the wave summary must report versioning,
 * registry publishing and GitHub releases as three separate counts so a zero
 * in the middle is legible.
 */

import { describe, expect, it } from "vitest";
import {
	releaseKindCell,
	releaseKindIcon,
	releaseKindLabel,
	releaseKindOf,
	summarizeReleaseWave,
	tallyReleaseKinds,
} from "../../../src/utils/release-kind.js";

describe("releaseKindOf", () => {
	it("classifies a package with at least one target as a registry publish", () => {
		expect(releaseKindOf(1)).toBe("github-with-packages");
		expect(releaseKindOf(7)).toBe("github-with-packages");
	});

	// The case the whole module exists for: zero targets is not a degraded
	// registry publish, it is a different kind of release.
	it("classifies a package with no targets as GitHub-release-only", () => {
		expect(releaseKindOf(0)).toBe("github-only");
	});
});

describe("releaseKindLabel / releaseKindIcon / releaseKindCell", () => {
	it("labels the two kinds distinctly", () => {
		expect(releaseKindLabel("github-with-packages")).toBe("Registry publish");
		expect(releaseKindLabel("github-only")).toBe("GitHub release only");
	});

	// `⏭️` is the glyph this replaced. It reads as "passed over", which is the
	// opposite of what a private tracking package's release is.
	it("uses a tag rather than the skip glyph for the release-only kind", () => {
		expect(releaseKindIcon("github-only")).toBe("\u{1F3F7}️");
		expect(releaseKindIcon("github-only")).not.toBe("⏭️");
		expect(releaseKindIcon("github-with-packages")).toBe("\u{1F4E6}");
	});

	it("joins the icon and label into one cell", () => {
		expect(releaseKindCell("github-only")).toBe("\u{1F3F7}️ GitHub release only");
		expect(releaseKindCell("github-with-packages")).toBe("\u{1F4E6} Registry publish");
	});
});

describe("tallyReleaseKinds", () => {
	it("counts a mixed wave by kind", () => {
		expect(tallyReleaseKinds([2, 0, 1, 0, 0])).toEqual({ registry: 2, githubRelease: 3 });
	});

	// The effected shape that motivated this: every package in the wave is a
	// private tracking package.
	it("counts an all-private wave as entirely GitHub-release-only", () => {
		expect(tallyReleaseKinds([0, 0])).toEqual({ registry: 0, githubRelease: 2 });
	});

	it("counts an empty wave as zero of each", () => {
		expect(tallyReleaseKinds([])).toEqual({ registry: 0, githubRelease: 0 });
	});
});

describe("summarizeReleaseWave", () => {
	it("reports versioning, registry publishing and GitHub releases as three separate counts", () => {
		expect(summarizeReleaseWave({ workspaces: 3, packagesPublished: 5, releases: 3 })).toBe(
			"3 workspace(s) versioned · 5 package(s) published to a registry · 3 GitHub release(s) created",
		);
	});

	// The line the user has to read for an all-private wave. `Published 0/0
	// target(s)` was true and uninformative; this must still say that two
	// packages were versioned and two releases were created.
	it("still reports the versioning and the releases when nothing publishes to a registry", () => {
		const line = summarizeReleaseWave({ workspaces: 2, packagesPublished: 0, releases: 2 });
		expect(line).toBe("2 workspace(s) versioned · 0 package(s) published to a registry · 2 GitHub release(s) created");
		expect(line).toContain("2 workspace(s) versioned");
		expect(line).toContain("2 GitHub release(s) created");
	});
});
