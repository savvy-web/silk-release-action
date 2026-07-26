// Unit tests for the webhook event-payload reader.
//
// These drive a REAL event file through a REAL FileSystem, because the thing
// under test is the decode of a file the runner wrote. Note the layer wiring:
// `ActionEnvironment.layerTest` is documented as "`makeTest` behind a layer,
// with FileSystem STUBBED OUT", so a merged `NodeFileSystem.layer` never
// reaches it and a seeded `GITHUB_EVENT_PATH` silently reads nothing. Using
// `makeTest` with a real FileSystem is what makes these assertions mean
// anything — the same trap cost a green-but-blind suite earlier.

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { ActionEnvironment } from "@effected/github-actions";
import { Effect, Layer, Option } from "effect";
import { describe, expect, it } from "vitest";
import { readEventPayload, readEventPullRequestNumber } from "../src/utils/event-payload.js";

const withEvent = (contents: string | undefined, path?: string) => {
	const eventPath =
		path ?? (contents === undefined ? "" : join(mkdtempSync(join(tmpdir(), "silk-event-")), "event.json"));
	if (contents !== undefined && path === undefined) writeFileSync(eventPath, contents);

	return Layer.effect(ActionEnvironment)(
		ActionEnvironment.makeTest({
			GITHUB_EVENT_PATH: eventPath,
			GITHUB_REPOSITORY: "acme/widgets",
			GITHUB_SHA: "abc1234",
			GITHUB_REF: "refs/heads/main",
			GITHUB_EVENT_NAME: "pull_request",
		}),
	).pipe(Layer.provide(NodeFileSystem.layer));
};

const runPayload = (contents: string | undefined, path?: string) =>
	Effect.runPromise(readEventPayload().pipe(Effect.provide(withEvent(contents, path))));

const runPrNumber = (contents: string | undefined, path?: string) =>
	Effect.runPromise(readEventPullRequestNumber().pipe(Effect.provide(withEvent(contents, path))));

describe("readEventPayload", () => {
	it("reads the fields the action actually uses", async () => {
		const payload = await runPayload(
			JSON.stringify({
				pull_request: { number: 42, merged: true, head: { ref: "release" }, base: { ref: "main" } },
				head_commit: { message: "chore: release" },
			}),
		);

		expect(payload.pull_request?.number).toBe(42);
		expect(payload.pull_request?.merged).toBe(true);
		expect(payload.pull_request?.head?.ref).toBe("release");
		expect(payload.pull_request?.base?.ref).toBe("main");
		expect(payload.head_commit?.message).toBe("chore: release");
	});

	it("ignores the dozens of fields a real event carries", async () => {
		// The property this rests on was settled by probe, not assumption: a
		// strict struct would reject every real webhook payload and take phase
		// detection down with it.
		const payload = await runPayload(
			JSON.stringify({
				action: "closed",
				number: 42,
				pull_request: { number: 42, title: "Release", user: { login: "bot" }, labels: [], _links: {} },
				repository: { full_name: "acme/widgets" },
				sender: { login: "someone" },
				organization: {},
			}),
		);

		expect(payload.pull_request?.number).toBe(42);
	});

	it("degrades to an empty payload when the event file is missing", async () => {
		// "No event file", "unreadable event file" and "payload without X" are the
		// same answer at every call site, so none of them is a failure.
		const payload = await runPayload(undefined, "/nonexistent/does-not-exist.json");

		expect(payload.pull_request).toBeUndefined();
		expect(payload.head_commit).toBeUndefined();
	});

	it("degrades to an empty payload on malformed JSON", async () => {
		const payload = await runPayload("{ this is not json");

		expect(payload.pull_request).toBeUndefined();
	});

	it("degrades to an empty payload when the shape does not match", async () => {
		// A `number` that is a string is the realistic mismatch — decoding must
		// not throw it into the caller's error channel.
		const payload = await runPayload(JSON.stringify({ pull_request: { number: "forty-two" } }));

		expect(payload.pull_request).toBeUndefined();
	});

	it("reads an event with no pull request at all", async () => {
		const payload = await runPayload(JSON.stringify({ head_commit: { message: "push to main" } }));

		expect(payload.pull_request).toBeUndefined();
		expect(payload.head_commit?.message).toBe("push to main");
	});
});

describe("readEventPullRequestNumber", () => {
	it("finds the number when the event carries a pull request", async () => {
		const number = await runPrNumber(JSON.stringify({ pull_request: { number: 7 } }));

		expect(Option.getOrNull(number)).toBe(7);
	});

	it("is none when the event carries no pull request", async () => {
		const number = await runPrNumber(JSON.stringify({ head_commit: { message: "push" } }));

		expect(Option.isNone(number)).toBe(true);
	});

	it("is none rather than a failure when the event file is missing", async () => {
		// Phase 3a runs only on a `pull_request` event, but the reader is called
		// before that is known — so absence must be a value, not an error.
		const number = await runPrNumber(undefined, "/nonexistent/does-not-exist.json");

		expect(Option.isNone(number)).toBe(true);
	});
});
