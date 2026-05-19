/**
 * SBOM metadata configuration types for NTIA-compliant SBOM generation
 *
 * @remarks
 * These types support a layered configuration system:
 * 1. Auto-infer from package.json (author, repository, bugs, homepage)
 * 2. Load explicit config from .github/silk-release.json
 * 3. Merge config over inferred values (config wins)
 *
 * The input-config types (`SBOMContact`, `SBOMSupplierConfig`,
 * `SBOMCopyrightConfig`, `SBOMMetadataConfig`, `ReleaseConfig`) are derived
 * from the Effect Schema in `src/schema/silk-release-config.ts` — the schema
 * is the single source of truth and is also the source of the generated
 * `silk-release-action.input.schema.json`. The CycloneDX-wire and
 * NTIA-result types below stay hand-rolled because they model external
 * shapes the action only consumes, not config it parses.
 *
 * @see https://www.ntia.gov/files/ntia/publications/sbom_minimum_elements_report.pdf
 */

import type {
	SbomConfig,
	SbomContact,
	SbomCopyright,
	SbomSupplier,
	SilkReleaseConfig,
} from "../schema/silk-release-config.js";

/**
 * Contact information for supplier or security
 *
 * @remarks
 * Re-exported alias of {@link SbomContact} — the Schema-derived type.
 */
export type SBOMContact = SbomContact;

/**
 * Supplier configuration for SBOM metadata
 *
 * @remarks
 * Re-exported alias of {@link SbomSupplier} — the Schema-derived type. The
 * supplier `name` is required for NTIA minimum-elements compliance; `url`
 * accepts a string or string array and `contact` accepts an object or array.
 */
export type SBOMSupplierConfig = SbomSupplier;

/**
 * Copyright configuration for SBOM metadata
 *
 * @remarks
 * Re-exported alias of {@link SbomCopyright} — the Schema-derived type.
 * Most users should NOT set `startYear`; it is auto-detected from the npm
 * registry's first-publication date. Override only when registry lookup is
 * unreliable or the copyright predates first npm publication.
 */
export type SBOMCopyrightConfig = SbomCopyright;

/**
 * External reference types in CycloneDX format
 *
 * @see https://cyclonedx.org/docs/1.5/json/#components_items_externalReferences_items_type
 */
export type SBOMExternalReferenceType =
	| "vcs"
	| "issue-tracker"
	| "website"
	| "advisories"
	| "bom"
	| "mailing-list"
	| "social"
	| "chat"
	| "documentation"
	| "support"
	| "source-distribution"
	| "distribution"
	| "distribution-intake"
	| "license"
	| "build-meta"
	| "build-system"
	| "release-notes"
	| "security-contact"
	| "model-card"
	| "log"
	| "configuration"
	| "evidence"
	| "formulation"
	| "attestation"
	| "threat-model"
	| "adversary-model"
	| "risk-assessment"
	| "vulnerability-assertion"
	| "exploitability-statement"
	| "pentest-report"
	| "static-analysis-report"
	| "dynamic-analysis-report"
	| "runtime-analysis-report"
	| "component-analysis-report"
	| "maturity-report"
	| "certification-report"
	| "quality-metrics"
	| "codified-infrastructure"
	| "poam"
	| "other";

/**
 * External reference for SBOM component metadata
 */
export interface SBOMExternalReference {
	/** Type of external reference */
	type: SBOMExternalReferenceType;
	/** URL of the reference */
	url: string;
	/** Optional comment describing the reference */
	comment?: string;
}

/**
 * Complete SBOM metadata configuration
 *
 * @remarks
 * Re-exported alias of {@link SbomConfig} — the Schema-derived type. Merged
 * with auto-inferred values from `package.json` by `resolveSBOMMetadata`;
 * explicit config values take precedence over inferred values.
 *
 * @example
 * ```json
 * {
 *   "supplier": {
 *     "name": "Savvy Web Systems",
 *     "url": "https://savvyweb.systems",
 *     "contact": {
 *       "email": "security@savvyweb.systems"
 *     }
 *   },
 *   "copyright": {
 *     "holder": "Savvy Web Systems LLC",
 *     "startYear": 2024
 *   },
 *   "documentationUrl": "https://rslib-builder.savvyweb.systems"
 * }
 * ```
 */
export type SBOMMetadataConfig = SbomConfig;

/**
 * Release configuration file structure
 *
 * @remarks
 * Re-exported alias of {@link SilkReleaseConfig} — the Schema-derived top-level
 * type for `.github/silk-release.json`, the `sbom-config` action input, and
 * the `SILK_RELEASE_SBOM_TEMPLATE` environment variable.
 */
