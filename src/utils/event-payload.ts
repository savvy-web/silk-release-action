// The webhook event payload, decoded once through a schema rather than parsed
// and cast at each call site.
//
// Two modules previously hand-rolled the same read: resolve GITHUB_EVENT_PATH,
// read the file, `JSON.parse`, cast to a local interface. `ActionEnvironment`
// already exposes the parsed payload (`payload: Effect<unknown,
// ActionEnvironmentError>`), so the file read and the parse are the kit's
// problem; what is left is deciding which fields we trust, which is a schema's
// job and not a cast's.

import { ActionEnvironment } from "@effected/github-actions";
import { Effect, Option, Schema } from "effect";

/**
 * The pull request an event carries, projected to the fields this action reads.
 *
 * @public
 */
export const EventPullRequest = Schema.Struct({
	number: Schema.Number,
	merged: Schema.optional(Schema.Boolean),
	head: Schema.optional(Schema.Struct({ ref: Schema.String })),
	base: Schema.optional(Schema.Struct({ ref: Schema.String })),
});

/**
 * The webhook event payload, projected to the fields this action reads.
 *
 * @remarks
 * **Excess properties are ignored and stripped**, which is what makes a schema
 * safe to point at a real payload. A `pull_request` event carries dozens of
 * fields; decoding keeps only those declared here. Verified by probe against
 * the installed `effect` rather than assumed — a strict struct would have
 * failed on every real event and taken phase detection down with it.
 *
 * @public
 */
export const EventPayload = Schema.Struct({
	pull_request: Schema.optional(EventPullRequest),
	head_commit: Schema.optional(Schema.Struct({ message: Schema.optional(Schema.String) })),
});

/**
 * The decoded event payload type.
 *
 * @public
 */
export type EventPayload = typeof EventPayload.Type;

const decodeEventPayload = Schema.decodeUnknownResult(EventPayload);

/**
 * Read and decode the webhook event payload.
 *
 * @remarks
 * Degrades to an empty payload rather than failing. Every caller asks "does the
 * event carry X", and "no event file" (running outside a webhook trigger),
 * "unreadable event file" and "payload without X" are the same answer at every
 * call site. The distinction is logged rather than typed, because no caller
 * branches on it.
 *
 * @returns The decoded payload, or an empty one when the event is absent or
 *   does not match.
 *
 * @public
 */
export const readEventPayload = (): Effect.Effect<EventPayload, never, ActionEnvironment> =>
	Effect.gen(function* () {
		const environment = yield* ActionEnvironment;

		const raw = yield* Effect.result(environment.payload);
		if (raw._tag === "Failure") {
			yield* Effect.logDebug(`No readable event payload: ${raw.failure.message}`);
			return {} as EventPayload;
		}

		const decoded = decodeEventPayload(raw.success);
		if (decoded._tag === "Failure") {
			yield* Effect.logDebug(`Event payload did not match the expected shape: ${decoded.failure}`);
			return {} as EventPayload;
		}

		return decoded.success;
	});

/**
 * The pull request number carried by the event, when there is one.
 *
 * @returns The PR number, or `Option.none()` when the event carries no pull
 *   request.
 *
 * @public
 */
export const readEventPullRequestNumber = (): Effect.Effect<Option.Option<number>, never, ActionEnvironment> =>
	readEventPayload().pipe(Effect.map((payload) => Option.fromNullishOr(payload.pull_request?.number)));
