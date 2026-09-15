---
"@savvy-web/silk-release-action": major
---

## Breaking Changes

### Output schema label `6.0`: new URLs, `schemaVersion` removed

The `result` output's `$schema` now points at `https://raw.githubusercontent.com/savvy-web/silk-release-action/main/schemas/6.0/output.json`. The version directory carries the label and the file names are bare — `output.json`, `input.json`, `sbom-template.json` — instead of `silk-release-action.output-5.2.json`. The `5.x` documents were removed rather than frozen; nothing consumed them under those names.

The in-band `schemaVersion: "2"` field is gone from every phase's output. The version is the one in the `$schema` URL; branch on that instead:

```yaml
- run: echo "$RESULT" | jq -r '."$schema"'
  env:
    RESULT: ${{ steps.release.outputs.result }}
```

The input config's `$schema` moves too: point `.github/silk-release.json` at `https://raw.githubusercontent.com/savvy-web/silk-release-action/main/schemas/6.0/input.json`. The schema label is independent of the action's version and iterates in place until the next major release.

## Features

### The structured result in the log and the job summary

The post phase prints the encoded `result` JSON in full and appends it to the job summary as a `### JSON output` block with a fenced JSON code block, so the document a later step reads from `steps.<id>.outputs.result` is readable without one — and after every other step's own output. The collapsed `Structured result output` log group at emit time is gone in favour of this.

### SBOM template schema

A third document, `schemas/6.0/sbom-template.json`, describes the `sbom-config` action input and the `SILK_RELEASE_SBOM_TEMPLATE` variable on their own: `{ "$schema": …, "sbom": { … } }` with `sbom` required. Its `sbom` section is generated from the same source as the input schema's, so a stored template can name its own schema without the two drifting.

## Dependencies

`@effected/schemastore` moves from a dev dependency to a runtime dependency: the action builds its schema identities with `HostedSchema` at startup, so the `$schema` URL it emits and the `$id` the CLI writes are one value. `ajv` no longer lands in the production tree — the validator engine moved into `@effected/schemastore-cli`.

| Dependency                    | Type          | Action  | From   | To     |
| :---------------------------- | :------------ | :------ | :----- | :----- |
| @effected/schemastore         | dependency    | added   | —      | 0.12.0 |
| @effected/schemastore         | devDependency | removed | 0.11.0 | —      |
| @effected/schemastore-cli     | devDependency | updated | 0.11.0 | 0.12.0 |
| @effected/pnpm-plugin-effect  | config        | updated | 0.8.8  | 0.8.9  |

## Build System

* `action.config.ts` no longer stubs `@cyclonedx/cyclonedx-library`'s optional plugins (the library is not in the tree); it stubs `supports-color` and `kerberos` instead, the two optional requires on the Azure blob path, so the bundle builds with zero warnings

## Tests

* `__test__/schemastore-config.test.ts` is removed: `pnpm schema:check` (run before vitest by `ci:test`) owns document drift, frozen-file identity and the ajv gate, and the identity-to-config agreement holds by construction
