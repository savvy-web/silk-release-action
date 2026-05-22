/**
 * Silk publishability detector layers — re-exported from `@savvy-web/silk-effects`.
 *
 * The silk rules and the adaptive (ignore-aware) `PublishabilityDetector` override
 * now live in the shared library; this module remains as the stable local import
 * path. Both layers require a platform `FileSystem` (provided by the action's
 * `NodeFileSystem`).
 *
 * @module release/publishability
 */

export { PublishabilityDetectorAdaptiveLive, SilkPublishabilityDetectorLive } from "@savvy-web/silk-effects";
