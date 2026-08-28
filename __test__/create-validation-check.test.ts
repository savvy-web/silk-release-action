/**
 * Fixture tests for the `createValidationCheck` utility.
 *
 * @remarks
 * Drives `createValidationCheck` against the kit's `ActionEnvironment.layerTest`
 * / `ActionOutputs.layerTest` / `CheckRun.layerTest` seams, recording what the
 * check run and the job summary actually received.
 *
 * Two things are pinned here beyond the original coverage:
 *
 * 1. **The summary is handed to the kit uncapped.** `CheckRun.complete` routes
 *    its output through `wireOutput`, which calls `CheckRunOutput.truncated()`
 *    unconditionally, so this module must NOT pre-truncate — doing so would cut
 *    the text twice and stack two notices.
 * 2. **`htmlUrl` comes from `CheckRunRef.url`.** The kit builds that as
 *    `raw.html_url ?? ""`, and `main.ts` branches on the empty string to decide
 *    whether to emit a `checkRun` link at all.
 */

import type { CheckRunOutput } from "@effected/github";
import { CheckRun, CheckRunRef, Repo, RepoRef } from "@effected/github";
import { ActionEnvironment, ActionOutputs } from "@effected/github-actions";
import { Effect, Layer, Logger } from "effect";
import { describe, expect, it } from "vitest";
import type { ValidationResult } from "../src/types/shared-types.js";
import type { UnifiedValidationResult } from "../src/utils/create-validation-check.js";
import { createValidationCheck } from "../src/utils/create-validation-check.js";

interface CompletedCheck {
	id: number;
	conclusion: string;
	output: CheckRunOutput | undefined;
}

interface Fixtures {
	created: Array<{ name: string; headSha: string }>;
	completed: CompletedCheck[];
	summaries: string[];
	/** What `CheckRun.create` reports back as the run's web URL. */
	createUrl: string;
}

const makeFixtures = (createUrl = "https://github.com/owner/repo/runs/99"): Fixtures => ({
	created: [],
	completed: [],
	summaries: [],
	createUrl,
});

const runStage = (
	validations: ReadonlyArray<ValidationResult>,
	dryRun: boolean,
	f: Fixtures,
	extraBody?: string,
): Promise<UnifiedValidationResult> => {
	const layer = Layer.mergeAll(
		ActionEnvironment.layerTest({
			GITHUB_SHA: "abc123",
			GITHUB_REF: "refs/heads/main",
			GITHUB_REPOSITORY: "owner/repo",
			GITHUB_REPOSITORY_OWNER: "owner",
			GITHUB_WORKSPACE: "/workspace",
			GITHUB_EVENT_NAME: "push",
			GITHUB_EVENT_PATH: "",
			GITHUB_RUN_ID: "1",
			GITHUB_RUN_NUMBER: "1",
			GITHUB_ACTOR: "test",
			GITHUB_SERVER_URL: "https://github.com",
			GITHUB_API_URL: "https://api.github.com",
		}),
		ActionOutputs.layerTest({
			summary: (content) =>
				Effect.sync(() => {
					f.summaries.push(content);
				}),
		}),
		CheckRun.layerTest({
			create: (name, headSha) =>
				Effect.sync(() => {
					f.created.push({ name, headSha });
					return CheckRunRef.make({
						id: 4242,
						name,
						url: f.createUrl,
						status: "in_progress",
					});
				}),
			complete: (id, conclusion, output) =>
				Effect.sync(() => {
					f.completed.push({ id, conclusion, output });
				}),
		}),
		Layer.succeed(Repo, RepoRef.make({ owner: "owner", repo: "repo" })),
	);
	return Effect.runPromise(
		createValidationCheck(validations, dryRun, extraBody).pipe(Effect.provide(layer), Effect.provide(Logger.layer([]))),
	);
};

const summaryOf = (f: Fixtures): string => {
	const output = f.completed[0]?.output;
	if (output === undefined) throw new Error("no check run was completed");
	return output.summary;
};

const passingValidations: ReadonlyArray<ValidationResult> = [
	{ name: "Link Issues from Commits", success: true, checkId: 0, message: "0 issue(s) linked" },
	{ name: "Build Validation", success: true, checkId: 0, message: "Build passed" },
];

const mixedValidations: ReadonlyArray<ValidationResult> = [
	{ name: "Build Validation", success: true, checkId: 0, message: "Build passed" },
	{ name: "Publish Validation", success: false, checkId: 0, message: "Registry probe failed" },
];

