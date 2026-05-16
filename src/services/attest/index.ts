/**
 * Public entry point for the Attest service.
 *
 * @remarks
 * Re-exports the service tag, error type, Live layer, type schemas, and
 * the pure in-toto helpers. Consumers import from here rather than
 * reaching into individual files so the internal layout can move
 * around without churning import paths.
 */

export { buildStatement, npmPurl, serializeStatement, subject } from "./intoto.js";
export { AttestLive } from "./live.js";
export { OidcTokenError, OidcTokenIssuer, OidcTokenIssuerLive, saveToken } from "./oidc.js";
export {
	type CycloneDXBom,
	type InFlightPackage,
	type ResolvedDependency,
	Sbom,
	SbomError,
	type SbomInput,
	SbomLive,
} from "./sbom.js";
export {
	Attest,
	AttestError,
	type ProvenanceAttestationInput,
	type SbomAttestationInput,
} from "./service.js";
export {
	IN_TOTO_PAYLOAD_TYPE,
	SIGSTORE_OIDC_AUDIENCE,
	SigstoreSigner,
	SigstoreSignerError,
	SigstoreSignerLive,
	makeSigstoreSignerLive,
} from "./signer.js";
export {
	GITHUB_BUILD_TYPE,
	type OidcClaims,
	SlsaError,
	buildSLSAProvenancePredicate,
	decodeJwtClaims,
} from "./slsa.js";
export {
	AttestTest,
	AttestTestFullLayer,
	type AttestTestState,
	OidcTokenIssuerTest,
	SbomTest,
	type SbomTestState,
	SigstoreSignerTest,
	makeAttestTestState,
	makeSbomTestState,
} from "./testing.js";
export {
	type AttestInput,
	type AttestationRecord,
	CYCLONEDX_BOM,
	IN_TOTO_STATEMENT_V1,
	InTotoStatement,
	InTotoSubject,
	SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE,
	SLSA_PROVENANCE_V1,
	SPDX_V2_3,
	SigstoreBundle,
} from "./types.js";
