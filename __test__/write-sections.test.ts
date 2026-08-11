// Tests for the read-modify-write both phases perform on the release PR's
// sticky comment.
//
// This function is an EXTRACTION of code that already existed twice: Phase 1's
// `publishPlan` (covered, indirectly, by `publish-release-plan.test.ts`) and
// Phase 2's inline write in the validation orchestrator (covered by nothing at
// all). The four rules it enforces — read first, degrade a failed read, one
// write not N, refresh every banner afterwards — were each a separate bug or a
// separate comment paragraph before. They are asserted here directly, once.
//
// `read` and `publish` are parameters, so every case is an ordinary function
// call: no GitHub client, no layers, no runtime beyond `Logger.layer([])`.

import { GitHubError } from "@effected/github";
import { Effect, Logger } from "effect";
import { describe, expect, it } from "vitest";
import type { Section } from "../src/utils/managed-sections.js";
import { readSection, renderSection } from "../src/utils/managed-sections.js";
import type { SectionWrite } from "../src/utils/write-sections.js";
import { writeSections } from "../src/utils/write-sections.js";

const HEAD_SHA = "aaaaaaa1111111";
const OLD_SHA = "bbbbbbb2222222";

const section = (key: string, body: string, at = "2026-02-01T00:00:00.000Z"): Section => ({
	key,
	title: `Title ${key}`,
	stamp: { state: "complete", sha: HEAD_SHA, runId: "9", at },
	body,
});

const apiDown = new GitHubError({
	kind: "transport",
	operation: "PullRequestComment.upsert",
	reason: "comment API down",
});

interface Posted {
	readonly prNumber: number;
	readonly body: string;
	readonly key: string;
}

/**
 * Drive `writeSections`, recording every read and every post.
 *
 * @remarks
 * `Logger.layer([])` removes every logger. Without it the degrade-to-warning
 * line reaches Effect's DEFAULT logger, which writes through `console.log` —
 * not `process.stdout.write`, so output suppression cannot catch it — and leaks
 * into the reporter.
 */
const run = async (
	overrides: Partial<SectionWrite<GitHubError, never>> & { readonly sections: ReadonlyArray<Section> },
) => {
	const posted: Array<Posted> = [];
	const reads: Array<{ prNumber: number; key: string }> = [];
	const lines: Array<string> = [];
	const capture = Logger.make<unknown, void>((options) => {
		lines.push(String(options.message));
	});

	const write: SectionWrite<GitHubError, never> = {
		prNumber: 243,
		key: "release-plan",
		headSha: HEAD_SHA,
		commitLink: (sha) => `https://gh.test/commit/${sha}`,
		warning: "Could not update the release comment",
		read: (prNumber, key) => {
			reads.push({ prNumber, key });
			return Effect.succeed("");
		},
		publish: (prNumber, body, key) => {
			posted.push({ prNumber, body, key });
			return Effect.succeed({ commentId: 1 });
		},
		...overrides,
	};

	const written = await Effect.runPromise(writeSections(write).pipe(Effect.provide(Logger.layer([capture]))));
	return { written, posted, reads, lines, body: posted.at(-1)?.body ?? "" };
};

