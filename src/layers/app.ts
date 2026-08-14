// Application layer composition.
//
// The orchestration graph for the main action. Everything here is a kit
// service; no domain services exist yet.
//
// **What is deliberately absent.** `ActionEnvironment`, `ActionLogger`,
// `ActionOutputs`, `ActionState`, `NodeServices` and an `HttpClient` all come
// from `ActionRuntime` via `Action.run`. Because `ActionRunOptions.layer` is
// `Layer<R, never, ActionServices>`, this layer may *require* any of them
// rather than rebuild them — which is why there is no `ActionState.layer` or
// `ActionOutputs.layer` below, and why the platform is never mentioned except
// where a non-runtime service needs it.

import { NodeServices } from "@effect/platform-node";
import { LocalExec, ToolDiscovery } from "@effected/commands";
import type { GitHubClient } from "@effected/github";
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
import type { ActionEnvironment, ActionState } from "@effected/github-actions";
import { ActionsIdentityToken, DryRun, GitHubToken, OidcTokenIssuer } from "@effected/github-actions";
import { NpmRegistry, PackagePublish } from "@effected/npm";
import { SigstoreSigner } from "@effected/sbom";
import { Effect, Layer } from "effect";
import type { HttpClient } from "effect/unstable/http";
import { FetchHttpClient } from "effect/unstable/http";
import { ReleaseLive } from "../release/layers.js";
import { readInputs } from "../schema/inputs.js";

/**
 * Everything {@link makeAppLayer} provides.
 *
 * @remarks
 * Named so the export can carry an explicit type — and so a reader sees the
 * whole provision surface in one place instead of deriving it from the merge.
 *
 * @public
 */
export type AppServices =
	| ArtifactMetadata
	| Attestation
	| CheckRun
	| DryRun
	| GitBranch
	| GitCommit
	| GitHubClient
	| GitHubCommit
	| GitHubContent
	| GitHubIssue
	| GitHubRelease
	| GitHubRepository
	| GitTag
	| HttpClient.HttpClient
	| NpmRegistry
	| OidcTokenIssuer
	| PackagePublish
	| PullRequest
	| PullRequestComment
	| Repo
	| SigstoreSigner
	| NodeServices.NodeServices;

/**
 * What {@link makeAppLayer} requires — `ActionEnvironment` and `ActionState`
 * from `ActionRuntime`, `LocalExec` from the release layer's workspace graph,
 * and an `HttpClient`.
 *
 * @public
 */
export type AppRequirements = ActionEnvironment | ActionState | HttpClient.HttpClient | LocalExec;

/* v8 ignore start -- pure Layer wiring, exercised indirectly by the modules that consume it */

/**
 * Build the application layer.
 *
 * @param dryRun - The resolved `dry-run` input. Passed as a value rather than
 *   read here so the layer stays free of config reads and a test can drive both
 *   branches without a `ConfigProvider`.
 * @returns The composed domain layer, requiring only what `ActionRuntime`
 *   provides plus the release layer's `LocalExec`.
 *
 * @public
 */
export const makeAppLayer = (dryRun: boolean): Layer.Layer<AppServices, never, AppRequirements> => {
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
	// resolves to `pnpm dlx npm@11` through that launcher. A dlx executor with no
	// launcher fails typed rather than silently falling back to the runner's
	// bundled npm 10.x, which cannot do OIDC trusted publishing.
	//
	// `LocalExec` is REQUIRED here, not built here. It comes from
	// `Workspaces.localExecLayer()` in `release/layers.ts`, bound against the one
	// `WorkspacesLive` const — a `LocalExec.layerFor("pnpm", …)` minted here would
	// both hardcode pnpm and, if it were made workspace-aware in place, mint a
	// second workspace graph (layers memoize by reference, and `main.ts` re-pipes
	// `ReleaseLive`, so even exporting the const would not be enough). Requiring
	// it is what keeps the publish path and the release path reading one graph.
	const packagePublish = PackagePublish.layer.pipe(Layer.provide(NodeServices.layer));

	// `PackageManagerDetector` and `Git` are likewise REQUIRED rather than built:
	// `Workspaces.layerWithGit()` already provides both from the same graph.
	// Building a second `PackageManagerDetector.layer` / `Git.layer` here only
	// produced instances that `Layer.mergeAll` then shadowed with the release
	// layer's.
	//
	// Every git operation this action performs is now a kit member — the raw
	// `ChildProcess` commands that used to sit at the call sites (`clean`,
	// `branch -D`, `checkout -b <new> <start>`, `checkout -- .`, `rev-parse
	// --is-shallow-repository`, `fetch --unshallow`) are gone, answered by
	// `@effected/git` 0.6's `clean`, `branchDelete`, `branchCreate`, `restore`,
	// `isShallow` and `fetchUnshallow`.

	const oidc = OidcTokenIssuer.layer;
	const sigstore = SigstoreSigner.layer.pipe(Layer.provide(ActionsIdentityToken.layer.pipe(Layer.provide(oidc))));

	return Layer.mergeAll(
		githubClient,
		repo,
		githubResources,
		npmRegistry,
		packagePublish,
		oidc,
		sigstore,
		// The subprocess seam `Run` needs, plus FileSystem/Path for later phases.
		NodeServices.layer,
		FetchHttpClient.layer,
		DryRun.layerFrom(dryRun),
	);
};

