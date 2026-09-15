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
 * `.github/silk-release.json` input — and `SbomTemplate`, the
 * `sbom-config`/`SILK_RELEASE_SBOM_TEMPLATE` document) are the single sources
 * of truth. Everything else — Draft-07 lowering,
 * the structural lint, the ajv strict-mode gate, the drift policy and the
 * content-comparing write — belongs to `@effected/schemastore` and its CLI.
 *
 * Each entry's identity — base URL, version labels, layout — is the
 * `HostedSchema` value `src/schema/silk-release-config.ts` constructs once
 * (`OutputSchemaIdentity` / `InputSchemaIdentity`), handed over as `hosted`.
 * The `$schema` URL the code emits (`SCHEMA_URL`, `INPUT_SCHEMA_URL`) is that
 * same value's `$id`, so the URL a payload carries and the `$id` the CLI writes
 * are one derivation, not two that have to agree. Both documents are
 * **versioned** at `OUTPUT_SCHEMA_VERSION` under
 * `schemas/<version>/<name>.json`:
 *
 * - `output` (`ReleaseOutput`) — every payload the action emits carries its
 *   URL as `$schema`, so an old payload must keep resolving to the shape it
 *   was written against.
 * - `input` (`SilkReleaseConfig`) — the `$schema` a `.github/silk-release.json`
 *   references for editor completion.
 * - `sbom-template` (`SbomTemplate`) — the `sbom-config` input /
 *   `SILK_RELEASE_SBOM_TEMPLATE` document on its own; its `sbom` section is
 *   the input's, generated from the same source.
 *
 * Every object is generated closed (`additionalProperties: false`) — the
 * library's default — which is the contract consumers hold; the decoders in
 * `src/schema/` keep core's `"ignore"` default and tolerate excess keys, so
 * the published documents are deliberately the stricter of the two.
 *
 * `pnpm schema:build` writes; `pnpm schema:check` is the same walk with no
 * writes and is the CI gate (it fails when a build would write anything).
 *
 * Bumping the version is one constant (`OUTPUT_SCHEMA_VERSION`) plus, once a
 * label has shipped, keeping the old label in `versions` as a frozen file.
 * Runbook: `okf/runbooks/bump-output-schema-version.md`.
 */

import { defineConfig } from "@effected/schemastore";
import { ReleaseOutput } from "../../src/schema/release-output.js";
import {
	InputSchemaIdentity,
	OutputSchemaIdentity,
	SbomTemplate,
	SbomTemplateSchemaIdentity,
	SilkReleaseConfig,
} from "../../src/schema/silk-release-config.js";

export default defineConfig({
	// Relative paths resolve against this file's directory, not the repo root.
	outputDir: "../../schemas",
	schemas: {
		[OutputSchemaIdentity.name]: {
			schema: ReleaseOutput,
			hosted: OutputSchemaIdentity,
			// A single label until one is published: a second label is appended
			// only once the first has shipped and its file is frozen on disk.
			// `published: false` (the default) lets a contract change at this label
			// regenerate the file in place instead of demanding a bump.
			published: false,
		},
		[InputSchemaIdentity.name]: {
			schema: SilkReleaseConfig,
			hosted: InputSchemaIdentity,
			published: false,
		},
		[SbomTemplateSchemaIdentity.name]: {
			schema: SbomTemplate,
			hosted: SbomTemplateSchemaIdentity,
			published: false,
		},
	},
});
