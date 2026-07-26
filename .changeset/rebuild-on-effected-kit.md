---
"@savvy-web/silk-release-action": major
---

## Breaking Changes

The action is rebuilt on the `@effected` kit. Its `action.yml` inputs and outputs are
unchanged — no workflow needs editing — but several runtime behaviours differ.

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

### The release plan is posted to the pull request as soon as it is known

Phase 1 now comments a "what will be released" table on the release pull request, listing every
package the release will version with its current and next version, its bump, and how many
changeset files named it. Publish readiness is shown as pending until validation runs, rather
than left blank or assumed — a blank cell is indistinguishable from "no targets".

The comment is a marker-delimited section stamped with the commit it describes, so a reader can
tell whether it still reflects the branch, and a later phase can update its own section without
disturbing this one. When the pull request already exists, the section is marked in-progress
before the branch work starts and reaches a terminal state on every exit — including a crash or
a cancellation, which previously would have left a stale result looking current.

## Bug Fixes

### Phase 1 reported zero changesets while cutting a release

The branch-management phase asked for a release plan before anything fetched the target branch,
so on the shallow clone a runner checks out, the plan could not be computed and the changeset
report silently read zero — in one observed run, immediately after five packages had been
versioned. The history fetch now happens before the plan is read.

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

### Pull request and summary links pointed at github.com on GitHub Enterprise

Two link builders hard-coded the `github.com` host, so the release pull request URL in the
action's output and the pull-request row in the validation check pointed at the public site
from an Enterprise instance. Both now read `GITHUB_SERVER_URL`, defaulting to
`https://github.com` where it is unset.

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
| @effected/commands | dependency | added | — | 0.1.0 |
| @effected/git | dependency | added | — | 0.5.1 |
| @effected/github | dependency | added | — | 0.1.0 |
| @effected/github-actions | dependency | added | — | 0.1.0 |
| @effected/markdown | dependency | added | — | 0.3.0 |
| @effected/npm | dependency | added | — | 0.5.0 |
| @effected/package-json | dependency | added | — | ~0.6.0 |
| @effected/sbom | dependency | added | — | 0.1.0 |
| @effected/semver | dependency | added | — | 0.2.1 |
| @effected/yaml | dependency | added | — | ~0.6.0 |
| @savvy-web/github-action-effects | dependency | removed | ^3.1.0 | — |
