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

import type { FileSystem } from "@effect/platform";
import type { Effect } from "effect";
import { Context, Data } from "effect";
import type { OidcTokenIssuer } from "./oidc.js";
import type { Sbom, SbomInput } from "./sbom.js";
import type { SigstoreSigner } from "./signer.js";
import type { AttestInput, InTotoStatement, SigstoreBundle } from "./types.js";

/**
 * Input for {@link Attest.sbom}.
 *
 * @public
 */
export interface SbomAttestationInput extends SbomInput {
	/**
	 * Hex-encoded SHA-256 of the package tarball (or other artifact bytes)
	 * the BOM describes. The runtime in-toto subject becomes
	 * `pkg:npm/{rootName}@{rootVersion}` with this digest.
	 */
	readonly subjectSha256: string;
}

/**
 * Input for {@link Attest.provenance}.
 *
 * @public
 */
export interface ProvenanceAttestationInput {
	/** PURL or other in-toto subject name (e.g. `pkg:npm/@scope/pkg@1.0.0`). */
	readonly subjectName: string;
	/** Hex-encoded SHA-256 of the artifact. */
	readonly subjectSha256: string;
	/** SLSA Provenance v1 predicate (build-definition + run-details). */
	readonly predicate: unknown;
}

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
 */
export class AttestError extends Data.TaggedError("AttestError")<{
	readonly reason: "build" | "save" | "oidc" | "sign" | "upload";
	readonly message: string;
	readonly cause?: unknown;
}> {}

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
 */
export class Attest extends Context.Tag("github-action-effects/Attest")<
	Attest,
	{
		/**
		 * Build a {@link InTotoStatement} from subjects + predicate. Pure;
		 * runs synchronously aside from the Effect wrapping.
		 */
		readonly buildStatement: (input: AttestInput) => Effect.Effect<InTotoStatement, AttestError>;

		/**
		 * Write an in-toto statement or Sigstore bundle to a local JSON
		 * file. Used during development to inspect what would be uploaded.
		 * Requires {@link FileSystem.FileSystem} so it composes with
		 * `NodeFileSystem.layer` in production and `FileSystem`'s test
		 * implementation in tests.
		 */
		readonly save: (
			data: InTotoStatement | SigstoreBundle,
			path: string,
		) => Effect.Effect<void, AttestError, FileSystem.FileSystem>;

		/**
		 * Build a signed Sigstore bundle (no upload).
		 *
		 * @remarks
		 * Delegates to {@link SigstoreSigner} which fetches an OIDC token
		 * via {@link OidcTokenIssuer}, signs the in-toto statement through
		 * Fulcio, and witnesses it on Rekor. The returned
		 * {@link SigstoreBundle} is what the GitHub attestations API
		 * accepts as the `bundle` field of the upload payload.
		 */
		readonly buildBundle: (
			input: AttestInput,
		) => Effect.Effect<SigstoreBundle, AttestError, SigstoreSigner | OidcTokenIssuer>;

		/**
		 * Full end-to-end attestation: build the in-toto statement, sign it
		 * via {@link SigstoreSigner}, and POST the resulting Sigstore bundle
		 * to `POST /repos/{owner}/{repo}/attestations`. Returns the local
		 * statement + bundle plus the GitHub-issued attestation id and a
		 * UI URL pointing at the attestation listing.
		 */
		readonly attest: (
			input: AttestInput,
		) => Effect.Effect<
			import("./types.js").AttestationRecord,
			AttestError,
			SigstoreSigner | OidcTokenIssuer | import("@savvy-web/github-action-effects").GitHubClient
		>;

		/**
		 * Generate a CycloneDX SBOM, then attest the artifact with it as
		 * the predicate ({@link CYCLONEDX_BOM} predicateType).
		 *
		 * @remarks
		 * Composes {@link Sbom} (BOM generation) with {@link attest}
		 * (sign + upload). The artifact subject is derived from
		 * `rootName` + `rootVersion` + `subjectSha256` — that's the
		 * identity GitHub records against the attestation.
		 */
		readonly sbom: (
			input: SbomAttestationInput,
		) => Effect.Effect<
			import("./types.js").AttestationRecord,
			AttestError,
			Sbom | SigstoreSigner | OidcTokenIssuer | import("@savvy-web/github-action-effects").GitHubClient
		>;

		/**
		 * Attest an artifact with a caller-supplied SLSA Provenance v1
		 * predicate.
		 *
		 * @remarks
		 * The caller is responsible for assembling the SLSA predicate
		 * (the runner's buildDefinition + runDetails); this method just
		 * wraps it in the in-toto envelope and uploads.
		 */
		readonly provenance: (
			input: ProvenanceAttestationInput,
		) => Effect.Effect<
			import("./types.js").AttestationRecord,
			AttestError,
			SigstoreSigner | OidcTokenIssuer | import("@savvy-web/github-action-effects").GitHubClient
		>;
	}
>() {}
