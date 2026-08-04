---
"@savvy-web/silk-release-action": minor
---

## Features

### Marker-delimited closing references in the release PR body

Delimit the release PR's closing references with `silk-release:references` markers

The bare `Closes #N` lines are now wrapped in a marker pair, making the region addressable by agents the way the summary region already was. A reference an agent adds for an issue the release never detected survives regeneration instead of being deleted on the next push.

The opening marker carries an `owned` attribute listing the ids the action itself emitted. Without it, an id absent from `linkedIssues` is ambiguous — it could be an agent's addition or a reference the action emitted before it stopped tracking that issue — and preserving both would re-link, and on merge auto-close, an issue the release deliberately dropped.
