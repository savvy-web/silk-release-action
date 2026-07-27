// Opt-in auto-merge for the release pull request.
//
// Off unless a workflow asks for it. Enabling auto-merge on a release PR means
// the next green check publishes packages, which is a decision about a
// repository's release posture and not one this action should make on a
// consumer's behalf.

import type { PullRequestInfo, Repo } from "@effected/github";
import { PullRequest } from "@effected/github";
import { ActionInput } from "@effected/github-actions";
import { Config, Effect, Option, Schema } from "effect";

/** How GitHub should merge the release PR once its checks pass. */
export type AutoMergeMethod = "merge" | "squash" | "rebase";

/**
 * The accepted values, as a schema.
 *
 * @remarks
 * A schema rather than an array membership test so the rejection carries a
 * `SchemaError` naming the allowed literals — which is what `ConfigError`
 * wraps, and what the runner prints. Hand-rolling the message would duplicate
 * the list in two places and let them drift.
 */
const AutoMergeMethodSchema = Schema.Literals(["merge", "squash", "rebase"]);

/**
 * The `auto-merge` input: a merge method, or `Option.none` when disabled.
 *
 * @remarks
 * An unrecognised value **fails** rather than quietly disabling. A workflow
 * that writes `auto-merge: sqush` wants auto-merge; treating the typo as "off"
 * leaves the release PR sitting open forever and looking like a bug in the
 * action. The failure names the value and the accepted set, and costs one line
 * to fix.
 *
 * Empty is the default and means off — that is the input's documented way to
 * disable it, not a mistake.
 *
 * @public
 */
export const autoMergeMethodConfig: Config.Config<Option.Option<AutoMergeMethod>> = ActionInput.string(
	"auto-merge",
).pipe(
	Config.withDefault(""),
	Config.mapOrFail((raw) => {
		const value = raw.trim();
		if (value === "") return Effect.succeedNone;
		return Schema.decodeUnknownEffect(AutoMergeMethodSchema)(value).pipe(
			Effect.map(Option.some),
			Effect.mapError((error) => new Config.ConfigError(error)),
		);
	}),
);

/**
 * Turn auto-merge on for the release pull request, when the input asks for it.
 *
 * @remarks
 * A failure to enable it is logged, not raised. Auto-merge has repository-level
 * prerequisites this action does not control — the setting has to be enabled,
 * and branch protection has to define the required checks. When they are
 * missing, the release itself succeeded and the pull request is there to be
 * merged by hand; failing the run would discard good work over a setting.
 *
 * The typo case is the opposite and is handled in {@link autoMergeMethodConfig},
 * where it fails before anything has been done.
 *
 * @param pullRequest - The release pull request, as returned by create/upsert.
 * @param dryRun - When `true`, report the intent and change nothing.
 *
 * @public
 */
export const applyAutoMerge = (
	pullRequest: PullRequestInfo,
	dryRun: boolean,
): Effect.Effect<void, Config.ConfigError, PullRequest | Repo> =>
	Effect.gen(function* () {
		const method = yield* autoMergeMethodConfig;
		if (Option.isNone(method)) return;

		if (dryRun) {
			yield* Effect.logInfo(`[DRY RUN] Would enable ${method.value} auto-merge on PR #${pullRequest.number}`);
			return;
		}

		const pulls = yield* PullRequest;
		yield* pulls.setAutoMerge(pullRequest, method.value).pipe(
			Effect.andThen(Effect.logInfo(`Auto-merge (${method.value}) enabled on PR #${pullRequest.number}`)),
			Effect.catch((e) =>
				Effect.logWarning(
					`Could not enable auto-merge on PR #${pullRequest.number}: ${e.reason}. ` +
						"The repository needs auto-merge enabled and branch protection with required status checks.",
				),
			),
		);
	});
