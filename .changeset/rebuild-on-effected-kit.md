---
"@savvy-web/silk-release-action": major
---

## Breaking Changes

The action is rebuilt on the `@effected` kit, and its `action.yml` input surface changes:
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

## Features

### Phase 1 reports the full release plan, with versions

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

## Bug Fixes

### A failed publish reported a successful run

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

## Performance

* Phase 2 version comparison replaces one `git show` per package, run at unbounded
  concurrency, with a single cached workspace snapshot read at the target ref.

## Refactoring

* Phase 2 no longer resolves, decrypts or writes **any** publish credential. It previously
  resolved an npm token and a GitHub Packages token and wrote one to an `.npmrc` in order to
  run `npm pack --dry-run`, which never contacts a registry. Phase 3 publishing is unchanged.
* Roughly 1,400 lines of hand-rolled capability were deleted in favour of kit constructs —
  NTIA validation, SBOM metadata inference, changelog section extraction, changeset counting,
  check-summary truncation, registry classification, semver tag selection and GraphQL documents
  for linked issues, cross-reference lookup and issue commenting.
* Dead code removed: an unreachable repository-type detector and its helpers, and a
  Promise-shaped bridge whose only caller had already migrated.

## Dependencies

| Dependency | Type | Action | From | To |
| :--------- | :--- | :----- | :--- | :-- |
| @effected/commands | dependency | added | — | 0.2.0 |
| @effected/git | dependency | added | — | 0.5.1 |
| @effected/github | dependency | added | — | 0.2.0 |
| @effected/github-actions | dependency | added | — | 0.2.0 |
| @effected/markdown | dependency | added | — | 0.4.0 |
| @effected/npm | dependency | added | — | 0.6.0 |
| @effected/package-json | dependency | added | — | ~0.6.0 |
| @effected/sbom | dependency | added | — | 0.2.0 |
| @effected/semver | dependency | added | — | 0.2.1 |
| @effected/workspaces | dependency | updated | ^0.8.0 | ^0.9.0 |
| @effected/yaml | dependency | added | — | ~0.6.0 |
| @savvy-web/github-action-effects | dependency | removed | ^3.1.0 | — |
| @savvy-web/silk-effects | dependency | updated | ^4.2.6 | ^5.0.1 |
| @savvy-web/github-action-builder | devDependency | updated | ^2.0.6 | ^2.1.0 |
| @savvy-web/silk | devDependency | updated | ^3.2.3 | ^3.2.5 |
