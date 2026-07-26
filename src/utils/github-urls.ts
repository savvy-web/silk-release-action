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
 * A link to a release, by tag.
 *
 * @public
 */
export const releaseTagUrl = (serverUrl: string, owner: string, repo: string, tag: string): string =>
	`${serverUrl}/${owner}/${repo}/releases/tag/${tag}`;

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
