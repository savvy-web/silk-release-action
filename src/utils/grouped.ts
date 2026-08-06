/**
 * Run an effect inside a collapsible GitHub Actions log group.
 *
 * @module utils/grouped
 */

import { ActionLogger } from "@effected/github-actions";
import { Effect } from "effect";

/**
 * Run an effect inside a collapsible log group, resolving `ActionLogger` itself.
 *
 * @remarks
 * The drop-in shape of the predecessor's `Step.groupStep`, minus the step
 * envelope. `Step.groupStep` wrapped its body in **both** a group and a step,
 * and the step existed to make a success line land inside the group; the kit's
 * `group` needs no such pairing, so the phase bodies emit their own summary
 * lines and there is nothing left for a step to add.
 *
 * @param name - The group heading shown in the runner UI.
 * @param effect - The body to run inside the group.
 *
 * @public
 */
export const grouped = <A, E, R>(name: string, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R | ActionLogger> =>
	Effect.flatMap(ActionLogger, (logger) => logger.group(name, effect));
