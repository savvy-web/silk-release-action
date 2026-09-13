---
type: Runbook
title: Run an end-to-end integration test on silk-integration
description: Exercise a change to this action against a real workflow run in the silk-integration consumer repository before it ships.
tags:
  - testing
  - ci
  - release
sources:
  - id: package-json
    resource: ../../package.json
  - id: silk-integration
    resource: "https://github.com/savvy-web/silk-integration"
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: fe14e6c334ff92c931dbfff0efe95a61ab521aa97796594d09fd75dcf2c0948f
status: draft
---

# Run an end-to-end integration test on silk-integration

## Trigger

A change to this action needs an end-to-end run — the action is a
**bundled** artifact,[^package-json] so nothing a consumer workflow runs
reflects a source edit until it is built into the committed
`dist/main.js`. Local unit tests and typechecking do not exercise the
compiled bundle against a real GitHub Actions runner, real registries, or
the release-PR surfaces a consumer sees.

## Steps

1. Run `pnpm ci:test` and confirm the suite is green.
2. Run `pnpm build`, which invokes `turbo run build:prod`[^package-json]
   and regenerates `dist/main.js` from the current source.
3. Commit and push the change, including the rebuilt `dist/main.js`, to
   the feature branch.
4. Trigger the consumer workflow:
   `gh workflow run release.yml --repo savvy-web/silk-integration --ref main`.
5. Watch the run: `gh run list --repo savvy-web/silk-integration --limit 1`.

Spencer initiates the integration runs; this runbook is what he follows to
do it.

## End state

The `savvy-web/silk-integration` workflow run finishes in the phase
expected for the change under test (branch management, validation, or
publishing) with a green result. See
[silk-integration consumer](../consumers/silk-integration.md) for the
surfaces that run exercises.

[^package-json]: `../../package.json`
