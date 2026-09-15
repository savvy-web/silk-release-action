/**
 * The Silk release action's input configuration contract.
 *
 * @remarks
 * `SilkReleaseConfig` is the typed shape of the JSON consumed via the
 * `sbom-config` action input, the `.github/silk-release.json` file, and the
 * `SILK_RELEASE_SBOM_TEMPLATE` environment variable. It is the single source
 * of truth: the committed, version-labelled
 * `schemas/<version>/input.json` is generated
 * from it (via `lib/scripts/schemastore.config.ts`), and `loadSBOMConfig`
 * decodes raw JSON through it before the validation phase resolves SBOM
 * metadata.
 *
 * The schema mirrors the shape `resolveSBOMMetadata` already normalises —
 * `supplier.url` accepts a string-or-array, `supplier.contact` accepts an
 * object-or-array — so a config that worked under the prior untyped cast
 * continues to decode without change.
 *
 * Every exported sub-struct carries an `identifier` annotation so the
 * generated JSON Schema's `$defs` keys remain stable across Effect version
 * upgrades — matching the convention in `release-output.ts`.
 *
 * Only the `sbom` section is consumed by Phase 2 today; the top-level shape
 * leaves room for future release-related sections.
 */

import { HostedSchema } from "@effected/schemastore";
import { Schema } from "effect";

/**
 * The version label every generated document is currently published under
 * (`schemas/<version>/`). The one constant a contract break moves — see
 * `okf/runbooks/bump-output-schema-version.md`.
 *
 * @remarks
 * Independent of the action's own version: `6.0` is the label the schemas
 * iterate on freely ahead of the action's 6.0.0 release. The `5.x` labels
 * were published under the older `silk-release-action.<name>` file names and
 * are not carried forward as frozen files.
 */
export const OUTPUT_SCHEMA_VERSION = "6.0";

/**
 * Every label the documents have been published under, oldest first; the
 * current one is the newest. Older labels are frozen: the CLI verifies each
 * file still exists and declares its derived `$id`, but never regenerates it.
 */
export const OUTPUT_SCHEMA_VERSIONS: ReadonlyArray<string> = [OUTPUT_SCHEMA_VERSION];

/**
 * Where a generated JSON Schema document is hosted: raw from this repository's
 * `main` branch under `schemas/`, versioned as `schemas/<version>/<name>.json`
 * — the directory carries the label, so the file name does not repeat it.
 *
 * @remarks
 * Constructed once here and handed to `lib/scripts/schemastore.config.ts` as
 * each entry's `hosted`, so the `$schema` URL the code emits and the `$id` the
 * CLI writes are one value rather than two derivations that have to agree.
 */
const hosted = (name: string): HostedSchema =>
	HostedSchema.github({
		repo: "savvy-web/silk-release-action",
		path: "schemas",
		name,
		versions: OUTPUT_SCHEMA_VERSIONS,
		current: OUTPUT_SCHEMA_VERSION,
		appendVersion: false,
	});

/** Hosted identity of the `result` output document (`ReleaseOutput`). */
export const OutputSchemaIdentity: HostedSchema = hosted("output");

/** Hosted identity of the input config document (`SilkReleaseConfig`). */
export const InputSchemaIdentity: HostedSchema = hosted("input");

/**
 * Hosted identity of the SBOM template document (`SbomTemplate`) — the shape
 * of the `sbom-config` action input and the `SILK_RELEASE_SBOM_TEMPLATE`
 * variable on their own, so a template stored outside any repository can
 * name the schema it conforms to.
 */
export const SbomTemplateSchemaIdentity: HostedSchema = hosted("sbom-template");

/**
 * Hosted JSON Schema URL for the input config; the `$id` of the generated
 * document and the `$schema` a `.github/silk-release.json` references.
 */
export const INPUT_SCHEMA_URL: string = InputSchemaIdentity.$id;

/**
 * Hosted JSON Schema URL for the SBOM template; the `$id` of the generated
 * document and the `$schema` a stored template references.
 */
export const SBOM_TEMPLATE_SCHEMA_URL: string = SbomTemplateSchemaIdentity.$id;

// ─── Sub-structs ──────────────────────────────────────────────────────────

