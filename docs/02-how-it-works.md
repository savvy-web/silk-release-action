# How it works

The action implements a three-phase release workflow. It automatically detects which phase to run based on the trigger context (branch, event type, commit message), or you can explicitly set the phase with the `phase` input.

## Phase 1: Branch management

**Triggers:** Push to `main` (non-release commits)

When new commits land on `main` that include changeset files, the action:

1. Scans for changeset files and identifies packages with pending releases
2. Categorizes packages as publishable (registry targets) or version-only (GitHub release only)
3. Checks if the release branch (`changeset-release/main`) already exists
4. If no branch exists: creates the branch, applies the pending changesets and opens a release PR
5. If the branch exists: rebases it onto `main` to incorporate new changes, detecting conflicts
6. Comments the release plan on the release PR and, when `auto-merge` is set, enables auto-merge on it

### Native versioning

Versioning happens in-process. The action bundles the changesets engine, so it applies version bumps and writes CHANGELOG entries itself rather than running a script from your repository — the branch-management job does not need your dependencies installed. The `changelog` id in your `.changeset/config.json` selects one of the bundled changelog generators (see [Changelog configuration](./03-configuration.md#changelog-configuration)); an unrecognized id fails the phase with an error naming the supported ids. GitHub attribution in generated entries (PR, commit and user links) is fetched with the action's App token.

If the repository root contains `biome.json` or `biome.jsonc`, the action runs `biome format --write .` after applying versions. A missing `biome` binary on `PATH`, or a Biome config that cannot resolve without `node_modules`, logs a warning and continues unformatted; any other formatting failure fails the phase. See [Post-version formatting](./03-configuration.md#post-version-formatting).

### Release PR title

The release PR title and the release-branch commit subject are derived from the packages that will release. A single releasable package or a group locked to one shared version gets `release: <version>`. An independent multi-package repo lists each release as `release: name@version, …`, omitting the npm scope shared by every package and collapsing to `release: <count> packages` once the title would exceed 100 characters. Packages excluded by changeset config are left out. The commit body is a bullet list of the releasing packages with their full scoped names. When no releasable package or version can be determined, the title falls back to the literal `release: pending` — a state in which Phase 1 closes the PR and deletes the branch anyway, so the fallback is a guard rail rather than a title anyone should see.

### Release plan comment

Phase 1 comments a "what will be released" table on the release PR as soon as the release plan is known: every package the release will version, its current and next version, its bump and how many changeset files named it. A package that releases only because a dependency moved appears with an em dash in the changesets column — it is versioned and gets a CHANGELOG entry without a changeset of its own.

The publish-readiness column reads `pending` until Phase 2 runs, rather than blank, because a blank cell is indistinguishable from "no targets". Validation fills the same table in place. The comment is a marker-delimited section stamped with the commit it describes, so a reader can tell whether it still reflects the branch, and it reaches a terminal state on every exit — including a crash or a cancellation.

### Auto-merge on the release PR

Setting the `auto-merge` input to `merge`, `squash` or `rebase` turns on GitHub's auto-merge for the release PR, so the next green check publishes. It is off by default: enabling it is a decision about a repository's release posture, not one the action makes on a consumer's behalf. Auto-merge needs branch protection with required status checks — without them there is nothing for it to gate on.

An unrecognized value fails the run rather than quietly disabling. A workflow that writes `auto-merge: sqush` wants auto-merge, and reading the typo as "off" would leave the release PR open indefinitely, looking like a defect in the action. A repository that rejects auto-merge only warns, because the release itself has already succeeded and the PR is there to merge by hand.

## Phase 2: Validation

**Triggers:** Push to `changeset-release/main` branch

When the release branch is updated (from Phase 1 or manual commits), the action validates the release:

1. Extracts issue references from commit messages and links them to the release
2. Runs `pnpm build` (or the configured package manager) to verify all packages compile
3. Performs a dry-run publish to each configured registry (npm, JSR, GitHub Packages, custom), rejecting any package whose built manifest still carries `catalog:` or `workspace:` specifiers, whose tarball would be empty or whose resolved publish directory is not one bound by its production build
4. Generates a Release Notes Preview check on the PR showing the CHANGELOG entries each package will publish
5. Creates a unified check run on the PR showing all validation results
6. Posts or updates a sticky comment on the release PR with a structured validation summary

The sticky PR comment includes:

- **What will be released** — the table Phase 1 posted, with the readiness column filled in: `n/m ready` per package, or `no targets` for a package that is versioned and changelogged but publishes nothing. A target skipped because an identical version was already published counts as neither ready nor failed
- **Findings** — a structured table of `error` and `warning` severity issues discovered during validation
- **SBOM preview** — resolved metadata per build target (when `sbom-config` is configured)

When the build fails or no packages have version differences, the comment replaces the release table with an explicit degraded-state notice rather than showing an empty or misleading table.

By default, warnings appear in the findings table but do not fail the check run (conclusion: `neutral`). Set `strict-warnings: "true"` to escalate warnings to `failure`. The two inputs compose: a `failure` conclusion blocks anything gated on check status, which includes both a branch-protection required check and the auto-merge the `auto-merge` input enables. Errors always fail regardless of the setting.

## Phase 3: Publishing

**Triggers:** Merge of release PR to `main`

When the release PR is merged, the action detects the merge and publishes:

1. Identifies which packages had version bumps by analyzing the PR diff
2. Publishes each package to all configured registries using the appropriate authentication — OIDC for npm and JSR, the `github-token` input for GitHub Packages, per-registry tokens for custom registries
3. Creates artifact attestations for published packages (provenance)
4. Determines the tag strategy — single tag for single-package repos, per-package tags for monorepos
5. Creates GitHub releases with auto-generated release notes from CHANGELOGs
6. Optionally generates SBOMs for published packages

**Dependency-first ordering:** in a monorepo the action processes packages in topological order, so a package's dependencies are published, tagged and released before the package itself — a dependent never appears on a registry ahead of something it needs.

**Step output:** each registry target reports one row under its package (`⬆ npm · published · registry.npmjs.org`, `⬆ github · no-token`), and a step's buffered transcript is flushed to the job log when the step exits — on success as well as on failure. A green release run is therefore verbose; nothing is withheld until something breaks.

**Self-recovering publish chain:** if one registry fails partway through (for example, GitHub Packages succeeds but npm fails), the action aborts before creating the GitHub Release and fails the run, so the job status matches what happened. On the next run it detects which registries already received the exact same tarball and skips them (`skipped-identical (recovery)`), then continues with the registries that still need publishing.

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

You can override automatic detection by setting the `phase` input to `branch-management`, `validation`, `publishing`, `close-issues` or `none`.

## Dry-run mode

Setting `dry-run: "true"` prevents any persistent changes:

- **Phase 1:** Shows what branch/PR would be created without creating them
- **Phase 2:** Runs validation but does not update PR comments or check runs
- **Phase 3:** Simulates publishing without actually pushing to registries, creating tags or GitHub releases

This is useful for testing your workflow configuration before going live.
