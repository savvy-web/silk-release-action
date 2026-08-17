// Tests for Phase 1's reporting — specifically, what it publishes to the pull
// request and in what state.
//
// Renamed from `branch-management.test.ts`: the subject is now
// `withReleasePlanSection`, the module that owns this decision, rather than the
// whole phase.
//
// The construct doing the state machine (`withSection`) is proven on its own in
// `managed-sections.test.ts`, including the defect and interrupt paths. What is
// proven HERE is that `withReleasePlanSection` wires it correctly: which arm
// gets bracketed, what body survives a failure, and whether anything is written
// at all in a dry run.
//
// That is only observable by varying the branch flow's OUTCOME, and the flow is
// a single effect PARAMETER — a failing, dying or interrupted flow is one line.
// This replaces the `BranchManagementSeams` record it grew out of: six injected
// functions, a `<R = never>` generic, a `REAL_SEAMS as never` cast, and a
// `SeamError` union assembled through `Effect.Error<ReturnType<typeof …>>`.
// Reaching the same three outcomes through the real flows would still mean
// scripting the eighteen services `updateReleaseBranch` declares, which is why
// the reporting is a separate module rather than the phase being run whole.
//
// The assertions that were about RENDERED CONTENT rather than about publishing
// are now pure, against `buildReleasePlanBody` and `buildPendingVerdictSection`
// — no effect, no layers, no runtime.

import { GitHubError } from "@effected/github";
import { Effect, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BranchFlowOutcome, ReleasePlanSection } from "../src/steps/publish-release-plan.js";
import {
	buildPendingVerdictSection,
	buildReleasePlanBody,
	withReleasePlanSection,
} from "../src/steps/publish-release-plan.js";
import type { PlannedPackage } from "../src/utils/release-plan.js";
import { cleanupTestEnvironment, setupTestEnvironment } from "./utils/github-mocks.js";

const HEAD_SHA = "abc1234def5678";
const RUN_ID = "77";
const STAMPED_AT = "2026-01-01T00:00:00.000Z";

/**
 * The projected plan Phase 1 reports.
 *
 * @remarks
 * `@scope/alpha` carries `changesetCount: 0` — it releases only because a
 * dependency moved, and is invisible to any file-based report. That is the case
 * the release table exists to make visible.
 */
const PACKAGES: ReadonlyArray<PlannedPackage> = [
	{ name: "@scope/zulu", bumpType: "minor", changesetCount: 1, oldVersion: "1.4.0", newVersion: "1.5.0" },
	{ name: "@scope/alpha", bumpType: "patch", changesetCount: 0, oldVersion: "2.0.3", newVersion: "2.0.4" },
];

/** Every comment write the reporting made, in order. */
interface Published {
	readonly prNumber: number;
	readonly body: string;
}

/**
 * A real typed failure.
 *
 * @remarks
 * The seam version wrote `new Error("comment API down") as never`, because the
 * seam's error channel was an opaque derived union. `publish` now declares
 * `GitHubError` concretely, so the double raises the error the real
 * implementation raises — and the cast is gone.
 */
const commentApiDown = new GitHubError({
	kind: "transport",
	operation: "PullRequestComment.upsert",
	reason: "comment API down",
});

/** The flow's happy outcome: an updated branch on the existing PR. */
const updated: BranchFlowOutcome = { created: false, updated: true, hasConflicts: false, prNumber: 243 };

/** The create path's outcome: a brand-new PR. */
const createdPr: BranchFlowOutcome = { created: true, updated: false, hasConflicts: false, prNumber: 900 };

/**
 * Drive the reporting with a chosen flow, recording what it published.
 *
 * @param flow - The branch work to report around. Its outcome — success, typed
 *   failure, defect, interrupt — is the whole point of the parameter.
 */
