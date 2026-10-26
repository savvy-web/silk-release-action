---
"@savvy-web/silk-release-action": patch
---

## Refactoring

- Both release-commit paths now read the working tree with `Git.status(cwd, { untrackedFiles: "all" })`, which lists a directory of only untracked files (pre mode's `.changeset/pre/`) file by file. The local `expandUntrackedDirectories` workaround is deleted. The release commit's contents are unchanged. Closes #531
- Ported to the breaking `@effected/*` 0.x releases: `MarkdownDocument` lookups return `Option`, `SemVer` comparisons are instance methods, and the OIDC issuer now requires `ActionOutputs`, which the action runtime provides. Every OIDC token the action mints is now masked in the log when it is issued.
