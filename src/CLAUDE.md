# src/CLAUDE.md

Source code architecture and coding patterns for silk-release-action.

**See also:** [Root CLAUDE.md](../CLAUDE.md) | [**test**/CLAUDE.md](../__test__/CLAUDE.md)

**For full architecture documentation:** `@../.claude/design/release-action/architecture.md` -- entry points, program/steps split, phase detection, Phase-1 native versioning (zero-install), the `@effected/*` kit map, module dependency graph, the per-byte-group prod layout (`dist/prod/<group>/pkg`), group-keyed release assets, the release-PR body region, and **Degradation semantics (issue #216)**.

**For integration/publishing details:** `@../.claude/design/release-action/integration.md` -- registry infrastructure, native versioning and the changelog module map, token-auth publishing fallback, SBOM generation, and publish summaries.

## Architecture Overview

Every phase is a pure Effect program. The imperative `@actions/*` layer is gone, and so is `@savvy-web/github-action-effects` — replaced wholesale by the `@effected/*` kit. **Do not import either.**

- **Entry points** -- `main.ts` (**19 lines**: a `GITHUB_ACTIONS` guard and `Action.run(main, { layer: MainLive })`, nothing else), `pre.ts` (App token via `GitHubToken.provision()`, persists the `github-token` input to `GithubPackagesTokenState`), `post.ts` (revocation via `GitHubToken.dispose()`, never fails the workflow), `state.ts` (shared action state)
- **`program.ts`** -- composition only: `readInputs` → `detectWorkflowPhase` → a five-arm switch (`branch-management`, `validation`, `publishing`, `close-issues`, default no-op). No I/O beyond that, no formatting, no step bodies. Exported so tests run it without module-level execution
- **`layers/`** -- `app.ts` builds `MainLive` from kit services; `ActionEnvironment`, `ActionLogger`, `ActionOutputs`, `ActionState` and `NodeServices` come from `ActionRuntime` via `Action.run` and must be *required*, never rebuilt. Sigstore's `IdentityToken` comes from the kit's `ActionsIdentityToken.layer` over `OidcTokenIssuer`
- **`steps/`** -- one module per phase body: `branch-management`, `publish-release-plan`, `validation`, `publish-validation`, `link-issues`, `build-validation`, `per-step-checks`, `publish-validation-report`, `publishing`, `close-issues`. Each declares its **failure posture** in its module docs *and* its error channel — `never` means "this degrades", and the docs say what the degradation looks like downstream. Six of those degradations are silently green today (issue #216); read the design doc before changing one
- **Release module** -- `release/`: `publish.ts`, `releases.ts` (group-keyed asset names), `validation.ts`, `validation-checks.ts` (`deriveValidationChecks`, pure), `report.ts`, `publishability.ts`, `changeset-config.ts`, `meta-archive.ts`, `attest-helpers.ts`, `resolve-targets.ts` (fails with `PublishTargetBindingError` when detection misses the `dist/prod/targets.json` binding), `types.ts`, `errors.ts`, `layers.ts` (`ReleaseLive` — workspace discovery, `ChangesetConfig`, the adaptive `PublishabilityDetector`, and the silk-effects `ReleasePlanner`/`ConfigInspector`)
- **Schema** -- `schema/inputs.ts` and `schema/outputs.ts` are the single decode/declare points (see below); `release-output.ts`, `projections.ts`, `silk-release-config.ts`. JSON Schema artifacts at repo root
- **Changelog workers** -- `changelog/silk.ts` / `changelog/default.ts` bundle to `dist/changelog-*.js` via `action.config.ts` `workers`; `build.nativeDynamicImports` keeps the `@changesets/apply-release-plan` runtime import native
- **Utilities** -- `utils/*.ts`, one focused purpose each, notably `native-version.ts`, `write-sections.ts` (the fold shared by both phases), `pr-body.ts`, `sort-releases-topologically.ts`, `group-id.ts`, `detect-workflow-phase.ts`
- **SBOM/attestation** -- `@effected/sbom` (`SigstoreSigner`) and `@effected/github` `Attestation`; not in this repo

## Coding Standards

### Type Safety

- Explicit return types on all exported functions
- Never use `any` -- use proper types or `unknown` with type guards
- Prefer `interface` over `type` for object shapes (Biome enforces); `type` for unions and aliases
- Prefer a typed error channel over narrowing an `unknown` catch

### Import Conventions

- Use `.js` extensions and the `node:` protocol
- Order: Node builtins > External > Internal > Type imports (Biome enforced)

### GitHub API

Yield kit services — `GitHubIssue`, `PullRequest`, `CheckRun`, `GitBranch`, `GitTag`, `GitHubRelease`, … from `@effected/github` — not a raw client. `GitHubClient` (REST + GraphQL, GraphQL is a *member*) is built once in `layers/app.ts` via `GitHubToken.clientLayer()`; `Repo` is required per call, never captured at construction. Never call `core.getInput` or reach for `@actions/github`.

### Subprocesses and Git

Use `@effected/git` for **every** git operation. All 17 raw `ChildProcess.make("git", …)` spawns were deleted — do not reintroduce one. For other subprocesses use `LocalExec` / `ToolDiscovery` from `@effected/commands`, and `PackagePublish` / `NpmRegistry` from `@effected/npm` for npm. `@actions/exec` is not a dependency.

### Error Handling

- The error channel is the mechanism: fail with a typed error, don't call `core.setFailed`
- A step that degrades must **contribute a finding** — the verdict reads findings, so degrading silently is what makes a run green for work that never ran
- State the posture in the module docs next to the error channel; they are checked against each other

### Input and Output Handling

Every `action.yml` input is decoded **once**, in `schema/inputs.ts`; `main` hands the record down and phase bodies take values as parameters. Do not read an input anywhere else (a short allowlist with stated reasons exists — `pre` is a separate process). `dry-run` is decoded only to build `DryRun`, which consumers ask instead of re-reading. Decode against literal unions rather than casting — a cast let a `phase` typo route to the no-op arm and the whole release went silently green. Outputs are declared in `schema/outputs.ts`. `action.yml`, the `*_NAMES` tuples and what `src/` actually reads/writes are held together by three-way sync tests; update all three together.

### Managed PR Body Region

`pr-body.ts` owns a marker-delimited slice of the release PR description with two nested regions (AI summary, closing references):

- Never rebuild a nested region from scratch when a prior body exists — carry it through (`extractSummary`, `extractReferences`), or an agent's edit is silently deleted on the next commit
- Locate the reference region with `REFERENCES_START_PREFIX`, never the plain `REFERENCES_START`: emitted markers carry an `owned="…"` attribute, so the bare constant misses every region this action wrote
- `owned` lists the ids this run emitted so the next run subtracts them and carries through only agent-added references. Without it, preserving an id absent from `linkedIssues` re-links (and on merge auto-closes) an issue the release deliberately dropped
- The reference region is emitted unconditionally, empty or not, so it stays an addressable target
- Closing references have two non-interchangeable spellings: comma-joined inside the squash fence (commitlint), bare one-per-line outside it (GitHub's linker)

Load the architecture doc ("Release PR body") before changing marker syntax or the merge rule.

## TSDoc

TSDoc on all exported functions with `@param`, `@returns`, `@remarks`. Module docs carry the failure posture.
