# Action Output Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ~22 ad-hoc `outputs.set(...)` calls in `main.ts` with a single schema-defined `result` JSON output (plus five convenience scalars) that explains what each release-action run did.

**Architecture:** An Effect `Schema.Union` of three phase structs (`ReleaseOutput`) is the single source of truth. Three pure projection functions map internal result types into it through small explicit input interfaces. `main.ts` builds and emits the projection at each phase exit via `ActionOutputs.setJson`. A build script generates a SchemaStore-compatible `silk-release-action.schema.json` from the Effect Schema, guarded by a no-drift test.

**Tech Stack:** Effect (`Schema`, `Effect`), `@savvy-web/github-action-effects` (`ActionOutputs`), `json-schema-effect` (`JsonSchemaExporter`, `JsonSchemaValidator`), `ajv`, `tsx`, Vitest.

---

## Background the implementer must know

- **Source spec:** `docs/superpowers/specs/2026-05-15-action-output-schema-design.md`. Read it. This plan implements it.
- **Effect Schema pattern in this repo:** see `src/state.ts` — `Schema.Class`/`Schema.Struct` definitions, decoded with `ActionState`. For plain structs use `const X = Schema.Struct({...})` and a sibling `type X = Schema.Schema.Type<typeof X>` (a const value and a type can share a name in TypeScript).
- **`ActionOutputs.setJson` signature** (`@savvy-web/github-action-effects`): `setJson: <A, I>(name: string, value: A, schema: Schema.Schema<A, I, never>) => Effect.Effect<void, ActionOutputError>`. It Schema-encodes `value`, then writes the JSON. Field order in the emitted JSON follows the `Schema.Struct` definition order, so `$schema` must be the first declared field.
- **Tests** live in `__test__/`, run with Vitest. Run a single file with `npx vitest run __test__/<file>.test.ts`. The repo's commit hook runs `tsgo --noEmit`, Biome, and commitlint — keep commits clean.
- **Biome rules:** tabs, `.js` import extensions, `type`-only imports separated, explicit return types on exports, lexicographic import order. Run `pnpm lint:fix` before each commit.
- **Commit messages:** Conventional Commits, lowercase, imperative, header ≤100 chars, body lines ≤300 chars, no markdown in body, end with `Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>`. Use type `feat` for these commits.
- **Internal result types** the projections consume (do not modify them):
  - `PackagePublishResult` — `src/utils/generate-publish-summary.ts:417` — `{ name, version, targets: TargetPublishResult[], githubAttestationUrl?: string }`
  - `TargetPublishResult` — `src/utils/generate-publish-summary.ts:388` — `{ target: ResolvedTarget, success: boolean, registryUrl?, attestationUrl?, error?, alreadyPublished?, alreadyPublishedReason?, tarballDigest?, sbomAttestationUrl?, ... }`
  - `ResolvedTarget` — `src/types/publish-config.ts:106` — `{ registry: string | null, ... }` (`registry` is `null` for JSR)
  - `AlreadyPublishedReason` — `src/types/publish-config.ts:237` — `"identical" | "different" | "unknown"`
  - `PublishPackagesResult` — `src/utils/publish-packages.ts:29` — `{ success, packages: PackagePublishResult[], totalPackages, successfulPackages, ... }`
  - `TagInfo` — `src/utils/determine-tag-strategy.ts:20` — `{ name, packageName, version }`
  - `ReleaseInfo` — `src/utils/create-github-releases.ts:39` — `{ tag, url, id, assets }`
  - `CreateReleaseBranchResult` — `src/utils/create-release-branch.ts:37` — `{ created, prNumber, checkId, versionSummary }`
  - `UpdateReleaseBranchResult` (not exported) — `src/utils/update-release-branch.ts:45` — `{ success, hadConflicts, prNumber, checkId, versionSummary, linkedIssues }`
  - `ChangesetStatusResult` — `src/utils/get-changeset-status.ts:8` — `{ releases: Array<{ name, type, ... }>, changesets: Array<{ id, ... }> }`

## File structure

| File | Responsibility |
| --- | --- |
| `src/schema/release-output.ts` (new) | The `ReleaseOutput` `Schema.Union`, the three phase structs, envelope constants, `deriveStatus`. Source of truth. |
| `src/schema/projections.ts` (new) | Three pure projection functions + their explicit input interfaces. |
| `lib/scripts/generate-schema.ts` (new) | Generates + validates `silk-release-action.schema.json` from `ReleaseOutput`. |
| `silk-release-action.schema.json` (new, repo root) | Committed generated JSON Schema. |
| `__test__/release-output.test.ts` (new) | `deriveStatus` + schema round-trip + union discrimination tests. |
| `__test__/projections.test.ts` (new) | Projection function tests. |
| `__test__/generate-schema.test.ts` (new) | No-drift test: regenerate, deep-equal the committed file. |
| `src/main.ts` (modify) | Replace `outputs.set(...)` calls with per-phase build-and-emit. |
| `action.yml`, `.github/actions/release/action.yml` (modify) | Collapse the release outputs to `result` + five scalars. |
| `docs/configuration.md` (modify) | Update the outputs documentation. |
| `package.json` (modify) | Add `generate-schema` script + devDependencies. |

---

## Task 1: The `ReleaseOutput` schema module

**Files:**

- Create: `src/schema/release-output.ts`
- Test: `__test__/release-output.test.ts`

- [ ] **Step 1: Write the failing test for `deriveStatus`**

Create `__test__/release-output.test.ts`:

```typescript
/**
 * Tests for the ReleaseOutput schema module: status derivation, schema
 * round-tripping, and phase discrimination on the union.
 */

import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { deriveStatus, ReleaseOutput, SCHEMA_URL, SCHEMA_VERSION } from "../src/schema/release-output.js";

describe("deriveStatus", () => {
 it("returns no-op when noop is set, regardless of other flags", () => {
  expect(deriveStatus({ noop: true, succeeded: true, hasFailures: false })).toBe("no-op");
  expect(deriveStatus({ noop: true, succeeded: false, hasFailures: true })).toBe("no-op");
 });

 it("returns success when succeeded and not noop", () => {
  expect(deriveStatus({ noop: false, succeeded: true, hasFailures: false })).toBe("success");
 });

 it("returns partial when hasFailures and not succeeded or noop", () => {
  expect(deriveStatus({ noop: false, succeeded: false, hasFailures: true })).toBe("partial");
 });

 it("returns failed as the fallthrough", () => {
  expect(deriveStatus({ noop: false, succeeded: false, hasFailures: false })).toBe("failed");
 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __test__/release-output.test.ts`
Expected: FAIL — cannot resolve `../src/schema/release-output.js`.

- [ ] **Step 3: Create the schema module**

Create `src/schema/release-output.ts`:

