---
"@savvy-web/silk-release-action": major
---

## Breaking Changes

### A validation workspace publishes packages, exactly as a publish workspace does

Validation dry-runs precisely what publishing uploads, so the two phases describe the same publications — and were describing them differently. `validation.workspaces[name].builds[].targets[]` becomes `validation.workspaces[name].packages[]`: one entry per (package, registry) publication, the same unit the publish phase reports.

The registry is a property of each package, carried as the **shared** `PublishRegistry` shape both phases reference. The build metadata (`directory`, sizes, `sbom`) rides on the package too, because several publications share one tarball packed once — grouping by directory for display is a rendering concern, not a reason to nest the wire data. A `github-only` workspace has `packages: []`.

The hoisted `validation.registries` map is gone with it. Every package carries its own registry, so a rollup was the same fact in a second, less usable place.

Field names now match across phases: a package carries `success` + `outcome` rather than `ready` + `status`, and a workspace carries `success` rather than `ready`. The `outcome` *values* still differ — validation reports `ready` / `skipped` / `failed` for a probe, publishing reports `published` / `recovered` / `failed` / `blocked` for an upload — because a probe and an upload have genuinely different outcomes. The pair is what is shared, so one `success` filter works on both.

Each validation package also carries the name it would publish under, which may differ from the workspace's own name. `BuildTargetResult` gained that name; it was resolved upstream and dropped, exactly as the publish path's `TargetSpec` used to drop it.

## Bug Fixes

### The release PR title lost its shared-scope stripping

Widening the detection basis to every workspace package also widened the basis `commonScope` reads, which pulled in the changeset-ignored workspaces (`docs`, `scratchpad`). Their differing scope made the set mixed, so the shared scope stopped being omitted and a title that had read `release: runtimes@0.4.4` came back fully qualified.

The scope basis is now the release-eligible set — publishable packages, which already honour the changeset ignore list, unioned with the packages actually releasing so a private tracking package still counts toward the shared scope. Detection itself still runs over every workspace package.
