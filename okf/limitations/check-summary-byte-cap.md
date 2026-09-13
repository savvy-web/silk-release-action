---
type: Limitation
title: Check-run summary byte cap
description: A Phase-2 check-run summary over GitHub's 65535-byte limit is truncated on a byte budget, which is why per-package release notes are stripped from the structured output.
bounds: ../modules/release-action.md
tags:
  - observability
  - release
sources:
  - id: create-validation-check
    resource: ../../src/utils/create-validation-check.ts
  - id: steps-validation
    resource: ../../src/steps/validation.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T19:54:03Z
  body_sha256: 51388cdd2294072734b86349f3bb2b155c243ba6e6c4a3f0624d519bcdef6aac
status: draft
---

# Check-run summary byte cap

## Condition

A GitHub check-run's `output.summary` (or `output.text`) would exceed
GitHub's 65535-**byte** limit — counted in UTF-8 bytes, not characters, so
emoji and box-drawing glyphs each count as several bytes toward the cap.
This is reached in practice on large monorepos, where the unified
validation check's summary aggregates per-package results across every
workspace.

Note for the reader chasing `capCheckSummary` by name: `../../src/utils/create-validation-check.ts:14-22`
records that the hand-rolled `capCheckSummary` and `GITHUB_CHECK_SUMMARY_LIMIT`
that used to live in this file are gone. The cap is now enforced by the
`@effected/github` kit itself — `CheckRun.complete` and `CheckRun.update`
both route their output through `wireOutput`, which calls
`CheckRunOutput.truncated()` unconditionally on every request, against the
kit's own `CheckRunOutput.LIMIT_BYTES`. A consumer-side cap was removed
rather than layered on top, because capping twice would truncate twice, and
the kit's `capBytes` is strictly better than the code it replaced: it loops
while stripping trailing `U+FFFD` replacement characters, where the
hand-rolled version stripped exactly one and could still emit invalid UTF-8
from a split four-byte code point.

## Symptom

The summary is truncated on a byte budget without splitting a multi-byte
UTF-8 sequence, with a truncation notice appended. Before either the
hand-rolled or the kit-level cap existed, large monorepos hit GitHub's API
with a 422 on check completion instead of getting a truncated-but-valid
summary.

## Consequence

Release-notes CHANGELOG content is the dominant size driver in the unified
check's summary, so per-package `releaseNotes` are stripped from the
structured output before it is ever rendered there.
`stripReleaseNotes` (`../../src/steps/validation.ts:56-67`) returns a copy of
the `ValidationOutput` with `releaseNotes` omitted from every workspace
entry, and is applied both to the `result` action output and to the JSON
block embedded in the unified check-run summary
(`../../src/steps/validation.ts:210,265`). The full per-package release
notes are never lost — they are rendered in full in the dedicated Release
Notes Preview check (one of the three per-step checks) — but a consumer
reading only the structured `result` output or the unified check's embedded
JSON will not find them there.

## Why acceptable

Splitting release notes out of the machine-readable payload and into their
own check is a deliberate trade: it keeps the structured output stable in
size regardless of how much CHANGELOG prose a release accumulates, while
still surfacing the full notes somewhere a human or CI step can read them.
The alternative — capping the summary tighter to fit everything in — would
truncate the most useful part of the summary (which package changed and
why) to make room for content that has a dedicated home already.
