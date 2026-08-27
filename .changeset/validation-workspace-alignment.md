---
"@savvy-web/silk-release-action": major
---

## Breaking Changes

### Validation reports workspaces, in the publish phase's vocabulary

Phase 2's payload was package-centric while Phase 3's was workspace-centric, so one document taught two vocabularies for the same wave. They now match.

- `validation.publish.packages[]` becomes `validation.workspaces`, a map keyed by workspace name, with `validation.order` preserving the sequence a JSON object cannot. The `name` field is gone — the key carries it, so the two can no longer disagree.
- `versionOnly: boolean` becomes `kind: "github-only" | "github-with-packages"` — the same words the publish phase uses.
- `npmReady` and `githubPackagesReady` become `validation.registries`, a map keyed by registry type carrying `{ resolved, ready }`. **A registry with no targets is absent from the map**, which is the point: both booleans started `true` and only flipped on a failure, so a wave with no npm target at all reported `npmReady: true` — a green verdict on a check that never ran. An absent key cannot be read that way. `totalTargets` and `readyTargets` are derivable by summing it.
- `validation.findings[]` splits into `validation.errors[]` and `validation.warnings[]`. The severity was already on each entry, but the two mean different things — an error fails the run, a warning does not unless `strict-warnings` — and two arrays make that discriminable without a predicate.

## Bug Fixes

- The Publish Validation readiness line is now derived from resolved and ready target counts rather than from a pair of booleans, so it cannot assert a readiness that the targets contradict.
