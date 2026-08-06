// Tests for Phase 2's publish / release-notes / SBOM validation step.
//
// ⚠️ THESE ARE THE FIRST TESTS THIS CODE HAS EVER HAD. `steps/validation.ts`
// had ZERO coverage before C2 — replacing its entire phase body with
// `Effect.die` left the suite at 705/705 green. So these are CHARACTERIZATION
// tests: they encode what the code did on 2026-08-05, extracted verbatim from
// the twelve mutable `let` bindings that used to span the region, not what
// anybody designed it to do. Anything here that looks wrong probably is; it is
// pinned so a future change is deliberate rather than accidental.
//
// The one dependency, `runValidation` from `release/validation.ts`, is mocked
// at the module boundary. It declares eight services in its requirement channel
// and is separately tested in `src/release/validation.test.ts`; what is proven
// HERE is the step's own contract — the build gate, the two skip paths, the
// field-for-field mapping, and the log lines.

import { Effect, Layer, Logger } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deriveCheckConclusion } from "../src/utils/derive-check-conclusion.js";

const runValidationEffect = vi.hoisted(() => vi.fn());

vi.mock("../src/release/validation.js", () => ({ runValidation: runValidationEffect }));

const { SKIPPED_PUBLISH_VALIDATION, publishValidation } = await import("../src/steps/publish-validation.js");

/** A full `ValidationReport`, every field distinguishable from its default. */
const REPORT = {
	publishOk: false,
	npmReady: true,
	githubPackagesReady: true,
	totalTargets: 7,
	readyTargets: 3,
	hasVersionOnlyPackages: true,
	packages: [{ name: "@scope/one", version: "1.2.3", ready: true }],
	validationPackages: [{ name: "@scope/one" }],
	sbomOk: false,
	sbomSummary: "2 of 3 builds covered",
	findings: [{ severity: "warning", check: "SBOM Preview", scope: null, message: "no supplier" }],
	resolvedSbomConfig: new Map([["@scope/one:dist/npm", { supplier: "acme" }]]),
	// `ConfigSource` is an OBJECT, not the string union the old inline comment
	// in `validation.ts` claimed. Fixture corrected to the real shape.
	sbomConfigSource: { source: "local" as const, location: ".github/silk-release.json" },
};

const ARGS = { buildsPassed: true, packageManager: "pnpm", targetBranch: "main", dryRun: false };

/** Run the step, capturing every log line it emits alongside the result. */
const unwrap = async (args: Parameters<typeof publishValidation>[0]) => {
	const lines: Array<{ level: string; message: string }> = [];
	// `LogLevel` is a plain string union in Effect v4 — no `.label` accessor.
	const capture = Logger.make<unknown, void>((options) => {
		lines.push({ level: options.logLevel, message: String(options.message) });
	});
	const result = await Effect.runPromise(
		publishValidation(args).pipe(
			Effect.provide(Logger.layer([capture])),
			// The step's declared services are never reached: the build-gate path
			// returns before touching anything, and the other two paths go through
			// the mocked module. Cast at the boundary rather than standing up eight
			// layers that would record nothing.
			Effect.provide(Layer.empty),
		) as Effect.Effect<PublishValidationResultShape>,
	);
	return { result, lines, text: lines.map((l) => l.message).join("\n") };
};

/** The step's own result shape, named so the cast above states what it means. */
type PublishValidationResultShape = typeof SKIPPED_PUBLISH_VALIDATION;

beforeEach(() => {
	runValidationEffect.mockReset();
});

