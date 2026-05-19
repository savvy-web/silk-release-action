/**
 * Fixture tests for the `createValidationCheck` utility.
 *
 * @remarks
 * Drives `createValidationCheck` against the library's
 * `ActionEnvironmentTest` / `ActionOutputsTest` / `CheckRunTest` layers and
 * asserts on the recorded check-run output. The optional `extraBody`
 * parameter is the focus: when supplied (e.g. the full structured
 * `result` JSON for the unified Release Validation Summary), the
 * check-run summary content must contain the provided block verbatim,
 * but the job-step summary must not.
 */

import type { ActionOutputsTestState, CheckRunTestState } from "@savvy-web/github-action-effects/testing";
import { ActionEnvironmentTest, ActionOutputsTest, CheckRunTest } from "@savvy-web/github-action-effects/testing";
import { Effect, Layer, Logger } from "effect";
import { describe, expect, it } from "vitest";
import type { ValidationResult } from "../src/types/shared-types.js";
import type { UnifiedValidationResult } from "../src/utils/create-validation-check.js";
import { createValidationCheck } from "../src/utils/create-validation-check.js";

interface Fixtures {
	outputsState: ActionOutputsTestState;
	checkRunState: CheckRunTestState;
}

const makeFixtures = (): Fixtures => ({
	outputsState: ActionOutputsTest.empty(),
	checkRunState: CheckRunTest.empty(),
});

const runStage = (
	validations: ReadonlyArray<ValidationResult>,
	dryRun: boolean,
	f: Fixtures,
	extraBody?: string,
): Promise<UnifiedValidationResult> => {
	const layer = Layer.mergeAll(
		ActionEnvironmentTest.layer({
			GITHUB_SHA: "abc123",
			GITHUB_REF: "refs/heads/main",
			GITHUB_REPOSITORY: "owner/repo",
			GITHUB_REPOSITORY_OWNER: "owner",
			GITHUB_WORKSPACE: "/workspace",
			GITHUB_EVENT_NAME: "push",
			GITHUB_EVENT_PATH: "/dev/null",
			GITHUB_RUN_ID: "1",
			GITHUB_RUN_NUMBER: "1",
			GITHUB_ACTOR: "test",
			GITHUB_SERVER_URL: "https://github.com",
			GITHUB_API_URL: "https://api.github.com",
		}),
		ActionOutputsTest.layer(f.outputsState),
		CheckRunTest.layer(f.checkRunState),
	);
	return Effect.runPromise(
		createValidationCheck(validations, dryRun, extraBody).pipe(
			Effect.provide(layer),
			Effect.provide(Logger.replace(Logger.defaultLogger, Logger.none)),
		),
	);
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
		expect(f.checkRunState.runs).toHaveLength(1);
		const run = f.checkRunState.runs[0];
		expect(run.name).toBe("Release Validation Summary");
		expect(run.status).toBe("completed");
		expect(run.conclusion).toBe("success");
		expect(run.outputs).toHaveLength(1);
		const summary = run.outputs[0].summary;
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

		expect(f.checkRunState.runs[0].name).toBe("🧪 Release Validation Summary (Dry Run)");
	});

	it("appends the supplied extraBody to the check-run summary after the checks-table content", async () => {
		const f = makeFixtures();
		const validationOutput = {
			$schema: "https://json.schemastore.org/silk-release-action.output.schema.json",
			schemaVersion: "1",
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

		const run = f.checkRunState.runs[0];
		const summary = run.outputs[0].summary;
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
		const jobSummaries = f.outputsState.summaries;
		expect(jobSummaries.length).toBeGreaterThan(0);
		const joined = jobSummaries.join("\n");
		expect(joined).not.toContain("UNIQUE_SENTINEL_STRING");
	});

	it("treats an empty-string extraBody as no extra body", async () => {
		const f = makeFixtures();

		await runStage(passingValidations, false, f, "");

		const summary = f.checkRunState.runs[0].outputs[0].summary;
		expect(summary).not.toContain("<details>");
	});

	it("records a failure conclusion when any validation failed", async () => {
		const f = makeFixtures();

		const result = await runStage(mixedValidations, false, f);

		expect(result.success).toBe(false);
		const run = f.checkRunState.runs[0];
		expect(run.conclusion).toBe("failure");
		const summary = run.outputs[0].summary;
		expect(summary).toContain("Failed Validations");
		expect(summary).toContain("Publish Validation");
	});
});
