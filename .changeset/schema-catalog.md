---
"@savvy-web/silk-release-action": minor
---

## Features

### SchemaStore catalog for the repository config

The action now publishes a SchemaStore-shaped catalog beside its JSON Schema documents, at `schemas/catalog.json`. Its entry associates `.github/silk-release.json` and `.github/silk-release.jsonc` with the versioned `input` schema. An editor or schema tool that reads the catalog can offer completion and validation for that file without a `$schema` reference.

* The entry's `url` points at the current label (`schemas/6.0/input.json`), and its `versions` map lists every advertised label.
* The output payloads and the SBOM template carry their `$schema` URL as before. They have no file convention, so the catalog has no entry for them.
