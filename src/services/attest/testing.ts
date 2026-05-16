/**
 * Test layers for the Attest and Sbom services.
 *
 * @remarks
 * Mirrors the upstream pattern from `@savvy-web/github-action-effects`
 * (`GitHubClientTest.layer(state) / .empty()`): the `state` form records
 * every method call into shared arrays the test can assert against and
 * returns canned responses, while `.empty()` provides a fresh state
 * with sensible defaults for cases where the test just needs the
 * service to exist.
 *
 * The test layers are deliberately layered above the same tags as the
 * Live implementations, so swapping `AttestLive` for `AttestTest.layer(s)`
 * is the only change a downstream test needs to make. None of the test
 * layers reach Fulcio, Rekor, or GitHub — the synthetic responses are
 * shaped to satisfy {@link AttestationRecord} and {@link SigstoreBundle}
 * without any cryptographic work.
 */

import { FileSystem } from "@effect/platform";
import { GitHubClientTest } from "@savvy-web/github-action-effects";
import { Effect, Layer, Redacted } from "effect";
import { buildStatement, subject as makeSubject } from "./intoto.js";
import { OidcTokenIssuer } from "./oidc.js";
import type { CycloneDXBom, SbomInput } from "./sbom.js";
import { Sbom } from "./sbom.js";
import type { AttestError, ProvenanceAttestationInput, SbomAttestationInput } from "./service.js";
import { Attest } from "./service.js";
import { SigstoreSigner } from "./signer.js";
import type { AttestInput, AttestationRecord, InTotoStatement } from "./types.js";
import { SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE, SigstoreBundle } from "./types.js";

// ─── AttestTest ──────────────────────────────────────────────────────

/**
 * Mutable state recorded by {@link AttestTest.layer}.
 *
 * @public
 */
export interface AttestTestState {
	/** Inputs passed to every {@link Attest.buildStatement} call. */
	readonly buildStatementCalls: AttestInput[];
	/** Inputs passed to every {@link Attest.buildBundle} call. */
	readonly buildBundleCalls: AttestInput[];
	/** Inputs passed to every {@link Attest.attest} call. */
	readonly attestCalls: AttestInput[];
	/** Inputs passed to every {@link Attest.sbom} call. */
	readonly sbomCalls: SbomAttestationInput[];
	/** Inputs passed to every {@link Attest.provenance} call. */
	readonly provenanceCalls: ProvenanceAttestationInput[];
	/** Path → data captured by {@link Attest.save}. */
	readonly saves: Map<string, InTotoStatement | SigstoreBundle>;
	/**
	 * Override the synthetic attestation id used in returned records.
	 * Defaults to `1`.
	 */
	readonly attestationId?: number;
	/**
	 * Override the synthetic GitHub repo path baked into the
	 * attestation URL. Defaults to `"test-owner/test-repo"`.
	 */
	readonly repo?: string;
	/**
	 * If set, every Attest operation that would normally succeed fails
	 * with this error instead. Useful for testing error-handling paths.
	 */
	readonly failWith?: AttestError;
}

/**
 * Build a fresh, empty {@link AttestTestState}.
 *
 * @public
 */
export const makeAttestTestState = (overrides: Partial<AttestTestState> = {}): AttestTestState => ({
	buildStatementCalls: [],
	buildBundleCalls: [],
	attestCalls: [],
	sbomCalls: [],
	provenanceCalls: [],
	saves: new Map(),
	...overrides,
});

const stubBundle = (): SigstoreBundle =>
	new SigstoreBundle({
		mediaType: SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE,
		verificationMaterial: { tlogEntries: [] },
		dsseEnvelope: {
			payload: "",
			payloadType: "application/vnd.in-toto+json",
			signatures: [{ sig: "test-signature", keyid: "" }],
		},
	});

const stubRecord = (state: AttestTestState, statement: InTotoStatement): AttestationRecord => {
	const id = state.attestationId ?? 1;
	const repo = state.repo ?? "test-owner/test-repo";
	return {
		statement,
		bundle: stubBundle(),
		attestationId: id,
		attestationUrl: `https://github.com/${repo}/attestations/${id}`,
	};
};

const failOrSucceed = <A>(state: AttestTestState, value: A): Effect.Effect<A, AttestError> =>
	state.failWith ? Effect.fail(state.failWith) : Effect.succeed(value);

/**
 * Test layer factories for {@link Attest}.
 *
 * @public
 */
