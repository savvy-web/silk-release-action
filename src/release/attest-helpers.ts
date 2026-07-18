/**
 * Shared attestation helpers for the Phase-3 publish and release flows.
 *
 * @module release/attest-helpers
 */

import { OidcTokenIssuer, buildSLSAProvenancePredicate, decodeJwtClaims } from "@savvy-web/github-action-effects";
import { Effect, Redacted } from "effect";

/**
 * Build a SLSA Provenance v1 predicate from the GitHub Actions OIDC token.
 *
 * Obtains a sigstore-audience OIDC token, decodes its JWT claims, and builds
 * the SLSA predicate from those claims. Failures are caught and yield `null`
 * so the caller can log a warning and skip attestation rather than fail the
 * whole batch — attestation is best-effort, not a publish gate.
 *
 * Shared by `publish.ts` (per-build-directory attestation) and `releases.ts`
 * (per-asset attestation) so the OIDC-token handling lives in one place.
 *
 * @returns The SLSA predicate, or `null` when the token exchange or predicate
 *   construction fails.
 *
 * @public
 */
export const buildProvenancePredicate = (): Effect.Effect<Record<string, unknown> | null, never, OidcTokenIssuer> =>
	Effect.gen(function* () {
		const issuer = yield* OidcTokenIssuer;
		const oidcToken = yield* issuer.getToken("sigstore");
		const claims = yield* decodeJwtClaims(Redacted.value(oidcToken));
		const predicate = yield* buildSLSAProvenancePredicate(claims);
		return predicate;
	}).pipe(
		Effect.catch((e: unknown) =>
			Effect.gen(function* () {
				yield* Effect.logWarning(
					`Failed to build SLSA provenance predicate: ${e instanceof Error ? e.message : String(e)}`,
				);
				return null;
			}),
		),
	);
