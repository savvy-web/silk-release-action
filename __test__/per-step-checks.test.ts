// Tests for Phase 2's three per-step check runs.
//
// ⚠️ FIRST-EVER COVERAGE. This lived inline in a 624-line orchestrator that no
// test executed. CHARACTERIZATION tests: they pin what the code does today, not
// what it should do, and where the two differ the test says so and is written
// to fail when the fix lands.
//
// Driven through the kit's own `CheckRun.layerTest`, whose unstubbed members
// die loudly — so a call this step should not be making names itself rather
// than passing.

import { CheckRun, CheckRunRef, GitHubError } from "@effected/github";
import { Effect, Logger } from "effect";
import { describe, expect, it } from "vitest";
import type { CheckConclusion } from "../src/release/validation-checks.js";
import type { PerStepCheckUrls } from "../src/steps/per-step-checks.js";
import {
	PER_STEP_CHECK_NAMES,
	createPerStepCheck,
	createPerStepChecks,
	perStepCheckTitle,
} from "../src/steps/per-step-checks.js";

const SHA = "abc1234";

const SUMMARIES = { publish: "publish body", releaseNotes: "notes body", sbom: "sbom body" };

/** Every conclusion is `failure` unless a case says otherwise. */
const alwaysFailure = (): CheckConclusion => "failure";

const gitHubError = (reason: string) => new GitHubError({ kind: "transport", operation: "CheckRun.create", reason });

interface Created {
	readonly title: string;
	readonly sha: string;
}
interface Completed {
	readonly id: number;
	readonly conclusion: string;
	readonly title: string;
	readonly summary: string;
}

/**
 * Drive the step against a recording `CheckRun`, capturing what it created,
 * what it completed, and every line it logged.
 */
const harness = (options: { readonly failCreate?: boolean; readonly failComplete?: boolean } = {}) => {
	const created: Array<Created> = [];
	const completed: Array<Completed> = [];
	const lines: Array<string> = [];

	const layer = CheckRun.layerTest({
		create: (title: string, sha: string) =>
			options.failCreate === true
				? Effect.fail(gitHubError("checks API down"))
				: Effect.sync(() => {
						created.push({ title, sha });
						return CheckRunRef.make({
							id: created.length,
							name: title,
							url: `https://gh/checks/${created.length}`,
							status: "in_progress",
						});
					}),
		complete: (id: number, conclusion: string, output: { title: string; summary: string }) =>
			options.failComplete === true
				? Effect.fail(gitHubError("complete rejected"))
				: Effect.sync(() => {
						completed.push({ id, conclusion, title: output.title, summary: output.summary });
					}),
		// biome-ignore lint/suspicious/noExplicitAny: the kit's shape is wider than this step uses.
	} as any);

	const capture = Logger.make<unknown, void>((o) => {
		lines.push(String(o.message));
	});

	const run = async <A, R>(effect: Effect.Effect<A, never, R>): Promise<A> =>
		Effect.runPromise(effect.pipe(Effect.provide(layer), Effect.provide(Logger.layer([capture]))) as Effect.Effect<A>);

	return { created, completed, lines, run, text: () => lines.join("\n") };
};

describe("perStepCheckTitle", () => {
	it("leaves a real run's title alone", () => {
		expect(perStepCheckTitle("Publish Validation", false)).toBe("Publish Validation");
	});

	it("prefixes a rehearsal, so it cannot overwrite the real run's check", () => {
		// GitHub keys check runs by NAME. An unprefixed rehearsal on the same commit
		// would replace the real run's result with a dry-run one.
		expect(perStepCheckTitle("Publish Validation", true)).toBe("🧪 Publish Validation (Dry Run)");
	});
});

describe("PER_STEP_CHECK_NAMES", () => {
	it("matches the conclusion lookup keys exactly", async () => {
		// These strings are the key `conclusionFor` is called with. A drift detaches
		// a check run from the verdict it is meant to report — it would silently
		// conclude `success` for an unknown name.
		expect([...PER_STEP_CHECK_NAMES]).toEqual(["Publish Validation", "Release Notes Preview", "SBOM Preview"]);
	});
});

describe("createPerStepCheck", () => {
	it("creates against the head sha and completes with the conclusion", async () => {
		const h = harness();
		const url = await h.run(createPerStepCheck(SHA, "Publish Validation", "neutral", "body"));

		expect(h.created).toEqual([{ title: "Publish Validation", sha: SHA }]);
		expect(h.completed).toEqual([{ id: 1, conclusion: "neutral", title: "Publish Validation", summary: "body" }]);
		expect(url).toBe("https://gh/checks/1");
	});

	it("uses the title for BOTH the check-run name and its output title", async () => {
		const h = harness();
		await h.run(createPerStepCheck(SHA, "🧪 SBOM Preview (Dry Run)", "success", "body"));

		expect(h.created[0]?.title).toBe("🧪 SBOM Preview (Dry Run)");
		expect(h.completed[0]?.title).toBe("🧪 SBOM Preview (Dry Run)");
	});

	it("degrades a failed CREATE to the empty sentinel, and does not try to complete", async () => {
		const h = harness({ failCreate: true });
		const url = await h.run(createPerStepCheck(SHA, "Publish Validation", "failure", "body"));

		expect(url).toBe("");
		// Nothing to complete — attempting it would raise a second, misleading
		// warning about an id that never existed.
		expect(h.completed).toEqual([]);
		expect(h.text()).toContain('Failed to create check run "Publish Validation"');
	});

	it("CHARACTERIZATION — still returns the URL when COMPLETE fails", async () => {
		// The two degradations are deliberately different. The check run exists and
		// is reachable; it is merely stuck `in_progress`. Dropping the URL would
		// hide a page a reader could still use.
		//
		// ⚠️ But the row it feeds then LINKS to a check that never reached a
		// conclusion, and nothing marks it as such — same family as
		// savvy-web/silk-release-action#216. Pinned, not fixed.
		const h = harness({ failComplete: true });
		const url = await h.run(createPerStepCheck(SHA, "SBOM Preview", "failure", "body"));

		expect(url).toBe("https://gh/checks/1");
		expect(h.text()).toContain('Failed to complete check run "SBOM Preview"');
	});
});

