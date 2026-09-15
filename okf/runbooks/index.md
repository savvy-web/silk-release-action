# Runbook

* [Bump the output schema version](bump-output-schema-version.md) - Respond to a contract change in the versioned ReleaseOutput JSON Schema by bumping OUTPUT_SCHEMA_VERSION, keeping the old label frozen in lib/scripts/schemastore.config.ts, and regenerating with the schemastore CLI.
* [Run an end-to-end integration test on silk-integration](integration-testing.md) - Exercise a change to this action against a real workflow run in the silk-integration consumer repository before it ships.
