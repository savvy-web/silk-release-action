/**
 * The `action.yml` ↔ code sync guard for INPUTS.
 *
 * Three legs, all three asserted: the manifest, the `INPUT_NAMES` tuple, and
 * what `src/` actually reads. Two legs would not have caught either live
 * divergence this guard was written for — a `build-command` read that no
 * workflow could set (code-only), and a `custom-registries` input nothing
 * implemented (manifest-only).
 *
 * Written in plain Vitest to match the other ~28 suites here. The kit's own
 * convention is `@effect/vitest` (`it.effect` + `assert`), which this repo
 * does not yet install; converting the suite is tracked separately.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "@effect/vitest";
import { ActionInput } from "@effected/github-actions";
import { Config, Effect, Option, Redacted } from "effect";
import { INPUT_NAMES, readInputs } from "../src/schema/inputs.js";
import { declaredInputNames, scanInputReads, stripComments } from "./utils/manifest.js";

/** The credentials every decode needs; `required: true` in the manifest. */
const CREDENTIALS = { "app-client-id": "client-id", "app-private-key": "-----BEGIN PRIVATE KEY-----" };

/**
 * An `ActionInput` environment that records every input name looked up.
 *
 * @remarks
 * Optional inputs read as absent — the "no inputs supplied" case — while the
 * required credentials are served so the decode reaches every later field.
 * Only the `INPUT_`-prefixed spelling is recorded: the provider is
 * dual-accept and falls back to a verbatim lookup, and counting both would
 * measure how many spellings it tries rather than which inputs it reads.
 *
 * This object must be passed to `ActionInput.layer` DIRECTLY, never spread.
 * A spread copies through `ownKeys`, which on a proxy over an empty target
 * yields nothing — the recorder is discarded and every assertion below sees an
 * empty set while still passing its other legs. That failure mode cost a
 * debugging round here; the assertion that the recorded set is non-empty is
 * what makes it loud.
 */
const recordingEnv = (seen: Set<string>): Record<string, string> =>
	new Proxy({} as Record<string, string>, {
		get: (_target, property) => {
			if (typeof property !== "string" || !property.startsWith("INPUT_")) return undefined;
			// `(?:INPUT_)+`, not a single slice: the provider's fallback path
			// re-derives the variable name from an already-derived one, so a miss
			// is probed as `INPUT_INPUT_RELEASE-BRANCH`. Counting that spelling
			// separately doubles the recorded set with phantom `input_*` names.
			const name = property.replace(/^(?:INPUT_)+/, "").toLowerCase();
			seen.add(name);
			return (CREDENTIALS as Record<string, string>)[name];
		},
	});

describe("INPUT_NAMES", () => {
	it("should match the inputs action.yml declares", () => {
		expect([...INPUT_NAMES].sort()).toEqual([...declaredInputNames()].sort());
	});

	it.effect("should be exactly the set readInputs reads", () =>
		Effect.gen(function* () {
			const seen = new Set<string>();
			// Passed directly, NOT spread — see `recordingEnv`.
			yield* readInputs.pipe(Effect.provide(ActionInput.layer(recordingEnv(seen))));
			// Guards the recorder itself: an inert proxy records nothing, and an
			// empty-vs-empty comparison would pass while proving nothing.
			expect(seen.size).toBeGreaterThan(0);
			expect([...seen].sort()).toEqual([...INPUT_NAMES].sort());
		}),
	);
});

describe("action.yml ↔ src/ input reads", () => {
	it("should never read an input action.yml does not declare", () => {
		// The leg that catches a code-only input. `build-command` was read in
		// `validate-builds.ts` and declared nowhere, in any commit.
		const declared = declaredInputNames();
		const undeclared = [...scanInputReads().names.entries()]
			.filter(([name]) => !declared.includes(name))
			.map(([name, files]) => `${name} (read in ${files.join(", ")})`);
		expect(undeclared).toEqual([]);
	});

	it("should read every input action.yml declares", () => {
		// The leg that catches a manifest-only input. `custom-registries` was
		// advertised in the manifest and the README while nothing read it —
		// from #90 until the wiring was restored for issue #215.
		const read = new Set(scanInputReads().names.keys());
		expect(declaredInputNames().filter((name) => !read.has(name))).toEqual([]);
	});

	it("should resolve every input name to a literal", () => {
		// A dynamic name makes the manifest unenforceable; it must be a visible
		// decision, not a quiet weakening of the guard above.
		expect(scanInputReads().unresolved).toEqual([]);
	});
});

