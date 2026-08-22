// Tests for Phase 2's first two steps — issue linking and build validation.
//
// ⚠️ FIRST-EVER COVERAGE. Both lived inline in a 624-line orchestrator that no
// test executed. CHARACTERIZATION tests: they pin what the code does today, not
// what it should do, and where the two differ the test says so and is written
// to fail when the fix lands.
//
// The two steps share a shape — run a util inside a log group, degrade any
// error to a named fallback, emit a summary line — so they share a harness.
// What that harness makes visible is where they DIFFER, which is the point:
// one degradation is honest and the other is invisible.

import { ActionLogger } from "@effected/github-actions";
import { Effect, Logger, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const linkIssuesFromCommits = vi.hoisted(() => vi.fn());
const validateBuilds = vi.hoisted(() => vi.fn());

vi.mock("../src/utils/link-issues-from-commits.js", () => ({ linkIssuesFromCommits }));
vi.mock("../src/utils/validate-builds.js", () => ({ validateBuilds }));

const { LINK_ISSUES_FAILED, linkIssues } = await import("../src/steps/link-issues.js");
const { buildValidation, buildValidationFailed } = await import("../src/steps/build-validation.js");
const { deriveValidationChecks } = await import("../src/release/validation-checks.js");
const { SKIPPED_PUBLISH_VALIDATION } = await import("../src/steps/publish-validation.js");

const REFS = { releaseBranch: "changeset-release/main", targetBranch: "main" };

const LINKED = {
	linkedIssues: [
		{ number: 1, title: "one" },
		{ number: 2, title: "two" },
	],
	commits: [{ sha: "abc" }],
	checkId: 55,
	htmlUrl: "https://gh/link",
};

/**
 * Run a step, recording the log-group names it opened and every line it logged.
 *
 * @remarks
 * `ActionLogger.layerTest` takes overrides, so `group` records its name and
 * runs the body — that is how "the step opened its own group, and the summary
 * line landed OUTSIDE it" becomes observable. Every unstubbed member keeps the
 * kit double's die-loudly default.
 */
const run = async <A, R>(step: Effect.Effect<A, never, R>) => {
	const lines: Array<string> = [];
	const groups: Array<string> = [];
	const capture = Logger.make<unknown, void>((options) => {
		lines.push(String(options.message));
	});
	const loggerLayer = ActionLogger.layerTest({
		group: (name, body) =>
			Effect.gen(function* () {
				groups.push(name);
				// Marks where the group ended, so the summary line's position relative
				// to it is assertable rather than assumed.
				const value = yield* body;
				lines.push(`<<group:${name} closed>>`);
				return value;
			}),
	});
	const result = await Effect.runPromise(
		step.pipe(Effect.provide(loggerLayer), Effect.provide(Logger.layer([capture]))) as Effect.Effect<A>,
	);
	return { result, lines, groups, text: lines.join("\n") };
};

beforeEach(() => {
	linkIssuesFromCommits.mockReset();
	validateBuilds.mockReset();
});

describe("LINK_ISSUES_FAILED", () => {
	it("is indistinguishable from a clean run that found nothing", () => {
		// ⚠️ THIS IS THE FINDING. `LinkIssuesResult` carries no failure signal, so
		// the degraded value and a genuine "no issues referenced" run are the same
		// object. Everything downstream reads it as success.
		expect(LINK_ISSUES_FAILED.linkedIssues).toEqual([]);
		expect(LINK_ISSUES_FAILED.commits).toEqual([]);
		expect(LINK_ISSUES_FAILED.htmlUrl).toBe("");
		expect(LINK_ISSUES_FAILED.checkId).toBe(0);
	});
});

describe("buildValidationFailed", () => {
	it("reports failure, which is what makes this degradation honest", () => {
		// The whole difference from `LINK_ISSUES_FAILED`: `success: false` feeds an
		// error finding and the build-failed cascade, so a crash reports red.
		expect(buildValidationFailed("boom").success).toBe(false);
	});

	it("carries the cause into `errors`, which becomes the finding's message", () => {
		// `deriveValidationChecks` uses `errors` as the build finding's message and
		// falls back to "Build failed" only when it is blank — so losing the cause
		// here replaces a real stack with a generic string on the one path where
		// the diagnosis matters most.
		expect(buildValidationFailed("Error: tsc exploded\n  at x.ts:1").errors).toBe("Error: tsc exploded\n  at x.ts:1");
	});
});

describe("linkIssues", () => {
	it("returns what the linker found, inside its own log group", async () => {
		linkIssuesFromCommits.mockReturnValue(Effect.succeed(LINKED));
		const { result, groups } = await run(linkIssues(REFS));

		expect(result).toEqual(LINKED);
		expect(groups).toEqual(["Link issues from commits"]);
	});

	it("emits the summary line OUTSIDE the group, so it survives a collapsed block", async () => {
		linkIssuesFromCommits.mockReturnValue(Effect.succeed(LINKED));
		const { lines } = await run(linkIssues(REFS));

		const closed = lines.indexOf("<<group:Link issues from commits closed>>");
		const summary = lines.findIndex((l) => l.includes("Link issues —"));
		expect(closed).toBeGreaterThanOrEqual(0);
		expect(summary).toBeGreaterThan(closed);
	});

	it("degrades a failure to the named fallback rather than failing the phase", async () => {
		linkIssuesFromCommits.mockReturnValue(Effect.fail(new Error("issues API down")));
		const { result, text } = await run(linkIssues(REFS));

		expect(result).toEqual(LINK_ISSUES_FAILED);
		expect(text).toContain("linkIssuesFromCommits failed: Error: issues API down");
	});

	it("CHARACTERIZATION — logs ✅ even when it just failed", async () => {
		// ⚠️ Unconditionally ✅, unlike the build step, which branches. A failed run
		// logs `linkIssuesFromCommits failed: …` and then `✅ Link issues — 0
		// issue(s) linked` two lines later. Pinned; changing the icon is a
		// behaviour change.
		linkIssuesFromCommits.mockReturnValue(Effect.fail(new Error("issues API down")));
		const { text } = await run(linkIssues(REFS));

		expect(text).toContain("✅ Link issues — 0 issue(s) linked");
		expect(text).not.toContain("❌ Link issues");
	});

	it("counts the issues it linked, not the commits it read", async () => {
		linkIssuesFromCommits.mockReturnValue(Effect.succeed(LINKED));
		const { text } = await run(linkIssues(REFS));

		// Two issues from one commit — a count off the wrong array reads "1".
		expect(text).toContain("✅ Link issues — 2 issue(s) linked");
	});
});

describe("buildValidation", () => {
	it("returns what the validator found, inside its own log group", async () => {
		const passed = { success: true, errors: "", checkId: 9, htmlUrl: "https://gh/build" };
		validateBuilds.mockReturnValue(Effect.succeed(passed));
		const { result, groups } = await run(buildValidation("pnpm", Option.none()));

		expect(result).toEqual(passed);
		expect(groups).toEqual(["Validate builds"]);
	});

	it("passes the package manager through", async () => {
		validateBuilds.mockReturnValue(Effect.succeed({ success: true, errors: "", checkId: 0, htmlUrl: "" }));
		await run(buildValidation("yarn", Option.none()));

		expect(validateBuilds).toHaveBeenCalledWith("yarn", Option.none());
	});

	it("passes the on-build gate through", async () => {
		validateBuilds.mockReturnValue(Effect.succeed({ success: true, errors: "", checkId: 0, htmlUrl: "" }));
		await run(buildValidation("pnpm", Option.some("pnpm catalog:check")));

		// The step is a pass-through for the gate; the execution lives one layer
		// down in `validateBuilds`.
		expect(validateBuilds).toHaveBeenCalledWith("pnpm", Option.some("pnpm catalog:check"));
	});

	it("branches the summary line on the outcome", async () => {
		validateBuilds.mockReturnValue(Effect.succeed({ success: true, errors: "", checkId: 0, htmlUrl: "" }));
		expect((await run(buildValidation("pnpm", Option.none()))).text).toContain("✅ Build validation — passed");

		validateBuilds.mockReturnValue(Effect.succeed({ success: false, errors: "nope", checkId: 0, htmlUrl: "" }));
		expect((await run(buildValidation("pnpm", Option.none()))).text).toContain("❌ Build validation — failed");
	});

	it("degrades a crash to a FAILED result, carrying the cause", async () => {
		validateBuilds.mockReturnValue(Effect.fail(new Error("spawn ENOENT")));
		const { result, text } = await run(buildValidation("pnpm", Option.none()));

		expect(result.success).toBe(false);
		expect(result.errors).toContain("spawn ENOENT");
		// `logError`, not `logWarning` — the level matches the consequence.
		expect(text).toContain("validateBuilds failed: Error: spawn ENOENT");
		expect(text).toContain("❌ Build validation — failed");
	});
});

describe("the two degradations are NOT symmetric", () => {
	// The reason these two steps are tested together. Both catch everything and
	// return a fallback; only one of them tells anybody.

	it("a crashed BUILD validation reports red downstream", async () => {
		validateBuilds.mockReturnValue(Effect.fail(new Error("spawn ENOENT")));
		const { result } = await run(buildValidation("pnpm", Option.none()));

		const checks = deriveValidationChecks({
			linkedIssueCount: 0,
			linkIssuesUrl: "",
			buildPassed: result.success,
			buildErrors: result.errors,
			buildCheckId: result.checkId,
			buildUrl: result.htmlUrl,
			publish: SKIPPED_PUBLISH_VALIDATION,
			strictWarnings: false,
		});

		// An error finding carrying the real cause, and the cascade takes the three
		// build-dependent rows with it.
		expect(checks.findings[0]?.severity).toBe("error");
		expect(checks.findings[0]?.message).toContain("spawn ENOENT");
		expect(checks.results.every((r) => r.success)).toBe(false);
	});

	it("CHARACTERIZATION — a crashed LINK-ISSUES step reports a fully green phase", async () => {
		// ⚠️ THIS PINS A BUG, and it is the same shape as
		// savvy-web/silk-release-action#216 in a second place: a degrade-to-warning
		// path whose result is indistinguishable from success.
		//
		// No finding is ever scoped to "Link Issues from Commits", the check is
		// build-INDEPENDENT so no cascade can reach it, and the fallback looks like
		// a clean run. So the row passes, the conclusion is `success`, and the log
		// says ✅ — for a step that crashed.
		linkIssuesFromCommits.mockReturnValue(Effect.fail(new Error("issues API down")));
		const { result } = await run(linkIssues(REFS));

		const checks = deriveValidationChecks({
			linkedIssueCount: result.linkedIssues.length,
			linkIssuesUrl: result.htmlUrl,
			buildPassed: true,
			buildErrors: "",
			buildCheckId: 0,
			buildUrl: "",
			publish: { ...SKIPPED_PUBLISH_VALIDATION, publishOk: true, sbomOk: true },
			strictWarnings: true, // the strictest setting available, and it does not help
		});

		expect(checks.findings).toEqual([]);
		expect(checks.conclusionFor("Link Issues from Commits")).toBe("success");
		expect(checks.rows.find((r) => r.name === "Link Issues from Commits")?.status).toBe("pass");
		// And the row's URL is null rather than a broken link — the one honest
		// signal, and it is indistinguishable from "the check run could not be
		// created", which is a different failure.
		expect(checks.rows.find((r) => r.name === "Link Issues from Commits")?.url).toBeNull();
	});
});