describe("createValidationCheck", () => {
	it("creates a completed check run with the per-step results table when no extraBody is supplied", async () => {
		const f = makeFixtures();

		const result = await runStage(passingValidations, false, f);

		expect(result.success).toBe(true);
		expect(f.created).toHaveLength(1);
		expect(f.created[0].name).toBe("Release Validation Summary");
		expect(f.created[0].headSha).toBe("abc123");
		expect(f.completed).toHaveLength(1);
		expect(f.completed[0].id).toBe(4242);
		expect(f.completed[0].conclusion).toBe("success");

		const summary = summaryOf(f);
		// The default body carries the results-table heading rendered by
		// `summaryWriter.build` and contains each validation's name.
		expect(summary).toContain("Validation Results");
		expect(summary).toContain("Link Issues from Commits");
		expect(summary).toContain("Build Validation");
		// No `<details>` collapsed block when extraBody is omitted.
		expect(summary).not.toContain("<details>");
	});

	it("uses the dry-run title when dryRun=true", async () => {
		const f = makeFixtures();

		await runStage(passingValidations, true, f);

		expect(f.created[0].name).toBe("🧪 Release Validation Summary (Dry Run)");
	});

	it("appends the supplied extraBody to the check-run summary after the checks-table content", async () => {
		const f = makeFixtures();
		const validationOutput = {
			$schema:
				"https://raw.githubusercontent.com/savvy-web/silk-release-action/main/schemas/5.0.0/silk-release-action-5.0.0.json",
			schemaVersion: "2",
			phase: "validation",
		};
		const jsonBlock = [
			"",
			"<details>",
			"<summary>📦 Full structured output (<code>result</code> action output)</summary>",
			"",
			"```json",
			JSON.stringify(validationOutput, null, 2),
			"```",
			"",
			"</details>",
		].join("\n");

		await runStage(passingValidations, false, f, jsonBlock);

		const summary = summaryOf(f);
		// The supplied extra body appears verbatim in the check-run summary.
		expect(summary).toContain(jsonBlock);
		// The collapsed block follows (not precedes) the checks-table content
		// the function builds — locate the indices to verify ordering.
		const tableIndex = summary.indexOf("Validation Results");
		const detailsIndex = summary.indexOf("<details>");
		expect(tableIndex).toBeGreaterThanOrEqual(0);
		expect(detailsIndex).toBeGreaterThan(tableIndex);
		// The JSON payload's literal content survives the round-trip.
		expect(summary).toContain(JSON.stringify(validationOutput, null, 2));
	});

	it("omits extraBody from the job-step summary even when it is supplied to the check run", async () => {
		const f = makeFixtures();
		const jsonBlock = "<details>\n<summary>📦</summary>\n\nUNIQUE_SENTINEL_STRING\n</details>";

		await runStage(passingValidations, false, f, jsonBlock);

		// The job-step summary (collected by `outputs.summary`) keeps its
		// terse per-step table without the extra body.
		expect(f.summaries.length).toBeGreaterThan(0);
		expect(f.summaries.join("\n")).not.toContain("UNIQUE_SENTINEL_STRING");
	});

	it("treats an empty-string extraBody as no extra body", async () => {
		const f = makeFixtures();

		await runStage(passingValidations, false, f, "");

		expect(summaryOf(f)).not.toContain("<details>");
	});

	it("records a failure conclusion when any validation failed", async () => {
		const f = makeFixtures();

		const result = await runStage(mixedValidations, false, f);

		expect(result.success).toBe(false);
		expect(f.completed[0].conclusion).toBe("failure");
		const summary = summaryOf(f);
		expect(summary).toContain("Failed Validations");
		expect(summary).toContain("Publish Validation");
	});

	it("hands the summary to the kit uncapped, leaving truncation to CheckRunOutput.truncated()", async () => {
		const f = makeFixtures();
		// Well over GitHub's 65535-byte limit, so a pre-cap would be visible.
		const huge = `<!--${"x".repeat(80_000)}-->`;

		await runStage(passingValidations, false, f, huge);

		const summary = summaryOf(f);
		// The module must NOT truncate: the kit caps in `wireOutput`, and capping
		// here first would cut the text twice and stack two notices.
		expect(summary).toContain(huge);
		expect(Buffer.byteLength(summary, "utf8")).toBeGreaterThan(65_535);
		expect(summary).not.toContain("summary truncated");
	});

	it("reports the check run's web URL from CheckRunRef.url", async () => {
		const f = makeFixtures("https://github.com/owner/repo/runs/12345");

		const result = await runStage(passingValidations, false, f);

		expect(result.htmlUrl).toBe("https://github.com/owner/repo/runs/12345");
		expect(result.checkId).toBe(4242);
	});

	it("preserves the empty-string URL sentinel main.ts branches on", async () => {
		// The kit builds `CheckRunRef.url` as `raw.html_url ?? ""`, and `main.ts`
		// treats `""` as "no link" rather than emitting a broken `checkRun` entry.
		const f = makeFixtures("");

		const result = await runStage(passingValidations, false, f);

		expect(result.htmlUrl).toBe("");
	});
});
