/**
 * Unit tests for `resolveReadCredential` — which credential the post-publish
 * confirmation probe sends to which registry.
 *
 * @remarks
 * The rule is "the credential the publish used", so every case here is the
 * read-side twin of a `pickToken` case in `resolve-targets.test.ts`. The
 * discriminators are the token VALUE and the `source`: a resolver that sent
 * the npm token to GitHub Packages, or a custom registry's token to another
 * custom registry, goes red on the value; one that found the right token by
 * the wrong rule goes red on the source.
 */

import { Redacted } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { resolveReadCredential } from "../../../src/release/resolve-targets.js";
import type { CustomRegistryAuth } from "../../../src/utils/custom-registries.js";

const NPM = "https://registry.npmjs.org/";
const GHP = "https://npm.pkg.github.com/";
const PNPR = "https://registry.savvyweb.systems/";
const OTHER = "https://registry.example.com/";

const pnprToken = Redacted.make("pnpr-read-token");
const CUSTOM: ReadonlyArray<CustomRegistryAuth> = [{ registry: PNPR, token: pnprToken }];

const touchedEnv: string[] = [];
afterEach(() => {
	for (const name of touchedEnv) delete process.env[name];
	touchedEnv.length = 0;
});

/** The plaintext of a resolved token credential, or `null`. */
const tokenOf = (resolved: ReturnType<typeof resolveReadCredential>): string | null =>
	resolved?.credential.kind === "token" ? Redacted.value(resolved.credential.token) : null;

describe("resolveReadCredential", () => {
	it("reads the public npm registry with the npm token", () => {
		const resolved = resolveReadCredential(NPM, "npm-secret", "gh-secret", CUSTOM);
		expect(tokenOf(resolved)).toBe("npm-secret");
		expect(resolved?.source).toBe("npm-token");
	});

	it("reads GitHub Packages with the github-token, never the npm token", () => {
		const resolved = resolveReadCredential(GHP, "npm-secret", "gh-secret", CUSTOM);
		expect(tokenOf(resolved)).toBe("gh-secret");
		expect(resolved?.source).toBe("github-token");
	});

	it("has no GitHub Packages credential when github-token is absent", () => {
		expect(resolveReadCredential(GHP, "npm-secret", null, CUSTOM)).toBeNull();
	});

	it("reads a custom registry with its own custom-registries token, still Redacted", () => {
		const resolved = resolveReadCredential(PNPR, "npm-secret", "gh-secret", CUSTOM);
		// The same Redacted the input decoded: no declassification on this path.
		expect(resolved?.credential).toEqual({ kind: "token", token: pnprToken });
		expect(resolved?.source).toBe("custom-registries");
	});

	it("matches a custom registry written without its trailing slash", () => {
		const resolved = resolveReadCredential("https://registry.savvyweb.systems", null, null, CUSTOM);
		expect(tokenOf(resolved)).toBe("pnpr-read-token");
	});

	it("never sends one custom registry's token to another", () => {
		expect(resolveReadCredential(OTHER, "npm-secret", "gh-secret", CUSTOM)).toBeNull();
	});

	it("falls back to the registry-env token, as the publish does", () => {
		touchedEnv.push("REGISTRY_EXAMPLE_COM_TOKEN");
		process.env.REGISTRY_EXAMPLE_COM_TOKEN = "env-secret";
		const resolved = resolveReadCredential(OTHER, null, null, CUSTOM);
		expect(tokenOf(resolved)).toBe("env-secret");
		expect(resolved?.source).toBe("registry-env");
	});

	it("prefers custom-registries over the registry-env fallback", () => {
		touchedEnv.push("REGISTRY_SAVVYWEB_SYSTEMS_TOKEN");
		process.env.REGISTRY_SAVVYWEB_SYSTEMS_TOKEN = "env-secret";
		const resolved = resolveReadCredential(PNPR, null, null, CUSTOM);
		expect(tokenOf(resolved)).toBe("pnpr-read-token");
		expect(resolved?.source).toBe("custom-registries");
	});
});
