// Tests for Phase 2's write to the release PR's sticky comment.
//
// ⚠️ FIRST-EVER COVERAGE. This lived inline in the validation orchestrator,
// which no test executes: replacing that whole body with `Effect.die` left the
// suite green. CHARACTERIZATION tests — they pin what the code does today, not
// what it should do, and where the two differ the test says so.
//
// Split in two, deliberately:
//
//  - `buildValidationSections` is pure, so WHAT THE COMMENT CLAIMS is asserted
//    with no layers at all.
//  - `publishValidationReport` is driven through the kit's own doubles, whose
//    unstubbed members die naming themselves — so a call this step should not be
//    making names itself rather than passing.
//
// The read-modify-write underneath both is `writeSections`, proven separately
// in `write-sections.test.ts`. What is proven HERE is the wiring: which pull
// request is looked up, which sections go in, what the stamp says, and what
// happens when either half of the round trip fails.

import type { CommentRecord } from "@effected/github";
import { GitHubError, PullRequest, PullRequestComment, PullRequestInfo, Repo, RepoRef } from "@effected/github";
import { ActionEnvironment } from "@effected/github-actions";
import { Effect, Layer, Logger, Option } from "effect";
import { describe, expect, it } from "vitest";
import type { ValidationFinding, ValidationPackageResult } from "../src/release/types.js";
import { toValidationOutput } from "../src/schema/projections.js";
import { RELEASE_PLAN_KEY, buildPendingVerdictSection } from "../src/steps/publish-release-plan.js";
import type { ValidationReport } from "../src/steps/publish-validation-report.js";
import {
	VALIDATION_DETAILS_KEY,
	VALIDATION_STATUS_KEY,
	buildValidationSections,
	publishValidationReport,
} from "../src/steps/publish-validation-report.js";
import type { SectionStamp } from "../src/utils/managed-sections.js";

const OWNER = "savvy-web";
const RELEASE_BRANCH = "changeset-release/main";
const TARGET_BRANCH = "main";
const HEAD_SHA = "abc1234def5678";
const RUN_ID = "77";
const NOW = "2026-02-01T00:00:00.000Z";

const STAMP: SectionStamp = { state: "complete", sha: HEAD_SHA, runId: RUN_ID, at: NOW };

/** One package with one ready npm target — enough for a real release table. */
const PACKAGE: ValidationPackageResult = {
	name: "@savvy-web/foo",
	version: "1.2.0",
	baseVersion: "1.1.0",
	changesetCount: 1,
	builds: [
		{
			directory: "/repo/dist/npm",
			packedBytes: 700,
			unpackedBytes: 2300,
			fileCount: 5,
			sbom: { componentCount: 3, ntiaCompliant: true, missingNtiaFields: [] },
			targets: [{ registry: "https://registry.npmjs.org/", status: "ready", access: "public", provenance: false }],
		},
	],
	releaseNotes: { status: "found", content: "### Minor Changes\n\n- something" },
};

/**
 * The report, built through the REAL projection rather than a hand-written
 * payload — so a change to `toValidationOutput` reaches these tests instead of
 * being papered over by a fixture that agrees with nothing.
 */
const report = (
	options: {
		readonly buildsPassed?: boolean;
		readonly dryRun?: boolean;
		readonly findings?: ReadonlyArray<ValidationFinding>;
	} = {},
): ValidationReport => {
	const buildsPassed = options.buildsPassed !== false;
	const output = toValidationOutput({
		buildsPassed,
		packageCount: 1,
		npmReady: true,
		githubPackagesReady: true,
		totalTargets: 1,
		readyTargets: 1,
		checks: [{ name: "Build Validation", status: buildsPassed ? "pass" : "error", outcome: "…", url: null }],
		findings: options.findings ?? [],
		validationPackages: [PACKAGE],
		checkRun: null,
		dryRun: options.dryRun === true,
	});
	return {
		validation: output.validation,
		validationPackages: [PACKAGE],
		options: { releaseNotesUrl: "https://gh.test/checks/9", dryRun: options.dryRun === true },
	};
};

