# Token Plumbing Untangle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop mutating `process.env.GITHUB_TOKEN` anywhere in the action; make every token consumer read the specific token it needs explicitly.

**Architecture:** The GitHub App installation token lives in `ActionState` (provisioned by `pre.ts`); the optional workflow token arrives via the `github-token` input. The main action's `GitHubClient` is built from the App token via the library-native `GitHubToken.client()` layer instead of `GitHubClientLive.fromEnv` + an env-var bridge. The imperative publish-chain code resolves tokens through two helpers (`appToken()`, `packagesToken()`) and passes them explicitly; `attest-runner` builds its client with `GitHubClientLive.fromToken(...)`. The npm-publish subprocess auth uses a dedicated env var, not `GITHUB_TOKEN`.

**Tech Stack:** Effect, `@savvy-web/github-action-effects` 1.1.1 (`GitHubToken`, `GitHubClientLive.fromToken`), Vitest.

---

## Background the implementer must know

**The problem.** `process.env.GITHUB_TOKEN` is currently *written* in two places and *read* in six, and its value at any read site depends on execution order:

- `main.ts` (boot): `bridgeTokenStateToEnv()` + `process.env.GITHUB_TOKEN = installationToken.token` set it to the **App installation token** so `GitHubClientLive.fromEnv` can build `MainLive`.
- `registry-auth.ts` `setupRegistryAuth()`: later overwrites it with `process.env.GITHUB_TOKEN = packagesToken` (the **workflow token**, or App token fallback) for npm-publish auth.
- Readers: `main.ts:515`, `create-attestation.ts` ×4, `attest-runner.ts` ×3 (`GitHubClientLive.fromEnv`), `link-issues-from-commits.ts:654` (`fromEnv`), `MainLive` (`fromEnv`), and `resolve-targets.ts` (`tokenEnv: "GITHUB_TOKEN"`).

This caused the storage-record `404`: `POST /orgs/{owner}/artifacts/metadata/storage-record` needs `packages: write`, but the call ran on the App token.

**The two tokens.**

- **App installation token** — provisioned by `pre.ts` via `GitHubToken.provision()`, persisted to `ActionState`. The action's primary GitHub identity (`contents`/`issues`/`pull-requests`). `main.ts` also bridges it to `process.env.STATE_token` so the imperative shim reads it via `getState("token")`.
- **Workflow token** — the `secrets.GITHUB_TOKEN` passed as the `github-token` input. Saved by `pre.ts` as `GithubPackagesTokenState`; `main.ts` bridges it to `process.env.STATE_githubToken` → `getState("githubToken")`. The publish job grants it `contents: write`, `id-token: write`, `packages: write`, `attestations: write`.

The `STATE_token` / `STATE_githubToken` bridges are **fine and stay** — they are state, not `GITHUB_TOKEN`, and the imperative shim's `getState()` (`_actions-compat.ts:88` — `process.env[\`STATE_${name}\`]`) depends on them.

**Library facts.**

- `GitHubToken.client(): Layer.Layer<GitHubClient, ActionStateError, ActionState>` — reads the persisted installation token from `ActionState` and builds a `GitHubClient` via `GitHubClientLive.fromToken`. `ActionState` is provided by `Action.run`'s `ActionsRuntime.Default`, so a layer with a residual `ActionState` requirement composes fine under `Action.run`.
- `GitHubClientLive.fromToken(token: string | Redacted<string>): Layer.Layer<GitHubClient>` — no error, no requirement.
- `GitHubToken.read(): Effect.Effect<InstallationToken, ActionStateError, ActionState>` — returns the persisted token envelope (`.token`, `.expiresAt`, `.installationId`, `.appSlug`, …).

**Repo conventions.** Effect; Biome (tabs, `.js` import extensions, separated `type` imports, lexicographic order, explicit return types on exports, `interface` for plain object shapes). Tests in `__test__/`, Vitest. The commit hook runs `tsgo --noEmit`, Biome, commitlint. Commit messages: Conventional Commits, lowercase, imperative, header ≤100 chars, body lines ≤300 chars, no markdown in body, ending with `Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>`. Accurate typecheck is `npx tsgo --noEmit -p tsconfig.json`. The repo is on the `dev` branch; commit normally. After any `src/` change, `pnpm build` regenerates `dist/` + `.github/actions/local/` — commit those too.

## File structure

