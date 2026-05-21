/**
 * Tests for the token-resolution helpers. They read the cross-phase token
 * state that main.ts bridges into STATE_* env vars.
 */

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
		expect(appToken()).toBe("app-token-123");
	});

	it("appToken returns an empty string when no token is in state", () => {
		expect(appToken()).toBe("");
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
