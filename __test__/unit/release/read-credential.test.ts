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
import { resolveReadCredential, workloadReadGap } from "../../../src/release/resolve-targets.js";
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

// OPS-143: a pnpr workload registry. The workload credential is minted at
// publish time and authenticates the PUT only — it is not in the parsed input
// at all, so the read side can only ever see the paired `_authToken`.
describe("resolveReadCredential — pnpr workload registries (OPS-143)", () => {
	const SAVVY = "https://registry.savvyweb.systems/npm/~savvy/";
	const reader = Redacted.make("fake-release-reader");
	const workload = { audience: "https://registry.savvyweb.systems" };

	it("reads a workload registry with its paired _authToken reader", () => {
		const resolved = resolveReadCredential(SAVVY, "npm-secret", "gh-secret", [
			{ registry: SAVVY, token: reader, workload },
		]);
		expect(resolved?.credential).toEqual({ kind: "token", token: reader });
		expect(resolved?.source).toBe("custom-registries");
	});

	it("has NO read credential for a workload-only registry, even with a registry-env token set", () => {
		// Falling through to `<HOST>_TOKEN` would send some other credential to
		// a registry whose configuration says it has no reader; the answer is
		// `null`, which the confirmation probe reports as `no-read-credential`.
		touchedEnv.push("REGISTRY_SAVVYWEB_SYSTEMS_NPM_SAVVY_TOKEN");
		process.env.REGISTRY_SAVVYWEB_SYSTEMS_NPM_SAVVY_TOKEN = "env-secret";
		expect(resolveReadCredential(SAVVY, "npm-secret", "gh-secret", [{ registry: SAVVY, workload }])).toBeNull();
	});
});

describe("workloadReadGap", () => {
	const SAVVY = "https://registry.savvyweb.systems/npm/~savvy/";
	const workload = { audience: "https://registry.savvyweb.systems" };

	it("names the missing reader line for a workload-only registry", () => {
		expect(workloadReadGap(SAVVY, [{ registry: SAVVY, workload }])).toBe(
			"no-read-credential: pnpr workload credentials cannot read; add " +
				"`https://registry.savvyweb.systems/npm/~savvy/_authToken=<release-reader>` to custom-registries",
		);
	});

	it("matches the registry across slash variance", () => {
		expect(
			workloadReadGap("https://registry.savvyweb.systems/npm/~savvy", [{ registry: SAVVY, workload }]),
		).not.toBeNull();
	});

	it("is null for a paired workload registry, a plain token registry, and an unconfigured one", () => {
		const token = Redacted.make("fake");
		expect(workloadReadGap(SAVVY, [{ registry: SAVVY, workload, token }])).toBeNull();
		expect(workloadReadGap(SAVVY, [{ registry: SAVVY, token }])).toBeNull();
		expect(workloadReadGap(SAVVY, [])).toBeNull();
	});
});