| File | Change |
| --- | --- |
| `src/utils/tokens.ts` (new) | `appToken()` + `packagesToken()` — central token resolution from `ActionState` bridges. |
| `__test__/tokens.test.ts` (new) | Unit tests for the two helpers. |
| `src/utils/attest-runner.ts` (modify) | The three runners take an explicit token and build the client via `GitHubClientLive.fromToken`; fix the storage-record request body shape. |
| `src/utils/create-attestation.ts` (modify) | Replace `process.env.GITHUB_TOKEN` reads with `appToken()` / `packagesToken()`; pass tokens to the runners. |
| `src/utils/link-issues-from-commits.ts` (modify) | `getLinkedIssuesFromCommitsPromise` builds its client via `fromToken(appToken())`. |
| `src/utils/resolve-targets.ts` (modify) | GitHub Packages target `tokenEnv` becomes `SILK_GITHUB_PACKAGES_TOKEN`. |
| `src/utils/registry-auth.ts` (modify) | Set `SILK_GITHUB_PACKAGES_TOKEN` instead of `process.env.GITHUB_TOKEN`. |
| `src/main.ts` (modify) | Delete the `GITHUB_TOKEN` overwrite + `bridgeTokenStateToEnv`; `MainLive` uses `GitHubToken.client()`; `runPublishing` reads the token via `GitHubToken.read()`. |

---

## Task 1: Token resolution helpers

**Files:**

- Create: `src/utils/tokens.ts`
- Test: `__test__/tokens.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__test__/tokens.test.ts`:

```typescript
/**
 * Tests for the token-resolution helpers. They read the cross-phase token
 * state that main.ts bridges into STATE_* env vars.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appToken, packagesToken } from "../src/utils/tokens.js";

describe("token helpers", () => {
 beforeEach(() => {
  delete process.env.STATE_token;
  delete process.env.STATE_githubToken;
 });
 afterEach(() => {
  delete process.env.STATE_token;
  delete process.env.STATE_githubToken;
 });

 it("appToken returns the App installation token from state", () => {
  process.env.STATE_token = "app-token-123";
  expect(appToken()).toBe("app-token-123");
 });

 it("appToken returns an empty string when no token is in state", () => {
  expect(appToken()).toBe("");
 });

 it("packagesToken prefers the workflow github-token", () => {
  process.env.STATE_token = "app-token-123";
  process.env.STATE_githubToken = "workflow-token-456";
  expect(packagesToken()).toBe("workflow-token-456");
 });

 it("packagesToken falls back to the App token when no workflow token is set", () => {
  process.env.STATE_token = "app-token-123";
  expect(packagesToken()).toBe("app-token-123");
 });

 it("packagesToken returns an empty string when neither token is set", () => {
  expect(packagesToken()).toBe("");
 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __test__/tokens.test.ts`
Expected: FAIL — cannot resolve `../src/utils/tokens.js`.

- [ ] **Step 3: Create the helper**

Create `src/utils/tokens.ts`:

```typescript
/**
 * Token resolution for the imperative publish-chain code.
 *
 * @remarks
 * `pre.ts` provisions the GitHub App installation token and `main.ts` bridges
 * both it and the optional workflow `github-token` into `STATE_*` env vars.
 * These helpers read them back through the `_actions-compat` `getState` shim
 * so no consumer has to touch `process.env.GITHUB_TOKEN` — which the action
 * deliberately never sets.
 */

import { getState } from "./_actions-compat.js";

/**
 * The GitHub App installation token — the action's primary GitHub identity,
 * used for repository and issue operations.
 *
 * @returns The App installation token, or an empty string if unavailable.
 */
export const appToken = (): string => getState("token");

/**
 * The token for GitHub Packages and attestation operations. Prefers the
 * workflow `github-token` input (it carries `packages:write` and
 * `attestations:write` from the workflow's permissions block) and falls back
 * to the App installation token when the input was not provided.
 *
 * @returns The packages/attestation token, or an empty string if unavailable.
 */
export const packagesToken = (): string => getState("githubToken") || getState("token");
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __test__/tokens.test.ts`
Expected: PASS — all five tests.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm lint:fix && npx tsgo --noEmit -p tsconfig.json
git add src/utils/tokens.ts __test__/tokens.test.ts
git commit -m "$(cat <<'EOF'
feat(tokens): add appToken and packagesToken resolution helpers

