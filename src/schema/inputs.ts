// The single decode point for every `action.yml` input.
//
// `action.yml` is the source of truth for input NAMES and DEFAULTS; this
// module mirrors both, and `__test__/schema-inputs.test.ts` asserts the two
// never drift. The check has three legs — the manifest, the `INPUT_NAMES`
// tuple, and what the code actually reads — because any two agreeing while
// the third drifts is exactly how a dead read (`build-command`) and an
// unimplemented input (`custom-registries`) both survived for months.
//
// WIRED. `main` decodes once here and hands the record down; the phase bodies
// and the branch-flow modules take what they need as values. `release-branch`
// went from six call sites each restating `"changeset-release/main"` to one.
//
// Two rules keep it that way, both enforced by `__test__/schema-inputs.test.ts`:
// an input is read here and nowhere else (bar a short allowlist with stated
// reasons — `pre` is a separate process, `auto-merge.ts` is a definition site),
// and `dry-run` is decoded here ONLY to build `DryRun`, which every consumer
// then asks instead of re-reading the input.

import { ActionInput } from "@effected/github-actions";
import type { Redacted } from "effect";
import { Config, Effect, Option, Schema } from "effect";
import type { AutoMergeMethod } from "../utils/auto-merge.js";
import { autoMergeMethodConfig } from "../utils/auto-merge.js";
import type { CustomRegistryAuth } from "../utils/custom-registries.js";
import { parseCustomRegistries } from "../utils/custom-registries.js";
import type { WorkflowPhase } from "../utils/detect-workflow-phase.js";

/**
 * The `action.yml` input names, verbatim, as a const tuple.
 *
 * @remarks
 * Names-as-data: this tuple is what makes "the code and `action.yml` declare
 * the same inputs" a test rather than a convention. Listed in manifest
 * declaration order; the sync test compares as sets, so order is presentation
 * only.
 *
 * @public
 */
export const INPUT_NAMES = [
	"app-client-id",
	"app-private-key",
	"github-token",
	"release-branch",
	"target-branch",
	"auto-merge",
	"dry-run",
	"phase",
	"npm-token",
	"strict-warnings",
	"sbom-config",
	"custom-registries",
	"on-build",
] as const;

/**
 * A single `action.yml` input name.
 *
 * @public
 */
export type InputName = (typeof INPUT_NAMES)[number];

/**
 * The accepted `phase` values.
 *
 * @remarks
 * Decoded rather than cast. `main.ts` currently does
 * `explicitInput as WorkflowPhase`, which accepts any string the workflow
 * writes and routes a typo to the default no-op arm — a silent skip of the
 * whole run. Decoding fails typed instead, naming the accepted set.
 */
const WorkflowPhaseSchema = Schema.Literals([
	"branch-management",
	"validation",
	"publishing",
	"close-issues",
	"none",
]) satisfies Schema.Codec<WorkflowPhase, string>;

/**
 * The two branch names a release flow works between.
 *
 * @remarks
 * A structural subset of {@link Inputs}, so a phase that already holds the
 * decoded record passes it straight through — no destructure-and-rebuild at
 * every call site, and no way for the two names to be reordered into each
 * other, which two bare `string` parameters invite.
 *
 * The point is that a module taking this **cannot** read the inputs itself:
 * its branch names arrive from the one decode in {@link readInputs}, which is
 * what stops a second copy of `"changeset-release/main"` appearing here.
 *
 * @public
 */
export interface BranchRefs {
	readonly releaseBranch: string;
	readonly targetBranch: string;
}

/**
 * The fully decoded, typed shape of all `action.yml` inputs.
 *
 * @public
 */
