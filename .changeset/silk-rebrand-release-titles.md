---
"@savvy-web/silk-release-action": minor
---

## Features

- Rebranded the package and action to `@savvy-web/silk-release-action`. Workflows consume the action by repository path (`uses: savvy-web/silk-release-action@…`) and keep working through GitHub's repo redirect; action inputs and outputs are unchanged.
- Release PR titles and the release-branch commit subject now reflect the packages that will release: `release: <version>` for a single releasable package or a fixed group sharing one version, or `release: name@version, …` for repos that release packages on independent versions. A shared npm scope is omitted, and a long list collapses to `release: <count> packages`. The commit body lists each releasing package with its full scoped name.

## Bug Fixes

- Multi-workspace repositories with a single publishable package now title the release PR `release: <version>` instead of falling back to the `chore: release` prefix.
- Packages excluded via the changeset `ignore` list are no longer counted when detecting what can release, so example and fixture packages no longer skew the release title or tag strategy.
- Removed the decorative icons from the `Publish Validation`, `Release Notes Preview`, and `SBOM Preview` check-run names so all non-dry-run check titles render consistently.

## Dependencies

| Dependency | Type | Action | From | To |
| :--- | :--- | :--- | :--- | :--- |
| @savvy-web/github-action-effects | dependency | updated | ^1.2.0 | ^2.0.0 |