```typescript
/**
 * The release action's structured JSON output contract.
 *
 * @remarks
 * `ReleaseOutput` is a `Schema.Union` of three phase structs, discriminated by
 * the `phase` literal. It is the single source of truth: the committed
 * `silk-release-action.schema.json` is generated from it, and `main.ts` emits
 * a Schema-encoded instance as the `result` action output.
 *
 * Field order matters — `setJson` serialises in declaration order, so `$schema`
 * is declared first in every phase struct.
 */

import { Schema } from "effect";

/** Hosted JSON Schema URL; the emitted `result` carries this as `$schema`. */
export const SCHEMA_URL = "https://json.schemastore.org/silk-release-action.schema.json";

/**
 * In-band schema version. Bumped only on a breaking JSON-shape change
 * (removed/renamed field, changed type) — additive fields do not bump it.
 */
export const SCHEMA_VERSION = "1";

/** The three orthogonal machine flags every phase derives. */
export interface ReleaseFlags {
 readonly noop: boolean;
 readonly succeeded: boolean;
 readonly hasFailures: boolean;
}

/** Human-readable status label — derived from the flags, never the contract. */
export type ReleaseStatus = "no-op" | "success" | "partial" | "failed";

/**
 * Derive the human-readable `status` label from the machine flags.
 * Precedence: no-op wins, then success, then partial, then failed.
 */
export const deriveStatus = (flags: ReleaseFlags): ReleaseStatus => {
 if (flags.noop) return "no-op";
 if (flags.succeeded) return "success";
 if (flags.hasFailures) return "partial";
 return "failed";
};

const StatusLiteral = Schema.Literal("no-op", "success", "partial", "failed");

// --- branch-management phase ---------------------------------------------

const BranchManagementPayload = Schema.Struct({
 releaseBranch: Schema.Struct({
  name: Schema.String,
  existed: Schema.Boolean,
  created: Schema.Boolean,
  updated: Schema.Boolean,
  hasConflicts: Schema.Boolean,
 }),
 releasePr: Schema.NullOr(
  Schema.Struct({
   number: Schema.Number,
   url: Schema.String,
   action: Schema.Literal("created", "updated"),
  }),
 ),
 changesets: Schema.Struct({
  count: Schema.Number,
  packages: Schema.Array(
   Schema.Struct({
    name: Schema.String,
    bumpType: Schema.Literal("major", "minor", "patch"),
   }),
  ),
 }),
});

export const BranchManagementOutput = Schema.Struct({
 $schema: Schema.Literal(SCHEMA_URL),
 schemaVersion: Schema.Literal(SCHEMA_VERSION),
 phase: Schema.Literal("branch-management"),
 status: StatusLiteral,
 noop: Schema.Boolean,
 succeeded: Schema.Boolean,
 hasFailures: Schema.Boolean,
 dryRun: Schema.Boolean,
 branchManagement: BranchManagementPayload,
});
export type BranchManagementOutput = Schema.Schema.Type<typeof BranchManagementOutput>;

// --- validation phase ----------------------------------------------------

const ValidationPayload = Schema.Struct({
 builds: Schema.Struct({
  passed: Schema.Boolean,
  packageCount: Schema.Number,
 }),
 publish: Schema.Struct({
  npmReady: Schema.Boolean,
  githubPackagesReady: Schema.Boolean,
  packages: Schema.Array(
   Schema.Struct({
    name: Schema.String,
    version: Schema.String,
    ready: Schema.Boolean,
   }),
  ),
 }),
 checkRun: Schema.NullOr(
  Schema.Struct({
   url: Schema.String,
   conclusion: Schema.String,
  }),
 ),
});

export const ValidationOutput = Schema.Struct({
 $schema: Schema.Literal(SCHEMA_URL),
 schemaVersion: Schema.Literal(SCHEMA_VERSION),
 phase: Schema.Literal("validation"),
 status: StatusLiteral,
 noop: Schema.Boolean,
 succeeded: Schema.Boolean,
 hasFailures: Schema.Boolean,
 dryRun: Schema.Boolean,
 validation: ValidationPayload,
});
export type ValidationOutput = Schema.Schema.Type<typeof ValidationOutput>;

// --- publishing phase ----------------------------------------------------

const PublishTarget = Schema.Struct({
 registry: Schema.String,
 status: Schema.Literal("published", "skipped", "failed"),
 registryUrl: Schema.NullOr(Schema.String),
 error: Schema.NullOr(Schema.String),
});

const PublishPackage = Schema.Struct({
 name: Schema.String,
 version: Schema.String,
 status: Schema.Literal("published", "skipped", "failed"),
 skipReason: Schema.NullOr(Schema.Literal("already-published-identical", "already-published-unknown")),
 targets: Schema.Array(PublishTarget),
 attestations: Schema.Struct({
  provenanceUrl: Schema.NullOr(Schema.String),
  sbomUrl: Schema.NullOr(Schema.String),
  githubAttestationUrl: Schema.NullOr(Schema.String),
 }),
 tarballDigest: Schema.NullOr(Schema.String),
});

const PublishingPayload = Schema.Struct({
 packages: Schema.Array(PublishPackage),
 tags: Schema.Array(Schema.Struct({ name: Schema.String, sha: Schema.String })),
 releases: Schema.Array(Schema.Struct({ tag: Schema.String, url: Schema.String, id: Schema.Number })),
});

export const PublishingOutput = Schema.Struct({
 $schema: Schema.Literal(SCHEMA_URL),
 schemaVersion: Schema.Literal(SCHEMA_VERSION),
 phase: Schema.Literal("publishing"),
 status: StatusLiteral,
 noop: Schema.Boolean,
 succeeded: Schema.Boolean,
 hasFailures: Schema.Boolean,
 dryRun: Schema.Boolean,
 publishing: PublishingPayload,
});
export type PublishingOutput = Schema.Schema.Type<typeof PublishingOutput>;

// --- the union -----------------------------------------------------------

/** The phase-discriminated release output contract. */
export const ReleaseOutput = Schema.Union(BranchManagementOutput, ValidationOutput, PublishingOutput).annotations({
 identifier: "ReleaseOutput",
 title: "Silk Release Action output",
});
export type ReleaseOutput = Schema.Schema.Type<typeof ReleaseOutput>;
```

- [ ] **Step 4: Run the test to verify `deriveStatus` passes**

Run: `npx vitest run __test__/release-output.test.ts`
Expected: PASS for the four `deriveStatus` tests.

- [ ] **Step 5: Add the round-trip + discrimination tests**

Append to `__test__/release-output.test.ts`:

```typescript
describe("ReleaseOutput schema", () => {
 const branchSample: ReleaseOutput = {
  $schema: SCHEMA_URL,
  schemaVersion: SCHEMA_VERSION,
  phase: "branch-management",
  status: "success",
  noop: false,
  succeeded: true,
  hasFailures: false,
  dryRun: false,
  branchManagement: {
   releaseBranch: { name: "changeset-release/main", existed: true, created: false, updated: true, hasConflicts: false },
   releasePr: { number: 42, url: "https://example.com/pr/42", action: "updated" },
   changesets: { count: 1, packages: [{ name: "@savvy-web/foo", bumpType: "minor" }] },
  },
 };

 const publishingSample: ReleaseOutput = {
  $schema: SCHEMA_URL,
  schemaVersion: SCHEMA_VERSION,
  phase: "publishing",
  status: "success",
  noop: false,
  succeeded: true,
  hasFailures: false,
  dryRun: false,
  publishing: {
   packages: [
    {
     name: "@savvy-web/foo",
     version: "1.2.0",
     status: "published",
     skipReason: null,
     targets: [
      { registry: "https://npm.pkg.github.com/", status: "published", registryUrl: null, error: null },
     ],
     attestations: { provenanceUrl: null, sbomUrl: null, githubAttestationUrl: null },
     tarballDigest: "sha256:abc",
    },
   ],
   tags: [{ name: "@savvy-web/foo@1.2.0", sha: "abc123" }],
   releases: [{ tag: "@savvy-web/foo@1.2.0", url: "https://example.com/r/1", id: 999 }],
  },
 };

 it("round-trips encode then decode as identity", () => {
  const encoded = Schema.encodeSync(ReleaseOutput)(branchSample);
  const decoded = Schema.decodeUnknownSync(ReleaseOutput)(encoded);
  expect(decoded).toEqual(branchSample);
 });

 it("decodes a publishing instance and keeps the phase block", () => {
  const decoded = Schema.decodeUnknownSync(ReleaseOutput)(publishingSample);
  expect(decoded.phase).toBe("publishing");
 });

 it("rejects a struct whose phase block does not match its phase literal", () => {
  const bad = { ...branchSample, phase: "publishing" };
  expect(() => Schema.decodeUnknownSync(ReleaseOutput)(bad)).toThrow();
 });

 it("emits $schema as the first JSON key", () => {
  const encoded = Schema.encodeSync(ReleaseOutput)(branchSample) as Record<string, unknown>;
  expect(Object.keys(encoded)[0]).toBe("$schema");
 });
});
```

