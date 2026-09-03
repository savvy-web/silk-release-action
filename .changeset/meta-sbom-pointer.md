---
"@savvy-web/silk-release-action": minor
---

## Features

* The `…<group>.meta.tgz` doc bundle now records an `sbom` pointer in `meta/tsdoctor.json` (`{ "path": "<unscoped>.sbom.json", "format": "cyclonedx-json" }`) beside the copied SBOM, so tsdoctor's fetcher can locate it without guessing the file name. An existing manifest keeps its other fields; a missing one is created as `{ "spec": 1, "sbom": … }`.