const apiDown = (operation: string) => new GitHubError({ kind: "transport", operation, reason: "API down" });

const pullRequest = (number: number): PullRequestInfo =>
	PullRequestInfo.make({
		number,
		nodeId: `node-${number}`,
		url: `https://gh.test/pull/${number}`,
		title: `release: #${number}`,
		state: "open",
		head: RELEASE_BRANCH,
		headSha: HEAD_SHA,
		base: TARGET_BRANCH,
		baseSha: "base",
		draft: false,
		merged: false,
		mergedAt: Option.none(),
	});

interface Listed {
	readonly head?: string | undefined;
	readonly base?: string | undefined;
	readonly state?: string | undefined;
}
interface Upserted {
	readonly issueNumber: number;
	readonly key: string;
	readonly body: string;
}

/**
 * Drive the step against recording doubles, capturing the list filter, every
 * comment written, and every line logged.
 *
 * @remarks
 * `Logger.layer([capture])` replaces every logger — see the note in
 * `publish-release-plan.test.ts` for why the default one cannot merely be
 * suppressed.
 */
const run = async (
	options: {
		readonly prs?: ReadonlyArray<PullRequestInfo>;
		readonly listFails?: boolean;
		readonly upsertFails?: boolean;
		readonly existingComment?: string;
		readonly env?: Readonly<Record<string, string>>;
		readonly report?: ValidationReport;
		readonly headSha?: string;
	} = {},
) => {
	const listed: Array<Listed> = [];
	const upserted: Array<Upserted> = [];
	const lines: Array<string> = [];
	const capture = Logger.make<unknown, void>((o) => {
		lines.push(String(o.message));
	});
	let commentBody = options.existingComment ?? "";

	const layer = Layer.mergeAll(
		ActionEnvironment.layerTest({
			GITHUB_SHA: HEAD_SHA,
			GITHUB_RUN_ID: RUN_ID,
			GITHUB_REPOSITORY: `${OWNER}/silk-release-action`,
			GITHUB_SERVER_URL: "https://gh.test",
			...options.env,
		}),
		PullRequest.layerTest({
			list: (query) =>
				options.listFails === true
					? Effect.fail(apiDown("PullRequest.list"))
					: Effect.sync(() => {
							listed.push({ head: query?.head, base: query?.base, state: query?.state });
							return options.prs ?? [pullRequest(243)];
						}),
		}),
		PullRequestComment.layerTest({
			find: () =>
				Effect.succeed(
					commentBody === ""
						? Option.none()
						: Option.some({ id: 1, body: commentBody, url: "https://gh.test/c/1" } as CommentRecord),
				),
			upsert: (issueNumber, marker, body) =>
				options.upsertFails === true
					? Effect.fail(apiDown("PullRequestComment.upsert"))
					: Effect.sync(() => {
							upserted.push({ issueNumber, key: marker.key, body });
							// A real comment retains what was written last; the double must
							// too, or read-before-write is untestable.
							commentBody = body;
							return { id: 1, body, url: "https://gh.test/c/1" } as CommentRecord;
						}),
		}),
		Layer.succeed(Repo, RepoRef.make({ owner: OWNER, repo: "silk-release-action" })),
	);

	const outcome = await Effect.runPromise(
		publishValidationReport({
			owner: OWNER,
			releaseBranch: RELEASE_BRANCH,
			targetBranch: TARGET_BRANCH,
			report: options.report ?? report(),
			headSha: options.headSha ?? HEAD_SHA,
			now: () => NOW,
		}).pipe(Effect.provide(layer), Effect.provide(Logger.layer([capture]))),
	);

	return { outcome, listed, upserted, lines, text: lines.join("\n"), body: upserted.at(-1)?.body ?? "" };
};