describe("createPerStepChecks", () => {
	it("creates all three, in the order the checks table reports them", async () => {
		const h = harness();
		await h.run(createPerStepChecks({ sha: SHA, dryRun: false, conclusionFor: alwaysFailure, summaries: SUMMARIES }));

		// Sequential and ordered: the runner's checks list is ordered by creation,
		// so racing these would shuffle it between runs.
		expect(h.created.map((c) => c.title)).toEqual(["Publish Validation", "Release Notes Preview", "SBOM Preview"]);
	});

	it("returns each check's URL under its own key", async () => {
		const h = harness();
		const urls = await h.run(
			createPerStepChecks({ sha: SHA, dryRun: false, conclusionFor: alwaysFailure, summaries: SUMMARIES }),
		);

		// Keyed, not positional — a transposition here would put the SBOM link on
		// the Publish row and nothing would notice.
		expect(urls).toEqual({
			publish: "https://gh/checks/1",
			releaseNotes: "https://gh/checks/2",
			sbom: "https://gh/checks/3",
		});
	});

	it("gives each check its own summary body", async () => {
		const h = harness();
		await h.run(createPerStepChecks({ sha: SHA, dryRun: false, conclusionFor: alwaysFailure, summaries: SUMMARIES }));

		expect(h.completed.map((c) => c.summary)).toEqual(["publish body", "notes body", "sbom body"]);
	});

	it("looks the conclusion up by the UNPREFIXED name, even in a dry run", async () => {
		// The load-bearing detail. Only the displayed title carries the rehearsal
		// prefix; keying the conclusion off the prefixed title would miss every
		// entry and silently report `success` for all three checks in every dry run.
		const asked: Array<string> = [];
		const h = harness();
		await h.run(
			createPerStepChecks({
				sha: SHA,
				dryRun: true,
				conclusionFor: (name) => {
					asked.push(name);
					return "failure";
				},
				summaries: SUMMARIES,
			}),
		);

		expect(asked).toEqual(["Publish Validation", "Release Notes Preview", "SBOM Preview"]);
		expect(h.created.map((c) => c.title)).toEqual([
			"🧪 Publish Validation (Dry Run)",
			"🧪 Release Notes Preview (Dry Run)",
			"🧪 SBOM Preview (Dry Run)",
		]);
		// And the conclusion actually reached the check run — a dry run still
		// reports its real verdict.
		expect(h.completed.map((c) => c.conclusion)).toEqual(["failure", "failure", "failure"]);
	});

	it("carries a per-check conclusion rather than one shared verdict", async () => {
		const h = harness();
		await h.run(
			createPerStepChecks({
				sha: SHA,
				dryRun: false,
				conclusionFor: (name) =>
					name === "SBOM Preview" ? "neutral" : name === "Publish Validation" ? "failure" : "success",
				summaries: SUMMARIES,
			}),
		);

		expect(h.completed.map((c) => c.conclusion)).toEqual(["failure", "success", "neutral"]);
	});

	it("CHARACTERIZATION — a check that could not be created is invisible downstream", async () => {
		// ⚠️ All three yield `""`, which `applyCheckUrls` turns into "leave the row's
		// URL as it was" — i.e. `null`, which is exactly what a row that legitimately
		// has no page yet looks like. The checks table renders identically whether
		// the check run failed to be created or was never expected.
		//
		// Same family as savvy-web/silk-release-action#216: a degradation whose
		// result is indistinguishable from a normal outcome. Only the warnings in
		// the job log distinguish them.
		const h = harness({ failCreate: true });
		const urls = await h.run(
			createPerStepChecks({ sha: SHA, dryRun: false, conclusionFor: alwaysFailure, summaries: SUMMARIES }),
		);

		expect(urls).toEqual({ publish: "", releaseNotes: "", sbom: "" });
		// Three separate warnings — one per check — is the only trace.
		expect(h.lines.filter((l) => l.includes("Failed to create check run"))).toHaveLength(3);
	});

	it("keeps going after one check fails to be created", async () => {
		// A transport blip on the first must not cost the other two.
		let attempt = 0;
		const h = harness();
		const failingFirst = CheckRun.layerTest({
			create: (title: string, sha: string) => {
				attempt += 1;
				if (attempt === 1) return Effect.fail(gitHubError("blip"));
				h.created.push({ title, sha });
				return Effect.succeed(
					CheckRunRef.make({ id: attempt, name: title, url: `https://gh/checks/${attempt}`, status: "in_progress" }),
				);
			},
			complete: () => Effect.void,
			// biome-ignore lint/suspicious/noExplicitAny: the kit's shape is wider than this step uses.
		} as any);

		const urls = await Effect.runPromise(
			createPerStepChecks({ sha: SHA, dryRun: false, conclusionFor: alwaysFailure, summaries: SUMMARIES }).pipe(
				Effect.provide(failingFirst),
				Effect.provide(Logger.layer([])),
			) as Effect.Effect<Awaited<ReturnType<typeof h.run<PerStepCheckUrls, never>>>>,
		);

		expect(urls.publish).toBe("");
		expect(urls.releaseNotes).toBe("https://gh/checks/2");
		expect(urls.sbom).toBe("https://gh/checks/3");
	});
});
