/**
 * Step: the snapshot phase. Publishes unreleased versions under a non-latest
 * dist-tag so a downstream can pin them from the registry.
 *
 * @remarks
 * **Explicit-only.** Nothing routes here but `phase: snapshot`, and
 * `detectWorkflowPhase` never returns it.
 *
 * **Stages:** refuse (tag, ref) → version (changesets snapshot, in the
 * working tree only) → build (`ci:build`, no SBOM) → publish (the Phase-3
 * target resolution, under the snapshot tag, skipping never-published
 * packages) → dangling-dependency check → emit.
 *
 * **Dangling dependencies are a finding, not a failure.** A published
 * package whose runtime dependency was bumped here but not published pins a
 * version no registry holds. Each pair is a logged warning and a job-summary
 * section; neither `success`, `outcome` nor the output schema changes.
 *
 * **Failure posture: fail-the-job, after emitting.** Every exit path, from a
 * refusal to a partial publish, first emits the `result` output and writes
 * the job summary, then raises {@link SnapshotError}. For a partial publish
 * that order is the point: the versions that DID land are facts a consumer
 * must be able to read and pin. The one degrading member is the job-summary
 * write. A failure there is a logged warning and changes neither `success`
 * nor the exit code, the same posture as `emitReleaseOutput`'s own `setJson`.
 *
 * **Never:** commits or pushes the version bump, creates a git tag, a GitHub
 * release, a release PR, closes issues, generates an SBOM, or writes a GitHub
 * attestation. npm's `--provenance`, as each target configures it, is the
 * only attestation.
 *
 * @module steps/snapshot
 */

import type { ActionOutputError, ActionState } from "@effected/github-actions";
import { ActionEnvironment, ActionOutputs, DryRun } from "@effected/github-actions";
import { WorkspaceDiscovery } from "@effected/workspaces";
import type { Changesets } from "@savvy-web/silk-effects";
import { Effect, Option } from "effect";
import { SnapshotError } from "../release/errors.js";
import type { DetectedRelease } from "../release/publish.js";
import { runCiBuild, runPublishTargets } from "../release/publish.js";
import type { PublishPackagesResult } from "../release/types.js";
import type { Inputs } from "../schema/inputs.js";
import { emitReleaseOutput } from "../schema/outputs.js";
import type { SnapshotFailureInput, SnapshotRelease } from "../schema/projections.js";
import { toSnapshotOutput } from "../schema/projections.js";
import { detectPackageManager } from "../utils/detect-package-manager.js";
import { ensureFullHistory } from "../utils/ensure-full-history.js";
import { grouped } from "../utils/grouped.js";
import { runNativeVersion } from "../utils/native-version.js";
import type { DanglingDependency } from "../utils/snapshot.js";
import { SNAPSHOT_PRERELEASE_TEMPLATE, checkSnapshotRef, findDanglingDependencies } from "../utils/snapshot.js";
import { renderSnapshotSummary } from "../utils/snapshot-summary.js";
import { sortReleasesTopologically } from "../utils/sort-releases-topologically.js";

/** Where the step stopped: the error reason plus the output's failure stage. */
interface Stop {
	readonly reason: SnapshotError["reason"];
	readonly stage: SnapshotFailureInput["stage"];
	readonly message: string;
}

/**
 * The snapshot phase body.
 *
 * @param inputs - The decoded action inputs.
 *
 * @public
 */