describe("buildValidationSections", () => {
	it("puts the verdict first, then the plan, then the detail", async () => {
		// `upsertSection` appends a key it has not seen, so for a comment Phase 1
		// never got to seed, this order IS the reader's order.
		const keys = buildValidationSections(report(), STAMP).map((s) => s.key);

		expect(keys).toEqual([VALIDATION_STATUS_KEY, RELEASE_PLAN_KEY, VALIDATION_DETAILS_KEY]);
	});

	it("writes the verdict under the key Phase 1 seeded, not one of its own", async () => {
		// The join between the phases. A drift here does not fail anything — it
		// silently produces TWO verdicts in one comment instead of one updated.
		expect(buildPendingVerdictSection(HEAD_SHA, RUN_ID, NOW).key).toBe(VALIDATION_STATUS_KEY);
	});

	it("completes Phase 1's plan section rather than adding a second table", async () => {
		const plan = buildValidationSections(report(), STAMP)[1];

		expect(plan?.key).toBe(RELEASE_PLAN_KEY);
		expect(plan?.title).toBe("🚀 What will be released");
	});

	it("omits the detail section entirely until the build has passed", async () => {
		// Before the build completes it would be an empty shell under a heading
		// promising substance.
		const keys = buildValidationSections(report({ buildsPassed: false }), STAMP).map((s) => s.key);

		expect(keys).toEqual([VALIDATION_STATUS_KEY, RELEASE_PLAN_KEY]);
	});

	it("stamps all three identically — one run, one commit, one statement", async () => {
		const stamps = buildValidationSections(report(), STAMP).map((s) => s.stamp);

		expect(stamps).toEqual([STAMP, STAMP, STAMP]);
	});

	it("carries the table, its legend AND its totals in the plan section", async () => {
		// Totals sit with the table they total, not two headings below it in the
		// detail section.
		const plan = buildValidationSections(report(), STAMP)[1];

		expect(plan?.body).toContain("@savvy-web/foo");
		expect(plan?.body).toContain("1.1.0 → 1.2.0");
		expect(plan?.body).toContain("Total");
	});

	it("leads the verdict heading with the run's own state icon", async () => {
		const error: ValidationFinding = {
			severity: "error",
			check: "Publish Validation",
			scope: null,
			message: "unbound target",
		};
		const failing = buildValidationSections(report({ findings: [error] }), STAMP)[0];
		const passing = buildValidationSections(report(), STAMP)[0];

		// A fixed title would report every run as a success in the heading a reader
		// scans first. The verdict travels in the TITLE, not the body, because a
		// section renders its own heading.
		expect(passing?.title).toContain("✅");
		expect(failing?.title).toContain("❌");
	});
});

