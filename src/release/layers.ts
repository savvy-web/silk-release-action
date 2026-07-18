/**
 * Release orchestration layer.
 *
 * Composes workspace discovery / topological sorting from `@effected/workspaces`
 * with the silk `ChangesetConfig` service, the adaptive
 * `PublishabilityDetector` override (silk rules in silk mode, library defaults
 * in vanilla mode, no-op in none mode), and the silk-effects native
 * versioning services (`Changesets.ReleasePlanner` / `Changesets.ConfigInspector`).
 *
 * @module release/layers
 */

import { Workspaces } from "@effected/workspaces";
import { ChangesetConfigReaderLive, Changesets } from "@savvy-web/silk-effects";
import { Layer } from "effect";
import { ChangesetConfigLive } from "./changeset-config.js";
import { PublishabilityDetectorAdaptiveLive } from "./publishability.js";

/**
 * The git-free workspace graph (`WorkspaceDiscovery`, `PublishabilityDetector`,
 * and the rest of `WorkspacesServices`), root-bound at build time to
 * `process.cwd()`. `Workspaces.layer` is a parameterized factory that mints a
 * fresh reference per call and layers memoize by reference, so it is bound to a
 * single `const` and reused across every composition site below.
 */
const WorkspacesLive = Workspaces.layer();

/**
 * Native-versioning layer: silk-effects ReleasePlanner + ConfigInspector,
 * self-contained above WorkspaceDiscovery/FileSystem (the platform
 * FileSystem/Path layers are provided in main.ts).
 */
const NativeVersioningLive = Changesets.ReleasePlannerLive.pipe(
	Layer.provideMerge(Changesets.ConfigInspectorLive),
	Layer.provide(ChangesetConfigReaderLive),
	Layer.provide(WorkspacesLive),
);

/**
 * Release-orchestration layer: workspace discovery / topological sorting from
 * `@effected/workspaces`, plus the silk `ChangesetConfig`, the adaptive
 * `PublishabilityDetector` override (silk rules in silk mode), and the
 * native-versioning services from `NativeVersioningLive`.
 */
// ChangesetConfigLive is listed twice: directly (for Phase-2/3 consumers that
// yield* ChangesetConfig) and as the provider for PublishabilityDetectorAdaptiveLive.
// Effect memoizes identical layer references — one instantiation serves both slots.
export const ReleaseLive = Layer.mergeAll(
	WorkspacesLive,
	ChangesetConfigLive,
	PublishabilityDetectorAdaptiveLive.pipe(Layer.provide(ChangesetConfigLive)),
	NativeVersioningLive,
);
