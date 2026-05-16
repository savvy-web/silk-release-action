---
title: Multi-Registry Publishing and Integration
category: integration
status: current
completeness: 92
created: 2026-02-07
updated: 2026-05-16
last-synced: 2026-05-16
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
  - [Type System](#type-system)
  - [SBOM and Compliance System](#sbom-and-compliance-system)
  - [Publish Summary Generation](#publish-summary-generation)
- [Rationale](#rationale)
- [File Reference](#file-reference)

## Overview

The release action supports publishing to multiple registries simultaneously with OIDC-first authentication, SBOM generation, and NTIA compliance validation. This document covers the registry infrastructure, authentication model, SBOM/compliance system, and the type system that ties them together.

The publishing pipeline follows a strict sequence: resolve targets from `publishConfig`, authenticate against each registry, pre-validate all targets, run dry-run publishes, generate SBOM previews, and finally publish. This all-or-nothing approach prevents partial releases where some registries succeed and others fail.

## Current State

### Publishability Detection (Silk Rules)

Before any registry-specific logic runs, the action must answer a single
question: "is this package publishable, and if so, to how many targets?"
The silk-flavored rules are encoded in `src/utils/silk-publishability.ts`
(141 lines), which exports `silkDetect(pkgName, rawPackageJson) →
PublishTarget[]` (the `PublishTarget` Schema.Class comes from
`workspaces-effect`) and the convenience predicate
`isSilkPublishable()`.

The four rules, in order:

1. **`private !== true`** -- publishable to one default target. Registry,
   access, and directory come from `publishConfig` if present, else from
   defaults (`https://registry.npmjs.org/`, `"public"`, `"."`).
2. **`private === true` + `publishConfig.targets`** -- publishable to
   each target in the array. String targets (`"npm"`, `"github"`,
   `"jsr"`, or URL strings) inherit parent `access`; object targets
   may override `access` and `registry`. Targets whose resolved access
   is not `"public"` or `"restricted"` are dropped.
3. **`private === true` + `publishConfig.access`** (no `targets`) --
   publishable to one target using that access and the configured
   `registry`/`directory`.
4. **Otherwise** -- empty array (not publishable).

The helper is non-Effect on purpose: it consumes a `RawPackageJson`
plain object (not the typed `workspaces-effect` `PackageJson`) so it
can see `publishConfig.targets`, which is not in the typed
`PublishConfig` schema. Call sites that need access to `targets` re-read
the raw `package.json` from disk and pass it in. The same rules are
encoded identically in `pnpm-config-dependency-action` and the silk
`changesets` package; the three projects agree by construction on
which packages count as publishable.

Two release-action call sites consume `silkDetect`:

- **`detect-publishable-changes.ts`** (Phase 1) -- routes packages
  with a non-empty silk target list to the "publishable" bucket and
  packages with an empty list to "version-only" (GitHub release only).
  This replaces an older check that only honored `publishConfig.access`
  and would misclassify private packages with `publishConfig.targets`.
- **`release-summary-helpers.ts:getAllWorkspacePackages`** --
  populates `WorkspacePackageInfo.targetCount` from
  `silkDetect(...).length` so Phase 1 summaries and Phase 3 tag-strategy
  decisions count targets the same way as the routing logic above.

### Registry Infrastructure

#### Target Resolution (`resolve-targets.ts`, 208 lines)

Once a package is known to be publishable, `resolve-targets.ts` converts
its `publishConfig` to concrete `ResolvedTarget` objects with absolute
paths and null-safe registry/tokenEnv. The resolution follows four
rules:

1. No `publishConfig` + `private: true` -- empty array (not publishable)
2. No `publishConfig` + `private: false` -- default npm with OIDC
3. `publishConfig` without `targets` -- legacy single-npm mode
4. `publishConfig` with `targets` -- resolve each target individually

Shorthand expansion converts string identifiers to full target objects:

- `"npm"` -- `registry.npmjs.org` with OIDC and provenance
- `"github"` -- `npm.pkg.github.com` with `GITHUB_TOKEN`
- `"jsr"` -- `jsr.io` with OIDC
- URL strings -- custom npm-compatible registry with auto-generated
  `tokenEnv` from hostname

Registry-specific defaults are applied for provenance, access level, and
token environment variables. Custom registries generate token env names
by converting the URL hostname to an uppercase identifier (for example,
`https://registry.savvyweb.dev/` becomes `REGISTRY_SAVVYWEB_DEV_TOKEN`).

#### Registry Utilities (`registry-utils.ts`, 149 lines)

URL-safe registry detection using proper hostname parsing via the `URL`
API, not substring matching. This prevents CWE-20 injection attacks where
a malicious URL like `http://evil-npmjs.org` could be misidentified.

The `matchesDomain()` function requires either an exact hostname match or
a valid subdomain match (hostname ends with `.domain`), ensuring that
`registry.npmjs.org` matches `npmjs.org` but `evil-npmjs.org` does not.

Exported functions:

- `isNpmRegistry()` -- detects `npmjs.org` and subdomains
- `isGitHubPackagesRegistry()` -- detects `pkg.github.com` and subdomains
- `isJsrRegistry()` -- detects `jsr.io` and subdomains
- `isCustomRegistry()` -- anything that is not npm, GitHub Packages, or JSR
- `getRegistryType()` -- returns typed enum for a registry URL
- `getRegistryDisplayName()` -- human-readable names for summaries
- `generatePackageViewUrl()` -- web URLs for npm and GitHub Packages

#### Registry Authentication (`registry-auth.ts`, 523 lines)

Multi-registry auth setup with OIDC-first strategy. The module provides four primary functions:

**`validateRegistriesReachable()`** checks non-OIDC registries using `npm ping` with a 10-second timeout. Skips well-known OIDC registries (npm when no `NPM_TOKEN`, JSR) and GitHub Packages. Only tests custom registries that require token auth.

**`validateTokensAvailable()`** performs OIDC-aware token validation. JSR and npm (without `NPM_TOKEN`) are skipped because they use OIDC. GitHub Packages and custom registries must have their `tokenEnv` environment variable set.

**`generateNpmrc()`** writes `.npmrc` entries for non-OIDC registries. OIDC registries do not need `.npmrc` auth. The function supports both raw token values (wrapped with `_authToken=`) and pre-formatted auth strings (`_authToken=...` or `_auth=...` for htpasswd).

**`setupRegistryAuth()`** orchestrates the complete auth setup:

1. Reads tokens from action state (set by `pre.ts`) via `tokens.appToken()` / `tokens.packagesToken()`
2. Configures `NPM_TOKEN` if provided (disables OIDC for npm)
3. Sets `SILK_GITHUB_PACKAGES_TOKEN` for GitHub Packages (prefers workflow token with `packages:write`, falls back to App token). Note: this env var is used instead of `GITHUB_TOKEN` to avoid interfering with the runner's OIDC environment.
4. Parses `custom-registries` input for custom registry auth
5. Validates token availability across all targets
6. Checks custom registry reachability
7. Generates `.npmrc` with auth entries
8. Masks all secrets via `setSecret()`

Authentication strategy by registry:

| Registry | Method | Token Source |
| --- | --- | --- |
| npm public | OIDC trusted publishing (default) | None (id-token) |
| npm public | Token auth (when NPM_TOKEN set) | `NPM_TOKEN` |
| GitHub Packages | Workflow token or App token | `SILK_GITHUB_PACKAGES_TOKEN` |
| JSR | OIDC natively | None (id-token) |
| Custom registries | `custom-registries` input or App token | Per-registry env |

Custom registries input supports three formats:

- `https://registry.example.com/` -- uses GitHub App token
- `https://registry.example.com/_authToken=TOKEN` -- explicit token
- `https://registry.example.com/_auth=BASE64` -- htpasswd auth

#### Pre-Validation (`pre-validate-target.ts`, 238 lines)

Pre-flight checks run before dry-run publishing to catch configuration errors early. Each target is validated based on its protocol.

For npm-compatible targets:

- Target directory must exist
- `package.json` must exist and parse as valid JSON
- Package name must match the expected name
- `private: true` is not allowed for publishing
- GitHub Packages requires scoped names (`@org/name`)

For JSR targets:

- Scoped names are required (`@scope/name`)
- `exports` field must be present in `package.json` or `jsr.json`
- Falls back to `jsr.json` when `package.json` is missing

#### Dry-Run Publishing (`dry-run-publish.ts`, 217 lines)

Simulates publishing to test registry readiness without actually publishing. The module dispatches to protocol-specific implementations.

**`dryRunNpmCompatible()`** runs `npm publish --dry-run` via the package manager's dlx command (for example, `pnpm dlx npm publish --dry-run`). This avoids pnpm's strict branch validation that fails on release branches like `changeset-release/main`. The function:

- Sets registry, provenance, access, and tag flags
- Detects version conflicts ("cannot publish over previously published
  version")
- Extracts package statistics (packed size, unpacked size, file count)
- Reports provenance readiness

**`dryRunJsr()`** runs `jsr publish --dry-run` via the package manager's
dlx equivalent. JSR handles verification internally, so provenance is
always reported as ready.

#### Configuration Loading (`load-release-config.ts`, 377 lines)

Layered configuration with three sources searched in priority order:

1. **Local repository**: `.github/silk-release.json` or
   `.github/silk-release.jsonc` in the repository being released
2. **Action input**: `sbom-config` input parameter (useful for reusable
   workflows where env vars do not propagate through `workflow_call`)
3. **Environment variable**: `SILK_RELEASE_SBOM_TEMPLATE` (for
   organization-wide defaults)

The first configuration found wins. All sources support JSONC (comments
and trailing commas) via the `jsonc-parser` library.

Structural validation includes:

- Type checking for supplier, copyright, publisher, and documentation URL
- Detection of unwrapped SBOM config (a common mistake where users put
  supplier/copyright at root level instead of under an `sbom` key)
- Helpful error messages pointing to the JSON schema

### Token Plumbing

`process.env.GITHUB_TOKEN` is never written by the action. The token landscape has three distinct identities:

- **App installation token** — the action's primary GitHub identity. Provisioned by `pre.ts` via `GitHubToken.provision()` and stored in `ActionState` under an internal key. Read by the Effect-based `main.ts` orchestrator via `GitHubToken.client()`. The imperative publish utilities access it via `tokens.appToken()`, which calls `_actions-compat.ts`'s `getState("token")`.
- **Workflow packages token** — the optional `github-token` action input (typically `secrets.GITHUB_TOKEN` with `permissions: packages: write`). When provided, stored in `GithubPackagesTokenState`. Exposed as `tokens.packagesToken()`, which prefers this token and falls back to the App token. npm publish subprocesses authenticate via `SILK_GITHUB_PACKAGES_TOKEN` (not `GITHUB_TOKEN`) to avoid interfering with the runner's OIDC environment.
- **OIDC tokens** — short-lived JWTs fetched on demand by `OidcTokenIssuer` for Sigstore / Fulcio signing and for npm / JSR trusted publishing. Not stored in state; fetched fresh per attestation run.

Attestation and storage-record calls use the workflow token because it carries `attestations:write` and `packages:write` from the workflow's own permissions block.

### Attestation System

Attestation was migrated off `@actions/attest` entirely. The new system is a layered Effect service in `src/services/attest/` with a Promise-returning shim (`attest-runner.ts`) for the still-imperative Phase 3 callers.

**Flow for provenance attestation:**

1. `create-attestation.ts` calls `runProvenanceAttestation(subjectName, sha256, token)` in `attest-runner.ts`.
2. `attest-runner.ts` dynamically imports the Effect modules and builds a layer: `AttestLive + SigstoreSignerLive + OidcTokenIssuerLive(FetchHttpClient) + GitHubClientLive.fromToken(token)`.
3. `OidcTokenIssuer.getToken("sigstore")` fetches a Fulcio-audience JWT from the GitHub Actions token service.
4. `decodeJwtClaims` + `buildSLSAProvenancePredicate` construct a SLSA v1 predicate from the JWT.
5. `Attest.provenance()` builds the in-toto statement, hands it to `SigstoreSigner.signStatement()`, which produces a DSSE bundle via Fulcio + Rekor, then POSTs the bundle to `POST /repos/{owner}/{repo}/attestations`.
6. The returned `AttestationRecord` (attestation ID + UI URL) is passed back to the caller.

**Flow for SBOM attestation:**

1. `create-attestation.ts` calls `runSbomAttestation(subjectName, sha256, bom, token)` with an already-generated CycloneDX BOM JSON.
2. `attest-runner.ts` calls `Attest.attest()` directly with `predicateType: CYCLONEDX_BOM` so the BOM flows through without re-running the `Sbom` service.
3. Sign and upload steps are identical to provenance.

**Storage-record linkage:** After a successful GitHub Packages publish, `runCreateStorageRecord()` POSTs to `POST /orgs/{owner}/artifacts/metadata/storage-record` to link the attestation to the artifact's metadata entry. This is what makes attestations appear in the org packages UI. Previously this call was absent, so attestations were created but not surfaced.

**SBOM workspace-dep rewriting:** The workspace-deps rewriting in `create-attestation.ts` now covers all workspace packages (not just the released cycle). This fixes `npm install 404` errors against npmjs.org for non-released sibling deps that previously had their local workspace reference preserved in the SBOM component list.

**SBOM preview:** `generate-sbom-preview.ts` now feeds real `validatePublish` validation results rather than re-running the SBOM generation independently.

### Type System

#### Publish Configuration Types (`publish-config.ts`, 334 lines)

Core types for the publishing system:

**Protocol and target types:**

- `PublishProtocol` -- `"npm" | "jsr"`
- `PublishTarget` -- full target with registry, directory, access,
  provenance, tag, and tokenEnv
- `TargetShorthand` -- `"npm" | "github" | "jsr"` or URL strings
- `Target` -- union of `PublishTarget | TargetShorthand`
- `PublishConfig` -- the `publishConfig` section of `package.json`
- `ResolvedTarget` -- fully resolved with absolute paths and null-safe
  registry/tokenEnv

**Validation result types:**

- `PreValidationResult` -- directory, package.json, and field validation
- `DryRunResult` -- dry-run output with version conflict detection and
  package stats
- `PackageStats` -- packed size, unpacked size, file count
- `TargetValidationResult` -- combined pre-check and dry-run results per
  target
- `PackagePublishValidation` -- all targets for a package with SBOM
  validation

**Publish result types:**

- `PublishResult` -- actual publish outcome with registry URL, attestation
  URL, tarball digest, and already-published detection
- `AlreadyPublishedReason` -- `"identical" | "different" | "unknown"` for
  distinguishing safe skips from content mismatches
- `PrePackedTarball` -- reusable tarball info for multi-target publishing
  (pack once, publish to all targets with the same digest)
- `NpmVersionInfo` -- package metadata from `npm view`
- `VersionCheckResult` -- version existence check with integrity info
- `AuthSetupResult` -- registry auth setup outcome
- `PackageJson` -- minimal `package.json` interface

#### Shared Types (`shared-types.ts`, 69 lines)

Cross-cutting validation types used across the action:

- `ValidationResult` -- single validation check with name, success,
  checkId, and optional message
- `PackageValidationResult` -- per-package validation status with
  provenance flag

### SBOM and Compliance System

#### SBOM Types (`sbom-config.ts`, 328 lines)

NTIA-compliant SBOM metadata types supporting a layered configuration
system where auto-inferred values from `package.json` serve as defaults
and explicit configuration from `silk-release.json` overrides them.

**Configuration types:**

- `SBOMContact` -- contact name, email, and phone
- `SBOMSupplierConfig` -- required supplier name, organization URLs,
  and contacts (required for NTIA compliance)
- `SBOMCopyrightConfig` -- copyright holder and optional start year
  (auto-detected from npm registry first publication date)
- `SBOMMetadataConfig` -- supplier, copyright, publisher, and
  documentation URL
- `ReleaseConfig` -- top-level wrapper with `sbom` key
- `SBOMExternalReferenceType` -- CycloneDX 1.5 external reference
  type enum (vcs, issue-tracker, website, documentation, and others)
- `SBOMExternalReference` -- type, URL, and optional comment

**Inference and resolution types:**

- `InferredSBOMMetadata` -- auto-detected from `package.json` fields
  (author, repository, bugs, homepage, license)
- `ResolvedSBOMMetadata` -- merged result with supplier, component
  metadata, and author

**CycloneDX document types:**

- `EnhancedCycloneDXMetadata` -- timestamp, supplier, component (with
  PURL), and tools
- `EnhancedCycloneDXComponent` -- component with licenses, external
  references, publisher, and copyright
- `EnhancedCycloneDXDocument` -- full CycloneDX 1.5 SBOM with metadata,
  components, and dependencies

**Compliance types:**

- `NTIAComplianceResult` -- overall compliance with 7 minimum elements
- `NTIAFieldResult` -- individual field check with pass/fail, value, and
  improvement suggestion

#### SBOM Metadata Inference (`infer-sbom-metadata.ts`, 289 lines)

Auto-detects SBOM metadata from `package.json` fields:

**`parseAuthor()`** handles both string format
(`"Name <email> (url)"`) and object format (`{ name, email, url }`).

**`parseRepository()`** normalizes git URLs to HTTPS. Handles
`git+https://`, `git://`, and `git@host:org/repo.git` formats, stripping
the `.git` suffix.

**`parseBugs()`** extracts the issue tracker URL from either a string or
an object with a `url` property.

**`inferSBOMMetadata()`** reads `package.json` from a directory and
returns an `InferredSBOMMetadata` object with author name, author email,
VCS URL, issue tracker URL, documentation URL (homepage), and license.

**`formatCopyright()`** generates a copyright string with year range.
If start year equals current year, only the current year is shown.

**`resolveSBOMMetadata()`** merges inferred and explicit configuration.
Explicit values win. Builds external references from VCS, issue tracker,
documentation, and supplier URLs with deduplication.

#### SBOM Enhancement (`enhance-sbom-metadata.ts`, 247 lines)

Enriches a raw CycloneDX SBOM (from cdxgen) with supplier, publisher,
copyright, and external references.

**`generatePurl()`** creates Package URL identifiers with proper scope
encoding: `pkg:npm/%40scope/name@version`.

**`enhanceSBOMMetadata()`** performs the full enhancement flow:

1. Load config (provided or from `silk-release.json`)
2. Infer metadata from `package.json`
3. Detect copyright year (config override, npm registry, or current year)
4. Merge inferred and explicit config
5. Set supplier information
6. Set component metadata (publisher, copyright, PURL, external refs)
7. Set tool component (`workflow-release-action`)

**`mergeExternalReferences()`** deduplicates by `type:url` key, keeping
existing references when duplicates are found.

**`enhanceSBOMWithMetadata()`** provides a synchronous path for when
resolved metadata is already available (skips async copyright year
detection).

#### Copyright Year Detection (`detect-copyright-year.ts`, 142 lines)

Determines copyright start year with three-level precedence:

1. **Config override** -- `copyright.startYear` in `silk-release.json`
   (most users should not set this)
2. **npm registry** -- first publication date from `npm view <pkg> time`
3. **Current year** -- fallback for new/unpublished packages

**`fetchNpmPackageCreationDate()`** queries the registry for the
`time.created` timestamp. Handles 404 responses gracefully (new packages).

**`extractYearFromDate()`** safely extracts the year from an ISO date
string, falling back to the current year for invalid dates.

#### NTIA Compliance Validation (`validate-ntia-compliance.ts`, 256 lines)

Validates SBOM documents against the 7 NTIA minimum elements:

1. **Supplier Name** -- from `metadata.supplier.name`
2. **Component Name** -- from `metadata.component.name`
3. **Component Version** -- from `metadata.component.version`
4. **Unique Identifier** -- PURL from `metadata.component.purl`
5. **Dependency Relationship** -- presence of components or dependencies
   arrays (an empty dependency list is valid)
6. **Author of SBOM Data** -- from tools, supplier, or component
   publisher
7. **Timestamp** -- from `metadata.timestamp`

Each check returns a `NTIAFieldResult` with pass/fail status, the found
value, and an actionable suggestion for missing fields.

**`formatNTIAComplianceMarkdown()`** generates a markdown compliance
report with a summary header, field results table, and action items for
missing fields.

#### SBOM Preview Generation (`generate-sbom-preview.ts`, 471 lines)

Generates a comprehensive preview during the validation phase for
inclusion in PR check runs. The preview includes:

- Summary table with status, dependencies, components, and NTIA
  compliance percentage per package
- Per-package details with SBOM format version, supplier, and publisher
- External references (VCS, issue-tracker, documentation, website)
- License summary showing the top 10 licenses by component count
- NTIA compliance section with field-by-field analysis
- Component lists grouped by type (library, application, framework) in
  collapsible HTML details elements
- Raw SBOM JSON in a collapsible section for debugging

The function reuses existing SBOM validation results from the publish
validation phase when available, avoiding redundant SBOM generation.

### Publish Summary Generation

#### Summary Functions (`generate-publish-summary.ts`, 1,055 lines)

Generates comprehensive markdown summaries for different stages of the
publish pipeline.

**`generatePublishSummary()`** creates the pre-publish validation
summary. Includes a package summary table with status icons, version
bump types, changeset counts, and aggregate metrics (total packed size,
unpacked size, file count, targets ready). Per-package details are
shown in collapsible sections, expanded by default when errors or
warnings are present. Each target row shows registry, directory, packed
and unpacked sizes, file count, access level, and provenance status.

**`generatePublishResultsSummary()`** creates the post-publish results
summary. Shows overall success/failure with per-package target status
(published, skipped/identical, content mismatch, failed). Failed targets
include categorized error diagnostics with actionable hints.

**`generateBuildFailureSummary()`** creates a summary when the build
step fails, including the error output and troubleshooting steps.

**`generatePreValidationFailureSummary()`** creates a summary when
pre-validation fails (before any publishing is attempted). Includes
target status table, categorized error details with fix suggestions,
integrity comparison for content mismatches, and configuration help
sections specific to the type of registry that failed (custom, GitHub
Packages, or npm).

Error categorization detects and suggests fixes for:

- GitHub Packages permission errors (org packages, `packages:write`)
- OIDC trusted publishing issues (`id-token:write`)
- Authentication vs permission errors (401 vs 403)
- Version conflict detection
- Attestation/provenance errors (`attestations:write`)
- Custom registry auth errors with hostname-specific secret suggestions
- Network errors (timeout, connection refused, DNS failure)
- Content mismatch errors with integrity comparison

## Rationale

### Why Replace @actions/attest?

`@actions/attest` had three structural problems that the Effect service solves:

1. **Bundler incompatibility**: `@actions/core`'s barrel statically imports `oidc-utils.js` → `@actions/http-client` → `undici`. webpack/rspack cannot emit undici as CJS without producing `Class extends value [object Module] is not a constructor` at the `Dispatcher` class definition. The Effect service uses `@effect/platform` `HttpClient`, which is fully bundler-compatible.
2. **Opaque failure surface**: `@actions/attest` error messages did not surface the root cause from Fulcio or Rekor. The new `AttestError` carries a `reason` discriminator and `cause` chain.
3. **Private to the action**: `@actions/attest` is tightly coupled to the `@actions/` environment. The new service is designed to lift into `@savvy-web/github-action-effects` without interface changes once stable.

### Why Not Set GITHUB_TOKEN?

The action deliberately never writes `process.env.GITHUB_TOKEN`. The runner's `GITHUB_TOKEN` is used by the OIDC subsystem and by GitHub Actions' own trust mechanisms. Overwriting it breaks OIDC token fetches for npm and JSR trusted publishing. The `SILK_GITHUB_PACKAGES_TOKEN` env var is a namespaced alternative that carries the packages/attestation identity without contaminating the standard name.

### Why Dynamic Imports for Attest?

The Effect + sigstore dependency graph is heavy. Dry-run paths and phase-1/2 runs never need to sign or upload attestations. By wrapping all sigstore imports in `Promise.all([import(...), ...])` inside `attest-runner.ts`, the cold-start path of the main bundle pays none of that cost. Only Phase 3 attestation calls load the graph.

### Why Silk-Specific Publishability Rules?

`workspaces-effect`'s built-in `PublishabilityDetectorLive` treats
`private: true` as a hard "not publishable" stop. Silk's convention
broadens that: a package can be private (so it never leaks into a
public npm install transitively) while still being publishable to one
or more declared targets. The most common case is a package that
publishes only to GitHub Packages or to an internal silk registry. The
`silkDetect()` helper encodes that broadening in 141 lines and is
shared in spirit (not as a literal dependency) with
`pnpm-config-dependency-action` and the silk `changesets` package so
the three tools cannot drift.

Wiring `silkDetect()` into both `detect-publishable-changes.ts` and
`release-summary-helpers.ts:getAllWorkspacePackages` also closes a
prior bug where Phase 1 routing used
`hasPublishConfig && isPublicOrRestricted`, which honored only
`publishConfig.access`. Private packages declaring
`publishConfig.targets` were silently demoted to "version-only" and
never reached the publish step. Both call sites now go through the
same helper.

### Why OIDC-First Authentication?

OIDC (OpenID Connect) trusted publishing eliminates the need for
long-lived tokens. Tokens are short-lived and scoped to the specific
workflow run, removing the need for secret rotation. Both npm and JSR
support OIDC natively in GitHub Actions. The action falls back to token
auth when OIDC is not available (for example, when `NPM_TOKEN` is
explicitly provided for first-time publishes where OIDC is not yet
configured on npmjs.com).

### Why Pre-Validate All Targets?

The action validates every target for every package before publishing
any of them. This prevents partial releases where some registries
receive the new version and others do not. A partial release creates a
state that is difficult to recover from -- the published versions cannot
be unpublished from npm, and users may encounter inconsistent versions
across registries.

### Why CycloneDX Format?

CycloneDX 1.5 is the most widely supported SBOM format for npm packages.
It supports PURL (Package URL) identifiers natively, which are required
for the NTIA unique identifier minimum element. The format is generated
by cdxgen, which integrates with all major JavaScript package managers.

### Why Layered Configuration?

Multiple configuration sources (repo file, action input, environment
variable) support different organizational needs:

- **Repository-specific config** in `.github/silk-release.json` for
  per-repo supplier/copyright overrides
- **Action input** for reusable workflows where env vars do not propagate
  through `workflow_call` boundaries
- **Environment variable** for organization-wide defaults set as GitHub
  organization variables

The first source found wins, so repository config always overrides
organization defaults.

### Why Version Conflicts Are Not Errors?

A version conflict means the package is already published at that
version. This is expected in retry scenarios (for example, re-running a
failed workflow after one registry succeeded). The action compares
tarball integrity (shasum) to distinguish between safe skips (identical
content) and actual content mismatches (which are errors). This allows
the release of other packages to proceed while safely skipping
already-published ones.

### Why Pack Once for Multi-Target Publishing?

When publishing to multiple registries, the action packs the tarball
once and reuses it for all targets. This ensures every registry receives
identical content with the same SHA-256 digest. This is critical for
attestation linking -- provenance attestations reference a specific
digest, so all targets must share the same tarball to have valid
attestations.

### Why URL-Safe Registry Detection?

Substring matching on URLs is a security issue (CWE-20) because it can
be bypassed with malicious URLs like `http://evil-npmjs.org` (prefix
match) or `http://npmjs.org.evil.com` (suffix match). The registry
utilities parse URLs with the `URL` API and check hostnames via exact
match or proper subdomain match, preventing injection attacks.

## File Reference

### Type Definitions

| File | Description |
| --- | --- |
| `src/types/publish-config.ts` | Core publishing types (targets, validation, results) |
| `src/types/sbom-config.ts` | SBOM metadata, CycloneDX, and NTIA compliance types |
| `src/types/shared-types.ts` | Cross-cutting validation result types |

### Publishability Detection

| File | Description |
| --- | --- |
| `src/utils/silk-publishability.ts` | Silk publishability rules (private+targets, private+access, public default) |

### Token Plumbing

| File | Description |
| --- | --- |
| `src/utils/tokens.ts` | appToken() and packagesToken() for the publish chain |
| `src/utils/_actions-compat.ts` | Shim replacing @actions/core/exec/github (no undici) |

### Attestation System

| File | Description |
| --- | --- |
| `src/services/attest/service.ts` | Attest Context.Tag, AttestError |
| `src/services/attest/live.ts` | AttestLive: build + sign + upload |
| `src/services/attest/oidc.ts` | OidcTokenIssuer via @effect/platform HttpClient |
| `src/services/attest/signer.ts` | SigstoreSigner via @sigstore/sign v4 |
| `src/services/attest/sbom.ts` | Sbom: CycloneDX 1.5 BOM generation |
| `src/services/attest/intoto.ts` | Pure in-toto statement builder |
| `src/services/attest/slsa.ts` | SLSA Provenance v1 predicate builder |
| `src/services/attest/types.ts` | Shared attestation types and predicate constants |
| `src/services/attest/testing.ts` | AttestTest and SbomTest test layers |
| `src/utils/attest-runner.ts` | Promise shim: runProvenanceAttestation, runSbomAttestation, runCreateStorageRecord |
| `src/utils/create-attestation.ts` | Attestation orchestration (calls attest-runner) |

### Registry Infrastructure

| File | Description |
| --- | --- |
| `src/utils/resolve-targets.ts` | Target resolution from publishConfig |
| `src/utils/registry-utils.ts` | URL-safe registry detection and display |
| `src/utils/registry-auth.ts` | Multi-registry auth setup with OIDC |
| `src/utils/pre-validate-target.ts` | Pre-flight validation per target |
| `src/utils/dry-run-publish.ts` | Simulated publishing for readiness checks |
| `src/utils/load-release-config.ts` | Layered configuration loading |

### SBOM and Compliance

| File | Description |
| --- | --- |
| `src/utils/infer-sbom-metadata.ts` | Auto-detection from package.json |
| `src/utils/enhance-sbom-metadata.ts` | SBOM enrichment with PURL and metadata |
| `src/utils/detect-copyright-year.ts` | Copyright year from npm registry |
| `src/utils/validate-ntia-compliance.ts` | NTIA 7 minimum elements validation |
| `src/utils/generate-sbom-preview.ts` | SBOM preview for PR check runs |

### Summary Generation

| File | Description |
| --- | --- |
| `src/utils/generate-publish-summary.ts` | Pre/post-publish markdown summaries |
