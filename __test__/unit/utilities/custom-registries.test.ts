/**
 * Unit tests for `parseCustomRegistries` — the `custom-registries` line parser
 * restored for issue #215.
 *
 * @remarks
 * Two properties carry the weight here: a well-formed line yields a
 * `Redacted` token keyed by the normalized registry URL, and every malformed
 * shape fails the decode **loudly** — the silent-ignore posture is exactly
 * what issue #215 condemned. The failure-message assertions also pin that no
 * message ever contains the token text.
 *
 * Lives at the mirrored `__test__/unit/utilities/` path. It was written flat,
 * as a workaround for the discovery bug that made `unit/utils/` never collect
 * (#237); that directory has since been renamed and the suite moved here, so
 * the workaround is gone rather than merely documented.
 */

import { describe, expect, it } from "@effect/vitest";
import { Config, Effect, Redacted } from "effect";
import { parseCustomRegistries } from "../../../src/utils/custom-registries.js";

describe("parseCustomRegistries", () => {
	it.effect("parses a registry URL immediately followed by _authToken=", () =>
		Effect.gen(function* () {
			const entries = yield* parseCustomRegistries(["https://registry.example.com/_authToken=npm_abc123"]);
			expect(entries).toHaveLength(1);
			expect(entries[0]?.registry).toBe("https://registry.example.com/");
			expect(entries[0]?.token && Redacted.value(entries[0].token)).toBe("npm_abc123");
		}),
	);

	it.effect("normalizes a registry without a trailing slash to carry one", () =>
		Effect.gen(function* () {
			const entries = yield* parseCustomRegistries(["https://registry.example.com_authToken=tok"]);
			expect(entries[0]?.registry).toBe("https://registry.example.com/");
		}),
	);

	it.effect("preserves a registry path (Artifactory-style URLs)", () =>
		Effect.gen(function* () {
			const entries = yield* parseCustomRegistries([
				"https://host.example.com/artifactory/api/npm/npm-local/_authToken=tok",
			]);
			expect(entries[0]?.registry).toBe("https://host.example.com/artifactory/api/npm/npm-local/");
		}),
	);

	it.effect("keeps a token containing an equals sign whole", () =>
		Effect.gen(function* () {
			const entries = yield* parseCustomRegistries(["https://registry.example.com/_authToken=a=b=c"]);
			expect(entries[0]?.token && Redacted.value(entries[0].token)).toBe("a=b=c");
		}),
	);

	it.effect("parses multiple lines into one entry each", () =>
		Effect.gen(function* () {
			const entries = yield* parseCustomRegistries([
				"https://a.example.com/_authToken=token-a",
				"https://b.example.com/_authToken=token-b",
			]);
			expect(entries.map((e) => e.registry)).toEqual(["https://a.example.com/", "https://b.example.com/"]);
		}),
	);

	it.effect("yields no entries for no lines", () =>
		Effect.gen(function* () {
			expect(yield* parseCustomRegistries([])).toEqual([]);
		}),
	);

	it.effect("fails on a bare registry URL rather than silently skipping it", () =>
		Effect.gen(function* () {
			// The predecessor fell back to the GitHub App token here; that fallback
			// is gone, and silence is the issue-#215 failure mode. The message names
			// the line and the expected format.
			const error = yield* Effect.flip(parseCustomRegistries(["https://registry.example.com/"]));
			expect(error).toBeInstanceOf(Config.ConfigError);
			expect(error.message).toContain("line 1");
			expect(error.message).toContain("_authToken");
		}),
	);

	it.effect("fails on a _auth= (basic auth) line, naming the unsupported form", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(parseCustomRegistries(["https://registry.example.com/_auth=czNjcjN0"]));
			expect(error.message).toContain("_auth=<base64>");
			expect(error.message).toContain("no longer supported");
			// The credential must never appear in a failure message.
			expect(error.message).not.toContain("czNjcjN0");
		}),
	);

	it.effect("fails on a non-http(s) registry", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(parseCustomRegistries(["ftp://registry.example.com/_authToken=tok"]));
			expect(error.message).toContain("http(s)");
			expect(error.message).not.toContain("tok");
		}),
	);

	it.effect("fails on duplicate entries for one registry", () =>
		Effect.gen(function* () {
			// Two tokens for one registry is a misconfiguration, not a preference
			// order — and the duplicate detection sees through slash variance.
			const error = yield* Effect.flip(
				parseCustomRegistries([
					"https://registry.example.com/_authToken=first",
					"https://registry.example.com_authToken=second",
				]),
			);
			expect(error.message).toContain("line 2");
			expect(error.message).toContain("duplicate");
			expect(error.message).not.toContain("first");
			expect(error.message).not.toContain("second");
		}),
	);

	it.effect("reports the line number of the offending line, not always 1", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				parseCustomRegistries(["https://ok.example.com/_authToken=tok", "https://bad.example.com/"]),
			);
			expect(error.message).toContain("line 2");
		}),
	);
});

