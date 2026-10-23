/**
 * Unit tests for the per-target publish log line.
 *
 * @remarks
 * The line this replaced rendered the registry twice for a custom registry
 * (`registry.savvyweb.systems · published · registry.savvyweb.systems`) and
 * said nothing about the dist-tag or how the upload authenticated. These
 * cases pin the fragments a reader scans for — target id, host once, outcome,
 * dist-tag, auth — not whole lines, so the wording can still evolve.
 */

import { RegistryReadError } from "@effected/npm";
import { describe, expect, it } from "vitest";
import {
	credentialInputHint,
	describeAuth,
	fallbackCause,
	formatTargetLine,
	readFailureHint,
} from "../../../src/release/target-line.js";

const CUSTOM = "https://registry.savvyweb.systems/";

describe("formatTargetLine", () => {
	it("names the target id, the host once, the outcome, the dist-tag and the auth", () => {
		const line = formatTargetLine({
			id: "savvy",
			registry: CUSTOM,
			outcome: "published",
			tag: "latest",
			auth: { method: "token", credential: "custom-registries", fallback: null },
		});
		expect(line).toContain("⬆ savvy · registry.savvyweb.systems · published → latest");
		expect(line).toContain("auth: token (custom-registries)");
		expect(line.match(/registry\.savvyweb\.systems/g)).toHaveLength(1);
	});

	it("leaves the id out for an unkeyed target rather than printing null", () => {
		const line = formatTargetLine({ id: null, registry: "https://npm.pkg.github.com/", outcome: "published" });
		expect(line).toContain("⬆ npm.pkg.github.com · published");
		expect(line).not.toContain("null");
		expect(line).not.toContain("→");
		expect(line).not.toContain("auth:");
	});

	it("keeps the same shape for a failure", () => {
		const line = formatTargetLine({
			id: "npm",
			registry: "https://registry.npmjs.org/",
			outcome: "publish-failed",
			tag: "next",
			auth: { method: "token", credential: "npm-token", fallback: { from: "trusted-publishing", reason: "E404" } },
		});
		expect(line).toContain("⬆ npm · registry.npmjs.org · publish-failed → next");
		expect(line).toContain("auth: token (npm-token) after trusted publishing failed");
	});
});

describe("describeAuth", () => {
	it("names trusted publishing on its own", () => {
		expect(describeAuth({ method: "trusted-publishing", credential: null, fallback: null })).toBe("trusted publishing");
	});

	it("says a token attempt had no credential instead of leaving the parentheses empty", () => {
		expect(describeAuth({ method: "token", credential: null, fallback: null })).toBe("token (no credential)");
	});

	it("names a token-only retry without blaming trusted publishing", () => {
		const text = describeAuth({
			method: "token",
			credential: "npm-token",
			fallback: { from: "token", reason: "E500" },
		});
		expect(text).toContain("token (npm-token)");
		expect(text).not.toContain("trusted publishing");
		expect(text).toContain("retry");
	});
});

describe("credentialInputHint", () => {
	it("names the input that supplies each registry's credential", () => {
		expect(credentialInputHint("github-token", "https://npm.pkg.github.com/")).toContain("`github-token` input");
		expect(credentialInputHint("npm-token", "https://registry.npmjs.org/")).toContain("`npm-token` input");
		const custom = credentialInputHint("custom-registries", CUSTOM);
		expect(custom).toContain("`custom-registries`");
		expect(custom).toContain("registry.savvyweb.systems");
		expect(credentialInputHint("registry-env", CUSTOM)).toContain("_TOKEN");
	});
});

describe("fallbackCause", () => {
	it("blames a missing trusted publisher when trusted publishing was attempted, and says provenance is off", () => {
		const text = fallbackCause("trusted-publishing", "@scope/pkg", "https://registry.npmjs.org/");
		expect(text).toMatch(/trusted publisher/);
		expect(text).toContain("@scope/pkg");
		expect(text).toContain("registry.npmjs.org");
		expect(text).not.toContain("id-token");
		expect(text).toMatch(/provenance (is )?off/);
	});

	it("blames the missing id-token permission when the runner exposed no OIDC environment", () => {
		const text = fallbackCause("token", "@scope/pkg", "https://registry.npmjs.org/");
		expect(text).toContain("id-token: write");
		expect(text).toMatch(/provenance (is )?off/);
	});
});

describe("readFailureHint", () => {
	const status = (code: number, registry = CUSTOM) =>
		new RegistryReadError({ kind: "status", status: code, package: "@scope/pkg", registry });

	it("explains a 401 or 403 from a custom registry as a missing read credential set via custom-registries", () => {
		for (const code of [401, 403]) {
			const hint = readFailureHint(CUSTOM, status(code));
			expect(hint).toMatch(/read credential/);
			expect(hint).toContain("custom-registries");
			expect(hint).toContain("_authToken");
			expect(hint).toContain("registry.savvyweb.systems");
		}
	});

	it("stays silent for other statuses, transport failures and non-custom registries", () => {
		expect(readFailureHint(CUSTOM, status(500))).toBeNull();
		expect(
			readFailureHint(CUSTOM, new RegistryReadError({ kind: "transport", package: "@scope/pkg", registry: CUSTOM })),
		).toBeNull();
		const npm = "https://registry.npmjs.org/";
		expect(readFailureHint(npm, status(403, npm))).toBeNull();
	});
});
