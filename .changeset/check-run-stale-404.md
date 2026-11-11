---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

- Completing a check run right after creating it no longer fails Phase 1 or Phase 2 when GitHub briefly answers 404 for the new run. The completing request now retries the 404 three times over 1.75s, so a check such as Release Validation Summary or Create Release Branch is no longer left stuck in progress. Refs #563.
