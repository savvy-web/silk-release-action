// Tests for the Phase-2 check derivation.
//
// ⚠️ FIRST-EVER COVERAGE. This logic lived inline in a 624-line orchestrator
// that no test executed — replacing that whole body with `Effect.die` left the
// suite green. These are CHARACTERIZATION tests: they pin what the code does
// today, not what it should do. Where the two differ the test still pins
// today's behaviour, says so, and is written to fail when the fix lands.
//
// This is the path savvy-web/silk-release-action#216 runs through: the
// green-on-crash chain is `conclusionFor` → `results` → `rows`, all of it here.

import { describe, expect, it } from "vitest";
import type { ValidationFinding } from "../src/release/types.js";
import type { ValidationCheckInputs } from "../src/release/validation-checks.js";
import { CHECK_NAMES, applyCheckUrls, deriveValidationChecks } from "../src/release/validation-checks.js";
import type { PublishValidationResult } from "../src/steps/publish-validation.js";
import { SKIPPED_PUBLISH_VALIDATION } from "../src/steps/publish-validation.js";

/** A publish result that ran and passed cleanly. */
const HEALTHY: PublishValidationResult = {
	...SKIPPED_PUBLISH_VALIDATION,
	publishOk: true,
	npmReady: true,
	githubPackagesReady: true,
	totalTargets: 4,
	readyTargets: 4,
	packages: [
		{ name: "a", version: "1.0.0", ready: true },
		{ name: "b", version: "2.0.0", ready: true },
	],
	sbomOk: true,
	sbomSummary: "3 builds covered",
	resolvedSbomConfig: new Map(),
	sbomConfigSource: { source: "none" as const },
};

const inputs = (over: Partial<ValidationCheckInputs> = {}): ValidationCheckInputs => ({
	linkedIssueCount: 2,
	linkIssuesUrl: "https://gh/link",
	buildPassed: true,
	buildErrors: "",
	buildCheckId: 11,
	buildUrl: "https://gh/build",
	publish: HEALTHY,
	strictWarnings: false,
	...over,
});

const finding = (over: Partial<ValidationFinding> = {}): ValidationFinding => ({
	severity: "error",
	check: "Publish Validation",
	scope: null,
	message: "boom",
	...over,
});

const rowNamed = (state: ReturnType<typeof deriveValidationChecks>, name: string) =>
	state.rows.find((r) => r.name === name);
const resultNamed = (state: ReturnType<typeof deriveValidationChecks>, name: string) =>
	state.results.find((r) => r.name === name);

describe("CHECK_NAMES", () => {
	it("is the join key between a finding and its check, not a label list", () => {
		// `deriveCheckConclusion` filters on `finding.check === name`, so a row
		// renamed without renaming the finding that targets it silently detaches
		// the two: the conclusion goes green while the finding still shows in the
		// JSON. Pinned verbatim.
		expect([...CHECK_NAMES]).toEqual([
			"Link Issues from Commits",
			"Build Validation",
			"Publish Validation",
			"Release Notes Preview",
			"SBOM Preview",
		]);
	});

	it("names every row the derivation produces, in order", () => {
		const state = deriveValidationChecks(inputs());

		expect(state.rows.map((r) => r.name)).toEqual([...CHECK_NAMES]);
		expect(state.results.map((r) => r.name)).toEqual([...CHECK_NAMES]);
	});
});

describe("findings", () => {
	it("puts the build finding first, then the publish ones", () => {
		const own = finding({ check: "SBOM Preview", severity: "warning" });
		const state = deriveValidationChecks(
			inputs({ buildPassed: false, buildErrors: "tsc exploded", publish: { ...HEALTHY, findings: [own] } }),
		);

		expect(state.findings).toEqual([
			{ severity: "error", check: "Build Validation", scope: null, message: "tsc exploded" },
			own,
		]);
	});

	it("falls back to a generic message when the build produced no stderr", () => {
		const state = deriveValidationChecks(inputs({ buildPassed: false, buildErrors: "   \n  " }));

		expect(state.findings[0]?.message).toBe("Build failed");
	});

	it("raises no build finding when the build passed", () => {
		const state = deriveValidationChecks(inputs({ buildPassed: true }));

		expect(state.findings).toEqual([]);
	});
});