describe("readInputs", () => {
	const provide = (env: Record<string, string>) => ActionInput.layer({ ...CREDENTIALS, ...env });

	it.effect("should apply action.yml defaults when everything optional is absent", () =>
		Effect.gen(function* () {
			const inputs = yield* readInputs.pipe(Effect.provide(provide({})));
			expect(inputs.releaseBranch).toBe("changeset-release/main");
			expect(inputs.targetBranch).toBe("main");
			expect(inputs.dryRun).toBe(false);
			expect(inputs.strictWarnings).toBe(false);
			expect(inputs.githubToken).toBe("");
			expect(inputs.npmToken).toBe("");
			expect(inputs.sbomConfig).toBe("");
			expect(inputs.customRegistries).toEqual([]);
			expect(Option.isNone(inputs.autoMerge)).toBe(true);
			expect(Option.isNone(inputs.phase)).toBe(true);
			expect(Option.isNone(inputs.onBuild)).toBe(true);
		}),
	);

	it.effect("should decode supplied values", () =>
		Effect.gen(function* () {
			const inputs = yield* readInputs.pipe(
				Effect.provide(
					provide({
						"release-branch": "release/next",
						"dry-run": "true",
						"auto-merge": "squash",
						phase: "validation",
						"custom-registries": "https://a.example.com/_authToken=x\n\nhttps://b.example.com/_authToken=y",
					}),
				),
			);
			expect(inputs.releaseBranch).toBe("release/next");
			expect(inputs.dryRun).toBe(true);
			expect(inputs.autoMerge).toEqual(Option.some("squash"));
			expect(inputs.phase).toEqual(Option.some("validation"));
			// `lines` drops blanks and trims, then `parseCustomRegistries` yields
			// one registry/`Redacted`-token pair per line (issue #215).
			expect(inputs.customRegistries.map((e) => e.registry)).toEqual([
				"https://a.example.com/",
				"https://b.example.com/",
			]);
			expect(inputs.customRegistries.map((e) => Redacted.value(e.token))).toEqual(["x", "y"]);
		}),
	);

	it.effect("should fail rather than silently defaulting on a malformed boolean", () =>
		Effect.gen(function* () {
			// `Config.withDefault` reads the ISSUE, not the combinator: a malformed
			// value must not be classified as missing data and defaulted to a REAL run.
			const exit = yield* Effect.exit(readInputs.pipe(Effect.provide(provide({ "dry-run": "yes" }))));
			expect(exit._tag).toBe("Failure");
		}),
	);

	it.effect("should treat a blank on-build as absent, not as an empty command", () =>
		Effect.gen(function* () {
			// A caller plumbing an unset workflow input through writes
			// `on-build: ${{ inputs.on-build }}`, which passes "" — not an absent
			// variable. `Option.some("")` here would spawn an empty command on
			// every release in every repo that plumbs the input through.
			const blank = yield* readInputs.pipe(Effect.provide(provide({ "on-build": "" })));
			expect(Option.isNone(blank.onBuild)).toBe(true);

			const whitespace = yield* readInputs.pipe(Effect.provide(provide({ "on-build": "   " })));
			expect(Option.isNone(whitespace.onBuild)).toBe(true);
		}),
	);

	it.effect("should carry the on-build command when set", () =>
		Effect.gen(function* () {
			const inputs = yield* readInputs.pipe(Effect.provide(provide({ "on-build": "pnpm catalog:check" })));
			expect(inputs.onBuild).toEqual(Option.some("pnpm catalog:check"));
		}),
	);

	it.effect("should fail on an unrecognised phase rather than routing to the no-op arm", () =>
		Effect.gen(function* () {
			// The behaviour the `as WorkflowPhase` cast in main.ts does not have: a
			// typo currently falls through to `default:` and skips the entire run.
			const exit = yield* Effect.exit(readInputs.pipe(Effect.provide(provide({ phase: "validaton" }))));
			expect(exit._tag).toBe("Failure");
		}),
	);

	it.effect("should fail when a required credential is absent", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(
				readInputs.pipe(Effect.provide(ActionInput.layer({ "app-client-id": "only-this" }))),
			);
			expect(exit._tag).toBe("Failure");
		}),
	);

	it.effect("should treat an empty required credential as absent", () =>
		Effect.gen(function* () {
			// The runner writes "" for an input the workflow omitted; the kit's rule
			// is that "" and absent are the same missing-data case.
			const exit = yield* Effect.exit(
				readInputs.pipe(Effect.provide(ActionInput.layer({ ...CREDENTIALS, "app-client-id": "" }))),
			);
			expect(exit._tag).toBe("Failure");
		}),
	);
});

