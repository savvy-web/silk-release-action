export const __rspack_esm_id = 685;
export const __rspack_esm_ids = [685];
export const __webpack_modules__ = {
588(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  Attest: () => (Attest),
  AttestError: () => (AttestError)
});
/* import */ var effect__rspack_import_0 = __webpack_require__(65279);
/* import */ var effect__rspack_import_1 = __webpack_require__(50256);
/**
 * Attest service tag + error type.
 *
 * @remarks
 * The full {@link Attest} surface ships in stages. Step 1 (this commit)
 * lands the in-toto statement builder + local file save so we have a
 * concrete artifact to iterate on. Steps 2-7 add the OIDC token issuer,
 * sigstore bundle construction, GitHub upload, and SBOM/provenance
 * convenience wrappers — see the design doc in this directory.
 *
 * Designed to lift cleanly into `@savvy-web/github-action-effects` once
 * the surface stabilizes; the service tag is namespaced under the same
 * `github-action-effects/` prefix the upstream package uses.
 */ 
/**
 * Errors raised by {@link Attest} operations.
 *
 * @remarks
 * The `reason` discriminator lets callers pattern-match on the failing
 * stage without coupling to the full implementation graph:
 *
 * - `"build"`   — failure constructing the in-toto statement
 * - `"save"`    — failure writing a statement or bundle to disk
 * - `"oidc"`    — failure obtaining the GitHub Actions OIDC token
 * - `"sign"`    — failure signing the DSSE envelope via Sigstore
 * - `"upload"`  — failure POSTing the bundle to GitHub's attestations API
 */ class AttestError extends effect__rspack_import_0.TaggedError("AttestError") {
}
/**
 * Attest service surface. Implementation lives in {@link "./live.ts"}.
 *
 * @remarks
 * The Effect signatures land incrementally; for step 1 only
 * `buildStatement` and `save` are usable. The remaining members are
 * declared up-front so consumers see the full API and tests can stub a
 * complete service shape with `AttestTest.empty()`.
 *
 * @public
 */ class Attest extends effect__rspack_import_1.Tag("github-action-effects/Attest")() {
}


},

};
