/**
 * The Silk release action's input configuration contract.
 *
 * @remarks
 * `SilkReleaseConfig` is the typed shape of the JSON consumed via the
 * `sbom-config` action input, the `.github/silk-release.json` file, and the
 * `SILK_RELEASE_SBOM_TEMPLATE` environment variable. It is the single source
 * of truth: the committed `silk-release-action.input.schema.json` is
 * generated from it, and `loadSBOMConfig` decodes raw JSON through it before
 * the validation phase resolves SBOM metadata.
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

import { Schema } from "effect";

/** Hosted JSON Schema URL for the input config; emitted as `$id` in the generated JSON Schema. */
export const INPUT_SCHEMA_URL =
	"https://raw.githubusercontent.com/savvy-web/silk-release-action/main/silk-release-action.input.schema.json";

// ─── Sub-structs ──────────────────────────────────────────────────────────

/** Contact information for a supplier, author, or security contact. */
export const SbomContact = Schema.Struct({
	name: Schema.optional(
		Schema.String.annotations({
			title: "Contact name",
			description: "Display name of the contact person or team.",
			examples: ["Security Team", "Jane Doe"],
		}),
	),
	email: Schema.optional(
		Schema.String.annotations({
			title: "Contact email",
			description: "Email address used to reach the contact.",
			examples: ["security@example.com"],
		}),
	),
	phone: Schema.optional(
		Schema.String.annotations({
			title: "Contact phone",
			description: "Phone number used to reach the contact, in E.164 format when possible.",
			examples: ["+1-555-0100"],
		}),
	),
}).annotations({
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
	name: Schema.String.annotations({
		title: "Supplier name",
		description:
			"Supplier display name. Required when a supplier block is provided — this is the NTIA minimum-elements 'Supplier Name' field that compliance checks key on.",
		examples: ["Savvy Web"],
	}),
	url: Schema.optional(
		Schema.Union(Schema.String, Schema.Array(Schema.String)).annotations({
			title: "Supplier URL(s)",
			description:
				"One supplier URL or an array of URLs. The scalar-or-array form is normalised by `resolveSBOMMetadata`; both shapes are accepted by Phase 2.",
			examples: ["https://example.com", ["https://example.com", "https://example.com/security"]],
		}),
	),
	contact: Schema.optional(
		Schema.Union(SbomContact, Schema.Array(SbomContact)).annotations({
			title: "Supplier contact(s)",
			description:
				"One contact object or an array of contacts. The scalar-or-array form is normalised by `resolveSBOMMetadata`; both shapes are accepted by Phase 2.",
		}),
	),
}).annotations({
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
		Schema.String.annotations({
			title: "Copyright holder",
			description:
				"Copyright holder name. Appears in the BOM's `metadata.component.copyright` formatted as 'Copyright (c) <range> <holder>'.",
			examples: ["Savvy Web", "Jane Doe"],
		}),
	),
	startYear: Schema.optional(
		Schema.Int.annotations({
			title: "Copyright start year",
			description:
				"Year the copyright begins, used to format a year range against the current year. Most users should NOT set this — it is auto-detected from the npm registry's first-publication date. Override only when registry lookup is unreliable or the copyright predates first npm publication.",
			examples: [2024, 2021],
		}),
	),
}).annotations({
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
		Schema.Array(SbomContact).annotations({
			title: "Authors",
			description:
				"Author contacts written to the BOM's `metadata.authors`. Used when `package.json` `author`/`contributors` are insufficient or need explicit override.",
		}),
	),
	publisher: Schema.optional(
		Schema.String.annotations({
			title: "Publisher",
			description:
				"Publisher name written to the BOM's `metadata.component.publisher`. Defaults to the supplier name when unset.",
			examples: ["Savvy Web"],
		}),
	),
	copyright: Schema.optional(SbomCopyright),
	documentationUrl: Schema.optional(
		Schema.String.annotations({
			title: "Documentation URL",
			description:
				"Documentation URL written to the BOM as an external reference of type 'documentation'. Typically the project's docs site or repository docs path.",
			examples: ["https://savvy-web.github.io/silk", "https://github.com/savvy-web/silk-release-action#readme"],
		}),
	),
}).annotations({
	identifier: "SbomConfig",
	title: "SBOM Configuration",
	description:
		"SBOM metadata applied during the validation phase. Merged over auto-inferred values from each package's `package.json` by `resolveSBOMMetadata` — explicit config wins. Field names match the prior `SBOMMetadataConfig` consumers so the schema is wire-compatible with existing configs.",
});
export type SbomConfig = Schema.Schema.Type<typeof SbomConfig>;

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
		Schema.String.annotations({
			title: "JSON Schema reference",
			description:
				"Optional URL of the JSON Schema this config conforms to. Editors and json-schema-aware tools use this for completion and validation; the action itself does not require it.",
			examples: [
				"https://raw.githubusercontent.com/savvy-web/silk-release-action/main/silk-release-action.input.schema.json",
			],
		}),
	),
	sbom: Schema.optional(SbomConfig),
}).annotations({
	identifier: "SilkReleaseConfig",
	title: "Silk Release Action input config",
	description:
		"Input configuration for the Silk Release Action. Sourced (in precedence order) from the `sbom-config` action input, the `.github/silk-release.json` file in the repository, and the `SILK_RELEASE_SBOM_TEMPLATE` environment variable. Only the `sbom` section is consumed by Phase 2 today; the top-level shape leaves room for future release-related sections.",
});
export type SilkReleaseConfig = Schema.Schema.Type<typeof SilkReleaseConfig>;
