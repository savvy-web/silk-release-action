---
"@savvy-web/silk-release-action": minor
---

## Bug Fixes

- Resolve `publishConfig.targets` regardless of the `private` flag. A public source package (`private: false`) that declared explicit multi-registry targets was short-circuited to a single default target at `publishConfig.directory` (the private `dist/dev` artifact), which the private-build filter then dropped — misclassifying the package as version-only. Publishability now derives from the declared targets first.
- Honor the changeset `ignore` list across validation and publishing. Ignored example packages that carry `publishConfig.targets` (e.g. `@libraries/*`, `@rspress/*`) are now fully excluded from releases — no publish target, no version-only row, no tag.

## Refactoring

- Consolidate all publishability detection onto a single ignore-aware `PublishabilityDetector` layer. `ChangesetConfig` is now the single source of changeset-config truth (`mode`, `versionPrivate`, `ignorePatterns`, `isIgnored`, `fixed`), and the synchronous reimplementation of the silk rules in `release-summary-helpers.ts` has been removed in favor of an Effect-based `listPublishablePackages`.