describe("writeSections", () => {
	it("posts every section into one body", async () => {
		const { body } = await run({ sections: [section("a", "alpha"), section("b", "bravo")] });

		expect(body).toContain("alpha");
		expect(body).toContain("bravo");
	});

	it("writes ONCE, however many sections it folds in", async () => {
		// Three writes would let a reader catch the comment mid-update, with a
		// stale verdict above a fresh table. The fold is in memory for that reason.
		const { posted } = await run({
			sections: [section("a", "alpha"), section("b", "bravo"), section("c", "charlie")],
		});

		expect(posted).toHaveLength(1);
	});

	it("appends sections in the order given, for a comment that does not exist yet", async () => {
		// `upsertSection` appends a key it has not seen, so this array's order IS
		// the reader's order. Phase 1 seeds the verdict above the plan on exactly
		// this behaviour.
		const { body } = await run({ sections: [section("first", "1"), section("second", "2")] });

		expect(body.indexOf("silk-release:section:first")).toBeLessThan(body.indexOf("silk-release:section:second"));
	});

	it("READS before writing, so a neighbour's content survives the rewrite", async () => {
		// The bug this exists to prevent: `upsert` replaces the body wholesale, so
		// a rewrite that starts from `""` deletes every other section and anything
		// a human wrote.
		const existing = `A human wrote this.\n\n${renderSection(section("other", "someone else's section"), HEAD_SHA)}`;
		const { body } = await run({
			sections: [section("a", "alpha")],
			read: () => Effect.succeed(existing),
		});

		expect(body).toContain("A human wrote this.");
		expect(body).toContain("someone else's section");
		expect(body).toContain("alpha");
	});

	it("reads under the comment's own key, and the SAME pull request it writes to", async () => {
		const { reads, posted } = await run({ sections: [section("a", "alpha")], prNumber: 77, key: "release-plan" });

		expect(reads).toEqual([{ prNumber: 77, key: "release-plan" }]);
		expect(posted[0]?.prNumber).toBe(77);
		expect(posted[0]?.key).toBe("release-plan");
	});

	it("degrades a FAILED read to an empty body, and still posts", async () => {
		// Losing a neighbour is bad; refusing to report the release at all is worse.
		const { written, body, posted } = await run({
			sections: [section("a", "alpha")],
			read: () => Effect.fail(apiDown),
		});

		expect(written).toBe(true);
		expect(posted).toHaveLength(1);
		expect(body).toContain("alpha");
	});

	it("refreshes the banner of a section it does NOT own", async () => {
		// A banner is rendered into the text and freezes at write time. Left alone,
		// a section nobody rewrote goes on claiming it is up to date at a sha the
		// branch has moved past — a false claim, not merely a stale one.
		const stale = renderSection(
			{
				...section("other", "someone else's section"),
				stamp: { state: "complete", sha: OLD_SHA, runId: "1", at: "2026-01-01T00:00:00.000Z" },
			},
			OLD_SHA,
		);
		const { body } = await run({ sections: [section("a", "alpha")], read: () => Effect.succeed(stale) });

		expect(body).toContain("⚠️ Out of date");
		expect(body).toContain(HEAD_SHA.slice(0, 7));
		expect(body).not.toContain(`Up to date as of \`${OLD_SHA.slice(0, 7)}\``);
	});

	it("stamps what it writes against the head sha, and links it", async () => {
		const { body } = await run({ sections: [section("a", "alpha")] });
		const written = readSection(body, "a");

		expect(written?.stamp.sha).toBe(HEAD_SHA);
		expect(body).toContain(`https://gh.test/commit/${HEAD_SHA}`);
	});

	it("drops an OLDER write rather than clobbering a newer run's section", async () => {
		// Rule 5, enforced inside `upsertSection` — asserted here because this is
		// the function that decides what base the rule is applied against. Reading
		// the comment first is what makes the newer stamp visible at all.
		const newer = renderSection(section("a", "the newer run's result", "2026-03-01T00:00:00.000Z"), HEAD_SHA);
		const { body } = await run({
			sections: [section("a", "the older run's result", "2026-02-01T00:00:00.000Z")],
			read: () => Effect.succeed(newer),
		});

		expect(body).toContain("the newer run's result");
		expect(body).not.toContain("the older run's result");
	});

	it("reports a successful post", async () => {
		const { written } = await run({ sections: [section("a", "alpha")] });

		expect(written).toBe(true);
	});

	it("degrades a FAILED post to the caller's warning, and reports it did not write", async () => {
		// A reporting write is not a release gate: the error channel is `never`.
		const { written, lines } = await run({
			sections: [section("a", "alpha")],
			publish: () => Effect.fail(apiDown),
		});

		expect(written).toBe(false);
		expect(lines.join("\n")).toContain("Could not update the release comment: ");
		expect(lines.join("\n")).toContain("comment API down");
	});

	it("uses the caller's warning verbatim, because the two phases say different things", async () => {
		const { lines } = await run({
			sections: [section("a", "alpha")],
			warning: "Could not publish the release plan comment",
			publish: () => Effect.fail(apiDown),
		});

		expect(lines.join("\n")).toContain("Could not publish the release plan comment: ");
	});

	it("renders banners unlinked when no commit linker is supplied", async () => {
		// The link is decoration, not structure — the banner must render either way.
		const { body } = await run({ sections: [section("a", "alpha")], commitLink: undefined });

		expect(body).toContain("Up to date as of");
		expect(body).not.toContain("https://gh.test/commit/");
	});
});