export type ReleaseConfig = SilkReleaseConfig;

/**
 * Inferred SBOM metadata from package.json
 *
 * @remarks
 * These values are auto-detected from package.json fields and used as defaults.
 * Explicit configuration from silk-release.json takes precedence.
 */
export interface InferredSBOMMetadata {
	/** Author name parsed from package.json author field */
	authorName?: string | undefined;
	/** Author email parsed from package.json author field */
	authorEmail?: string | undefined;
	/** VCS URL from package.json repository field */
	vcsUrl?: string | undefined;
	/** Issue tracker URL from package.json bugs field */
	issueTrackerUrl?: string | undefined;
	/** Documentation/homepage URL from package.json homepage field */
	documentationUrl?: string | undefined;
	/** Package license from package.json license field */
	license?: string | undefined;
}

/**
 * Resolved SBOM metadata after merging inferred and explicit config
 *
 * @remarks
 * This represents the final, merged metadata ready for injection into
 * the CycloneDX SBOM document.
 */
export interface ResolvedSBOMMetadata {
	/** Supplier information */
	supplier?:
		| {
				name: string;
				url?: string[] | undefined;
				contact?:
					| Array<{ name?: string | undefined; email?: string | undefined; phone?: string | undefined }>
					| undefined;
		  }
		| undefined;
	/** Component metadata */
	component?:
		| {
				publisher?: string | undefined;
				copyright?: string | undefined;
				externalReferences?: SBOMExternalReference[] | undefined;
		  }
		| undefined;
	/** Author of the component */
	author?: string | undefined;
}

/**
 * NTIA minimum elements compliance result
 *
 * @see https://www.ntia.gov/files/ntia/publications/sbom_minimum_elements_report.pdf
 */
export interface NTIAComplianceResult {
	/** Whether all minimum elements are present */
	compliant: boolean;
	/** Number of fields that pass */
	passedCount: number;
	/** Total number of required fields */
	totalCount: number;
	/** Compliance percentage */
	percentage: number;
	/** Individual field results */
	fields: NTIAFieldResult[];
}

/**
 * NTIA minimum element field result
 */
export interface NTIAFieldResult {
	/** Field name */
	name: string;
	/** Human-readable description */
	description: string;
	/** Whether the field passes compliance */
	passed: boolean;
	/** Value found (if any) */
	value?: string | undefined;
	/** Suggestion for how to fix if missing */
	suggestion?: string | undefined;
}

/**
 * Enhanced CycloneDX metadata with supplier and component info
 *
 * @remarks
 * Extends the basic CycloneDX metadata structure to include all fields
 * needed for NTIA compliance.
 */
export interface EnhancedCycloneDXMetadata {
	/** Timestamp when SBOM was generated */
	timestamp?: string | undefined;
	/** Supplier/distributor information */
	supplier?:
		| {
				name: string;
				url?: string[] | undefined;
				contact?:
					| Array<{ name?: string | undefined; email?: string | undefined; phone?: string | undefined }>
					| undefined;
		  }
		| undefined;
	/** Component being described */
	component?:
		| {
				type?: string | undefined;
				name: string;
				version?: string | undefined;
				publisher?: string | undefined;
				copyright?: string | undefined;
				purl?: string | undefined;
				externalReferences?: SBOMExternalReference[] | undefined;
		  }
		| undefined;
	/** Tool that generated the SBOM */
	tools?:
		| {
				components?:
					| Array<{
							type: string;
							name: string;
							version?: string | undefined;
					  }>
					| undefined;
		  }
		| undefined;
}

/**
 * CycloneDX component with enhanced metadata
 */
export interface EnhancedCycloneDXComponent {
	type: string;
	name: string;
	version?: string | undefined;
	purl?: string | undefined;
	publisher?: string | undefined;
	copyright?: string | undefined;
	licenses?:
		| Array<{
				license?:
					| {
							id?: string | undefined;
							name?: string | undefined;
							url?: string | undefined;
					  }
					| undefined;
				expression?: string | undefined;
		  }>
		| undefined;
	externalReferences?: SBOMExternalReference[] | undefined;
}

/**
 * Enhanced CycloneDX document with full metadata support
 */
export interface EnhancedCycloneDXDocument {
	bomFormat: "CycloneDX";
	specVersion: string;
	version: number;
	serialNumber?: string | undefined;
	metadata?: EnhancedCycloneDXMetadata | undefined;
	components?: EnhancedCycloneDXComponent[] | undefined;
	dependencies?:
		| Array<{
				ref: string;
				dependsOn?: string[] | undefined;
		  }>
		| undefined;
}
