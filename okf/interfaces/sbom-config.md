---
type: Interface
title: SBOM configuration
description: "The layered `sbom-config` contract Phase 2 reads to fill in SBOM supplier, author, and copyright metadata, and the NTIA compliance it enables."
kind: config
resource: ../../src/schema/silk-release-config.ts
tags: [release, security]
sources:
  - id: silk-release-config-ts
    resource: ../../src/schema/silk-release-config.ts
  - id: load-release-config-ts
    resource: ../../src/utils/load-release-config.ts
  - id: validation-ts
    resource: ../../src/release/validation.ts
generated:
  by: okfit/claude-code
  at: 2026-09-15T16:08:54Z
  body_sha256: a3cd15369a47c88985bcca36e0064d50a195e31451aacdf970d8b243df6428a5
---

# SBOM configuration

A consumer supplies SBOM supplier, author, publisher, copyright, and
documentation-URL metadata through `SilkReleaseConfig` — a typed JSON shape
whose `sbom` section is the only one Phase 2 consumes today, though the
top-level shape deliberately leaves room for future release-related
sections.[^silk-release-config-ts]

## Three sources, in precedence order

The loader searches, in this order, and the **first source found wins** —
there is no merge across sources:[^load-release-config-ts]

1. **Local repository file**: `.github/silk-release.json` or
   `.github/silk-release.jsonc` in the repository being released. JSONC
   (comments, trailing commas) is accepted, not just strict JSON.
2. **The `sbom-config` action input** — useful for a reusable workflow that
   cannot commit a file into the consuming repository.
3. **The `SILK_RELEASE_SBOM_TEMPLATE` environment variable** — for storing
   the template as an organization- or repository-level GitHub variable,
   which must still be explicitly passed to the action as an environment
   variable in the workflow; GitHub does not inject an org variable into a
   composite action's environment on its own.

A present-but-malformed config **short-circuits the search with a
structured error** rather than silently falling through to the next
source — a typo'd local file must not be silently masked by a global
env var, since the caller needs to know the local config specifically did
not apply.[^load-release-config-ts] A config with SBOM fields written at the
JSON root instead of nested under an `sbom` key is detected and reported by
name, rather than decoding to an empty config and silently dropping every
field. The generated JSON Schema for this whole input shape is published at
`INPUT_SCHEMA_URL`, mirrored on disk as the version-labelled
`schemas/<version>/input.json` — the `$schema`
field of a config file may reference it for editor completion, though the
action itself does not require the reference to be present.[^silk-release-config-ts]

Layering three sources behind one first-found rule, rather than a single
required file, is what lets the same SBOM identity travel with a
reusable-workflow caller that cannot commit a file into the target
repository, while still letting an individual repository override that
identity locally without touching the calling workflow.

## Consumer-side precedence: template wins over inferred metadata

Every field this config can set already has an auto-inferred default —
`resolveSBOMMetadata` derives a copyright start year from the npm registry's
first-publication date, a publisher from the supplier name or the
manifest's `author` field, and so on. The config is **merged over** those
inferred defaults: an explicit value in the template always wins, and an
absent field falls through to the inferred one.[^silk-release-config-ts]
Most consumers should not set `sbom.copyright.startYear` at all — override it
only when the registry lookup is unreliable or the copyright predates the
package's first npm publication.

## NTIA minimum elements and `strict-warnings`

The validation phase generates a preview SBOM per build directory and checks
it against the NTIA minimum-elements set. Two of those elements are filled
in unconditionally by the loader itself, not by the config:

- **Timestamp** (element 7) — always set, to the wall-clock time the SBOM
  was generated, regardless of whether a config was supplied.[^validation-ts]
- **Author/assembler** (element 6) — the configured supplier name when one
  is set; otherwise the kit falls back to the manifest's own
  author.[^validation-ts]

A BOM missing any NTIA field reports `ntiaCompliant: false` and lists the
missing field names in the `result` output's `sbom.missingNtiaFields`; this
is a **warning**-severity validation finding, not an error, unless the run
sets `strict-warnings: true` — in which case every warning-severity finding,
this one included, escalates the per-step and unified check-run conclusions
from `neutral` to `failure`, blocking branch-protection-gated auto-merge.
Errors always fail regardless of `strict-warnings`.

## Reporting: `resolvedSbomConfig` and `sbomConfigSource`

The validation phase's internal result carries `resolvedSbomConfig` — a map
from `<package name>:<build directory>` to the concrete `SbomMetadata` that
directory's preview BOM was generated with — and `sbomConfigSource`, the
`ConfigSource` describing which of the three sources supplied it (or `null`
when none did).[^validation-ts] `ConfigSource` names both which loader won
(`local`, `input`, `variable`, or `none`) and the matched location (the
specific `.json`/`.jsonc` path, or the input/variable name) — a debugging aid
for the common question "which of my three possible sources actually took
effect", answerable without re-deriving the precedence order by hand.

[^silk-release-config-ts]: `../../src/schema/silk-release-config.ts`
[^load-release-config-ts]: `../../src/utils/load-release-config.ts`
[^validation-ts]: `../../src/release/validation.ts`