describe("SKIPPED_PUBLISH_VALIDATION", () => {
	it("starts publishOk and sbomOk TRUE, so a skipped check does not double-count the build failure", () => {
		// This is the least obvious value in the file and it was previously
		// expressed only as two `let x = true` initialisers sixty lines apart from
		// the code that read them. A check that never ran has produced no failure
		// of its own; what fails the run is the build finding plus
		// `deriveCheckConclusion`'s build-failed cascade. Flipping these to `false`
		// would report the same failure twice.
		expect(SKIPPED_PUBLISH_VALIDATION.publishOk).toBe(true);
		expect(SKIPPED_PUBLISH_VALIDATION.sbomOk).toBe(true);
	});

	it("distinguishes never-ran from ran-and-found-nothing", () => {
		// `null`, not an empty Map / empty string: the SBOM Preview check summary
		// renders the two differently, and an empty map means "ran, resolved no
		// config" — a different fact from "never got there".
		expect(SKIPPED_PUBLISH_VALIDATION.resolvedSbomConfig).toBeNull();
		expect(SKIPPED_PUBLISH_VALIDATION.sbomConfigSource).toBeNull();
		expect(SKIPPED_PUBLISH_VALIDATION.sbomSummary).toBe("SBOM Preview skipped");
	});

	it("reports nothing released and no findings", () => {
		expect(SKIPPED_PUBLISH_VALIDATION.totalTargets).toBe(0);
		expect(SKIPPED_PUBLISH_VALIDATION.readyTargets).toBe(0);
		expect(SKIPPED_PUBLISH_VALIDATION.npmReady).toBe(false);
		expect(SKIPPED_PUBLISH_VALIDATION.githubPackagesReady).toBe(false);
		expect(SKIPPED_PUBLISH_VALIDATION.packages).toEqual([]);
		expect(SKIPPED_PUBLISH_VALIDATION.validationPackages).toEqual([]);
		expect(SKIPPED_PUBLISH_VALIDATION.findings).toEqual([]);
	});
});

describe("publishValidation — the build gate", () => {
	it("does not run the validation at all when the build failed", async () => {
		// The mock is ARMED, deliberately. If the gate is bypassed the step returns
		// REPORT's values and the assertion below fails on a VALUE; leaving the mock
		// unset would instead crash on `undefined.pipe`, which "kills the mutant"
		// only by accident and would not survive the mock gaining a default.
		runValidationEffect.mockReturnValue(Effect.succeed(REPORT));
		const { result, text } = await unwrap({ ...ARGS, buildsPassed: false });

		// The gate is the point: a failed build means the artifacts a dry-run would
		// inspect were never produced, so a dry-run failure would report the build's
		// fault as publishing's.
		expect(runValidationEffect).not.toHaveBeenCalled();
		expect(result).toEqual(SKIPPED_PUBLISH_VALIDATION);
		expect(text).toContain("Builds failed, skipping publish validation");
	});

	it("stays silent about publish, release notes and SBOM when the build failed", async () => {
		runValidationEffect.mockReturnValue(Effect.succeed(REPORT));
		const { text } = await unwrap({ ...ARGS, buildsPassed: false });

		// The three summary lines belong to a run that happened. Emitting them off
		// the defaults would announce "0/0 target(s) ready" for a step that never
		// started.
		expect(text).not.toContain("Publish validation");
		expect(text).not.toContain("Release notes");
		expect(text).not.toContain("SBOM preview");
	});

	it("passes the validation inputs through when the build passed", async () => {
		runValidationEffect.mockReturnValue(Effect.succeed(REPORT));
		await unwrap({ buildsPassed: true, packageManager: "yarn", targetBranch: "trunk", dryRun: true });

		// `buildsPassed` is the step's own gate and must NOT be forwarded — the
		// inner validation has no such parameter.
		expect(runValidationEffect).toHaveBeenCalledWith({
			packageManager: "yarn",
			targetBranch: "trunk",
			dryRun: true,
		});
	});
});

