---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

### Pre-publish validation now processes packages in dependency order

Phase-2 dry-run and SBOM steps ran in workspace glob order (alphabetical) because they iterated `WorkspaceDiscovery.listPackages()` directly, which does not sort by dependencies. Validation now orders released packages through `TopologicalSorter.sortSubset` — the same service the Phase-3 publish already uses — so a package is validated after the workspace dependencies it builds on, and the dry-run/SBOM log matches publish order. A cyclic graph falls back to discovery order rather than aborting validation.
