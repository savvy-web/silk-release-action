---
"@savvy-web/silk-release-action": minor
---

## Breaking Changes

Yarn is no longer a supported package manager. The action supports npm, pnpm and bun. On a repository that uses yarn (it has a `yarn.lock`, or a `packageManager` or `devEngines.packageManager` field that names yarn), every phase now fails at package-manager detection with `UnsupportedPackageManagerError`. Before this change it ran yarn for the Phase 2 build. Detection now refuses the repository instead of falling back to npm, because running npm against a yarn tree would build, pack and publish with the wrong package manager. A repository with no package-manager signal still falls back to npm, as before.
