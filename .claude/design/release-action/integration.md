---
title: Multi-Registry Publishing and Integration
category: integration
status: current
completeness: 92
created: 2026-02-07
updated: 2026-08-06
last-synced: 2026-08-06
module: release-action
related:
  - architecture.md
  - testing.md
dependencies:
  - architecture.md
---

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
  - [Publishability Detection (Silk Rules)](#publishability-detection-silk-rules)
  - [Registry Infrastructure](#registry-infrastructure)
  - [Native versioning and zero-install Phase 1](#native-versioning-and-zero-install-phase-1)
  - [Token Plumbing](#token-plumbing)
  - [Attestation System](#attestation-system)
  - [SBOM and Compliance System](#sbom-and-compliance-system)
  - [Release Assets (Group-Keyed)](#release-assets-group-keyed)
  - [Publish Summary Generation](#publish-summary-generation)
  - [Type System](#type-system)
- [Rationale](#rationale)
- [File Reference](#file-reference)

## Overview

The release action supports publishing to multiple registries simultaneously with OIDC-first authentication, SBOM generation, and NTIA compliance validation. This document covers the registry infrastructure, authentication model, SBOM/compliance system, and the type system that ties them together.

Phase 3 is a self-recovering publish chain built on the `@effected/*` kit (see `package.json` for the declared ranges). The single-package `@savvy-web/github-action-effects` that preceded it is gone; its surface is split across `@effected/npm` (`PackagePublish`, `NpmRegistry`, `classifyRegistry`), `@effected/sbom` (SBOM generation, `SigstoreSigner`, `InTotoStatement`, `SlsaProvenance`), `@effected/github` (`Attestation`, `ArtifactMetadata`, and the rest of the GitHub resources), `@effected/github-actions` (`OidcTokenIssuer`, `ActionsProvenance`, `DryRun`, …) and `@effected/commands` (`LocalExec`, `ToolDiscovery`). The old imperative registry modules (`registry-auth.ts`, `registry-utils.ts`, `pre-validate-target.ts`, `dry-run-publish.ts`, `publish-packages.ts`, `publish-target.ts`) and the old `src/services/attest/` directory are all deleted. See `src/release/publish.ts`, `src/release/releases.ts` and `src/release/attest-helpers.ts` for the current Effect orchestration.

Publish and release operate on the `@savvy-web/bundler` per-byte-group prod layout (via `@savvy-web/silk-effects`): each package's `publishConfig.targets` is a Record map resolved through a `dist/prod/targets.json` binding into `dist/prod/<group>/pkg` build directories, one per byte-variant group. Registries that share bytes share a group, so `npm: true` + `github: true` collapse into a single tarball deployed to both registries.

## Current State

### Publishability Detection (Silk Rules)

The silk publishability rules now live in `@savvy-web/silk-effects` as `SilkPublishability`, not in this repo — the local `src/release/publishability.ts` was retired when silk-effects 5.2 landed service-owned layer statics. Two Layer implementations wrap the `PublishabilityDetector` service from `@effected/workspaces`, and `src/release/layers.ts` composes the adaptive one:

**`SilkPublishability.layer`** (the silk rules) consults `publishConfig` first, treating the `private` flag only as a last-resort default. In silk mode `private: true` is the norm on workspace `package.json` — it keeps the package out of accidental `npm publish` and out of transitive public installs — so publishability is derived from `publishConfig`, regardless of `private`. The build pipeline rewrites `private: false` onto the real publish artifact (e.g. `dist/npm`) while leaving the dev/link artifact (`publishConfig.directory`, e.g. `dist/dev`) private. Precedence:

1. `publishConfig.targets` non-empty → resolve each target, regardless of `private`. String shorthands (`"npm"`, `"github"`, `"jsr"`, URL strings) are expanded; object targets may override access and registry. Targets whose resolved access is not `"public"` or `"restricted"` are dropped.
2. `publishConfig.access` set, no `targets` → one target using that access, regardless of `private`.
3. `private !== true` (no usable `publishConfig`) → one default target.
4. Otherwise (private, no usable `publishConfig`) → empty array (not publishable).

This precedence fixed a regression where a public source package (`private: false`) declaring `publishConfig.targets` was short-circuited to a single default target at `publishConfig.directory` (the private `dist/dev` artifact), which the private-build filter then dropped — misclassifying it as version-only.

**`SilkPublishability.layerAdaptive`** is the single ignore-aware detector, provided over this repo's `ChangesetConfigLive` in `src/release/layers.ts`. It short-circuits to `[]` for any package whose name matches the changeset `ignore` globs (via `ChangesetConfig.isIgnored`, which uses the shared `matchesIgnorePattern` matcher exported from `src/utils/detect-repo-type.ts`), regardless of mode. It then reads `ChangesetConfig.mode` per-call and dispatches to the silk override (silk mode), the library's built-in `PublishabilityDetectorLive` (vanilla mode), or a no-op detector that returns an empty array for every package (none mode). Every publishability path resolves through this layer: Phase 1 (`listPublishablePackages` / `isMonorepoForTagging`), Phase 2 (`runValidation` via `resolvePublishableTargets`) and Phase 3 (`runPublishTargets` via `PublishabilityDetector`).

`ChangesetConfig.mode` is itself decoded by the bundled silk-effects `ChangesetConfigReader` from the changelog id in the consumer's `.changeset/config.json`, which makes the library's silk-marker id set load-bearing: an id the bundled reader does not recognize silently degrades the repo to vanilla rules, where the `@effected/workspaces` default resolves the single target at `publishConfig.directory` (the private `dist/dev/pkg` dev artifact) instead of the prod byte groups. That failure mode shipped once — silk-effects 3.0.0 recognized only the two legacy ids, so repos declaring the canonical `@savvy-web/changelog` id (what current `savvy init` writes) had Phase 3 publish their dev target with unresolved `catalog:` specifiers (issue #143, `yaml-effect@0.7.1`). The bundled silk-effects 3.0.1+ adds `@savvy-web/changelog` to the silk markers, so those repos detect as silk workspaces again.

Ignored packages are excluded from detection entirely, not just from publishing: Phase-2 `detectReleasedPackages` and Phase-3 `detectReleases` both drop changeset-ignored names via `ChangesetConfig.isIgnored`, so they never appear in validation or publish output — not even as version-only rows.

The implementation reads raw `package.json` from disk (not the typed `WorkspacePackage`) so it can see `publishConfig.targets`, which is not surfaced by the typed `PublishConfig` schema in `@effected/workspaces`. The same rules are encoded identically in `silk-update-action` and the silk `changesets` package.

### Registry Infrastructure

#### Target Resolution (`src/release/resolve-targets.ts`)

`resolvePublishableTargets(pkg, workspaceRoot)` is the shared publish-target seam for Phase 2 and Phase 3 — it composes the `PublishabilityDetector` with the built-`package.json` private filter (`isTargetPrivate`). It delegates to `SilkPublishability.resolveTargets` (from `@savvy-web/silk-effects`), which resolves the package's publishable `PublishTarget[]` from the per-byte-group prod layout, expanding string shorthands and object targets. It fails with `PublishTargetBindingError` when the package carries a `dist/prod/targets.json` binding and detection selected a directory that binding does not describe — detection did not pick the prod build output, so the bytes about to be packed are not the release artifact (issue #144). `runValidation` wraps the call in `Effect.either` and turns a `Left` into a `severity: "error"` finding that fails the check and blocks auto-merge, without aborting the rest of the run.

`pickToken(registry, npmToken, ghPkgsToken)` in the same module resolves each target registry's credential from **one** `classifyRegistry` call, switched exhaustively — rather than two independent booleans asked in sequence, which can disagree:

- `"npm"` (`registry.npmjs.org`) — the `npm-token` input, when present; OIDC otherwise
- `"github-packages"` (`npm.pkg.github.com`) — the `github-token` input, read back from `GithubPackagesTokenState`
- `"jsr"` (`jsr.io`) — publishes over OIDC and has no token of its own. It shares the custom-registry env-var derivation below only because the predecessor's two booleans both answered false for it and it fell through; preserved deliberately rather than changed inside a migration
- `"custom"` — env var derived from the URL (e.g. `https://registry.savvyweb.dev/` → `REGISTRY_SAVVYWEB_DEV_TOKEN`)

#### Authentication and publishing

Authentication and publishing are handled by `@effected/npm` services in Phase 3:

- **`PackagePublish`** — `pack(directory, opts)` runs npm pack once per build directory; `publishTarball(path, opts)` publishes the pre-packed tarball; `dryRun(directory, opts)` runs `npm publish --dry-run`; `setupAuth({ registry, token, npmrcPath })` writes auth to the npmrc. Every npm invocation dispatches through `LocalExec`, whose launcher is built by `Workspaces.localExecLayer()` in `src/release/layers.ts` from the **detected** package manager — so `NpmExecutor.dlx` resolves to `pnpm dlx npm@11` in a pnpm workspace and the npm equivalent elsewhere, and a Phase-2 dry-run validates against the exact npm the Phase-3 publish runs. The predecessor's static `LocalExec.layerFor("pnpm", …)` asserted pnpm regardless of the workspace; a dlx executor with no launcher now fails typed rather than silently falling back to the runner's bundled npm 10.x, which cannot do OIDC trusted publishing. The dlx-fetched npm is pinned to `npm@11`: it lands OIDC trusted publishing (Node 24 ships npm 10.x, which lacks it) while avoiding npm 12.0.0, which changed `pack --json` from an entry array to a name-keyed object — every publish failed `npm pack returned empty result` when npm 12 took the `latest` tag on 2026-07-08 — and whose `publish` throws `MODULE_NOT_FOUND: sigstore` (npm/cli#9722). `@effected/npm` reads both `pack --json` shapes and refuses a manifest carrying `catalog:`/`workspace:` specifiers or a zero-file tarball; the action consumes that. OIDC for npm and JSR is handled inside `PackagePublish.publishTarball`.
- **`NpmRegistry`** — `version(name, version, opts)` probes a registry for an existing version's tarball digest. Returns an absent value when the version is not published, the digest when it is. This is an **HTTP read carrying its own token**, not an `npm view` subprocess, which is why it no longer needs an npmrc. Used by `publishDirectoryGroup` before deciding whether to publish, skip, or abort.
- **`classifyRegistry`** — the single classification (`npm` | `github-packages` | `jsr` | `custom`) behind `pickToken` and the token-auth decision below.

##### Token-auth publishing fallback

`publishTarball` takes a `tokenAuth` flag. The decision in `publishDirectoryGroup`:

- **GitHub Packages** — published with `tokenAuth: true` from the first attempt. npm 11.5+ still auto-attempts the OIDC `/-/npm/v1/oidc/token/exchange` POST whenever the Actions OIDC env is present (even without `--provenance`), which GitHub Packages does not support — it 404s and ignores the configured `_authToken`. Stripping the OIDC env and authenticating with the token avoids the failed exchange.
- **npm public registry** — prefers trusted publishing (OIDC). When that fails and a token is available it retries once with `tokenAuth: true`: an unconfigured package (no trusted publisher yet) cannot bootstrap the OIDC exchange (it 404s "package not found"), so the first-time publish needs the token. Once the package exists and trusted publishing is configured, the first attempt succeeds and the retry never fires.

A GitHub Packages target with **no** token fails by name rather than by symptom: `publishDirectoryGroup` emits "no github-token input — GitHub Packages requires the workflow's `secrets.GITHUB_TOKEN`" and records the target failed. Without that, the symptom is four identical "integrity probe failed — status 403" lines that read like a package-permissions problem. The App installation token is **not** a substitute and never can be: GitHub App tokens cannot access GitHub Packages at all, the sole exception being the default GitHub Actions token, which is a special kind of App token. Permissions are irrelevant — on `savvy-web/systems` run 30228332922 the same token that resolved the App identity and revoked itself against `api.github.com` was rejected 403 by `npm.pkg.github.com` while holding `packages:write`.

Failures otherwise surface npm's actual error (e.g. `ENEEDAUTH`, `E404`) rather than an opaque exit code, and the resolved auth-token key plus target npmrc path are logged (never the token) for auth debugging.

Phase 2 dry-run validation uses `PackagePublish.dryRun`, which runs `npm publish --dry-run` against each target registry through the same launcher (see above). `src/utils/npm-cache.ts` (`ensureNpmCacheEnv`, called at the very top of `program.ts` before any phase runs an npm command) routes every npm CLI call through a runner-writable cache, sidestepping the GitHub macOS runner images' partially root-owned `~/.npm/_cacache` that previously failed dry-runs with `EACCES`.

#### Configuration Loading (`load-release-config.ts`)

Layered configuration with three sources in priority order:

1. **Local repository**: `.github/silk-release.json` or `.github/silk-release.jsonc` in the repository being released.
2. **Action input**: `sbom-config` action parameter (useful for reusable workflows where env vars do not propagate through `workflow_call`). Decoded through `SilkReleaseConfig` schema (`src/schema/silk-release-config.ts`) before use.
3. **Environment variable**: `SILK_RELEASE_SBOM_TEMPLATE` (for organization-wide defaults).

The first source found wins. All sources support JSONC via `@effected/jsonc` (`Jsonc.parse`, an Effect-returning error-recovery parser that replaced the plain `jsonc-parser` dependency in the v4 migration).

### Native versioning and zero-install Phase 1

Phase 1 (branch management) runs zero-install: the shared workflow passes `install-deps: false` and the action versions in-process via the bundled silk-effects v4 `ReleasePlanner` (`src/utils/native-version.ts`). Consumer `ci:version` scripts are no longer invoked and the `version-command` input is removed from `action.yml` and the composite actions.

**Changelog id map** — the consumer's changeset config names a changelog generator by module id; `CHANGELOG_MODULES` maps the known ids onto action-shipped ESM bundles so no consumer `node_modules` is required. Supported ids: `@savvy-web/changelog`, `@savvy-web/silk/changesets/changelog` and `@savvy-web/changesets/changelog` → `dist/changelog-silk.js` (silk-effects `changelogFunctions`); `@changesets/cli/changelog` → `dist/changelog-default.js` (`@changesets/changelog-git`). Any other id fails inside `ReleasePlanner.apply` with a typed error naming it. The bundles are emitted as `workers` entries in `action.config.ts`.

**GITHUB_TOKEN scoping and precedence** — the upstream changelog GitHub-info fetch (`@changesets/get-github-info`) reads `process.env.GITHUB_TOKEN` directly. `runNativeVersion` sets it from the App token for the duration of the apply — the App token takes precedence over any ambient `GITHUB_TOKEN` the job exports, so the changelog fetch always uses the action's own identity — and restores the prior state afterward. This env mutation is not parallel-safe; Phase 1 is strictly sequential by design.

**Transient retry** — `ReleasePlanner.apply` is not idempotent (it deletes consumed changesets), so a transient failure (`ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `EAI_AGAIN`, `fetch failed`) triggers a single reset-then-retry: `git checkout -- .` + `git clean -fd`, a one-second pause, then one fresh apply.

**Biome format policy** — after a successful apply, `formatWorkspaceWithBiome` (`src/utils/format-workspace.ts`) replaces the `&& biome format --write .` tail of the removed consumer script. If `biome.json(c)` exists and the standalone `biome` binary (installed by silk-runtime-action) is on PATH, it runs `biome format --write .`. Missing binary with a present config → warn and continue. A config the standalone binary cannot resolve (matched on `could not resolve|module not found` — silk-suite repos `extends` the `@savvy-web/silk/biome` package, which only exists with `node_modules` installed) → warn and continue. Any other non-zero format exit fails the phase. This pass is no longer load-bearing for changesets `versionFiles` targets: the bundled silk-effects engine writes those bumps as format-preserving in-place jsonc edits (one-line diffs; JSONC comments, inline arrays and indentation survive), so a skipped format — the silk-suite unresolvable-config case above — no longer leaves serializer-reformatted JSON in the release PR.

### Token Plumbing

`process.env.GITHUB_TOKEN` is never written persistently by the action. The one scoped exception is Phase-1 native versioning, which sets it from the App token around `ReleasePlanner.apply` and restores the prior value after (see [Native versioning and zero-install Phase 1](#native-versioning-and-zero-install-phase-1)). The token landscape has three distinct identities:

- **App installation token** — provisioned by `pre.ts` via `GitHubToken.provision()` and stored in `ActionState` under the kit's internal key. `layers/app.ts` builds the client from it with `GitHubToken.clientLayer()`. Anything needing the raw token calls `GitHubToken.read()` itself — `utils/native-version.ts` does, for the changelog worker's ambient `GITHUB_TOKEN` read.
- **Workflow packages token** — the `github-token` action input (`secrets.GITHUB_TOKEN` with `permissions: packages: write`), persisted by `pre.ts` to `GithubPackagesTokenState` and masked with `setSecret`. `runPublishTargets` reads it back from `ActionState` and `pickToken` hands it to every `github-packages` target. It is **required** for GitHub Packages rather than merely preferred: the App installation token cannot publish there at all (see [Authentication and publishing](#authentication-and-publishing)). Omitting it fails every GitHub Packages target and aborts before any GitHub release is created.
- **OIDC tokens** — short-lived JWTs fetched on demand by `OidcTokenIssuer` (`@effected/github-actions`) for Sigstore/Fulcio signing and for npm/JSR trusted publishing. Not stored in state; fetched fresh per attestation run. `ActionsIdentityToken.layer` adapts the issuer into the `IdentityToken` that `SigstoreSigner` requires. A local shim did this until `@effected/github-actions` shipped the adapter (effected#184, now closed).

**Two process-environment bridges are deleted, not moved.** `STATE_token` existed so the removed `utils/tokens.ts` could hand the raw token to `native-version.ts`; that module now calls `GitHubToken.read()` itself and sets `GITHUB_TOKEN` only for the duration of the apply, so the credential no longer sits in the environment of every subsequent in-process operation as a second plaintext copy. `STATE_githubToken` wrote the workflow token into the environment as **plaintext** — no `Secret` member anywhere on that path — to serve `tokens.packagesToken()`, whose only production caller (`registry-auth.setupRegistryAuth`) was deleted at #90; its own test file was the last thing importing it. `utils/tokens.ts` is gone entirely, along with `utils/section-queue.ts` (191 lines, unimported since #191).

All three identities are carried as `Redacted<string>` through the secret-bearing APIs (`GitHubApp.generateToken` / `revokeToken`, the client constructors, `PackagePublish.setupAuth`, and the decoded `InstallationToken.token`). Registry tokens are masked via `ActionOutputs.setSecret` before any npmrc is written.

### Attestation System

**The kit splits attestation deliberately, and this repo owns the assembly.** `@effected/sbom` builds and signs a statement (`InTotoStatement`, `SlsaProvenance`, `Sha256Digest`, `SigstoreSigner`); `@effected/github` stores the bundle (`Attestation`, `ArtifactMetadata`); `@effected/github-actions` supplies the OIDC identity and `ActionsProvenance`. Assembling the two into a pipeline is the consumer's job — `AttestationShape`'s own remarks say so — and **`src/release/attest-helpers.ts` is that assembly, in one place**, so `publish.ts` and `releases.ts` do not each grow their own copy. The old `src/services/attest/` directory no longer exists.

**Key properties of the current attestation flow:**

**Idempotency** — Before creating any attestation, the flow checks for an existing one for both the SLSA provenance and CycloneDX BOM predicate types on the subject digest. If one already exists, the existing URL is reused and the target's `TargetPublishResult.recovered` field records `{provenance: true}` or `{sbom: true}`. A fresh attestation is written only when none exists.

**One attestation per build directory** — All targets that share a directory share the same tarball (same digest), so a single provenance + SBOM attestation pair covers all of them. Phase 2 generates one SBOM per build directory; Phase 3 uploads the saved SBOM JSON as a release asset and attests it.

**SBOM workspace-dep rewriting** — SBOM generation rewrites workspace protocol references across all workspace packages (not just the released cycle), fixing `npm install 404` errors against npmjs.org for non-released sibling deps that previously had their local workspace reference preserved in the SBOM component list.

**Honest failure reporting** — Attestation failures are non-fatal, but they are reported as failures: the publish result is still recorded and the release can complete, while `TargetPublishResult.attestationUrl` stays `undefined` rather than being populated. No failure path renders a success marker.

**OIDC via pinned `pnpm dlx npm@11`** — Node 24 ships npm 10.x, which lacks OIDC trusted publishing. `PackagePublish.publishTarball` routes through the `LocalExec` launcher's dlx executor pinned to `npm@11`, enabling OIDC for npm and JSR (see [Authentication and publishing](#authentication-and-publishing) for why 11 and not 12).

**Storage-record linkage** — After a successful GitHub Packages publish, `ArtifactMetadata` POSTs a storage record linking the attestation to the artifact's metadata entry. This is what makes attestations appear in the org packages UI.

### SBOM and Compliance System

SBOM generation, metadata inference and NTIA compliance are all `@effected/sbom`'s job now (`Sbom`, `SbomMetadata`, `SbomMetadataSource`, `NtiaReport`, `Supplier`, `Contact`, `CYCLONEDX_BOM_PREDICATE`). The three repo-local modules that used to do this work — `infer-sbom-metadata.ts`, `validate-ntia-compliance.ts` and `detect-copyright-year.ts` — are **deleted**.

What survives in this repo is the **consumer's own precedence rule**, in `sbomOptionsFromConfig` inside `src/release/validation.ts`: the resolved `sbom-config` template wins over anything derived from the manifest. The *inference* half — parsing `author` / `repository` / `bugs` / `homepage` out of a manifest and normalizing git URLs to HTTPS — is `SbomMetadataSource`'s job, driven by a decoded `Package` from `@effected/package-json`.

Two details are load-bearing:

- **`timestamp` is always set** (NTIA minimum element 7). The predecessor never set one, so every generated BOM reported `timestamp` missing.
- **`nowMillis` is passed in rather than read from the wall clock**, matching the kit's `formatCopyright` posture — the ambient read belongs at the caller's edge, which is what makes the copyright year testable.

NTIA validation is `NtiaReport`, covering the 7 minimum elements: supplier name, component name, component version, unique identifier (PURL), dependency relationship, author of SBOM data, and timestamp. The `strict-warnings` input escalates NTIA compliance warnings to check failures. `src/types/sbom-config.ts` keeps the hand-rolled `NTIAComplianceResult` / `NTIAFieldResult` shapes because they model an external specification rather than a kit type.

`ValidationReport` carries `resolvedSbomConfig` (a per-package map of the `SbomMetadata` actually threaded onto each BOM) and `sbomConfigSource`, so a reader can see at a glance which source the action chose — invaluable when an NTIA warning fires. The Phase-2 SBOM preview and Phase-3 SBOM assets are built from the same generation output: Phase 2 generates and saves the SBOM to disk; Phase 3 reads it back for the release asset upload and attests it.

### Release Assets (Group-Keyed)

`runReleases` uploads release assets keyed by byte-group rather than the old directory-prefix naming (`getDirectoryPrefix` is gone). Per group it uploads `<name>-<version>.<group>.tgz` (the publish tarball), `<name>-<version>.<group>.sbom.json`, `<name>-<version>.<group>.api.json` and an unattested `<name>-<version>.<group>.meta.tgz` doc bundle. `src/utils/group-id.ts` (`getGroupId`, `insertGroupToken`) is the only naming authority. All uploads are idempotent — a re-run reuses an asset already attached to the release by name.

The `meta.tgz` bundle (`tarMetaFolder` in `src/release/meta-archive.ts`) packs the bundler's sibling `meta/` folder — `<unscoped>.api.json` + `tsconfig.json` + `package.json` — plus the generated SBOM, which `copySbomIntoMeta` copies into `meta/` first. It is unattested and exists purely for downstream documentation builders. API-reference docs are read from the `meta/` folder (`findApiDocFile` / `metaDirFor`), not the publish dir.

### Publish Summary Generation

`src/release/report.ts` replaces the old `generate-publish-summary.ts` and the separate `generate-release-notes-preview.ts` / `generate-sbom-preview.ts` modules. It renders through `GitHubMarkdown` (`@effected/github-actions`) and `@effected/markdown`. The shared "what will be released" table lives one level up in `src/utils/release-table.ts`, because Phase 1 renders it with the `targets` column pending and Phase 2 re-renders it once validation fills that column in.

Key exported functions:

- **`buildValidationComment`** — Renders the sticky PR comment from a `ValidationOutput["validation"]` payload. Includes a checks table, publish summary, findings table, and release notes preview. Degraded states are rendered when the build failed or no packages have version diffs.
- **`buildPublishSummary`** — Renders the publish-results section (per-target status: published, skipped-identical, failed-mismatch, failed).
- **`buildChecksTable`** — Renders the per-step checks table for the validation comment.
- **`buildFindingsTable`** — Renders the non-pass findings table.
- **`buildReleaseNotesPreviewSummary`** — Renders the release notes preview check run body.
- **`buildSbomPreviewSummary`** — Renders the SBOM preview check run body with NTIA compliance details.
- **`buildPublishValidationSummary`** — Renders the publish validation check run body.

### Type System

The canonical type home for publish-chain result shapes is `src/release/types.ts`. The legacy `src/types/publish-config.ts` still exists for the few imperative modules (now mostly in Phase 1/2 utilities) that reference `ResolvedTarget` and related types.

See `src/release/types.ts` for the current `TargetPublishResult.status` three-way enum (`"published" | "skipped" | "failed"`) and the attestation recovery fields. See `src/types/publish-config.ts` for the multi-registry plumbing types (`ResolvedTarget`, `AuthSetupResult`, etc.) still used by Phase-1/2 utilities.

## Rationale

### Why Replace @actions/attest?

`@actions/attest` had three structural problems that the kit's Effect services solve:

1. **Bundler incompatibility**: `@actions/core`'s barrel statically imports `oidc-utils.js` → `@actions/http-client` → `undici`. webpack/rspack cannot emit undici as CJS without producing `Class extends value [object Module] is not a constructor` at the `Dispatcher` class definition. The kit uses the core `HttpClient` (from `effect/unstable/http` in Effect v4, where the standalone `@effect/platform` package dissolved into core `effect`), which is fully bundler-compatible.
2. **Opaque failure surface**: `@actions/attest` error messages did not surface the root cause from Fulcio or Rekor. The kit's tagged errors carry a reason discriminator and a `cause` chain.
3. **Private to the action**: `@actions/attest` is tightly coupled to the `@actions/` environment. Signing (`@effected/sbom`) and storage (`@effected/github`) are separately reusable, and their assembly is explicit in `src/release/attest-helpers.ts` rather than hidden.

### Why Not Set GITHUB_TOKEN?

The action deliberately never writes `process.env.GITHUB_TOKEN` persistently. The runner's `GITHUB_TOKEN` is used by the OIDC subsystem and by GitHub Actions' own trust mechanisms. Overwriting it breaks OIDC token fetches for npm and JSR trusted publishing. The GitHub Packages credential therefore travels as a **value** — read from `ActionState` and handed to `pickToken` — rather than through the process environment at all; the `SILK_GITHUB_PACKAGES_TOKEN` env var that used to carry it is gone with the rest of the environment bridges. The Phase-1 native-versioning exception is safe because it is scoped and restored before any publish or OIDC work runs — Phase 1 never touches registries.

### Why Idempotent Attestation?

Checking for an existing attestation before writing enables safe retries without duplicates accumulating for the same subject. A recovered attestation is reported with `recovered: {provenance: true}` on the `TargetPublishResult` so the publish summary can surface that the attestation was reused rather than created fresh.

### Why Silk-Specific Publishability Rules?

`@effected/workspaces`'s built-in `PublishabilityDetectorLive` treats `private: true` as a hard "not publishable" stop. Silk's convention inverts that: in silk mode `private: true` is the norm on workspace `package.json` (so a package never leaks into a public npm install transitively) and publishability comes from `publishConfig.targets` / `publishConfig.access`, with the `private` flag consulted only as a last-resort default. Consulting `publishConfig` before `private` is what lets a public source package that declares `targets` resolve to those targets rather than collapsing to a single default target at the private dev artifact. `SilkPublishability.layerAdaptive` dispatches to the silk override only when the repo uses the silk changesets preset, so vanilla repos are unaffected.

### Why OIDC-First Authentication?

OIDC (OpenID Connect) trusted publishing eliminates the need for long-lived tokens. Tokens are short-lived and scoped to the specific workflow run. Both npm and JSR support OIDC natively in GitHub Actions. The action falls back to token auth when OIDC is not available (e.g. when `npm-token` is explicitly provided for first-time publishes where OIDC is not yet configured on npmjs.com).

### Why CycloneDX Format?

CycloneDX 1.5 is the most widely supported SBOM format for npm packages. It supports PURL (Package URL) identifiers natively, which are required for the NTIA unique identifier minimum element.

### Why Layered Configuration?

Multiple configuration sources (repo file, action input, environment variable) support different organizational needs. Repository-specific config always overrides organization defaults. The action input path supports reusable workflows where env vars do not propagate through `workflow_call` boundaries.

### Why Pack Once for Multi-Target Publishing?

Packing once ensures every registry receives identical content with the same SHA-256 digest. This is critical for attestation — provenance attestations reference a specific digest, so all targets must share the same tarball to have valid attestations.

## File Reference

### Publishability Detection

| File | Description |
| --- | --- |
| `@savvy-web/silk-effects` → `SilkPublishability` | `layer` (publishConfig-first precedence) and `layerAdaptive` (ignore-aware, single detector). No longer a repo-local module |
| `src/release/layers.ts` | Composes `SilkPublishability.layerAdaptive` over `ChangesetConfigLive` |
| `src/release/changeset-config.ts` | ChangesetConfig service: single source of changeset-config truth (mode, versionPrivate, ignorePatterns, isIgnored, fixed) |
| `src/utils/detect-repo-type.ts` | Exports matchesIgnorePattern (shared changeset-ignore matcher behind ChangesetConfig.isIgnored) |
| `src/release/resolve-targets.ts` | resolvePublishableTargets seam (Phase 2 + Phase 3), isTargetPrivate, pickToken |

### Phase-3 Orchestration

| File | Description |
| --- | --- |
| `src/steps/publishing.ts` | The Phase-3 step body; raises `PublishError` rather than returning on a partial publish |
| `src/release/publish.ts` | detectReleases, runBuildAndSbom, runPublishTargets, publishDirectoryGroup (token-auth fallback) |
| `src/release/releases.ts` | runReleases: tags, GitHub releases, group-keyed tarball/SBOM/API-doc/meta.tgz assets, attestations |
| `src/release/attest-helpers.ts` | The sign (`@effected/sbom`) + store (`@effected/github`) assembly, shared by publish.ts and releases.ts |
| `src/release/meta-archive.ts` | tarMetaFolder: packs a bundler `meta/` folder into a `…<group>.meta.tgz` doc bundle |
| `src/utils/group-id.ts` | getGroupId, insertGroupToken — byte-group asset naming |
| `src/utils/detect-package-manager.ts` | `PackageManagerDetector` delegate; `devEngines`-aware (replaced normalize-package-manager.ts) |
| `src/utils/registry-label.ts` | registryShortLabel / registryHost — ⬆ row labels (publish + validation log trees) |
| `src/utils/npm-cache.ts` | ensureNpmCacheEnv — runner-writable npm cache, set before any npm command |
| `src/release/layers.ts` | WorkspacesLive / LocalExecLive / NativeVersioningLive / ReleaseLive composition |
| `src/layers/app.ts` | MainLive; requires LocalExec, Git and PackageManagerDetector rather than rebuilding them |
| `src/release/types.ts` | TargetPublishResult, ValidationFinding, ValidationPackageResult, etc. |

### Native Versioning (Phase 1)

| File | Description |
| --- | --- |
| `src/utils/native-version.ts` | runNativeVersion, CHANGELOG_MODULES id map, GITHUB_TOKEN scoping, reset-then-retry |
| `src/utils/format-workspace.ts` | formatWorkspaceWithBiome — conditional post-version format policy |
| `src/changelog/silk.ts` | Bundled silk changelog generator → dist/changelog-silk.js |
| `src/changelog/default.ts` | Bundled vanilla changelog generator → dist/changelog-default.js |
| `action.config.ts` | workers entries for the changelog bundles; nativeDynamicImports for runtime dynamic imports |

### Token Plumbing

| File | Description |
| --- | --- |
| `src/utils/native-version.ts` | Reads the App token with `GitHubToken.read()`; sets `GITHUB_TOKEN` only around `ReleasePlanner.apply` |
| `src/pre.ts` | Provisions the App token; persists and masks the `github-token` input |
| `src/state.ts` | GithubPackagesTokenState schema |
| `src/release/resolve-targets.ts` | pickToken — one `classifyRegistry` switch, exhaustive |

`src/utils/tokens.ts` is **deleted**; there is no `packagesToken()` and no `STATE_token` / `STATE_githubToken` process-environment bridge.

### SBOM and Compliance

| File | Description |
| --- | --- |
| `@effected/sbom` | Sbom, SbomMetadata, SbomMetadataSource, NtiaReport, Supplier, Contact — generation, inference and NTIA validation |
| `src/release/validation.ts` | sbomOptionsFromConfig — the consumer's precedence rule (template wins over manifest) plus the always-set `timestamp` |
| `src/utils/load-release-config.ts` | Layered configuration loading; SilkReleaseConfig decoding |
| `src/schema/silk-release-config.ts` | SilkReleaseConfig Effect schema; INPUT_SCHEMA_URL |

`src/utils/infer-sbom-metadata.ts`, `src/utils/detect-copyright-year.ts` and `src/utils/validate-ntia-compliance.ts` are **deleted** — `@effected/sbom` owns all three jobs.

### Summary Generation

| File | Description |
| --- | --- |
| `src/release/report.ts` | buildValidationComment, buildPublishSummary, buildChecksTable, buildFindingsTable, buildReleaseNotesPreviewSummary, buildSbomPreviewSummary, buildPublishValidationSummary |
| `src/utils/release-table.ts` | The shared "what will be released" table (Phase 1 renders it pending; Phase 2 completes it) |
| `src/utils/write-sections.ts` | The read-fold-refresh-post shared by both phases' sticky-comment writes |
| `src/utils/managed-sections.ts` | withSection — per-section state (`running` written before the work) |

### Utility (Phase 2 support)

| File | Description |
| --- | --- |
| `src/utils/extract-release-notes.ts` | First-H2-to-second-H2 CHANGELOG section extraction |
| `src/utils/count-changesets.ts` | Changeset counts per package |
| `src/utils/derive-check-conclusion.ts` | Check-run conclusion with strict-warnings support |
| `src/release/validation-checks.ts` | deriveValidationChecks / applyCheckUrls — the pure verdict derivation (see architecture.md → issue #216) |

### Type Definitions

| File | Description |
| --- | --- |
| `src/types/publish-config.ts` | ResolvedTarget, AuthSetupResult, and related types (Phase 1/2 utilities) |
| `src/types/sbom-config.ts` | SBOM metadata, CycloneDX, and NTIA compliance types |
| `src/types/shared-types.ts` | Cross-cutting validation result types |
