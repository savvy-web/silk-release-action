---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

### Pre-publish validation logs render as a per-package tree

Phase-2 validation previously emitted two flat, separate log groups per package-build (`Dry-run · <pkg> · <group>` and `SBOM · <pkg> · <group>`). It now renders one collapsible group per package-build — `Validate · <pkg>@<version>` — containing a `📦 pack` step (dry-run sizing), per-registry `⬆ <registry> · ready/not-ready` rows, and a `📄 sbom` step, capped by a summary line (`N ready · <size> · SBOM ok`). This mirrors the Phase-3 publish tree, so the two phases read consistently. The `ValidationReport` data is unchanged — only the log presentation.
