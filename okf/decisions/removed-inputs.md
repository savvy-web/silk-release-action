---
type: Decision
title: Remove skip-token-revoke, pr-title-prefix, version-command, and the dead build-command read
description: "action.yml carries none of skip-token-revoke, pr-title-prefix, version-command, or build-command; each was removed because it bought nothing, never reached a real title, was replaced by native versioning, or was read by nothing in src/."
status: draft
tags:
  - release
  - compat
sources:
  - id: action-yml
    resource: ../../action.yml
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 3b042e80c2055baf02ab2683fa237f8a4964cba6b1e8a94f662227874dd7bffa
---

# Remove skip-token-revoke, pr-title-prefix, version-command, and the dead build-command read

## Context

`action.yml`'s current input list has no `skip-token-revoke`,
`pr-title-prefix`, `version-command`, or `build-command` entry.[^action-yml]
Each was a separate input surviving past the point it did anything real, for
a different reason.

## Decision

- **`skip-token-revoke`** is gone. It was an opt-out from cleaning up a live
  secret (the GitHub App installation token this action provisions), and the
  token's own one-hour expiry already bounded the exposure it would have
  postponed — the flag bought nothing beyond what expiry already provided.
- **`pr-title-prefix`** is gone. It never reached a real PR title in
  practice: every release-PR-naming branch builds its own `release: …`
  string from the packages or version it names, so the prefix input had no
  code path left that consumed it.
- **`version-command`** is gone. Phase 1 versions in-process through the
  bundled silk-effects `ReleasePlanner` instead of shelling out to a
  consumer-supplied command — see
  [Version natively via the bundled silk-effects ReleasePlanner](native-versioning.md).
  A `version-command` input has nothing left to invoke.
- **The `build-command` read** is gone along with the input. It was the
  clearest case of the drift that [Manifest sync guards need three
  independent legs, not two](three-legged-manifest-guards.md) now catches:
  the manifest and a `NAMES` tuple could agree the input existed while
  nothing under `src/` ever read it.

## Alternatives rejected

**Keep each input but no-op it silently.** Rejected for all four: a
manifest entry nothing reads or nothing needs is exactly the silent-drift
shape the three-legged manifest guard exists to prevent, not a state to
preserve deliberately.

## Consequences

A workflow author who sets `skip-token-revoke`, `pr-title-prefix`,
`version-command`, or `build-command` gets an unrecognized-input warning
from the Actions runner rather than any effect — none of the four is
declared in `action.yml`. Reintroducing any of them needs a fresh decision,
not a revert, since each was removed for an independent reason rather than
as a single batched cleanup. See
[Action inputs and outputs](../interfaces/action-inputs.md) for the current,
still-supported input list.

[^action-yml]: `action.yml`