- [ ] **Step 6: Run the full test file**

Run: `npx vitest run __test__/release-output.test.ts`
Expected: PASS — all `deriveStatus` and `ReleaseOutput schema` tests.

- [ ] **Step 7: Typecheck and lint**

Run: `pnpm lint:fix && npx tsgo --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/schema/release-output.ts __test__/release-output.test.ts
git commit -m "$(cat <<'EOF'
feat(schema): add ReleaseOutput phase-discriminated output schema

Define the ReleaseOutput Schema.Union of three phase structs with the shared envelope, the three machine flags, and the deriveStatus helper.

Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>
EOF
)"
```

---

## Task 2: Branch-management projection

**Files:**

- Create: `src/schema/projections.ts`
- Test: `__test__/projections.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__test__/projections.test.ts`:

```typescript
/**
 * Tests for the pure projection functions that map internal release-pipeline
 * results into ReleaseOutput phase structs.
 */

import { describe, expect, it } from "vitest";
import { SCHEMA_URL, SCHEMA_VERSION } from "../src/schema/release-output.js";
import { toBranchManagementOutput } from "../src/schema/projections.js";

describe("toBranchManagementOutput", () => {
 it("projects a clean update with a release PR", () => {
  const output = toBranchManagementOutput({
   releaseBranchName: "changeset-release/main",
   existed: true,
   created: false,
   updated: true,
   hasConflicts: false,
   releasePr: { number: 42, url: "https://example.com/pr/42", action: "updated" },
   changesets: [{ name: "@savvy-web/foo", bumpType: "minor" }],
   dryRun: false,
  });

  expect(output.phase).toBe("branch-management");
  expect(output.$schema).toBe(SCHEMA_URL);
  expect(output.schemaVersion).toBe(SCHEMA_VERSION);
  expect(output.noop).toBe(false);
  expect(output.succeeded).toBe(true);
  expect(output.hasFailures).toBe(false);
  expect(output.status).toBe("success");
  expect(output.branchManagement.changesets.count).toBe(1);
 });

 it("marks a run with no changesets as a no-op", () => {
  const output = toBranchManagementOutput({
   releaseBranchName: "changeset-release/main",
   existed: false,
   created: false,
   updated: false,
   hasConflicts: false,
   releasePr: null,
   changesets: [],
   dryRun: false,
  });

  expect(output.noop).toBe(true);
  expect(output.status).toBe("no-op");
  expect(output.branchManagement.releasePr).toBe(null);
 });

 it("flags merge conflicts as a failure", () => {
  const output = toBranchManagementOutput({
   releaseBranchName: "changeset-release/main",
   existed: true,
   created: false,
   updated: false,
   hasConflicts: true,
   releasePr: null,
   changesets: [{ name: "@savvy-web/foo", bumpType: "patch" }],
   dryRun: false,
  });

  expect(output.hasFailures).toBe(true);
  expect(output.succeeded).toBe(false);
  expect(output.status).toBe("partial");
 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __test__/projections.test.ts`
Expected: FAIL — cannot resolve `../src/schema/projections.js`.

- [ ] **Step 3: Create the projections file with the branch-management projection**

Create `src/schema/projections.ts`:

```typescript
/**
 * Pure projection functions: internal release-pipeline result types in,
 * `ReleaseOutput` phase structs out.
 *
 * @remarks
 * Each projection takes an explicit input interface — the deliberate seam
 * between sprawling internal types and the published `ReleaseOutput` contract.
 * `main.ts` adapts internal results into these inputs; the projections stay
 * pure and independently testable. Curation (dropping internal noise,
 * normalising per-target status) happens here.
 */

import {
 type BranchManagementOutput,
 deriveStatus,
 type ReleaseFlags,
 SCHEMA_URL,
 SCHEMA_VERSION,
} from "./release-output.js";

/** Input for {@link toBranchManagementOutput}. */
export interface BranchManagementInput {
 readonly releaseBranchName: string;
 readonly existed: boolean;
 readonly created: boolean;
 readonly updated: boolean;
 readonly hasConflicts: boolean;
 readonly releasePr: { readonly number: number; readonly url: string; readonly action: "created" | "updated" } | null;
 readonly changesets: ReadonlyArray<{ readonly name: string; readonly bumpType: "major" | "minor" | "patch" }>;
 readonly dryRun: boolean;
}

/** Project a branch-management run into a {@link BranchManagementOutput}. */
export const toBranchManagementOutput = (input: BranchManagementInput): BranchManagementOutput => {
 const flags: ReleaseFlags = {
  noop: input.changesets.length === 0,
  succeeded: !input.hasConflicts,
  hasFailures: input.hasConflicts,
 };
 return {
  $schema: SCHEMA_URL,
  schemaVersion: SCHEMA_VERSION,
  phase: "branch-management",
  status: deriveStatus(flags),
  noop: flags.noop,
  succeeded: flags.succeeded,
  hasFailures: flags.hasFailures,
  dryRun: input.dryRun,
  branchManagement: {
   releaseBranch: {
    name: input.releaseBranchName,
    existed: input.existed,
    created: input.created,
    updated: input.updated,
    hasConflicts: input.hasConflicts,
   },
   releasePr: input.releasePr,
   changesets: {
    count: input.changesets.length,
    packages: input.changesets.map((c) => ({ name: c.name, bumpType: c.bumpType })),
   },
  },
 };
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __test__/projections.test.ts`
Expected: PASS — all three `toBranchManagementOutput` tests.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm lint:fix && npx tsgo --noEmit -p tsconfig.json
git add src/schema/projections.ts __test__/projections.test.ts
git commit -m "$(cat <<'EOF'
feat(schema): add toBranchManagementOutput projection

Project a branch-management run into a BranchManagementOutput, deriving the noop, succeeded and hasFailures flags from changeset count and conflict state.

Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>
EOF
)"
```

---

## Task 3: Validation projection

**Files:**

- Modify: `src/schema/projections.ts`
- Modify: `__test__/projections.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `__test__/projections.test.ts`:

