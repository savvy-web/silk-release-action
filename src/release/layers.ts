/**
 * Release orchestration layer.
 *
 * Composes workspace discovery / topological sorting from `workspaces-effect`
 * with the silk `ChangesetConfig` service, the adaptive
 * `PublishabilityDetector` override (silk rules in silk mode, library defaults
 * in vanilla mode, no-op in none mode), and the silk-effects native
 * versioning services (`Changesets.ReleasePlanner` / `Changesets.ConfigInspector`).
 *
 * @module release/layers
 */

import { ChangesetConfigReaderLive, Changesets } from "@savvy-web/silk-effects";
import { Layer } from "effect";
import { WorkspacesLive } from "workspaces-effect";
import { ChangesetConfigLive } from "./changeset-config.js";
import { PublishabilityDetectorAdaptiveLive } from "./publishability.js";

/**
 * Native-versioning layer: silk-effects ReleasePlanner + ConfigInspector,
 * self-contained above WorkspaceDiscovery/FileSystem (FileSystem comes from
 * the NodeContext provided in main.ts).
 */
const NativeVersioningLive = Changesets.ReleasePlannerLive.pipe(
	Layer.provideMerge(Changesets.ConfigInspectorLive),
	Layer.provide(ChangesetConfigReaderLive),
	Layer.provide(WorkspacesLive),
);

/**
 * Release-orchestration layer: workspace discovery / topological sorting from
 * `workspaces-effect`, plus the silk `ChangesetConfig`, the adaptive
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
