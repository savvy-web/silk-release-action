// The `custom-registries` input, parsed.
//
// Restores the capability lost in the publish-chain migration (#90, issue
// #215): each line binds a custom registry URL to the npmrc auth token the
// Phase-3 publish flow sends it. The parse lives here as a PURE function —
// the input itself is still read exactly once, in `schema/inputs.ts`, which
// composes this via `Config.mapEffect`.

import { classifyRegistry } from "@effected/npm";
import { Config, Effect, Redacted, Schema, SchemaIssue } from "effect";

/**
 * A pnpr workload binding: publish this registry with a credential minted
 * from the job's GitHub Actions OIDC token, bound to `audience`.
 *
 * @remarks
 * Carries no secret — the credential is minted per target at publish time
 * (`release/publish.ts`), never parsed from the input. OPS-143.
 *
 * @public
 */
export interface CustomRegistryWorkload {
	/** The OIDC audience the minted token is requested for, verbatim. */
	readonly audience: string;
}

/**
 * One registry configured by the `custom-registries` input: its URL, its
 * `_authToken`, and an optional pnpr workload binding.
 *
 * @remarks
 * Every entry carries at least one of `token` and `workload` — a line names
 * one or the other, and an entry exists only because a line named its URL.
 *
 * - **`token` only** — the `_authToken` is both the publish and the read
 *   credential, as it always was.
 * - **`workload` + `token`** — the workload credential authenticates the
 *   publish and NOTHING ELSE (pnpr accepts it only for the PUT); the
 *   `_authToken` is the read credential for the integrity probe, the
 *   snapshot probe and post-publish confirmation.
 * - **`workload` only** — accepted here; it fails at publish time with
 *   `no-read-credential`, because pnpr workload credentials cannot read and
 *   the integrity probe reads before any PUT.
 *
 * The token is `Redacted` from the moment it leaves the raw line. A plain
 * entry's token is declassified exactly once, in `release/publish.ts`,
 * through the kit's `Secret` seam — mask-first — and reaches npm only via
 * `PackagePublish.setupAuth`'s npmrc write. A workload entry's reader token is
 * never declassified at all: reads take the `Redacted` value. No
 * process-environment bridge exists on this path; the plaintext-env bridge
 * the predecessor used was deleted deliberately (see `program.ts`).
 *
 * @public
 */
export interface CustomRegistryAuth {
	/** The registry URL, normalized to carry a trailing slash. */
	readonly registry: string;
	/** The `_authToken` value for that registry — the read credential when `workload` is set. */
	readonly token?: Redacted.Redacted<string>;
	/** Set by a `_pnprWorkload=<audience>` line on the same URL. */
	readonly workload?: CustomRegistryWorkload;
}

/**
 * Fail the decode with a message the runner will print.
 *
 * `Config.ConfigError` wrapping a `SchemaError`, matching what every other
 * input failure in `schema/inputs.ts` surfaces — the message names the line
 * NUMBER and the registry, never the token.
 */
const configFailure = (message: string): Effect.Effect<never, Config.ConfigError> =>
	Effect.fail(new Config.ConfigError(new Schema.SchemaError(new SchemaIssue.InvalidValue({ message }))));

/**
 * The accepted line shape: a registry URL immediately followed by an npmrc
 * key and its value — `_authToken=<token>` or `_pnprWorkload=<audience>`, e.g.
 * `https://registry.example.com/_authToken=npm_abc123`.
 *
 * Lazy prefix, so the FIRST key occurrence splits the line — a token that
 * itself contains `_authToken=` or `_pnprWorkload=` still parses whole, as a
 * token.
 */
const REGISTRY_LINE = /^(.+?)\/?(_authToken|_pnprWorkload)=(.+)$/;

/** A `_auth=<base64>` line — the predecessor supported it; the kit does not. */
const BASIC_AUTH_LINE = /^.+?\/?_auth=.+$/;

/** Whether `value` parses as an http(s) URL. */
const isHttpUrl = (value: string): boolean => {
	if (!URL.canParse(value)) return false;
	const { protocol } = new URL(value);
	return protocol === "https:" || protocol === "http:";
};