```typescript
import { toValidationOutput } from "../src/schema/projections.js";

describe("toValidationOutput", () => {
 it("projects a clean validation run as success", () => {
  const output = toValidationOutput({
   buildsPassed: true,
   packageCount: 2,
   npmReady: true,
   githubPackagesReady: true,
   publishOk: true,
   packages: [
    { name: "@savvy-web/foo", version: "1.2.0", ready: true },
    { name: "@savvy-web/bar", version: "0.3.0", ready: true },
   ],
   checkRun: { url: "https://example.com/check/1", conclusion: "success" },
   dryRun: false,
  });

  expect(output.phase).toBe("validation");
  expect(output.noop).toBe(false);
  expect(output.succeeded).toBe(true);
  expect(output.hasFailures).toBe(false);
  expect(output.status).toBe("success");
  expect(output.validation.builds.packageCount).toBe(2);
 });

 it("marks a branch with no packages as a no-op", () => {
  const output = toValidationOutput({
   buildsPassed: true,
   packageCount: 0,
   npmReady: true,
   githubPackagesReady: true,
   publishOk: true,
   packages: [],
   checkRun: null,
   dryRun: false,
  });

  expect(output.noop).toBe(true);
  expect(output.status).toBe("no-op");
 });

 it("flags a failed build as a failure", () => {
  const output = toValidationOutput({
   buildsPassed: false,
   packageCount: 1,
   npmReady: false,
   githubPackagesReady: false,
   publishOk: false,
   packages: [{ name: "@savvy-web/foo", version: "1.2.0", ready: false }],
   checkRun: { url: "https://example.com/check/2", conclusion: "failure" },
   dryRun: false,
  });

  expect(output.hasFailures).toBe(true);
  expect(output.succeeded).toBe(false);
  expect(output.status).toBe("partial");
 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __test__/projections.test.ts`
Expected: FAIL — `toValidationOutput` is not exported.

- [ ] **Step 3: Add the validation projection**

Append to `src/schema/projections.ts` (and add `ValidationOutput` to the `release-output.js` type import at the top of the file):

```typescript
/** Input for {@link toValidationOutput}. */
export interface ValidationInput {
 readonly buildsPassed: boolean;
 readonly packageCount: number;
 readonly npmReady: boolean;
 readonly githubPackagesReady: boolean;
 readonly publishOk: boolean;
 readonly packages: ReadonlyArray<{ readonly name: string; readonly version: string; readonly ready: boolean }>;
 readonly checkRun: { readonly url: string; readonly conclusion: string } | null;
 readonly dryRun: boolean;
}

/** Project a validation run into a {@link ValidationOutput}. */
export const toValidationOutput = (input: ValidationInput): ValidationOutput => {
 const noop = input.packageCount === 0;
 const flags: ReleaseFlags = {
  noop,
  succeeded: !noop && input.buildsPassed && input.publishOk,
  hasFailures: !input.buildsPassed || !input.publishOk,
 };
 return {
  $schema: SCHEMA_URL,
  schemaVersion: SCHEMA_VERSION,
  phase: "validation",
  status: deriveStatus(flags),
  noop: flags.noop,
  succeeded: flags.succeeded,
  hasFailures: flags.hasFailures,
  dryRun: input.dryRun,
  validation: {
   builds: { passed: input.buildsPassed, packageCount: input.packageCount },
   publish: {
    npmReady: input.npmReady,
    githubPackagesReady: input.githubPackagesReady,
    packages: input.packages.map((p) => ({ name: p.name, version: p.version, ready: p.ready })),
   },
   checkRun: input.checkRun,
  },
 };
};
```

Note: when a build fails, `hasFailures` is `true` and `succeeded` is `false` even if `packageCount` is `0` — but `noop` still wins in `deriveStatus`, so a zero-package branch always reports `no-op`. That is intentional.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __test__/projections.test.ts`
Expected: PASS — all `toBranchManagementOutput` and `toValidationOutput` tests.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm lint:fix && npx tsgo --noEmit -p tsconfig.json
git add src/schema/projections.ts __test__/projections.test.ts
git commit -m "$(cat <<'EOF'
feat(schema): add toValidationOutput projection

Project a validation run into a ValidationOutput, deriving noop from package count and succeeded from build and publish-dry-run results.

Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>
EOF
)"
```

---

## Task 4: Publishing projection

**Files:**

- Modify: `src/schema/projections.ts`
- Modify: `__test__/projections.test.ts`

This is the projection where the spec's curation rules apply:

1. A target whose `alreadyPublishedReason` is `"different"` (content mismatch) is `status: "failed"` — never skipped.
2. `alreadyPublished` with reason `"identical"` → target `status: "skipped"`, package `skipReason: "already-published-identical"`.
3. `alreadyPublished` with reason `"unknown"` or undefined → `status: "skipped"`, `skipReason: "already-published-unknown"`.
4. A version-only package (GitHub release, no registry publish) has `targets: []` and `status: "published"`.
5. `registry` is `target.registry` from `ResolvedTarget`; when `null` (JSR) use the string `"jsr"`.

- [ ] **Step 1: Write the failing test**

Append to `__test__/projections.test.ts`:

```typescript
import { toPublishingOutput } from "../src/schema/projections.js";
import type { PackagePublishResult } from "../src/utils/generate-publish-summary.js";

/** Minimal TargetPublishResult fixture — only the fields the projection reads. */
const target = (over: Record<string, unknown>): PackagePublishResult["targets"][number] =>
 ({
  target: { protocol: "npm", registry: "https://npm.pkg.github.com/", directory: "/x", access: "public", provenance: true, tag: "latest", tokenEnv: null },
  success: true,
  ...over,
  // biome-ignore lint/suspicious/noExplicitAny: minimal TargetPublishResult fixture
 }) as any;

describe("toPublishingOutput", () => {
 it("projects a clean publish", () => {
  const pkg: PackagePublishResult = {
   name: "@savvy-web/foo",
   version: "1.2.0",
   targets: [target({ success: true, registryUrl: "https://github.com/foo/pkgs" })],
   githubAttestationUrl: "https://example.com/att/1",
  };
  const output = toPublishingOutput({
   publishResult: { success: true, packages: [pkg], totalPackages: 1, successfulPackages: 1, totalTargets: 1, successfulTargets: 1 },
   tags: [{ name: "@savvy-web/foo@1.2.0", packageName: "@savvy-web/foo", version: "1.2.0" }],
   releases: [{ tag: "@savvy-web/foo@1.2.0", url: "https://example.com/r/1", id: 999, assets: [] }],
   tagShas: { "@savvy-web/foo@1.2.0": "abc123" },
   dryRun: false,
  });

  expect(output.phase).toBe("publishing");
  expect(output.succeeded).toBe(true);
  expect(output.hasFailures).toBe(false);
  expect(output.publishing.packages[0]?.status).toBe("published");
  expect(output.publishing.packages[0]?.targets[0]?.registry).toBe("https://npm.pkg.github.com/");
  expect(output.publishing.packages[0]?.attestations.githubAttestationUrl).toBe("https://example.com/att/1");
  expect(output.publishing.tags[0]).toEqual({ name: "@savvy-web/foo@1.2.0", sha: "abc123" });
 });

 it("treats an identical already-published target as skipped", () => {
  const pkg: PackagePublishResult = {
   name: "@savvy-web/foo",
   version: "1.2.0",
   targets: [target({ success: true, alreadyPublished: true, alreadyPublishedReason: "identical" })],
  };
  const output = toPublishingOutput({
   publishResult: { success: true, packages: [pkg], totalPackages: 1, successfulPackages: 1, totalTargets: 1, successfulTargets: 1 },
   tags: [],
   releases: [],
   tagShas: {},
   dryRun: false,
  });

  expect(output.publishing.packages[0]?.status).toBe("skipped");
  expect(output.publishing.packages[0]?.skipReason).toBe("already-published-identical");
  expect(output.publishing.packages[0]?.targets[0]?.status).toBe("skipped");
  expect(output.succeeded).toBe(true);
  expect(output.hasFailures).toBe(false);
 });

 it("treats a content-mismatch (different) target as failed, not skipped", () => {
  const pkg: PackagePublishResult = {
   name: "@savvy-web/foo",
   version: "1.2.0",
   targets: [target({ success: false, alreadyPublished: true, alreadyPublishedReason: "different", error: "content mismatch" })],
  };
  const output = toPublishingOutput({
   publishResult: { success: false, packages: [pkg], totalPackages: 1, successfulPackages: 0, totalTargets: 1, successfulTargets: 0 },
   tags: [],
   releases: [],
   tagShas: {},
   dryRun: false,
  });

  expect(output.publishing.packages[0]?.status).toBe("failed");
  expect(output.publishing.packages[0]?.skipReason).toBe(null);
  expect(output.publishing.packages[0]?.targets[0]?.status).toBe("failed");
  expect(output.publishing.packages[0]?.targets[0]?.error).toBe("content mismatch");
  expect(output.hasFailures).toBe(true);
 });

 it("projects a version-only package as published with no targets", () => {
  const pkg: PackagePublishResult = { name: "@savvy-web/foo", version: "1.2.0", targets: [] };
  const output = toPublishingOutput({
   publishResult: { success: true, packages: [pkg], totalPackages: 1, successfulPackages: 1, totalTargets: 0, successfulTargets: 0 },
   tags: [],
   releases: [],
   tagShas: {},
   dryRun: false,
  });

  expect(output.publishing.packages[0]?.status).toBe("published");
  expect(output.publishing.packages[0]?.targets).toEqual([]);
 });

 it("reports a no-op when nothing was released", () => {
  const output = toPublishingOutput({
   publishResult: { success: true, packages: [], totalPackages: 0, successfulPackages: 0, totalTargets: 0, successfulTargets: 0 },
   tags: [],
   releases: [],
   tagShas: {},
   dryRun: false,
  });

  expect(output.noop).toBe(true);
  expect(output.status).toBe("no-op");
 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __test__/projections.test.ts`
