import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ensureNpmCacheEnv, npmCacheDir } from "../../../src/utils/npm-cache.js";

describe("npmCacheDir", () => {
	it("should return a silk-npm-cache path under RUNNER_TEMP when RUNNER_TEMP is set", () => {
		// Given: an env record with RUNNER_TEMP set
		const env = { RUNNER_TEMP: "/Users/runner/work/_temp" };

		// When
		const result = npmCacheDir(env);

		// Then
		expect(result).toBe("/Users/runner/work/_temp/silk-npm-cache");
	});

	it("should fall back to os.tmpdir() when RUNNER_TEMP is unset", () => {
		// Given: an env record with no RUNNER_TEMP key
		const env = {};

		// When
		const result = npmCacheDir(env);

		// Then
		expect(result).toBe(join(tmpdir(), "silk-npm-cache"));
	});
});

describe("ensureNpmCacheEnv", () => {
	it("should set npm_config_cache when it is undefined on the env record", () => {
		// Given: a fresh env record with RUNNER_TEMP set and no npm_config_cache
		const env: Record<string, string | undefined> = { RUNNER_TEMP: "/Users/runner/work/_temp" };

		// When
		ensureNpmCacheEnv(env);

		// Then
		expect(env.npm_config_cache).toBe("/Users/runner/work/_temp/silk-npm-cache");
	});

	it("should not overwrite an explicitly configured npm_config_cache value", () => {
		// Given: an env record with npm_config_cache already set
		const env: Record<string, string | undefined> = {
			RUNNER_TEMP: "/Users/runner/work/_temp",
			npm_config_cache: "/custom/cache",
		};

		// When
		ensureNpmCacheEnv(env);

		// Then
		expect(env.npm_config_cache).toBe("/custom/cache");
	});
});