export const AttestTest = {
	/**
	 * Test layer that records every call into `state` and returns
	 * synthetic responses. Pass the same `state` object to your test's
	 * assertions to inspect what was called.
	 */
	layer: (state: AttestTestState): Layer.Layer<Attest> =>
		Layer.succeed(Attest, {
			buildStatement: (input) =>
				Effect.sync(() => {
					state.buildStatementCalls.push(input);
					return buildStatement(input);
				}).pipe(Effect.flatMap((s) => failOrSucceed(state, s))),

			save: (data, path) =>
				Effect.gen(function* () {
					if (state.failWith) return yield* Effect.fail(state.failWith);
					state.saves.set(path, data);
					// Touch FileSystem so the resource declaration in the
					// service signature stays honest under the test layer.
					yield* FileSystem.FileSystem;
				}),

			buildBundle: (input) =>
				Effect.sync(() => {
					state.buildBundleCalls.push(input);
					return stubBundle();
				}).pipe(Effect.flatMap((b) => failOrSucceed(state, b))),

			attest: (input) =>
				Effect.sync(() => {
					state.attestCalls.push(input);
					return stubRecord(state, buildStatement(input));
				}).pipe(Effect.flatMap((r) => failOrSucceed(state, r))),

			sbom: (input) =>
				Effect.sync(() => {
					state.sbomCalls.push(input);
					return stubRecord(
						state,
						buildStatement({
							subjects: [makeSubject(`pkg:npm/${input.rootName}@${input.rootVersion}`, input.subjectSha256)],
							predicateType: "https://cyclonedx.org/bom",
							predicate: { bomFormat: "CycloneDX", specVersion: "1.5", components: [] },
						}),
					);
				}).pipe(Effect.flatMap((r) => failOrSucceed(state, r))),

			provenance: (input) =>
				Effect.sync(() => {
					state.provenanceCalls.push(input);
					return stubRecord(
						state,
						buildStatement({
							subjects: [makeSubject(input.subjectName, input.subjectSha256)],
							predicateType: "https://slsa.dev/provenance/v1",
							predicate: input.predicate,
						}),
					);
				}).pipe(Effect.flatMap((r) => failOrSucceed(state, r))),
		}),

	/**
	 * Test layer with default state — useful when the test doesn't care
	 * what calls were made, only that the service is available.
	 */
	empty: (): Layer.Layer<Attest> => AttestTest.layer(makeAttestTestState()),
};

// ─── SbomTest ────────────────────────────────────────────────────────

/**
 * Mutable state recorded by {@link SbomTest.layer}.
 *
 * @public
 */
export interface SbomTestState {
	/** Inputs passed to every {@link Sbom.generate} call. */
	readonly generateCalls: SbomInput[];
	/** Path → BOM captured by {@link Sbom.save}. */
	readonly saves: Map<string, CycloneDXBom>;
	/** Override the BOM returned from {@link Sbom.generate}. */
	readonly bomResponse?: CycloneDXBom;
	/** Override the JSON returned from {@link Sbom.serializeJson}. */
	readonly jsonResponse?: string;
}

/**
 * Synthetic Bom-shaped stub for the test layer.
 *
 * @remarks
 * Avoids importing `@cyclonedx/cyclonedx-library` at module-init time —
 * the library's static-import chain pulls in optional plugins that
 * fail to resolve in the bundled action when `Sbom.generate` is never
 * called. Tests that need a real Bom should provide one via
 * `state.bomResponse`.
 */
const minimalBom = (): CycloneDXBom => ({}) as unknown as CycloneDXBom;

/**
 * Build a fresh, empty {@link SbomTestState}.
 *
 * @public
 */
export const makeSbomTestState = (overrides: Partial<SbomTestState> = {}): SbomTestState => ({
	generateCalls: [],
	saves: new Map(),
	...overrides,
});

const defaultJson = (): string =>
	JSON.stringify(
		{
			bomFormat: "CycloneDX",
			specVersion: "1.5",
			version: 1,
			metadata: { component: { type: "library", name: "test-root", version: "0.0.0" } },
			components: [],
		},
		null,
		2,
	);

/**
 * Test layer factories for {@link Sbom}.
 *
 * @public
 */
export const SbomTest = {
	layer: (state: SbomTestState): Layer.Layer<Sbom> =>
		Layer.succeed(Sbom, {
			generate: (input) =>
				Effect.sync(() => {
					state.generateCalls.push(input);
					return state.bomResponse ?? minimalBom();
				}),

			serializeJson: () => Effect.sync(() => state.jsonResponse ?? defaultJson()),

			save: (bom, path) =>
				Effect.gen(function* () {
					state.saves.set(path, bom);
					yield* FileSystem.FileSystem;
				}),
		}),

	empty: (): Layer.Layer<Sbom> => SbomTest.layer(makeSbomTestState()),
};

// ─── Noop dependency layers ──────────────────────────────────────────

/**
 * Noop {@link OidcTokenIssuer} test layer — returns a fixed dummy JWT.
 *
 * @remarks
 * Tests that exercise `Attest` through the test layer never reach
 * Sigstore, so the token value never gets used. Exposed so downstream
 * tests can compose it manually when they need finer-grained control.
 *
 * @public
 */
export const OidcTokenIssuerTest: Layer.Layer<OidcTokenIssuer> = Layer.succeed(OidcTokenIssuer, {
	getToken: () => Effect.succeed(Redacted.make("test-oidc-token")),
});

/**
 * Noop {@link SigstoreSigner} test layer — returns a synthetic
 * {@link SigstoreBundle} without any signing or witnessing.
 *
 * @public
 */
export const SigstoreSignerTest: Layer.Layer<SigstoreSigner> = Layer.succeed(SigstoreSigner, {
	signStatement: () => Effect.succeed(stubBundle()),
});

/**
 * Composed layer that provides `Attest` plus every dependency it
 * declares (`SigstoreSigner`, `OidcTokenIssuer`, `Sbom`, and
 * `GitHubClient`). Use this when you just want to call into `Attest`
 * from a test without wiring four layers by hand.
 *
 * @public
 */
export const AttestTestFullLayer = (state: AttestTestState = makeAttestTestState()) =>
	Layer.mergeAll(
		AttestTest.layer(state),
		SigstoreSignerTest,
		OidcTokenIssuerTest,
		SbomTest.empty(),
		GitHubClientTest.empty(),
	);
