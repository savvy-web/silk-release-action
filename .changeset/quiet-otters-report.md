---
"@savvy-web/silk-release-action": minor
---

## Bug Fixes

### A failed publish build now shows you why it failed

When the publishing phase's Build & SBOM step failed, the job log carried only the exit summary — the group opened and went straight to the error annotation, and the compiler diagnostics appeared in no log at all. Root-causing a failed release meant reproducing the build out of band.

The captured output is now re-emitted on failure. Both streams go out, because the producing tool decides which one it uses: turbo puts task output on stdout under `--output-logs=full`, while a bare compiler writes diagnostics to stderr. The failure annotation also falls back to the stdout tail when stderr is empty, replacing the bare `ci:build failed —` that a stdout-only tool used to produce.

### Comma-separated closing references link every issue, not just the first

`Closes #247, #248 and #251` in a commit body linked only #247 — the rest of the list was silently dropped from the release. Closing references are now read with the list dialect from `@effected/github-references`, which reads the whole list, accepts the colon-tolerant `Closes: #5` spelling GitHub itself accepts, and ignores non-closing keywords such as `Refs`.

### Re-running the close-issues stage recovers a comment that never landed

An issue whose close succeeded while its follow-up comment failed ended closed with no comment, and a re-run could not repair it: the already-closed check skipped the issue before reaching the comment.

An already-closed linked issue is now skipped only when GitHub does not attribute its closure to the release pull request being processed. One that this release closed falls through to the comment, which is marker-guarded and therefore a no-op on an ordinary re-run. Attribution that cannot be established still skips — a courtesy comment is worth less than the false claim that posting unconditionally would put on issues closed manually or by an earlier release.

## Refactoring

### Managed sections moved onto the kit's region engine

The release PR body and its sticky comments no longer scan and splice their own marker regions; `ManagedDocument` from `@effected/github-actions` owns the region grammar.

Behaviour visible to a reader of the release PR:

* The section provenance stamp moved from an HTML comment inside the content into region metadata, so the rendered body carries one less line of machinery per section.
* Refreshing the staleness banners now rewrites only the banner regions, leaving every section's content and stamp byte-identical — previously a write re-rendered every section in order to refresh its banner.
* The write-ordering guard picked up two refinements: a blank run id orders lexically rather than as zero, and write times compare as instants, so two offset spellings of the same moment order correctly.

Existing release PRs and sticky comments migrate on the first write. The conversion carries each section's title, body and stamp across rather than stripping the old markers, so a release in flight keeps every result it had; it is idempotent, and a legacy region whose stamp cannot be read is left exactly where it is rather than removed.
