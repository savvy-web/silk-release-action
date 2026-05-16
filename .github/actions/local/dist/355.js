export const __rspack_esm_id = 355;
export const __rspack_esm_ids = [355];
export const __webpack_modules__ = {
3438(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  CYCLONEDX_BOM: () => (CYCLONEDX_BOM),
  IN_TOTO_STATEMENT_V1: () => (IN_TOTO_STATEMENT_V1),
  InTotoStatement: () => (InTotoStatement),
  InTotoSubject: () => (InTotoSubject),
  SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE: () => (SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE),
  SLSA_PROVENANCE_V1: () => (SLSA_PROVENANCE_V1),
  SPDX_V2_3: () => (SPDX_V2_3),
  SigstoreBundle: () => (SigstoreBundle)
});
/* import */ var effect__rspack_import_0 = __webpack_require__(9064);
/**
 * Schema definitions for in-toto statements, Sigstore bundles, and the
 * attestation service's public input/output shapes.
 *
 * @remarks
 * Stays decoupled from any HTTP or crypto primitives so consumers can
 * reason about (and serialize) attestation artifacts before any signing
 * or upload happens. Modeled after the same JSON shapes that GitHub's
 * REST API (`POST /repos/{owner}/{repo}/attestations`) and
 * `@actions/attest` produce, so a bundle built here interoperates with
 * existing sigstore tooling (cosign verify-blob, slsa-verifier, etc.).
 */ 
// ---------------------------------------------------------------------------
// in-toto Statement v1
// ---------------------------------------------------------------------------
/**
 * Type URI for in-toto Statement v1. Stored verbatim as the `_type` field of
 * every statement we emit.
 *
 * @see https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md
 */ const IN_TOTO_STATEMENT_V1 = "https://in-toto.io/Statement/v1";
/** Subject of an in-toto statement: a content-addressed artifact. */ class InTotoSubject extends effect__rspack_import_0.Class("InTotoSubject")({
    /**
	 * Name of the subject. Conventionally a PURL for npm packages
	 * (e.g. `pkg:npm/@scope/name@1.0.0`) but the spec only requires
	 * uniqueness within the statement.
	 */ name: effect__rspack_import_0.String,
    /**
	 * One or more algorithm → hex digest mappings for the artifact.
	 * SHA-256 is conventionally provided as `{ sha256: "<64 hex chars>" }`.
	 */ digest: effect__rspack_import_0.Record({
        key: effect__rspack_import_0.String,
        value: effect__rspack_import_0.String
    })
}) {
}
/**
 * In-toto Statement v1. The `predicate` body is intentionally typed as
 * `unknown` — different predicate types (SLSA provenance, CycloneDX SBOM,
 * SPDX, etc.) carry different shapes, and the statement layer doesn't
 * need to introspect them.
 */ class InTotoStatement extends effect__rspack_import_0.Class("InTotoStatement")({
    _type: effect__rspack_import_0.Literal(IN_TOTO_STATEMENT_V1),
    subject: effect__rspack_import_0.Array(InTotoSubject),
    predicateType: effect__rspack_import_0.String,
    predicate: effect__rspack_import_0.Unknown
}) {
}
// ---------------------------------------------------------------------------
// Predicate type URIs we support out of the box
// ---------------------------------------------------------------------------
/** SLSA Provenance v1.0 predicate URI. */ const SLSA_PROVENANCE_V1 = "https://slsa.dev/provenance/v1";
/** CycloneDX BOM predicate URI. Used for SBOM attestations. */ const CYCLONEDX_BOM = "https://cyclonedx.org/bom";
/** SPDX SBOM predicate URI. */ const SPDX_V2_3 = "https://spdx.dev/Document/v2.3";
// ---------------------------------------------------------------------------
// Sigstore Bundle v0.3
// ---------------------------------------------------------------------------
/**
 * Sigstore Bundle media type, v0.3. GitHub's `POST /repos/.../attestations`
 * endpoint expects bundles in this shape.
 */ const SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE = "application/vnd.dev.sigstore.bundle.v0.3+json";
/**
 * A Sigstore bundle — the wire format for attestations. The exact
 * `verificationMaterial` and `dsseEnvelope` shapes are defined by the
 * sigstore protobuf-specs; we model them as `unknown` at this layer and
 * delegate construction to `@sigstore/sign`. The bundle is opaque to
 * callers that just want to upload it.
 *
 * @see https://github.com/sigstore/protobuf-specs/blob/main/protos/sigstore_bundle.proto
 */ class SigstoreBundle extends effect__rspack_import_0.Class("SigstoreBundle")({
    mediaType: effect__rspack_import_0.Literal(SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE),
    verificationMaterial: effect__rspack_import_0.Unknown,
    dsseEnvelope: effect__rspack_import_0.Unknown
}) {
}


},

};
