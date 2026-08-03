// Silk `ChangesetConfig` service — re-exported from `@savvy-web/silk-effects`.
//
// The implementation now lives in the shared library; this module remains as the
// stable local import path used across the action. `ChangesetConfigLive` is
// composed with the library's `ChangesetConfigReader` here so consumers only need
// to provide a platform `FileSystem` (the action provides `NodeServices`).

import { ChangesetConfig, ChangesetConfigReader } from "@savvy-web/silk-effects";
import { Layer } from "effect";

export type { ChangesetMode } from "@savvy-web/silk-effects";
export { ChangesetConfig };

/**
 * Live `ChangesetConfig`, composed with its `FileSystem`-backed reader. Requires
 * a platform `FileSystem` layer (e.g. `NodeFileSystem.layer`), provided by the
 * action's `MainLive`.
 */
export const ChangesetConfigLive = ChangesetConfig.layer.pipe(Layer.provide(ChangesetConfigReader.layer));