Expected: FAIL — `toPublishingOutput` is not exported.

- [ ] **Step 3: Add the publishing projection**

Append to `src/schema/projections.ts`. Add `PublishingOutput` to the `release-output.js` type import, and add these value/type imports at the top of the file:

```typescript
import type { ReleaseInfo } from "../utils/create-github-releases.js";
import type { TagInfo } from "../utils/determine-tag-strategy.js";
import type { PackagePublishResult } from "../utils/generate-publish-summary.js";
import type { PublishPackagesResult } from "../utils/publish-packages.js";
```

Then the projection:

```typescript
/** Input for {@link toPublishingOutput}. */
export interface PublishingInput {
 readonly publishResult: PublishPackagesResult;
 readonly tags: ReadonlyArray<TagInfo>;
 readonly releases: ReadonlyArray<ReleaseInfo>;
 /** Resolved tag-name → commit SHA, keyed by `TagInfo.name`. */
 readonly tagShas: Readonly<Record<string, string>>;
 readonly dryRun: boolean;
}

type TargetStatus = "published" | "skipped" | "failed";

/** Classify one internal target result into the published/skipped/failed enum. */
const classifyTarget = (t: PackagePublishResult["targets"][number]): TargetStatus => {
 // Content mismatch is a failure, never a skip (spec rule 1).
 if (t.alreadyPublished === true && t.alreadyPublishedReason === "different") return "failed";
 if (t.alreadyPublished === true) return "skipped";
 return t.success ? "published" : "failed";
};

/** Project a publishing run into a {@link PublishingOutput}. */
export const toPublishingOutput = (input: PublishingInput): PublishingOutput => {
 const packages = input.publishResult.packages.map((pkg) => {
  const targets = pkg.targets.map((t) => {
   const status = classifyTarget(t);
   return {
    registry: t.target.registry ?? "jsr",
    status,
    registryUrl: t.registryUrl ?? null,
    error: status === "failed" ? (t.error ?? null) : null,
   };
  });
  // Package status: failed if any target failed; skipped if every target
  // skipped; published otherwise (including version-only, targets === []).
  const anyFailed = targets.some((t) => t.status === "failed");
  const allSkipped = targets.length > 0 && targets.every((t) => t.status === "skipped");
  const status: TargetStatus = anyFailed ? "failed" : allSkipped ? "skipped" : "published";
  // skipReason only when the package is skipped; "identical" maps to the
  // identical reason, every other skip reason to "unknown" (spec rule 2/3).
  const skipReason =
   status === "skipped"
    ? pkg.targets.some((t) => t.alreadyPublishedReason === "identical")
     ? ("already-published-identical" as const)
     : ("already-published-unknown" as const)
    : null;
  // Attestation URLs: the internal model carries them per target; take the
  // first non-null across targets, plus the package-level GitHub attestation.
  const firstUrl = (pick: (t: PackagePublishResult["targets"][number]) => string | undefined): string | null =>
   pkg.targets.map(pick).find((u) => u !== undefined && u !== "") ?? null;
  return {
   name: pkg.name,
   version: pkg.version,
   status,
   skipReason,
   targets,
   attestations: {
    provenanceUrl: firstUrl((t) => t.attestationUrl),
    sbomUrl: firstUrl((t) => t.sbomAttestationUrl),
    githubAttestationUrl: pkg.githubAttestationUrl ?? null,
   },
   tarballDigest: firstUrl((t) => t.tarballDigest),
  };
 });

 const flags: ReleaseFlags = {
  noop: input.publishResult.totalPackages === 0,
  succeeded: input.publishResult.success === true && !packages.some((p) => p.status === "failed"),
  hasFailures: packages.some((p) => p.status === "failed"),
 };

 return {
  $schema: SCHEMA_URL,
  schemaVersion: SCHEMA_VERSION,
  phase: "publishing",
  status: deriveStatus(flags),
  noop: flags.noop,
  succeeded: flags.succeeded,
  hasFailures: flags.hasFailures,
  dryRun: input.dryRun,
  publishing: {
   packages,
   tags: input.tags.map((t) => ({ name: t.name, sha: input.tagShas[t.name] ?? "" })),
   releases: input.releases.map((r) => ({ tag: r.tag, url: r.url, id: r.id })),
  },
 };
};
```

Note on `tarballDigest`: `firstUrl` is a misnamed-but-correct helper here — it returns the first non-empty string across targets, which is exactly the digest selection wanted. If the reviewer objects to the name, rename it to `firstNonEmpty`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __test__/projections.test.ts`
Expected: PASS — all `toPublishingOutput` tests plus the earlier projection tests.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm lint:fix && npx tsgo --noEmit -p tsconfig.json
git add src/schema/projections.ts __test__/projections.test.ts
git commit -m "$(cat <<'EOF'
feat(schema): add toPublishingOutput projection

Project a publishing run into a PublishingOutput. Content-mismatch targets map to failed, identical and unknown already-published targets to skipped, and version-only packages to published with no targets.

Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>
EOF
)"
```

---

## Task 5: Schema generation script and no-drift test

