---
"@savvy-web/silk-release-action": major
---

## Breaking Changes

### Adopts the `@savvy-web/bundler` per-byte-group prod layout

Publish and release now resolve targets from each package's `dist/prod/targets.json`
binding and operate on `dist/prod/<group>/pkg` — the byte-variant group layout the
new bundler emits — instead of a single publish directory. This requires
`@savvy-web/silk-effects` `^1.0.0` (Record-map `publishConfig.targets`,
binding-driven target resolution; the legacy array form is gone) and
`@savvy-web/github-action-effects` `^2.1.3`. `npm: true` + `github: true` collapse
into one tarball deployed to both registries.

### Group-keyed release-asset names

Release assets are now keyed by byte-group: `<name>-<version>.<group>.tgz`, plus a
new `<name>-<version>.<group>.meta.tgz` and `<name>-<version>.<group>.sbom.json`.
This replaces the previous directory-prefix naming. Workflows that consume release
assets by exact filename must update.

### Release notes removed from the structured output

The per-package `releaseNotes` field of the `result` action output is now optional
and is omitted from the serialized payload — the full CHANGELOG content is rendered
in the dedicated Release Notes Preview check instead. Consumers that read release
notes out of `result` must read them from the release body or the preview check.

## Features

### Group `meta.tgz` doc bundle

Each byte-group now ships an unattested `…<group>.meta.tgz` release asset bundling
the bundler's `meta/` folder (`<unscoped>.api.json` + `tsconfig.json` +
`package.json`) plus the generated SBOM, for documentation builders. API-reference
docs are now read from the bundler's `meta/` folder rather than the publish dir.

### Reliable token-auth publishing

GitHub Packages and first-time npm publishes now authenticate with the configured
registry token instead of failing on npm's auto-attempted OIDC trusted-publishing
exchange (which GitHub Packages does not support and an unconfigured npm package
cannot bootstrap). The npm public registry still prefers trusted publishing and
falls back to token auth when a package has no trusted publisher configured yet.

## Bug Fixes

- Cap all check-run summaries at GitHub's 65535-**byte** limit (UTF-8 bytes, not
  characters) so Phase-2 checks (build validation and publish dry-run) no longer
  fail with a 422 on large monorepos.
- Restore per-build packed/unpacked/file-count sizes in the validation output
  (sized via `npm pack --dry-run --json`).
- Label Phase-2 dry-run and SBOM steps by byte-group id rather than the now-uniform
  `pkg` directory basename.
- Surface npm's actual publish error (e.g. `ENEEDAUTH`, `E404`) in failures instead
  of an opaque exit code, and log the resolved auth-token key and target `.npmrc`
  (never the token) for auth debugging.
