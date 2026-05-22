/**
 * Tests for the token-resolution helpers. They read the cross-phase token
 * state that main.ts bridges into STATE_* env vars.
 */

import { Redacted } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appToken, packagesToken } from "../src/utils/tokens.js";

describe("token helpers", () => {
	beforeEach(() => {
		delete process.env.STATE_token;
		delete process.env.STATE_githubToken;
	});
	afterEach(() => {
		delete process.env.STATE_token;
		delete process.env.STATE_githubToken;
	});

	it("appToken returns the App installation token from state", () => {
		process.env.STATE_token = "app-token-123";
		// appToken returns a Redacted<string> in 2.0; unwrap to assert the value.
		expect(Redacted.value(appToken())).toBe("app-token-123");
	});

	it("appToken returns an empty Redacted string when no token is in state", () => {
		expect(Redacted.value(appToken())).toBe("");
	});

	it("packagesToken prefers the workflow github-token", () => {
		process.env.STATE_token = "app-token-123";
		process.env.STATE_githubToken = "workflow-token-456";
		expect(packagesToken()).toBe("workflow-token-456");
	});

	it("packagesToken falls back to the App token when no workflow token is set", () => {
		process.env.STATE_token = "app-token-123";
		expect(packagesToken()).toBe("app-token-123");
	});

	it("packagesToken returns an empty string when neither token is set", () => {
		expect(packagesToken()).toBe("");
	});
});