**Files:**

- Modify: `package.json`
- Create: `lib/scripts/generate-schema.ts`
- Create: `silk-release-action.schema.json` (generated, repo root)
- Create: `__test__/generate-schema.test.ts`

- [ ] **Step 1: Add devDependencies**

Run:

```bash
pnpm add -D json-schema-effect ajv tsx
```

Expected: `package.json` `devDependencies` gains `json-schema-effect`, `ajv`, `tsx`; `pnpm-lock.yaml` updates.

- [ ] **Step 2: Add the `generate-schema` package script**

Edit `package.json` `scripts` — add this entry (keep the object alphabetically sorted, so it lands between `ci:version` and `lint`):

```json
"generate-schema": "tsx lib/scripts/generate-schema.ts",
```

- [ ] **Step 3: Create the generation script**

Create `lib/scripts/generate-schema.ts`:

```typescript
/**
 * Generate `silk-release-action.schema.json` from the `ReleaseOutput` Effect
 * Schema. The Effect Schema in `src/schema/release-output.ts` is the single
 * source of truth; this script is the one place that serialises it to a
 * SchemaStore-compatible JSON Schema document at the repository root.
 *
 * Run via `pnpm generate-schema`. The committed output is guarded against
 * drift by `__test__/generate-schema.test.ts`.
 */

import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { JsonSchemaExporter, JsonSchemaValidator } from "json-schema-effect";
import { ReleaseOutput, SCHEMA_URL } from "../../src/schema/release-output.js";

const OUTPUT_PATH = "silk-release-action.schema.json";

const program = Effect.gen(function* () {
 const exporter = yield* JsonSchemaExporter;
 const validator = yield* JsonSchemaValidator;

 const generated = yield* exporter.generate({
  name: "silk-release-action",
  schema: ReleaseOutput,
  rootDefName: "ReleaseOutput",
  $id: SCHEMA_URL,
 });

 // ajvStrict catches malformed JSON Schema (unknown keywords, bad refs).
 yield* validator.validate(generated, { ajvStrict: true });

 const result = yield* exporter.write(generated, OUTPUT_PATH);
 yield* Effect.log(result._tag === "Written" ? `Written: ${result.path}` : `Unchanged: ${result.path}`);
});

await Effect.runPromise(
 program.pipe(
  Effect.provide(JsonSchemaExporter.Live),
  Effect.provide(JsonSchemaValidator.Live),
  Effect.provide(NodeFileSystem.layer),
 ),
);
```

Note: the spec specified `validate(out, { strict: true, ajvStrict: true })`. `strict` enables Tombi TOML-convention checks, which do not apply to a GitHub Actions output schema and would false-positive on an Effect-generated document — so only `ajvStrict: true` is used. If `ajvStrict` itself rejects the generated document, the cleanup pass in `JsonSchemaExporter.generate` should already have removed the known artefacts; investigate the specific Ajv error before relaxing the option.

- [ ] **Step 4: Run the generator**

Run: `pnpm generate-schema`
Expected: prints `Written: silk-release-action.schema.json`; the file now exists at the repo root. If the run fails on `rootDefName`, the union may not produce a root `$ref` — that is harmless; the inlining step is a no-op and the file still generates. If it fails on validation, read the Ajv error and fix the schema definition, not the script.

- [ ] **Step 5: Inspect the generated file**

Run: `head -20 silk-release-action.schema.json`
Expected: a JSON Schema document with `$id` set to the SchemaStore URL and an `anyOf`/`oneOf` of the three phase structs.

- [ ] **Step 6: Write the no-drift test**

Create `__test__/generate-schema.test.ts`:

```typescript
/**
 * Guards the committed silk-release-action.schema.json against drift from the
 * ReleaseOutput Effect Schema. If this fails, run `pnpm generate-schema` and
 * commit the regenerated file.
 */

import { readFileSync } from "node:fs";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { JsonSchemaExporter } from "json-schema-effect";
import { describe, expect, it } from "vitest";
import { ReleaseOutput, SCHEMA_URL } from "../src/schema/release-output.js";

describe("silk-release-action.schema.json", () => {
 it("matches the ReleaseOutput Effect Schema", async () => {
  const generated = await Effect.runPromise(
   Effect.gen(function* () {
    const exporter = yield* JsonSchemaExporter;
    return yield* exporter.generate({
     name: "silk-release-action",
     schema: ReleaseOutput,
     rootDefName: "ReleaseOutput",
     $id: SCHEMA_URL,
    });
   }).pipe(Effect.provide(JsonSchemaExporter.Live), Effect.provide(NodeFileSystem.layer)),
  );

  const committed = JSON.parse(readFileSync("silk-release-action.schema.json", "utf8"));
  expect(committed).toEqual(generated.schema);
 });
});
```

- [ ] **Step 7: Run the no-drift test**

Run: `npx vitest run __test__/generate-schema.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck, lint, commit**

```bash
pnpm lint:fix && npx tsgo --noEmit -p tsconfig.json
git add package.json pnpm-lock.yaml lib/scripts/generate-schema.ts silk-release-action.schema.json __test__/generate-schema.test.ts
git commit -m "$(cat <<'EOF'
feat(schema): generate silk-release-action.schema.json from ReleaseOutput

Add a generate-schema script that exports the ReleaseOutput Effect Schema to a SchemaStore-compatible JSON Schema, plus a test asserting the committed file never drifts from the schema.

Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>
EOF
)"
```

---

## Task 6: Wire emission into `main.ts`

**Files:**

- Modify: `src/main.ts`

The three phase handlers in `main.ts` are `runBranchManagement` (around line 79), `runValidation` (around line 110), `runPublishing` (around line 392). This task adds a build-and-emit at each phase exit and removes the scattered `outputs.set(...)` calls the new `result` output supersedes.

- [ ] **Step 1: Add imports and the shared emit helper**

At the top of `src/main.ts`, add to the imports:

```typescript
import { ReleaseOutput } from "./schema/release-output.js";
import {
 toBranchManagementOutput,
 toPublishingOutput,
 toValidationOutput,
} from "./schema/projections.js";
```

After `detectPackageManager` (around line 77), add the emit helper:

```typescript
/**
 * Emit a {@link ReleaseOutput} as the structured `result` action output plus
 * the five convenience scalars. `result` is Schema-encoded; the scalars mirror
 * the most-wanted facts so a consumer need not parse JSON.
 *
 * @internal
 */
const emitReleaseOutput = (
 outputs: ActionOutputs,
 output: ReleaseOutput,
 scalars: { readonly packageCount: number; readonly releasePrNumber: number | null },
) =>
 Effect.gen(function* () {
  yield* outputs.setJson("result", output, ReleaseOutput);
  yield* outputs.set("phase", output.phase);
  yield* outputs.set("status", output.status);
  yield* outputs.set("succeeded", output.succeeded ? "true" : "false");
  yield* outputs.set("package-count", String(scalars.packageCount));
  yield* outputs.set("release-pr-number", scalars.releasePrNumber === null ? "" : String(scalars.releasePrNumber));
 });