describe("publishValidation — mapping the report", () => {
	it("carries every field of the report through, verbatim", async () => {
		runValidationEffect.mockReturnValue(Effect.succeed(REPORT));
		const { result } = await unwrap(ARGS);

		// Field-for-field, because the code this replaces was twelve assignment
		// statements and a single transposed pair would have been invisible.
		expect(result.publishOk).toBe(false);
		expect(result.npmReady).toBe(true);
		expect(result.githubPackagesReady).toBe(true);
		expect(result.totalTargets).toBe(7);
		expect(result.readyTargets).toBe(3);
		expect(result.packages).toEqual(REPORT.packages);
		expect(result.validationPackages).toEqual(REPORT.validationPackages);
		expect(result.sbomOk).toBe(false);
		expect(result.sbomSummary).toBe("2 of 3 builds covered");
		expect(result.findings).toEqual(REPORT.findings);
		expect(result.resolvedSbomConfig).toBe(REPORT.resolvedSbomConfig);
		expect(result.sbomConfigSource).toEqual({ source: "local", location: ".github/silk-release.json" });
	});

	it("does not carry hasVersionOnlyPackages, which the phase body never reads", async () => {
		runValidationEffect.mockReturnValue(Effect.succeed(REPORT));
		const { result } = await unwrap(ARGS);

		// The report has thirteen fields; the phase consumed twelve. Pinning the
		// omission keeps the result type honest about what Phase 2 actually uses.
		expect(result).not.toHaveProperty("hasVersionOnlyPackages");
	});
});

describe("publishValidation — a validation that throws", () => {
	it("degrades to the skipped baseline rather than failing the phase", async () => {
		runValidationEffect.mockReturnValue(Effect.fail(new Error("workspace discovery exploded")));
		const { result } = await unwrap(ARGS);

		// The whole reason the error channel is `never`: a crashed validation is
		// worth a warning and a skipped report, not a dead release branch.
		expect(result).toEqual(SKIPPED_PUBLISH_VALIDATION);
	});

	it("logs the stack, not just the message", async () => {
		const boom = new Error("workspace discovery exploded");
		boom.stack = "Error: workspace discovery exploded\n    at somewhere.ts:42";
		runValidationEffect.mockReturnValue(Effect.fail(boom));
		const { text } = await unwrap(ARGS);

		// This is the only place a validation crash is visible at all, and the
		// message alone has repeatedly been too thin to locate the cause.
		expect(text).toContain("runValidation failed");
		expect(text).toContain("workspace discovery exploded");
		expect(text).toContain("at somewhere.ts:42");
	});

	it("CHARACTERIZATION — a crashed validation currently reports a GREEN phase", async () => {
		// ⚠️ THIS PINS A BUG. It is not a description of correct behaviour.
		//
		// The build-failed path is safe: `deriveCheckConclusion` cascades `failure`
		// onto every build-dependent row when `buildSuccess` is false, so the
		// `publishOk: true` baseline cannot make it look green. That cascade is
		// exactly why the baseline starts `true` — see the SKIPPED tests above.
		//
		// The validation-CRASHED path has no such protection. `buildSuccess` is
		// TRUE (the build really did pass), so the cascade never fires — and the
		// crash contributes NO findings for it to fire on.
		//
		// Asserted against the REAL crash-path result, not against
		// `SKIPPED_PUBLISH_VALIDATION` directly. That distinction is the whole
		// value of the test: the likeliest fix gives the crash path its own
		// finding while leaving the shared baseline alone, and a version of this
		// test that read the constant would sail straight past that fix.
		runValidationEffect.mockReturnValue(Effect.fail(new Error("workspace discovery exploded")));
		const { result } = await unwrap(ARGS);

		const buildPassed = true;
		const findings = [...result.findings];

		expect(findings).toEqual([]);
		expect(deriveCheckConclusion("Publish Validation", findings, buildPassed, false)).toBe("success");
		expect(deriveCheckConclusion("SBOM Preview", findings, buildPassed, false)).toBe("success");
		// And strict-warnings does not help — there is no warning to escalate.
		expect(deriveCheckConclusion("Publish Validation", findings, buildPassed, true)).toBe("success");

		// The phase body then computes `success: buildResult.success && publish.publishOk
		// && successFor(...)` for the Publish row, which is `true && true && true`.
		expect(buildPassed && result.publishOk).toBe(true);
		expect(result.sbomOk).toBe(true);

		// Net effect: `runValidation` throws, no publish dry-run and no SBOM check
		// ever runs, and Phase 2 reports "Release validation: ✅ 5/5 checks passed"
		// on the release PR. The only trace is one `logWarning` in the job log.
		//
		// The fix is NOT to flip the baseline — that would break the build-failed
		// path's double-counting. It is for the crash path to contribute an
		// error-severity finding, which is a behaviour change and therefore out of
		// scope for C2. Pinned here so the fix is deliberate and this test fails
		// loudly when it lands.
	});

	it("CHARACTERIZATION — the structured output disagrees with the green verdict", () => {
		// ⚠️ Same bug, second symptom. The baseline reports both registries NOT
		// ready while reporting publishing OK, so the emitted `result` JSON says
		// `npmReady: false` on the very run whose checks table says ✅. Internally
		// inconsistent, and the inconsistency is the only machine-readable hint
		// that the validation did not actually run.
		expect(SKIPPED_PUBLISH_VALIDATION.publishOk).toBe(true);
		expect(SKIPPED_PUBLISH_VALIDATION.npmReady).toBe(false);
		expect(SKIPPED_PUBLISH_VALIDATION.githubPackagesReady).toBe(false);
	});

	it("does NOT catch a defect — a crash still kills the phase", async () => {
		// `Effect.catch` handles the ERROR channel only, so the declared `E = never`
		// does not mean "cannot abort": a defect from `runValidation` propagates
		// straight through this step and out of the phase.
		//
		// Characterization, but this one looks RIGHT, and it is worth knowing it is
		// the only path on which a broken validation fails the run rather than
		// reporting green. A future "make the crash path safe" fix should be
		// careful not to swallow defects into the same silent-green hole.
		runValidationEffect.mockReturnValue(Effect.die(new Error("boom")));
		const exit = await Effect.runPromiseExit(
			publishValidation(ARGS).pipe(
				Effect.provide(Logger.layer([])),
				Effect.provide(Layer.empty),
			) as Effect.Effect<PublishValidationResultShape>,
		);

		expect(exit._tag).toBe("Failure");
	});

	it("still reports the three summary lines, off the baseline", async () => {
		runValidationEffect.mockReturnValue(Effect.fail(new Error("nope")));
		const { text } = await unwrap(ARGS);

		// Unlike the build-failed path, this one DID start — so it reports, and it
		// reports the defaults. That asymmetry is deliberate and was previously
		// implicit in where the log calls sat relative to the `if`.
		expect(text).toContain("✅ Publish validation — 0/0 target(s) ready");
		expect(text).toContain("✅ SBOM preview — SBOM Preview skipped");
	});
});