describe("conclusionFor", () => {
	it("cascades failure onto build-dependent checks when the build failed", () => {
		const state = deriveValidationChecks(inputs({ buildPassed: false }));

		expect(state.conclusionFor("Publish Validation")).toBe("failure");
		expect(state.conclusionFor("Release Notes Preview")).toBe("failure");
		expect(state.conclusionFor("SBOM Preview")).toBe("failure");
	});

	it("spares the two build-independent checks from the cascade", () => {
		const state = deriveValidationChecks(inputs({ buildPassed: false }));

		// Link Issues runs before the build and has its own criteria; Build
		// Validation reports its own error finding rather than cascading onto
		// itself.
		expect(state.conclusionFor("Link Issues from Commits")).toBe("success");
		expect(state.conclusionFor("Build Validation")).toBe("failure");
	});

	it("returns neutral for an advisory warning", () => {
		const state = deriveValidationChecks(
			inputs({ publish: { ...HEALTHY, findings: [finding({ severity: "warning" })] } }),
		);

		expect(state.conclusionFor("Publish Validation")).toBe("neutral");
	});

	it("escalates that warning to failure under strict-warnings", () => {
		const state = deriveValidationChecks(
			inputs({ strictWarnings: true, publish: { ...HEALTHY, findings: [finding({ severity: "warning" })] } }),
		);

		expect(state.conclusionFor("Publish Validation")).toBe("failure");
	});
});

describe("results — what the unified check consumes", () => {
	it("reports every check passed on a clean run", () => {
		const state = deriveValidationChecks(inputs());

		expect(state.results.every((r) => r.success)).toBe(true);
	});

	it("fails the publish row on a hard publish failure even without a finding", () => {
		// `publishOk` is a separate signal from the findings: a dry-run can fail
		// without producing a scoped finding, and the row must still flip.
		const state = deriveValidationChecks(inputs({ publish: { ...HEALTHY, publishOk: false } }));

		expect(resultNamed(state, "Publish Validation")?.success).toBe(false);
	});

	it("keeps an advisory warning green, and flips it under strict-warnings", () => {
		const warned = { ...HEALTHY, findings: [finding({ severity: "warning" })] };

		expect(resultNamed(deriveValidationChecks(inputs({ publish: warned })), "Publish Validation")?.success).toBe(true);
		expect(
			resultNamed(deriveValidationChecks(inputs({ publish: warned, strictWarnings: true })), "Publish Validation")
				?.success,
		).toBe(false);
	});

	it("CHARACTERIZATION — the Build row bypasses the strict-warnings rule", () => {
		// ⚠️ Every other row is `successFor(name)`; this one is the raw
		// `buildPassed` boolean. So a WARNING scoped to "Build Validation" under
		// strict-warnings concludes `failure` on the check run while this row still
		// reads `true`.
		//
		// Unreachable today — the only finding ever scoped to this check is the
		// error raised when `buildPassed` is false — so this is latent, not live.
		// Pinned rather than fixed: routing it through `successFor` is a behaviour
		// change.
		const state = deriveValidationChecks(
			inputs({
				buildPassed: true,
				strictWarnings: true,
				publish: { ...HEALTHY, findings: [finding({ check: "Build Validation", severity: "warning" })] },
			}),
		);

		expect(state.conclusionFor("Build Validation")).toBe("failure");
		expect(resultNamed(state, "Build Validation")?.success).toBe(true);
	});

	it("CHARACTERIZATION — checkId is write-only", () => {
		// ⚠️ `createValidationCheck` reads only `name`, `success` and `message` off
		// these rows. `checkId` is required by `ValidationResult` and never read:
		// four rows hardcode `0` — including Link Issues, which HAS a real check id
		// available — and only Build passes a real one through. Pinned so removing
		// the field later is a deliberate change to a shared type.
		const state = deriveValidationChecks(inputs({ buildCheckId: 11 }));

		expect(resultNamed(state, "Build Validation")?.checkId).toBe(11);
		expect(resultNamed(state, "Link Issues from Commits")?.checkId).toBe(0);
		expect(resultNamed(state, "Publish Validation")?.checkId).toBe(0);
	});

	it("says 'No targets' rather than 0/0", () => {
		const state = deriveValidationChecks(inputs({ publish: { ...HEALTHY, totalTargets: 0, readyTargets: 0 } }));

		expect(resultNamed(state, "Publish Validation")?.message).toBe("No targets");
	});
});

