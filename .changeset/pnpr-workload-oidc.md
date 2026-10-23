---
"@savvy-web/silk-release-action": minor
---

## Features

### Keyless publishing to pnpr with a workload credential

A `custom-registries` registry can now publish with a credential the action mints from the job's GitHub Actions OIDC token, so no standing publish secret is needed. Give one URL two lines, in either order:

```text
https://registry.savvyweb.systems/npm/~savvy/_pnprWorkload=https://registry.savvyweb.systems
https://registry.savvyweb.systems/npm/~savvy/_authToken=<release-reader>
```

* `_pnprWorkload=<audience>` carries no secret. Right before each upload the action mints `pnpr_workload_<OIDC token>` for that audience, masks it, writes it as the npmrc's only token for the URL, and publishes with token auth, with no retry and no fallback. The job needs `permissions: id-token: write`.
* The `_authToken` on the same URL becomes the read credential. It is used for the integrity probe, the snapshot never-published probe and post-publish confirmation. The minted credential is never sent on a read.
* The output's `auth.method` gains `workload-oidc` (credential `custom-registries`), and the per-target log line reads `auth: workload-oidc (custom-registries)`.
* A `_pnprWorkload` line with no paired `_authToken` fails that target as `no-read-credential`, naming the line to add, before any read or upload. Phase 2 reports the same misconfiguration as a Publish Validation error.
* A mint failure fails only that target and names `permissions: id-token: write`.
* Two `_pnprWorkload` lines for one URL, or a non-http(s) audience, fail the input decode with the line number.

## Bug Fixes

* A custom registry's 401/403 read hint now names the registry's full declared URL, path included, instead of a host-only `_authToken` line that would have keyed a different registry.
