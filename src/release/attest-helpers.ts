// Shared attestation helpers for the Phase-3 publish and release flows.
//
// The kit splits attestation deliberately: `@effected/sbom` builds and signs a
// statement, `@effected/github` stores the bundle, and assembling the two into
// a pipeline is the consumer's job (`AttestationShape`'s own remarks say so).
// This module is that assembly, in one place, so `publish.ts` and `releases.ts`
// do not each grow their own copy.

import type { GitHubError, Repo } from "@effected/github";
import { Attestation } from "@effected/github";
import type { ActionEnvironment, OidcTokenError, OidcTokenIssuer } from "@effected/github-actions";
import { ActionsProvenance } from "@effected/github-actions";
import type { InvalidSha256DigestError, PredicateType, SigningError, SlsaProvenance } from "@effected/sbom";
import { InTotoStatement, SIGSTORE_OIDC_AUDIENCE, Sha256Digest, SigstoreSigner } from "@effected/sbom";
import { Effect } from "effect";

/**
 * The current run's SLSA Provenance v1 predicate, or `null` when it cannot be
 * obtained.
 *
 * @remarks
 * The mapping is `ActionsProvenance.capture`'s now — all twelve
 * `GitHubWorkflowProvenance` fields, including the `GITHUB_SERVER_URL` read
 * through `getOptional` with a `https://github.com` default rather than the
 * `GitHubContext` projection. That design note was ours and the kit adopted it
 * verbatim; the twenty lines that used to live here are deleted rather than
 * kept in parallel.
 *
 * **The `catch → null` arm stays ours, deliberately.** `capture` passes
 * `OidcTokenError` through untouched precisely so each consumer can decide:
 * attestation is not a publish gate for this action, so a workflow without
 * `permissions: id-token: write` publishes and skips attestation rather than
 * failing the release. A consumer that wants mandatory attestation keeps the
 * error instead.
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
	ActionsProvenance.capture(SIGSTORE_OIDC_AUDIENCE).pipe(
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