describe("publishValidation — the summary lines", () => {
	it("marks publish validation ❌ when the dry-runs did not all pass", async () => {
		runValidationEffect.mockReturnValue(Effect.succeed(REPORT));
		const { text } = await unwrap(ARGS);

		expect(text).toContain("❌ Publish validation — 3/7 target(s) ready");
	});

	it("marks publish validation ✅ when they did", async () => {
		runValidationEffect.mockReturnValue(Effect.succeed({ ...REPORT, publishOk: true }));
		const { text } = await unwrap(ARGS);

		expect(text).toContain("✅ Publish validation — 3/7 target(s) ready");
	});

	it("marks the SBOM preview ❌ independently of the publish verdict", async () => {
		// Two separate booleans; a single shared icon would be wrong in one of the
		// four combinations.
		runValidationEffect.mockReturnValue(Effect.succeed({ ...REPORT, publishOk: true, sbomOk: false }));
		const { text } = await unwrap(ARGS);

		expect(text).toContain("✅ Publish validation");
		expect(text).toContain("❌ SBOM preview — 2 of 3 builds covered");
	});

	it("counts release-notes packages off the publish package list", async () => {
		runValidationEffect.mockReturnValue(
			Effect.succeed({
				...REPORT,
				packages: [
					{ name: "a", version: "1", ready: true },
					{ name: "b", version: "2", ready: false },
				],
			}),
		);
		const { text } = await unwrap(ARGS);

		expect(text).toContain("✅ Release notes — 2 package(s) ready");
	});
});
