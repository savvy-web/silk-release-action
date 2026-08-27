---
"@savvy-web/silk-release-action": major
---

## Breaking Changes

### The Phase 3 output is now workspace-centric (`schemaVersion: "2"`)

The publish phase's `result` output was package-centric with a workspace facade. It answered "what happened to each upload" precisely and "what happened to each workspace's release" only by inference: the three arrays (`packages`, `tags`, `releases`) were joined by nullable string keys, so answering "did this workspace get a tag and a release?" meant one lookup and two scans.

The unit is now the **workspace** — the thing a changeset names, that gets a version, a git tag and a GitHub release. The packages it puts on registries are artifacts beneath it. That is what makes two previously unrepresentable cases expressible: a private tracking workspace that publishes nothing, and a workspace that publishes the same version under several names to several registries.

- `phase` is `publish`, not `publishing`.
- `publishing.packages[]` becomes `publish.workspaces`, a map **keyed by workspace name**, so a consumer looks one up directly instead of scanning. `publish.order` preserves the dependency-first sequence a JSON object cannot.
- Each workspace carries `tag` and `release` directly. They are **siblings**: tagging and release creation are separate steps, so a tag can land while the release does not, and nesting the tag inside the release would lose it in exactly that case.
- `PublishTarget.name` — the name a package is actually published under, which may differ from the workspace's — is carried through to the output. It was previously dropped between detection and reporting.

### `status`, `noop`, `succeeded` and `hasFailures` are replaced by `success` + `outcome`

Four overlapping fields become two orthogonal ones at every level. `success` is the boolean gate; `outcome` is the taxonomy. A recovered publish and a fresh upload are both `success: true` and are told apart by `outcome` — so a consumer filtering on `success` keeps working when a new outcome member is added.

`noop` is gone. It claimed "nothing happened" for a wave that had cut tags and created GitHub releases, and its documentation described a target-based condition while the code tested a package-based one. An empty run is now `success: true, outcome: "nothing-to-release"` — the only genuinely empty case, and a success, because nothing failed.

## Features

### An aborted run now reports what it was going to do

Publish-target resolution moved ahead of the Build and SBOM gate, so every workspace's `kind` is known before the first step that can fail. A run that dies at `ci:build` now emits the full workspace map with each entry `outcome: "blocked"` — never attempted, and deliberately not `failed`, because the workspace did nothing wrong.

The new `failure` object records **where** (`stage`) and **why** (`reason`), plus the workspaces that never ran. This is the first time the build error reaches the output at all.

### Aggregate counts and derived summaries

`totals` carries per-kind and per-outcome counts so nothing has to be reduced by hand, and both the phase and each workspace carry a one-sentence `summary` derived from those same structured fields — never authored independently, so the prose cannot drift from the data beside it.

## Bug Fixes

- An aborted Phase 3 reported `hasFailures: false`, because the flag was computed from an empty package array. A failed run now reports `success: false` with a populated `failure`.
- `deriveStatus`'s docstring claimed its `failed` arm was unreachable. The build-abort path reached it on every failed build.
