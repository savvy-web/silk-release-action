/**
 * Did *this release's* merge close a given issue?
 *
 * @remarks
 * **The question issue #259 exists to answer.** `close-linked-issues` closes a
 * linked issue and then posts a courtesy comment. When the close succeeds but
 * the comment fails persistently, the issue ends closed with no comment — and a
 * re-run cannot recover it, because the already-`CLOSED` skip exits before the
 * comment is attempted.
 *
 * The obvious repair — drop the skip and lean on the marker for idempotence —
 * is wrong, and wrong in the worse direction. `GitHubIssue.linkedIssues`
 * returns linked issues *regardless of state*, so an issue closed manually or
 * by an earlier release is indistinguishable, from state alone, from one caught
 * in the failed-comment window. Commenting unconditionally posts "Closed by
 * release PR #N merge." on issues that merge did not close: a **false claim**,
 * strictly worse than a missing courtesy comment.
 *
 * So attribution is the mechanism. `closedByPullRequestsReferences` is GitHub's
 * own answer to "which pull requests closed this issue", which makes it exactly
 * the predicate the recovery needs and not a proxy for it.
 *
 * **Failure degrades to `false`, deliberately.** An unavailable or unreadable
 * answer must not be read as attribution — the caller then skips, which is the
 * pre-existing behaviour. The cost of a wrong `false` is the missing comment
 * this module exists to reduce; the cost of a wrong `true` is a false claim on
 * someone else's issue. Those are not symmetric.
 *
 * The document is built here rather than taken from `@effected/github` because
 * the kit ships no closed-by member; `GraphQLDocument` is the kit's stated
 * extension point for exactly this, so the query still arrives decoded and
 * still fails inside the one `GitHubGraphQLError` taxonomy.
 */

import type { GitHubGraphQLError } from "@effected/github";
import { GitHubClient, GraphQLDocument, Repo } from "@effected/github";
import { Effect, Schema } from "effect";

/**
 * How many closing pull requests are read per issue.
 *
 * @remarks
 * An issue closed by more than a handful of pull requests is already unusual;
 * twenty is generous cover with one page and no pagination loop. An issue that
 * somehow exceeds it and whose release PR sorts past the cut degrades to "not
 * attributable" — the safe direction, per the module remarks.
 */
const MAX_CLOSING_PRS = 20;

const ClosedByResponse = Schema.Struct({
	repository: Schema.NullOr(
		Schema.Struct({
			issue: Schema.NullOr(
				Schema.Struct({
					closedByPullRequestsReferences: Schema.NullOr(
						Schema.Struct({
							nodes: Schema.NullOr(Schema.Array(Schema.NullOr(Schema.Struct({ number: Schema.Number })))),
						}),
					),
				}),
			),
		}),
	),
});

/**
 * The pull requests GitHub says closed an issue.
 *
 * @remarks
 * `includeClosedPrs: true` is not optional for this use: by the time this runs
 * the release PR is **merged**, and without the flag GitHub omits it from the
 * connection — the query would answer "nothing closed this" for every issue it
 * is asked about, which reads as a total failure of attribution rather than the
 * argument default it is.
 *
 * Every level is nullable on the wire (a deleted issue, a repository the token
 * cannot see, a connection GitHub declines to expand), so the schema admits
 * `null` at each hop rather than failing to decode a legitimately empty answer.
 *
 * @internal
 */
const ClosedByPullRequests = GraphQLDocument.make({
	name: "closedByPullRequests",
	document: `
		query closedByPullRequests($owner: String!, $repo: String!, $issue: Int!) {
			repository(owner: $owner, name: $repo) {
				issue(number: $issue) {
					closedByPullRequestsReferences(first: ${MAX_CLOSING_PRS}, includeClosedPrs: true) {
						nodes { number }
					}
				}
			}
		}
	`,
	response: ClosedByResponse,
})<{ readonly owner: string; readonly repo: string; readonly issue: number }>();

/**
 * Did pull request `prNumber` close issue `issueNumber`?
 *
 * @remarks
 * The whole point is that a `false` here is never the basis for a claim — it
 * only withholds one. See the module remarks for why the asymmetry decides the
 * failure posture.
 *
 * @param issueNumber - The issue whose closure is in question.
 * @param prNumber - The release pull request claiming to have closed it.
 * @returns `true` only when GitHub names `prNumber` among the issue's closers.
 *
 * @internal
 */
export const wasClosedByPullRequest = (
	issueNumber: number,
	prNumber: number,
): Effect.Effect<boolean, GitHubGraphQLError, GitHubClient | Repo> =>
	Effect.gen(function* () {
		const client = yield* GitHubClient;
		const { owner, repo } = yield* Repo;

		const answer = yield* client.graphql(ClosedByPullRequests, { owner, repo, issue: issueNumber });
		const nodes = answer.repository?.issue?.closedByPullRequestsReferences?.nodes ?? [];
		return nodes.some((node) => node?.number === prNumber);
	});

/**
 * {@link wasClosedByPullRequest}, with every failure collapsed to `false`.
 *
 * @remarks
 * The form callers actually want: attribution is an *enabling* signal for a
 * courtesy comment, never a gate on the release, so a query that fails must not
 * fail the phase around it. A warning is logged so the degradation is visible
 * rather than silent.
 *
 * @param issueNumber - The issue whose closure is in question.
 * @param prNumber - The release pull request claiming to have closed it.
 * @returns `true` only on a successful, affirmative answer.
 *
 * @internal
 */
export const wasClosedByPullRequestOrFalse = (
	issueNumber: number,
	prNumber: number,
): Effect.Effect<boolean, never, GitHubClient | Repo> =>
	wasClosedByPullRequest(issueNumber, prNumber).pipe(
		Effect.catch((error) =>
			Effect.logWarning(
				`Could not attribute the closure of issue #${issueNumber} to PR #${prNumber}: ${error.reason ?? String(error)}`,
			).pipe(Effect.as(false)),
		),
	);