/**
 * Parse the `custom-registries` input lines into one entry per registry.
 *
 * @remarks
 * The format is one key per line, the registry URL immediately followed by
 * the key: `https://registry.example.com/_authToken=<token>`, or — for a pnpr
 * registry published with a minted workload credential (OPS-143) —
 * `<url>_pnprWorkload=<audience>` paired with `<url>_authToken=<release-reader>`.
 * Lines are grouped by normalized URL, so the pair may come in either order;
 * with a workload line present, the `_authToken` is the READ credential only.
 * A workload line with no `_authToken` is accepted here and fails at publish
 * time, where the missing read credential can be named per target.
 *
 * Everything else **fails the decode** — loudly, which is the point of issue
 * #215 (the input spent four minor releases as a silent no-op):
 *
 * - a `_auth=<base64>` (htpasswd basic-auth) line: the predecessor accepted
 *   it, but the kit's `PackagePublish.setupAuth` writes only `_authToken`
 *   entries, so accepting the line would silently configure nothing;
 * - a bare URL: the predecessor fell back to the GitHub App token, a
 *   credential no third-party registry accepts (the same reasoning that
 *   removed the App-token fallback for GitHub Packages);
 * - two `_authToken` lines (or two `_pnprWorkload` lines) for the same
 *   registry: two tokens for one registry is a misconfiguration, not a
 *   preference order;
 * - a `_pnprWorkload` audience that is not an http(s) URL.
 *
 * Failure messages name the line number and (where safe) the registry —
 * never the token.
 *
 * Blank-line filtering and trimming are already done by
 * `ActionInput.lines`; this function assumes non-empty trimmed lines.
 *
 * @param lines - The trimmed, non-empty lines of the `custom-registries` input.
 * @returns The parsed entries, or a `ConfigError` naming the offending line.
 *
 * @public
 */
export const parseCustomRegistries = (
	lines: ReadonlyArray<string>,
): Effect.Effect<ReadonlyArray<CustomRegistryAuth>, Config.ConfigError> => {
	// Insertion order = the order each URL first appears, so the output stays
	// line-ordered for single-line registries.
	const byRegistry = new Map<
		string,
		{ token?: Redacted.Redacted<string>; tokenLine?: number; workload?: CustomRegistryWorkload; workloadLine?: number }
	>();
	for (const [index, line] of lines.entries()) {
		const lineNo = index + 1;
		const match = REGISTRY_LINE.exec(line);
		if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) {
			return configFailure(
				BASIC_AUTH_LINE.test(line)
					? `custom-registries line ${lineNo}: \`_auth=<base64>\` (basic auth) is no longer supported — ` +
							"the publish chain writes `_authToken` npmrc entries only. Supply a bearer token as " +
							"`https://registry.example.com/_authToken=<token>`."
					: `custom-registries line ${lineNo}: expected \`<registry-url>_authToken=<token>\` ` +
							"(e.g. `https://registry.example.com/_authToken=<token>`) or " +
							"`<registry-url>_pnprWorkload=<audience>`. A bare registry URL is not accepted — the GitHub " +
							"App token fallback was removed, so every custom registry needs an explicit token.",
			);
		}
		const registry = `${match[1].replace(/\/+$/, "")}/`;
		if (!/^https?:\/\/.+/.test(registry)) {
			return configFailure(`custom-registries line ${lineNo}: registry must be an http(s) URL, got \`${registry}\``);
		}
		const entry = byRegistry.get(registry) ?? {};
		if (match[2] === "_authToken") {
			if (entry.tokenLine !== undefined) {
				return configFailure(
					`custom-registries line ${lineNo}: duplicate \`_authToken\` entry for \`${registry}\` (already on line ` +
						`${entry.tokenLine}) — one token per registry`,
				);
			}
			entry.token = Redacted.make(match[3]);
			entry.tokenLine = lineNo;
		} else {
			if (entry.workloadLine !== undefined) {
				return configFailure(
					`custom-registries line ${lineNo}: duplicate \`_pnprWorkload\` entry for \`${registry}\` (already on line ` +
						`${entry.workloadLine}) — one workload audience per registry`,
				);
			}
			// The workload path strips the OIDC env and publishes with the minted
			// token alone. npm and GitHub Packages accept neither that token nor a
			// replacement for trusted publishing or `github-token`, so the line is
			// a misconfiguration there, never a credential choice.
			if (classifyRegistry(registry) !== "custom") {
				return configFailure(
					`custom-registries line ${lineNo}: \`_pnprWorkload\` applies to custom registries only, not \`${registry}\``,
				);
			}
			// The audience is not a secret, so it may be quoted back.
			if (!isHttpUrl(match[3])) {
				return configFailure(
					`custom-registries line ${lineNo}: \`_pnprWorkload\` audience must be an http(s) URL ` +
						`(e.g. \`https://registry.savvyweb.systems\`), got \`${match[3]}\``,
				);
			}
			// Verbatim: pnpr compares the token's \`aud\` claim exactly, so a
			// "normalizing" trailing slash would mint a token it rejects.
			entry.workload = { audience: match[3] };
			entry.workloadLine = lineNo;
		}
		byRegistry.set(registry, entry);
	}
	return Effect.succeed(
		Array.from(
			byRegistry,
			([registry, entry]): CustomRegistryAuth => ({
				registry,
				...(entry.token !== undefined ? { token: entry.token } : {}),
				...(entry.workload !== undefined ? { workload: entry.workload } : {}),
			}),
		),
	);
};
