# @savvy-web/silk-release-action

## 2.0.0

### Breaking Changes

* [`c153bda`](https://github.com/savvy-web/silk-release-action/commit/c153bdad48f0fb9d71c385a4cafd71a86b066e7c) ### Adopts the `@savvy-web/bundler` per-byte-group prod layout

Publish and release now resolve targets from each package's `dist/prod/targets.json`
binding and operate on `dist/prod/<group>/pkg` — the byte-variant group layout the
new bundler emits — instead of a single publish directory. This requires
`@savvy-web/silk-effects` `^1.0.0` (Record-map `publishConfig.targets`,
binding-driven target resolution; the legacy array form is gone) and
`@savvy-web/github-action-effects` `^2.1.3`. `npm: true` + `github: true` collapse
into one tarball deployed to both registries.

### Features

* [`c153bda`](https://github.com/savvy-web/silk-release-action/commit/c153bdad48f0fb9d71c385a4cafd71a86b066e7c) ### Group `meta.tgz` doc bundle

Each byte-group now ships an unattested `…<group>.meta.tgz` release asset bundling
the bundler's `meta/` folder (`<unscoped>.api.json` + `tsconfig.json` +
`package.json`) plus the generated SBOM, for documentation builders. API-reference
docs are now read from the bundler's `meta/` folder rather than the publish dir.

### Bug Fixes

* [`c153bda`](https://github.com/savvy-web/silk-release-action/commit/c153bdad48f0fb9d71c385a4cafd71a86b066e7c) Cap all check-run summaries at GitHub's 65535-**byte** limit (UTF-8 bytes, not
  characters) so Phase-2 checks (build validation and publish dry-run) no longer
  fail with a 422 on large monorepos.
* Restore per-build packed/unpacked/file-count sizes in the validation output
  (sized via `npm pack --dry-run --json`).
* Label Phase-2 dry-run and SBOM steps by byte-group id rather than the now-uniform
  `pkg` directory basename.
* Surface npm's actual publish error (e.g. `ENEEDAUTH`, `E404`) in failures instead
  of an opaque exit code, and log the resolved auth-token key and target `.npmrc`
  (never the token) for auth debugging.

### Group-keyed release-asset names

Release assets are now keyed by byte-group: `<name>-<version>.<group>.tgz`, plus a
new `<name>-<version>.<group>.meta.tgz` and `<name>-<version>.<group>.sbom.json`.
This replaces the previous directory-prefix naming. Workflows that consume release
assets by exact filename must update.

### Release notes removed from the structured output

The per-package `releaseNotes` field of the `result` action output is now optional
and is omitted from the serialized payload — the full CHANGELOG content is rendered
in the dedicated Release Notes Preview check instead. Consumers that read release
notes out of `result` must read them from the release body or the preview check.

### Reliable token-auth publishing

GitHub Packages and first-time npm publishes now authenticate with the configured
registry token instead of failing on npm's auto-attempted OIDC trusted-publishing
exchange (which GitHub Packages does not support and an unconfigured npm package
cannot bootstrap). The npm public registry still prefers trusted publishing and
falls back to token auth when a package has no trusted publisher configured yet.

## 1.2.8

### Dependencies

* | [`78e04a0`](https://github.com/savvy-web/silk-release-action/commit/78e04a0a51dc60f60c30ecaa233e8a504a6f3226) | Dependency | Type    | Action | From   | To |
  | :------------------------------------------------------------------------------------------------------------ | :--------- | :------ | :----- | :----- | -- |
  | @savvy-web/github-action-effects                                                                              | dependency | updated | ^2.0.2 | ^2.1.1 |    |
  | @savvy-web/silk-effects                                                                                       | dependency | updated | ^0.6.0 | ^0.6.1 |    |

## 1.2.7

### Bug Fixes

* [`a02daac`](https://github.com/savvy-web/silk-release-action/commit/a02daac5afc5dd2bde8da03287b21538f592fc5b) Phase 3 now detects every released package even when a release commit changes more than 300 files. The commit-diff fallback previously used the GitHub compare endpoint, which caps a squash-merged (single-commit) comparison at its first 300 changed files — silently dropping packages whose `package.json` sorted past that limit. Detection now reads the merge commit's full file list via the paginated `changedFiles` API.

- `detectFromCommit` reads changed files via `GitHubCommit.changedFiles` instead of `compare`, so packages are no longer missed in large releases

### Other

* [`a02daac`](https://github.com/savvy-web/silk-release-action/commit/a02daac5afc5dd2bde8da03287b21538f592fc5b) Upgrade to `@savvy-web/silk` dependency system.

## 1.2.6

### Other

* [`418105f`](https://github.com/savvy-web/silk-release-action/commit/418105fe272a1457190f992669d475d097407b63) Upgrade to `@savvy-web/silk` standards

## 1.2.4

### Bug Fixes

* [`e74bbd7`](https://github.com/savvy-web/silk-release-action/commit/e74bbd76524fc2dd1c46a6c01edd8b3b91836abb) When Phase 1 runs on a push to `main` and `changeset version` produces no changes (no pending changesets), the action previously attempted to open or update a release PR against an identical branch, causing GitHub to reject it with `Validation Failed: No commits between main and changeset-release/main`. The run would fail.

The action now detects the no-op case in the update flow and treats it the same as the existing create-flow cleanup: it closes any open release PR and deletes the release branch, then finishes with a neutral status rather than an error.

## 1.2.3

### Bug Fixes

* [`4c7a937`](https://github.com/savvy-web/silk-release-action/commit/4c7a93772d98afdbdff9da5aab01926bc77bd088) Eliminates noisy `[@octokit/request] "GET .../attestations/sha256%3A..." is deprecated` warnings that appeared twice per published package during Phase 3. The warnings fired on the attestation idempotency probe (`Attest.listForSubject`) because the request ran under Octokit's default GitHub API version, whose attestations response shape GitHub has deprecated. The probe now pins `X-GitHub-Api-Version: 2026-03-10`. Attestation creation, linking, and idempotency behavior are unchanged — only the console noise is gone.

### Dependencies

* | [`4c7a937`](https://github.com/savvy-web/silk-release-action/commit/4c7a93772d98afdbdff9da5aab01926bc77bd088) | Dependency | Type    | Action | From  | To |
  | :------------------------------------------------------------------------------------------------------------ | :--------- | :------ | :----- | :---- | -- |
  | @savvy-web/github-action-effects                                                                              | dependency | updated | 2.0.1  | 2.0.2 |    |

## 1.2.2

### Dependencies

* | [`8f82f18`](https://github.com/savvy-web/silk-release-action/commit/8f82f181211b29a35fd955afb0a068bfd7bd4ccf) | Dependency    | Type    | Action | From    | To |
  | :------------------------------------------------------------------------------------------------------------ | :------------ | :------ | :----- | :------ | -- |
  | @savvy-web/github-action-effects                                                                              | dependency    | updated | ^2.0.0 | ^2.0.1  |    |
  | @savvy-web/silk-effects                                                                                       | dependency    | updated | ^0.4.1 | ^0.5.0  |    |
  | @savvy-web/commitlint                                                                                         | devDependency | updated | ^0.9.1 | ^0.10.0 |    |
  | @savvy-web/lint-staged                                                                                        | devDependency | updated | ^1.1.0 | ^1.2.0  |    |

## 1.2.1

### Bug Fixes

* [`15f9a76`](https://github.com/savvy-web/silk-release-action/commit/15f9a7695bdc6198e308244c2181b8510964379c) Fix release PR titles and version-bump commits showing the previous version (e.g. `release: 0.20.5` for a release that publishes `0.20.6`). Phase 1 now refreshes workspace discovery after `changeset version` runs, so the title and commit report the version that will actually be released rather than a pre-bump snapshot cached by `WorkspaceDiscovery`.

## 1.2.0

### Bug Fixes

* [`a72d920`](https://github.com/savvy-web/silk-release-action/commit/a72d92008a4f3a95f7e9334bbb1ec02990cc1e98) Resolve `publishConfig.targets` regardless of the `private` flag. A public source package (`private: false`) that declared explicit multi-registry targets was short-circuited to a single default target at `publishConfig.directory` (the private `dist/dev` artifact), which the private-build filter then dropped — misclassifying the package as version-only. Publishability now derives from the declared targets first.
* Honor the changeset `ignore` list across validation and publishing. Ignored example packages that carry `publishConfig.targets` (e.g. `@libraries/*`, `@rspress/*`) are now fully excluded from releases — no publish target, no version-only row, no tag.

### Refactoring

* [`a72d920`](https://github.com/savvy-web/silk-release-action/commit/a72d92008a4f3a95f7e9334bbb1ec02990cc1e98) Consolidate all publishability detection onto a single ignore-aware `PublishabilityDetector` layer. `ChangesetConfig` is now the single source of changeset-config truth (`mode`, `versionPrivate`, `ignorePatterns`, `isIgnored`, `fixed`), and the synchronous reimplementation of the silk rules in `release-summary-helpers.ts` has been removed in favor of an Effect-based `listPublishablePackages`.
* Extract the silk publishability + changeset-ignore detection into the shared `@savvy-web/silk-effects` (`^0.4.0`) library and consume it here, so the rules live in one place across the Silk tooling instead of being duplicated per repo.

## 1.1.0

### Features

* [`0a6d748`](https://github.com/savvy-web/silk-release-action/commit/0a6d74805df8629b41194e604575b7fa15168030) Rebranded the package and action to `@savvy-web/silk-release-action`. Workflows consume the action by repository path (`uses: savvy-web/silk-release-action@…`) and keep working through GitHub's repo redirect; action inputs and outputs are unchanged.
* Release PR titles and the release-branch commit subject now reflect the packages that will release: `release: <version>` for a single releasable package or a fixed group sharing one version, or `release: name@version, …` for repos that release packages on independent versions. A shared npm scope is omitted, and a long list collapses to `release: <count> packages`. The commit body lists each releasing package with its full scoped name.

### Bug Fixes

* [`0a6d748`](https://github.com/savvy-web/silk-release-action/commit/0a6d74805df8629b41194e604575b7fa15168030) Multi-workspace repositories with a single publishable package now title the release PR `release: <version>` instead of falling back to the `chore: release` prefix.
* Packages excluded via the changeset `ignore` list are no longer counted when detecting what can release, so example and fixture packages no longer skew the release title or tag strategy.
* Removed the decorative icons from the `Publish Validation`, `Release Notes Preview`, and `SBOM Preview` check-run names so all non-dry-run check titles render consistently.

### Dependencies

* | [`0a6d748`](https://github.com/savvy-web/silk-release-action/commit/0a6d74805df8629b41194e604575b7fa15168030) | Dependency | Type    | Action | From   | To |
  | :------------------------------------------------------------------------------------------------------------ | :--------- | :------ | :----- | :----- | -- |
  | @savvy-web/github-action-effects                                                                              | dependency | updated | ^1.2.0 | ^2.0.0 |    |

## 1.0.0

### Breaking Changes

* [`0f91109`](https://github.com/savvy-web/silk-release-action/commit/0f91109f5866c58fe02cb00c6412e7eda9d3f7c4) Action inputs renamed: `app-id` → `app-client-id`, `private-key` → `app-private-key`. Update your workflow `with:` blocks accordingly.
* Action outputs restructured: \~22 ad-hoc outputs replaced by a schema-defined `result` JSON output plus five scalar convenience outputs (`phase`, `status`, `succeeded`, `package-count`, `release-pr-number`). Callers reading removed output names receive empty strings. The output schema is published as `silk-release-action.output.schema.json`.

### Features

* [`0f91109`](https://github.com/savvy-web/silk-release-action/commit/0f91109f5866c58fe02cb00c6412e7eda9d3f7c4) **`strict-warnings` input** (boolean, default `false`) — escalates warning-level findings to check failures, allowing teams to enforce zero-warnings policies.
* **`result` output** carries machine-readable release outcome across all three phases with three orthogonal flags (`noop`, `succeeded`, `hasFailures`) and a phase-specific payload block.
* **Self-recovering publish chain** — if a registry publish fails mid-run, a re-run detects already-published packages and marks them `skipped-identical (recovery)`, then completes the remaining registries without duplicating work.
* **Step-buffered publish logging** — each package/registry step emits `✅ pack …: 122 kB · 10 files` on success or `❌ … : publish-failed` on failure. Failures are reported honestly; a failed step no longer shows a success marker.
* **Redesigned Phase-2 validation comment** — the sticky PR comment now shows a what-will-be-released table, a findings table, and an SBOM preview. Degraded states are rendered when the build fails or no packages have version diffs.
* **Input JSON Schema** (`silk-release-action.input.schema.json`) — full annotations, invariants, and examples for all action inputs.
* **Output JSON Schema** (`silk-release-action.output.schema.json`) — replaces the previous single-file schema; `$id` resolves to the canonical raw-content URL on `main`.
* SLSA Provenance v1 and CycloneDX SBOM attestations generated for every publish run and linked to org packages via the artifact-metadata storage-record API.
* Release-branch commits include a DCO `Signed-off-by` trailer via the App bot identity.
* SBOM workspace-dep resolution covers all workspace packages, fixing `npm install` 404s for non-released sibling dependencies.
* OIDC publish now routes through `pnpm dlx npm` to avoid incompatibilities with the npm 10.x bundled in Node 24.

### Bug Fixes

* [`0f91109`](https://github.com/savvy-web/silk-release-action/commit/0f91109f5866c58fe02cb00c6412e7eda9d3f7c4) **Single-root-workspace detection** — single-package repositories (no `packages/` glob) are now correctly detected as publishable rather than classified as monorepos with zero packages.
* **`sbom-config` input parsing** — the input is now read via the Actions config provider, preventing the hyphen-to-underscore env key mangling that caused SBOM metadata to be silently ignored.
* **SBOM attestation content** — attestations now attest the real SBOM document; previously the attested content was an empty dependency list.
* **Attestation deduplication** — one attestation is created per build directory; re-runs reuse existing attestations rather than creating duplicates.
* **SBOM and API-doc icons** in the publish summary now link to the correct artifact URLs.
* Publishing is idempotent: re-runs correctly skip already-published packages across all registries.
* Token plumbing is explicit: `process.env.GITHUB_TOKEN` is never written; each subsystem uses the correct token.

## 0.2.3

### Bug Fixes

* [`87d48fd`](https://github.com/savvy-web/silk-release-action/commit/87d48fdaad7e02a9585ee0f86f9150955201a4e9) Fix merge base checkout failure in Phase 2 validation by using `git checkout --force` and removing `silent: true` to surface git errors in logs

## 0.2.2

### Dependencies

* [`93e6efc`](https://github.com/savvy-web/silk-release-action/commit/93e6efc5b44b3e3ed7852da40076b6b66dbe0dc4) @savvy-web/changesets: ^0.3.0 → ^0.4.1
* @savvy-web/commitlint: ^0.3.4 → ^0.4.0
* @savvy-web/github-action-builder: ^0.1.4 → ^0.2.0
* @savvy-web/lint-staged: ^0.4.6 → ^0.5.0
* @savvy-web/vitest: ^0.1.0 → ^0.2.0

## 0.2.1

### Bug Fixes

* [`6ee65c1`](https://github.com/savvy-web/silk-release-action/commit/6ee65c159141a591bf70388043b03423cd24e4d9) Staged publish flow with diagnostic logging to prevent half-publishes and improve debuggability.

- Add diagnostic `debug()` logging to built package.json name resolution in both pre-validation and publish loops, making it visible in CI debug logs when the source name is used as fallback
- Implement staged pack-then-publish with abort gate: if any ready target fails to pack, the entire package is aborted before any publishing occurs, preventing partial registry state
- Add stderr capture and warning-level logging to `packAndComputeDigest` for actionable diagnostics when `npm pack` fails
- Elevate pack failure logging from `debug()` to `warning()` with stderr content, exit code, and specific failure reason

## 0.2.0

### Bug Fixes

* [`9be311c`](https://github.com/savvy-web/silk-release-action/commit/9be311c1216b5bb4aa4c66562f80addc0bbafcc4) Use per-target built package name for registry version checks and SBOM validation.

When a package publishes to multiple registries with different names (e.g., `my-pkg` for npm vs `@scope/my-pkg` for GitHub Packages), the release action now reads the built `package.json` in each target's directory to resolve the authoritative package name. This fixes incorrect version existence checks on registries where the published name differs from the source name, and removes the spurious "Package name mismatch" warning during Phase 2 pre-validation.

## 0.1.4

### Bug Fixes

* [`047f85e`](https://github.com/savvy-web/silk-release-action/commit/047f85eb59f1ab19569c3229d6f03aa16efdc7f3) Support @savvy-web/vitest
* Fix circular dependencies from @savvy-web/github-action-builder

## 0.1.3

### Features

* [`eb6a7a7`](https://github.com/savvy-web/silk-release-action/commit/eb6a7a7f65c973e63bbf884c1d7ea3715eab4215) Support for @savvy-web/changesets

## 0.1.2

### Patch Changes

* 7aff0ea: Fix branch management: create new PR when reopen fails after branch recreation, and update PR title with version for single-package repos on subsequent changesets.

## 0.1.1

### Patch Changes

* e3e60b8: Update dependencies:

  **Dependencies:**

  * @savvy-web/commitlint: ^0.3.1 → ^0.3.2
  * @savvy-web/github-action-builder: ^0.1.0 → ^0.1.2
  * @savvy-web/lint-staged: ^0.3.1 → ^0.4.0

## 0.1.0

### Minor Changes

* 9ac5f46: Add configurable supplier metadata for NTIA-compliant SBOMs

  This feature introduces a layered configuration system for SBOM metadata that:

  * Auto-infers metadata from package.json (author, repository, bugs, homepage)
  * Accepts explicit configuration from `.github/silk-release.json`
  * Supports fallback to `SILK_RELEASE_SBOM_TEMPLATE` environment variable
  * Merges inferred and configured values (config wins on conflicts)
  * Detects copyright start year from npm registry or configuration
  * Validates against NTIA minimum elements for SBOM compliance

  Configuration lookup order:

  1. `.github/silk-release.json` in your repository
  2. `SILK_RELEASE_SBOM_TEMPLATE` environment variable (from repo or org variable)

  New configuration options:

  * `sbom.supplier`: Company name, URL, and contact information
  * `sbom.copyright`: Holder name and optional start year
  * `sbom.publisher`: Publisher name for the component
  * `sbom.documentationUrl`: Documentation URL override

  The SBOM preview in validation now includes:

  * NTIA compliance status per package (7 required fields)
  * License summary
  * External references (VCS, issue tracker, documentation)
  * Actionable suggestions for missing compliance fields

  A JSON Schema is provided for IDE autocomplete support. Reference it in your config:

  ```json
  {
    "$schema": "https://raw.githubusercontent.com/savvy-web/silk-release-action/main/.github/silk-release.schema.json"
  }
  ```

  Fixes #28

### Patch Changes

* bf71211: Standardizes dependencies with @savvy-web/pnpm-plugin-silk

## 1.3.5

### Patch Changes

* 8ec59b0: fix(release): prevent duplicate tag creation in simple release workflow

  Fixed an issue where tags were created at the wrong commit when release PRs were merged. The workflow now skips `changeset publish` for single-private-package repos and uses manual tag creation to ensure tags are created at the correct release commit.

  **Changes:**

  * Added "Determine publish command" step to use no-op for single-private-packages
  * Manual tag creation now only runs when `published == 'true'`
  * Prevents `changeset publish` from creating tags that conflict with manual creation

  **Impact:**

  * Tags will now be created at the release commit (e.g., "chore: release X.X.X")
  * Eliminates duplicate tag errors when release PRs are merged
  * Fixes tag positioning being one commit behind

* 8ec59b0: Added comprehensive Copilot instructions document to guide AI coding agents working in this repository. This enhances developer experience when using GitHub Copilot and similar tools.

  **Changes:**

  * Added `.github/copilot-instructions.md` with detailed repository overview, workflows, and coding standards
  * Added `.github/instructions/.markdownlint.json` to configure Markdown linting for instructions directory
  * Provides context about shared GitHub Actions, reusable workflows, and automation tools

  **Impact:**

  * Improves AI-assisted development with better repository context
  * Standardizes guidance for coding agents across the codebase
  * Complements existing CLAUDE.md with Copilot-specific documentation

## 1.3.4

### Patch Changes

* c5260a8: Fix duplicate tag creation by enabling tag fetching in release workflow

  **Problem:** The release workflow was creating duplicate tags and failing on subsequent runs because tags weren't being fetched during checkout. When the workflow ran a second time (e.g., after a tag push), the `git rev-parse "$VERSION"` check couldn't detect existing tags, causing the workflow to attempt tag creation again.

  **Root Cause:** The `actions/checkout` step in the setup-release action had `fetch-tags: false` (the default), preventing the tag existence check from working correctly.

  **Solution:** Added `fetch-tags: true` to the checkout step in `.github/actions/setup-release/action.yml` to ensure tags are available for existence checks.

  **Impact:** The workflow now correctly skips tag creation when a tag already exists, preventing errors from duplicate tag attempts and allowing safe re-runs of the release workflow.

## 1.3.3

### Patch Changes

* 742a10e: Extract version-specific sections from CHANGELOG for GitHub releases

  GitHub releases now include only the relevant version section from CHANGELOG.md instead of the entire changelog history. The workflow parses the CHANGELOG structure and extracts content between the current version's `## {version}` heading and the next version heading.

  **Changes:**

  * Updated manual tag creation step in `release-simple.yml` to extract version-specific CHANGELOG section using awk
  * Fixed duplicate heading issue by skipping the version heading line in output
  * Added validation for empty changelog sections with fallback message
  * Documented expected CHANGELOG format (changesets-generated with `## version` headings)
  * Awk field-based matching handles whitespace variations robustly
  * GitHub releases now show clean, focused release notes for each version
  * Prevents changelog bloat in release descriptions

  **Edge Cases Handled:**

  * Empty changelog sections: Provides fallback message "No release notes found for this version"
  * Missing version sections: Handled gracefully with validation check
  * Works with standard changesets-generated CHANGELOG format

  **Example:** For version 1.3.2, the release notes will contain only the "## 1.3.2" section, not the full changelog history.

## 1.3.2

### Patch Changes

* b237263: Fix release workflow to create simple semver tags and properly publish releases

  **Root Causes:**

  1. The `check-changesets` job was preventing publish from running after release PR merges
  2. Needed simple semver tags (`1.3.2`) instead of scoped package tags (`@savvy-web/silk-release-action@1.3.2`)
  3. Manual tag creation was always running, even for multi-package repos where it shouldn't

  **Changes:**

  * Removed `check-changesets` job from both reusable workflows (changesets handles detection internally)
  * Updated `release-simple.yml` to use `pnpm changeset publish`
  * Updated `package.json` `ci:publish` script to run `changeset publish`
  * Fixed `setup-release` action to use full GitHub URL for node action reference
  * Added checkout steps before using local composite actions
  * Added required permissions to main release workflow
  * **Added repository type detection** in `setup-release` action:
    * Detects single-package private repos that need manual tag creation
    * Reads `packageManager` field from root `package.json` to determine which package manager to use
    * Uses package manager's native workspace list commands (e.g., `pnpm ls -r`, `npm query`, `yarn workspaces list`)
    * Checks root `package.json` for `"private": true`
    * Validates `.changeset/config.json` privatePackages settings
    * Outputs `is-single-private-package` flag for conditional tag creation
    * Outputs detected `package-manager` name for use in changeset commands
  * **Made changeset commands package-manager-aware**:
    * Dynamically constructs publish commands based on detected package manager
    * pnpm: `pnpm exec changeset publish`
    * npm: `npx changeset publish`
    * yarn: `yarn exec changeset publish`
    * bun: `bunx changeset publish`
  * **Made GitHub release creation conditional**:
    * Single-package private repos: `create-github-releases: false` (creates simple semver tags manually)
    * Multi-package repos: `create-github-releases: true` (lets changesets create releases per package)
  * **Updated manual tag creation step** to only run for single-package private repos

  **How It Works Now:**

  1. **When changesets exist:** Creates release PR with version bumps
  2. **When release PR merges:**
     * Changesets detects version changes and runs publish
     * Changesets creates scoped tag (`@savvy-web/silk-release-action@1.3.2`)
     * Workflow creates simple tag (`1.3.2`) and GitHub release with CHANGELOG content

## 1.3.1

### Patch Changes

* a9e963e: Fix release workflow to properly create GitHub releases and tags

  **Root Cause:**
  The `check-changesets` job was preventing the publish step from running when release PRs were merged, because changesets are consumed (deleted) during versioning. The changesets action internally handles detecting release PR merges by checking for version changes.

  **Changes:**

  * Removed `check-changesets` job and its condition from both reusable workflows
  * Updated `release-simple.yml` to use `pnpm changeset publish` as the publish command
  * Updated `package.json` `ci:publish` script to run `changeset publish`
  * Fixed `setup-release` action to use full GitHub URL for node action reference
  * Added initial checkout steps to both reusable workflows before using local composite actions
  * Added `contents: write` and `pull-requests: write` permissions to main release workflow

  **How It Works Now:**

  1. **When changesets exist:** Creates release PR with version bumps
  2. **When release PR merges:** Detects version changes, runs publish command, creates tags and GitHub releases

  **Technical Details:**
  For private packages, `changeset publish` creates the git tag and triggers GitHub release creation without attempting NPM publication.

## 1.3.1

### Patch Changes

* 64fff0b: Fix release workflow to properly create GitHub releases and tags

  The release workflow now runs `changeset publish` instead of a no-op echo command. This ensures that git tags are created and GitHub releases are generated with CHANGELOG content, even for private packages that don't publish to NPM.

  **Changes:**

  * Updated `release-simple.yml` to use `pnpm changeset publish` as the publish command
  * Updated `package.json` `ci:publish` script to run `changeset publish`
  * Fixed `setup-release` action to use full GitHub URL for node action reference
  * Added initial checkout steps to both reusable workflows before using local composite actions
  * Added `contents: write` and `pull-requests: write` permissions to main release workflow

  **Technical Details:**
  The `createGithubReleases` feature in the changesets action only works when `changeset publish` actually executes. For private packages, `changeset publish` creates the git tag and triggers GitHub release creation without attempting NPM publication.

## 1.3.0

### Minor Changes

* 4a79d88: Refactor release workflow into modular shared actions and reusable workflows

  **New Shared Actions:**

  * `setup-release` - Centralized release environment setup (GitHub App token, checkout, Node.js)
  * `check-changesets` - Lightweight changeset detection with count outputs
  * `run-changesets` - Configurable changesets execution with version detection

  **New Reusable Workflows:**

  * `release-standard.yml` - Multi-package releases with NPM publishing
    * Defaults to dry-run mode for safety
    * Explicit opt-in required for production publishing
    * Clear warning banners for dry-run vs production mode
  * `release-simple.yml` - Single-package releases with GitHub releases only
    * Perfect for private repos and GitHub Actions
    * No NPM publishing

  **Breaking Changes:**

  * Simplified `release.yml` to use new `release-simple.yml` reusable workflow
  * All workflows and actions now use local paths (`./.github/...`) instead of full GitHub URLs
  * Other repositories calling these workflows should use full URLs (`savvy-web/silk-release-action/.github/workflows/...@main`)

## 1.2.0

### Minor Changes

* 7b2c72f: ## New Biome Setup Action

  Introduces a new standalone composite action (`.github/actions/biome`) that automatically detects and installs the Biome version from your repository's configuration file. The Node.js setup action now uses this Biome action automatically.

  * Detects `biome.jsonc` or `biome.json` (prefers `.jsonc`)
  * Parses the `$schema` field to extract the version (e.g., `https://biomejs.dev/schemas/2.3.14/schema.json` → `2.3.14`)
  * Optional `version` input to override auto-detection and specify version explicitly
  * Falls back to `latest` with a warning if no config file or version is found
  * Can be used independently: `uses: savvy-web/silk-release-action/.github/actions/biome@main`
  * Outputs detected version and config file for downstream steps
  * Comprehensive README documentation with examples and troubleshooting

  ### Workflow Updates

  * Node.js setup action automatically runs Biome setup after dependencies install
  * Removes duplicate Biome setup steps from `release.yml` and `validate.yml` workflows

## 1.1.0

### Minor Changes

* 556da74: # Adds workflow to sync standard labels to repositories with workflow:standard property

  Adds a new workflow\_dispatch workflow that syncs standard workflow labels to repositories with the custom property `workflow:standard`.

  ## Key features

  * Loads standard labels from `.github/labels.json` configuration file
  * Queries organization for repositories with `workflow:standard` custom property
  * Creates missing standard labels on target repositories
  * Updates existing labels to match standard definitions
  * Preserves custom labels that are not in the standard definitions (by default)
  * **Optional custom label removal** for enforcing strict standardization
  * **Dry-run mode** for previewing changes without applying them
  * **Rate limiting** with automatic monitoring and throttling
  * **Enhanced label comparison** detecting name casing, color, and description differences
  * **Error accumulation** tracking partial failures per repository
  * Detailed per-repository statistics and comprehensive job summaries

  ## Standard labels included

  The workflow includes 18 standard labels covering common workflow needs: `ai`, `automated`, `bug`, `breaking`, `ci`, `dependencies`, `docs`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `performance`, `question`, `refactor`, `security`, `test`, and `wontfix`.

## 1.0.0

### Major Changes

* 115f8fe: # Enhance Node.js setup action with improved caching and reliability

  Simplifies the Node.js setup composite action with dedicated package manager steps, integrated Turbo cache support, and more robust version detection. Key improvements include:

  * Fix node version file detection to prevent parameter conflicts
  * Enable pnpm standalone mode for improved reliability
  * Add comprehensive documentation with usage examples and troubleshooting guides
