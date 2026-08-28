// Shared publish-target resolution.
//
// `resolvePublishableTargets` composes the `PublishabilityDetector` with the
// built-`package.json` private filter — the exact path Phase-2 validation and
// Phase-3 publish use to decide what is actually publishable.

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { classifyRegistry } from "@effected/npm";
import type { PublishTarget, WorkspacePackage } from "@effected/workspaces";
import { PublishabilityDetector } from "@effected/workspaces";
import type { PublishTargetBindingError } from "@savvy-web/silk-effects";
import { SilkPublishability } from "@savvy-web/silk-effects";
import type { FileSystem } from "effect";
import { Effect } from "effect";

/**
 * Report whether a built target directory's `package.json` is marked `private`.
 *
 * The build pipeline keeps `private: true` on dev-only build outputs and
 * rewrites it to `private: false` on real publish targets. A missing or
 * unreadable `package.json` is treated as not private.
 *
 * @param targetDir - Absolute path to the built target directory.
 * @returns `true` when the directory's `package.json` has `private: true`.
 */
export function isTargetPrivate(targetDir: string): boolean {
	const pkgJsonPath = join(targetDir, "package.json");
	if (!existsSync(pkgJsonPath)) {
		return false;
	}
	try {
		const parsed = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as { private?: boolean };
		return parsed.private === true;
	} catch {
		return false;
	}
}

/**
 * Resolve a package's publish targets via `PublishabilityDetector`, then drop
 * any whose built `package.json` is `private` — validation/publish only
 * exercise what will actually be published.
 *
 * @remarks
 * Each returned `PublishTarget.directory` is passed through unchanged from
 * `PublishabilityDetector` and may therefore be **package-relative**, not
 * absolute. The private-build filter resolves the directory internally
 * (against `pkg.path`) purely for its own `isTargetPrivate` check — the
 * returned targets are not mutated. A caller that treats `directory` as a
 * filesystem path must resolve it itself, e.g.
 * `isAbsolute(t.directory) ? t.directory : join(pkg.path, t.directory)` — this
 * is what `validation.ts` does for the dry-run `cwd` and SBOM directory.
 *
 * Fails with `PublishTargetBindingError` when the package has a
 * `dist/prod/targets.json` binding and detection selected a directory the
 * binding does not describe — detection did not pick the prod build output, so
 * the bytes about to be packed are not the release artifact.
 *
 * @param pkg - The workspace package to resolve targets for.
 * @param workspaceRoot - Absolute path to the workspace root.
 * @returns The publishable targets, with `private`-built targets removed.
 */
export const resolvePublishableTargets = (
	pkg: WorkspacePackage,
	workspaceRoot: string,
): Effect.Effect<
	ReadonlyArray<PublishTarget>,
	PublishTargetBindingError,
	PublishabilityDetector | FileSystem.FileSystem
> => SilkPublishability.resolveTargets(pkg, workspaceRoot);

/**
 * Resolve the auth token for a publish-target registry.
 *
 * Resolution:
 *  - npm public registry  → the resolved npm token (from `Config` via caller)
 *  - GitHub Packages      → the resolved GitHub Packages token (from `ActionState` via caller)
 *  - Custom registries    → the `custom-registries` input (parsed and
 *    declassified by the caller), falling back to an env var derived from the
 *    registry URL
 *
 * Returns `null` when no token is found (OIDC / first-time publish).
 *
 * Kept as the single token-selection seam so the rules cannot fork per phase
 * (Phase 2 deliberately resolves no tokens at all — `npm pack --dry-run`
 * never contacts a registry).
 *
 * @param registry - The target registry URL.
 * @param npmToken - The resolved npm token, or `null`.
 * @param ghPkgsToken - The resolved GitHub Packages token, or `null`.
 * @param customTokens - Custom-registry tokens keyed by trailing-slash
 *   normalized registry URL, from the `custom-registries` input. Values are
 *   already masked in the CI log by the caller.
 * @returns The token for the registry, or `null` when none applies.
 */