describe("rows — the 3-state checks table", () => {
	it("marks a row error on an error finding, warning on a warning, pass otherwise", () => {
		const errored = deriveValidationChecks(inputs({ publish: { ...HEALTHY, findings: [finding()] } }));
		const warned = deriveValidationChecks(
			inputs({ publish: { ...HEALTHY, findings: [finding({ severity: "warning" })] } }),
		);
		const clean = deriveValidationChecks(inputs());

		expect(rowNamed(errored, "Publish Validation")?.status).toBe("error");
		expect(rowNamed(warned, "Publish Validation")?.status).toBe("warning");
		expect(rowNamed(clean, "Publish Validation")?.status).toBe("pass");
	});

	it("marks a hard failure error even with no finding scoped to it", () => {
		const state = deriveValidationChecks(inputs({ publish: { ...HEALTHY, publishOk: false, sbomOk: false } }));

		expect(rowNamed(state, "Publish Validation")?.status).toBe("error");
		expect(rowNamed(state, "SBOM Preview")?.status).toBe("error");
	});

	it("CHARACTERIZATION — the icon ignores strict-warnings while the conclusion honours it", () => {
		// ⚠️ Looks inconsistent, and is DELIBERATE: `derive-check-conclusion.ts`'s
		// header states that under strict mode the JSON severity and the
		// checks-table icon are unchanged and only the check-run conclusion flips,
		// so a branch-protection gate can act on warnings without rewriting what a
		// human reads. Pinned with the citation so it is not "fixed" into agreement.
		const state = deriveValidationChecks(
			inputs({ strictWarnings: true, publish: { ...HEALTHY, findings: [finding({ severity: "warning" })] } }),
		);

		expect(rowNamed(state, "Publish Validation")?.status).toBe("warning");
		expect(state.conclusionFor("Publish Validation")).toBe("failure");
	});

	it("turns the empty-string URL sentinel into null", () => {
		// `""` is the kit's "check run could not be created" value — `CheckRunRef.url`
		// is `raw.html_url ?? ""` — and must not reach the output as an empty link.
		const state = deriveValidationChecks(inputs({ linkIssuesUrl: "", buildUrl: "" }));

		expect(rowNamed(state, "Link Issues from Commits")?.url).toBeNull();
		expect(rowNamed(state, "Build Validation")?.url).toBeNull();
	});

	it("leaves the three later rows without a URL until their checks exist", () => {
		const state = deriveValidationChecks(inputs());

		expect(rowNamed(state, "Publish Validation")?.url).toBeNull();
		expect(rowNamed(state, "Release Notes Preview")?.url).toBeNull();
		expect(rowNamed(state, "SBOM Preview")?.url).toBeNull();
	});
});

