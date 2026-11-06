---
"@savvy-web/silk-release-action": minor
---

## Features

- Each publish target's `auth` in the output gains `observed`: what npm reports it authenticated with (`oidc-exchange`, `configured-credential` or `unknown`), or `null` when no upload landed. `method` still records what the action set up.
- The per-target log line now says when trusted publishing was offered but npm used the configured token, or when npm's log could not confirm the exchange.

## Maintenance

- Log groups now use the kit's nesting-aware `ActionLogger.group` and `heading`, replacing the local wrapper. Log output keeps the same shape.
- The App JWT is now signed through the `Signature` service the action runtime provides, replacing the separately wired layer in the pre and post steps.
- Schema generation moved from the retired `schemastore` CLI to `effected schema`.
