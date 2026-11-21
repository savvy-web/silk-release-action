---
"@savvy-web/silk-release-action": patch
---

## Maintenance

The runner log now uses the kit's step log. Each phase opens with a bold `ActionLogger.phase` heading. Each unit of work is an `ActionLogger.step` that folds its output on success under one result line, `✓ <name> · <duration>`, or `⚠` when it logged a warning. On failure it prints the output unfolded under `✗`. That covers issue linking, build validation, the per-package validate, publish and release units, Build & SBOM, registry confirmation, the validation check and the snapshot version and build. The validation check's result line now carries its conclusion. Inputs, outputs, the result schema and every step's failure behaviour are unchanged.
