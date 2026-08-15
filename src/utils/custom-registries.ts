// The `custom-registries` input, parsed.
//
// Restores the capability lost in the publish-chain migration (#90, issue
// #215): each line binds a custom registry URL to the npmrc auth token the
// Phase-3 publish flow sends it. The parse lives here as a PURE function —
// the input itself is still read exactly once, in `schema/inputs.ts`, which
// composes this via `Config.mapOrFail`.

import { Config, Effect, Redacted, SchemaError, SchemaIssue } from "effect";

/**
 * One parsed `custom-registries` line: a registry URL bound to its token.
 *
 * @remarks
 * The token is `Redacted` from the moment it leaves the raw line. It is
 * declassified exactly once, in `release/publish.ts`, through the kit's
 * `Secret` seam — mask-first — and reaches npm only via
 * `PackagePublish.setupAuth`'s npmrc write. No process-environment bridge
 * exists on this path; the plaintext-env bridge the predecessor used was
 * deleted deliberately (see `program.ts`).
 *
 * @public
 */
export interface CustomRegistryAuth {
	/** The registry URL, normalized to carry a trailing slash. */
	readonly registry: string;
	/** The `_authToken` value for that registry. */
	readonly token: Redacted.Redacted<string>;
}

/**
 * Fail the decode with a message the runner will print.
 *
 * `Config.ConfigError` wrapping a `SchemaError`, matching what every other
 * input failure in `schema/inputs.ts` surfaces — the message names the line
 * NUMBER and the registry, never the token.
 */
const configFailure = (message: string): Effect.Effect<never, Config.ConfigError> =>
	Effect.fail(new Config.ConfigError(new SchemaError.SchemaError(new SchemaIssue.InvalidValue({ message }))));

/**
 * The accepted line shape: a registry URL immediately followed by an npmrc
 * `_authToken=` auth string, e.g.
 * `https://registry.example.com/_authToken=npm_abc123`.
 *
 * Lazy prefix, so the FIRST `_authToken=` splits the line — a token that
 * itself contains the text still parses whole.
 */
const AUTH_TOKEN_LINE = /^(.+?)\/?_authToken=(.+)$/;

/** A `_auth=<base64>` line — the predecessor supported it; the kit does not. */
const BASIC_AUTH_LINE = /^.+?\/?_auth=.+$/;

/**
 * Parse the `custom-registries` input lines into typed registry/token pairs.
 *
 * @remarks
 * The format is one registry per line, URL immediately followed by the npmrc
 * auth string: `https://registry.example.com/_authToken=<token>`.
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
 * - two lines for the same registry: two tokens for one registry is a
 *   misconfiguration, not a preference order.
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
	const entries: CustomRegistryAuth[] = [];
	const seen = new Set<string>();
	for (const [index, line] of lines.entries()) {
		const match = AUTH_TOKEN_LINE.exec(line);
		if (match?.[1] === undefined || match[2] === undefined) {
			return configFailure(
				BASIC_AUTH_LINE.test(line)
					? `custom-registries line ${index + 1}: \`_auth=<base64>\` (basic auth) is no longer supported — ` +
							"the publish chain writes `_authToken` npmrc entries only. Supply a bearer token as " +
							"`https://registry.example.com/_authToken=<token>`."
					: `custom-registries line ${index + 1}: expected \`<registry-url>_authToken=<token>\` ` +
							"(e.g. `https://registry.example.com/_authToken=<token>`). A bare registry URL is not " +
							"accepted — the GitHub App token fallback was removed, so every custom registry needs " +
							"an explicit token.",
			);
		}
		const registry = `${match[1].replace(/\/+$/, "")}/`;
		if (!/^https?:\/\/.+/.test(registry)) {
			return configFailure(`custom-registries line ${index + 1}: registry must be an http(s) URL, got \`${registry}\``);
		}
		if (seen.has(registry)) {
			return configFailure(
				`custom-registries line ${index + 1}: duplicate entry for \`${registry}\` — one token per registry`,
			);
		}
		seen.add(registry);
		entries.push({ registry, token: Redacted.make(match[2]) });
	}
	return Effect.succeed(entries);
};
