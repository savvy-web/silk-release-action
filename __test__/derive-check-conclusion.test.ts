/**
 * Unit tests for `deriveCheckConclusion`.
 *
 * The function is a pure projection from (checkName, findings, buildSuccess,
 * strictWarnings) to a GitHub check-run conclusion. The matrix:
 *
 * - error finding scoped to this check → failure (always).
 * - warning finding scoped, strict off → neutral.
 * - warning finding scoped, strict on  → failure.
 * - no findings scoped → success.
 * - build failed + build-dependent check → failure.
 * - build failed + build-independent check (Build Validation, Link Issues) →
 *   normal rules apply.
 */

import { describe, expect, it } from "vitest";
import type { ValidationFinding } from "../src/release/types.js";
import { deriveCheckConclusion } from "../src/utils/derive-check-conclusion.js";

const warning = (check: string, message = "warn"): ValidationFinding => ({
	severity: "warning",
	check,
	scope: null,
	message,
});

const error = (check: string, message = "boom"): ValidationFinding => ({
	severity: "error",
	check,
	scope: null,
	message,
});

describe("deriveCheckConclusion", () => {
	it("returns success when no findings are scoped to the check", () => {
		expect(deriveCheckConclusion("Publish Validation", [], true, false)).toBe("success");
		expect(deriveCheckConclusion("Publish Validation", [warning("SBOM Preview")], true, false)).toBe("success");
	});

	it("returns failure when an error-severity finding is scoped to the check", () => {
		expect(deriveCheckConclusion("Publish Validation", [error("Publish Validation")], true, false)).toBe("failure");
	});

	it("returns failure when an error is scoped to the check, regardless of strict mode", () => {
		expect(deriveCheckConclusion("Publish Validation", [error("Publish Validation")], true, true)).toBe("failure");
	});

	it("returns neutral for a warning when strictWarnings is off", () => {
		expect(deriveCheckConclusion("Publish Validation", [warning("Publish Validation")], true, false)).toBe("neutral");
	});

	it("returns failure for a warning when strictWarnings is on", () => {
		expect(deriveCheckConclusion("Publish Validation", [warning("Publish Validation")], true, true)).toBe("failure");
	});

	it("escalates only when at least one warning is scoped to the check", () => {
		// Warning is scoped to a different check; this check still passes.
		expect(deriveCheckConclusion("Publish Validation", [warning("SBOM Preview")], true, true)).toBe("success");
	});

	it("prefers failure over neutral when both errors and warnings are scoped", () => {
		// Errors trump warnings; strict mode is irrelevant in this case.
		expect(
			deriveCheckConclusion(
				"Publish Validation",
				[warning("Publish Validation"), error("Publish Validation")],
				true,
				false,
			),
		).toBe("failure");
	});

	describe("build-failed cascade", () => {
		it("returns failure for build-dependent checks when the build itself failed, even with no findings", () => {
			expect(deriveCheckConclusion("Publish Validation", [], false, false)).toBe("failure");
			expect(deriveCheckConclusion("Release Notes Preview", [], false, false)).toBe("failure");
			expect(deriveCheckConclusion("SBOM Preview", [], false, false)).toBe("failure");
		});

		it("leaves Build Validation's own conclusion to normal finding rules", () => {
			// Build Validation is its own conclusion; the cascade does not apply.
			expect(deriveCheckConclusion("Build Validation", [], false, false)).toBe("success");
			expect(deriveCheckConclusion("Build Validation", [error("Build Validation")], false, false)).toBe("failure");
		});

		it("leaves Link Issues from Commits unaffected by build failure", () => {
			expect(deriveCheckConclusion("Link Issues from Commits", [], false, false)).toBe("success");
		});
	});
});
