---
type: Glossary
title: byte-group
description: A set of registries sharing one build directory because their published bytes are identical — the unit publish and release actually pack and asset-name by, not a per-registry publish dir.
tags:
  - release
  - bundle
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 8ca1d4d159a8c1a7f5b57093806903a8bd0bda23c8a7806ccbe879a931e37b1e
sources:
  - id: group-id-source
    resource: ../../src/utils/group-id.ts
  - id: meta-archive-source
    resource: ../../src/release/meta-archive.ts
---

# byte-group

A byte-group is a set of registries whose published bytes are identical for
a given package, collapsed by the `@savvy-web/bundler` prod layout into one
build directory: `dist/prod/<group>/pkg`, with a sibling
`dist/prod/<group>/meta` folder holding the API doc and manifest data for
that group. Each package's `publishConfig.targets` resolves through a
`dist/prod/targets.json` binding into these directories, one per
byte-variant group rather than one per registry.

## The collision with intuition

The natural reading of "one build directory per registry" is wrong here.
`npm: true` + `github: true` on the same package collapse into a **single**
group and a single `pkg` directory when their bytes agree, because npm and
GitHub Packages both consume an identical tarball for that package — there
is nothing registry-specific to build twice. `publishDirectoryGroup` packs
once per directory and reuses the same tarball digest for every target in
the group, so a "build directory" names a byte-group, not a per-registry
publish location.

## Naming authority

`src/utils/group-id.ts` is the sole naming authority for group ids and the
asset names built from them:[^group-id-source]

- `getGroupId(directory)` — derives the group id from a build directory,
  e.g. `getGroupId("dist/prod/npm/pkg") === "npm"`. Falls back to the last
  path segment when the directory does not end in `/pkg`.
- `insertGroupToken(fileName, group, ext?)` — inserts the group token
  before a file's final extension (`templates.tgz` →
  `templates.npm.tgz`), or, given a compound extension (`.meta.tgz`,
  `.sbom.json`, `.api.json`), strips the trailing extension first and
  appends `.<group><ext>` (`…-0.1.1.tgz` + `.meta.tgz` →
  `…-0.1.1.npm.meta.tgz`).

For each group, `runReleases` uploads four assets keyed by the group token:
`<name>-<version>.<group>.tgz` (the publish tarball),
`<name>-<version>.<group>.sbom.json`,
`<name>-<version>.<group>.api.json`, and an unattested
`<name>-<version>.<group>.meta.tgz`. All uploads are idempotent — a re-run
reuses an asset already attached to the release by name. One attestation
(SLSA provenance, SBOM) is written per build directory, not per registry
target, checking for an existing attestation before writing.

## `meta.tgz` contents

`tarMetaFolder` (`src/release/meta-archive.ts`) packs a group's `meta/`
folder into a gzip tarball whose single top-level entry is the `meta/`
folder itself, via `tar -C <parent> <metaBasename>` so the archive root is
the folder name rather than an absolute path.[^meta-archive-source] The
folder it packs holds `<unscoped>.api.json` + `tsconfig.json` +
`package.json` from the bundler output, plus the group's generated SBOM,
copied in first by a caller before packing. It is unattested and exists
purely for downstream documentation builders; API-reference docs read from
this `meta/` folder rather than from the publish (`pkg`) directory.

See [Pack once per directory](../decisions/pack-once-per-directory.md) for
why the publish path packs a tarball once per build directory rather than
once per target.

[^group-id-source]: `../../src/utils/group-id.ts`
[^meta-archive-source]: `../../src/release/meta-archive.ts`
