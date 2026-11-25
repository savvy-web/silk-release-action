# Log

## 2026-11-25

* Updated A FULL TURBO green typecheck can mean no typecheck ran
* Updated A Schema.isPattern check without the u flag publishes no pattern
* Updated A degraded Phase-2 step contributes a finding, never flips a boolean
* Updated A green publish can still 404 for minutes on npm
* Updated A green suite says nothing about `runValidation`'s own wiring
* Updated A numeric output-schema field is Schema.Int, never bare Schema.Number
* Updated A vitest CLI file argument does not filter the run
* Updated Action inputs and outputs
* Updated An explicit-only snapshot phase, never a publish-phase flag
* Updated An unrecognized changelog id silently degrades publishability to vanilla rules
* Updated Bump the output schema version
* Updated Changelog module map
* Updated Check for an existing attestation before writing a new one
* Updated Check names
* Updated Check-run summary byte cap
* Updated Commits via the Git Data API, branch linking via GitBranch.createLinked
* Updated Decode every action.yml input in schema/inputs.ts, nowhere else
* Updated Disable the persistLocal composite action and its act smoke loop
* Updated Double Effect services with layers, never with mocks
* Updated Effect layers, not mocks, as the test-double mechanism
* Updated GitHub Packages needs the workflow's own token
* Updated Keep every test at or below __test__/, mirrored, never under a utils/ directory
* Updated Land feature work on dev, never directly on main
* Updated Manifest sync guards need three independent legs, not two
* Updated Never write process.env.GITHUB_TOKEN persistently
* Updated No test lives under src/ — one location plus a mirrored unit/ subtree
* Updated OIDC-first publishing, with token auth as bootstrap and fallback
* Updated Pack the tarball once per build directory, not once per target
* Updated Phase 2 reports a green verdict for work that never ran
* Updated Phase 3 is six gated steps, target resolution ahead of the build gate
* Updated Pin known-wrong behaviour with characterization tests before fixing it
* Updated Pin the npm publish CLI to 11.x via the package manager's dlx launcher
* Updated Pin the npm publish CLI to 12.x via the package manager's dlx launcher
* Updated Recreate the release branch from main rather than rebase
* Updated Release PR surfaces
* Updated Remove skip-token-revoke, pr-title-prefix, version-command, and the dead build-command read
* Updated Replace @actions/attest with the kit's sign/store split, assembled locally
* Updated Run an end-to-end integration test on silk-integration
* Updated SBOM configuration
* Updated Sign every commit with the verified GPG key, never the machine default
* Updated Silk publishability rules invert the private flag and live upstream
* Updated State a steps/ module's failure posture in its docs and its error channel
* Updated Test Harness
* Updated Test an upstreamed implementation with a contract smoke test
* Updated The `result` output document
* Updated The shared release workflow
* Updated Three-phase workflow
* Updated Use it.effect for a one-for-one Effect test, plain it() for the four exceptions
* Updated Version natively via the bundled silk-effects ReleasePlanner
* Updated Version the output JSON Schema under its own path per release
* Updated Workspace
* Updated `Effect.logInfo` inside a group is buffered and discarded on success (no longer true)
* Updated byte-group
* Updated characterization test
* Updated github-only
* Updated main.ts as guard, program.ts as composition, steps/ per phase body
* Updated release-action
* Updated silk-integration
* Updated silk-release-action

## 2026-11-21

* Updated `Effect.logInfo` inside a group is buffered and discarded on success (no longer true)
* Updated release-action

## 2026-11-10

* Updated A FULL TURBO green typecheck can mean no typecheck ran
* Updated Changelog module map
* Updated Disable the persistLocal composite action and its act smoke loop
* Updated Version natively via the bundled silk-effects ReleasePlanner
* Updated Workspace
* Updated byte-group
* Updated release-action

## 2026-11-06

* Updated Bump the output schema version
* Updated The `result` output document
* Updated Version the output JSON Schema under its own path per release
* Updated `Effect.logInfo` inside a group is buffered and discarded on success
* Updated release-action

## 2026-11-01

* Updated An explicit-only snapshot phase, never a publish-phase flag
* Updated OIDC-first publishing, with token auth as bootstrap and fallback
* Updated release-action

## 2026-10-23

* Updated A green publish can still 404 for minutes on npm
* Updated Action inputs and outputs
* Updated OIDC-first publishing, with token auth as bootstrap and fallback
* Updated The `result` output document
* Updated release-action

## 2026-10-19

* Added A Schema.isPattern check without the u flag publishes no pattern
* Updated A numeric output-schema field is Schema.Int, never bare Schema.Number
* Updated SBOM configuration

## 2026-09-29

* Updated Bump the output schema version
* Updated Version the output JSON Schema under its own path per release

## 2026-09-27

* Added An explicit-only snapshot phase, never a publish-phase flag

## 2026-09-19

* Updated Action inputs and outputs
* Updated Pin the npm publish CLI to 11.x via the package manager's dlx launcher
* Added Pin the npm publish CLI to 12.x via the package manager's dlx launcher
* Updated Use it.effect for a one-for-one Effect test, plain it() for the four exceptions

## 2026-09-15

* Updated A FULL TURBO green typecheck can mean no typecheck ran
* Updated Test Harness
* Updated Workspace
* Updated Bump the output schema version
* Updated SBOM configuration
* Updated Version the output JSON Schema under its own path per release

## 2026-09-13

* Initialized the bundle with the software-project profile
