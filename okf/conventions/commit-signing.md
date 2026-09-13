---
type: Convention
title: Sign every commit with the verified GPG key, never the machine default
description: Sign every commit in this repository with the GPG key registered as spencer@savvyweb.systems (key id prefix D7C5…), never the machine's default key (prefix E1E5…, unverified on GitHub); every commit also needs a Conventional Commits subject and a Signed-off-by trailer.
tags:
  - security
  - dx
stale_after: "2026-12-13T00:00:00Z"
sources:
  - id: commitlint-config
    resource: ../../lib/configs/commitlint.config.ts
  - id: dco-workflow
    resource: ../../.github/workflows/dco.yml
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 5dba729caa5dd679939af7dac40e5c6511cd6d8f224ccd6ae7ae431f30036c72
status: draft
---

# Sign every commit with the verified GPG key, never the machine default

Sign every commit made in this repository with the GPG key registered on
GitHub as `spencer@savvyweb.systems` (key id ending `D7C5…`). Do not sign
with the machine's default key (id ending `E1E5…`): that key is unverified
on GitHub, and the repository's branch ruleset rejects a commit signed with
it outright rather than merely flagging it unverified. A rejected push for
this reason means the wrong key is active, not a ruleset misconfiguration
to work around.

Pair the signature with a Conventional Commits subject, checked by
`commitlint` (`@commitlint/config-conventional`, configured through
`lib/configs/commitlint.config.ts`'s `CommitlintConfig.silk()`), with a body
capped at 300 characters.[^commitlint-config] Carry a `Signed-off-by:`
trailer on every commit as well — a separate promise from the GPG
signature, checked on every pull request by the `dco.yml` DCO Check
workflow rather than by commitlint.[^dco-workflow] A commit can satisfy one
of the two checks and fail the other: a GPG-signed commit with no
`Signed-off-by:` trailer passes local signature verification but fails DCO,
and vice versa.

Two more rules ride along with every commit in this repository:

- Do not hand-format staged files before committing. `lint-staged`
  (Husky's pre-commit hook) already runs Biome, `markdownlint-cli2`, and
  the other per-file-type formatters over what is staged and re-stages the
  result; a hand-formatting pass ahead of it is redundant at best and
  fights the hook's own re-stage at worst.
- Do not "fix" the executable-bit strip on a `.sh` file. `lint-staged`
  normalizes every staged shell script to `100644`, stripping any `755`
  mode, because every script in this repository is invoked through `bash`
  rather than executed directly, and none needs the executable bit at
  runtime. A `755`-to-`644` mode change in a diff is this normalization
  working as intended, not mode drift to restore.

[^commitlint-config]: `../../lib/configs/commitlint.config.ts`

[^dco-workflow]: `../../.github/workflows/dco.yml`
