/**
 * Unit tests for {@link countChangesetsPerPackage}.
 *
 * The CommandRunner is provided via an in-memory test layer; no real git is
 * exercised. The test layer keys responses by `"command args..."`.
 */

import type { CommandResponse } from "@savvy-web/github-action-effects/testing";
import { CommandRunner, CommandRunnerTest } from "@savvy-web/github-action-effects/testing";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { countChangesetsPerPackage } from "./count-changesets.js";

/** Run the helper against a CommandRunner seeded with `responses`. */
const run = (
	responses: ReadonlyMap<string, CommandResponse>,
	targetBranch = "main",
): Promise<ReadonlyMap<string, number>> =>
	Effect.runPromise(
		Effect.gen(function* () {
			const runner = yield* CommandRunner;
			return yield* countChangesetsPerPackage(runner, targetBranch);
		}).pipe(Effect.provide(CommandRunnerTest.layer(responses))),
	);

const frontmatter = (lines: ReadonlyArray<string>, summary = "A change"): string =>
	["---", ...lines, "---", "", summary, ""].join("\n");

describe("countChangesetsPerPackage", () => {
	it("counts changesets per package across the target branch's .changeset directory", async () => {
		const responses = new Map<string, CommandResponse>([
			[
				"git ls-tree --name-only main .changeset/",
				{
					exitCode: 0,
					stdout: [".changeset/README.md", ".changeset/aaa.md", ".changeset/bbb.md", ".changeset/ccc.md"].join("\n"),
					stderr: "",
				},
			],
			["git show main:.changeset/aaa.md", { exitCode: 0, stdout: frontmatter(['"@scope/alpha": minor']), stderr: "" }],
			[
				"git show main:.changeset/bbb.md",
				{
					exitCode: 0,
					stdout: frontmatter(['"@scope/alpha": patch', '"@scope/beta": major']),
					stderr: "",
				},
			],
			["git show main:.changeset/ccc.md", { exitCode: 0, stdout: frontmatter(['"@scope/beta": patch']), stderr: "" }],
		]);

		const counts = await run(responses);

		expect(counts.get("@scope/alpha")).toBe(2);
		expect(counts.get("@scope/beta")).toBe(2);
		expect(counts.size).toBe(2);
	});

	it("skips README.md when listing changeset files", async () => {
		const responses = new Map<string, CommandResponse>([
			[
				"git ls-tree --name-only main .changeset/",
				{ exitCode: 0, stdout: [".changeset/README.md", ".changeset/only.md"].join("\n"), stderr: "" },
			],
			["git show main:.changeset/only.md", { exitCode: 0, stdout: frontmatter(['"pkg-a": patch']), stderr: "" }],
		]);

		const counts = await run(responses);

		expect(counts.get("pkg-a")).toBe(1);
		expect(counts.size).toBe(1);
	});

	it("returns an empty map when ls-tree fails", async () => {
		// No response registered for ls-tree → the test runner fails the command.
		const counts = await run(new Map<string, CommandResponse>());

		expect(counts.size).toBe(0);
	});

	it("skips a file whose git show fails but keeps the rest", async () => {
		const responses = new Map<string, CommandResponse>([
			[
				"git ls-tree --name-only main .changeset/",
				{ exitCode: 0, stdout: [".changeset/good.md", ".changeset/bad.md"].join("\n"), stderr: "" },
			],
			["git show main:.changeset/good.md", { exitCode: 0, stdout: frontmatter(['"pkg-good": minor']), stderr: "" }],
			// No response for bad.md → git show fails for it; it is skipped.
		]);

		const counts = await run(responses);

		expect(counts.get("pkg-good")).toBe(1);
		expect(counts.has("pkg-bad")).toBe(false);
		expect(counts.size).toBe(1);
	});

	it("respects a non-default target branch in both git invocations", async () => {
		const responses = new Map<string, CommandResponse>([
			["git ls-tree --name-only release/next .changeset/", { exitCode: 0, stdout: ".changeset/x.md", stderr: "" }],
			["git show release/next:.changeset/x.md", { exitCode: 0, stdout: frontmatter(["'pkg-x': major"]), stderr: "" }],
		]);

		const counts = await run(responses, "release/next");

		expect(counts.get("pkg-x")).toBe(1);
	});
});
