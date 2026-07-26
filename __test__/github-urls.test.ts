// Unit tests for the GitHub web-URL builders.
//
// Every assertion here seeds a GHES host rather than the public default. A
// fixture equal to the production default cannot distinguish "the code read the
// value" from "the code ignored it and hardcoded the same string" — which is
// exactly the defect these builders exist to remove.

import { ActionEnvironment } from "@effected/github-actions";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
	DEFAULT_SERVER_URL,
	commitUrl,
	issueUrl,
	orgPackagePageUrl,
	packageArtifactUrl,
	pullRequestUrl,
	releaseTagUrl,
	resolveServerUrl,
	workflowRunUrl,
} from "../src/utils/github-urls.js";

const GHES = "https://github.example.com";

const resolveWith = (env: Record<string, string>): Promise<string> =>
	Effect.runPromise(resolveServerUrl().pipe(Effect.provide(ActionEnvironment.layerTest(env))));

describe("resolveServerUrl", () => {
	it("uses the instance the runner names", async () => {
		await expect(resolveWith({ GITHUB_SERVER_URL: GHES })).resolves.toBe(GHES);
	});

	it("falls back to the public instance when the runner names none", async () => {
		// Absence is the github.com case — only GHES sets the variable — so this
		// is a correct default, not a swallowed failure.
		await expect(resolveWith({})).resolves.toBe(DEFAULT_SERVER_URL);
	});

	it("treats a blank value as absent rather than building a rooted URL", async () => {
		// `""` would otherwise yield `/owner/repo/pull/1` — a relative link that
		// resolves against whatever page happens to render it.
		await expect(resolveWith({ GITHUB_SERVER_URL: "   " })).resolves.toBe(DEFAULT_SERVER_URL);
	});

	it("strips a trailing slash so callers can join unconditionally", async () => {
		await expect(resolveWith({ GITHUB_SERVER_URL: `${GHES}/` })).resolves.toBe(GHES);
	});
});

describe("url builders", () => {
	it("builds every link against the given instance, never the public one", () => {
		const built = [
			issueUrl(GHES, "acme", "widgets", 7),
			commitUrl(GHES, "acme", "widgets", "abc1234"),
			pullRequestUrl(GHES, "acme", "widgets", 42),
			workflowRunUrl(GHES, "acme", "widgets", "99"),
			releaseTagUrl(GHES, "acme", "widgets", "v1.2.3"),
			orgPackagePageUrl(GHES, "acme", "@acme/widget"),
			packageArtifactUrl(GHES, "acme", "widget"),
		];

		for (const url of built) {
			expect(url.startsWith(GHES)).toBe(true);
			expect(url).not.toContain("github.com");
		}
	});

	it("builds the paths GitHub actually serves", () => {
		expect(issueUrl(GHES, "acme", "widgets", 7)).toBe(`${GHES}/acme/widgets/issues/7`);
		expect(commitUrl(GHES, "acme", "widgets", "abc1234")).toBe(`${GHES}/acme/widgets/commit/abc1234`);
		expect(pullRequestUrl(GHES, "acme", "widgets", 42)).toBe(`${GHES}/acme/widgets/pull/42`);
		expect(workflowRunUrl(GHES, "acme", "widgets", "99")).toBe(`${GHES}/acme/widgets/actions/runs/99`);
		expect(releaseTagUrl(GHES, "acme", "widgets", "v1.2.3")).toBe(`${GHES}/acme/widgets/releases/tag/v1.2.3`);
		expect(packageArtifactUrl(GHES, "acme", "widget")).toBe(`${GHES}/acme/pkgs/npm/widget`);
	});

	it("addresses a scoped package by its unscoped name on the packages page", () => {
		// GitHub Packages addresses `@scope/name` as `name`; keeping the scope
		// produces a 404.
		expect(orgPackagePageUrl(GHES, "acme", "@acme/widget")).toBe(`${GHES}/orgs/acme/packages/npm/package/widget`);
	});

	it("leaves an unscoped package name alone", () => {
		expect(orgPackagePageUrl(GHES, "acme", "widget")).toBe(`${GHES}/orgs/acme/packages/npm/package/widget`);
	});

	it("carries a release tag containing a slash through verbatim", () => {
		// Monorepo tags are routinely `@scope/pkg@1.0.0`.
		expect(releaseTagUrl(GHES, "acme", "widgets", "@acme/widget@1.0.0")).toBe(
			`${GHES}/acme/widgets/releases/tag/@acme/widget@1.0.0`,
		);
	});
});

describe("Layer wiring", () => {
	it("requires nothing beyond ActionEnvironment", async () => {
		// Pins the requirement: a builder that reached for another service would
		// widen every caller's `R`, and several callers are pure helpers.
		const layer = Layer.mergeAll(ActionEnvironment.layerTest({ GITHUB_SERVER_URL: GHES }));
		await expect(Effect.runPromise(resolveServerUrl().pipe(Effect.provide(layer)))).resolves.toBe(GHES);
	});
});
