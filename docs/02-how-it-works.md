# How it works

The action implements a three-phase release workflow. It automatically detects which phase to run based on the trigger context (branch, event type, commit message), or you can explicitly set the phase with the `phase` input.

## Phase 1: Branch management

**Triggers:** Push to `main` (non-release commits)

When new commits land on `main` that include changeset files, the action:

1. Scans for changeset files and identifies packages with pending releases
2. Categorizes packages as publishable (registry targets) or version-only (GitHub release only)
3. Checks if the release branch (`changeset-release/main`) already exists
4. If no branch exists: creates the branch, runs the version command, and opens a release PR
5. If the branch exists: rebases it onto `main` to incorporate new changes, detecting conflicts

The release PR title and the release-branch commit subject are derived from the packages that will release. A single releasable package or a group locked to one shared version gets `release: <version>`. An independent multi-package repo lists each release as `release: name@version, …`, omitting the npm scope shared by every package and collapsing to `release: <count> packages` once the title would exceed 100 characters. Packages excluded by changeset config are left out. The commit body is a bullet list of the releasing packages with their full scoped names. When no releasable package or version can be determined, the title falls back to the `pr-title-prefix` input (default: `chore: release`).

## Phase 2: Validation

**Triggers:** Push to `changeset-release/main` branch

When the release branch is updated (from Phase 1 or manual commits), the action validates the release:

1. Extracts issue references from commit messages and links them to the release
2. Runs `pnpm build` (or the configured package manager) to verify all packages compile
3. Performs a dry-run publish to each configured registry (npm, JSR, GitHub Packages, custom)
4. Generates a Release Notes Preview check on the PR showing the CHANGELOG entries each package will publish
5. Creates a unified check run on the PR showing all validation results
6. Posts or updates a sticky comment on the release PR with a structured validation summary

The sticky PR comment includes:

- **What will be released** — a table showing each package's current version, next version, bump type, per-target pack sizes, and changeset count
- **Findings** — a structured table of `error` and `warning` severity issues discovered during validation
- **SBOM preview** — resolved metadata per build target (when `sbom-config` is configured)

When the build fails or no packages have version differences, the comment replaces the release table with an explicit degraded-state notice rather than showing an empty or misleading table.

By default, warnings appear in the findings table but do not fail the check run (conclusion: `neutral`). Set `strict-warnings: "true"` to escalate warnings to `failure`, which is useful when an auto-merge rule gates on check status.

## Phase 3: Publishing

**Triggers:** Merge of release PR to `main`

When the release PR is merged, the action detects the merge and publishes:

1. Identifies which packages had version bumps by analyzing the PR diff
2. Publishes each package to all configured registries using the appropriate authentication (OIDC for npm/JSR, tokens for GitHub Packages and custom registries)
3. Creates artifact attestations for published packages (provenance)
4. Determines the tag strategy — single tag for single-package repos, per-package tags for monorepos
5. Creates GitHub releases with auto-generated release notes from CHANGELOGs
6. Optionally generates SBOMs for published packages

**Step-buffered output:** each publish step emits a single summary line on success (e.g. `✅ pack @scope/pkg: 122 kB · 10 files`) and a `❌` header with debug context on failure. This keeps logs scannable while preserving full detail for failures.

**Self-recovering publish chain:** if one registry fails partway through (for example, GitHub Packages succeeds but npm fails), the action aborts before creating the GitHub Release. On the next run it detects which registries already received the exact same tarball and skips them (`skipped-identical (recovery)`), then continues with the registries that still need publishing.

**Idempotent attestation:** if the run is retried after a partial failure, the action will not create duplicate attestations for packages that were already attested.

## Phase detection

The action determines the phase automatically:

| Context | Phase |
| --- | --- |
| Push to `main`, no associated merged release PR | Branch Management |
| Push to `changeset-release/main` | Validation |
| Push to `main` with merged release PR detected | Publishing |
| PR closed/merged from `changeset-release/main` | Publishing |
| `phase` input set explicitly | The specified phase |

You can override automatic detection by setting the `phase` input to `branch-management`, `validation`, `publishing`, `close-issues`, or `none`.

## Dry-run mode

Setting `dry-run: "true"` prevents any persistent changes:

- **Phase 1:** Shows what branch/PR would be created without creating them
- **Phase 2:** Runs validation but does not update PR comments or check runs
- **Phase 3:** Simulates publishing without actually pushing to registries, creating tags, or GitHub releases

This is useful for testing your workflow configuration before going live.