// ─── OPS-143: the pnpr workload pair ───────────────────────────────────────────
// `_pnprWorkload=<audience>` asks for a minted, publish-only workload
// credential; the `_authToken` line on the SAME URL is then the read
// credential. Two lines, one registry, either order.
describe("parseCustomRegistries — pnpr workload lines (OPS-143)", () => {
	const URL = "https://registry.savvyweb.systems/npm/~savvy/";
	const AUDIENCE = "https://registry.savvyweb.systems";
	const WORKLOAD_LINE = `${URL}_pnprWorkload=${AUDIENCE}`;
	const READER_LINE = `${URL}_authToken=fake-reader-token`;

	it.effect("pairs a workload line with the same URL's _authToken as its read credential", () =>
		Effect.gen(function* () {
			const entries = yield* parseCustomRegistries([WORKLOAD_LINE, READER_LINE]);
			expect(entries).toHaveLength(1);
			expect(entries[0]?.registry).toBe(URL);
			expect(entries[0]?.workload).toEqual({ audience: AUDIENCE });
			expect(entries[0]?.token && Redacted.value(entries[0].token)).toBe("fake-reader-token");
		}),
	);

	it.effect("pairs them identically when the _authToken line comes first", () =>
		Effect.gen(function* () {
			const entries = yield* parseCustomRegistries([READER_LINE, WORKLOAD_LINE]);
			expect(entries).toHaveLength(1);
			expect(entries[0]?.workload).toEqual({ audience: AUDIENCE });
			expect(entries[0]?.token && Redacted.value(entries[0].token)).toBe("fake-reader-token");
		}),
	);

	it.effect("pairs across slash variance and keeps other registries separate", () =>
		Effect.gen(function* () {
			const entries = yield* parseCustomRegistries([
				`https://registry.savvyweb.systems/npm/~savvy_pnprWorkload=${AUDIENCE}`,
				"https://registry.example.com/_authToken=other-token",
				READER_LINE,
			]);
			expect(entries.map((e) => e.registry)).toEqual([URL, "https://registry.example.com/"]);
			expect(entries[1]?.workload).toBeUndefined();
		}),
	);

	it.effect("leaves a plain _authToken entry with no workload", () =>
		Effect.gen(function* () {
			const entries = yield* parseCustomRegistries([READER_LINE]);
			expect(entries[0]?.workload).toBeUndefined();
		}),
	);

	it.effect("accepts a workload-only URL at parse time, with no token", () =>
		Effect.gen(function* () {
			// The missing read credential is a publish-time failure, named there.
			const entries = yield* parseCustomRegistries([WORKLOAD_LINE]);
			expect(entries).toHaveLength(1);
			expect(entries[0]?.workload).toEqual({ audience: AUDIENCE });
			expect(entries[0]?.token).toBeUndefined();
		}),
	);

	it.effect("keeps the audience verbatim — pnpr matches it exactly", () =>
		Effect.gen(function* () {
			const entries = yield* parseCustomRegistries([`${URL}_pnprWorkload=https://aud.example.com/x`]);
			expect(entries[0]?.workload?.audience).toBe("https://aud.example.com/x");
		}),
	);

	it.effect("rejects two _pnprWorkload lines for one URL, naming both lines", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(parseCustomRegistries([WORKLOAD_LINE, READER_LINE, WORKLOAD_LINE]));
			expect(error.message).toContain("line 3");
			expect(error.message).toContain("line 1");
			expect(error.message).toContain("duplicate `_pnprWorkload`");
		}),
	);

	it.effect("still rejects two _authToken lines for a workload URL, without the tokens", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				parseCustomRegistries([READER_LINE, WORKLOAD_LINE, `${URL}_authToken=second-fake-token`]),
			);
			expect(error.message).toContain("line 3");
			expect(error.message).toContain("duplicate `_authToken`");
			expect(error.message).not.toContain("fake-reader-token");
			expect(error.message).not.toContain("second-fake-token");
		}),
	);

	it.effect("rejects an audience that is not an http(s) URL", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(parseCustomRegistries([`${URL}_pnprWorkload=registry.savvyweb.systems`]));
			expect(error).toBeInstanceOf(Config.ConfigError);
			expect(error.message).toContain("line 1");
			expect(error.message).toContain("audience");
			expect(error.message).toContain("http(s)");
		}),
	);

	it.effect("rejects an ftp audience", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(parseCustomRegistries([`${URL}_pnprWorkload=ftp://registry.savvyweb.systems`]));
			expect(error.message).toContain("audience");
		}),
	);

	// The workload path strips the OIDC env and publishes with the minted token
	// only, so a workload line on npm or GitHub Packages would silently replace
	// trusted publishing or the github-token with a credential neither accepts.
	it.effect.each([["https://registry.npmjs.org"], ["https://npm.pkg.github.com"]])(
		"rejects a workload line on %s, which do not take pnpr workload credentials",
		([registry]) =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(parseCustomRegistries([`${registry}/_pnprWorkload=${AUDIENCE}`]));
				expect(error.message).toContain("line 1");
				expect(error.message).toContain("custom registr");
			}),
	);

	it.effect("rejects a workload line on a non-http(s) registry", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(parseCustomRegistries([`ftp://x.example.com/_pnprWorkload=${AUDIENCE}`]));
			expect(error.message).toContain("http(s)");
		}),
	);

	it.effect("splits on the FIRST key, so a token containing `_pnprWorkload=` stays a token", () =>
		Effect.gen(function* () {
			const entries = yield* parseCustomRegistries([`${URL}_authToken=abc_pnprWorkload=https://evil.example.com`]);
			expect(entries[0]?.workload).toBeUndefined();
			expect(entries[0]?.token && Redacted.value(entries[0].token)).toBe("abc_pnprWorkload=https://evil.example.com");
		}),
	);
});
