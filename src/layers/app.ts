/**
 * Application layer composition.
 *
 * @remarks
 * The orchestration graph for the main action. Everything here is a kit
 * service; no domain services exist yet.
 *
 * **What is deliberately absent.** `ActionEnvironment`, `ActionLogger`,
 * `ActionOutputs`, `ActionState`, `NodeServices` and an `HttpClient` all come
 * from `ActionRuntime` via `Action.run`. Because `ActionRunOptions.layer` is
 * `Layer<R, never, ActionServices>`, this layer may *require* any of them
 * rather than rebuild them — which is why there is no `ActionState.layer` or
 * `ActionOutputs.layer` below, and why the platform is never mentioned except
 * where a non-runtime service needs it.
 *
 * @module layers/app
 */

import { NodeServices } from "@effect/platform-node";
import { LocalExec } from "@effected/commands";
import {
	ArtifactMetadata,
	Attestation,
	CheckRun,
	GitBranch,
	GitCommit,
	GitHubCommit,
	GitHubContent,
	GitHubIssue,
	GitHubRelease,
	GitHubRepository,
	GitTag,
	PullRequest,
	PullRequestComment,
	Repo,
} from "@effected/github";
import { DryRun, GitHubToken, OidcTokenIssuer } from "@effected/github-actions";
import { NpmRegistry, PackagePublish } from "@effected/npm";
import { SigstoreSigner } from "@effected/sbom";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { IdentityTokenFromOidc } from "./identity-token.js";

/* v8 ignore start -- pure Layer wiring, exercised indirectly by the modules that consume it */

/**
 * Build the application layer.
 *
 * @param dryRun - The resolved `dry-run` input. Passed as a value rather than
 *   read here so the layer stays free of config reads and a test can drive both
 *   branches without a `ConfigProvider`.
 * @returns The composed domain layer, requiring only what `ActionRuntime`
 *   provides.
 *
 * @public
 */
export const makeAppLayer = (dryRun: boolean) => {
	// The App installation token is provisioned in `pre` and persisted to
	// `ActionState`; this reads it back and builds a client. No
	// `process.env.GITHUB_TOKEN` bridge. `ActionState` comes from the runtime, so
	// it is NOT rebuilt here. `Layer.orDie` turns a missing or expired token into
	// a fatal defect rather than a partial boot.
	const githubClient = GitHubToken.clientLayer().pipe(Layer.orDie);

	// The repository every resource call resolves against. `Repo` is required per
	// call rather than captured at construction — capturing it would make a
	// scoped `Repo.provide` silently do nothing. Read from `GITHUB_REPOSITORY`
	// through the ambient ConfigProvider.
	const repo = Repo.layerFromConfig().pipe(Layer.orDie);

	// GraphQL is a member of `GitHubClient` in the kit; there is no separate
	// GitHubGraphQL service to wire, and no combined "api base" layer.
	const githubResources = Layer.mergeAll(
		ArtifactMetadata.layer,
		Attestation.layer,
		CheckRun.layer,
		GitBranch.layer,
		GitCommit.layer,
		GitHubCommit.layer,
		GitHubContent.layer,
		GitHubIssue.layer,
		GitHubRelease.layer,
		GitHubRepository.layer,
		GitTag.layer,
		PullRequest.layer,
		PullRequestComment.layer,
	).pipe(Layer.provide(githubClient));

	// Registry reads are HTTP, not `npm view` subprocesses.
	const npmRegistry = NpmRegistry.layer.pipe(Layer.provide(FetchHttpClient.layer));

	// `PackagePublish` dispatches npm through `LocalExec`: `NpmExecutor.dlx`
	// resolves to `pnpm dlx npm@11` through this launcher. A dlx executor with no
	// launcher fails typed rather than silently falling back to the runner's
	// bundled npm 10.x, which cannot do OIDC trusted publishing.
	//
	// `LocalExec.layerFor` is the static launcher form. `@effected/workspaces`
	// ships a workspace-aware implementation (`Workspaces.localExecLayer`) that
	// detects the package manager from the workspace root; it is the better
	// choice once the workspace layers land in a later phase.
	const localExec = LocalExec.layerFor("pnpm", { directory: process.cwd() });
	const packagePublish = PackagePublish.layer.pipe(Layer.provide(Layer.mergeAll(localExec, NodeServices.layer)));

	const oidc = OidcTokenIssuer.layer;
	const sigstore = SigstoreSigner.layer.pipe(Layer.provide(IdentityTokenFromOidc.pipe(Layer.provide(oidc))));

	return Layer.mergeAll(
		githubClient,
		repo,
		githubResources,
		npmRegistry,
		packagePublish,
		oidc,
		sigstore,
		localExec,
		// The subprocess seam `Run` needs, plus FileSystem/Path for later phases.
		NodeServices.layer,
		FetchHttpClient.layer,
		DryRun.layerFrom(dryRun),
	);
};

/* v8 ignore stop */
