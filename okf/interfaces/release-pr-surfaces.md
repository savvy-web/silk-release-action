---
type: Interface
title: Release PR surfaces
description: "The two managed regions a reader of the release PR relies on: the PR description's marker-delimited region, and the sticky comment's independently-stamped sections."
kind: wire
resource: ../../src/utils/managed-sections.ts
tags: [release, observability]
sources:
  - id: managed-sections-ts
    resource: ../../src/utils/managed-sections.ts
  - id: write-sections-ts
    resource: ../../src/utils/write-sections.ts
  - id: publish-release-plan-ts
    resource: ../../src/steps/publish-release-plan.ts
  - id: pr-body-test-ts
    resource: ../../__test__/pr-body.test.ts
  - id: silk-effects-prbody
    resource: "npm:@savvy-web/silk-effects#PrBody"
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: c5913a62f8abc5ea9cd1eb14e2f2f41aa7e31dd15bac8faa551ca66acdcb8a4b
---

# Release PR surfaces

A reader of a release PR relies on two independently-written surfaces: the
pull request's own **description**, and a **sticky comment** on it. Both are
managed regions — bytes a human or another tool wrote outside them survive
untouched — but they are owned by different code and have different
contracts.

## The PR description's managed region

The release PR description's managed slice is **owned upstream, not in this
repository**: `PrBody` in `@savvy-web/silk-effects` owns the
marker-delimited region and its two nested regions, and this repository
consumes `PrBody.ManagedPrBody`, `PrBody.Markers`, and
`PrBody.LinkedIssueRef` rather than reimplementing any of it.[^silk-effects-prbody]
`__test__/pr-body.test.ts` is a contract smoke test over the properties this
repository's two call sites (`src/utils/create-release-branch.ts`,
`src/utils/update-release-branch.ts`) depend on — not a reimplementation of
the upstream suite.[^pr-body-test-ts]

The region is delimited by `<!-- silk-release:start -->` /
`<!-- silk-release:end -->`.[^pr-body-test-ts] Inside it sit two nested
regions:

- **`summary`** — reserved for an external AI summariser. `ManagedPrBody.build`
  regenerates the whole managed region on every run, so a summary not read
  back first with `ManagedPrBody.extractSummary` before the next `build` call
  is silently destroyed; carrying it through is this repository's
  responsibility, not the library's.[^pr-body-test-ts]
- **`references`** — always emitted, empty or not, so it stays an
  addressable target across runs. It carries an `owned="…"` attribute
  listing the issue ids the emitting run itself linked; a later run
  subtracts its own emitted ids from what it reads back, so it carries
  through only references a human or another agent added, and a malformed
  or unparseable `owned` attribute is read as "none owned" — which means
  *preserve*, not *drop*.

### Two non-interchangeable closing-reference spellings

The body carries a **bare** `Closes #N` line, one per open linked issue,
outside any fenced code block — this is the exact spelling GitHub's own
linker reads to auto-close an issue on merge.[^pr-body-test-ts] Inside the
`proposed-squash-commit` fence, the same issues are **comma-joined** on one
line (`Closes #1, #2`) — the spelling commitlint's trailer grammar expects
for the squash commit message. These are not two renderings of one fact to
be deduplicated into a single format; GitHub's linker and commitlint each
require their own spelling, and collapsing them to one would break one of
the two consumers. This was verified against the live repository before
being asserted in tests: `savvy-web/silk-integration` #242 and #232 were
opened with an empty body and reported `closingIssuesReferences: []`; #243
carried a bare `Closes #168` and reported `[168]` — empirical evidence, not
an inference from GitHub's documentation.[^pr-body-test-ts]

### Closedness reads the GraphQL enum, not a REST string

