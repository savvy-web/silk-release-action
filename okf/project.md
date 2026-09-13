---
type: Project
title: silk-release-action
description: A TypeScript GitHub Action implementing a three-phase automated release workflow for monorepos and single-package repositories using changesets.
status: draft
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: a3a3a79fbf241ff5bdea6c9dbe199eb4c835aac0a56ec32df4e0d017803ca271
sources:
  - id: action-yml
    resource: ../action.yml
  - id: package-json
    resource: ../package.json
  - id: src-main
    resource: ../src/main.ts
tags:
  - architecture
  - release
---

# silk-release-action

## Purpose

`silk-release-action` is a Node.js 24 GitHub Action (`runs.using: node24`, `pre`/`main`/`post` lifecycle hooks declared in `action.yml`[^action-yml]) that automates the full release lifecycle for a changesets-based repository: detecting pending changes, managing a release branch and PR, validating builds and registry readiness, publishing to multiple registries (npm, JSR, GitHub Packages, custom registries), creating Git tags and GitHub releases with attestations, and closing linked issues. Every phase runs as a pure Effect program (`src/main.ts`[^src-main] is a 19-line entry guard around `Action.run`); all operations produce GitHub Check Runs and write managed sections into a sticky comment on the release PR so a maintainer reads one authoritative status surface per release rather than reconstructing it from raw logs. This repository (`@savvy-web/silk-release-action`) also holds the shared composite actions, reusable workflows, GitHub Projects automation, and internal GitHub tooling that the release action's own release cycle depends on, but the action itself is the primary subject this bundle documents.

## Boundaries

This repository owns the release **orchestration**: the phase-detection router, the layer graph that wires services together (`src/layers/app.ts`, `src/release/layers.ts`), the phase-body modules under `src/steps/`, the input/output schema (`src/schema/`), and the report/comment rendering (`src/release/report.ts`, `src/utils/write-sections.ts`, `src/utils/managed-sections.ts`). It decides *when* each phase runs, *what* each phase does with the services it is handed, and *how* the result is reported — but it implements almost none of the underlying mechanics itself.

Nearly every runtime capability is authored upstream and consumed as a dependency, split across the `@effected/*` kit[^package-json] (the imperative `@actions/*` layer and the single-package `@savvy-web/github-action-effects` predecessor are both gone, replaced wholesale by this split):

| Package | What this repository uses it for |
| ------- | --------------------------------- |
| `@effected/github-actions` | `Action.run`, `ActionInput`, `ActionOutputs`, `ActionState`, `ActionEnvironment`, `ActionLogger`, `GitHubToken`, `OidcTokenIssuer`, `DryRun`, `GitHubMarkdown`, `ActionsProvenance`, `Secret` |
| `@effected/github` | `GitHubClient` (REST + GraphQL), `Repo`, `CheckRun`, `GitBranch`, `GitCommit`, `GitHubCommit`, `GitHubContent`, `GitHubIssue` (including `commentOnce` + `CommentMarker`), `GitHubRelease`, `GitHubRepository`, `GitTag`, `PullRequest`, `PullRequestComment`, `ArtifactMetadata`, `Attestation`, `GitHubApp`, `harvestIssueReferences` |
| `@effected/git` | Every git operation this action performs — `status`, `clean`, `restore`, `branchCreate`, `branchDelete`, `isShallow`, `fetchUnshallow`, log/diff reads |
| `@effected/npm` | `PackagePublish` (pack / publish / dry-run / auth), `NpmRegistry` (HTTP registry reads), `classifyRegistry`, registry label helpers |
| `@effected/sbom` | SBOM generation, `SigstoreSigner` |
| `@effected/commands` | `LocalExec`, `ToolDiscovery` — the subprocess and tool-probe seams |
| `@effected/workspaces` | `Workspaces.layerWithGit()`, `WorkspaceDiscovery`, `PublishabilityDetector`, `DependencyGraph`, `PackageManagerDetector` |
| `@effected/markdown`, `@effected/package-json`, `@effected/jsonc` | Markdown assembly, manifest reads, JSONC parsing |

`@savvy-web/silk-effects`[^package-json] supplies the silk-specific release policy this action does not implement itself: `Changesets.ReleasePlanner` / `ConfigInspector` (native, zero-install versioning), `SilkPublishability` (the silk publishability precedence rules and `PublishTargetBindingError`), and `PrBody` (the managed release-PR description region).

## Non-goals

- **No `act`-driven local composite.** The canon's `persistLocal` slot, which would emit a `.github/actions/local` composite for an `act` smoke loop, is deliberately disabled; this repository does not run `act` locally and does not commit a second copy of the bundle to every checkout.
- **No PAT-based authentication.** Every credential this action provisions or consumes is a GitHub App installation token, the default Actions token, or an OIDC-issued token — never a personal access token.
- **No consumer `ci:version` script.** Phase 1 versions in-process through the bundled silk-effects `ReleasePlanner` and runs zero-install; a consumer repository's own version-command is never invoked, and the `version-command` input does not exist.
- **No persistent write of `process.env.GITHUB_TOKEN`.** The action never writes the workflow token into the process environment as a standing plaintext bridge; the one scoped exception — setting it around `ReleasePlanner.apply` and restoring the prior value after — is a bounded mutation, not a persistent one.

[^action-yml]: action.yml
[^package-json]: package.json
[^src-main]: src/main.ts
</content>