Centralise reading the App installation token and the workflow github-token from the cross-phase state bridges, so publish-chain code never reaches for process.env.GITHUB_TOKEN.

Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>
EOF
)"
```

---

## Task 2: `attest-runner.ts` — explicit token via `fromToken`, fix storage-record body

**Files:**

- Modify: `src/utils/attest-runner.ts`

The three exported runners (`runProvenanceAttestation`, `runSbomAttestation`, `runCreateStorageRecord`) currently build their `GitHubClient` with `GitHubClientLive.fromEnv` — which reads `process.env.GITHUB_TOKEN`. Once that env var is no longer set, `fromEnv` cannot authenticate. Each runner must accept the token explicitly and use `GitHubClientLive.fromToken(token)`.

- [ ] **Step 1: `runProvenanceAttestation` — add a `token` parameter**

In `src/utils/attest-runner.ts`, change the signature and the layer. Replace:

```typescript
export const runProvenanceAttestation = async (subjectName: string, sha256: string): Promise<RunProvenanceResult> => {
```

with:

```typescript
export const runProvenanceAttestation = async (
 subjectName: string,
 sha256: string,
 token: string,
): Promise<RunProvenanceResult> => {
```

Then in that function replace:

```typescript
 const oidc = Layer.provide(OidcTokenIssuerLive, FetchHttpClient.layer);
 const layer = Layer.mergeAll(AttestLive, SigstoreSignerLive, oidc, GitHubClientLive.fromEnv);
```

with:

```typescript
 const oidc = Layer.provide(OidcTokenIssuerLive, FetchHttpClient.layer);
 const layer = Layer.mergeAll(AttestLive, SigstoreSignerLive, oidc, GitHubClientLive.fromToken(token));
```

Also update its TSDoc to add `@param token - GitHub token authorising the attestation upload.`

- [ ] **Step 2: `runSbomAttestation` — add a `token` parameter**

Replace:

```typescript
export const runSbomAttestation = async (
 subjectName: string,
 sha256: string,
 bom: unknown,
): Promise<RunProvenanceResult> => {
```

with:

```typescript
export const runSbomAttestation = async (
 subjectName: string,
 sha256: string,
 bom: unknown,
 token: string,
): Promise<RunProvenanceResult> => {
```

Then in that function replace:

```typescript
 const oidc = Layer.provide(OidcTokenIssuerLive, FetchHttpClient.layer);
 const layer = Layer.mergeAll(AttestLive, SigstoreSignerLive, oidc, GitHubClientLive.fromEnv);
```

with:

```typescript
 const oidc = Layer.provide(OidcTokenIssuerLive, FetchHttpClient.layer);
 const layer = Layer.mergeAll(AttestLive, SigstoreSignerLive, oidc, GitHubClientLive.fromToken(token));
```

Add `@param token - GitHub token authorising the attestation upload.` to its TSDoc.

- [ ] **Step 3: `runCreateStorageRecord` — add `token`, use `fromToken`, fix the request body**

`runCreateStorageRecord` takes an `input` object. Add a `token` field to it, switch the layer to `fromToken`, and align the request body to the documented `@actions/attest` `createStorageRecord` shape (`name`, `digest`, `version`, `registry_url`, `artifact_url`, optional `repo`; the current `repository` / `github_repository` fields are not part of the API).

Replace the whole `runCreateStorageRecord` definition:

```typescript
export const runCreateStorageRecord = async (input: {
 readonly purl: string;
 readonly digest: string;
 readonly version: string;
 readonly registryUrl: string;
 readonly artifactUrl: string;
 readonly repository: string;
 readonly githubRepository: string;
}): Promise<readonly number[] | undefined> => {
 const [{ GitHubClient, GitHubClientLive }, { Effect, Layer }] = await Promise.all([
  import("@savvy-web/github-action-effects"),
  import("effect"),
 ]);

 const layer = Layer.mergeAll(GitHubClientLive.fromEnv);

 const program = Effect.gen(function* () {
  const client = yield* GitHubClient;
  const { owner } = yield* client.repo;

  const body = {
   name: input.purl,
   digest: input.digest,
   version: input.version,
   registry_url: input.registryUrl,
   artifact_url: input.artifactUrl,
   repository: input.repository,
   github_repository: input.githubRepository,
  };

  return yield* client.rest("orgs.createArtifactStorageRecord", async (octokit) => {
   const ok = octokit as { request: (route: string, params: Record<string, unknown>) => Promise<{ data: unknown }> };
   const response = await ok.request("POST /orgs/{owner}/artifacts/metadata/storage-record", {
    owner,
    ...body,
   });
   const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
   const ids = (data as { storage_records?: Array<{ id: number }> } | null)?.storage_records?.map((r) => r.id);
   return { data: ids };
  });
 });

 const ids = await Effect.runPromise(Effect.provide(program, layer));
 return ids ?? undefined;
};
```

with:

```typescript
export const runCreateStorageRecord = async (input: {
 readonly purl: string;
 readonly digest: string;
 readonly version: string;
 readonly registryUrl: string;
 readonly artifactUrl: string;
 readonly repo: string;
 readonly token: string;
}): Promise<readonly number[] | undefined> => {
 const [{ GitHubClient, GitHubClientLive }, { Effect, Layer }] = await Promise.all([
  import("@savvy-web/github-action-effects"),
  import("effect"),
 ]);

 const layer = Layer.mergeAll(GitHubClientLive.fromToken(input.token));

 const program = Effect.gen(function* () {
  const client = yield* GitHubClient;
  const { owner } = yield* client.repo;

  // Body shape matches @actions/attest's createStorageRecord:
  // ArtifactOptions (name, digest, version) + registry_url + artifact_url
  // + the optional `repo` field from PackageRegistryOptions.
  const body = {
   name: input.purl,
   digest: input.digest,
   version: input.version,
   registry_url: input.registryUrl,
   artifact_url: input.artifactUrl,
   repo: input.repo,
  };

  return yield* client.rest("orgs.createArtifactStorageRecord", async (octokit) => {
   const ok = octokit as { request: (route: string, params: Record<string, unknown>) => Promise<{ data: unknown }> };
   const response = await ok.request("POST /orgs/{owner}/artifacts/metadata/storage-record", {
    owner,
    ...body,
   });
   const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
   const ids = (data as { storage_records?: Array<{ id: number }> } | null)?.storage_records?.map((r) => r.id);
   return { data: ids };
  });
 });

 const ids = await Effect.runPromise(Effect.provide(program, layer));
 return ids ?? undefined;
};
```

Also update the runner's TSDoc: it documents the params — replace the `purl`/`digest`/`version`/`registryUrl`/`artifactUrl`/`repository`/`githubRepository` description so it reflects the new `repo` + `token` fields. Keep the existing prose about surfacing transport errors.

- [ ] **Step 4: Typecheck**

Run: `npx tsgo --noEmit -p tsconfig.json`
Expected: errors ONLY in `src/utils/create-attestation.ts` (the call sites — fixed in Task 3). `attest-runner.ts` itself must be clean. If `attest-runner.ts` itself has an error, fix it before continuing.

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix
git add src/utils/attest-runner.ts
git commit -m "$(cat <<'EOF'
refactor(attest): take an explicit token in the attest runners

The provenance, SBOM and storage-record runners now receive their GitHub token as an argument and build the client with GitHubClientLive.fromToken instead of fromEnv. The storage-record body is aligned to the documented createStorageRecord shape.

Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>
EOF
)"
```

(The commit hook runs `tsgo` — it will fail on the `create-attestation.ts` call sites. Commit with `--no-verify` is NOT allowed; instead, do Task 3 first and commit Tasks 2+3 together. Reorder: skip this Step 5 commit, proceed to Task 3, and commit both files at Task 3 Step 4.)

---

## Task 3: `create-attestation.ts` — explicit tokens, pass them to the runners

**Files:**

- Modify: `src/utils/create-attestation.ts`

This file reads `process.env.GITHUB_TOKEN` in four spots and calls the attest runners. Switch the reads to the `tokens.ts` helpers and thread the token into the runner calls.

- [ ] **Step 1: Add the import**

At the top of `src/utils/create-attestation.ts`, add to the internal imports:

```typescript
import { appToken, packagesToken } from "./tokens.js";
```

(Biome will sort it among the other `./` imports.)

- [ ] **Step 2: Replace the four `process.env.GITHUB_TOKEN` reads**

There are four occurrences of this pattern (around lines 271, 385, 444, 920):

```typescript
 const token = process.env.GITHUB_TOKEN || getState("githubToken");
```

and one variant:

```typescript
 const pkgToken = process.env.GITHUB_TOKEN || getState("githubToken");
```

Replace **every** `process.env.GITHUB_TOKEN || getState("githubToken")` expression with `packagesToken()`. So `const token = process.env.GITHUB_TOKEN || getState("githubToken");` becomes `const token = packagesToken();`, and `const pkgToken = process.env.GITHUB_TOKEN || getState("githubToken");` becomes `const pkgToken = packagesToken();`.

The surrounding `if (!token)` / `if (!pkgToken)` guards stay — `packagesToken()` returns `""` when no token is available, which is falsy.

- [ ] **Step 3: Thread the token into the runner calls**

`create-attestation.ts` calls `runProvenanceAttestation`, `runSbomAttestation`, and `createArtifactMetadataRecord` (which calls `runCreateStorageRecord`). Each runner now needs a token.

For `runProvenanceAttestation` — find every `await runProvenanceAttestation(<name>, <digest>)` call and add the token. The token in scope is the local `token` (now `packagesToken()`); pass it: `await runProvenanceAttestation(purlName, digest, token)`. There are two call sites (release-asset attestation and package attestation). After each, the `void token;` line that exists purely to "fail-fast on missing GITHUB_TOKEN" is now redundant — delete each `void token;` line.

For `runSbomAttestation` — find `await runSbomAttestation(<name>, <digest>, <bom>)` and add the token: `await runSbomAttestation(subjectName, sha256, bom, token)` — use whatever the local token variable is named at that site (it is the `packagesToken()` value).

For `createArtifactMetadataRecord` — its body calls `runCreateStorageRecord`. Replace the `runCreateStorageRecord({ ... })` call. The current call is:

```typescript
  const { runCreateStorageRecord } = await import("./attest-runner.js");
  const storageRecordIds = await runCreateStorageRecord({
   purl: purlName,
   digest,
   version,
   registryUrl: "https://npm.pkg.github.com/",
   artifactUrl,
   // The repository within the registry (the npm package name)
   repository: unscopedName,
   // The GitHub source repository (only repo name, no owner prefix)
   githubRepository: context.repo.repo,
  });
```

Replace it with:

```typescript
  const { runCreateStorageRecord } = await import("./attest-runner.js");
  const storageRecordIds = await runCreateStorageRecord({
   purl: purlName,
   digest,
   version,
   registryUrl: "https://npm.pkg.github.com/",
   artifactUrl,
   // The npm package name within the registry.
   repo: unscopedName,
   token: packagesToken(),
  });
```

`createArtifactMetadataRecord` still receives a `token` parameter from its caller and currently does `void token;`. Keep the `token` parameter for now (the caller passes it) but the `void token;` inside `createArtifactMetadataRecord` stays only if `token` is otherwise unused — if after this change `token` is unused in `createArtifactMetadataRecord`, remove the `token` parameter entirely and update its single caller (the `createArtifactMetadataRecord(packageName, version, digest, pkgToken)` call) to drop the last argument. Let `tsgo` and Biome's no-unused-vars guide this — resolve every unused-variable error.

- [ ] **Step 4: Typecheck, lint, commit Tasks 2 + 3 together**

```bash
npx tsgo --noEmit -p tsconfig.json
pnpm lint:fix
git add src/utils/attest-runner.ts src/utils/create-attestation.ts
git commit -m "$(cat <<'EOF'
fix(attest): route attestation and storage-record calls through explicit tokens

create-attestation now resolves the attestation token via packagesToken and passes it into the runners, so the storage-record call uses the workflow github-token (which carries packages:write) instead of whatever process.env.GITHUB_TOKEN happened to hold.

Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>
EOF
)"
```

Expected: `tsgo` clean, all hooks pass.

---

## Task 4: `link-issues-from-commits.ts` — `fromToken` in the Promise bridge

**Files:**

- Modify: `src/utils/link-issues-from-commits.ts`

`getLinkedIssuesFromCommitsPromise` (around line 649) runs its effect with `GitHubClientLive.fromEnv` — another `process.env.GITHUB_TOKEN` reader.

- [ ] **Step 1: Add the import**

At the top of `src/utils/link-issues-from-commits.ts`, add to the internal imports:

```typescript
import { appToken } from "./tokens.js";
```

- [ ] **Step 2: Use `fromToken`**

Replace:

```typescript
 Effect.runPromise(
  getLinkedIssuesFromCommits(targetBranch).pipe(
   Effect.provide(Layer.mergeAll(ActionEnvironmentLive, GitHubClientLive.fromEnv.pipe(Layer.orDie))),
  ),
 );
```

with:

```typescript
 Effect.runPromise(
  getLinkedIssuesFromCommits(targetBranch).pipe(
   Effect.provide(Layer.mergeAll(ActionEnvironmentLive, GitHubClientLive.fromToken(appToken()))),
  ),
 );
```

`GitHubClientLive.fromToken` returns a `Layer.Layer<GitHubClient>` with no error channel, so the `.pipe(Layer.orDie)` that wrapped `fromEnv` is dropped.

- [ ] **Step 3: Typecheck, lint, commit**

```bash
npx tsgo --noEmit -p tsconfig.json
pnpm lint:fix
git add src/utils/link-issues-from-commits.ts
git commit -m "$(cat <<'EOF'
refactor(issues): build the linked-issues client from the App token

getLinkedIssuesFromCommitsPromise now builds its GitHubClient with fromToken(appToken()) instead of fromEnv, removing another process.env.GITHUB_TOKEN reader.

Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>
EOF
)"
```

---

## Task 5: Rename the npm-publish token env var

**Files:**

- Modify: `src/utils/resolve-targets.ts`
- Modify: `src/utils/registry-auth.ts`

The GitHub Packages publish target declares `tokenEnv: "GITHUB_TOKEN"`, and `setupRegistryAuth()` sets `process.env.GITHUB_TOKEN` so the `.npmrc` generator can read it. Move this to a dedicated env var so `GITHUB_TOKEN` is never written.

- [ ] **Step 1: Change the target `tokenEnv` in `resolve-targets.ts`**

`src/utils/resolve-targets.ts` has two `tokenEnv: "GITHUB_TOKEN"` occurrences (around lines 27 and 55 — the GitHub Packages target and a custom-registry fallback). Replace both:

```typescript
  tokenEnv: "GITHUB_TOKEN",
```

with:

```typescript
  tokenEnv: "SILK_GITHUB_PACKAGES_TOKEN",
```

Update the adjacent comments that say `GITHUB_TOKEN (GitHub App token)` to read `SILK_GITHUB_PACKAGES_TOKEN`.

- [ ] **Step 2: Change the env var `setupRegistryAuth` sets in `registry-auth.ts`**

In `src/utils/registry-auth.ts` `setupRegistryAuth()`, replace:

```typescript
 } else {
  // Set GITHUB_TOKEN for GitHub Packages
  process.env.GITHUB_TOKEN = packagesToken;
  if (githubToken) {
   info("Using workflow GITHUB_TOKEN for GitHub Packages authentication (packages:write)");
  } else {
   info("Using GitHub App token for GitHub Packages authentication");
  }
 }
```

with:

```typescript
 } else {
  // Provide the GitHub Packages token to the npm subprocess via a
  // dedicated env var (the target's tokenEnv) — never GITHUB_TOKEN.
  process.env.SILK_GITHUB_PACKAGES_TOKEN = packagesToken;
  if (githubToken) {
   info("Using workflow github-token for GitHub Packages authentication (packages:write)");
  } else {
   info("Using GitHub App token for GitHub Packages authentication");
  }
 }
```

- [ ] **Step 3: Check for other `GITHUB_TOKEN` references in `registry-auth.ts`**

Run: `grep -n "GITHUB_TOKEN" src/utils/registry-auth.ts`
Expected: only comment/doc mentions remain (the file header doc block, line ~396 `The GitHub token is set to GITHUB_TOKEN for GitHub Packages auth.`). Update that doc sentence to: `The GitHub Packages token is set to SILK_GITHUB_PACKAGES_TOKEN for the npm subprocess.` There must be no remaining `process.env.GITHUB_TOKEN =` assignment.

- [ ] **Step 4: Typecheck, lint, commit**

```bash
npx tsgo --noEmit -p tsconfig.json
pnpm lint:fix
git add src/utils/resolve-targets.ts src/utils/registry-auth.ts
git commit -m "$(cat <<'EOF'
refactor(publish): give the npm subprocess a dedicated packages-token env var

The GitHub Packages publish target now authenticates through SILK_GITHUB_PACKAGES_TOKEN instead of GITHUB_TOKEN, so registry-auth no longer overwrites a shared env var.

Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>
EOF
)"
```

---

## Task 6: `main.ts` — remove the `GITHUB_TOKEN` bridge, use `GitHubToken.client()`

**Files:**

- Modify: `src/main.ts`

This is the keystone change. After it, nothing sets `process.env.GITHUB_TOKEN`.

- [ ] **Step 1: Delete the `GITHUB_TOKEN` overwrite in `main`**

In the `main` Effect (around line 759-761), the current code is:

```typescript
 const installationToken = yield* GitHubToken.read();
 process.env.GITHUB_TOKEN = installationToken.token;
 process.env.STATE_token = installationToken.token;
```

Replace with:

```typescript
 const installationToken = yield* GitHubToken.read();
 // The App token is bridged into STATE_token for the imperative shim's
 // getState("token"); process.env.GITHUB_TOKEN is intentionally never set.
 process.env.STATE_token = installationToken.token;
```

Keep the `process.env.STATE_githubToken = pkgToken.value.token;` block below it unchanged — that bridge stays.

Update the comment block just above `const installationToken` (the one mentioning `bridgeTokenStateToEnv` and `GitHubClientLive.fromEnv`) so it no longer references the env bridge — replace it with: `// The installation token provisioned by pre.ts is read back here and // bridged into STATE_token so the dynamically-imported imperative helpers // can read it via the _actions-compat getState("token") shim.`

- [ ] **Step 2: Switch `MainLive`'s client layer to `GitHubToken.client()`**

The current layer construction (around line 828) is:

```typescript
const githubClient = GitHubClientLive.fromEnv.pipe(Layer.orDie);
```

Replace with:

```typescript
const githubClient = GitHubToken.client().pipe(Layer.orDie);
```

`GitHubToken.client()` is `Layer.Layer<GitHubClient, ActionStateError, ActionState>`; `Layer.orDie` turns the `ActionStateError` into a defect. The residual `ActionState` requirement is satisfied by `Action.run`'s `ActionsRuntime.Default`. The rest of `MainLive` (the `Layer.provide(githubClient)` compositions) is unchanged.

Update the doc comment above `githubClient` (lines ~821-827) that explains `fromEnv` — replace it with: `// The main action's GitHubClient is built from the App installation token // that pre.ts persisted to ActionState, via the library-native // GitHubToken.client() layer. ActionState is supplied by Action.run's runtime.`

- [ ] **Step 3: Delete `bridgeTokenStateToEnv` and its call**

Delete the entire `bridgeTokenStateToEnv` function (the `const bridgeTokenStateToEnv = (): void => { ... };` block, around lines 848-873, including its doc comment).

Then in the entry-point guard at the bottom:

```typescript
/* v8 ignore next 4 -- entry-point guard, only runs in GitHub Actions */
if (process.env.GITHUB_ACTIONS) {
 bridgeTokenStateToEnv();
 await Action.run(main, { layer: MainLive });
}
```

Replace with:

```typescript
/* v8 ignore next 3 -- entry-point guard, only runs in GitHub Actions */
if (process.env.GITHUB_ACTIONS) {
 await Action.run(main, { layer: MainLive });
}
```

- [ ] **Step 4: Fix the `runPublishing` token read**

In `runPublishing` (around line 513-515) the current code is:

```typescript
  // main() has already read the installation token via `GitHubToken.read()`
  // and mirrored it to `process.env.GITHUB_TOKEN` for the imperative
  // bridges, so we read it from the env rather than re-deriving it here.
  const token = process.env.GITHUB_TOKEN ?? "";
```

Replace with:

```typescript
  // The package-detection helpers need the App installation token; read
  // it straight from the persisted state rather than any env var.
  const installationToken = yield* GitHubToken.read();
  const token = installationToken.token;
```

`runPublishing` is an `Effect.gen`, so `yield* GitHubToken.read()` works; `GitHubToken` is already imported in `main.ts`. `GitHubToken.read()` adds an `ActionState` requirement to `runPublishing` — `main`/`MainLive` already provide `ActionState`, so no layer change is needed. If `tsgo` reports `ActionState` missing from `runPublishing`'s inferred requirements at the `main` call site, that means the requirement did not flow — it should, since `Action.run` provides `ActionState`; investigate before working around it.

- [ ] **Step 5: Confirm no `GITHUB_TOKEN` writes remain**

Run: `grep -rn "process.env.GITHUB_TOKEN" src/`
Expected: **no matches** (reads or writes). If any remain, they were missed — resolve them with `appToken()` / `packagesToken()` per their purpose before continuing.

Also run: `grep -rn "fromEnv" src/`
Expected: **no matches** in `src/` (all `GitHubClient` layers now come from `fromToken` or `GitHubToken.client()`).

- [ ] **Step 6: Typecheck**

Run: `npx tsgo --noEmit -p tsconfig.json`
Expected: clean. The `GitHubClientLive` import in `main.ts` may now be unused — if Biome/`tsgo` flags it, remove `GitHubClientLive` from the `@savvy-web/github-action-effects` import in `main.ts`.

- [ ] **Step 7: Commit**

```bash
pnpm lint:fix && npx tsgo --noEmit -p tsconfig.json
git add src/main.ts
git commit -m "$(cat <<'EOF'
refactor(main): build the client from GitHubToken.client, stop setting GITHUB_TOKEN

The main action's GitHubClient is now built from the persisted App installation token via GitHubToken.client(), removing the bridgeTokenStateToEnv hack and every process.env.GITHUB_TOKEN assignment. runPublishing reads the token via GitHubToken.read().

Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>
EOF
)"
```

---

## Task 7: Verify and rebuild

**Files:**

- Modify: `dist/*`, `.github/actions/local/*` (build artifacts)

- [ ] **Step 1: Full verification**

```bash
npx tsgo --noEmit -p tsconfig.json
pnpm lint
npx vitest run
```

Expected: typecheck clean, lint clean, all tests pass (the suite was at 445 + 5 new `tokens.test.ts` = 450).

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: `Build completed successfully!` — `dist/main.js`, `dist/pre.js`, `dist/post.js` rebuilt.

- [ ] **Step 3: Sanity-check the bundle has no `GITHUB_TOKEN` writes from our code**

Run: `grep -c "process.env.GITHUB_TOKEN" dist/main.js`
Expected: this may be non-zero (bundled dependencies legitimately read it) — that is fine. The check that matters is Task 6 Step 5 on `src/`.

- [ ] **Step 4: Commit the build artifacts**

```bash
git add -A
git commit -m "$(cat <<'EOF'
build: rebuild dist for the token-plumbing untangle

Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>
EOF
)"
```

- [ ] **Step 5: Integration check**

Push `dev` and re-run the silk-integration publishing phase. In the publish job logs, confirm:

- No `Failed to create artifact metadata storage record` warnings — the `POST /orgs/{owner}/artifacts/metadata/storage-record` call returns success.
- `✓ Linked attestation to GitHub Packages artifact (storage record IDs: …)` appears.
- The attestations still succeed and the GitHub releases are still created (the App-token path still works).

If the storage-record call still 404s with the workflow token, the cause is outside this action — the org/endpoint may require a permission a repo-scoped token cannot carry; that is a GitHub App / org-settings investigation, not a code change here.

---

## Self-review notes

**Coverage of the goal — every `process.env.GITHUB_TOKEN` touchpoint:**

- Writers: `main.ts` overwrite + `bridgeTokenStateToEnv` → Task 6; `registry-auth.ts` → Task 5.
- Readers: `MainLive` `fromEnv` → Task 6; `main.ts:515` → Task 6; `create-attestation.ts` ×4 → Task 3; `attest-runner.ts` ×3 `fromEnv` → Task 2; `link-issues-from-commits.ts` `fromEnv` → Task 4; `resolve-targets.ts` `tokenEnv` → Task 5.
- Task 6 Step 5 is the backstop grep that proves no reader or writer survives.

**Token decisions:**

- App installation token (`appToken()` / `GitHubToken.read()` / `GitHubToken.client()`): the main `GitHubClient`, linked-issues lookup, package detection — repo-identity operations.
- Workflow token (`packagesToken()`, workflow-first with App fallback): attestation upload and the storage record — they need `attestations:write` / `packages:write`, which the publish job grants the workflow token.

**Known risk:** Task 6 Step 2 (`GitHubToken.client()` in `MainLive`) is the one change not provable by `tsgo` alone — it depends on `Action.run` supplying `ActionState` to the domain layer. The library docs state `client` "needs only `ActionState`, which `ActionsRuntime.Default` already provides", so this is expected to work; the integration run (Task 7 Step 5) is the real confirmation. If the action fails to boot with an unsatisfied `ActionState`, the fallback is to provide `ActionStateLive` (which needs `NodeFileSystem.layer`, already in `MainLive`) to `GitHubToken.client()` explicitly.

**Deferred / out of scope:** whether the GitHub App itself should be granted artifact-metadata permission (only relevant if the workflow token also 404s — see Task 7 Step 5). `getState("appSlug")` in `create-github-releases.ts` reads a `STATE_appSlug` that nothing in scope sets — pre-existing, unrelated, untouched.
