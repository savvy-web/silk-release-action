/**
 * The per-target line the Phase-3 publish log prints for each registry upload.
 *
 * @remarks
 * One shape for every outcome — published, skipped and failed alike:
 *
 * ```text
 *   ⬆ <target id> · <host> · <outcome> → <dist-tag> · auth: <how>
 * ```
 *
 * The id is the `publishConfig.targets` key (omitted for an unkeyed target),
 * the host appears once, and the dist-tag and auth segments appear only where
 * the outcome involved an upload attempt. The predecessor printed the short
 * registry label and then the host, which for a custom registry rendered the
 * host twice and said nothing about the tag or the credential.
 *
 * The module also owns the sentences that explain a per-target failure —
 * which input supplies a credential, why a trusted-publishing attempt fell back
 * to a token, and what a custom registry's 401/403 on a read means — so the
 * operator reading a red publish group is told what to change.
 *
 * @module release/target-line
 */

import type { RegistryReadError } from "@effected/npm";
import { classifyRegistry, registryHost } from "@effected/npm";
import type { PublishAuth, PublishAuthMethod, PublishCredentialSource } from "./types.js";

/**
 * What one per-target log line says.
 *
 * @internal
 */
export interface TargetLineInput {
	/** The `publishConfig.targets` key, or `null` for an unkeyed target. */
	readonly id: string | null;
	/** The registry URL; rendered as its host. */
	readonly registry: string;
	/** The outcome word: `published`, `publish-failed`, `skipped-identical (recovery)`, … */
	readonly outcome: string;
	/** The dist-tag the upload used or would use. */
	readonly tag?: string | undefined;
	/** How the upload authenticated, when one was attempted. */
	readonly auth?: PublishAuth | undefined;
}

/**
 * Render a {@link PublishAuth} for the log.
 *
 * @remarks
 * A trusted-publishing → token fallback reads `token (npm-token) after trusted
 * publishing failed`; a token-only retry (no OIDC environment on the first
 * attempt) says it was a retry without provenance instead, because blaming
 * trusted publishing there would be false.
 *
 * @param auth - The auth record from the publish result.
 * @returns The text after `auth: `.
 *
 * @internal
 */
export const describeAuth = (auth: PublishAuth): string => {
	const base =
		auth.method === "trusted-publishing" ? "trusted publishing" : `token (${auth.credential ?? "no credential"})`;
	if (auth.fallback === null) return base;
	return auth.fallback.from === "trusted-publishing"
		? `${base} after trusted publishing failed`
		: `${base}, retry without provenance`;
};

/**
 * Render one per-target publish line.
 *
 * @param input - What the line says.
 * @returns The line, indented to sit under its `Publish · …` group header.
 *
 * @internal
 */
export const formatTargetLine = (input: TargetLineInput): string => {
	const parts = [input.id, registryHost(input.registry)].filter((p): p is string => p !== null && p !== "");
	const outcome = input.tag !== undefined ? `${input.outcome} → ${input.tag}` : input.outcome;
	const auth = input.auth !== undefined ? ` · auth: ${describeAuth(input.auth)}` : "";
	return `  ⬆ ${[...parts, outcome].join(" · ")}${auth}`;
};

/**
 * Name where a registry's credential is configured.
 *
 * @remarks
 * Used when the npmrc write for that credential fails: the bare kit error says
 * what broke, this says which input the operator should look at.
 *
 * @param source - Where the token was resolved from.
 * @param registry - The registry URL.
 * @returns A noun phrase, e.g. "the `npm-token` input".
 *
 * @internal
 */
export const credentialInputHint = (source: PublishCredentialSource, registry: string): string => {
	switch (source) {
		case "github-token":
			return "the `github-token` input";
		case "npm-token":
			return "the `npm-token` input";
		case "custom-registries":
			return `the \`custom-registries\` line for ${registryHost(registry)}`;
		case "registry-env":
			return `the <HOST>_TOKEN environment variable for ${registryHost(registry)}`;
	}
};

/**
 * Explain why a first publish attempt fell back to a token-auth retry.
 *
 * @remarks
 * The cause depends on how the first attempt was set up. With the Actions OIDC
 * environment present (`trusted-publishing`), the job already holds
 * `id-token: write`, so the likely cause is that npm has no trusted publisher
 * configured for the package (or it names a different workflow). With no OIDC
 * environment (`token`), the job lacks `permissions: id-token: write`, so npm
 * could neither exchange a token nor sign provenance. Either way the retry
 * runs with provenance off.
 *
 * @param from - How the first attempt was set up.
 * @param packageName - The package being published.
 * @param registry - The registry the attempt targeted.
 * @returns The explanation sentence.
 *
 * @internal
 */
export const fallbackCause = (from: PublishAuthMethod, packageName: string, registry: string): string =>
	from === "trusted-publishing"
		? `likely cause: no trusted publisher is configured for ${packageName} on ${registryHost(registry)} ` +
			"(or it names a different workflow or environment); retrying once with token auth, provenance off for the retry"
		: "likely cause: the workflow lacks `permissions: id-token: write`, so npm could not sign provenance; " +
			"retrying once with token auth, provenance off for the retry";

/**
 * Explain a registry read failure the operator can fix, or `null`.
 *
 * @remarks
 * Only a custom registry answering HTTP 401/403 is explained: that registry
 * requires a read credential, and the action's only documented way to supply
 * one is a `custom-registries` `_authToken` line. Detection reads the typed
 * `kind`/`status` fields of {@link RegistryReadError}, never message prose.
 *
 * @param registry - The registry URL that was read.
 * @param error - The read failure.
 * @returns The explanation, or `null` when there is nothing specific to say.
 *
 * @internal
 */
export const readFailureHint = (registry: string, error: RegistryReadError): string | null => {
	if (error.kind !== "status" || (error.status !== 401 && error.status !== 403)) return null;
	if (classifyRegistry(registry) !== "custom") return null;
	const host = registryHost(registry);
	return (
		`${host} answered ${error.status}: it requires a read credential. Supply one with a \`custom-registries\` ` +
		`line \`https://${host}/_authToken=<TOKEN>\` (a token that can read as well as publish)`
	);
};