export interface Inputs extends BranchRefs {
	/** GitHub App client id. Required; absence fails the decode. */
	readonly appClientId: string;
	/** GitHub App private key (PEM). Required; absence fails the decode. */
	readonly appPrivateKey: Redacted.Redacted<string>;
	/**
	 * The workflow's own `GITHUB_TOKEN`, for GitHub Packages. Empty when omitted.
	 *
	 * @remarks
	 * **Decoded here and read by nothing in this process, deliberately.** The
	 * consumer runs in the `pre` process, which cannot be handed `main`'s
	 * record: `pre.ts` reads the input itself and persists it to
	 * `GithubPackagesTokenState`, and `release/publish.ts` takes it from there.
	 *
	 * The field cannot simply be dropped. `action.yml` declares the input, so
	 * the manifest leg of the sync test puts it in {@link INPUT_NAMES}, and the
	 * second leg asserts `readInputs` reads *exactly* that set — removing the
	 * decode fails `should be exactly the set readInputs reads`. Verified by
	 * doing it: one test goes red.
	 *
	 * So this is a mirror of the manifest rather than dead weight, which is the
	 * distinction between it and the `build-command` read this action removed —
	 * that one was declared nowhere and could never be set by any workflow.
	 */
	readonly githubToken: string;
	/** Auto-merge method, or `None` when disabled. */
	readonly autoMerge: Option.Option<AutoMergeMethod>;
	/** Rehearse without mutating. */
	readonly dryRun: boolean;
	/** Explicit phase override, or `None` for auto-detection. */
	readonly phase: Option.Option<WorkflowPhase>;
	/** npm access token, for a first publish or an OIDC fallback. Empty when omitted. */
	readonly npmToken: string;
	/** Escalate warning-severity findings to check-run failures. */
	readonly strictWarnings: boolean;
	/** SBOM metadata JSON. Empty when omitted. */
	readonly sbomConfig: string;
	/**
	 * Optional command run after the validation build, or `None` when unset.
	 *
	 * @remarks
	 * `Option` rather than a bare string because the blank case is not a command:
	 * a caller plumbing an unset workflow input through writes
	 * `on-build: ${{ inputs.on-build }}`, which passes `""`. Modelling that as
	 * `Some("")` would spawn an empty command on every release in every repo that
	 * plumbs the input through, so the trim-to-none happens once here rather than
	 * at each call site.
	 */
	readonly onBuild: Option.Option<string>;
	/**
	 * Custom registry auth, parsed: one registry URL + `Redacted` token per line.
	 *
	 * @remarks
	 * WIRED (issue #215). The auth implementation was lost in the publish-chain
	 * migration (#90) and the input spent four minor releases as a silent
	 * no-op; it now reaches Phase-3 publishing — `steps/publishing.ts` hands it
	 * to `runPublishTargets`, which routes each token through `pickToken` into
	 * `PackagePublish.setupAuth`'s npmrc write. A malformed line fails the
	 * decode here, typed, rather than silently configuring nothing.
	 */
	readonly customRegistries: ReadonlyArray<CustomRegistryAuth>;
}

/**
 * The raw decode of every input.
 *
 * @remarks
 * Through `ActionInput` accessors so the `INPUT_` mangling and the
 * empty-string-is-absent rule stay owned by `@effected/github-actions` rather
 * than reimplemented here. Every default mirrors `action.yml` — that file is
 * the single source of truth, and the sync test keeps this mirror honest.
 *
 * `app-client-id` and `app-private-key` carry NO default: they are
 * `required: true` in the manifest, and a missing credential must fail the job
 * rather than proceed toward an unauthenticated API call.
 */
const loadInputs: Config.Config<Inputs> = Config.all({
	appClientId: ActionInput.string("app-client-id"),
	appPrivateKey: ActionInput.redacted("app-private-key"),
	githubToken: ActionInput.string("github-token").pipe(Config.withDefault("")),
	releaseBranch: ActionInput.string("release-branch").pipe(Config.withDefault("changeset-release/main")),
	targetBranch: ActionInput.string("target-branch").pipe(Config.withDefault("main")),
	autoMerge: autoMergeMethodConfig,
	dryRun: ActionInput.boolean("dry-run").pipe(Config.withDefault(false)),
	phase: ActionInput.string("phase").pipe(
		Config.withDefault(""),
		Config.mapOrFail((raw) => {
			const value = raw.trim();
			if (value === "") return Effect.succeedNone;
			return Schema.decodeUnknownEffect(WorkflowPhaseSchema)(value).pipe(
				Effect.map(Option.some),
				Effect.mapError((error) => new Config.ConfigError(error)),
			);
		}),
	),
	npmToken: ActionInput.string("npm-token").pipe(Config.withDefault("")),
	strictWarnings: ActionInput.boolean("strict-warnings").pipe(Config.withDefault(false)),
	sbomConfig: ActionInput.string("sbom-config").pipe(Config.withDefault("")),
	onBuild: ActionInput.string("on-build").pipe(
		Config.withDefault(""),
		Config.map((raw) => {
			const value = raw.trim();
			return value === "" ? Option.none<string>() : Option.some(value);
		}),
	),
	customRegistries: ActionInput.lines("custom-registries").pipe(
		Config.withDefault([]),
		Config.mapOrFail(parseCustomRegistries),
	),
});

/**
 * Decodes every input, exactly once, at the top of a phase.
 *
 * @remarks
 * There is deliberately **no `InputError`**. Every failure this can raise is a
 * `ConfigError` already — a missing required credential, a malformed boolean,
 * an unrecognised `auto-merge` method or `phase` value — and the kit's rule is
 * that an error channel with no constructor site does not go in the signature.
 * Add one here only alongside a cross-field rule that can actually fire, with
 * a test that fires it.
 *
 * A malformed boolean fails rather than silently defaulting: `Config.withDefault`
 * applies when an input is ABSENT, not when it is present-but-malformed.
 *
 * @public
 */
export const readInputs: Effect.Effect<Inputs, Config.ConfigError> = loadInputs;