describe("publishValidationReport", () => {
	it("looks up the OPEN pull request from the release branch into the target branch", async () => {
		const { listed } = await run();

		// `head` is owner-qualified; a bare ref matches nothing on the REST filter,
		// and swapping head and base silently finds no release PR at all.
		expect(listed).toEqual([{ head: `${OWNER}:${RELEASE_BRANCH}`, base: TARGET_BRANCH, state: "open" }]);
	});

	it("writes all three sections to that pull request, in one comment", async () => {
		const { outcome, upserted, body } = await run();

		expect(outcome).toEqual({ prNumber: 243, written: true, lookupFailed: false });
		expect(upserted).toHaveLength(1);
		expect(upserted[0]?.issueNumber).toBe(243);
		expect(body).toContain(`silk-release.sections.${VALIDATION_STATUS_KEY} `);
		expect(body).toContain(`silk-release.sections.${RELEASE_PLAN_KEY} `);
		expect(body).toContain(`silk-release.sections.${VALIDATION_DETAILS_KEY} `);
	});

	it("writes under Phase 1's comment marker, so it updates rather than duplicates", async () => {
		const { upserted } = await run();

		expect(upserted[0]?.key).toBe(RELEASE_PLAN_KEY);
	});

	it("takes the FIRST open pull request when GitHub returns several", async () => {
		const { outcome } = await run({ prs: [pullRequest(243), pullRequest(999)] });

		expect(outcome.prNumber).toBe(243);
	});

	it("stamps the sections with the run's sha and run id, complete", async () => {
		const { body } = await run();

		expect(body).toContain(`state="complete"`);
		expect(body).toContain(`sha="${HEAD_SHA}"`);
		expect(body).toContain(`runId="${RUN_ID}"`);
	});

	it("stamps the sha the caller resolved, even an empty one, rather than failing", async () => {
		// The sha is the CALLER's one `env.github` read, passed in — this step no
		// longer re-reads GITHUB_SHA with a `""` fallback of its own. An empty
		// caller-supplied sha still degrades: `renderBanner` treats `""` as
		// "staleness unknown" instead of raising.
		const { outcome, body } = await run({ headSha: "", env: { GITHUB_RUN_ID: "" } });

		expect(outcome.written).toBe(true);
		expect(body).toContain(`sha=""`);
	});

	it("links the stamped sha at the instance the run is executing against", async () => {
		// Hardcoding github.com resolves to the public site on GitHub Enterprise.
		const { body } = await run();

		expect(body).toContain(`https://gh.test/${OWNER}/silk-release-action/commit/${HEAD_SHA}`);
	});

	it("preserves a neighbouring section and a human's prose", async () => {
		const { body } = await run({
			existingComment:
				'A human wrote this.\n\n<!-- silk-release:section:other:start -->\n<!-- silk-release:stamp {"state":"complete","sha":"abc1234def5678","runId":"1","at":"2026-01-01T00:00:00.000Z"} -->\n### Other\n\nsomeone else\'s section\n<!-- silk-release:section:other:end -->',
		});

		expect(body).toContain("A human wrote this.");
		expect(body).toContain("someone else's section");
	});

	it("announces the update with the pull request it wrote to", async () => {
		const { text } = await run();

		expect(text).toContain("✅ Release comment updated on PR #243");
	});

	it("CHARACTERIZATION — a rehearsal still writes to the real pull request", async () => {
		// ⚠️ ASYMMETRY WITH PHASE 1, which publishes nothing at all when `dryRun` is
		// set. This step takes no dry-run flag: the rehearsal is visible only in the
		// rendered body. Pinned, not fixed — changing it is a behaviour change.
		const { upserted, body } = await run({ report: report({ dryRun: true }) });

		expect(upserted).toHaveLength(1);
		expect(body).toContain("**DRY RUN MODE**");
	});

	it("CHARACTERIZATION — a failed comment write only warns, and nothing downstream learns", async () => {
		// ⚠️ The verdict reads FINDINGS, and a failed write contributes none. The
		// release proceeds reporting success with a pull request whose comment still
		// shows Phase 1's `pending` verdict. Same shape as
		// savvy-web/silk-release-action#216 — pinned, not fixed.
		const { outcome, text } = await run({ upsertFails: true });

		expect(outcome).toEqual({ prNumber: 243, written: false, lookupFailed: false });
		expect(text).toContain("Could not update the release comment: ");
		// And no success line claiming otherwise.
		expect(text).not.toContain("✅ Release comment updated");
	});

	it("CHARACTERIZATION — a FAILED lookup is logged as 'no open PR found'", async () => {
		// ⚠️ THIS IS THE FINDING. A GitHub outage during the lookup and a repository
		// that genuinely has no release PR produce the SAME line, at info severity,
		// with no warning and no finding. `lookupFailed` records the difference in
		// the returned value; nothing reads it yet. #216 again.
		const { outcome, text, upserted } = await run({ listFails: true });

		expect(outcome).toEqual({ prNumber: null, written: false, lookupFailed: true });
		expect(text).toContain("Sticky comment update skipped — no open PR found for release branch");
		expect(upserted).toEqual([]);
	});

	it("skips quietly when there is genuinely no open release pull request", async () => {
		const { outcome, upserted, text } = await run({ prs: [] });

		expect(outcome).toEqual({ prNumber: null, written: false, lookupFailed: false });
		expect(upserted).toEqual([]);
		expect(text).toContain("Sticky comment update skipped — no open PR found for release branch");
	});

	it("never fails the phase, whichever half of the round trip breaks", async () => {
		// The error channel is `never`, and both halves are exercised: a release is
		// not gated on being able to describe itself.
		await expect(run({ listFails: true })).resolves.toBeDefined();
		await expect(run({ upsertFails: true })).resolves.toBeDefined();
	});
});
