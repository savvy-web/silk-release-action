/**
 * Tests for the opt-in `auto-merge` input.
 *
 * @remarks
 * What is pinned here is the split in failure handling, which is the whole
 * design of the module and is invisible to the typechecker:
 *
 * 1. **A misspelled input fails.** Treating `sqush` as "off" would leave the
 *    release PR open forever and read as a bug in the action.
 * 2. **A rejected `setAutoMerge` only warns.** Auto-merge has repository
 *    prerequisites this action does not control; the release already
 *    succeeded, and the PR can be merged by hand.
 * 3. **The input is read through `ActionInput`**, so the runner's
 *    `INPUT_AUTO-MERGE` mangling is exercised. A bare `Config.string`
 *    typechecks and passes against an injected provider while never finding
 *    the real input.
 */

import { describe, expect, it } from "@effect/vitest";
import type { PullRequestInfo } from "@effected/github";
import { GitHubGraphQLError, PullRequest, Repo, RepoRef } from "@effected/github";
import { ActionInput } from "@effected/github-actions";
import { Effect, Layer, Logger, Option } from "effect";
import { applyAutoMerge, autoMergeMethodConfig } from "../src/utils/auto-merge.js";

const OWNER = "owner";
const REPO = "repo";

const pullRequest = (number: number): PullRequestInfo =>
	({
		number,
		nodeId: `PR_${number}`,
		url: `https://github.com/${OWNER}/${REPO}/pull/${number}`,
		title: "release: 1.0.0",
		state: "open",
		head: "changeset-release/main",
		headSha: "head",
		base: "main",
		baseSha: "base",
		draft: false,
		merged: false,
		mergedAt: Option.none(),
	}) as unknown as PullRequestInfo;

/**
 * Provide the input the way the runner writes it.
 *
 * @remarks
 * `INPUT_AUTO-MERGE`, with the hyphen, is the runner's mangling — writing
 * `INPUT_AUTO_MERGE` here would make every one of these tests pass against a
 * module that reads nothing.
 *
 * Through `ActionInput.layer` rather than by assigning `process.env`: the
 * provider snapshots the environment, so a test that mutates `process.env`
 * between reads sees the *first* run's value for the rest of the file. That
 * produced a suite where every case reported `merge` and two
 * expected-to-fail cases passed.
 */
const withInput = (value: string | undefined): Layer.Layer<never> =>
	ActionInput.layer(value === undefined ? {} : { "INPUT_AUTO-MERGE": value });

interface Calls {
	setAutoMerge: Array<{ number: number; method: string }>;
}

const pullRequestLayer = (calls: Calls, fail: boolean): Layer.Layer<PullRequest | Repo> =>
	Layer.mergeAll(
		PullRequest.layerTest({
			setAutoMerge: (pr, method) =>
				fail
					? // A real `GitHubGraphQLError` — the error type `setAutoMerge` actually
						// declares. The previous `GitHubError.rejected(...) as never` bypassed
						// that signature, so a change to it would not have failed typechecking.
						Effect.fail(
							new GitHubGraphQLError({
								kind: "rejected",
								operation: "PullRequest.setAutoMerge",
								reason: "auto-merge disabled",
								errors: [],
							}),
						)
					: Effect.sync(() => {
							calls.setAutoMerge.push({ number: pr.number, method });
						}),
		}),
		Layer.succeed(Repo, RepoRef.make({ owner: OWNER, repo: REPO })),
	);

const run = (input: string | undefined, options: { fail?: boolean; dryRun?: boolean } = {}) => {
	const calls: Calls = { setAutoMerge: [] };
	return applyAutoMerge(pullRequest(42), options.dryRun ?? false)
		.pipe(
			Effect.provide(pullRequestLayer(calls, options.fail ?? false)),
			Effect.provide(Logger.layer([])),
			Effect.provide(withInput(input)),
		)
		.pipe(Effect.map(() => calls));
};

/** The config read as an effect — `Config` is yieldable, not itself an `Effect`. */
const readMethod = (input: string | undefined) =>
	Effect.gen(function* () {
		return yield* autoMergeMethodConfig;
	}).pipe(Effect.provide(withInput(input)));

describe("autoMergeMethodConfig", () => {
	it.effect.each(["merge", "squash", "rebase"])("accepts %s", (method) =>
		Effect.gen(function* () {
			const result = yield* readMethod(method);
			expect(result).toStrictEqual(Option.some(method));
		}),
	);

	it.effect("treats an absent input as disabled", () =>
		Effect.gen(function* () {
			const result = yield* readMethod(undefined);
			expect(result).toStrictEqual(Option.none());
		}),
	);

	it.effect("treats an empty input as disabled", () =>
		Effect.gen(function* () {
			const result = yield* readMethod("");
			expect(result).toStrictEqual(Option.none());
		}),
	);

	it.effect("tolerates surrounding whitespace from a YAML block scalar", () =>
		Effect.gen(function* () {
			const result = yield* readMethod("  squash\n");
			expect(result).toStrictEqual(Option.some("squash"));
		}),
	);

	// These two stay on plain `it()`: `expect(...).rejects.toThrow()` asserts
	// only that the promise rejected. The `it.effect` equivalent would have to
	// narrow an `Exit`/`Result`, which changes what is asserted rather than how
	// it is run.
	it("fails on a misspelled method rather than silently disabling", async () => {
		// The whole point. `sqush` means the workflow wanted auto-merge; reading
		// it as "off" leaves the release PR open and looks like our bug.
		await expect(Effect.runPromise(readMethod("sqush"))).rejects.toThrow();
	});

	it("fails on a plausible-but-wrong value", async () => {
		await expect(Effect.runPromise(readMethod("true"))).rejects.toThrow();
	});
});

describe("applyAutoMerge", () => {
	it.effect("enables auto-merge with the requested method", () =>
		Effect.gen(function* () {
			const calls = yield* run("squash");
			expect(calls.setAutoMerge).toEqual([{ number: 42, method: "squash" }]);
		}),
	);

	it.effect("does nothing when the input is absent", () =>
		Effect.gen(function* () {
			const calls = yield* run(undefined);
			expect(calls.setAutoMerge).toEqual([]);
		}),
	);

	it.effect("changes nothing in dry-run", () =>
		Effect.gen(function* () {
			const calls = yield* run("merge", { dryRun: true });
			expect(calls.setAutoMerge).toEqual([]);
		}),
	);

	it.effect("warns rather than failing when the repository rejects auto-merge", () =>
		Effect.gen(function* () {
			// A release that published packages must not be reported as failed
			// because a repository setting is off.
			const calls = yield* run("rebase", { fail: true });
			expect(calls.setAutoMerge).toEqual([]);
		}),
	);
});
