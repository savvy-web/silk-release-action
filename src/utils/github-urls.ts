// Web URLs into the GitHub instance the run is executing against.
//
// Every one of these was a hardcoded `https://github.com`, which is wrong on
// GitHub Enterprise Server: the links resolved to the public site rather than
// the instance that holds the repository. They are gathered here so the host is
// decided once, and so a new link cannot be added without confronting where the
// host comes from.
//
// The functions are pure and take the host explicitly rather than reading the
// environment, because half of them are called from helpers that have no
// `ActionEnvironment` in scope and threading a value is cheaper than widening
// those signatures with a service.

import { ActionEnvironment } from "@effected/github-actions";
import { Effect, Option } from "effect";

/** The public instance, used when the runner names no other. */
export const DEFAULT_SERVER_URL = "https://github.com";

/**
 * The GitHub instance this run is executing against.
 *
 * @remarks
 * Read through `getOptional` rather than the `GitHubContext` projection: the
 * projection fails typed when any `GITHUB_*` is missing, and a missing server
 * URL has a **correct default** rather than a failure — only GHES sets it, so
 * on github.com it is legitimately absent.
 *
 * A trailing slash is stripped so callers can join with `/` unconditionally.
 *
 * @returns The instance's base URL, without a trailing slash.
 *
 * @public
 */
export const resolveServerUrl = (): Effect.Effect<string, never, ActionEnvironment> =>
	Effect.gen(function* () {
		const environment = yield* ActionEnvironment;
		const raw = Option.getOrElse(yield* environment.getOptional("GITHUB_SERVER_URL"), () => DEFAULT_SERVER_URL);
		const trimmed = raw.trim();
		if (trimmed === "") return DEFAULT_SERVER_URL;
		return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
	});

/**
 * A link to an issue.
 *
 * @public
 */
export const issueUrl = (serverUrl: string, owner: string, repo: string, issueNumber: number): string =>
	`${serverUrl}/${owner}/${repo}/issues/${issueNumber}`;

/**
 * A link to a commit.
 *
 * @public
 */
export const commitUrl = (serverUrl: string, owner: string, repo: string, sha: string): string =>
	`${serverUrl}/${owner}/${repo}/commit/${sha}`;

/**
 * A link to a pull request.
 *
 * @public
 */
export const pullRequestUrl = (serverUrl: string, owner: string, repo: string, prNumber: number): string =>
	`${serverUrl}/${owner}/${repo}/pull/${prNumber}`;

/**
 * A link to a workflow run.
 *
 * @public
 */
export const workflowRunUrl = (serverUrl: string, owner: string, repo: string, runId: string): string =>
	`${serverUrl}/${owner}/${repo}/actions/runs/${runId}`;

/**
 * Percent-encode a tag for use in a URL path, per path segment.
 *
 * @remarks
 * Deliberately NOT `encodeURIComponent(tag)`. Monorepo tags are scoped —
 * `@scope/pkg@1.0.0` — and GitHub's own canonical `html_url` for such a release
 * encodes the `@` but leaves the `/` as a **real path separator**:
 *
 * ```text
 * @changesets/cli@2.31.1
 *   → /releases/tag/%40changesets/cli%402.31.1
 * ```
 *
 * (Verified against the Releases API for `changesets/changesets` and
 * `chakra-ui/chakra-ui`.) Encoding the whole tag would emit `%2F` instead and
 * no longer match the URL GitHub itself publishes; leaving it raw emits a bare
 * `@`, which resolves but is not the canonical form. Encoding each segment
 * gives exactly what GitHub gives.
 */
const encodeTagPath = (tag: string): string => tag.split("/").map(encodeURIComponent).join("/");

/**
 * A link to a release, by tag.
 *
 * @param serverUrl - The GitHub server origin, e.g. `https://github.com`.
 * @param owner - The repository owner.
 * @param repo - The repository name.
 * @param tag - The release tag; scoped monorepo tags are encoded per segment.
 * @returns The canonical release URL.
 *
 * @public
 */
export const releaseTagUrl = (serverUrl: string, owner: string, repo: string, tag: string): string =>
	`${serverUrl}/${owner}/${repo}/releases/tag/${encodeTagPath(tag)}`;

/**
 * A link to an organisation's npm package page on GitHub Packages.
 *
 * @remarks
 * The path is scope-less — GitHub Packages addresses `@scope/name` as `name`.
 *
 * @public
 */
export const orgPackagePageUrl = (serverUrl: string, owner: string, packageName: string): string => {
	const unscoped = packageName.startsWith("@") ? (packageName.split("/")[1] ?? packageName) : packageName;
	return `${serverUrl}/orgs/${owner}/packages/npm/package/${unscoped}`;
};

/**
 * A link to a published package artifact on GitHub Packages.
 *
 * @public
 */
export const packageArtifactUrl = (serverUrl: string, owner: string, unscopedName: string): string =>
	`${serverUrl}/${owner}/pkgs/npm/${unscopedName}`;

/**
 * A commit-URL builder for the repository this run is executing against.
 *
 * @remarks
 * Bundles the two reads a linked sha needs — the instance and the `owner/repo`
 * slug — so a caller wanting to link a commit does not repeat them. Returns a
 * plain function rather than an Effect so it can be handed to pure renderers.
 *
 * @returns A function from sha to its commit URL.
 *
 * @public
 */
export const resolveCommitLinker = (): Effect.Effect<(sha: string) => string, never, ActionEnvironment> =>
	Effect.gen(function* () {
		const environment = yield* ActionEnvironment;
		const serverUrl = yield* resolveServerUrl();
		const slug = Option.getOrElse(yield* environment.getOptional("GITHUB_REPOSITORY"), () => "");
		const [owner = "", repo = ""] = slug.split("/");
		return (sha: string) => commitUrl(serverUrl, owner, repo, sha);
	});