const run = async <E>(
	flow: Effect.Effect<BranchFlowOutcome, E, never>,
	options: {
		readonly existingPrNumber?: number | null;
		readonly dryRun?: boolean;
		readonly existingComment?: string;
		readonly publish?: ReleasePlanSection<never>["publish"];
	} = {},
): Promise<{ published: Array<Published>; exit: "ok" | "failed"; outcome: BranchFlowOutcome | null }> => {
	const published: Array<Published> = [];
	let commentBody = options.existingComment ?? "";

	const section: ReleasePlanSection<never> = {
		existingPrNumber: options.existingPrNumber === undefined ? 243 : options.existingPrNumber,
		dryRun: options.dryRun === true,
		headSha: HEAD_SHA,
		runId: RUN_ID,
		planBody: buildReleasePlanBody(PACKAGES),
		pendingVerdict: buildPendingVerdictSection(HEAD_SHA, RUN_ID, STAMPED_AT),
		commitLink: (sha) => `https://github.example.com/acme/widgets/commit/${sha}`,
		read: () => Effect.succeed(commentBody),
		publish:
			options.publish ??
			((prNumber, body) => {
				published.push({ prNumber, body });
				// A real comment retains what was written last; the double must too, or
				// the preserve-neighbours behaviour is untestable.
				commentBody = body;
				return Effect.succeed({ commentId: 1 });
			}),
	};

	// `Logger.layer([])` removes every logger from the runtime. Without it the
	// `Effect.logWarning` calls in the reporting reach Effect's DEFAULT logger,
	// which writes via `console.log` — not `process.stdout.write`, so
	// `suppressOutput` cannot catch it — and leak into the reporter.
	const exit = await Effect.runPromiseExit(
		withReleasePlanSection(section, flow).pipe(Effect.provide(Logger.layer([]))),
	);

	return {
		published,
		exit: exit._tag === "Success" ? "ok" : "failed",
		outcome: exit._tag === "Success" ? exit.value : null,
	};
};

describe("withReleasePlanSection — what reaches the pull request", () => {
	// Mock hygiene between cases. Log suppression is NOT this — it is the
	// `Logger.layer([])` in `run` above; see the note there.
	beforeEach(() => setupTestEnvironment({ suppressOutput: true }));
	afterEach(() => cleanupTestEnvironment());

	it("publishes the plan while the branch work runs, before it finishes", async () => {
		const seen: Array<string> = [];
		await run(
			Effect.sync(() => {
				// By now the `running` write must already have happened; a write
				// ordered after the work leaves the section blank for the whole run.
				expect(seen.length).toBeGreaterThan(0);
				return updated;
			}),
			{
				publish: (_pr, body) => {
					seen.push(body);
					return Effect.succeed({ commentId: 1 });
				},
			},
		);

		// Two writes: `running` before the work, then the terminal state after.
		expect(seen).toHaveLength(2);
		expect(seen[0]).toContain("running");
		expect(seen[1]).toContain("complete");
	});

	it("marks the section complete once the branch work succeeds", async () => {
		const { published } = await run(Effect.succeed(updated));
		const last = published.at(-1)?.body ?? "";

		expect(last).toContain("complete");
		expect(last).not.toContain('state="running"');
	});

	it("leaves the section FAILED, retaining the plan, when the branch work fails", async () => {
		// No cast: the flow's error channel is a free type parameter, so an
		// ordinary `Error` is a legal failure here.
		const { published } = await run(Effect.fail(new Error("push rejected")));
		const last = published.at(-1)?.body ?? "";

		expect(last).toContain("failed");
		// Rule 2: the previous result is retained and marked, never blanked — a
		// reader still learns what the release was going to be.
		expect(last).toContain("@scope/zulu");
	});

	it("leaves the section FAILED, not running, when the branch work dies with a defect", async () => {
		const { published } = await run(Effect.die(new Error("boom")));
		const last = published.at(-1)?.body ?? "";

		// The case a tap/tapError pair misses. A section stuck at `running` reads
		// as a job still working, forever.
		expect(last).toContain("failed");
		expect(last).not.toContain('state="running"');
	});

	it("leaves the section CANCELLED when the branch work is interrupted", async () => {
		const { published } = await run(Effect.interrupt);
		const last = published.at(-1)?.body ?? "";

		// Distinct from `failed`: "we were stopped" and "we broke" are different
		// facts about a release.
		expect(last).toContain("cancelled");
	});

	it("rewrites only its own section, leaving the rest of the comment intact", async () => {
		// The bug this replaces: every write started from an empty body, so a
		// comment carrying anything else — another phase's section, a human's
		// note — lost it on the next run.
		const { published } = await run(Effect.succeed(updated), {
			existingComment:
				"A human wrote this.\n\n<!-- silk-release:section:other:start -->\nsomeone else's section\n<!-- silk-release:section:other:end -->",
		});
		const last = published.at(-1)?.body ?? "";

		expect(last).toContain("A human wrote this.");
		expect(last).toContain("someone else's section");
		expect(last).toContain("@scope/zulu");
	});

	it("seeds the verdict ABOVE the plan, so validation fills it in place", async () => {
		const { published } = await run(Effect.succeed(updated));
		const last = published.at(-1)?.body ?? "";

		// `upsertSection` appends a key it has not seen. Without Phase 1 seeding the
		// verdict, validation's header would land BELOW the table.
		const verdict = last.indexOf("silk-release.sections.validation-status ");
		const plan = last.indexOf("silk-release.sections.release-plan ");
		expect(verdict).toBeGreaterThanOrEqual(0);
		expect(plan).toBeGreaterThanOrEqual(0);
		expect(verdict).toBeLessThan(plan);
		// The rendered heading level is `upsertSection`'s contribution, not the
		// section's own — the section object carries a bare title, and only the
		// published body shows the `###` it renders under. Asserted here because
		// this is the only place that body exists.
		expect(last).toContain("### ⏳ Release Validation");
	});

	it("stamps the section with the head sha so staleness is detectable", async () => {
		const { published } = await run(Effect.succeed(updated));

		expect(published.at(-1)?.body).toContain(HEAD_SHA);
	});

	it("publishes nothing at all in a dry run", async () => {
		const { published } = await run(Effect.succeed(updated), { dryRun: true });

		// A dry run must not write to the pull request; the phase still reports.
		expect(published).toEqual([]);
	});

	it("publishes nothing on the create path in a dry run either", async () => {
		// The bracket arm and the publish-once arm each carry their own dry-run
		// guard. Covering only the first leaves the second free to write to a real
		// pull request during a rehearsal.
		const { published } = await run(Effect.succeed(createdPr), { existingPrNumber: null, dryRun: true });

		expect(published).toEqual([]);
	});

	it("does not bracket when there is no pull request to write to yet", async () => {
		// The create path has nothing to comment on until it has created the PR,
		// so there is no `running` state — one write, after the fact.
		const { published } = await run(Effect.succeed(createdPr), { existingPrNumber: null });

		expect(published).toHaveLength(1);
		expect(published[0]?.prNumber).toBe(900);
		expect(published[0]?.body).toContain("complete");
	});

	it("survives a comment write that fails, rather than failing the release", async () => {
		const { exit } = await run(Effect.succeed(updated), { publish: () => Effect.fail(commentApiDown) });

		// A reporting write is not a release gate.
		expect(exit).toBe("ok");
	});

	it("returns the flow's outcome untouched", async () => {
		// The reporting WRAPS the flow; it must not restate what the flow decided.
		// Nothing above would catch a combinator that swallowed the outcome and
		// synthesised a default, because every other assertion is about the
		// published body — and `branchManagement` reads `prNumber` off this value
		// to build the release-PR url and the `release-pr-number` output.
		const { outcome } = await run(Effect.succeed(createdPr), { existingPrNumber: null });

		expect(outcome).toEqual(createdPr);
	});
});

