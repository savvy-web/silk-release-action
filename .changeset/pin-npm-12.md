---
"@savvy-web/silk-release-action": patch
---

## Bug Fixes

Every `npm pack` and `npm publish` the action runs now goes through `pnpm dlx npm@12` instead of `npm@11`, on a kit that decodes both the npm 11 and npm 12 `pack --json` shapes. npm 12.0.0 changed `pack --json` from an array to an object keyed by package name; with `@effected/npm@0.14.1` that made every publish fail with `PublishError kind:"output"` even though the tarball was written, and would have hit the moment a runner's npm moved to 12 ([#424](https://github.com/savvy-web/silk-release-action/issues/424)). npm 12.0.2 also restores the bundled `sigstore` that 12.0.0 shipped without, so the other reason for holding at 11 is gone.

* `npm@12.0.2` requires Node `^22.22.2 || ^24.15.0 || >=26.0.0`; the pin moved on Node 26.9.0. Lowering the runtime floor below 24.15 produces an `npm warn cli … does not support Node.js` on every call — a warning, not a failure

## Tests

* Added an integration test that fetches the pinned npm through the same pnpm launcher the action uses and drives `PackagePublish.dryRun` against a fixture package, so the pin and the installed `@effected/npm` are proven to decode each other by a real subprocess rather than a fixture

## Dependencies

| Dependency                     | Type   | Action  | From   | To     |
| :----------------------------- | :----- | :------ | :----- | :----- |
| @effected/pnpm-plugin-effect   | config | updated | 0.8.14 | 0.8.15 |
| @effected/npm                  | dependency | updated | 0.14.1 | 0.14.2 |
| @effected/github-actions       | dependency | updated | 0.13.3 | 0.13.4 |
