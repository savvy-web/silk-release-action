---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

### `versionFiles`-managed JSON documents are no longer reformatted by a version bump

Phase-1 native versioning previously round-tripped every changesets `versionFiles` target through `JSON.parse`/`JSON.stringify`, so bumping a version rewrote the whole document — inline arrays exploded to one element per line and any formatting outside the serializer's style was lost (visible as large spurious diffs on files like `.claude-plugin/plugin.json` in release PRs). The bundled `@savvy-web/silk-effects` 3.0.3 rewrites these files in place with minimal jsonc edits: a version bump now produces a one-line diff and the rest of the document survives byte-for-byte. JSONC documents (comments, trailing commas) are supported, and a wildcard-free JSONPath whose leaf property does not exist yet is inserted using the document's detected indentation. No Biome pass or dependency install is needed to keep formatting intact, so this works in the zero-install Phase 1.

### Dependencies

The bundle ships `@savvy-web/silk-effects` 3.0.3, `@savvy-web/github-action-effects` 2.3.7, and a single deduped `jsonc-effect` 0.3.1.