export const runSnapshot = (inputs: Inputs) =>
	grouped(
		"Snapshot",
		Effect.gen(function* () {
			const outputs = yield* ActionOutputs;
			const environment = yield* ActionEnvironment;
			const dryRun = yield* (yield* DryRun).isDryRun;
			const cwd = process.cwd();
			const tag = Option.getOrElse(inputs.snapshotTag, () => "");
			let branch = "";

			// The ONE exit: emit the output, write the summary, then (on a stop)
			// annotate and fail. Every path below returns through here.
			const finish = (
				releases: ReadonlyArray<SnapshotRelease>,
				publishResult: PublishPackagesResult | null,
				stop: Stop | null,
				dangling: ReadonlyArray<DanglingDependency> = [],
			): Effect.Effect<void, SnapshotError | ActionOutputError, ActionState> =>
				Effect.gen(function* () {
					const output = toSnapshotOutput({
						tag,
						dryRun,
						workspaceRoot: cwd,
						releases,
						publishResult,
						failure: stop === null ? null : { stage: stop.stage, reason: stop.message },
					});
					yield* emitReleaseOutput(outputs, output, { packageCount: output.totals.published, releasePrNumber: null });
					yield* outputs
						.summary(renderSnapshotSummary(output, branch, dangling))
						.pipe(
							Effect.catch((e) =>
								Effect.logWarning(
									`Failed to write the snapshot job summary: ${e instanceof Error ? e.message : String(e)}`,
								),
							),
						);
					if (stop !== null) {
						yield* Effect.logError(`Snapshot: ❌ ${output.summary}`);
						yield* outputs.setFailed(`Snapshot failed — ${stop.message}`);
						return yield* Effect.fail(new SnapshotError({ reason: stop.reason, message: stop.message }));
					}
					yield* Effect.logInfo(`Snapshot: ✅ ${output.summary}`);
				});

			// ── 1. Refusals ─────────────────────────────────────────────────────
			if (Option.isNone(inputs.snapshotTag)) {
				return yield* finish([], null, {
					reason: "missing-tag",
					stage: "refused",
					message:
						"snapshot-tag is required when phase is snapshot — set it to the dist-tag to publish under (e.g. next)",
				});
			}
			// Read through `Effect.result`: a missing GITHUB_REF must still exit
			// through `finish`, so the output and summary are emitted first.
			const refRead = yield* Effect.result(environment.get("GITHUB_REF"));
			if (refRead._tag === "Failure") {
				return yield* finish([], null, {
					reason: "ref",
					stage: "refused",
					message: "GITHUB_REF is not set — the snapshot phase must run in a workflow dispatched from a branch",
				});
			}
			const refCheck = checkSnapshotRef(refRead.success, inputs);
			if (!refCheck.ok) return yield* finish([], null, { reason: "ref", stage: "refused", message: refCheck.reason });
			branch = refCheck.branch;
			yield* Effect.logInfo(`Snapshot \`${tag}\` of ${branch}${dryRun ? " (dry run)" : ""}`);

			// ── 2. Version (working tree only; never committed or pushed) ──────
			yield* ensureFullHistory(inputs.targetBranch);
			const snapshot: Changesets.SnapshotOptions = {
				tag,
				useCalculatedVersion: true,
				prereleaseTemplate: SNAPSHOT_PRERELEASE_TEMPLATE,
			};
			const versioned = yield* Effect.result(grouped("Version", runNativeVersion(cwd, { snapshot })));
			if (versioned._tag === "Failure") {
				return yield* finish([], null, { reason: "version", stage: "version", message: versioned.failure.message });
			}
			const releases: ReadonlyArray<SnapshotRelease> = versioned.success.releases.map((r) => ({
				name: r.name,
				newVersion: r.newVersion,
			}));
			if (releases.length === 0) return yield* finish([], null, null);

			// Locate every bumped package, then order dependency-first.
			const discovery = yield* WorkspaceDiscovery;
			const detectedByName = new Map<string, DetectedRelease>();
			// Runtime dependency NAMES only (never dev: a consumer never installs
			// them). Names do not change with versioning, so discovery's manifest
			// read is exact; the pinned version comes from the applied releases.
			const runtimeDependencies = new Map<string, ReadonlyArray<string>>();
			const missing: string[] = [];
			for (const release of releases) {
				const found = yield* Effect.result(discovery.getPackage(release.name));
				if (found._tag === "Success") {
					detectedByName.set(release.name, {
						name: release.name,
						version: release.newVersion,
						path: found.success.path,
					});
					runtimeDependencies.set(release.name, [
						...Object.keys(found.success.dependencies),
						...Object.keys(found.success.peerDependencies),
						...Object.keys(found.success.optionalDependencies),
					]);
				} else {
					missing.push(release.name);
				}
			}
			if (missing.length > 0) {
				return yield* finish(releases, null, {
					reason: "version",
					stage: "version",
					message: `versioned package(s) not found in the workspace: ${missing.join(", ")}`,
				});
			}
			const order = yield* sortReleasesTopologically([...detectedByName.keys()]);
			const detected = order
				.map((name) => detectedByName.get(name))
				.filter((d): d is DetectedRelease => d !== undefined);

			// ── 3. Build (no SBOM) ─────────────────────────────────────────────
			const packageManager = yield* detectPackageManager;
			const build = yield* grouped("Build", runCiBuild(packageManager));
			if (!build.ok) {
				return yield* finish(releases, null, {
					reason: "build",
					stage: "build",
					message: build.error ?? "ci:build failed",
				});
			}

			// ── 4. Publish under the snapshot tag ──────────────────────────────
			const publishResult = yield* runPublishTargets(detected, new Map(), inputs.customRegistries, { tag, dryRun });

			// ── 5. Dangling internal dependencies (a finding, never a verdict) ─
			const dangling = findDanglingDependencies(releases, runtimeDependencies, publishResult);
			for (const d of dangling) {
				yield* Effect.logWarning(
					`Snapshot: ${d.dependent}@${d.dependentVersion} depends on ${d.dependency}@${d.version}, ` +
						"which was bumped but not published — that pin will not install",
				);
			}
			if (!publishResult.success) {
				const landed = publishResult.packages.flatMap((p) => p.targets).filter((t) => t.status === "published").length;
				return yield* finish(
					releases,
					publishResult,
					{
						reason: "publish",
						stage: "publish",
						message:
							`${landed} publication(s) landed before at least one failed — ` +
							"pin the exact versions listed in the summary, never the tag",
					},
					dangling,
				);
			}
			yield* finish(releases, publishResult, null, dangling);
		}),
	);
