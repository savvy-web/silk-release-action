// Tests for what this action decides about provenance — which, since
// `ActionsProvenance.capture` shipped, is exactly one thing: **the
// catch-and-skip policy**.
//
// The five tests that used to live here pinned the claim mapping, the
// `GITHUB_SERVER_URL` default, and the `repository_id`/`repository_owner_id`
// transposition hazard. Every one of those now belongs to the kit — it adopted
// the `serverUrl` design note verbatim and pins the transposition with its own
// mutant check. Keeping them would be testing someone else's code and would go
// green whatever we did here.
//
// What remains ours: `capture` passes `OidcTokenError` through untouched so
// each consumer decides. This action decides that attestation is NOT a publish
// gate — a workflow without `permissions: id-token: write` publishes and skips.
// That decision is what these two tests hold.

import { ActionEnvironment, OidcClaims, OidcTokenError, OidcTokenIssuer } from "@effected/github-actions";
import { Effect, Layer, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildProvenancePredicate } from "../src/release/attest-helpers.js";
import { cleanupTestEnvironment, setupTestEnvironment } from "./utils/github-mocks.js";

const CLAIMS = OidcClaims.make({
	iss: "https://token.actions.githubusercontent.com",
	ref: "refs/heads/main",
	sha: "cafebabe",
	repository: "acme/widgets",
	event_name: "push",
	job_workflow_ref: "acme/widgets/.github/workflows/release.yml@refs/heads/main",
	workflow_ref: "acme/widgets/.github/workflows/release.yml@refs/heads/main",
	repository_id: "111",
	repository_owner_id: "222",
	runner_environment: "github-hosted",
	run_id: "10",
	run_attempt: "1",
});

const run = (issuer: Layer.Layer<OidcTokenIssuer>) =>
	Effect.runPromise(
		buildProvenancePredicate().pipe(
			Effect.provide(Layer.mergeAll(ActionEnvironment.layerTest(), issuer)),
			Effect.provide(Logger.layer([])),
		),
	);

describe("buildProvenancePredicate — the catch-and-skip policy", () => {
	// The skip path emits a warning through `ActionLogger` (stdout); suppress it
	// so the suite does not leak that line into the reporter.
	beforeEach(() => setupTestEnvironment({ suppressOutput: true }));
	afterEach(() => cleanupTestEnvironment());

	it("returns null rather than failing when the OIDC exchange fails", async () => {
		// THE policy. A workflow without `permissions: id-token: write` must still
		// publish; only the attestation is skipped. Without the catch this rejects
		// and the whole release fails.
		const predicate = await run(
			OidcTokenIssuer.layerTest({ claims: () => Effect.fail(new OidcTokenError({ reason: "unavailable" })) }),
		);

		expect(predicate).toBeNull();
	});

	it("returns the captured predicate when the exchange succeeds", async () => {
		// The other half: a blanket `() => null` would satisfy the test above.
		const predicate = await run(OidcTokenIssuer.layerFor(CLAIMS));

		expect(predicate).not.toBeNull();
		expect(predicate?.buildDefinition.externalParameters.workflow.repository).toContain("acme/widgets");
	});
});
