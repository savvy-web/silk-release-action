---
"@savvy-web/silk-release-action": minor
---

## Features

Add a Turbo Cache diagnostics section to build validation. Detection now also recognizes the TURBO_RUN_SUMMARY environment variable in addition to the --summarize flag, all .turbo/runs summaries in a job are aggregated, and a collapsed Turbo Cache section (totals, REMOTE/LOCAL/MISS breakdown, per-task detail) is added to the build-validation summary. The concise console marker is unchanged. The feature is non-fatal.