describe("custom-registries", () => {
	// The predecessor of this block pinned the REGRESSION state — "decoded but
	// consumed by nothing" (issue #215, lost in #90). The wiring is restored:
	// `schema/inputs.ts` parses the lines into registry/`Redacted`-token pairs,
	// `steps/publishing.ts` hands them to `runPublishTargets`, and `pickToken`
	// routes each token into `PackagePublish.setupAuth`. The END-TO-END proof —
	// a configured token reaching the npmrc write for a custom-registry target —
	// lives in `__test__/unit/release/publish.test.ts` ("custom-registry auth");
	// what is pinned here is the decode surface and the hand-off.

	it("should still be read only in schema/inputs.ts", () => {
		// The single-decode rule survives the wiring: consumers take the PARSED
		// value from `Inputs`, nothing re-reads the raw input.
		const consumers = scanInputReads().names.get("custom-registries") ?? [];
		expect([...consumers]).toEqual(["src/schema/inputs.ts"]);
	});

	it("should be handed from the publishing step to runPublishTargets", () => {
		// The wiring whose ABSENCE was issue #215, pinned structurally. This is
		// the one hop a compile error cannot guard: `runPublishTargets` defaults
		// the parameter (so its many test callers need not thread it), which
		// means deleting the hand-off below would type-check — and the input
		// would be a silent no-op again with every other suite green.
		const source = readFileSync(
			join(fileURLToPath(new URL("../", import.meta.url)), "src/steps/publishing.ts"),
			"utf8",
		);
		expect(stripComments(source)).toMatch(/runPublishTargets\([^)]*inputs\.customRegistries/s);
	});

	it.effect("should fail the decode on a malformed line rather than silently ignoring it", () =>
		Effect.gen(function* () {
			// A bare URL (the predecessor's App-token-fallback form) is no longer
			// accepted — silence is the failure mode this input already shipped
			// once. Full parse-rule coverage lives in
			// `__test__/unit/utilities/custom-registries.test.ts`.
			const exit = yield* Effect.exit(
				readInputs.pipe(
					Effect.provide(ActionInput.layer({ ...CREDENTIALS, "custom-registries": "https://registry.example.com/" })),
				),
			);
			expect(exit._tag).toBe("Failure");
		}),
	);
});

/**
 * Modules allowed to read an input outside `schema/inputs.ts`, and why.
 *
 * @remarks
 * An allowlist with reasons, not a count. The count started as a ratchet and
 * did its job twice — 5 → 4 when `main.ts` folded, 4 → 1 when the util modules
 * did — but "how many" stops being the useful question once the duplication is
 * gone. What matters now is that any NEW reader has to come here and justify
 * itself.
 *
 * Everything absent from this map may be read in `schema/inputs.ts` alone.
 */
const SANCTIONED_EXTRA_READERS: Readonly<Record<string, ReadonlyArray<string>>> = {
	// `pre` is a SEPARATE PROCESS. It cannot be handed `main`'s decoded record,
	// so it decodes the three values it needs to mint the App token itself.
	"app-client-id": ["src/pre.ts"],
	"app-private-key": ["src/pre.ts"],
	"github-token": ["src/pre.ts"],
	// The DEFINITION site of `autoMergeMethodConfig`, which `schema/inputs.ts`
	// imports and composes. Not a duplicate read — the one read, declared next
	// to the schema that validates it.
	"auto-merge": ["src/utils/auto-merge.ts"],
	// Two genuine remaining duplicates, both single reads with semantics that
	// differ from the `Inputs` field (`Config.option` vs `withDefault("")`, and
	// a `.trim()`), so folding them is a behaviour change rather than a move.
	// Worth doing, deliberately not bundled into the branch-name fold.
	"npm-token": ["src/release/publish.ts"],
	"sbom-config": ["src/utils/load-release-config.ts"],
};

