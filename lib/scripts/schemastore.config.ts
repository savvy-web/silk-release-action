/**
 * The `schemastore` CLI config: the two action JSON Schema documents, derived
 * from their Effect Schema sources.
 *
 * @remarks
 * Lives under `lib/scripts/` (`src/` is action source only), so the
 * package.json scripts hand the CLI this path explicitly instead of relying
 * on its upward `schemastore.config.*` discovery.
 *
 * `src/schema/release-output.ts` (`ReleaseOutput` — the action's structured
 * output) and `src/schema/silk-release-config.ts` (`SilkReleaseConfig` — the
 * `sbom-config`/`.github/silk-release.json`/`SILK_RELEASE_SBOM_TEMPLATE`
 * input) are the single sources of truth. Everything else — Draft-07 lowering,
 * the structural lint, the ajv strict-mode gate, the drift policy and the
 * content-comparing write — belongs to `@effected/schemastore` and its CLI.
 *
 * Every path and URL is derived from `outputDir`, `baseUrl`, the entry key and
 * the version label; nothing is spelled by hand, so a document's `$id` cannot
 * disagree with where it is written. Both documents are **versioned** at
 * `OUTPUT_SCHEMA_VERSION` under `schemas/<version>/<name>-<version>.json`:
 *
 * - `silk-release-action.output` (`ReleaseOutput`) — every payload the action
 *   emits carries its URL as `$schema`, so an old payload must keep resolving
 *   to the shape it was written against. The derived `$id` MUST equal
 *   `SCHEMA_URL` in `src/schema/release-output.ts` (a `Schema.Literal`
 *   discriminator on every phase).
 * - `silk-release-action.input` (`SilkReleaseConfig`) — the `$schema` a
 *   `.github/silk-release.json` references for editor completion. Its derived
 *   `$id` MUST equal `INPUT_SCHEMA_URL` in `src/schema/silk-release-config.ts`.
 *
 * `baseUrl` and both labels come from the same `OUTPUT_SCHEMA_URL` /
 * `OUTPUT_SCHEMA_VERSION` constants those URLs are derived from, and
 * `__test__/schemastore-config.test.ts` pins the derivation.
 *
 * `pnpm schema:build` writes; `pnpm schema:check` is the same walk with no
 * writes and is the CI gate (it fails when a build would write anything).
 *
 * Bumping the version is one constant (`OUTPUT_SCHEMA_VERSION`) plus, once a
 * label has shipped, keeping the old label in `versions` as a frozen file.
 * Runbook: `okf/runbooks/bump-output-schema-version.md`.
 */

import { defineConfig } from "@effected/schemastore";
import type { Schema } from "effect";
import { ReleaseOutput } from "../../src/schema/release-output.js";
import { OUTPUT_SCHEMA_URL, OUTPUT_SCHEMA_VERSION, SilkReleaseConfig } from "../../src/schema/silk-release-config.js";

/**
 * The `Schema.toJsonSchemaDocument` options every document is generated with.
 *
 * @remarks
 * `effect@4.0.0-rc.113` flipped `toJsonSchemaDocument`'s `onExcessProperty`
 * default from `"error"` to `"ignore"`, which emits `additionalProperties:
 * true` on every object. Both documents have always been generated closed
 * (`additionalProperties: false`), and that is the contract consumers hold.
 * Pinning the option keeps the generation contract self-describing, so a core
 * default moving again cannot silently reopen what consumers validate against.
 * (The decoders in `src/schema/` keep core's `"ignore"` default and tolerate
 * excess keys; the published documents are deliberately the stricter of the
 * two.)
 */
const JSON_SCHEMA_OPTIONS: Schema.ToJsonSchemaOptions = { onExcessProperty: "error" };

export default defineConfig({
	// Relative paths resolve against this file's directory, not the repo root.
	outputDir: "../../schemas",
	baseUrl: OUTPUT_SCHEMA_URL,
	schemas: {
		"silk-release-action.output": {
			schema: ReleaseOutput,
			// A single label until one is published: a second label is appended
			// only once the first has shipped and its file is frozen on disk.
			// `published: false` (the default) lets a contract change at this label
			// regenerate the file in place instead of demanding a bump.
			current: OUTPUT_SCHEMA_VERSION,
			versions: [OUTPUT_SCHEMA_VERSION],
			published: false,
			jsonSchema: JSON_SCHEMA_OPTIONS,
		},
		"silk-release-action.input": {
			schema: SilkReleaseConfig,
			current: OUTPUT_SCHEMA_VERSION,
			versions: [OUTPUT_SCHEMA_VERSION],
			published: false,
			jsonSchema: JSON_SCHEMA_OPTIONS,
		},
	},
});