describe("buildReleasePlanBody", () => {
	it("carries the release plan, including a dependency-driven package", () => {
		const body = buildReleasePlanBody(PACKAGES);

		expect(body).toContain("@scope/zulu");
		// `@scope/alpha` has no changeset — invisible to a file-based report.
		expect(body).toContain("@scope/alpha");
		expect(body).toContain("1.4.0 → 1.5.0");
	});
});

describe("buildPendingVerdictSection", () => {
	it("marks the seeded verdict as not yet run, rather than claiming a result", () => {
		const section = buildPendingVerdictSection(HEAD_SHA, RUN_ID, STAMPED_AT);

		// A ✅ here would assert a validation outcome Phase 1 has no knowledge of.
		// The state icon leads the heading, so a reader scanning headings sees the
		// verdict without reading to the end of the line.
		expect(section.title).toContain("⏳ Release Validation");
		expect(section.title).not.toContain("✅");
		// And it carries a real table from the start, every row pending, rather
		// than a sentence that changes shape when validation replaces it.
		expect(section.body).toContain("| ⏳ | Build Validation | pending |");
	});

	it("stamps pending, under the key validation later replaces in place", () => {
		const section = buildPendingVerdictSection(HEAD_SHA, RUN_ID, STAMPED_AT);

		// The key is the join: validation rewrites THIS region, so a drift here
		// silently produces two verdicts in one comment instead of one updated.
		expect(section.key).toBe("validation-status");
		expect(section.stamp?.state).toBe("pending");
		expect(section.stamp?.sha).toBe(HEAD_SHA);
	});
});
