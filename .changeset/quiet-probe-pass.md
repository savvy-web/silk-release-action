---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

Eliminates noisy `[@octokit/request] "GET .../attestations/sha256%3A..." is deprecated` warnings that appeared twice per published package during Phase 3. The warnings fired on the attestation idempotency probe (`Attest.listForSubject`) because the request ran under Octokit's default GitHub API version, whose attestations response shape GitHub has deprecated. The probe now pins `X-GitHub-Api-Version: 2026-03-10`. Attestation creation, linking, and idempotency behavior are unchanged — only the console noise is gone.

## Dependencies

| Dependency | Type | Action | From | To |
| :--------- | :--- | :------ | :--- | :- |
| @savvy-web/github-action-effects | dependency | updated | 2.0.1 | 2.0.2 |
