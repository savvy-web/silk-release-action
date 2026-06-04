---
title: Multi-Registry Publishing and Integration
category: integration
status: current
completeness: 92
created: 2026-02-07
updated: 2026-05-22
last-synced: 2026-05-22
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
  - [Token Plumbing](#token-plumbing)
  - [Attestation System](#attestation-system)
  - [SBOM and Compliance System](#sbom-and-compliance-system)
  - [Publish Summary Generation](#publish-summary-generation)
  - [Type System](#type-system)
- [Rationale](#rationale)
- [File Reference](#file-reference)

## Overview

The release action supports publishing to multiple registries simultaneously with OIDC-first authentication, SBOM generation, and NTIA compliance validation. This document covers the registry infrastructure, authentication model, SBOM/compliance system, and the type system that ties them together.

Phase 3 is a self-recovering publish chain built on `@savvy-web/github-action-effects@2.0.0` library services. The old imperative registry modules (`registry-auth.ts`, `registry-utils.ts`, `pre-validate-target.ts`, `dry-run-publish.ts`, `resolve-targets.ts`, `publish-packages.ts`, `publish-target.ts`) are deleted. The `Attest` and `Sbom` services from the old `src/services/attest/` directory are now part of the library; that directory no longer exists in this repo. See `src/release/publish.ts` and `src/release/releases.ts` for the current Effect orchestration.

## Current State

### Publishability Detection (Silk Rules)

The silk publishability rules live in `src/release/publishability.ts`. Two Effect Layer implementations wrap the `PublishabilityDetector` Context.Tag from `workspaces-effect`:

**`SilkPublishabilityDetectorLive`** (`silkDetect`) consults `publishConfig` first, treating the `private` flag only as a last-resort default. In silk mode `private: true` is the norm on workspace `package.json` — it keeps the package out of accidental `npm publish` and out of transitive public installs — so publishability is derived from `publishConfig`, regardless of `private`. The build pipeline rewrites `private: false` onto the real publish artifact (e.g. `dist/npm`) while leaving the dev/link artifact (`publishConfig.directory`, e.g. `dist/dev`) private. Precedence:

1. `publishConfig.targets` non-empty → resolve each target, regardless of `private`. String shorthands (`"npm"`, `"github"`, `"jsr"`, URL strings) are expanded; object targets may override access and registry. Targets whose resolved access is not `"public"` or `"restricted"` are dropped.
2. `publishConfig.access` set, no `targets` → one target using that access, regardless of `private`.
3. `private !== true` (no usable `publishConfig`) → one default target.
4. Otherwise (private, no usable `publishConfig`) → empty array (not publishable).

This precedence fixed a regression where a public source package (`private: false`) declaring `publishConfig.targets` was short-circuited to a single default target at `publishConfig.directory` (the private `dist/dev` artifact), which the private-build filter then dropped — misclassifying it as version-only.

**`PublishabilityDetectorAdaptiveLive`** is the single ignore-aware detector. It short-circuits to `[]` for any package whose name matches the changeset `ignore` globs (via `ChangesetConfig.isIgnored`, which uses the shared `matchesIgnorePattern` matcher exported from `src/utils/detect-repo-type.ts`), regardless of mode. It then reads `ChangesetConfig.mode` per-call and dispatches to the silk override (silk mode), the library's built-in `PublishabilityDetectorLive` (vanilla mode), or a no-op detector that returns an empty array for every package (none mode). Every publishability path resolves through this layer: Phase 1 (`listPublishablePackages` / `isMonorepoForTagging`), Phase 2 (`runValidation` via `resolvePublishableTargets`) and Phase 3 (`runPublishTargets` via `PublishabilityDetector`).

Ignored packages are excluded from detection entirely, not just from publishing: Phase-2 `detectReleasedPackages` and Phase-3 `detectReleases` both drop changeset-ignored names via `ChangesetConfig.isIgnored`, so they never appear in validation or publish output — not even as version-only rows.

The implementation reads raw `package.json` from disk (not the typed `WorkspacePackage`) so it can see `publishConfig.targets`, which is not surfaced by the typed `PublishConfig` schema in `workspaces-effect`. The same rules are encoded identically in `silk-update-action` and the silk `changesets` package.

### Registry Infrastructure

#### Target Resolution (`src/release/resolve-targets.ts`)

`resolvePublishableTargets(pkg, workspaceRoot, detector)` is the Phase-2 seam. It calls `PublishabilityDetector.detect(pkg)` to get the raw `PublishTarget[]` and converts each to the internal `ResolvedTarget` shape with absolute paths, null-safe registry/tokenEnv, and shorthand expansion:

- `"npm"` — `registry.npmjs.org` with OIDC and provenance
- `"github"` — `npm.pkg.github.com` with the `SILK_GITHUB_PACKAGES_TOKEN` env var
- `"jsr"` — `jsr.io` with OIDC
- URL strings — custom npm-compatible registry; `tokenEnv` auto-generated from hostname (e.g. `https://registry.savvyweb.dev/` → `REGISTRY_SAVVYWEB_DEV_TOKEN`)

#### Authentication and publishing

Authentication and publishing are handled by library services in Phase 3:

- **`PackagePublish`** (library) — `pack(directory)` runs npm pack once per build directory; `publishTarball(path, opts)` publishes the pre-packed tarball; `setupAuth(registry, token)` writes auth to `~/.npmrc`. OIDC for npm and JSR is handled inside the library's `PackagePublish.publishTarball` implementation via `pnpm dlx npm` (fetches npm 11.x which supports OIDC trusted publishing; Node 24 ships npm 10.x which does not).
- **`NpmRegistry`** (library) — `getPublishedIntegrity(name, version, opts)` probes a registry for an existing version's tarball digest. Returns `Option.none()` when absent, `Option.some(digest)` when present. Used by `publishDirectoryGroup` before deciding whether to publish, skip, or abort.

Phase 2 dry-run validation uses `PackagePublish.dryRun` from the library, which runs `npm publish --dry-run` (via `pnpm dlx npm`) against each target registry.

#### Configuration Loading (`load-release-config.ts`)

Layered configuration with three sources in priority order:

1. **Local repository**: `.github/silk-release.json` or `.github/silk-release.jsonc` in the repository being released.
2. **Action input**: `sbom-config` action parameter (useful for reusable workflows where env vars do not propagate through `workflow_call`). Decoded through `SilkReleaseConfig` schema (`src/schema/silk-release-config.ts`) before use.
3. **Environment variable**: `SILK_RELEASE_SBOM_TEMPLATE` (for organization-wide defaults).

The first source found wins. All sources support JSONC via `jsonc-parser`.

### Token Plumbing

`process.env.GITHUB_TOKEN` is never written by the action. The token landscape has three distinct identities:

- **App installation token** — provisioned by `pre.ts` via `GitHubToken.provision()` and stored in `ActionState` under an internal key. Read by the Effect `main.ts` orchestrator via `GitHubToken.client()`. The `tokens.appToken()` helper in `src/utils/tokens.ts` exposes it for non-Effect callers.
- **Workflow packages token** — the optional `github-token` action input (typically `secrets.GITHUB_TOKEN` with `permissions: packages: write`). Stored in `GithubPackagesTokenState`. Exposed as `tokens.packagesToken()`, which prefers this token and falls back to the App token. npm publish subprocesses authenticate via `SILK_GITHUB_PACKAGES_TOKEN` (not `GITHUB_TOKEN`) to avoid interfering with the runner's OIDC environment.
- **OIDC tokens** — short-lived JWTs fetched on demand by `OidcTokenIssuer` (library service) for Sigstore/Fulcio signing and for npm/JSR trusted publishing. Not stored in state; fetched fresh per attestation run.

Attestation and storage-record calls use the workflow token because it carries `attestations:write` and `packages:write` from the workflow's own permissions block.

Under the 2.0 library all three identities are carried as `Redacted<string>` through the secret-bearing APIs (`GitHubApp.generateToken` / `revokeToken`, `GitHubClientLive.fromToken` / `fromApp`, `PackagePublish.setupAuth`, and the decoded `InstallationToken.token`). `PackagePublishLive` additionally requires `ActionOutputs` so it can mask the registry token via `setSecret` before writing `~/.npmrc`.

### Attestation System

The `Attest` and `Sbom` services are now part of `@savvy-web/github-action-effects@2.0.0`. The old `src/services/attest/` directory no longer exists in this repo; the library's published surface (`Attest`, `Sbom`, `SigstoreSigner`, `OidcTokenIssuer`) is consumed directly in `src/release/publish.ts` and `src/release/releases.ts`.

**Key properties of the current attestation flow:**

**Idempotency** — Before creating any attestation, `publishDirectoryGroup` calls `Attest.listForSubject(sha256, {predicateType})` for both `SLSA_PROVENANCE_V1` and `CYCLONEDX_BOM`. If an attestation already exists, the existing URL is reused and the target's `TargetPublishResult.recovered` field records `{provenance: true}` or `{sbom: true}`. A fresh attestation is written only when none exists.

**One attestation per build directory** — All targets that share a directory share the same tarball (same digest), so a single provenance + SBOM attestation pair covers all of them. Phase 2 generates one SBOM per build directory via `Sbom.generate`; Phase 3 uploads the saved SBOM JSON as a release asset and attests it.

**SBOM workspace-dep rewriting** — The `Sbom.generate` service rewrites workspace protocol references across all workspace packages (not just the released cycle), fixing `npm install 404` errors against npmjs.org for non-released sibling deps that previously had their local workspace reference preserved in the SBOM component list.

**Honest failure reporting** — Attestation failures are non-fatal. `Step.failure` is used (not an Effect defect) so the label is rendered with `❌` in the log and the step buffer is spilled, but the publish result is still recorded and the release can complete. The `TargetPublishResult.attestationUrl` is `undefined` rather than populated.

**OIDC via `pnpm dlx npm`** — Node 24 ships npm 10.x, which lacks OIDC trusted publishing. `PackagePublish.publishTarball` routes through `pnpm dlx npm` (which fetches npm 11.x) when the package manager is pnpm, enabling OIDC for npm and JSR.

**Storage-record linkage** — After a successful GitHub Packages publish, the library calls `GitHubArtifactMetadata` to POST a storage record linking the attestation to the artifact's metadata entry. This is what makes attestations appear in the org packages UI.

### SBOM and Compliance System

SBOM generation is handled by the `Sbom` service from `@savvy-web/github-action-effects`. The following modules in this repo provide metadata support and compliance validation:

**`infer-sbom-metadata.ts`** — Auto-detects SBOM metadata from `package.json` fields (license, author, repository, homepage). `resolveSBOMMetadata()` merges inferred and explicit configuration; explicit values win.

**`validate-ntia-compliance.ts`** — Validates SBOM documents against the 7 NTIA minimum elements: supplier name, component name, component version, unique identifier (PURL), dependency relationship, author of SBOM data, and timestamp. Each check returns a `NTIAFieldResult` with pass/fail status and an actionable suggestion. The `strict-warnings` input escalates NTIA compliance warnings to check failures.

**`detect-copyright-year.ts`** — Determines copyright start year with three-level precedence: config override (`copyright.startYear` in `silk-release.json`), npm registry first publication date (`npm view <pkg> time`), current year fallback.

The Phase-2 SBOM preview and Phase-3 SBOM assets are both built from the same `Sbom.generate` call output — Phase 2 generates and saves the SBOM to disk; Phase 3 reads it back for the release asset upload.

### Publish Summary Generation

`src/release/report.ts` replaces the old `generate-publish-summary.ts` and the separate `generate-release-notes-preview.ts` / `generate-sbom-preview.ts` modules. It uses the `ReportBuilder` and `GithubMarkdown` helpers from the library.

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

`@actions/attest` had three structural problems that the library's Effect service solves:

1. **Bundler incompatibility**: `@actions/core`'s barrel statically imports `oidc-utils.js` → `@actions/http-client` → `undici`. webpack/rspack cannot emit undici as CJS without producing `Class extends value [object Module] is not a constructor` at the `Dispatcher` class definition. The Effect service uses `@effect/platform` `HttpClient`, which is fully bundler-compatible.
2. **Opaque failure surface**: `@actions/attest` error messages did not surface the root cause from Fulcio or Rekor. The new `AttestError` carries a `reason` discriminator and `cause` chain.
3. **Private to the action**: `@actions/attest` is tightly coupled to the `@actions/` environment. The service is designed to live in `@savvy-web/github-action-effects` — it has been there since 1.2.0.

### Why Not Set GITHUB_TOKEN?

The action deliberately never writes `process.env.GITHUB_TOKEN`. The runner's `GITHUB_TOKEN` is used by the OIDC subsystem and by GitHub Actions' own trust mechanisms. Overwriting it breaks OIDC token fetches for npm and JSR trusted publishing. The `SILK_GITHUB_PACKAGES_TOKEN` env var is a namespaced alternative that carries the packages/attestation identity without contaminating the standard name.

### Why Idempotent Attestation?

Calling `Attest.listForSubject` before writing enables safe retries without duplicate attestations accumulating for the same subject. A recovered attestation is reported with `recovered: {provenance: true}` on the `TargetPublishResult` so the publish summary can surface that the attestation was reused rather than created fresh.

### Why Silk-Specific Publishability Rules?

`workspaces-effect`'s built-in `PublishabilityDetectorLive` treats `private: true` as a hard "not publishable" stop. Silk's convention inverts that: in silk mode `private: true` is the norm on workspace `package.json` (so a package never leaks into a public npm install transitively) and publishability comes from `publishConfig.targets` / `publishConfig.access`, with the `private` flag consulted only as a last-resort default. Consulting `publishConfig` before `private` is what lets a public source package that declares `targets` resolve to those targets rather than collapsing to a single default target at the private dev artifact. The `PublishabilityDetectorAdaptiveLive` dispatches to the silk override only when the repo uses the silk changesets preset, so vanilla repos are unaffected.

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
| `src/release/publishability.ts` | SilkPublishabilityDetectorLive (publishConfig-first precedence), PublishabilityDetectorAdaptiveLive (ignore-aware, single detector) |
| `src/release/changeset-config.ts` | ChangesetConfig service: single source of changeset-config truth (mode, versionPrivate, ignorePatterns, isIgnored, fixed) |
| `src/utils/detect-repo-type.ts` | Exports matchesIgnorePattern (shared changeset-ignore matcher behind ChangesetConfig.isIgnored) |
| `src/release/resolve-targets.ts` | resolvePublishableTargets seam (Phase 2 + Phase 3) |

### Phase-3 Orchestration

| File | Description |
| --- | --- |
| `src/release/publish.ts` | detectReleases, runBuildAndSbom, runPublishTargets, publishDirectoryGroup |
| `src/release/releases.ts` | runReleases: tags, GitHub releases, SBOM assets, attestations |
| `src/release/layers.ts` | ReleaseLive layer composition |
| `src/release/types.ts` | TargetPublishResult, ValidationFinding, ValidationPackageResult, etc. |

### Token Plumbing

| File | Description |
| --- | --- |
| `src/utils/tokens.ts` | appToken() and packagesToken() for non-Effect callers |
| `src/state.ts` | GithubPackagesTokenState schema |

### SBOM and Compliance

| File | Description |
| --- | --- |
| `src/utils/infer-sbom-metadata.ts` | Auto-detection from package.json |
| `src/utils/detect-copyright-year.ts` | Copyright year from npm registry |
| `src/utils/validate-ntia-compliance.ts` | NTIA 7 minimum elements validation |
| `src/utils/load-release-config.ts` | Layered configuration loading; SilkReleaseConfig decoding |
| `src/schema/silk-release-config.ts` | SilkReleaseConfig Effect schema; INPUT_SCHEMA_URL |

### Summary Generation

| File | Description |
| --- | --- |
| `src/release/report.ts` | buildValidationComment, buildPublishSummary, buildChecksTable, buildFindingsTable, buildReleaseNotesPreviewSummary, buildSbomPreviewSummary |

### Utility (Phase 2 support)

| File | Description |
| --- | --- |
| `src/utils/extract-release-notes.ts` | First-H2-to-second-H2 CHANGELOG section extraction |
| `src/utils/count-changesets.ts` | Changeset counts per package |
| `src/utils/derive-check-conclusion.ts` | Check-run conclusion with strict-warnings support |

### Type Definitions

| File | Description |
| --- | --- |
| `src/types/publish-config.ts` | ResolvedTarget, AuthSetupResult, and related types (Phase 1/2 utilities) |
| `src/types/sbom-config.ts` | SBOM metadata, CycloneDX, and NTIA compliance types |
| `src/types/shared-types.ts` | Cross-cutting validation result types |
