// The single declaration point for every `action.yml` output.
//
// The counterpart to `schema/inputs.ts`. `__test__/schema-outputs.test.ts`
// parses the manifest, scans what `src/` actually writes, and holds both
// against the tuples below.
//
// This action's output topology genuinely differs from the single-emit
// template shape, and the split here is that difference made explicit rather
// than papered over: `token` / `installation-id` / `app-slug` are produced by
// the PRE phase (only `pre.ts` holds a freshly minted installation token), and
// the rest by the MAIN phase. One `emitOutputs` covering all twelve would have
// to lie about which process can produce which.

import type { ActionOutputError, ActionOutputsShape } from "@effected/github-actions";
import { Effect } from "effect";
import { ReleaseOutput } from "./release-output.js";

/**
 * Outputs the PRE phase publishes.
 *
 * @public
 */
export const PRE_OUTPUT_NAMES = ["token", "installation-id", "app-slug"] as const;

/**
 * The MAIN-phase scalar outputs — everything the fold below owns.
 *
 * @remarks
 * Excludes `result`, which is Schema-encoded through `ActionOutputs.setJson`
 * and tolerates its own encode failure, so it is emitted beside these rather
 * than folded with them. {@link OUTPUT_NAMES} re-joins the three sets, and the
 * suite asserts they partition it exactly — so `result` cannot go missing by
 * being everyone else's responsibility.
 *
 * @public
 */
export const MAIN_SCALAR_OUTPUT_NAMES = [
	"phase",
	"status",
	"succeeded",
	"package-count",
	"release-pr-number",
	"closed-issues-count",
	"failed-issues-count",
	"closed-issues",
] as const;

/**
 * The structured, Schema-encoded output.
 *
 * @public
 */
export const STRUCTURED_OUTPUT_NAME = "result";

/**
 * Every `action.yml` output name, verbatim.
 *
 * @public
 */
export const OUTPUT_NAMES = [...PRE_OUTPUT_NAMES, STRUCTURED_OUTPUT_NAME, ...MAIN_SCALAR_OUTPUT_NAMES] as const;

/**
 * A single `action.yml` output name.
 *
 * @public
 */
export type OutputName = (typeof OUTPUT_NAMES)[number];

/**
 * The MAIN-phase scalar outputs, typed.
 *
 * @public
 */
export interface MainScalarOutputs {
	readonly phase: string;
	readonly status: string;
	readonly succeeded: boolean;
	readonly packageCount: number;
	/** `null` renders as `""` — "no PR involved", distinct from PR zero. */
	readonly releasePrNumber: number | null;
	readonly closedIssuesCount: number;
	readonly failedIssuesCount: number;
	readonly closedIssues: ReadonlyArray<unknown>;
}

/**
 * All-disabled defaults: the baseline a run starts from before any phase
 * contributes.
 *
 * @remarks
 * The pipeline FOLDS phase results over this baseline, so an output whose
 * phase did not run reports its default rather than being absent — and a
 * failure path can emit exactly this value, so a consuming workflow always
 * reads every declared output.
 *
 * `status: "no-op"` rather than `""` because the manifest documents the status
 * vocabulary as `no-op | success | partial | failed`, and a run that did
 * nothing IS a no-op; an empty string would be a thirteenth, undocumented
 * value.
 *
 * @public
 */
export const initialMainScalarOutputs: MainScalarOutputs = {
	phase: "none",
	status: "no-op",
	succeeded: true,
	packageCount: 0,
	releasePrNumber: null,
	closedIssuesCount: 0,
	failedIssuesCount: 0,
	closedIssues: [],
};

/**
 * Publishes every MAIN-phase scalar output exactly once.
 *
 * @remarks
 * Takes the `ActionOutputs` shape as a parameter rather than resolving the
 * service, matching the existing `emitReleaseOutput` in `main.ts` that this is
 * staged to absorb.
 *
 * @param outputs - The `ActionOutputs` service instance.
 * @param model - The folded scalar outputs to publish.
 *
 * @public
 */
export const emitMainScalarOutputs = (
	outputs: ActionOutputsShape,
	model: MainScalarOutputs,
): Effect.Effect<void, ActionOutputError> =>
	Effect.gen(function* () {
		yield* outputs.set("phase", model.phase);
		yield* outputs.set("status", model.status);
		yield* outputs.set("succeeded", model.succeeded ? "true" : "false");
		yield* outputs.set("package-count", String(model.packageCount));
		yield* outputs.set("release-pr-number", model.releasePrNumber === null ? "" : String(model.releasePrNumber));
		yield* outputs.set("closed-issues-count", String(model.closedIssuesCount));
		yield* outputs.set("failed-issues-count", String(model.failedIssuesCount));
		yield* outputs.set("closed-issues", JSON.stringify(model.closedIssues));
	});

/**
 * Emit a {@link ReleaseOutput} as the structured `result` action output plus
 * the five convenience scalars. `result` is Schema-encoded; the scalars mirror
 * the most-wanted facts so a consumer need not parse JSON.
 *
 * @remarks
 * Lives here rather than in `format.ts`: this writes the machine-readable
 * output contract, and `format.ts` is reserved for human-readable rendering.
 * `emitMainScalarOutputs` above is the all-phases fold this is staged to be
 * absorbed into; until the phase projections produce a single folded
 * {@link MainScalarOutputs}, the two coexist and the suite holds both against
 * the manifest.
 *
 * @param outputs - The `ActionOutputs` service instance.
 * @param output - The phase-projected release output to emit.
 * @param scalars - The convenience scalar values for this phase. `packageCount`
 *   is the count of packages relevant to this phase — the changeset count for
 *   branch-management, the validated-package count for validation, and the
 *   total published-package count for publishing — so its meaning differs per
 *   phase.
 *
 * @public
 */
export const emitReleaseOutput = (
	outputs: ActionOutputsShape,
	output: ReleaseOutput,
	scalars: { readonly packageCount: number; readonly releasePrNumber: number | null },
): Effect.Effect<void, ActionOutputError> =>
	Effect.gen(function* () {
		yield* outputs
			.setJson("result", output, ReleaseOutput)
			.pipe(
				Effect.catch((e) =>
					Effect.logWarning(`Failed to emit structured "result" output: ${e instanceof Error ? e.message : String(e)}`),
				),
			);
		yield* outputs.set("phase", output.phase);
		// The scalar `status`/`succeeded` outputs are a separate, coarser contract
		// from the JSON `result` — they exist so a shell step can branch without
		// jq, and `action.yml` declares them by those names. Every phase now
		// carries the same `success` + `outcome` pair, so this reads one field per
		// scalar with no per-phase branch: `status` carries the phase's own
		// outcome vocabulary, which is strictly more informative than the four
		// shared labels it replaced.
		yield* outputs.set("status", output.outcome);
		yield* outputs.set("succeeded", output.success ? "true" : "false");
		yield* outputs.set("package-count", String(scalars.packageCount));
		yield* outputs.set("release-pr-number", scalars.releasePrNumber === null ? "" : String(scalars.releasePrNumber));
	});
