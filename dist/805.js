export const __rspack_esm_id = 805;
export const __rspack_esm_ids = [805];
export const __webpack_modules__ = {
86708(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.d(__webpack_exports__, {
  runCreateStorageRecord: () => (runCreateStorageRecord),
  runProvenanceAttestation: () => (runProvenanceAttestation),
  runSbomAttestation: () => (runSbomAttestation)
});
/**
 * Promise-returning shim around the Effect-based Attest service.
 *
 * @remarks
 * The existing `createReleaseAssetAttestation` / `createPackageAttestation`
 * surface in `create-attestation.ts` is callback-soup that the rest of the
 * pipeline expects. Rather than refactor every caller in one pass, this
 * module provides a small Promise-returning entry point that runs the new
 * Effect-based service ({@link Attest}, {@link SigstoreSigner},
 * {@link OidcTokenIssuer}, plus `GitHubClient` from
 * `@savvy-web/github-action-effects`) with the production Live layers.
 *
 * Imports are dynamic so the heavy Effect dependency graph (and the
 * sigstore + cyclonedx libraries) only loads when an attestation
 * actually runs — silk-integration's dry-run paths never touch it.
 */ /** Result shape returned by {@link runProvenanceAttestation} / {@link runSbomAttestation}. */ /**
 * Build a SLSA Provenance v1 attestation for `subjectName` + `sha256`,
 * sign it via Sigstore, and POST it to GitHub.
 *
 * @param subjectName - PURL or other in-toto subject (e.g. `pkg:npm/@x/y@1.0.0`).
 * @param sha256 - Hex-encoded SHA-256 of the artifact bytes (with or without `sha256:` prefix).
 * @param token - GitHub token authorising the attestation upload.
 */ const runProvenanceAttestation = async (subjectName, sha256, token)=>{
    const [{ FetchHttpClient }, { GitHubClientLive }, { Effect, Layer, Redacted }, { Attest }, { AttestLive }, { OidcTokenIssuer, OidcTokenIssuerLive }, { SigstoreSignerLive }, { buildSLSAProvenancePredicate, decodeJwtClaims }] = await Promise.all([
        __webpack_require__.e(/* import() */ 568).then(__webpack_require__.bind(__webpack_require__, 11115)),
        Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 65840)),
        __webpack_require__.e(/* import() */ 881).then(__webpack_require__.bind(__webpack_require__, 84176)),
        __webpack_require__.e(/* import() */ 66).then(__webpack_require__.bind(__webpack_require__, 588)),
        __webpack_require__.e(/* import() */ 662).then(__webpack_require__.bind(__webpack_require__, 11901)),
        __webpack_require__.e(/* import() */ 323).then(__webpack_require__.bind(__webpack_require__, 34990)),
        __webpack_require__.e(/* import() */ 418).then(__webpack_require__.bind(__webpack_require__, 41433)),
        __webpack_require__.e(/* import() */ 413).then(__webpack_require__.bind(__webpack_require__, 68588))
    ]);
    const oidc = Layer.provide(OidcTokenIssuerLive, FetchHttpClient.layer);
    const layer = Layer.mergeAll(AttestLive, SigstoreSignerLive, oidc, GitHubClientLive.fromToken(token));
    const program = Effect.gen(function*() {
        const issuer = yield* OidcTokenIssuer;
        const oidcToken = yield* issuer.getToken("sigstore");
        const claims = yield* decodeJwtClaims(Redacted.value(oidcToken));
        const predicate = yield* buildSLSAProvenancePredicate(claims);
        const attest = yield* Attest;
        const record = yield* attest.provenance({
            subjectName,
            subjectSha256: sha256.replace(/^sha256:/i, ""),
            predicate
        });
        return record;
    });
    const record = await Effect.runPromise(Effect.provide(program, layer));
    return {
        attestationId: String(record.attestationId),
        attestationUrl: record.attestationUrl
    };
};
/**
 * Link a previously-uploaded attestation to a GitHub Packages
 * artifact via the storage-record API.
 *
 * @remarks
 * Calls `POST /orgs/{owner}/artifacts/metadata/storage-record` with a client
 * built from the caller-supplied token. Returns the list of storage-record
 * ids, or `undefined` if the API responded but recorded nothing. Transport /
 * permission failures are thrown so the caller can surface them — storage-record
 * failure is non-fatal for the attestation flow, but it should never be invisible.
 *
 * @param input - Storage-record fields. `purl`/`digest`/`version` identify the
 *   artifact; `registryUrl`/`artifactUrl`/`repo` locate it in the registry;
 *   `token` authorises the request (needs `packages:write`).
 */ const runCreateStorageRecord = async (input)=>{
    const [{ GitHubClient, GitHubClientLive }, { Effect, Layer }] = await Promise.all([
        Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 65840)),
        __webpack_require__.e(/* import() */ 881).then(__webpack_require__.bind(__webpack_require__, 84176))
    ]);
    const layer = Layer.mergeAll(GitHubClientLive.fromToken(input.token));
    const program = Effect.gen(function*() {
        const client = yield* GitHubClient;
        const { owner } = yield* client.repo;
        // Body shape matches @actions/attest's createStorageRecord:
        // ArtifactOptions (name, digest, version) + registry_url + artifact_url
        // + the optional `repo` field from PackageRegistryOptions.
        const body = {
            name: input.purl,
            digest: input.digest,
            version: input.version,
            registry_url: input.registryUrl,
            artifact_url: input.artifactUrl,
            repo: input.repo
        };
        return yield* client.rest("orgs.createArtifactStorageRecord", async (octokit)=>{
            const ok = octokit;
            const response = await ok.request("POST /orgs/{owner}/artifacts/metadata/storage-record", {
                owner,
                ...body
            });
            const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
            const ids = data?.storage_records?.map((r)=>r.id);
            return {
                data: ids
            };
        });
    });
    const ids = await Effect.runPromise(Effect.provide(program, layer));
    return ids ?? undefined;
};
/**
 * Sign a caller-supplied CycloneDX BOM as an attestation predicate
 * and POST it to GitHub.
 *
 * @remarks
 * Mirrors {@link runProvenanceAttestation} but uses
 * `Attest.attest()` directly with the CycloneDX predicate type so the
 * already-generated SBOM JSON flows straight through without
 * re-running the Sbom service. Same dynamic-import pattern keeps the
 * heavy Effect graph + sigstore deps out of the cold-start path.
 *
 * @param subjectName - PURL or in-toto subject name.
 * @param sha256 - Hex SHA-256 of the artifact (with or without `sha256:`).
 * @param bom - Parsed CycloneDX BOM JSON to attach as the predicate.
 * @param token - GitHub token authorising the attestation upload.
 */ const runSbomAttestation = async (subjectName, sha256, bom, token)=>{
    const [{ FetchHttpClient }, { GitHubClientLive }, { Effect, Layer }, { Attest }, { AttestLive }, { OidcTokenIssuerLive }, { SigstoreSignerLive }, { CYCLONEDX_BOM }, { subject: makeSubject }] = await Promise.all([
        __webpack_require__.e(/* import() */ 568).then(__webpack_require__.bind(__webpack_require__, 11115)),
        Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 65840)),
        __webpack_require__.e(/* import() */ 881).then(__webpack_require__.bind(__webpack_require__, 84176)),
        __webpack_require__.e(/* import() */ 66).then(__webpack_require__.bind(__webpack_require__, 588)),
        __webpack_require__.e(/* import() */ 662).then(__webpack_require__.bind(__webpack_require__, 11901)),
        __webpack_require__.e(/* import() */ 323).then(__webpack_require__.bind(__webpack_require__, 34990)),
        __webpack_require__.e(/* import() */ 418).then(__webpack_require__.bind(__webpack_require__, 41433)),
        __webpack_require__.e(/* import() */ 355).then(__webpack_require__.bind(__webpack_require__, 3438)),
        __webpack_require__.e(/* import() */ 185).then(__webpack_require__.bind(__webpack_require__, 23987))
    ]);
    const oidc = Layer.provide(OidcTokenIssuerLive, FetchHttpClient.layer);
    const layer = Layer.mergeAll(AttestLive, SigstoreSignerLive, oidc, GitHubClientLive.fromToken(token));
    const program = Effect.gen(function*() {
        const attest = yield* Attest;
        return yield* attest.attest({
            subjects: [
                makeSubject(subjectName, sha256)
            ],
            predicateType: CYCLONEDX_BOM,
            predicate: bom
        });
    });
    const record = await Effect.runPromise(Effect.provide(program, layer));
    return {
        attestationId: String(record.attestationId),
        attestationUrl: record.attestationUrl
    };
};


},

};
