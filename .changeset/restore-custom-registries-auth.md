---
"@savvy-web/silk-release-action": minor
---

## Features

### Custom registry publishing restored

The `custom-registries` input works again. It had been a silent no-op since v0.2.3 — the implementation was deleted in #90 while the manifest and docs kept advertising it (#215). Each configured line now authenticates its registry during Phase-3 publishing:

```yaml
custom-registries: |
  https://registry.example.com/_authToken=${{ secrets.CUSTOM_NPM_TOKEN }}
```

* Each token is masked in the workflow log before use and written to the npmrc `npm publish` reads — it is never exported into the process environment
* The configured token takes precedence over the URL-derived environment-variable fallback (`REGISTRY_EXAMPLE_COM_TOKEN`), which remains supported
* A malformed line now **fails the run** with a message naming the line, instead of being silently ignored:
  * `_auth=<base64>` (basic auth) is no longer supported — supply a bearer token as `_authToken=<token>`
  * a bare registry URL is rejected — the GitHub App token fallback was removed, so every custom registry needs an explicit token
  * duplicate lines for one registry are rejected
