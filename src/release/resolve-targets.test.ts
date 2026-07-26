/**
 * Unit tests for `pickToken`.
 *
 * @remarks
 * `pickToken` decides **which credential is sent to which registry**, and it
 * had no test file at all before this migration. It is shared by `publish.ts`
 * and `validation.ts`, so a misclassification here sends an npm token to a
 * third-party host.
 *
 * The look-alike-host cases below pass against both the predecessor's
 * `isNpmRegistry`/`isGitHubPackagesRegistry` pair and the kit's
 * `classifyRegistry` — the predecessor at the version this repo depends on
 * already matched on the domain with a leading dot. They are pinned anyway:
 * this is the property that must not regress, whoever implements it.
 */

import { afterEach, describe, expect, it } from "vitest";
import { pickToken } from "./resolve-targets.js";

const NPM_TOKEN = "npm-token";
const GH_TOKEN = "gh-token";

const touchedEnv: string[] = [];

const setEnv = (name: string, value: string): void => {
	touchedEnv.push(name);
	process.env[name] = value;
};

afterEach(() => {
	for (const name of touchedEnv) delete process.env[name];
	touchedEnv.length = 0;
});

describe("pickToken - npm", () => {
	it("routes the public npm registry to the npm token", () => {
		expect(pickToken("https://registry.npmjs.org/", NPM_TOKEN, GH_TOKEN)).toBe(NPM_TOKEN);
	});

	it("routes the apex domain to the npm token", () => {
		expect(pickToken("https://npmjs.org/", NPM_TOKEN, GH_TOKEN)).toBe(NPM_TOKEN);
	});

	it("classifies a scheme-less registry host", () => {
		// The predecessor's `new URL("registry.npmjs.org")` threw and it fell
		// through to the custom branch, deriving `REGISTRY_NPMJS_ORG_TOKEN`.
		// The kit retries with an `https://` prefix.
		expect(pickToken("registry.npmjs.org", NPM_TOKEN, GH_TOKEN)).toBe(NPM_TOKEN);
	});

	it("treats an empty registry as the public npm registry", () => {
		// "no registry configured" is every npm client's default.
		expect(pickToken("", NPM_TOKEN, GH_TOKEN)).toBe(NPM_TOKEN);
	});
});

describe("pickToken - GitHub Packages", () => {
	it("routes npm.pkg.github.com to the GitHub Packages token", () => {
		expect(pickToken("https://npm.pkg.github.com/", NPM_TOKEN, GH_TOKEN)).toBe(GH_TOKEN);
	});
});

describe("pickToken - look-alike hosts must not inherit a token", () => {
	it("does not classify a host that merely ends with the npm domain text as npm", () => {
		// `evil-npmjs.org` ends with the string "npmjs.org" but is not the domain
		// nor a subdomain of it. A substring match here would send the npm token
		// to an attacker-controlled host.
		const token = pickToken("https://evil-npmjs.org/", NPM_TOKEN, GH_TOKEN);
		expect(token).not.toBe(NPM_TOKEN);
		expect(token).toBeNull();
	});

	it("does not classify a host that merely contains the GitHub Packages domain as GitHub Packages", () => {
		const token = pickToken("https://npm.pkg.github.com.attacker.example/", NPM_TOKEN, GH_TOKEN);
		expect(token).not.toBe(GH_TOKEN);
		expect(token).toBeNull();
	});

	it("does not treat a look-alike in the path as the registry host", () => {
		const token = pickToken("https://attacker.example/registry.npmjs.org/", NPM_TOKEN, GH_TOKEN);
		expect(token).not.toBe(NPM_TOKEN);
		expect(token).toBeNull();
	});
});

describe("pickToken - custom registries", () => {
	it("derives the env var name from the registry host", () => {
		setEnv("REGISTRY_EXAMPLE_COM_TOKEN", "custom-token");
		expect(pickToken("https://registry.example.com/", NPM_TOKEN, GH_TOKEN)).toBe("custom-token");
	});

	it("returns null when the derived env var is unset", () => {
		expect(pickToken("https://registry.example.com/", NPM_TOKEN, GH_TOKEN)).toBeNull();
	});

	it("keeps JSR on the custom env-var path", () => {
		// Inherited, not endorsed: the predecessor's two booleans both answered
		// false for JSR so it fell through to this branch. JSR publishes over
		// OIDC and has no token, but changing that is a product decision.
		setEnv("JSR_IO_TOKEN", "jsr-token");
		expect(pickToken("https://jsr.io/", NPM_TOKEN, GH_TOKEN)).toBe("jsr-token");
	});
});
