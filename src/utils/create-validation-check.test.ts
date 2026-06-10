import { describe, expect, it } from "vitest";
import { GITHUB_CHECK_SUMMARY_LIMIT, capCheckSummary } from "./create-validation-check.js";

const utf8Bytes = (s: string): number => Buffer.byteLength(s, "utf8");

describe("capCheckSummary", () => {
	it("returns the summary unchanged when under the limit", () => {
		const s = "short summary";
		expect(capCheckSummary(s)).toBe(s);
	});

	it("truncates an over-limit (ASCII) summary to <= the GitHub byte limit and appends a notice", () => {
		const big = "x".repeat(GITHUB_CHECK_SUMMARY_LIMIT + 5000);
		const out = capCheckSummary(big);
		expect(utf8Bytes(out)).toBeLessThanOrEqual(GITHUB_CHECK_SUMMARY_LIMIT);
		expect(out).toContain("truncated");
	});

	it("caps by UTF-8 BYTES, not characters (multi-byte content under the char count but over the byte limit)", () => {
		// "✅" is 3 UTF-8 bytes but 1 string char (well, 1 code point). A string of
		// these can be under GITHUB_CHECK_SUMMARY_LIMIT *characters* yet far over the
		// byte limit — the old char-based cap let this through and the API 422'd.
		const multibyte = "✅".repeat(30000); // ~30k chars, ~90k bytes
		expect(multibyte.length).toBeLessThan(GITHUB_CHECK_SUMMARY_LIMIT); // under the CHAR limit
		expect(utf8Bytes(multibyte)).toBeGreaterThan(GITHUB_CHECK_SUMMARY_LIMIT); // over the BYTE limit
		const out = capCheckSummary(multibyte);
		expect(utf8Bytes(out)).toBeLessThanOrEqual(GITHUB_CHECK_SUMMARY_LIMIT);
		expect(out).toContain("truncated");
	});

	it("does not leave a U+FFFD replacement char from a split multi-byte sequence", () => {
		const out = capCheckSummary("🦋".repeat(20000)); // 4-byte emoji, ~80k bytes
		expect(utf8Bytes(out)).toBeLessThanOrEqual(GITHUB_CHECK_SUMMARY_LIMIT);
		// The body before the notice must not end in the replacement character.
		const body = out.slice(0, out.indexOf("\n\n_…summary truncated"));
		expect(body.endsWith("�")).toBe(false);
	});
});
