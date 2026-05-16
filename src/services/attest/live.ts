/**
 * Live implementation of the {@link Attest} service.
 *
 * @remarks
 * Composes the pure in-toto builder ({@link buildStatement}), the
 * {@link SigstoreSigner} (Fulcio + Rekor), and the upstream
 * `GitHubClient` to provide a single `attest()` entry point for signed
 * provenance + SBOM attestations.
 */

import { FileSystem } from "@effect/platform";
import { GitHubClient } from "@savvy-web/github-action-effects";
import { Effect, Layer } from "effect";
import { buildStatement, subject as makeSubject, npmPurl, serializeStatement } from "./intoto.js";
import { Sbom } from "./sbom.js";
import { Attest, AttestError } from "./service.js";
import { SigstoreSigner } from "./signer.js";
import type { AttestationRecord, SigstoreBundle } from "./types.js";
import { CYCLONEDX_BOM, InTotoStatement, SLSA_PROVENANCE_V1 } from "./types.js";

const CREATE_ATTESTATION_REQUEST = "POST /repos/{owner}/{repo}/attestations" as const;

interface OctokitLike {
	readonly request: (route: string, params: Record<string, unknown>) => Promise<{ data: unknown }>;
}

const isOctokitLike = (value: unknown): value is OctokitLike =>
	typeof value === "object" &&
	value !== null &&
	"request" in value &&
	typeof (value as OctokitLike).request === "function";

const attestationIdFromResponse = (raw: unknown): number => {
	const data = typeof raw === "string" ? JSON.parse(raw) : raw;
	if (data && typeof data === "object" && "id" in data && typeof (data as { id: unknown }).id === "number") {
		return (data as { id: number }).id;
	}
	throw new Error(
		`GitHub attestations API response did not include a numeric id: ${JSON.stringify(data).slice(0, 200)}`,
	);
};

/**
 * Core attest-from-input flow shared by `attest`, `sbom`, and
 * `provenance` — build the statement, sign it, POST to GitHub.
 *
 * @internal
 */
const attestFromInput = (
	input: import("./types.js").AttestInput,
): Effect.Effect<AttestationRecord, AttestError, SigstoreSigner | import("./oidc.js").OidcTokenIssuer | GitHubClient> =>
	Effect.gen(function* () {
		const statement = yield* Effect.try({
			try: () => buildStatement(input),
			catch: (cause) =>
				new AttestError({
					reason: "build",
					message: `Failed to build in-toto statement: ${cause instanceof Error ? cause.message : String(cause)}`,
					cause,
				}),
		});

		const signer = yield* SigstoreSigner;
		const bundle = yield* signer.signStatement(statement).pipe(
			Effect.mapError(
				(cause) =>
					new AttestError({
						reason: "sign",
						message: cause.message,
						cause,
					}),
			),
		);

		const client = yield* GitHubClient;
		const { owner, repo } = yield* client.repo.pipe(
			Effect.mapError(
				(cause) =>
					new AttestError({
						reason: "upload",
						message: `Failed to resolve repo context: ${cause.reason}`,
						cause,
					}),
			),
		);

		// Flatten the bundle to a pure JSON value for the request body: the
		// round-trip drops any class prototypes and non-JSON fields from the
		// in-memory `@sigstore/bundle` object so only wire-safe data is POSTed.
		const bundlePayload = JSON.parse(JSON.stringify(bundle)) as Record<string, unknown>;
		const attestationId = yield* client
			.rest("repos.createAttestation", async (octokit) => {
				if (!isOctokitLike(octokit)) {
					throw new Error("GitHubClient did not provide an Octokit-compatible client");
				}
				const response = await octokit.request(CREATE_ATTESTATION_REQUEST, {
					owner,
					repo,
					bundle: bundlePayload,
				});
				return { data: attestationIdFromResponse(response.data) };
			})
			.pipe(
				Effect.mapError(
					(cause) =>
						new AttestError({
							reason: "upload",
							message: `Failed to persist attestation: ${cause.reason}`,
							cause,
						}),
				),
			);

		const record: AttestationRecord = {
			statement,
			bundle,
			attestationId,
			attestationUrl: `https://github.com/${owner}/${repo}/attestations/${attestationId}`,
		};
		return record;
	});

/**
 * Live {@link Attest} layer.
 *
 * @public
 */
export const AttestLive = Layer.succeed(Attest, {
	buildStatement: (input) =>
		Effect.try({
			try: () => buildStatement(input),
			catch: (cause) =>
				new AttestError({
					reason: "build",
					message: `Failed to build in-toto statement: ${cause instanceof Error ? cause.message : String(cause)}`,
					cause,
				}),
		}),

	save: (data: InTotoStatement | SigstoreBundle, path: string) =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const serialized = data instanceof InTotoStatement ? serializeStatement(data) : JSON.stringify(data, null, 2);
			yield* fs.writeFileString(path, serialized).pipe(
				Effect.mapError(
					(error) =>
						new AttestError({
							reason: "save",
							message: `Failed to write ${path}: ${error.message}`,
							cause: error,
						}),
				),
			);
		}),

	buildBundle: (input) =>
		Effect.gen(function* () {
			const statement = yield* Effect.try({
				try: () => buildStatement(input),
				catch: (cause) =>
					new AttestError({
						reason: "build",
						message: `Failed to build in-toto statement: ${cause instanceof Error ? cause.message : String(cause)}`,
						cause,
					}),
			});
			const signer = yield* SigstoreSigner;
			return yield* signer.signStatement(statement).pipe(
				Effect.mapError(
					(cause) =>
						new AttestError({
							reason: "sign",
							message: cause.message,
							cause,
						}),
				),
			);
		}),

	attest: (input) => attestFromInput(input),

	sbom: (input) =>
		Effect.gen(function* () {
			const sbomService = yield* Sbom;
			const bom = yield* sbomService.generate(input).pipe(
				Effect.mapError(
					(cause) =>
						new AttestError({
							reason: "build",
							message: `Failed to generate SBOM: ${cause.message}`,
							cause,
						}),
				),
			);
			const bomJson = yield* sbomService.serializeJson(bom).pipe(
				Effect.mapError(
					(cause) =>
						new AttestError({
							reason: "build",
							message: `Failed to serialize SBOM: ${cause.message}`,
							cause,
						}),
				),
			);
			const predicate = JSON.parse(bomJson) as unknown;

			return yield* attestFromInput({
				subjects: [makeSubject(npmPurl(input.rootName, input.rootVersion), input.subjectSha256)],
				predicateType: CYCLONEDX_BOM,
				predicate,
			});
		}),

	provenance: (input) =>
		attestFromInput({
			subjects: [makeSubject(input.subjectName, input.subjectSha256)],
			predicateType: SLSA_PROVENANCE_V1,
			predicate: input.predicate,
		}),
});
