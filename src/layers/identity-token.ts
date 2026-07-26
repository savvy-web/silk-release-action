/**
 * The `OidcTokenIssuer` → `IdentityToken` bridge.
 *
 * @remarks
 * `@effected/sbom` inverts the OIDC dependency deliberately: signing needs a
 * workload identity token, but *issuing* one needs the Actions runtime
 * (`ACTIONS_ID_TOKEN_REQUEST_URL`, the runner's token service, a platform HTTP
 * client), which lives in `@effected/github-actions` — a package with a
 * required `@effect/platform-node` peer. Taking that edge would drag a platform
 * peer into every consumer that only wanted to emit an SBOM.
 *
 * So `sbom` declares the narrow `IdentityToken` contract and someone else
 * implements it. Its source comment and design doc both say
 * `@effected/github-actions` ships that adapter, under the name
 * `ActionsIdentityToken.layer` — **it does not**. There is no reference to
 * `IdentityToken` anywhere in `github-actions`, and no dependency edge between
 * the two packages. Tracked upstream at
 * {@link https://github.com/spencerbeggs/effected/issues/184 | effected#184};
 * until it ships, the adapter lives here.
 *
 * The two shapes line up exactly — one member, one audience, one redacted
 * token — so this is a pure error-channel translation and nothing else.
 *
 * @module layers/identity-token
 */

import type { OidcTokenIssuer as OidcTokenIssuerService } from "@effected/github-actions";
import { OidcTokenIssuer } from "@effected/github-actions";
import { IdentityToken, IdentityTokenError } from "@effected/sbom";
import { Effect, Layer } from "effect";

/**
 * `IdentityToken`, satisfied by the runner's OIDC token service.
 *
 * @remarks
 * Bound to a `const` rather than exposed through a factory: layers memoize by
 * reference, and a function would mint a fresh layer per composition site.
 *
 * @public
 */
export const IdentityTokenFromOidc: Layer.Layer<IdentityToken, never, OidcTokenIssuerService> = Layer.effect(
	IdentityToken,
	Effect.map(OidcTokenIssuer, (issuer) => ({
		token: (audience: string) =>
			issuer
				.token(audience)
				// `OidcTokenError` carries a structured `reason` (`unavailable` names
				// the missing `permissions: id-token: write`); it is preserved whole as
				// the cause rather than flattened to a message.
				.pipe(Effect.mapError((cause) => new IdentityTokenError({ audience, cause }))),
	})),
);