/** Contact information for a supplier, author, or security contact. */
export const SbomContact = Schema.Struct({
	name: Schema.optional(
		Schema.String.annotate({
			title: "Contact name",
			description: "Display name of the contact person or team.",
			examples: ["Security Team", "Jane Doe"],
		}),
	),
	email: Schema.optional(
		Schema.String.annotate({
			title: "Contact email",
			description: "Email address used to reach the contact.",
			examples: ["security@example.com"],
		}),
	),
	phone: Schema.optional(
		Schema.String.annotate({
			title: "Contact phone",
			description: "Phone number used to reach the contact, in E.164 format when possible.",
			examples: ["+1-555-0100"],
		}),
	),
}).annotate({
	identifier: "SbomContact",
	title: "SBOM contact",
	description:
		"A contact person or team associated with an SBOM supplier, author, or security entry. All fields are optional, but at least one should be set for the contact to be useful.",
});
export type SbomContact = Schema.Schema.Type<typeof SbomContact>;

/**
 * Supplier configuration for SBOM metadata.
 *
 * @remarks
 * `name` is required when `supplier` is provided (it is the value NTIA
 * minimum-elements compliance keys on). `url` and `contact` each accept the
 * scalar-or-array form that `resolveSBOMMetadata` already normalises.
 */
export const SbomSupplier = Schema.Struct({
	name: Schema.String.annotate({
		title: "Supplier name",
		description:
			"Supplier display name. Required when a supplier block is provided — this is the NTIA minimum-elements 'Supplier Name' field that compliance checks key on.",
		examples: ["Savvy Web"],
	}),
	url: Schema.optional(
		Schema.Union([Schema.String, Schema.Array(Schema.String)]).annotate({
			title: "Supplier URL(s)",
			description:
				"One supplier URL or an array of URLs. The scalar-or-array form is normalised by `resolveSBOMMetadata`; both shapes are accepted by Phase 2.",
			examples: ["https://example.com", ["https://example.com", "https://example.com/security"]],
		}),
	),
	contact: Schema.optional(
		Schema.Union([SbomContact, Schema.Array(SbomContact)]).annotate({
			title: "Supplier contact(s)",
			description:
				"One contact object or an array of contacts. The scalar-or-array form is normalised by `resolveSBOMMetadata`; both shapes are accepted by Phase 2.",
		}),
	),
}).annotate({
	identifier: "SbomSupplier",
	title: "SBOM Supplier",
	description:
		"The NTIA minimum-elements 'Supplier Name' entity for the SBOM. Emitted on the BOM's `metadata.supplier` and used to satisfy the supplier-name NTIA compliance check.",
});
export type SbomSupplier = Schema.Schema.Type<typeof SbomSupplier>;

/**
 * Copyright configuration for SBOM metadata.
 *
 * @remarks
 * Most users should NOT set `startYear`; it is auto-detected from the npm
 * registry's first-publication date. Override only when registry lookup is
 * unreliable or the copyright predates first npm publication. `startYear` is
 * a `Schema.Int` because fractional years (e.g. `2024.5`) would otherwise
 * decode through `Schema.Number` and corrupt the formatted copyright string.
 */
export const SbomCopyright = Schema.Struct({
	holder: Schema.optional(
		Schema.String.annotate({
			title: "Copyright holder",
			description:
				"Copyright holder name. Appears in the BOM's `metadata.component.copyright` formatted as 'Copyright (c) <range> <holder>'.",
			examples: ["Savvy Web", "Jane Doe"],
		}),
	),
	startYear: Schema.optional(
		Schema.Int.annotate({
			title: "Copyright start year",
			description:
				"Year the copyright begins, used to format a year range against the current year. Most users should NOT set this — it is auto-detected from the npm registry's first-publication date. Override only when registry lookup is unreliable or the copyright predates first npm publication.",
			examples: [2024, 2021],
		}),
	),
}).annotate({
	identifier: "SbomCopyright",
	title: "SBOM Copyright",
	description:
		"Copyright metadata applied to every released package's BOM. Merged over auto-inferred defaults — explicit config wins.",
});
export type SbomCopyright = Schema.Schema.Type<typeof SbomCopyright>;

/**
 * SBOM metadata configuration.
 *
 * @remarks
 * Merged over auto-inferred values from `package.json` by `resolveSBOMMetadata`
 * — explicit config wins. Field names match the prior `SBOMMetadataConfig`
 * consumers so the schema can be swapped in without a wire-format change.
 */
