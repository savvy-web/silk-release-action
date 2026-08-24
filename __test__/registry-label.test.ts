/**
 * Tests for registry labelling.
 *
 * @remarks
 * The three functions now come from `@effected/npm` (effected#196) — our local
 * `src/utils/registry-label.ts` was deleted and the kit carries our vocabulary
 * verbatim. This suite stays as an ADOPTION GUARD: it pins the strings we
 * depend on against upstream drift, so a changed label breaks here rather than
 * in a release log tree.
 *
 * These labels are cosmetic, but the classification underneath them is not:
 * `classifyRegistry` decides whether a token is sent and whether `--provenance`
 * is requested. The look-alike-host cases below are the reason this module
 * moved off three hand-rolled predicates — they are a hardening property, not a
 * formatting one.
 */

import { registryDisplayName, registryHost, registryShortLabel } from "@effected/npm";
import { describe, expect, it } from "vitest";

describe("registryShortLabel", () => {
	it("should label the public npm registry", () => {
		expect(registryShortLabel("https://registry.npmjs.org/")).toBe("npm");
	});

	it("should label GitHub Packages", () => {
		expect(registryShortLabel("https://npm.pkg.github.com/")).toBe("github");
	});

	it("should label JSR", () => {
		expect(registryShortLabel("https://jsr.io/")).toBe("jsr");
	});

	it("should fall back to the hostname for a custom registry", () => {
		expect(registryShortLabel("https://registry.example.com/path")).toBe("registry.example.com");
	});

	it("should classify a bare host with no scheme", () => {
		// npm config values are written both ways.
		expect(registryShortLabel("registry.npmjs.org/")).toBe("npm");
	});

	it("should NOT classify a look-alike host as npm", () => {
		// The whole point of moving to `classifyRegistry`: matching is on the
		// domain with a leading dot, so this is a custom registry — and therefore
		// does not get npm's provenance or token treatment.
		expect(registryShortLabel("https://evil-npmjs.org/")).toBe("evil-npmjs.org");
	});

	it("should NOT classify a look-alike GitHub Packages host", () => {
		expect(registryShortLabel("https://not-pkg.github.com.evil.test/")).toBe("not-pkg.github.com.evil.test");
	});

	it("should classify a subdomain of the npm registry", () => {
		expect(registryShortLabel("https://mirror.npmjs.org/")).toBe("npm");
	});
});

describe("registryDisplayName", () => {
	it("should name each well-known registry", () => {
		expect(registryDisplayName("https://registry.npmjs.org/")).toBe("npm");
		expect(registryDisplayName("https://npm.pkg.github.com/")).toBe("GitHub Packages");
		expect(registryDisplayName("https://jsr.io/")).toBe("JSR");
	});

	it("should fall back to the hostname for a custom registry", () => {
		expect(registryDisplayName("https://registry.example.com/")).toBe("registry.example.com");
	});

	it("should treat an absent registry as npm", () => {
		// No registry configured means the public npm registry — every npm
		// client's default, and the classifier's own rule.
		expect(registryDisplayName(null)).toBe("npm");
		expect(registryDisplayName(undefined)).toBe("npm");
		expect(registryDisplayName("")).toBe("npm");
	});
});

describe("registryHost", () => {
	it("should extract the host from a URL", () => {
		expect(registryHost("https://registry.example.com/path/to/thing")).toBe("registry.example.com");
	});

	it("should preserve a port", () => {
		expect(registryHost("https://registry.example.com:4873/")).toBe("registry.example.com:4873");
	});

	it("should degrade readably when the value does not parse", () => {
		expect(registryHost("not a url at all")).toBe("not a url at all");
	});
});
