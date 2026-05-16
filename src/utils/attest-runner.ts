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
 */

/** Result shape returned by {@link runProvenanceAttestation} / {@link runSbomAttestation}. */
export interface RunProvenanceResult {
	readonly attestationId: string;
	readonly attestationUrl: string;
}

/**
 * Build a SLSA Provenance v1 attestation for `subjectName` + `sha256`,
 * sign it via Sigstore, and POST it to GitHub.
 *
 * @param subjectName - PURL or other in-toto subject (e.g. `pkg:npm/@x/y@1.0.0`).
 * @param sha256 - Hex-encoded SHA-256 of the artifact bytes (with or without `sha256:` prefix).
 * @param token - GitHub token authorising the attestation upload.
 */
export const runProvenanceAttestation = async (
	subjectName: string,
	sha256: string,
	token: string,
): Promise<RunProvenanceResult> => {
	const [
		{ FetchHttpClient },
		{ GitHubClientLive },
		{ Effect, Layer, Redacted },
		{ Attest },
		{ AttestLive },
		{ OidcTokenIssuer, OidcTokenIssuerLive },
		{ SigstoreSignerLive },
		{ buildSLSAProvenancePredicate, decodeJwtClaims },
	] = await Promise.all([
		import("@effect/platform"),
		import("@savvy-web/github-action-effects"),
		import("effect"),
		import("../services/attest/service.js"),
		import("../services/attest/live.js"),
		import("../services/attest/oidc.js"),
		import("../services/attest/signer.js"),
		import("../services/attest/slsa.js"),
	]);

	const oidc = Layer.provide(OidcTokenIssuerLive, FetchHttpClient.layer);
	const layer = Layer.mergeAll(AttestLive, SigstoreSignerLive, oidc, GitHubClientLive.fromToken(token));

	const program = Effect.gen(function* () {
		const issuer = yield* OidcTokenIssuer;
		const oidcToken = yield* issuer.getToken("sigstore");
		const claims = yield* decodeJwtClaims(Redacted.value(oidcToken));
		const predicate = yield* buildSLSAProvenancePredicate(claims);

		const attest = yield* Attest;
		const record = yield* attest.provenance({
			subjectName,
			subjectSha256: sha256.replace(/^sha256:/i, ""),
			predicate,
		});

		return record;
	});

	const record = await Effect.runPromise(Effect.provide(program, layer));

	return {
		attestationId: String(record.attestationId),
		attestationUrl: record.attestationUrl,
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
 */
export const runCreateStorageRecord = async (input: {
	readonly purl: string;
	readonly digest: string;
	readonly version: string;
	readonly registryUrl: string;
	readonly artifactUrl: string;
	readonly repo: string;
	readonly token: string;
}): Promise<readonly number[] | undefined> => {
	const [{ GitHubClient, GitHubClientLive }, { Effect, Layer }] = await Promise.all([
		import("@savvy-web/github-action-effects"),
		import("effect"),
	]);

	const layer = Layer.mergeAll(GitHubClientLive.fromToken(input.token));

	const program = Effect.gen(function* () {
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
			repo: input.repo,
		};

		return yield* client.rest("orgs.createArtifactStorageRecord", async (octokit) => {
			const ok = octokit as { request: (route: string, params: Record<string, unknown>) => Promise<{ data: unknown }> };
			const response = await ok.request("POST /orgs/{owner}/artifacts/metadata/storage-record", {
				owner,
				...body,
			});
			const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
			const ids = (data as { storage_records?: Array<{ id: number }> } | null)?.storage_records?.map((r) => r.id);
			return { data: ids };
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
 */
export const runSbomAttestation = async (
	subjectName: string,
	sha256: string,
	bom: unknown,
	token: string,
): Promise<RunProvenanceResult> => {
	const [
		{ FetchHttpClient },
		{ GitHubClientLive },
		{ Effect, Layer },
		{ Attest },
		{ AttestLive },
		{ OidcTokenIssuerLive },
		{ SigstoreSignerLive },
		{ CYCLONEDX_BOM },
		{ subject: makeSubject },
	] = await Promise.all([
		import("@effect/platform"),
		import("@savvy-web/github-action-effects"),
		import("effect"),
		import("../services/attest/service.js"),
		import("../services/attest/live.js"),
		import("../services/attest/oidc.js"),
		import("../services/attest/signer.js"),
		import("../services/attest/types.js"),
		import("../services/attest/intoto.js"),
	]);

	const oidc = Layer.provide(OidcTokenIssuerLive, FetchHttpClient.layer);
	const layer = Layer.mergeAll(AttestLive, SigstoreSignerLive, oidc, GitHubClientLive.fromToken(token));

	const program = Effect.gen(function* () {
		const attest = yield* Attest;
		return yield* attest.attest({
			subjects: [makeSubject(subjectName, sha256)],
			predicateType: CYCLONEDX_BOM,
			predicate: bom,
		});
	});

	const record = await Effect.runPromise(Effect.provide(program, layer));

	return {
		attestationId: String(record.attestationId),
		attestationUrl: record.attestationUrl,
	};
};
