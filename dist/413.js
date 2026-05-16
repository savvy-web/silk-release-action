export const __rspack_esm_id = 413;
export const __rspack_esm_ids = [413];
export const __webpack_modules__ = {
68588(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  GITHUB_BUILD_TYPE: () => (GITHUB_BUILD_TYPE),
  SlsaError: () => (SlsaError),
  buildSLSAProvenancePredicate: () => (buildSLSAProvenancePredicate),
  decodeJwtClaims: () => (decodeJwtClaims)
});
/* import */ var effect__rspack_import_0 = __webpack_require__(65279);
/* import */ var effect__rspack_import_1 = __webpack_require__(46330);
/**
 * SLSA Provenance v1 predicate construction for the GitHub Actions
 * `workflow/v1` build type.
 *
 * @remarks
 * Two pure helpers:
 *
 * - {@link decodeJwtClaims} — extracts the payload from a runner-issued
 *   OIDC JWT. We do _not_ re-verify the JWT here: the token already
 *   came from the runner's token-service endpoint over TLS, and we
 *   only use the claims to populate the predicate (not for trust
 *   decisions). Re-verifying would require fetching JWKS over the
 *   network, which makes the helper non-pure.
 * - {@link buildSLSAProvenancePredicate} — assembles a SLSA v1
 *   predicate from the JWT claims + the current runner environment,
 *   shaped to match what `@actions/attest`'s `attestProvenance`
 *   produces.
 */ 
/** GitHub Actions `workflow/v1` build type. */ const GITHUB_BUILD_TYPE = "https://actions.github.io/buildtypes/workflow/v1";
const REQUIRED_CLAIMS = [
    "iss",
    "ref",
    "sha",
    "repository",
    "event_name",
    "job_workflow_ref",
    "workflow_ref",
    "repository_id",
    "repository_owner_id",
    "runner_environment",
    "run_id",
    "run_attempt"
];
/**
 * Error raised by SLSA helpers.
 *
 * @public
 */ class SlsaError extends effect__rspack_import_0.TaggedError("SlsaError") {
}
const base64UrlDecode = (segment)=>{
    const padded = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(segment.length / 4) * 4, "=");
    return Buffer.from(padded, "base64").toString("utf-8");
};
/**
 * Decode a JWT payload without verifying its signature.
 *
 * @remarks
 * Intended only for extracting claims from a token the runner just
 * issued to us — do not call this on user-supplied tokens.
 *
 * @public
 */ const decodeJwtClaims = (token)=>effect__rspack_import_1["try"]({
        try: ()=>{
            const parts = token.split(".");
            if (parts.length !== 3) {
                throw new Error(`Expected a 3-segment JWT, got ${parts.length}`);
            }
            const decoded = base64UrlDecode(parts[1]);
            const payload = JSON.parse(decoded);
            const missing = REQUIRED_CLAIMS.filter((c)=>!(c in payload));
            if (missing.length > 0) {
                throw new Error(`OIDC token is missing required claims: ${missing.join(", ")}`);
            }
            return payload;
        },
        catch: (cause)=>new SlsaError({
                reason: cause instanceof Error && cause.message.startsWith("OIDC token is missing") ? "claims" : "decode",
                message: cause instanceof Error ? cause.message : String(cause),
                cause
            })
    });
/**
 * Build a SLSA Provenance v1 predicate from OIDC claims + the current
 * runner environment.
 *
 * @remarks
 * Matches the shape `@actions/attest`'s `attestProvenance` produces so
 * downstream verifiers see the same `buildDefinition` /
 * `runDetails` structure regardless of which path generated the
 * attestation.
 *
 * @param claims - OIDC claims (use {@link decodeJwtClaims} to extract).
 * @param env - Runner environment overrides; defaults to `process.env`.
 *
 * @public
 */ const buildSLSAProvenancePredicate = (claims, env = process.env)=>effect__rspack_import_1["try"]({
        try: ()=>{
            const serverURL = env.GITHUB_SERVER_URL ?? "https://github.com";
            // Split path and ref from `owner/repo/.github/workflows/main.yml@main`.
            const [workflowPath] = claims.workflow_ref.replace(`${claims.repository}/`, "").split("@");
            return {
                buildDefinition: {
                    buildType: GITHUB_BUILD_TYPE,
                    externalParameters: {
                        workflow: {
                            ref: claims.ref,
                            repository: `${serverURL}/${claims.repository}`,
                            path: workflowPath
                        }
                    },
                    internalParameters: {
                        github: {
                            event_name: claims.event_name,
                            repository_id: claims.repository_id,
                            repository_owner_id: claims.repository_owner_id,
                            runner_environment: claims.runner_environment
                        }
                    },
                    resolvedDependencies: [
                        {
                            uri: `git+${serverURL}/${claims.repository}@${claims.ref}`,
                            digest: {
                                gitCommit: claims.sha
                            }
                        }
                    ]
                },
                runDetails: {
                    builder: {
                        id: `${serverURL}/${claims.job_workflow_ref}`
                    },
                    metadata: {
                        invocationId: `${serverURL}/${claims.repository}/actions/runs/${claims.run_id}/attempts/${claims.run_attempt}`
                    }
                }
            };
        },
        catch: (cause)=>new SlsaError({
                reason: "env",
                message: `Failed to build SLSA provenance predicate: ${cause instanceof Error ? cause.message : String(cause)}`,
                cause
            })
    });


},

};
