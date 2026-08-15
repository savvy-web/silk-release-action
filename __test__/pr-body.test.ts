/**
 * Contract smoke test for the release-PR description.
 *
 * @remarks
 * The implementation moved to `@savvy-web/silk-effects` `PrBody` (issue #209);
 * its exhaustive suite moved with it. What stays here is the narrow set of
 * properties **this repo's call sites depend on** — `create-release-branch.ts`
 * and `update-release-branch.ts` — so a surprising upstream change is caught
 * here rather than in a release.
 *
 * The behaviour that matters is narrow and easy to lose: **GitHub links an
 * issue when the PR body carries a bare `Closes #N` line outside any fenced
 * block.** Everything else in the body is presentation.
 *
 * Verified against the live repository before these were written:
 * `savvy-web/silk-integration` #242 and #232 were created with an empty body
 * and reported `closingIssuesReferences: []`; #243 carried a bare `Closes #168`
 * and reported `[168]`. That evidence is empirical, not inferred from GitHub's
 * documentation, and is the reason the bare-line rule is asserted at all.
 */

import { PrBody } from "@savvy-web/silk-effects";
import { describe, expect, it } from "vitest";

const { ManagedPrBody, Markers } = PrBody;

const SIGNOFF = "Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>";

const build = (linkedIssues: ReadonlyArray<{ number: number; title: string; state: string }>, summary = ""): string =>
	ManagedPrBody.build({ subject: "feat: a change", linkedIssues, signoff: SIGNOFF, summary });

/** The body with every fenced block removed — what GitHub's linker actually sees. */
const outsideFences = (body: string): string => body.replace(/```[\s\S]*?```/g, "");

describe("the linking contract", () => {
	it("emits a bare Closes line outside any fenced block, one per open issue", () => {
		const body = build([
			{ number: 12, title: "one", state: "open" },
			{ number: 34, title: "two", state: "open" },
		]);

		const bare = outsideFences(body);
		expect(bare).toMatch(/^Closes #12$/m);
		expect(bare).toMatch(/^Closes #34$/m);
	});

	it("produces no closing reference when nothing is linked", () => {
		expect(outsideFences(build([]))).not.toContain("Closes #");
	});

	it("uses the two non-interchangeable spellings — comma-joined inside the fence, bare outside", () => {
		const body = build([
			{ number: 1, title: "one", state: "open" },
			{ number: 2, title: "two", state: "open" },
		]);

		// Inside the squash fence, commitlint's form.
		expect(body).toContain("Closes #1, #2");
		// Outside it, GitHub's linker's form — one per line.
		const bare = outsideFences(body);
		expect(bare).toMatch(/^Closes #1$/m);
		expect(bare).toMatch(/^Closes #2$/m);
	});
});

describe("closed issues are dropped", () => {
	// REGRESSION (#209). The local implementation this replaced tested
	// `state !== "closed"`, so it dropped a REST-shaped `"closed"` and silently
	// kept a GraphQL-shaped `"CLOSED"`. `GitHubIssue.linkedIssues` is a GraphQL
	// query (`closingIssuesReferences`) and the kit does not normalise the
	// value, so the uppercase form is the one this action actually receives —
	// meaning every already-closed issue was re-linked, and re-closed on merge.
	it.each(["closed", "CLOSED", "Closed"])("drops an issue whose state is %s", (state) => {
		const body = build([{ number: 9, title: "done already", state }]);

		expect(body).not.toContain("Closes #9");
		expect(body).toContain('owned=""');
	});

	it("still emits an open issue alongside a closed one", () => {
		const body = build([
			{ number: 1, title: "open one", state: "OPEN" },
			{ number: 2, title: "closed one", state: "CLOSED" },
		]);

		expect(outsideFences(body)).toMatch(/^Closes #1$/m);
		expect(body).not.toContain("Closes #2");
	});
});

describe("the managed region", () => {
	it("is delimited by the silk-release markers the other modules match on", () => {
		const body = build([]);

		expect(body.startsWith(Markers.MANAGED_START)).toBe(true);
		expect(body.trimEnd().endsWith(Markers.MANAGED_END)).toBe(true);
		expect(Markers.MANAGED_START).toBe("<!-- silk-release:start -->");
		expect(Markers.SQUASH_FENCE_LANGUAGE).toBe("proposed-squash-commit");
	});

	it("preserves human content around it and replaces rather than appends", () => {
		const first = build([{ number: 1, title: "one", state: "open" }]);
		const existing = ManagedPrBody.upsert("Human prose above.\n", first);
		const second = build([{ number: 2, title: "two", state: "open" }]);
		const updated = ManagedPrBody.upsert(existing, second);

		expect(updated).toContain("Human prose above.");
		expect(updated.split(Markers.MANAGED_START)).toHaveLength(2);
		expect(outsideFences(updated)).toMatch(/^Closes #2$/m);
		expect(updated).not.toContain("Closes #1");
	});
});

describe("the summary region", () => {
	it("carries an existing summary through a regeneration", () => {
		// The property `update-release-branch.ts` depends on: the region is
		// regenerated every run, so a summary not read back first is destroyed.
		const withSummary = build([], "Prose an agent wrote.");
		const carried = ManagedPrBody.extractSummary(withSummary);

		expect(carried).toContain("Prose an agent wrote.");
		expect(build([], carried)).toContain("Prose an agent wrote.");
	});

	it("reads back nothing from a body with no region", () => {
		expect(ManagedPrBody.extractSummary("no markers here")).toBe("");
	});
});
