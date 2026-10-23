/**
 * Run an effect inside a collapsible GitHub Actions log group — at most one
 * deep.
 *
 * @remarks
 * GitHub Actions has **no nested groups**. A second `##[group]` implicitly ends
 * the one already open, so the outer group renders as an empty header, the
 * inner content lands at the top level, and the outer `##[endgroup]` is stray.
 * `ActionLogger.group` in `@effected/github-actions` does not track nesting —
 * filed upstream as spencerbeggs/effected#1059. Until the kit ships that,
 * {@link grouped} tracks "a group is open" in a fiber-scoped
 * `Context.Reference` and degrades a nested call to a plain header line. Once
 * #1059 lands, {@link grouped} collapses back to `logger.group` and
 * {@link GroupOpen} is deleted.
 *
 * {@link headed} is the other half: a phase-level wrapper that encloses further
 * groups prints a header line instead of opening a group, so the groups inside
 * it are the top level the runner can actually render.
 *
 * Every log group in `src/` goes through this module; a direct
 * `logger.group(` call would bypass the nesting check.
 *
 * @module utils/grouped
 */

import { ActionLogger } from "@effected/github-actions";
import { Context, Effect } from "effect";

/**
 * Whether a log group is open on the current fiber.
 *
 * @remarks
 * Fiber-scoped: {@link grouped} provides `true` to its body only, so the flag
 * clears itself when the group closes and concurrent fibers forked inside a
 * group inherit it. Delete with spencerbeggs/effected#1059.
 *
 * @internal
 */
export const GroupOpen: Context.Reference<boolean> = Context.Reference<boolean>(
	"silk-release-action/utils/grouped/GroupOpen",
	{ defaultValue: () => false },
);

/**
 * The plain line a nested group or a {@link headed} wrapper prints in place of a
 * group command.
 *
 * @internal
 */
const header = (name: string): Effect.Effect<void> => Effect.logInfo(`▸ ${name}`);

/**
 * Run an effect inside a collapsible log group, resolving `ActionLogger` itself.
 *
 * @remarks
 * When no group is open this is `ActionLogger.group`. When one is already open
 * (GitHub Actions cannot nest them), the body runs inside the enclosing group
 * under a plain `▸ name` header line instead. See the module docs and
 * spencerbeggs/effected#1059.
 *
 * @param name - The group heading shown in the runner UI.
 * @param effect - The body to run inside the group.
 * @returns The body's result.
 *
 * @public
 */
export const grouped = <A, E, R>(name: string, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R | ActionLogger> =>
	Effect.gen(function* () {
		if (yield* GroupOpen) {
			yield* header(name);
			return yield* effect;
		}
		const logger = yield* ActionLogger;
		return yield* logger.group(name, Effect.provideService(effect, GroupOpen, true));
	});

/**
 * Run an effect under a plain header line, opening no group.
 *
 * @remarks
 * For phase-level wrappers that enclose further {@link grouped} calls: a group
 * here would swallow every inner group into a plain header (see the module
 * docs), so the banner is a line and the inner groups stay top level.
 *
 * @param name - The header text.
 * @param effect - The body to run beneath it.
 * @returns The body's result.
 *
 * @public
 */
export const headed = <A, E, R>(name: string, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
	Effect.andThen(header(name), effect);