describe("summaryLine", () => {
	it("reports a clean run as all-passed", () => {
		expect(deriveValidationChecks(inputs()).summaryLine).toBe("Release validation: ✅ 5/5 checks passed");
	});

	it("names the failed checks when some did not pass", () => {
		const state = deriveValidationChecks(inputs({ buildPassed: false, buildErrors: "nope" }));

		// Build fails, and the cascade takes the three build-dependent rows with it.
		expect(state.summaryLine).toBe(
			"Release validation: ❌ 1/5 checks passed — failed: Build Validation, Publish Validation, Release Notes Preview, SBOM Preview",
		);
	});
});

describe("applyCheckUrls", () => {
	it("fills the three later rows and leaves the first two alone", () => {
		const state = deriveValidationChecks(inputs());
		const rows = applyCheckUrls(state.rows, { publish: "https://p", releaseNotes: "https://r", sbom: "https://s" });

		expect(rows.find((r) => r.name === "Publish Validation")?.url).toBe("https://p");
		expect(rows.find((r) => r.name === "Release Notes Preview")?.url).toBe("https://r");
		expect(rows.find((r) => r.name === "SBOM Preview")?.url).toBe("https://s");
		expect(rows.find((r) => r.name === "Link Issues from Commits")?.url).toBe("https://gh/link");
		expect(rows.find((r) => r.name === "Build Validation")?.url).toBe("https://gh/build");
	});

	it("keeps the existing value when a check run could not be created", () => {
		// `""` means "no check run", not "blank the link".
		const state = deriveValidationChecks(inputs());
		const rows = applyCheckUrls(state.rows, { publish: "", releaseNotes: "", sbom: "" });

		expect(rows.find((r) => r.name === "Publish Validation")?.url).toBeNull();
		expect(rows.find((r) => r.name === "Link Issues from Commits")?.url).toBe("https://gh/link");
	});

	it("does not mutate the rows it was given", () => {
		const state = deriveValidationChecks(inputs());
		applyCheckUrls(state.rows, { publish: "https://p", releaseNotes: "https://r", sbom: "https://s" });

		expect(rowNamed(state, "Publish Validation")?.url).toBeNull();
	});
});

describe("CHARACTERIZATION — savvy-web/silk-release-action#216", () => {
	it("reports a fully GREEN phase when the publish validation crashed", () => {
		// ⚠️ THIS PINS A BUG. The crash path hands back
		// `SKIPPED_PUBLISH_VALIDATION` while the build genuinely PASSED, so
		// `deriveCheckConclusion`'s cascade — gated on `!buildPassed` — never fires,
		// and the baseline contributes no findings for it to fire on.
		//
		// Result: no publish dry-run ran, no SBOM check ran, and the release PR
		// gets ✅ 5/5 with every row `pass`.
		const state = deriveValidationChecks(inputs({ buildPassed: true, publish: SKIPPED_PUBLISH_VALIDATION }));

		expect(state.findings).toEqual([]);
		expect(state.results.every((r) => r.success)).toBe(true);
		expect(state.rows.every((r) => r.status === "pass")).toBe(true);
		expect(state.summaryLine).toBe("Release validation: ✅ 5/5 checks passed");
	});

	it("is not rescued by strict-warnings", () => {
		// There is no warning to escalate, so the strictest available setting still
		// reports green. Worth pinning separately: "turn on strict-warnings" is the
		// obvious wrong fix.
		const state = deriveValidationChecks(
			inputs({ buildPassed: true, strictWarnings: true, publish: SKIPPED_PUBLISH_VALIDATION }),
		);

		expect(state.results.every((r) => r.success)).toBe(true);
	});

	it("DOES report red when the build failed — the case the baseline was written for", () => {
		// The contrast that explains why the baseline is `publishOk: true` and why
		// flipping it is the wrong fix: with `buildPassed: false` the cascade covers
		// every downstream row, and the same baseline reports correctly.
		const state = deriveValidationChecks(inputs({ buildPassed: false, publish: SKIPPED_PUBLISH_VALIDATION }));

		expect(resultNamed(state, "Publish Validation")?.success).toBe(false);
		expect(resultNamed(state, "SBOM Preview")?.success).toBe(false);
	});
});
