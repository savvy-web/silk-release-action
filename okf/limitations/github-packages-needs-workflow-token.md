---
type: Limitation
title: GitHub Packages needs the workflow's own token
description: A GitHub Packages publish target with no github-token input fails by name, because a GitHub App installation token cannot authenticate to GitHub Packages at all.
bounds: ../interfaces/action-inputs.md
tags:
  - security
  - release
sources:
  - id: resolve-targets
    resource: ../../src/release/resolve-targets.ts
  - id: publish
    resource: ../../src/release/publish.ts
  - id: run-30228332922
    resource: "https://github.com/savvy-web/systems/actions/runs/30228332922"
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: a7c368fbf32e99453f2a69c853adc5d68616a13e6d412eb5d2fefb8125a1b86d
status: draft
---

# GitHub Packages needs the workflow's own token

## Condition

A publish target classifies as `github-packages` (`classifyRegistry(t.registry)
=== "github-packages"`, `../../src/release/publish.ts:672`) and `pickToken`
(`../../src/release/resolve-targets.ts:97`) resolves to `null` for it — the
`github-token` action input was not supplied.

## Symptom

The target fails **by name** rather than surfacing as a generic auth error.
`../../src/release/publish.ts:672-680` names the missing credential
directly: `no github-token input — GitHub Packages requires the workflow's
secrets.GITHUB_TOKEN. GitHub App tokens cannot access GitHub Packages at
all, so the App installation token this action provisions is not a
fallback`, logged as an `Effect.logError` plus a `⬆ <label> · no-token`
warning line, and the run aborts before any GitHub release is created.

This replaces an older, harder-to-diagnose symptom: before the named check
existed, the missing credential surfaced as four identical `integrity probe
failed — status 403` lines against `npm.pkg.github.com`, which read like a
permissions problem on the target package rather than a missing input.

## Why acceptable

This is a platform boundary, not a bug in this action. A GitHub App
installation token — including the one this action provisions via
`pre.ts`'s `GitHubToken.provision()` — cannot access GitHub Packages at
all. The **sole** exception is the default GitHub Actions token
(`secrets.GITHUB_TOKEN`), which is a special kind of App token that GitHub
Packages does accept. Permissions held by the token are irrelevant to this:
on `savvy-web/systems` run 30228332922, the same token that successfully
resolved the App identity and revoked itself against `api.github.com` was
rejected with a 403 by `npm.pkg.github.com` while holding `packages:write`.
`custom-registries` is not a substitute — it authenticates *other*
registries by URL, and GitHub Packages is never reachable through it for
the same App-token reason.

## Fix

None on this action's side. A consumer with a GitHub Packages target must
pass `secrets.GITHUB_TOKEN` as the `github-token` input with
`permissions: packages: write` on the calling workflow; there is no
credential this action can synthesize or fall back to that would satisfy
GitHub Packages' authentication requirement.

See also: [Action inputs](../interfaces/action-inputs.md).
