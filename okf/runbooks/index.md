# Runbook

* [Bump the output schema version](bump-output-schema-version.md) - Respond to a contract change in the versioned ReleaseOutput JSON Schema by moving its version label in lib/scripts/schemastore.config.ts and SCHEMA_URL together, then regenerating with the schemastore CLI.
* [Run an end-to-end integration test on silk-integration](integration-testing.md) - Exercise a change to this action against a real workflow run in the silk-integration consumer repository before it ships.
