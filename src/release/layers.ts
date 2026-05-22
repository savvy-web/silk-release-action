/**
 * Release orchestration layer.
 *
 * Composes workspace discovery / topological sorting from `workspaces-effect`
 * with the silk `ChangesetConfig` service and the adaptive
 * `PublishabilityDetector` override (silk rules in silk mode, library defaults
 * in vanilla mode, no-op in none mode).
 *
 * @module release/layers
 */

import { Layer } from "effect";
import { WorkspacesLive } from "workspaces-effect";

import { ChangesetConfigLive } from "./changeset-config.js";
import { PublishabilityDetectorAdaptiveLive } from "./publishability.js";

/**
 * Release-orchestration layer: workspace discovery / topological sorting from
 * `workspaces-effect`, plus the silk `ChangesetConfig` and the adaptive
 * `PublishabilityDetector` override (silk rules in silk mode).
 */
export const ReleaseLive = Layer.mergeAll(
	WorkspacesLive,
	ChangesetConfigLive,
	PublishabilityDetectorAdaptiveLive.pipe(Layer.provide(ChangesetConfigLive)),
);