```

`ActionOutputs` is already imported in `main.ts`; if the symbol is only imported as a value and not usable as a type, change its import to also expose the type (it is a `Context.Tag`, so `outputs: ActionOutputs` in a parameter position type-checks).

- [ ] **Step 2: Emit from `runBranchManagement`**

`runBranchManagement` currently checks the branch then creates or updates it but emits nothing. Read its body (lines 79–100). Capture the create/update result and the changeset list, then emit. Replace the body of the inner `logger.group` effect so it ends like this — adapt the surrounding variable names to what is already there:

```typescript
const branchCheck = yield* checkReleaseBranch(releaseBranch, targetBranch, dryRun);
// Read changeset bump types before the version command consumes them.
const changesetStatus = yield* Effect.tryPromise({
 try: async () => {
  const mod = await import("./utils/get-changeset-status.js");
  return await mod.getChangesetStatus(packageManager, targetBranch);
 },
 catch: (error) => (error instanceof Error ? error : new Error(String(error))),
}).pipe(Effect.catchAll(() => Effect.succeed({ releases: [], changesets: [] })));

const changesets = changesetStatus.releases.map((r) => ({
 name: r.name,
 bumpType: (r.type === "major" || r.type === "minor" ? r.type : "patch") as "major" | "minor" | "patch",
}));

let created = false;
let updated = false;
let hasConflicts = false;
let prNumber: number | null = branchCheck.prNumber;

if (branchCheck.exists) {
 yield* Effect.logInfo("Release branch exists — running update flow");
 const updateResult = yield* updateReleaseBranch(packageManager);
 updated = updateResult.success;
 hasConflicts = updateResult.hadConflicts;
 prNumber = updateResult.prNumber ?? prNumber;
} else {
 yield* Effect.logInfo("Release branch does not exist — running create flow");
 const createResult = yield* createReleaseBranch(packageManager);
 created = createResult.created;
 prNumber = createResult.prNumber ?? prNumber;
}

const output = toBranchManagementOutput({
 releaseBranchName: releaseBranch,
 existed: branchCheck.exists,
 created,
 updated,
 hasConflicts,
 releasePr:
  prNumber === null
   ? null
   : { number: prNumber, url: `https://github.com/${process.env.GITHUB_REPOSITORY ?? ""}/pull/${prNumber}`, action: branchCheck.exists ? "updated" : "created" },
 changesets,
 dryRun,
});
yield* emitReleaseOutput(yield* ActionOutputs, output, { packageCount: changesets.length, releasePrNumber: prNumber });
```

Note: `updateReleaseBranch` and `createReleaseBranch` are already imported and called in this handler — keep the existing `.pipe(Effect.asVoid)` only if you are NOT capturing the result; here you ARE capturing it, so drop the `Effect.asVoid`. Read lines 90–97 of the current file and adapt.

- [ ] **Step 3: Typecheck after the branch-management change**

Run: `npx tsgo --noEmit -p tsconfig.json`
Expected: no errors. If `UpdateReleaseBranchResult` is not exported, `updateReleaseBranch`'s return type still flows through type inference — no import needed. Fix any error before moving on.

- [ ] **Step 4: Emit from `runValidation` and remove its old `outputs.set` calls**

In `runValidation`, delete these existing lines (current numbers; confirm by content):

- Line 157: `outputs.set("linked_issues", ...)`
- Line 158: `outputs.set("issue_commits", ...)`
- Line 170: `outputs.set("builds_passed", ...)`
- Lines 209–211: `outputs.set("npm_publish_ready", ...)`, `outputs.set("github_packages_ready", ...)`, `outputs.set("publish_results", ...)`

Keep the variables those lines read (`issuesResult`, `buildResult`, `result`, `publishOk`, `publishReadyTargets`, etc.) — only the `outputs.set` calls are removed.

At the end of the `runValidation` `logger.group` body, after Step 6 (the unified validation check), add:

```typescript
const validationOutput = toValidationOutput({
 buildsPassed: buildResult.success,
 packageCount: releaseNotesResult.packages.length,
 npmReady: publishOk,
 githubPackagesReady: publishOk,
 publishOk,
 packages: releaseNotesResult.packages.map((p) => ({ name: p.name, version: p.version, ready: publishOk })),
 checkRun: null,
 dryRun,
});
yield* emitReleaseOutput(outputs, validationOutput, { packageCount: releaseNotesResult.packages.length, releasePrNumber: null });
```

Note: `npmReady`/`githubPackagesReady` come from `validatePublish`'s `result.npmReady` / `result.githubPackagesReady`. The current handler reads `result` inside an `if (buildResult.success)` block, so those values are not in scope at the group's end. The simplest correct fix: declare `let npmReady = false; let githubPackagesReady = false;` alongside the existing `let publishOk = true;` (around line 180) and assign them inside the `if (result !== null)` block where `result` is read (around line 209). Then pass `npmReady`/`githubPackagesReady` instead of `publishOk` above. If you populate the unified check-run URL/conclusion, pass a real `checkRun` object instead of `null` — otherwise `null` is acceptable.

- [ ] **Step 5: Typecheck after the validation change**

Run: `npx tsgo --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Emit from `runPublishing` and remove its old `outputs.set` calls**

In `runPublishing` (lines 392–575), remove these existing `outputs.set` calls (keep `outputs.setFailed(...)` calls — those are the failure signal):

- Line 492: `outputs.set("released_packages", ...)`
- Line 493: `outputs.set("package_count", ...)`
- Line 494: `outputs.set("publish_results", ...)`
- Line 495: `outputs.set("success", ...)`
- Line 530: `outputs.set("release_type", ...)`
- Lines 531–534: `outputs.set("release_tags", ...)`
- Line 556: `outputs.set("release_urls", ...)`

The handler has three early-return failure paths (`publishResult === null`, `!publishResult.success`, `tagPlan === null`). Each currently calls `outputs.setFailed(...)` and returns. For the two that have a `publishResult`, emit a publishing output before returning so an `if: always()` consumer still gets detail. Add a small local helper at the top of the `logger.group` body:

```typescript
const emitPublishing = (
 publishResult: PublishPackagesResult,
 tags: ReadonlyArray<TagInfo>,
 releases: ReadonlyArray<ReleaseInfo>,
 tagShas: Record<string, string>,
) =>
 emitReleaseOutput(
  outputs,
  toPublishingOutput({ publishResult, tags, releases, tagShas, dryRun }),
  { packageCount: publishResult.totalPackages, releasePrNumber: mergedReleasePRNumber ?? null },
 );
```

Add the imports `import type { PublishPackagesResult } from "./utils/publish-packages.js";`, `import type { TagInfo } from "./utils/determine-tag-strategy.js";`, `import type { ReleaseInfo } from "./utils/create-github-releases.js";` at the top of `main.ts` (type-only, sorted).

Replace the publish-failure branch (`if (!publishResult.success)`, around line 497) so it emits before returning:

```typescript
if (!publishResult.success) {
 yield* Effect.logError("Publishing failed, skipping tags and releases");
 yield* emitPublishing(publishResult, [], [], {});
 yield* outputs.setFailed("Publishing failed");
 return;
}
```

At the successful end of the handler (after Step 4 creates releases, around line 556), build `tagShas` and emit. `ReleaseInfo` carries no SHA; the tag SHAs are not currently captured. Resolve each tag's SHA with `git rev-parse`:

```typescript
const tagShas: Record<string, string> = {};
for (const tag of tagPlan.tagStrategy.tags) {
 const rev = yield* runner
  .execCapture("git", ["rev-parse", tag.name])
  .pipe(Effect.catchAll(() => Effect.succeed({ stdout: "", stderr: "", exitCode: 1 })));
 tagShas[tag.name] = rev.stdout.trim();
}
yield* emitPublishing(publishResult, tagPlan.tagStrategy.tags, releasesResult.releases, tagShas);
```