export function pickToken(
	registry: string,
	npmToken: string | null,
	ghPkgsToken: string | null,
	// No default value, deliberately: the ONE production caller must thread the
	// parsed `custom-registries` input here. A `= new Map()` default is how the
	// input regresses to "decoded but consumed by nothing" a second time
	// without a compile error (issue #215).
	customTokens: ReadonlyMap<string, string>,
): string | null {
	// One classification, switched exhaustively — rather than two independent
	// booleans asked in sequence, which can disagree. `classifyRegistry` is the
	// construct whose docstring names this call site.
	switch (classifyRegistry(registry)) {
		case "npm":
			return npmToken;
		case "github-packages":
			return ghPkgsToken;
		// JSR is not an npm-protocol registry and publishes over OIDC, so it has
		// no token of its own. It shares the custom-registry env-var derivation
		// here only because the predecessor's two booleans both answered false
		// for it and it fell through — preserved deliberately rather than
		// changed inside a migration. Giving JSR its own `return null` is a
		// product decision and belongs in its own change.
		case "jsr":
		case "custom": {
			// The `custom-registries` input first — the documented path, restored
			// for issue #215. Keys are normalized with a trailing slash at parse
			// time (`parseCustomRegistries`), so normalize the lookup the same way.
			const configured = customTokens.get(`${registry.replace(/\/+$/, "")}/`);
			if (configured !== undefined) return configured;
			// Fallback: an env var derived from the URL,
			// e.g. https://registry.example.com/ → REGISTRY_EXAMPLE_COM_TOKEN.
			// Undocumented but kept — it is the only path that worked at all while
			// the input was severed, and a workflow can legitimately set it.
			const envName = registry
				.replace(/^https?:\/\//, "")
				.replace(/[^a-zA-Z0-9]/g, "_")
				.toUpperCase()
				.replace(/_+/g, "_")
				.replace(/^_|_$/g, "")
				.concat("_TOKEN");
			return process.env[envName] ?? null;
		}
	}
}

/**
 * One resolved publish target, flattened to the fields the publish path uses.
 *
 * @remarks
 * `directory` is **absolute** — resolved against the package path here, unlike
 * the package-relative `PublishTarget.directory` that
 * {@link resolvePublishableTargets} passes through untouched.
 *
 * @public
 */
export interface TargetSpec {
	/**
	 * The package name as it will be published.
	 *
	 * @remarks
	 * NOT necessarily the workspace's own name. `PublishTarget.name` is "the
	 * package name being published", and a workspace may publish under a
	 * different name per target. Carried here because the release output
	 * reports what was actually put on each registry, and dropping it made a
	 * renamed publication unreportable.
	 */
	readonly name: string;
	readonly registry: string;
	readonly directory: string;
	readonly access: "public" | "restricted";
	readonly provenance: boolean;
}

/**
 * What {@link resolvePublishTargetSpecs} found for one package.
 *
 * @remarks
 * The two skip lists are returned rather than logged because this module has
 * no logger and should not acquire one — the caller owns how loudly a skip is
 * reported, and Phase 2 and Phase 3 report them differently.
 *
 * @public
 */
export interface ResolvedPublishTargets {
	/** Targets that will actually be published to, with absolute directories. */
	readonly targets: ReadonlyArray<TargetSpec>;
	/** Registry URLs of JSR targets, which this action cannot publish yet. */
	readonly jsrSkipped: ReadonlyArray<string>;
	/** Basenames of target directories dropped for a `private` built `package.json`. */
	readonly privateSkipped: ReadonlyArray<string>;
}

/**
 * Resolve the publish targets a package will actually be published to.
 *
 * @remarks
 * **The single definition of "will this package publish anywhere".** It exists
 * because Phase 3 asked that question twice, in two places, by two different
 * routes: the publish step resolved targets and filtered them, while the
 * Build &amp; SBOM gate never asked at all and generated an SBOM for every
 * detected package — including private tracking packages that have no tarball
 * to describe and no release asset to attach it to. Both now call this, so the
 * SBOM gate and the publish step cannot disagree about which packages are
 * registry packages.
 *
 * Three filters, in order:
 *  1. `PublishabilityDetector.detect` — the package's own declaration of where
 *     it publishes. Its error channel is `never`; an undetectable package
 *     yields an empty array.
 *  2. **JSR targets are removed**, because this action cannot publish to JSR
 *     yet. They are reported in `jsrSkipped` so the caller can say so.
 *  3. **Targets whose built `package.json` is `private` are removed** — the
 *     build pipeline's "never publish" signal for dev-only outputs.
 *
 * A package that survives with zero targets is `github-release` kind — see
 * `utils/release-kind.ts`. That is a legitimate outcome, not a failure.
 *
 * @param wsPkg - The workspace package to resolve targets for.
 * @returns The surviving targets plus what was dropped and why.
 *
 * @public
 */
export const resolvePublishTargetSpecs = (
	wsPkg: WorkspacePackage,
): Effect.Effect<ResolvedPublishTargets, never, PublishabilityDetector> =>
	Effect.gen(function* () {
		const detector = yield* PublishabilityDetector;
		const detected = yield* detector.detect(wsPkg);

		const jsrSkipped: string[] = [];
		const privateSkipped: string[] = [];
		const targets: TargetSpec[] = [];

		for (const t of detected) {
			if (classifyRegistry(t.registry) === "jsr") {
				jsrSkipped.push(t.registry);
				continue;
			}
			const directory = isAbsolute(t.directory) ? t.directory : join(wsPkg.path, t.directory);
			if (isTargetPrivate(directory)) {
				privateSkipped.push(directory);
				continue;
			}
			targets.push({
				name: t.name,
				registry: t.registry,
				directory,
				access: t.access,
				provenance: t.provenance ?? false,
			});
		}

		return { targets, jsrSkipped, privateSkipped };
	});
