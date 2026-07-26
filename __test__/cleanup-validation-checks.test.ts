/**
 * Tests for the cleanupValidationChecks utility.
 *
 * @remarks
 * Written against the kit's `layerTest` seams. Unstubbed members die naming
 * themselves, so each fixture supplies exactly what the code under test
 * reaches — a red test naming a member means the program took a path the test
 * did not model.
 */

import type { CheckRunOutput } from "@effected/github";
import { CheckRun, CheckRunRef, GitHubError, Repo, RepoRef } from "@effected/github";
import { ActionOutputs } from "@effected/github-actions";
import { Effect, Layer, Logger } from "effect";
import { describe, expect, it } from "vitest";
import type { CleanupResult } from "../src/utils/cleanup-validation-checks.js";
import { cleanupValidationChecks } from "../src/utils/cleanup-validation-checks.js";

/** What the fake GitHub recorded. */
interface Recorder {
	readonly completed: Array<{ id: number; conclusion: string; output?: CheckRunOutput | undefined }>;
	readonly summaries: Array<string>;
}

interface SeededRun {
	readonly id: number;
	readonly name?: string;
	readonly status: string;
}

const makeLayer = (
	recorder: Recorder,
	runs: ReadonlyArray<SeededRun>,
	options: { readonly failGet?: boolean } = {},
): Layer.Layer<ActionOutputs | CheckRun | Repo> =>
	Layer.mergeAll(
		ActionOutputs.layerTest({
			summary: (content) => Effect.sync(() => void recorder.summaries.push(content)),
		}),
		CheckRun.layerTest({
			get: (id) => {
				if (options.failGet === true) {
					return Effect.fail(GitHubError.notFound("CheckRun.get", `check run ${id}`));
				}
				const found = runs.find((r) => r.id === id);
				return found === undefined
					? Effect.fail(GitHubError.notFound("CheckRun.get", `check run ${id}`))
					: Effect.succeed(
							CheckRunRef.make({
								id: found.id,
								name: found.name ?? `check-${found.id}`,
								url: `https://github.com/test/checks/${found.id}`,
								status: found.status,
							}),
						);
			},
			complete: (id, conclusion, output) => Effect.sync(() => void recorder.completed.push({ id, conclusion, output })),
		}),
		Layer.succeed(Repo, RepoRef.make({ owner: "savvy-web", repo: "silk-release-action" })),
	);

const runCleanup = (
	checkIds: ReadonlyArray<number>,
	reason: string,
	dryRun: boolean,
	recorder: Recorder,
	runs: ReadonlyArray<SeededRun> = [],
	options: { readonly failGet?: boolean } = {},
): Promise<CleanupResult> =>
	cleanupValidationChecks(checkIds, reason, dryRun).pipe(
		Effect.provide(makeLayer(recorder, runs, options)),
		Effect.provide(Logger.layer([])),
		Effect.runPromise,
	);

const makeRecorder = (): Recorder => ({ completed: [], summaries: [] });

describe("cleanupValidationChecks", () => {
	it("should cancel an in-progress check run", async () => {
		const recorder = makeRecorder();

		const result = await runCleanup([1], "workflow cancelled", false, recorder, [{ id: 1, status: "in_progress" }]);

		expect(recorder.completed).toHaveLength(1);
		expect(recorder.completed[0]?.conclusion).toBe("cancelled");
		expect(result.cleanedUp).toBe(1);
		expect(result.failed).toBe(0);
	});

	it("should carry the reason into the cancellation summary", async () => {
		const recorder = makeRecorder();

		await runCleanup([1], "run was interrupted", false, recorder, [{ id: 1, status: "in_progress" }]);

		expect(recorder.completed[0]?.output?.summary).toContain("run was interrupted");
	});

	it("should skip an already-completed check run", async () => {
		const recorder = makeRecorder();

		const result = await runCleanup([1], "reason", false, recorder, [{ id: 1, status: "completed" }]);

		expect(recorder.completed).toHaveLength(0);
		expect(result.cleanedUp).toBe(0);
		expect(result.failed).toBe(0);
	});

	it("should not mutate check runs in dry-run, but still count the id", async () => {
		const recorder = makeRecorder();

		const result = await runCleanup([1, 2], "reason", true, recorder, [{ id: 1, status: "in_progress" }]);

		expect(recorder.completed).toHaveLength(0);
		expect(result.cleanedUp).toBe(2);
	});

	it("should record a failure when a check run cannot be fetched", async () => {
		const recorder = makeRecorder();

		const result = await runCleanup([1], "reason", false, recorder, [], { failGet: true });

		expect(result.failed).toBe(1);
		expect(result.cleanedUp).toBe(0);
		expect(result.errors[0]).toContain("Check 1");
	});

	it("should keep going after one check fails", async () => {
		const recorder = makeRecorder();

		// Id 9 is not seeded, so its `get` fails; id 1 must still be cancelled.
		const result = await runCleanup([9, 1], "reason", false, recorder, [{ id: 1, status: "in_progress" }]);

		expect(result.failed).toBe(1);
		expect(result.cleanedUp).toBe(1);
		expect(recorder.completed.map((c) => c.id)).toEqual([1]);
	});
});
