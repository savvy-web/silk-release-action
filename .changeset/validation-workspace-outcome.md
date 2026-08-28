---
"@savvy-web/silk-release-action": minor
---

## Features

### A validation workspace carries `outcome` and `summary`, completing the alignment

The validation workspace had `success` but not the `outcome` enum or the derived `summary` beside it, so it was the one place in the document where the gate stood alone. Both phases' workspaces now share six fields — `version`, `kind`, `success`, `outcome`, `summary`, `packages` — and differ only where they genuinely describe different things: validation carries the bump metadata a release is planned from, publishing carries the tag and release it produced.

`outcome` is `validated`, `nothing-to-validate`, `skipped`, `partial` or `failed`. The values differ from the publish phase's because a dry-run probe and an upload have different results; the field pair is what is shared, so one `success` filter works on both. `nothing-to-validate` is the complete outcome for a `github-only` workspace rather than an absence of one — the workspace-level counterpart to the phase-level `nothing-to-release`.

`summary` is derived from the fields beside it and never authored independently, so the prose on the wire cannot drift from the data. The release-PR comment now renders that same summary for a `github-only` workspace instead of composing its own sentence, so the comment and the JSON cannot disagree.
