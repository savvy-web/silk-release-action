# @savvy-web/silk-release-action

## 4.3.1

### Dependencies

* | Dependency              | Type       | Action  | From   | To     |                                                                              |
  | ----------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @savvy-web/silk-effects | dependency | updated | ^5.5.2 | ^5.6.0 | [#223][#223] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#223]: https://github.com/savvy-web/silk-release-action/pull/223

## 4.3.0

### Bug Fixes

* Numeric output fields in the published output JSON Schema (`releasePr.number`, `changesets.count`, `changesetCount`, `packageCount`, `componentCount`, `packedBytes`, `unpackedBytes`, `fileCount`, `totalTargets`, `readyTargets`, and release `id`) no longer accept the strings `"NaN"`, `"Infinity"`, or `"-Infinity"` as valid values. Those values were never legitimately produced by this action; the schema now correctly reflects that only real numbers are possible.
* Restored the `title`/`description` documentation on those same fields in the generated schema. The annotations had been silently dropped as a side effect of an internal Effect upgrade. [#219][#219]

### Dependencies

* | Dependency               | Type       | Action  | From           | To             |                                                                       |
  | ------------------------ | ---------- | ------- | -------------- | -------------- | --------------------------------------------------------------------- |
  | @effect/platform-node    | dependency | updated | 4.0.0-beta.101 | 4.0.0-beta.107 |                                                                       |
  | @effected/commands       | dependency | updated | ^0.3.1         | ^0.4.0         |                                                                       |
  | @effected/git            | dependency | updated | ^0.6.0         | ^0.7.0         |                                                                       |
  | @effected/github         | dependency | updated | ^0.2.3         | ^0.3.0         |                                                                       |
  | @effected/github-actions | dependency | updated | ^0.5.1         | ^0.6.0         |                                                                       |
  | @effected/jsonc          | dependency | updated | ^0.5.2         | ^0.6.0         |                                                                       |
  | @effected/markdown       | dependency | updated | ^0.4.2         | ^0.5.0         |                                                                       |
  | @effected/npm            | dependency | updated | ^0.8.3         | ^0.9.0         |                                                                       |
  | @effected/package-json   | dependency | updated | ^0.7.3         | ^0.8.0         |                                                                       |
  | @effected/sbom           | dependency | updated | ^0.2.3         | ^0.3.0         |                                                                       |
  | @effected/semver         | dependency | updated | ^0.3.2         | ^0.4.0         |                                                                       |
  | @effected/workspaces     | dependency | updated | ^0.10.2        | ^0.11.1        |                                                                       |
  | @effected/yaml           | dependency | updated | ^0.6.1         | ^0.7.0         |                                                                       |
  | @savvy-web/silk-effects  | dependency | updated | ^5.5.0         | ^5.5.2         |                                                                       |
  | effect                   | dependency | updated | 4.0.0-beta.101 | 4.0.0-beta.107 | [#219][#219] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#219]: https://github.com/savvy-web/silk-release-action/pull/219

## 4.2.0

### Features

* Package-manager detection now also consults `devEngines.packageManager`, which corepack treats as authoritative over the top-level `packageManager` field. Previously the lockfile-based probe could disagree with corepack about which manager owned the workspace.
* `dlx` now detects the workspace's package manager instead of always assuming pnpm. In an npm workspace it uses npm's prefix instead of invoking a `pnpm dlx` that isn't there; outside any workspace it now fails with a typed error instead of shelling out to a launcher that doesn't exist.

### Bug Fixes

* An unrecognized `phase` input now fails typed, naming the accepted values. Previously an invalid value was cast unchecked, missed every switch arm, fell through to a no-op default, and **silently skipped the entire release on a green job.**
* Three outputs are renamed to match the manifest's kebab-case convention: `closed_issues_count` → `closed-issues-count`, `failed_issues_count` → `failed-issues-count`, `closed_issues` → `closed-issues`. All three were previously written but never declared in `action.yml`, so no documented output contract covered the old names.
* Removed a leftover unmasked plaintext token write to the process environment; its only consumer had already been deleted, so the token was being exposed to every subsequent operation for no purpose.
* Under CI, the test suite no longer runs the action itself as an import side effect.

### Documentation

* `custom-registries` is now explicitly labelled NOT WIRED UP in `action.yml` and the docs — it has been a silent no-op since v0.2.3, tracked in [#215][#215]. [#217][#217]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#215]: https://github.com/savvy-web/silk-release-action/issues/215

[#217]: https://github.com/savvy-web/silk-release-action/pull/217

## 4.1.1

### Dependencies

* | Dependency               | Type       | Action  | From   | To     |                                                                              |
  | ------------------------ | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/github         | dependency | updated | ^0.2.2 | ^0.2.3 |                                                                              |
  | @effected/github-actions | dependency | updated | ^0.4.1 | ^0.5.1 |                                                                              |
  | @effected/npm            | dependency | updated | ^0.8.1 | ^0.8.2 |                                                                              |
  | @effected/package-json   | dependency | updated | ^0.7.2 | ^0.7.3 |                                                                              |
  | @effected/sbom           | dependency | updated | ^0.2.2 | ^0.2.3 |                                                                              |
  | @effected/semver         | dependency | updated | ^0.3.1 | ^0.3.2 |                                                                              |
  | @effected/workspaces     | dependency | updated | ^0.9.4 | ^0.9.5 |                                                                              |
  | @savvy-web/silk-effects  | dependency | updated | ^5.2.0 | ^5.3.0 | [#213][#213] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#213]: https://github.com/savvy-web/silk-release-action/pull/213

## 4.1.0

### Features

* ### Marker-delimited closing references in the release PR body

  Delimit the release PR's closing references with `silk-release:references` markers

  The bare `Closes #N` lines are now wrapped in a marker pair, making the region addressable by agents the way the summary region already was. A reference an agent adds for an issue the release never detected survives regeneration instead of being deleted on the next push.

  The opening marker carries an `owned` attribute listing the ids the action itself emitted. Without it, an id absent from `linkedIssues` is ambiguous — it could be an agent's addition or a reference the action emitted before it stopped tracking that issue — and preserving both would re-link, and on merge auto-close, an issue the release deliberately dropped. [#210][#210]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#210]: https://github.com/savvy-web/silk-release-action/pull/210

## 4.0.4

### Dependencies

* | Dependency               | Type       | Action  | From   | To     |                                                                              |
  | ------------------------ | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/commands       | dependency | updated | ^0.2.0 | ^0.2.1 |                                                                              |
  | @effected/git            | dependency | updated | ^0.5.1 | ^0.5.2 |                                                                              |
  | @effected/github         | dependency | updated | ^0.2.1 | ^0.2.2 |                                                                              |
  | @effected/github-actions | dependency | updated | ^0.4.0 | ^0.4.1 |                                                                              |
  | @effected/jsonc          | dependency | updated | ^0.5.1 | ^0.5.2 |                                                                              |
  | @effected/markdown       | dependency | updated | ^0.4.1 | ^0.4.2 |                                                                              |
  | @effected/npm            | dependency | updated | ^0.8.0 | ^0.8.1 |                                                                              |
  | @effected/package-json   | dependency | updated | ^0.7.1 | ^0.7.2 |                                                                              |
  | @effected/sbom           | dependency | updated | ^0.2.1 | ^0.2.2 |                                                                              |
  | @effected/semver         | dependency | updated | ^0.3.0 | ^0.3.1 |                                                                              |
  | @effected/workspaces     | dependency | updated | ^0.9.3 | ^0.9.4 |                                                                              |
  | @effected/yaml           | dependency | updated | ^0.6.0 | ^0.6.1 | [#206][#206] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#206]: https://github.com/savvy-web/silk-release-action/pull/206

## 4.0.3

### Refactoring

* Adopted `@savvy-web/silk-effects` 5.2.0's service-owned layer statics, replacing the removed standalone `*Live` exports with `static readonly layer` on each service class (`ChangesetConfig.layer`, `ChangesetConfigReader.layer`, `Changesets.ReleasePlanner.layer`, `Changesets.ConfigInspector.layer`, `SilkPublishability.layer` / `.layerAdaptive`). Layer composition, provided services, and runtime behavior are unchanged.
* Adapted to `@changesets/types` 7.0.0-next.8's discriminated `ComprehensiveRelease` union, where the `"none"` arm's `oldVersion`/`newVersion` are optional. The internal release-plan projection now models bumped and unbumped packages as distinct shapes; the reported release plan output is unchanged. [#199][#199]

### Dependencies

* | Dependency                | Type       | Action  | From          | To           |                                                                       |
  | ------------------------- | ---------- | ------- | ------------- | ------------ | --------------------------------------------------------------------- |
  | @changesets/changelog-git | dependency | updated | ^1.0.0-next.6 | 1.0.0-next.8 |                                                                       |
  | @effected/github          | dependency | updated | 0.2.0         | 0.2.1        |                                                                       |
  | @effected/github-actions  | dependency | updated | 0.2.0         | 0.4.0        |                                                                       |
  | @effected/markdown        | dependency | updated | 0.4.0         | 0.4.1        |                                                                       |
  | @effected/npm             | dependency | updated | 0.6.0         | 0.8.0        |                                                                       |
  | @effected/package-json    | dependency | updated | \~0.6.1       | \~0.7.1      |                                                                       |
  | @effected/sbom            | dependency | updated | 0.2.0         | 0.2.1        |                                                                       |
  | @effected/semver          | dependency | updated | 0.2.1         | 0.3.0        |                                                                       |
  | @effected/workspaces      | dependency | updated | ^0.9.1        | ^0.9.3       |                                                                       |
  | @effected/yaml            | dependency | updated | \~0.6.0       | ^0.6.0       |                                                                       |
  | @savvy-web/silk-effects   | dependency | updated | ^5.1.1        | ^5.2.0       | [#199][#199] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#199]: https://github.com/savvy-web/silk-release-action/pull/199

## 4.0.2

### Dependencies

* | Dependency              | Type       | Action  | From    | To      |                                                                              |
  | ----------------------- | ---------- | ------- | ------- | ------- | ---------------------------------------------------------------------------- |
  | @effected/package-json  | dependency | updated | \~0.6.0 | \~0.6.1 |                                                                              |
  | @effected/workspaces    | dependency | updated | ^0.9.0  | ^0.9.1  |                                                                              |
  | @savvy-web/silk-effects | dependency | updated | ^5.0.1  | ^5.1.1  | [#197][#197] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#197]: https://github.com/savvy-web/silk-release-action/pull/197

## 4.0.1

### Bug Fixes

* Restores the npm cache redirect for GitHub-hosted macOS runners, lost when npm execution moved onto `@effected/npm` in the v4 rebuild. macOS runner images ship a partially root-owned `~/.npm/_cacache`, which made every `npm pack` / `npm publish` / `npm view` call hard-fail with `EACCES` (errno -13, exit 243, "Your cache folder contains root-owned files") before doing any work — including a live Phase 3 publish that failed all 11 targets.

  * `ensureNpmCacheEnv()` runs as the first statement in `main.ts`, setting `npm_config_cache` to a runner-writable directory (`<RUNNER_TEMP ?? os.tmpdir()>/silk-npm-cache`) whenever it isn't already set, so every spawned npm process — `pnpm dlx npm@11` pack/publish/view and Phase 2 dry-runs — inherits the redirect through the environment
  * An explicitly configured `npm_config_cache` is always respected and left untouched [#194][#194]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#194]: https://github.com/savvy-web/silk-release-action/pull/194

## 4.0.0

### Breaking Changes

* The action is rebuilt on the `@effected` kit, and its `action.yml` input surface changes:
  two inputs are removed, one is added, and one becomes required in practice. Outputs are
  unchanged. Several runtime behaviours differ as well.

  ### Removed inputs: `skip-token-revoke` and `pr-title-prefix`

  `skip-token-revoke` was an opt-out of cleaning up a live credential, buying nothing the
  one-hour token expiry did not already provide while leaving a usable token in the runner for
  whatever ran next. **Revocation is now unconditional.**

  `pr-title-prefix` never reached a real title. Every branch that names packages or a version
  builds its own `release: …` string, so the input only worded two fallbacks that both mean
  "nothing is releasing" — a state in which Phase 1 closes the pull request and deletes the
  branch anyway. That fallback now reads `release: pending`, so every title the action emits
  carries one prefix.

  A workflow still passing either input gets GitHub's `Unexpected input(s)` **warning**, not a
  failure, so nothing breaks at the point of upgrade.

  ### `github-token` is required for GitHub Packages, not optional

  The input remains optional in `action.yml`, but any workflow publishing to GitHub Packages
  must pass it. **GitHub App tokens cannot access GitHub Packages at all** — the sole exception
  being the default GitHub Actions token, itself a special kind of App token — so the App
  installation token this action provisions is not a fallback, whatever permissions it carries.

  Without it, every GitHub Packages target now fails immediately with the missing input named,
  before any authentication or publish is attempted. Previously the same condition surfaced as a
  403 on the registry integrity probe, which reads as a package-permissions problem rather than a
  missing input.

  ### Validation fails on an unreadable target ref

  Phase 2 previously read each package's version with one `git show <target>:<pkg>/package.json`
  per package. A bad or unreadable ref made every package look brand-new, so the entire
  workspace reported as releasing. Version comparison now reads a single workspace snapshot at
  the target ref, and a failure to read it **fails validation** instead of silently reporting a
  full-workspace release.

  ### Successful steps now emit their full log transcript

  The predecessor's step lifecycle discarded a step's buffered output on success and spilled it
  only on failure, which kept a green release run to roughly one line per step. The kit's
  buffering flushes on every exit path, success included. **Green runs are substantially more
  verbose.** Nothing is lost — this is additional output, not different output.

  ### A concurrent branch write is now a visible conflict

  The release-branch ref move was a single forced update. It is now a forced reset followed by
  an unforced commit, so another writer landing between the two produces a **visible conflict**
  rather than being silently overwritten.

  ### Build validation always invokes the build script through `run`

  Phase 2 previously invoked the build script as `pnpm ci:build` for pnpm and yarn but
  `npm run ci:build` for npm and bun — an inconsistency inherited from the shell pipeline this
  replaced. All four package managers now go through `run`. The two forms are equivalent for
  pnpm and yarn, so no workflow changes, but a build script named the same as a package-manager
  subcommand no longer resolves differently between managers.

  ### `biome` present but failing is no longer treated as absent

  The formatting step probed for `biome` by running `biome --version` and reading *any* failure
  as "not installed", which conflated a missing binary with one that ran and errored. Presence
  is now determined by whether the process spawns at all, so a `biome` that exists and exits
  non-zero surfaces a genuine format failure instead of silently skipping formatting.

  ### Transient-failure retry is broader

  Retry classification during versioning widens from 5 error codes to 11 — adding
  `ECONNABORTED`, `ECONNREFUSED`, `EHOSTUNREACH`, `ENETUNREACH`, `EPIPE` and `socket hang up` —
  and comparison becomes case-insensitive. Both widen the set of failures that are retried.

### Features

* ### Phase 1 reports the full release plan, with versions

  `branchManagement.changesets.packages` now describes every package the release will version,
  read from the release plan rather than from the changeset files. Each entry gains:

  * `oldVersion` and `newVersion` — the version transition, known before the release runs
  * `changesetCount` — how many changeset files name the package

  **A package released only because a dependency moved now appears**, with `changesetCount: 0`.
  Such a package is versioned and gets a CHANGELOG entry but has no changeset of its own, so it
  was previously invisible in this output. `count` continues to report the number of changeset
  **files**, which is not the length of `packages` — one file may name several packages, and two
  files may name the same one.

  ### Opt-in auto-merge for the release pull request

  A new `auto-merge` input takes `merge`, `squash` or `rebase`, or empty to disable. It is **off
  by default**: enabling auto-merge on a release pull request means the next green check publishes
  packages, which is a decision about a repository's release posture rather than one this action
  should make on a consumer's behalf. Requires branch protection with required status checks.

  An unrecognised value **fails** rather than quietly disabling — a workflow that writes
  `auto-merge: sqush` wants auto-merge, and treating the typo as "off" leaves the release pull
  request open indefinitely looking like a defect in the action. A repository that rejects
  auto-merge only warns, because the release itself has already succeeded and the pull request
  remains there to be merged by hand.

  ### The release plan is posted to the pull request as soon as it is known

  Phase 1 now comments a "what will be released" table on the release pull request, listing every
  package the release will version with its current and next version, its bump, and how many
  changeset files named it. Publish readiness is shown as pending until validation runs, rather
  than left blank or assumed — a blank cell is indistinguishable from "no targets".

  Validation then completes the same table in place, filling the readiness column with how many
  registry targets are ready per package. A package that publishes nothing reports "no targets"
  rather than "0/0 ready", and a target skipped because an identical version was already published
  counts as neither ready nor failed.

  The comment is a marker-delimited section stamped with the commit it describes, so a reader can
  tell whether it still reflects the branch, and a later phase can update its own section without
  disturbing this one. When the pull request already exists, the section is marked in-progress
  before the branch work starts and reaches a terminal state on every exit — including a crash or
  a cancellation, which previously would have left a stale result looking current.

### Bug Fixes

* ### A failed publish reported a successful run

  `ActionOutputs.setFailed` emits the error annotation and deliberately does not set the exit
  code — that is the runtime's job, decided by whether the effect fails. Both Phase 3 abort paths
  annotated and then **returned**, so the effect succeeded and the step, job and workflow run all
  reported success.

  A release that published to some registries and not others, created no GitHub release, and
  logged `Publishing failed` was therefore **green**. Anyone reading the run status — including
  automation — saw a clean release. Both paths now fail with a typed error after annotating.

  ### The release window was bounded by the highest version tag, not the last release

  The commit walk that collects linked issues asked for the newest version-shaped tag. Across a
  monorepo those version lines are not comparable: `@scope/a@5.0.25` outranks `@scope/b@2.3.7`
  numerically while being several releases older. The boundary therefore landed on whichever
  package happened to hold the highest version anywhere in the repository.

  Worse, it was **stuck**. Nothing advanced it until some package out-bumped that version, so each
  release walked a range one release longer than the last and re-harvested issues that earlier
  releases had already closed. The boundary is now the merge commit of the most recently merged
  release pull request, which means "everything after this is unreleased" regardless of how
  packages are versioned or tags named.

  ### Issue collection disagreed with itself depending on whether the pull request existed

  Two independent collectors were in play. Creating the release pull request walked every commit
  in the range; updating an existing one scanned only **changeset commits** — for each pending
  changeset file, the single commit that added it.

  The narrower scope silently lost two cases: an issue attached to a pull request by hand
  contributed nothing unless that same commit also added a changeset, and a squash merge whose
  message dropped the closing reference could not be recovered from its merge point. The two
  paths also disagreed in the open: one release pull request reported four linked issues in its
  check and two in its description.

  Both paths now share one walk — close keywords from commit bodies, plus `closingIssuesReferences`
  from each merge commit's pull request — and issues attached to the release pull request itself
  are included, since they are closed on merge regardless and were otherwise absent from both the
  description and the check.

  ### Already-closed issues were re-announced by later releases

  An earlier release's merge commit is a legitimate merge commit, and its pull request still
  reports the issues it closed. Those issues were collected again, so a release could claim to
  close work that had already shipped. Closed issues are now dropped from the walk, so the check
  run, the pull request description and the branch links describe the same set.

  ### Phase 1 reported zero changesets while cutting a release

  The branch-management phase asked for a changeset *preview*, which renders each package's
  changelog entry and therefore resolves the configured changelog module. Phase 1 runs before
  dependencies are installed, so there was nothing to resolve it from and the read died inside
  module resolution — silently, because the failure was swallowed into an empty result. The
  report then read zero changesets immediately after five packages had been versioned. The phase
  now reads the release *plan*, which describes the same release without rendering changelogs.

  ### Releases could be published from a closed, unmerged pull request

  Phase detection tested a pull request's merge state with an idiom that was always true under
  the new merge-timestamp type. Every **closed-but-unmerged** release PR was read as merged,
  which selected the publishing phase — cutting a release from a PR that was closed without
  merging.

  ### Release notes could be taken from another package

  When a package's version had no section in its own changelog, the search fell back to the
  repository-root changelog. The fallback could not miss, so a package whose version was absent
  from the root changelog was attached the **newest root entry** — another package's release
  notes, published on its GitHub release.

  The fallback was also appended for **every** package, including ones whose own path resolved
  fine and simply had no changelog yet — a first release, or a package changesets wrote no notes
  for. In a monorepo whose root changelog happens to carry a heading for the same version string,
  that package's release notes silently became the root's, which reads more authoritative than
  the generic `Released version <x>` default it displaced. The root changelog is now consulted
  only when the package's own path could not be resolved at all.

  ### A transient `git status` failure destroyed a live release

  If `git status` failed while updating the release branch, the empty output was read as "no
  changes", which **closed the release pull request and deleted the remote release branch**, then
  reported a successful run. A non-zero exit is now a failure.

  ### Attestations could assert that a filename was a SHA-256

  When a publish target carried no tarball digest, the in-toto subject fell back to the file name
  and the digest was passed through unvalidated. The result was a signed, uploaded attestation
  claiming a file name was a SHA-256 hash. Digests are now validated, and a target without one is
  skipped rather than attested.

  ### `pkg@v1.0.0` tags were dropped from latest-tag selection

  Tag version extraction did not strip the leading `v` after the `@` separator, so the version
  failed to parse and the tag was silently ignored. This affects the **unscoped per-package tag
  shape this action itself creates**, so in an unscoped monorepo the latest-release lookup could
  return an older tag or none — shifting the commit range searched for linked issues.

  ### Every generated SBOM reported an NTIA element as missing

  `metadata.timestamp` was never set, so **every** SBOM the action produced failed NTIA element 7
  (timestamp) regardless of configuration. It is now set at generation time.

  ### Findings tables were corrupted by unescaped pipes

  Markdown tables were assembled by joining cells with `|` and escaping nothing. Any cell
  containing a pipe — the findings table renders **raw npm stderr**, and version ranges such as
  `>=1 || <2` are routine — shifted every column after it and added phantom columns. Cell content
  is now escaped.

  ### Linked issues carried an empty URL and node id

  Issues discovered by message reference only were recorded with `""` for both `url` and node id.
  The empty node id was also passed to the branch-linking mutation.

  ### The release pull request was closed mid-run and never recreated

  Updating the release branch reset it to the target head and only then committed the version
  changes. For the seconds between those two writes the pull request's head was identical to its
  base, and GitHub closes a pull request whose diff becomes empty. The branch ended up correct
  and the run reported success, but the release pull request was gone — taking its review
  history, subscribers and sticky comment with it. The commit is now built first and the branch
  reference moves once, straight to the finished commit, so the empty-diff state never exists.

  ### The release pull request body went stale when a release had no linked issues

  The managed region of the body was only refreshed when at least one linked issue was found. A
  release without linked issues kept whatever the region held from an earlier run, so it could
  describe versions that had since moved. The region now refreshes whenever there is a pull
  request.

  ### A closed release pull request was revived but not brought up to date

  Reopening used a snapshot of pull-request state taken at the start of the run, and the title
  refresh was skipped for any pull request that had been closed. A revived pull request kept a
  title naming an earlier version. State is now read fresh, a merged pull request is never
  reopened, and the title refreshes regardless.

  ### A failed changeset preview was reported as zero changesets

  The phase summary counted changesets through a fallback that turned any preview failure into an
  empty result, so "nothing to release" and "the preview broke" were indistinguishable in the
  log. A preview failure is now named at error level.

  ### Every GitHub link pointed at github.com on GitHub Enterprise

  Nine link builders hard-coded the `github.com` host, so from an Enterprise instance the release
  pull request URL, the validation check's pull-request row, issue and commit links, the run link
  in the pull request body, GitHub Packages pages, and **the URL reported for every GitHub
  release** all pointed at the public site. Links are now built against `GITHUB_SERVER_URL`,
  defaulting to `https://github.com` where it is unset — which is the github.com case, since only
  Enterprise sets the variable.

  ### The versioning retry reset the wrong working tree

  Phase 1's native versioning takes a directory, and both its config gate and `planner.apply`
  operate on it. The reset-then-retry path that runs after a transient failure did not: its
  `git checkout -- .` and `git clean -fd` ran in the **ambient process working directory**. Where
  those differed, the retry deleted untracked files somewhere unrelated — `git clean -fd` is
  destructive — and then re-applied onto a release tree that was still half-applied, which is the
  corruption the reset exists to prevent. Both commands now run in the directory they were given.

  ### An unwritable package directory blocked an otherwise-successful release

  Writing a package's SBOM to disk is documented as non-fatal, and the warning it emits says only
  that the release asset will be skipped. The result it returned disagreed: an SBOM write failure
  was folded into the same `ok` flag the publish phase treats as a fail-fast gate. A package
  directory that could not be written therefore **aborted Phase 3 entirely and failed the
  workflow** for a release whose build had succeeded. `ok` now reports only whether the build
  succeeded; a failed SBOM write names the package and costs it its SBOM asset, nothing more.

  ### Retrying release-PR creation could open a duplicate or fail outright

  Creating the release pull request was retried once on failure, but creation is not idempotent.
  If the first attempt reached GitHub and only the response was lost, the retry either opened a
  second release pull request or was rejected with a 422 — turning a transient network blip into
  a hard failure of the whole stage. The retry now re-lists open pull requests on the release head
  first and adopts an existing one, creating again only when there genuinely is none.

  ### Concurrent comment-section writes could publish over each other

  The section queue folds updates into one comment body, and three callers can reach that write:
  the batching fiber when its window elapses, an on-demand flush, and the scope finalizer. The
  write is a read-modify-write over the whole comment with nothing serialising it, so two
  overlapping runs both read the same body and the second overwrote the first's sections — the
  staleness the queue exists to prevent. Writes are now serialised, and the finalizer interrupts
  the batching fiber before its final drain so the last write is the complete one.

  ### Prerelease versions were reported as patch bumps

  Phase 2 recovers each package's bump from its version transition, parsing `major.minor.patch`
  by splitting on `.`. A prerelease or build suffix breaks that: `2.0.0-rc.1` splits to a third
  element of `0-rc`, which is not a number, so the unparseable-version guard fired and a **major**
  transition rendered as `patch`. Every prerelease understated its severity. The numeric core is
  now parsed before the suffix.

  ### The same release reported two different ready counts

  The publish totals line counted every target that had not failed as ready, while the release
  table counted only targets whose status was actually `ready`. A release with any skipped target
  therefore showed two different `n/m targets ready` figures in two adjacent sections of the same
  comment. Both now count the same thing.

  ### Scoped release tags produced broken links

  Per-package tags are scoped — `@scope/pkg@1.0.0` — and were embedded in release URLs
  unencoded. GitHub's own canonical URL for such a release encodes the `@` while keeping the `/`
  a real path separator (`/releases/tag/%40scope/pkg%401.0.0`). Tags are now encoded per path
  segment, matching what GitHub itself publishes; unscoped tags are unaffected.

### Performance

* Phase 2 version comparison replaces one `git show` per package, run at unbounded
  concurrency, with a single cached workspace snapshot read at the target ref.

### Refactoring

* Phase 2 no longer resolves, decrypts or writes **any** publish credential. It previously
  resolved an npm token and a GitHub Packages token and wrote one to an `.npmrc` in order to
  run `npm pack --dry-run`, which never contacts a registry. Phase 3 publishing is unchanged.
* Roughly 1,400 lines of hand-rolled capability were deleted in favour of kit constructs —
  NTIA validation, SBOM metadata inference, changelog section extraction, changeset counting,
  check-summary truncation, registry classification, semver tag selection and GraphQL documents
  for linked issues, cross-reference lookup and issue commenting.
* Dead code removed: an unreachable repository-type detector and its helpers, and a
  Promise-shaped bridge whose only caller had already migrated.

### Dependencies

* | Dependency                       | Type          | Action  | From   | To      |                                                                       |
  | :------------------------------- | :------------ | :------ | :----- | :------ | --------------------------------------------------------------------- |
  | @effected/commands               | dependency    | added   | —      | 0.2.0   |                                                                       |
  | @effected/git                    | dependency    | added   | —      | 0.5.1   |                                                                       |
  | @effected/github                 | dependency    | added   | —      | 0.2.0   |                                                                       |
  | @effected/github-actions         | dependency    | added   | —      | 0.2.0   |                                                                       |
  | @effected/markdown               | dependency    | added   | —      | 0.4.0   |                                                                       |
  | @effected/npm                    | dependency    | added   | —      | 0.6.0   |                                                                       |
  | @effected/package-json           | dependency    | added   | —      | \~0.6.0 |                                                                       |
  | @effected/sbom                   | dependency    | added   | —      | 0.2.0   |                                                                       |
  | @effected/semver                 | dependency    | added   | —      | 0.2.1   |                                                                       |
  | @effected/workspaces             | dependency    | updated | ^0.8.0 | ^0.9.0  |                                                                       |
  | @effected/yaml                   | dependency    | added   | —      | \~0.6.0 |                                                                       |
  | @savvy-web/github-action-effects | dependency    | removed | ^3.1.0 | —       |                                                                       |
  | @savvy-web/silk-effects          | dependency    | updated | ^4.2.6 | ^5.0.1  |                                                                       |
  | @savvy-web/github-action-builder | devDependency | updated | ^2.0.6 | ^2.1.0  |                                                                       |
  | @savvy-web/silk                  | devDependency | updated | ^3.2.3 | ^3.2.5  | [#191][#191] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Major Changes

[#191]: https://github.com/savvy-web/silk-release-action/pull/191

## 3.2.5

### Dependencies

* | Dependency                       | Type       | Action  | From   | To     |                                                                              |
  | -------------------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/workspaces             | dependency | updated | ^0.6.2 | ^0.8.0 |                                                                              |
  | @savvy-web/github-action-effects | dependency | updated | ^3.0.5 | ^3.1.0 |                                                                              |
  | @savvy-web/silk-effects          | dependency | updated | ^4.2.4 | ^4.2.6 | [#188][#188] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#188]: https://github.com/savvy-web/silk-release-action/pull/188

## 3.2.4

### Dependencies

* | Dependency                       | Type       | Action  | From          | To             |                                                                              |
  | -------------------------------- | ---------- | ------- | ------------- | -------------- | ---------------------------------------------------------------------------- |
  | @effect/platform-node            | dependency | updated | 4.0.0-beta.99 | 4.0.0-beta.101 |                                                                              |
  | @effected/jsonc                  | dependency | updated | ^0.5.0        | ^0.5.1         |                                                                              |
  | @effected/workspaces             | dependency | updated | ^0.6.1        | ^0.6.2         |                                                                              |
  | @savvy-web/github-action-effects | dependency | updated | ^3.0.4        | ^3.0.5         |                                                                              |
  | @savvy-web/silk-effects          | dependency | updated | ^4.2.3        | ^4.2.4         |                                                                              |
  | effect                           | dependency | updated | 4.0.0-beta.99 | 4.0.0-beta.101 | [#185][#185] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#185]: https://github.com/savvy-web/silk-release-action/pull/185

## 3.2.3

### Dependencies

* | Dependency              | Type       | Action  | From   | To     |                                                                              |
  | ----------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/workspaces    | dependency | updated | ^0.6.0 | ^0.6.1 |                                                                              |
  | @savvy-web/silk-effects | dependency | updated | ^4.2.1 | ^4.2.3 | [#180][#180] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#180]: https://github.com/savvy-web/silk-release-action/pull/180

## 3.2.2

### Dependencies

* | Dependency                       | Type       | Action  | From   | To     |                                                                              |
  | -------------------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @savvy-web/github-action-effects | dependency | updated | ^3.0.1 | ^3.0.4 |                                                                              |
  | @savvy-web/silk-effects          | dependency | updated | ^4.0.1 | ^4.2.1 | [#177][#177] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#177]: https://github.com/savvy-web/silk-release-action/pull/177

## 3.2.1

### Bug Fixes

* Adapt to `@effected/workspaces` 0.6.0 breaking changes: `findWorkspaceRootSync` is now path-first (`findWorkspaceRootSync(cwd, options)`), and `WorkspacePackage` requires a `workspaceRoot` field. Also bumps `@effected/jsonc` to 0.5.0 and pnpm to 11.15.1. [#174][#174]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#174]: https://github.com/savvy-web/silk-release-action/pull/174

## 3.2.0

### Refactoring

* Migrates the action's internals from Effect v3 to Effect v4 (`4.0.0-beta.98`) and the `@effected` kit. The `action.yml` inputs and outputs, the three-phase workflow, and the action's runtime behavior are unchanged — this is an internal library and API migration.

  * Schemas, service layers, and error handling ported to the Effect v4 API surface — `Schema.Literals`/`Schema.Union` array forms, `Effect.result`, `Effect.catch`, class-based services, and the single `NodeServices.layer` Node platform layer.
  * Workspace introspection moved from `workspaces-effect` to `@effected/workspaces`; topological release ordering now runs on the pure `DependencyGraph` value instead of the removed `TopologicalSorter` service.
  * JSONC config parsing moved to `@effected/jsonc`.

  ### Regenerated JSON Schema files

  The two SchemaStore documents (`silk-release-action.input.schema.json`, `silk-release-action.output.schema.json`) are now generated from the Effect schemas via Effect core's `JsonSchema` module, replacing `json-schema-effect`. They remain valid Draft-07, but the document root is now a `$ref` into `$defs` rather than an inlined body. This only affects editors and tools that consume these advisory schemas for completion/validation; it is not part of the `action.yml` contract.

### Dependencies

* | Dependency                       | Type          | Action  | From    | To            |                                                                       |
  | :------------------------------- | :------------ | :------ | :------ | :------------ | --------------------------------------------------------------------- |
  | effect                           | dependency    | updated | 3.22.0  | 4.0.0-beta.98 |                                                                       |
  | @effect/platform-node            | dependency    | updated | 0.107.0 | 4.0.0-beta.98 |                                                                       |
  | @effect/platform                 | dependency    | removed | 0.96.3  | —             |                                                                       |
  | @effected/workspaces             | dependency    | added   | —       | ^0.3.1        |                                                                       |
  | @effected/jsonc                  | dependency    | added   | —       | ^0.2.0        |                                                                       |
  | workspaces-effect                | dependency    | removed | ^2.1.0  | —             |                                                                       |
  | json-schema-effect               | dependency    | removed | ^0.3.0  | —             |                                                                       |
  | jsonc-parser                     | dependency    | removed | ^3.3.1  | —             |                                                                       |
  | @savvy-web/github-action-effects | dependency    | updated | ^2.4.0  | ^3.0.1        |                                                                       |
  | @savvy-web/silk-effects          | dependency    | updated | ^3.3.1  | ^4.0.1        |                                                                       |
  | @savvy-web/github-action-builder | devDependency | updated | ^1.1.2  | ^2.0.2        |                                                                       |
  | @savvy-web/silk                  | devDependency | updated | ^2.4.4  | ^3.0.2        |                                                                       |
  | @vitest-agent/plugin             | devDependency | updated | ^1.1.9  | ^2.0.0        | [#170][#170] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Minor Changes

[#170]: https://github.com/savvy-web/silk-release-action/pull/170

## 3.1.5

### Dependencies

* | Dependency              | Type       | Action  | From   | To     |                                                                              |
  | ----------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @savvy-web/silk-effects | dependency | updated | ^3.3.0 | ^3.3.1 |                                                                              |
  | workspaces-effect       | dependency | updated | ^2.0.3 | ^2.1.0 | [#166][#166] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#166]: https://github.com/savvy-web/silk-release-action/pull/166

## 3.1.4

### Dependencies

* | Dependency              | Type       | Action  | From   | To     |                                                                              |
  | ----------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @savvy-web/silk-effects | dependency | updated | ^3.2.5 | ^3.3.0 | [#163][#163] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#163]: https://github.com/savvy-web/silk-release-action/pull/163

## 3.1.3

### Dependencies

* | Dependency              | Type       | Action  | From   | To     |                                                                              |
  | ----------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @savvy-web/silk-effects | dependency | updated | ^3.2.3 | ^3.2.5 | [#160][#160] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#160]: https://github.com/savvy-web/silk-release-action/pull/160

## 3.1.2

### Dependencies

* | Dependency              | Type       | Action  | From   | To     |                                                          |
  | ----------------------- | ---------- | ------- | ------ | ------ | -------------------------------------------------------- |
  | @savvy-web/silk-effects | dependency | updated | ^3.2.2 | ^3.2.3 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 3.1.1

### Dependencies

* | Dependency              | Type       | Action  | From   | To     |                                                                              |
  | ----------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @savvy-web/silk-effects | dependency | updated | ^3.2.1 | ^3.2.2 | [#157][#157] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#157]: https://github.com/savvy-web/silk-release-action/pull/157

## 3.1.0

### Features

* ### Fix publishing under npm 12 and block unpublishable artifacts in Phase 2

  Every publish began failing with `npm pack returned empty result` once npm 12.0.0 took the `latest` dist-tag on 2026-07-08. The action's npm executor (`pnpm dlx npm`) resolved npm unpinned, and npm 12 changed `pack --json` from an array of entries to an object keyed by package name. Phase-2 sticky comments showed the same bug as a package size of zero files.

  Picked up by raising `@savvy-web/github-action-effects` to `^2.4.0`:

  * The dlx-fetched npm is pinned to `npm@11`, and `pack --json` is read in both the npm 11 array form and the npm 12 name-keyed object form. The pin stays on 11 because npm 12.0.0's `publish` throws `MODULE_NOT_FOUND: sigstore` (npm/cli#9722). A package literally named `error` is distinguished from npm's `{ error: … }` failure envelope by shape.
  * `pack` and `dryRun` refuse a manifest carrying `catalog:` or `workspace:` specifiers, and refuse a tarball with zero files.

  Picked up by raising `@savvy-web/silk-effects` to `^3.2.0`, and surfaced here:

  * Phase-2 validation records an **error** finding when a package's resolved publish directory is not one of the directories bound by its `dist/prod/targets.json`. The check fails and auto-merge is blocked, instead of packing a dev build. Remaining packages still validate and report.

  Refs #143, #144. [#151][#151]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#151]: https://github.com/savvy-web/silk-release-action/pull/151

## 3.0.2

### Bug Fixes

* ### `versionFiles`-managed JSON documents are no longer reformatted by a version bump

  Phase-1 native versioning previously round-tripped every changesets `versionFiles` target through `JSON.parse`/`JSON.stringify`, so bumping a version rewrote the whole document — inline arrays exploded to one element per line and any formatting outside the serializer's style was lost (visible as large spurious diffs on files like `.claude-plugin/plugin.json` in release PRs). The bundled `@savvy-web/silk-effects` 3.0.3 rewrites these files in place with minimal jsonc edits: a version bump now produces a one-line diff and the rest of the document survives byte-for-byte. JSONC documents (comments, trailing commas) are supported, and a wildcard-free JSONPath whose leaf property does not exist yet is inserted using the document's detected indentation. No Biome pass or dependency install is needed to keep formatting intact, so this works in the zero-install Phase 1.

  ### Dependencies

  The bundle ships `@savvy-web/silk-effects` 3.0.3, `@savvy-web/github-action-effects` 2.3.7, and a single deduped `jsonc-effect` 0.3.1. [#147][#147]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#147]: https://github.com/savvy-web/silk-release-action/pull/147

## 3.0.1

### Bug Fixes

* ### Silk-mode detection recognizes the `@savvy-web/changelog` changelog id

  Repos whose `.changeset/config.json` declares the canonical `@savvy-web/changelog` changelog adapter (what the current `savvy init` writes) were decoded as plain vanilla-changesets workspaces, so publishability detection fell through to `publishConfig.directory` and Phase 3 packed the **dev target** (`dist/dev/pkg`) instead of the prod byte groups (`dist/prod/<group>/pkg`). Dev manifests intentionally keep `catalog:`/`workspace:` specifiers unresolved, so affected packages shipped uninstallable manifests to npm (`yaml-effect@0.7.1` was published this way). Only the two legacy changelog ids (`@savvy-web/changesets`, `@savvy-web/silk/changesets`) were recognized.

  The bundled `@savvy-web/silk-effects` (3.0.1 and later) adds `@savvy-web/changelog` to the Silk changelog markers, so these repos are detected as Silk workspaces again: prod target groups, per-target renames, provenance, and group-keyed SBOM assets all apply. Fixes #143.

  ### Dependencies

  The bundle ships the refreshed first-party dependency set: `@savvy-web/silk-effects` 3.0.2, `@savvy-web/github-action-effects` 2.3.6, `workspaces-effect` 2.0.2, and `yaml-effect` 0.7.2 (the corrected prod artifact; 0.7.1 is deprecated on npm). The build now uses `@savvy-web/github-action-builder` 1.1.1. [#145][#145]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#145]: https://github.com/savvy-web/silk-release-action/pull/145

## 3.0.0

### Breaking Changes

* ### `version-command` input removed

  Phase 1 (release-branch management) no longer shells out to a consumer `ci:version` script. The `version-command` input is gone from `action.yml`, `.github/actions/release/action.yml`, `.github/actions/local/action.yml`, and the docs.

  **Migration:** delete any `version-command:` line from your workflow. Versioning is now applied natively — see below. If you relied on a custom version command for anything other than running `changeset version`, that behavior is no longer supported.

  ```diff
   - uses: savvy-web/silk-release-action@v3
     with:
       app-client-id: ${{ vars.APP_CLIENT_ID }}
       app-private-key: ${{ secrets.APP_PRIVATE_KEY }}
  -    version-command: "pnpm changeset version"
  ```

### Features

* ### Native changeset versioning — no `node_modules` required

  Phase 1 now applies pending changesets in-process using the bundled `@savvy-web/silk-effects` v3 `ReleasePlanner` — the same engine `savvy changeset version` runs — instead of invoking a package-manager script in the consumer's checkout. This means Phase 1 branch-management jobs no longer need a full dependency install to run.

  The consumer's configured `.changeset/config.json` `changelog` id is mapped onto an action-shipped ESM module, so no consumer `node_modules` is read for changelog generation either:

  | Configured changelog id                                                                           | Bundled module              |
  | ------------------------------------------------------------------------------------------------- | --------------------------- |
  | `@savvy-web/changelog`, `@savvy-web/silk/changesets/changelog`, `@savvy-web/changesets/changelog` | `dist/changelog-silk.js`    |
  | `@changesets/cli/changelog`                                                                       | `dist/changelog-default.js` |

  An unrecognized changelog id fails with a typed error naming the supported ids.

  Transient network failures during the changelog's GitHub-info fetch retry once, after resetting the working tree; the `GITHUB_TOKEN` used for that fetch always comes from the App token, taking precedence over any ambient `GITHUB_TOKEN` already set in the job, and the ambient value is restored once the fetch completes.

  ### Conditional post-version formatting

  When the repo has a `biome.json(c)` at its root, Phase 1 now runs `biome format --write .` after applying versions — replacing the `&& biome format` tail of the removed `ci:version` script. Phase 1 logs a warning and continues, rather than failing the phase, when the standalone `biome` binary isn't on `PATH`, or when the config extends a shareable preset (e.g. `@savvy-web/silk/biome`) that can't be resolved without an installed `node_modules`. Any other non-zero format exit still fails the phase.

### Dependencies

* | Dependency                       | Type          | Action  | From   | To            |                                                                       |
  | :------------------------------- | :------------ | :------ | :----- | :------------ | --------------------------------------------------------------------- |
  | @savvy-web/silk-effects          | dependency    | updated | ^2.1.0 | ^3.0.0        |                                                                       |
  | @savvy-web/github-action-builder | devDependency | updated | ^1.0.3 | ^1.1.0        |                                                                       |
  | @changesets/changelog-git        | devDependency | added   | —      | ^1.0.0-next.6 | [#139][#139] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Major Changes

[#139]: https://github.com/savvy-web/silk-release-action/pull/139

## 2.2.4

### Dependencies

* | Dependency                       | Type       | Action  | From   | To     |
  | -------------------------------- | ---------- | ------- | ------ | ------ |
  | @savvy-web/github-action-effects | dependency | updated | ^2.3.3 | ^2.3.5 |
  | @savvy-web/silk-effects          | dependency | updated | ^1.5.2 | ^2.1.0 |
  | json-schema-effect               | dependency | updated | ^0.2.4 | ^0.3.0 |
  | workspaces-effect                | dependency | updated | ^1.2.0 | ^2.0.1 |

## 2.2.3

### Bug Fixes

* [`997e402`](https://github.com/savvy-web/silk-release-action/commit/997e402b0d68facf503afd62dda6e536f3d4b96b) Explicitly declare `@types/node` version.

## 2.2.2

### Dependencies

* [`a7df8b4`](https://github.com/savvy-web/silk-release-action/commit/a7df8b4d34cedc93b412ae007897f35a2505e441) | Dependency | Type | Action | From | To |
  \| :------------------------------- | :------------ | :------ | :----- | :----- |
  \| @savvy-web/github-action-effects | dependency | updated | ^2.3.2 | ^2.3.3 |
  \| @savvy-web/silk-effects | dependency | updated | ^1.5.1 | ^1.5.2 |
  \| @savvy-web/github-action-builder | devDependency | updated | ^0.8.0 | ^1.0.1 |
  \| @savvy-web/silk | devDependency | updated | ^1.3.4 | ^1.3.5 |

## 2.2.1

### Bug Fixes

* [`fccd229`](https://github.com/savvy-web/silk-release-action/commit/fccd229118ed87f9eb81e53ea4d4a6b07beaf02b) Phase 3 GitHub releases and git tags are now created in the same topological (dependency-first) order as registry publishing. Previously, releases and tags were created in alphabetical workspace order while publishing ran dependency-first, so in multi-package repos the GitHub releases could appear out of order relative to the publish sequence.

### Dependencies

* | [`fccd229`](https://github.com/savvy-web/silk-release-action/commit/fccd229118ed87f9eb81e53ea4d4a6b07beaf02b) | Dependency    | Type    | Action | From   | To |
  | :------------------------------------------------------------------------------------------------------------ | :------------ | :------ | :----- | :----- | -- |
  | @savvy-web/github-action-effects                                                                              | dependency    | updated | ^2.3.0 | ^2.3.2 |    |
  | @savvy-web/silk-effects                                                                                       | dependency    | updated | ^1.5.0 | ^1.5.1 |    |
  | @savvy-web/silk                                                                                               | devDependency | updated | ^1.3.3 | ^1.3.4 |    |

## 2.2.0

### Features

* [`22e682d`](https://github.com/savvy-web/silk-release-action/commit/22e682d2d9178b16bc3accf4b0d7dea703765f29) Add a Turbo Cache diagnostics section to build validation. Detection now also recognizes the TURBO\_RUN\_SUMMARY environment variable in addition to the --summarize flag, all .turbo/runs summaries in a job are aggregated, and a collapsed Turbo Cache section (totals, REMOTE/LOCAL/MISS breakdown, per-task detail) is added to the build-validation summary. The concise console marker is unchanged. The feature is non-fatal.

## 2.1.1

### Bug Fixes

* [`df15068`](https://github.com/savvy-web/silk-release-action/commit/df15068b6da0b9a1ef23aa2a5a25720bb85f5aea) ### Pre-publish dry-runs no longer fail on the runner's npm cache

Phase-2 validation dry-runs were failing with `npm error code EACCES` ("Your cache folder contains root-owned files") on GitHub's macOS runners, where `~/.npm/_cacache` is partially root-owned and current npm refuses to use it. The dry-run now passes its `packageManager` through to `PackagePublish.dryRun`, which (via the updated `@savvy-web/github-action-effects`) runs npm against a runner-writable cache and dispatches through the same npm executor as the live publish. A dry-run therefore validates against the exact npm the publish will run instead of the runner's bundled one.

* [`df15068`](https://github.com/savvy-web/silk-release-action/commit/df15068b6da0b9a1ef23aa2a5a25720bb85f5aea) ### Pre-publish validation logs render as a per-package tree

Phase-2 validation previously emitted two flat, separate log groups per package-build (`Dry-run · <pkg> · <group>` and `SBOM · <pkg> · <group>`). It now renders one collapsible group per package-build — `Validate · <pkg>@<version>` — containing a `📦 pack` step (dry-run sizing), per-registry `⬆ <registry> · ready/not-ready` rows, and a `📄 sbom` step, capped by a summary line (`N ready · <size> · SBOM ok`). This mirrors the Phase-3 publish tree, so the two phases read consistently. The `ValidationReport` data is unchanged — only the log presentation.

* [`df15068`](https://github.com/savvy-web/silk-release-action/commit/df15068b6da0b9a1ef23aa2a5a25720bb85f5aea) ### Pre-publish validation now processes packages in dependency order

Phase-2 dry-run and SBOM steps ran in workspace glob order (alphabetical) because they iterated `WorkspaceDiscovery.listPackages()` directly, which does not sort by dependencies. Validation now orders released packages through `TopologicalSorter.sortSubset` — the same service the Phase-3 publish already uses — so a package is validated after the workspace dependencies it builds on, and the dry-run/SBOM log matches publish order. A cyclic graph falls back to discovery order rather than aborting validation.

## 2.1.0

### Features

* [`bfedcee`](https://github.com/savvy-web/silk-release-action/commit/bfedceec5756b206f3bcd90a371de098ec8c99a7) ### Rich publish-phase log tree

The Phase-3 publish group renders an icon-led tree per build group: `📦 pack`, one `⬆ <registry>` row per target, and `🔏 provenance` / `📄 sbom` rows carrying their attestation URLs. Absolute paths and zero-count tallies are gone, and an attestation row appears only when its URL exists.

### Bug Fixes

* [`bfedcee`](https://github.com/savvy-web/silk-release-action/commit/bfedceec5756b206f3bcd90a371de098ec8c99a7) The GitHub Packages link in a release's publish summary now uses the repository owner (`/orgs/<owner>/…`) instead of the literal `orgs/unknown`.

### npm-native provenance is captured and surfaced

npm's own trusted-publishing provenance URL — the Sigstore transparency-log entry npm prints when a tarball publishes with provenance — is parsed from the publish output and shown both in the log tree and in the release summary's Provenance column, alongside the action's own SLSA provenance, GitHub attestation, and SBOM links.

## 2.0.1

### Dependencies

* | [`c8b6976`](https://github.com/savvy-web/silk-release-action/commit/c8b69769055cea520f204389d04c7d7436f7d25e) | Dependency    | Type    | Action | From   | To |
  | :------------------------------------------------------------------------------------------------------------ | :------------ | :------ | :----- | :----- | -- |
  | @savvy-web/github-action-effects                                                                              | dependency    | updated | ^2.1.3 | ^2.1.4 |    |
  | @savvy-web/silk-effects                                                                                       | dependency    | updated | ^1.0.0 | ^1.1.0 |    |
  | json-schema-effect                                                                                            | dependency    | updated | ^0.2.1 | ^0.2.2 |    |
  | @savvy-web/github-action-builder                                                                              | devDependency | updated | ^0.7.6 | ^0.7.8 |    |
  | @savvy-web/silk                                                                                               | devDependency | updated | ^0.4.0 | ^0.4.2 |    |
  | @savvy-web/vitest                                                                                             | devDependency | updated | ^1.4.0 | ^1.5.0 |    |

- | [`f67fc7b`](https://github.com/savvy-web/silk-release-action/commit/f67fc7ba86fa29a0df01d65a6ef97cdf8c3eb9b0) | Dependency    | Type    | Action   | From     | To |
  | :------------------------------------------------------------------------------------------------------------ | :------------ | :------ | :------- | :------- | -- |
  | @effect/platform-node                                                                                         | dependency    | updated | ^0.106.0 | ^0.107.0 |    |
  | effect                                                                                                        | dependency    | updated | ^3.21.2  | ^3.21.3  |    |
  | @savvy-web/silk-effects                                                                                       | dependency    | updated | ^1.1.0   | ^1.2.0   |    |
  | json-schema-effect                                                                                            | dependency    | updated | ^0.2.2   | ^0.2.4   |    |
  | @savvy-web/github-action-builder                                                                              | devDependency | updated | ^0.7.8   | ^0.7.9   |    |
  | @savvy-web/silk                                                                                               | devDependency | updated | ^0.4.2   | ^1.1.0   |    |

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
