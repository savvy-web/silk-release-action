---
type: Convention
title: Test an upstreamed implementation with a contract smoke test
description: When an implementation moves out of this repo into a shared library, delete its exhaustive local suite and keep only a contract smoke test over the properties this repo's call sites depend on, asserted through the public surface.
tags:
  - testing
  - deps
stale_after: "2026-12-13T00:00:00Z"
sources:
  - id: pr-body-test
    resource: ../../__test__/pr-body.test.ts
  - id: registry-label-test
    resource: ../../__test__/registry-label.test.ts
  - id: pr-body-209
    resource: "https://github.com/savvy-web/silk-release-action/issues/209"
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 7e30ba2e504d531f6c77b2d24520fc36d7665bcbd9813bf3596edbf7da250260
status: draft
---

# Test an upstreamed implementation with a contract smoke test

When an implementation moves out of this repo into a shared library, its
exhaustive suite moves with it. What stays behind is a **contract smoke
test**: only the properties this repo's call sites actually depend on,
asserted through the public surface the library exposes. Do not duplicate
the upstream suite locally — a duplicated suite pins behaviour this repo
does not own and fails on upstream changes that never mattered to this
repo's call sites.

`__test__/pr-body.test.ts` is the worked example: 8 cases asserting
through `PrBody.ManagedPrBody` / `PrBody.Markers` after `PrBody` moved
into `@savvy-web/silk-effects`.[^pr-body-test][^pr-body-209] It keeps only
the narrow, easy-to-lose behaviour — a bare `Closes #N` line outside every
fenced block (the only spelling GitHub's linker counts), the two
non-interchangeable reference spellings, closed issues being dropped, the
`silk-release:*` markers the other modules match on, and the summary
region surviving a regeneration — not a reimplementation of the upstream
suite. `__test__/registry-label.test.ts` is the same pattern applied as
an **adoption guard**: it pins the exact label strings
`@effected/npm`'s registry-label helper must keep returning after the
kit absorbed the local `src/utils/registry-label.ts`, not a unit test of
code this repo still owns.[^registry-label-test]

Before deleting the local module, run both implementations side by side
on the same inputs. This is not optional diligence: for `PrBody`, that
harness is what found the defect that a byte-parity read would have
hidden — closed issues arriving from GraphQL as `"CLOSED"` were classified
as still open and re-linked, because the local code checked
`state !== "closed"` against a lowercase REST-shaped value. The
upstreaming was therefore a fix, not a pure refactor, and framing it as
one would have hidden that fix from review.

See [Release PR surfaces](../interfaces/release-pr-surfaces.md) for the
marker contract `PrBody` and the local managed-section writers both match
on.

[^pr-body-test]: `../../__test__/pr-body.test.ts`
[^registry-label-test]: `../../__test__/registry-label.test.ts`
[^pr-body-209]: `https://github.com/savvy-web/silk-release-action/issues/209`
</content>