describe("input defaults", () => {
	it("should read each input only in schema/inputs.ts, or a sanctioned module", () => {
		// The invariant the whole fold was for: a default is stated once, so two
		// call sites cannot disagree about which branch a release targets.
		const scan = scanInputReads();
		const offenders: string[] = [];
		for (const [name, files] of scan.names) {
			const allowed = new Set(["src/schema/inputs.ts", ...(SANCTIONED_EXTRA_READERS[name] ?? [])]);
			for (const file of files) {
				if (!allowed.has(file)) offenders.push(`${name} read in ${file}`);
			}
		}
		expect(offenders).toEqual([]);
	});

	it("should read release-branch in exactly one place", () => {
		// The specific duplication this began with: six call sites, each
		// restating `"changeset-release/main"`. Called out on its own because it
		// is the one a regression is most likely to recreate.
		expect(scanInputReads().names.get("release-branch")).toEqual(["src/schema/inputs.ts"]);
	});

	it("should keep every sanctioned exception real", () => {
		// An allowlist that outlives its reason is how an exception becomes the
		// rule. If a module stops reading the input, its entry must go.
		const scan = scanInputReads();
		const stale: string[] = [];
		for (const [name, files] of Object.entries(SANCTIONED_EXTRA_READERS)) {
			const actual = scan.names.get(name) ?? [];
			for (const file of files) {
				if (!actual.includes(file)) stale.push(`${name} no longer read in ${file}`);
			}
		}
		expect(stale).toEqual([]);
	});

	it("should no longer read any input inside main.ts", () => {
		// `main.ts` held eleven `ActionInput` reads across four phase bodies,
		// three of them re-reading `release-branch` in the same process. The fold
		// moved every one to `readInputs`; this keeps them from creeping back as
		// phase bodies get edited.
		const scan = scanInputReads();
		const mainReads = [...scan.names.entries()]
			.filter(([, files]) => files.includes("src/main.ts"))
			.map(([name]) => name);
		expect(mainReads).toEqual([]);
	});
});

describe("stripComments", () => {
	// The scanner's own guard. A stripper that eats too much empties the scan,
	// and an empty scan passes every "should never read an undeclared input"
	// assertion — failing invisibly, in the safe-looking direction.
	it("should remove a block comment mentioning a call", () => {
		expect(stripComments(`/** see ActionInput.string("phase") */\nconst a = 1;`)).not.toContain("ActionInput");
	});

	it("should remove a full-line comment mentioning a call", () => {
		expect(stripComments(`\t// was ActionInput.boolean("dry-run")\nconst a = 1;`)).not.toContain("ActionInput");
	});

	it("should NOT eat a URL in a string literal", () => {
		// `//` inside `"https://…"` is why trailing line comments are left alone.
		const source = `const url = "https://registry.example.com/";`;
		expect(stripComments(source)).toBe(source);
	});

	it("should keep the code following a stripped comment", () => {
		const stripped = stripComments(`/* prose */\nActionInput.string("phase");`);
		expect(stripped).toContain(`ActionInput.string("phase")`);
	});

	it("should not let a line comment containing a block opener swallow real code", () => {
		// Line comments are stripped FIRST for exactly this: otherwise the `/*`
		// in prose opens a phantom block that eats everything after it.
		const stripped = stripComments(`// a /* b\nActionInput.string("phase");`);
		expect(stripped).toContain(`ActionInput.string("phase")`);
	});
});

describe("Config surface", () => {
	it("should expose readInputs as a Config, so it composes as an Effect", () => {
		// `Config<T> extends Effect<T, ConfigError>` in v4 — verified against the
		// vendored source. This pins the property the direct export relies on.
		expect(Config.isConfig(readInputs)).toBe(true);
	});
});