export const SbomConfig = Schema.Struct({
	supplier: Schema.optional(SbomSupplier),
	authors: Schema.optional(
		Schema.Array(SbomContact).annotate({
			title: "Authors",
			description:
				"Author contacts written to the BOM's `metadata.authors`. Used when `package.json` `author`/`contributors` are insufficient or need explicit override.",
		}),
	),
	publisher: Schema.optional(
		Schema.String.annotate({
			title: "Publisher",
			description:
				"Publisher name written to the BOM's `metadata.component.publisher`. Defaults to the supplier name when unset.",
			examples: ["Savvy Web"],
		}),
	),
	copyright: Schema.optional(SbomCopyright),
	documentationUrl: Schema.optional(
		Schema.String.annotate({
			title: "Documentation URL",
			description:
				"Documentation URL written to the BOM as an external reference of type 'documentation'. Typically the project's docs site or repository docs path.",
			examples: ["https://savvy-web.github.io/silk", "https://github.com/savvy-web/silk-release-action#readme"],
		}),
	),
}).annotate({
	identifier: "SbomConfig",
	title: "SBOM Configuration",
	description:
		"SBOM metadata applied during the validation phase. Merged over auto-inferred values from each package's `package.json` by `resolveSBOMMetadata` — explicit config wins. Field names match the prior `SBOMMetadataConfig` consumers so the schema is wire-compatible with existing configs.",
});
export type SbomConfig = Schema.Schema.Type<typeof SbomConfig>;

/**
 * An SBOM template on its own: the document the `sbom-config` action input
 * and the `SILK_RELEASE_SBOM_TEMPLATE` variable carry.
 *
 * @remarks
 * The same `sbom` section the top-level config embeds, generated from the
 * same {@link SbomConfig} source so the two documents cannot drift, but with
 * `sbom` required — a template that carries no SBOM metadata is a mistake,
 * where a repository config that omits the section is merely one that has
 * nothing to add. Every source still decodes through {@link SilkReleaseConfig};
 * this struct exists so the template can name its own schema.
 */
export const SbomTemplate = Schema.Struct({
	$schema: Schema.optional(
		Schema.String.annotate({
			title: "JSON Schema reference",
			description:
				"Optional URL of the JSON Schema this template conforms to. Editors and json-schema-aware tools use this for completion and validation; the action itself does not require it.",
			examples: [SBOM_TEMPLATE_SCHEMA_URL],
		}),
	),
	sbom: SbomConfig,
}).annotate({
	identifier: "SbomTemplate",
	title: "Silk Release Action SBOM template",
	description:
		"An SBOM metadata template: the document passed as the `sbom-config` action input or stored in the `SILK_RELEASE_SBOM_TEMPLATE` variable. The `sbom` section is the same one a `.github/silk-release.json` embeds.",
});
export type SbomTemplate = Schema.Schema.Type<typeof SbomTemplate>;

// ─── Top-level config ─────────────────────────────────────────────────────

/**
 * The top-level Silk release config.
 *
 * @remarks
 * `$schema` is optional — templates may reference the input schema for editor
 * tooling, but the action does not require it. `sbom` is the only section
 * Phase 2 consumes today.
 */
export const SilkReleaseConfig = Schema.Struct({
	$schema: Schema.optional(
		Schema.String.annotate({
			title: "JSON Schema reference",
			description:
				"Optional URL of the JSON Schema this config conforms to. Editors and json-schema-aware tools use this for completion and validation; the action itself does not require it.",
			examples: [INPUT_SCHEMA_URL],
		}),
	),
	sbom: Schema.optional(SbomConfig),
}).annotate({
	identifier: "SilkReleaseConfig",
	title: "Silk Release Action input config",
	description:
		"Input configuration for the Silk Release Action. Sourced (in precedence order) from the `sbom-config` action input, the `.github/silk-release.json` file in the repository, and the `SILK_RELEASE_SBOM_TEMPLATE` environment variable. Only the `sbom` section is consumed by Phase 2 today; the top-level shape leaves room for future release-related sections.",
});
export type SilkReleaseConfig = Schema.Schema.Type<typeof SilkReleaseConfig>;
