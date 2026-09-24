---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

- Fixed registry publishing failing with `EBADDEVENGINES` in repositories that declare `devEngines.packageManager` as pnpm. npm checks the project's `devEngines` before every command, so `npm publish` run from the repository root rejected the pnpm declaration, including `onFail: "download"`. Publishing now runs npm with its local prefix set to `<RUNNER_TEMP>/silk-npm-prefix`, outside the repository.