An issue already closed before this run must not be re-linked and
re-closed on the next merge. Classifying "already closed" reads
`PrBody.LinkedIssueRef.isClosed`, never a bare `state === "closed"` string
comparison: `GitHubIssue.linkedIssues` is a GraphQL query and returns the
enum spelling `CLOSED`, which the kit does not normalise, so a lowercase
comparison silently treats every closed issue as open and re-links it. That
was a live defect in this repository until issue `#209`.

## The sticky comment

Independent of the PR description, the same PR carries a sticky comment
whose sections are stamped and rewritten **independently** under one
comment marker key.[^managed-sections-ts] Five rules govern every write, in
the order they matter:

1. **`running` is written before the work**, not after — `withSection`
   exists precisely so a caller cannot get the ordering wrong: it writes the
   `running` state on entry, then reaches a terminal state (`complete`,
   `failed`, or `cancelled`) on **every** exit path, including a defect or an
   interrupt, via an exit-aware finalizer rather than a `tap`/`tapError`
   pair that would miss both.
2. **A recompute does not blank the section.** The prior rendered body is
   retained and marked stale/failed/cancelled instead, because a reader
   mid-run is better served by a labelled stale answer than an empty
   placeholder.
3. **The commit sha is stamped, not just the run id**, because sha is what
   makes staleness detectable independent of section state — including the
   run that died before ever writing a terminal state. The rendered banner
   (`renderBanner`) reports a section stale whenever its stamped sha
   disagrees with the branch head, regardless of what state it claims.
4. **Sections are independent.** One section recomputing must not
   re-render, or even touch, its neighbours' regions.
5. **Writes are monotonic.** A slower, older run finishing last must not
   overwrite a newer run's already-published result — `isAtLeastAsRecent`
   orders by `at`, breaking ties by `runId`, and an equal stamp passes so a
   run can refine its own section.

`utils/write-sections.ts` is the read-modify-write both Phase 1 and Phase 2
perform against this one comment, and it carries four rules of its own,
proven independently of the five above:[^write-sections-ts]

1. **Read before writing** — the write replaces the body wholesale, so
   starting from `""` would delete every neighbouring section and any human
   prose. This shipped as a real bug once.
2. **A failed read degrades to `""`** rather than aborting the write —
   losing a neighbour section is bad, but refusing to report the release at
   all is worse.
3. **One write, not one write per section** — every section is folded in
   memory first and posted once, so a reader never catches the comment
   mid-update with a stale verdict sitting above a freshly rendered table.
4. **Banners are refreshed across the whole body afterwards** — a banner is
   rendered into the text and freezes at write time, so a section nobody
   rewrote this run would otherwise go on claiming "up to date" at a sha the
   branch has since moved past.

Phase 2 completes Phase 1's `release-plan` section under the same marker
key: Phase 1 seeds a pending validation-verdict section
(`buildPendingVerdictSection`) above the release-plan table it publishes,
and Phase 2 later resolves that same key to a real verdict — the two phases
write to one shared comment, under one shared key, never two comments for
one PR.[^publish-release-plan-ts]

### `publish` is typed infallible, deliberately

`withSection`'s `publish` callback is typed `Effect.Effect<void, never, R2>`
— infallible in its error channel — so that a reporting finalizer can never
replace the caller's real error with a reporting one.[^managed-sections-ts]
The failure posture this enforces is **degrade-to-warning**: `writeSections`
catches whatever its own `read`/`publish` parameters can fail with and logs
a warning rather than propagating it, because a sticky-comment write is not
a release gate. `steps/publish-release-plan.ts`'s module docs state this
explicitly next to its own `never` error channel.[^publish-release-plan-ts]

[^managed-sections-ts]: `../../src/utils/managed-sections.ts`
[^write-sections-ts]: `../../src/utils/write-sections.ts`
[^publish-release-plan-ts]: `../../src/steps/publish-release-plan.ts`
[^pr-body-test-ts]: `../../__test__/pr-body.test.ts`
[^silk-effects-prbody]: `npm:@savvy-web/silk-effects#PrBody`
