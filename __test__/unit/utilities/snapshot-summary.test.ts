import { describe, expect, it } from "vitest";
import type { SnapshotOutput } from "../../../src/schema/release-output.js";
import { SCHEMA_URL } from "../../../src/schema/release-output.js";
import { renderOverrides, renderSnapshotSummary } from "../../../src/utils/snapshot-summary.js";

const npm = { name: "npm", type: "npm" as const, url: "https://registry.npmjs.org/" };
const gpr = { name: "GitHub Packages", type: "github-packages" as const, url: "https://npm.pkg.github.com/" };
const output = (overrides: Partial<SnapshotOutput> = {}): SnapshotOutput => ({
	$schema: SCHEMA_URL,
	phase: "snapshot",
	success: true,
	outcome: "published",
	summary: "1 workspace(s) versioned · 2 package(s) published under `next`",
	dryRun: false,
	failure: null,
	totals: { workspaces: 1, published: 2, skipped: 0, failed: 0 },
	tag: "next",
	published: [
		{
			name: "@scope/a",
			version: "1.1.0-next-20260927051500",
			registry: npm,
			directory: "packages/a/dist/npm",
			tag: "next",
		},
		{
			name: "@scope/a",
			version: "1.1.0-next-20260927051500",
			registry: gpr,
			directory: "packages/a/dist/github",
			tag: "next",
		},
	],
	skipped: [],
	failed: [],
	...overrides,
});

describe("renderOverrides", () => {
	it("renders one pnpm override per package name, deduped across registries", () => {
		expect(renderOverrides(output().published)).toBe('overrides:\n  "@scope/a": "1.1.0-next-20260927051500"');
	});
});

describe("renderSnapshotSummary", () => {
	it("renders a heading, the table, the pin-exact-versions line and a yaml overrides block", () => {
		const md = renderSnapshotSummary(output(), "feat/x");
		expect(md).toContain("Snapshot `next` of `feat/x`");
		expect(md).toContain("| Package | Version | Registry | Tag |");
		expect(md).toMatch(/pin these exact versions/i);
		expect(md).toMatch(/partial set/i);
		expect(md).toContain("```yaml\noverrides:");
	});

	it("keeps the pin line and overrides on a partial failure, and lists the failures", () => {
		const md = renderSnapshotSummary(
			output({
				success: false,
				outcome: "partial",
				failed: [{ name: "@scope/b", version: "2.0.0-next-1", registry: npm, error: "E403 forbidden" }],
			}),
			"feat/x",
		);
		expect(md).toMatch(/pin these exact versions/i);
		expect(md).toContain("E403 forbidden");
	});

	it("omits the overrides block when nothing was published, and says why on a dry run", () => {
		const md = renderSnapshotSummary(
			output({
				dryRun: true,
				outcome: "rehearsed",
				published: [],
				skipped: [{ name: "@scope/a", version: "1.1.0-next-1", reason: "dry-run" }],
			}),
			"feat/x",
		);
		expect(md).not.toContain("overrides:");
		expect(md).toMatch(/dry run/i);
		expect(md).toContain("dry-run");
	});

	it("renders without a branch when the run was refused before the ref was known", () => {
		expect(renderSnapshotSummary(output({ published: [] }), "")).toContain("Snapshot `next`");
	});
});
