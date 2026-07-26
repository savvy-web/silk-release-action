/**
 * Shared attestation helpers for the Phase-3 publish and release flows.
 *
 * @remarks
 * The kit splits attestation deliberately: `@effected/sbom` builds and signs a
 * statement, `@effected/github` stores the bundle, and assembling the two into
 * a pipeline is the consumer's job (`AttestationShape`'s own remarks say so).
 * This module is that assembly, in one place, so `publish.ts` and `releases.ts`
 * do not each grow their own copy.
 *
 * @module release/attest-helpers
 */

import type { GitHubError, Repo } from "@effected/github";
import { Attestation } from "@effected/github";
import type { OidcTokenError } from "@effected/github-actions";
import { ActionEnvironment, OidcTokenIssuer } from "@effected/github-actions";
import type { InvalidSha256DigestError, PredicateType, SigningError } from "@effected/sbom";
import { InTotoStatement, SIGSTORE_OIDC_AUDIENCE, Sha256Digest, SigstoreSigner, SlsaProvenance } from "@effected/sbom";
import { Effect, Option } from "effect";

/**
 * Build a SLSA Provenance v1 predicate from the GitHub Actions OIDC token.
 *
 * @remarks
 * **What can still fail, and what no longer can.** The predecessor's three-step
 * chain — fetch token, decode the JWT, assemble the predicate — collapsed to
 * one fallible step. `OidcTokenIssuer.claims` performs the exchange *and* the
 * decode behind a single typed error, and
 * `SlsaProvenance.forGitHubWorkflow` is **total** (a pure projection of its
 * argument; its own remarks state nothing is read from the environment and
 * nothing can fail). So the only reachable failure is
 * {@link OidcTokenError} — which is a real one: the token endpoint variables
 * exist only when the workflow declares `permissions: id-token: write`, and the
 * exchange itself is an HTTP call.
 *
 * That single reachable failure is why the best-effort `null` arm stays.
 * Attestation is not a publish gate: a workflow without `id-token: write`
 * should publish and skip attestation, not fail the release.
 *
 * `GITHUB_SERVER_URL` is read through `getOptional` rather than the
 * `GitHubContext` projection: the projection fails typed when a `GITHUB_*`
 * variable is missing, and a missing server URL has a correct default
 * (`https://github.com`) rather than a failure.
 *
 * @returns The SLSA predicate, or `null` when the OIDC token exchange fails.
 *
 * @public
 */
export const buildProvenancePredicate = (): Effect.Effect<
	SlsaProvenance | null,
	never,
	ActionEnvironment | OidcTokenIssuer
> =>
	Effect.gen(function* () {
		const issuer = yield* OidcTokenIssuer;
		const environment = yield* ActionEnvironment;

		// `claims` rather than `token` + a local decode: the token never becomes a
		// string here, so this module holds no declassification site at all.
		const claims = yield* issuer.claims(SIGSTORE_OIDC_AUDIENCE);
		const serverUrl = Option.getOrElse(yield* environment.getOptional("GITHUB_SERVER_URL"), () => "https://github.com");

		return SlsaProvenance.forGitHubWorkflow({
			serverUrl,
			repository: claims.repository,
			ref: claims.ref,
			sha: claims.sha,
			eventName: claims.event_name,
			workflowRef: claims.workflow_ref,
			jobWorkflowRef: claims.job_workflow_ref,
			repositoryId: claims.repository_id,
			repositoryOwnerId: claims.repository_owner_id,
			runnerEnvironment: claims.runner_environment,
			runId: claims.run_id,
			runAttempt: claims.run_attempt,
		});
	}).pipe(
		Effect.catch((error: OidcTokenError) =>
			Effect.gen(function* () {
				yield* Effect.logWarning(`Failed to build SLSA provenance predicate: ${error.message}`);
				return null;
			}),
		),
	);

/**
 * What an attestation is about, and what it asserts.
 *
 * @public
 */
export interface AttestationSubject {
	/** The subject's identifier, conventionally a package URL. */
	readonly name: string;
	/** The artifact's SHA-256, with or without a `sha256:` prefix. */
	readonly sha256: string;
	/** The predicate type URI the statement declares. */
	readonly predicateType: PredicateType;
	/** The assertion body. */
	readonly predicate: unknown;
}

/**
 * Sign a predicate over a subject and store the bundle against the repository.
 *
 * @remarks
 * Three kit calls the predecessor's `Attest.provenance` / `Attest.sbom` fused
 * into one: build the in-toto statement, sign it into a DSSE bundle, upload the
 * bundle. Failure stays **typed** here rather than being swallowed, so each call
 * site decides whether a failed attestation is fatal — both current call sites
 * decide it is not, but they say so themselves.
 *
 * **The digest is now validated.** `Sha256Digest.parse` rejects anything that is
 * not 64 lowercase hex characters. The predecessor's `subject()` helper only
 * stripped a `sha256:` prefix and passed the rest through, so a caller with no
 * real digest produced a signed statement asserting a filename was a hash and
 * uploaded it. That path is now an {@link InvalidSha256DigestError} instead of a
 * meaningless attestation.
 *
 * @returns The stored attestation's URL.
 *
 * @public
 */
export const attestSubject = (
	subject: AttestationSubject,
): Effect.Effect<string, GitHubError | InvalidSha256DigestError | SigningError, Attestation | Repo | SigstoreSigner> =>
	Effect.gen(function* () {
		const signer = yield* SigstoreSigner;
		const attestation = yield* Attestation;

		const digest = yield* Sha256Digest.parse(subject.sha256.replace(/^sha256:/i, ""));
		const statement = InTotoStatement.forSubject({
			name: subject.name,
			digest,
			predicateType: subject.predicateType,
			predicate: subject.predicate,
		});

		const bundle = yield* signer.sign(statement);
		const record = yield* attestation.upload(bundle);
		return record.url;
	});
