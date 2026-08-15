---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

### Already-closed issues are no longer re-linked and re-closed by the release PR

The release PR's managed region classified linked issues with `state !== "closed"`. But `GitHubIssue.linkedIssues` is a **GraphQL** query (`closingIssuesReferences`), and GraphQL returns the enum spelling `CLOSED` — uppercase, and not normalised by the kit.

So a closed issue arrived as `"CLOSED"`, failed the lowercase comparison, and was treated as open: it got a bare `Closes #N` line in the PR description and an entry in the region's `owned="…"` attribute. Merging the release PR then **closed an issue the release had deliberately dropped**, which is the exact outcome the `owned` attribute exists to prevent.

Only issues reaching the action through the GraphQL linked-issues path were affected, which is all of them on the release PR. Nothing failed and nothing warned.

Fixed by adopting the shared implementation, whose `LinkedIssueRef.isClosed` classifies every casing.

## Maintenance

### The PR-body contract now has one implementation instead of two

`src/utils/pr-body.ts` is deleted; the marker vocabulary, managed-region upsert, summary and reference carry-through, and the `owned="…"` attribute now come from `PrBody` in `@savvy-web/silk-effects` (#209).

The contract's whole purpose is that independent writers agree on it, so a second copy here — with `silk-update-action` doing substantially similar work — was the wrong shape. The local module's own header had anticipated the move.

Call sites use `PrBody.ManagedPrBody` (`build`, `upsert`, `extractSummary`, `extractReferences`) and `PrBody.Markers`. `__test__/pr-body.test.ts` shrinks from an exhaustive suite to a contract smoke test over the properties the call sites depend on; the exhaustive suite moved upstream with the implementation. The empirically verified linking rule — GitHub links an issue only from a bare `Closes #N` outside every fence, confirmed against real pull requests rather than inferred from documentation — is kept here, since it is the reason the assertion exists at all.

`utils/managed-sections.ts` and `utils/write-sections.ts` are unchanged: the sticky-comment surface was out of scope.

### Dependencies

* `@savvy-web/silk-effects` `^5.7.2` → `^5.8.1`
