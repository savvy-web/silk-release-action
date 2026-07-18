---
"@savvy-web/silk-release-action": minor
---

## Refactoring

Migrates the action's internals from Effect v3 to Effect v4 (`4.0.0-beta.98`) and the `@effected` kit. The `action.yml` inputs and outputs, the three-phase workflow, and the action's runtime behavior are unchanged — this is an internal library and API migration.

* Schemas, service layers, and error handling ported to the Effect v4 API surface — `Schema.Literals`/`Schema.Union` array forms, `Effect.result`, `Effect.catch`, class-based services, and the single `NodeServices.layer` Node platform layer.
* Workspace introspection moved from `workspaces-effect` to `@effected/workspaces`; topological release ordering now runs on the pure `DependencyGraph` value instead of the removed `TopologicalSorter` service.
* JSONC config parsing moved to `@effected/jsonc`.

### Regenerated JSON Schema files

The two SchemaStore documents (`silk-release-action.input.schema.json`, `silk-release-action.output.schema.json`) are now generated from the Effect schemas via Effect core's `JsonSchema` module, replacing `json-schema-effect`. They remain valid Draft-07, but the document root is now a `$ref` into `$defs` rather than an inlined body. This only affects editors and tools that consume these advisory schemas for completion/validation; it is not part of the `action.yml` contract.

## Dependencies

| Dependency | Type | Action | From | To |
| :--- | :--- | :--- | :--- | :--- |
| effect | dependency | updated | 3.22.0 | 4.0.0-beta.98 |
| @effect/platform-node | dependency | updated | 0.107.0 | 4.0.0-beta.98 |
| @effect/platform | dependency | removed | 0.96.3 | — |
| @effected/workspaces | dependency | added | — | ^0.3.1 |
| @effected/jsonc | dependency | added | — | ^0.2.0 |
| workspaces-effect | dependency | removed | ^2.1.0 | — |
| json-schema-effect | dependency | removed | ^0.3.0 | — |
| jsonc-parser | dependency | removed | ^3.3.1 | — |
| @savvy-web/github-action-effects | dependency | updated | ^2.4.0 | ^3.0.1 |
| @savvy-web/silk-effects | dependency | updated | ^3.3.1 | ^4.0.1 |
| @savvy-web/github-action-builder | devDependency | updated | ^1.1.2 | ^2.0.2 |
| @savvy-web/silk | devDependency | updated | ^2.4.4 | ^3.0.2 |
| @vitest-agent/plugin | devDependency | updated | ^1.1.9 | ^2.0.0 |
