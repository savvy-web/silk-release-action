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
* The `_authToken` on the same URL becomes the read credential. The action uses it for the integrity probe, the snapshot never-published probe and post-publish confirmation, and never sends the minted credential on its own reads.
* `npm publish` itself fetches the package's metadata with the npmrc token before uploading, so pnpr receives and refuses the minted credential on that one request. npm catches the refusal and uploads anyway. The only checks lost are npm's own, which the action's integrity probe and explicit `--tag` already cover.
* Workload publishes run npm with `--fetch-retries=0`, so a pnpr 5xx surfaces in seconds instead of after npm's roughly 140 seconds of retries. Other registries keep npm's retries.
* The output's `auth.method` gains `workload-oidc` (credential `custom-registries`), and the per-target log line reads `auth: workload-oidc (custom-registries)`.
* A `_pnprWorkload` line with no paired `_authToken` fails that target as `no-read-credential`, naming the line to add, before any read or upload. Phase 2 reports the same misconfiguration as a Publish Validation error.
* A mint failure fails only that target and names `permissions: id-token: write`.
* Two `_pnprWorkload` lines for one URL, a non-http(s) audience, or a `_pnprWorkload` line on registry.npmjs.org or GitHub Packages fail the input decode with the line number.

## Bug Fixes

* A custom registry's 401/403 read hint now names the registry's full declared URL, path included, instead of a host-only `_authToken` line that would have keyed a different registry.
* The publish tally names targets that were already on the registry, for example `Published 13/13 registry target(s) (3 already on the registry)`, so it no longer reads as contradicting the closing line's upload count.
