// Release orchestration layer.
//
// Composes workspace discovery / topological sorting from `@effected/workspaces`
// with the silk `ChangesetConfig` service, the adaptive
// `PublishabilityDetector` override (silk rules in silk mode, library defaults
// in vanilla mode, no-op in none mode), and the silk-effects native
// versioning services (`Changesets.ReleasePlanner` / `Changesets.ConfigInspector`).

import { Workspaces } from "@effected/workspaces";
import { ChangesetConfigReader, Changesets, SilkPublishability } from "@savvy-web/silk-effects";
import { Layer } from "effect";
import { ChangesetConfigLive } from "./changeset-config.js";

/**
 * The workspace graph (`WorkspaceDiscovery`, `PublishabilityDetector`, and the
 * rest of `WorkspacesServices`), root-bound at build time to `process.cwd()`.
 *
 * @remarks
 * `layerWithGit` rather than `layer`: it adds `Git`, `WorkspaceSnapshots` and
 * `ChangeDetector` for the same `FileSystem | Path | ChildProcessSpawner` the
 * git-free form already required. `Git` is what Phase-2 reads the target
 * branch's `.changeset` directory with instead of shelling out, and
 * `WorkspaceSnapshots` is how it will read versions off that branch without a
 * checkout.
 *
 * `Workspaces.layerWithGit` is a parameterized factory that mints a fresh
 * reference per call and layers memoize by reference, so it is bound to a
 * single `const` and reused across every composition site below.
 */
const WorkspacesLive = Workspaces.layerWithGit();

/**
 * The project-local command launcher, derived from the SAME workspace graph.
 *
 * @remarks
 * `Workspaces.localExecLayer()` requires `PackageManagerDetector | WorkspaceRoot`
 * and asks the detected manager what its run-a-local-tool argv looks like, so
 * `NpmExecutor.dlx` resolves to (e.g.) `pnpm dlx npm@11` in a pnpm workspace and
 * to the npm equivalent in an npm one. It replaces the static
 * `LocalExec.layerFor("pnpm", { directory: process.cwd() })` that
 * `layers/app.ts` used to mint, which asserted pnpm regardless of what the
 * workspace actually is.
 *
 * **It is built HERE, beside {@link WorkspacesLive}, and deliberately not in
 * `layers/app.ts`.** Layers memoize by reference, and `layerWithGit` is a
 * parameterized factory: a second call — or the same const re-piped, which
 * `main.ts` does to `ReleaseLive` — mints a fresh reference and therefore a
 * SECOND workspace graph. Two `WorkspaceDiscovery` instances mean two
 * filesystem scans and two answers that can disagree between the publish path
 * and the release path. Constructing `LocalExec` against this const is what
 * keeps there being exactly one.
 *
 * `layers/app.ts` consequently *requires* `LocalExec` rather than providing it,
 * and `MainLive` satisfies that requirement from this layer.
 */
const LocalExecLive = Workspaces.localExecLayer().pipe(Layer.provide(WorkspacesLive));

/**
 * Native-versioning layer: silk-effects ReleasePlanner + ConfigInspector,
 * self-contained above WorkspaceDiscovery/FileSystem (the platform
 * FileSystem/Path layers are provided in main.ts).
 */
const NativeVersioningLive = Changesets.ReleasePlanner.layer.pipe(
	Layer.provideMerge(Changesets.ConfigInspector.layer),
	Layer.provide(ChangesetConfigReader.layer),
	Layer.provide(WorkspacesLive),
);

/**
 * Release-orchestration layer: workspace discovery / topological sorting from
 * `@effected/workspaces`, plus the silk `ChangesetConfig`, the adaptive
 * `PublishabilityDetector` override (silk rules in silk mode), and the
 * native-versioning services from `NativeVersioningLive`.
 */
// ChangesetConfigLive is listed twice: directly (for Phase-2/3 consumers that
// yield* ChangesetConfig) and as the provider for SilkPublishability.layerAdaptive.
// Effect memoizes identical layer references — one instantiation serves both slots.
export const ReleaseLive = Layer.mergeAll(
	WorkspacesLive,
	LocalExecLive,
	ChangesetConfigLive,
	SilkPublishability.layerAdaptive.pipe(Layer.provide(ChangesetConfigLive)),
	NativeVersioningLive,
);
