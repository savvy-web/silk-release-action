---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

* Phase 3 with `dry-run: true` no longer publishes. Every registry target is packed and probed, then recorded as a `dry-run` skip: nothing is uploaded and no GitHub attestation is signed. In the `result` output a rehearsed package reports the `published` outcome it would have had, under the document's `dryRun: true`, the same way a dry-run release already reported `id: 0`. Before this, a dry run uploaded every tarball for real ([#459](https://github.com/savvy-web/silk-release-action/issues/459))
* Issue linking on the release branch stops at the last merged release PR again, instead of walking the target branch's whole history. The release-PR lookup now asks GitHub for merge commits and filters to the release branch server-side. The merge-commit fallback in phase detection, which could never match, is fixed the same way ([#548](https://github.com/savvy-web/silk-release-action/issues/548))

## Refactoring

* pnpr workload publishing mints its credential through the kit's `ActionsRegistryCredential.workload`. The OIDC token is never declassified inside the action, both the bare and the prefixed value are masked before the npmrc write, and the credential is the publish-only type no registry read accepts. The minted value, audience and failure messages are unchanged ([#534](https://github.com/savvy-web/silk-release-action/issues/534))