For the `tagPlan === null` early return, there is a `publishResult` in scope — emit it with empty tags/releases before returning:

```typescript
if (tagPlan === null) {
 yield* emitPublishing(publishResult, [], [], {});
 yield* outputs.setFailed("Phase 3 failed during tag strategy");
 return;
}
```

The `publishResult === null` early return has no `publishResult` to project — leave it as the bare `outputs.setFailed("Phase 3 failed during publish")` + `return`. A consumer falls back to step status for that case (spec "Error handling").

- [ ] **Step 7: Typecheck the whole file**

Run: `npx tsgo --noEmit -p tsconfig.json`
Expected: no errors. Resolve any unused-variable warnings by deleting the now-dead intermediate variables (e.g. if `publishSummary` is no longer read).

- [ ] **Step 8: Run the full test suite**

Run: `npx vitest run`
Expected: PASS. Some existing `main.ts`-adjacent tests may reference removed output names — if a test asserts `outputs.set("released_packages", ...)` or similar, update it to assert against the new `result` output or the scalars.

- [ ] **Step 9: Lint and commit**

```bash
pnpm lint:fix && npx tsgo --noEmit -p tsconfig.json
git add src/main.ts __test__
git commit -m "$(cat <<'EOF'
feat(output): emit the structured result output from each release phase

Replace the scattered per-phase outputs.set calls with a single ReleaseOutput projection emitted as the result JSON output plus the phase, status, succeeded, package-count and release-pr-number scalars.

Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>
EOF
)"
```

---

## Task 7: Collapse `action.yml` outputs and update docs

**Files:**

- Modify: `action.yml`
- Modify: `.github/actions/release/action.yml`
- Modify: `docs/configuration.md`

- [ ] **Step 1: Rewrite the `outputs` section of `action.yml`**

In `/Users/spencer/workspaces/savvy-web/workflow-release-action/action.yml`, replace the entire `outputs:` block (currently `token` through `success`) with:

```yaml
outputs:
  token:
    description: Generated GitHub App installation token (for use in subsequent steps)
  installation-id:
    description: GitHub App installation ID
  app-slug:
    description: GitHub App slug (URL-friendly name)
  result:
    description: |
      Structured JSON describing what the run did. A phase-discriminated object
      validated by https://json.schemastore.org/silk-release-action.schema.json.
      Parse it for the full contract; the scalars below mirror the common facts.
  phase:
    description: "Phase that ran: branch-management, validation, or publishing"
  status:
    description: "Human-readable run status: no-op, success, partial, or failed"
  succeeded:
    description: Whether all intended work completed (or correctly did nothing)
  package-count:
    description: Number of packages the phase touched
  release-pr-number:
    description: Release PR number, when one is involved (empty otherwise)
```

- [ ] **Step 2: Apply the identical change to the composite action**

In `/Users/spencer/workspaces/savvy-web/workflow-release-action/.github/actions/release/action.yml`, replace its `outputs:` block with the same nine entries from Step 1 (drop the `# Phase N` section comments — they no longer map to anything).

- [ ] **Step 3: Validate the action manifests**

Run: `pnpm validate`
Expected: passes (the `github-action-builder validate` step accepts the manifests).

- [ ] **Step 4: Update the outputs documentation**

In `docs/configuration.md`, find the outputs documentation (search for `released_packages` or an `## Outputs` heading). Replace the per-output list with a table describing the nine outputs and a short note that `result` is the schema-defined JSON contract. Use this content:

```markdown
## Outputs

| Output | Description |
| --- | --- |
| `token` | Generated GitHub App installation token |
| `installation-id` | GitHub App installation ID |
| `app-slug` | GitHub App slug |
| `result` | Structured JSON describing the run — see below |
| `phase` | Phase that ran: `branch-management`, `validation`, `publishing` |
| `status` | Run status: `no-op`, `success`, `partial`, `failed` |
| `succeeded` | Whether all intended work completed |
| `package-count` | Number of packages the phase touched |
| `release-pr-number` | Release PR number, when one is involved |

The `result` output is a phase-discriminated JSON object validated by
`https://json.schemastore.org/silk-release-action.schema.json`. It carries the
machine-readable contract: the three orthogonal flags (`noop`, `succeeded`,
`hasFailures`), a `dryRun` marker, and exactly one phase payload block. Parse
`result` with `fromJSON()` in a downstream workflow step; branch on
`schemaVersion` for forward compatibility.
```

If `docs/configuration.md` has no outputs section at all, add the block above after the inputs table.

- [ ] **Step 5: Lint markdown**

Run: `pnpm lint:md`
Expected: no errors in `docs/configuration.md`.

- [ ] **Step 6: Commit**

```bash
git add action.yml .github/actions/release/action.yml docs/configuration.md
git commit -m "$(cat <<'EOF'
feat(output): collapse action outputs to result plus five scalars

Replace the ~22 declared release outputs with the schema-defined result JSON output and the phase, status, succeeded, package-count and release-pr-number convenience scalars.

Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>
EOF
)"
```

---

## Final verification

- [ ] Run `npx vitest run` — all tests pass.
- [ ] Run `pnpm typecheck` — clean.
- [ ] Run `pnpm lint` — clean.
- [ ] Run `pnpm generate-schema` — prints `Unchanged` (the committed schema already matches).
- [ ] Run `pnpm build` — `dist/main.js` rebuilds without error.
- [ ] Skim `dist/main.js` is regenerated; commit the rebuilt `dist/` if the repo tracks it (it does — see prior commits).

---

## Self-review notes

**Spec coverage:**

- Decision 1 (phase-discriminated union) → Task 1.
- Decision 2 (`result` JSON + scalars, other outputs removed) → Tasks 6, 7.
- Decision 3 (three orthogonal flags + derived `status`) → Task 1 (`deriveStatus`), Tasks 2–4 (flag derivation per phase).
- Decision 4 (curated projection via mapping layer) → Tasks 2–4.
- Decision 5 (self-describing via JSON Schema) → Task 5.
- Envelope, three phase payloads → Task 1.
- Flag-derivation table → Tasks 2–4 tests.
- Schema generation pipeline → Task 5.
- Emission → Task 6.
- Error handling (emit `result` even on failure) → Task 6 Steps 4, 6.
- Testing (projections, flags, round-trip, no-drift) → Tasks 1–5 tests.

**Known deviations from the spec, called out for the implementer:**

- The spec's `validate(..., { strict: true, ajvStrict: true })` is implemented as `{ ajvStrict: true }` only — `strict` is a Tombi TOML-convention check that does not apply here (Task 5 Step 3).
- The spec mentions `Jsonifiable` for "open-ended fields"; the curated `ReleaseOutput` has no open-ended field, so `Jsonifiable` is not used. `json-schema-effect` is still required for `JsonSchemaExporter`/`JsonSchemaValidator`.
- The internal model carries attestation URLs per-target; the output's per-package `attestations` block takes the first non-null across a package's targets (Task 4 Step 3). This is an approximation — acceptable because a package's targets share the same artifact.
- Tag SHAs are not in `ReleaseInfo`; Task 6 Step 6 resolves them with `git rev-parse`. If that proves flaky, capture the SHA where the tag is created in `create-github-releases.ts` instead.