/**
 * `formatWorkspaceWithBiome` probes for the standalone Biome binary through
 * `ToolDiscovery`. `LocalExec.layerNone` is the documented wiring for a GitHub
 * Action — every tool resolves globally on PATH, with no project-local
 * launcher. Deliberately NOT the workspace-aware launcher `makeAppLayer` gives
 * `PackagePublish`: that one exists so `NpmExecutor.dlx` can fetch a pinned
 * npm, which is a different question from "is biome installed".
 *
 * Self-contained on purpose — it provides its own `LocalExec` internally and
 * exports none, so composing it beside `makeAppLayer` cannot shadow the
 * workspace-aware launcher the publish path needs.
 */
const toolDiscovery = ToolDiscovery.layer.pipe(Layer.provide(Layer.merge(NodeServices.layer, LocalExec.layerNone)));

/**
 * The release-domain layer, platform-provided and fatal-on-construction-error.
 *
 * @remarks
 * `ReleaseLive` is piped exactly ONCE, here. A differently-piped value is a
 * different layer reference and would build a second workspace graph — which is
 * why `LocalExec` is constructed inside `release/layers.ts` against the same
 * const rather than derived from this pipe.
 */
const releaseLive = ReleaseLive.pipe(Layer.provide(NodeServices.layer), Layer.orDie);

/**
 * The main action's domain layer.
 *
 * @remarks
 * `ActionRuntime` — injected by `Action.run` — provides `ActionEnvironment`,
 * `ActionLogger`, `ActionOutputs`, `ActionState`, `NodeServices` and an
 * `HttpClient`. Because `ActionRunOptions.layer` is
 * `Layer<R, never, ActionServices>`, this layer may **require** any of them
 * rather than rebuild them.
 *
 * `Layer.provideMerge` rather than a flat `Layer.mergeAll`: `makeAppLayer` now
 * REQUIRES `LocalExec` (plus `Git` and `PackageManagerDetector` for its
 * consumers downstream), and `releaseLive` is what satisfies it. Merging keeps
 * the release-domain services on the output side, exactly as the flat merge
 * did — but with one workspace graph feeding both halves instead of two graphs
 * sitting side by side and shadowing each other.
 *
 * `dry-run` reaches `makeAppLayer` as a VALUE, decoded by `readInputs` at layer
 * construction — the layer itself stays free of config reads, so a test can
 * drive both branches without a `ConfigProvider`. Decoding through `readInputs`
 * rather than a second `ActionInput.boolean("dry-run")` here is what leaves the
 * entry point with zero direct input reads and `dry-run`'s default stated once,
 * in `action.yml` and its mirror. A malformed `dry-run` still fails rather than
 * silently defaulting to a REAL run, and `Layer.orDie` surfaces it at the
 * boundary.
 *
 * Everything downstream asks the `DryRun` SERVICE built from this value, never
 * the input again — one decode, one decision.
 *
 * @public
 */
export const MainLive: Layer.Layer<
	AppServices | ToolDiscovery | Layer.Success<typeof releaseLive>,
	never,
	ActionEnvironment | ActionState | HttpClient.HttpClient
> = Layer.unwrap(
	Effect.map(readInputs, (inputs) =>
		Layer.mergeAll(makeAppLayer(inputs.dryRun), toolDiscovery).pipe(Layer.provideMerge(releaseLive)),
	),
).pipe(Layer.orDie);

/* v8 ignore stop */
