# Troubleshooting

## Common issues

### GitHub Packages publishing fails with "no github-token input"

GitHub Packages requires the workflow's own `secrets.GITHUB_TOKEN`, passed as the `github-token` input, with `packages: write` on the job:

```yaml
permissions:
  packages: write

# ...

- uses: savvy-web/silk-release-action@v4
  with:
    app-client-id: ${{ vars.APP_CLIENT_ID }}
    app-private-key: ${{ secrets.APP_PRIVATE_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

Adjusting the GitHub App's permissions will not fix this. **GitHub App tokens cannot access GitHub Packages at all** — the sole exception is the default GitHub Actions token, which is a special kind of App token — so the installation token this action provisions is not a fallback, whatever it carries. An App token holding `packages: write` is still rejected `403` on a plain read of `npm.pkg.github.com`.

Older versions surfaced the same condition as repeated `integrity probe failed — status 403` lines, or as `Installation not allowed to Create organization package`, both of which read as a permissions problem on the packages rather than a missing input. The action now names the input and stops before attempting authentication.

### Publishing fails for new npm packages

OIDC trusted publishing to npm requires two things: the package must already exist on npmjs.com, and your repository must be listed as a trusted publisher on that package. A first-time publish cannot satisfy either condition, so trusted publishing fails. When an `npm-token` is available, the action automatically retries the same tarball with classic token auth, so a first-time publish succeeds as long as you provide the token.

If a publish fails and you have not supplied an `npm-token`, provide one so the token-auth fallback can complete the publish:

```yaml
- uses: savvy-web/silk-release-action@v4
  with:
    app-client-id: ${{ vars.APP_CLIENT_ID }}
    app-private-key: ${{ secrets.APP_PRIVATE_KEY }}
    npm-token: ${{ secrets.NPM_TOKEN }}
```

After the first publish, configure OIDC trusted publishing on npmjs.com (Settings > Granular Access Tokens > Add a trusted publisher) and remove the `npm-token` input.

### Phase 1 fails with an unsupported changelog id

Phase 1 generates CHANGELOG entries with changelog modules bundled into the action, so the `changelog` id in `.changeset/config.json` must be one it recognizes: `@savvy-web/changelog`, `@savvy-web/silk/changesets/changelog`, `@savvy-web/changesets/changelog` or `@changesets/cli/changelog`. Any other id fails the phase with an error naming the supported ids. Point the `changelog` field at a supported id:

```json
{
  "changelog": "@changesets/cli/changelog"
}
```

See [Changelog configuration](./03-configuration.md#changelog-configuration) for the full mapping.

### Versioned files are not Biome-formatted

When the repository has a `biome.json(c)`, Phase 1 runs `biome format --write .` after applying versions. If the workflow logs show a formatting warning and the release branch contains unformatted files, either the standalone `biome` binary was not on `PATH` in the branch-management job or the Biome config could not resolve without `node_modules` (e.g. `extends: ["@savvy-web/silk/biome"]`). Both cases are warnings by design — versioning continues. To get formatted output, make the standalone Biome binary available on `PATH` in that job and ensure the config resolves without a dependency install. Any other formatting failure fails the phase; check the logs for the Biome error.

### Release branch has merge conflicts

When the action detects conflicts while updating the release branch, the `result` output's branch-management phase payload reports `releaseBranch.hasConflicts` as `true`. Resolve the conflicts manually:

```bash
git checkout changeset-release/main
git rebase main
# Resolve conflicts
git rebase --continue
git push --force-with-lease
```

### Auto-merge was not enabled on the release PR

The run logs `Could not enable auto-merge on PR #<n>` as a warning and continues, because the release itself succeeded. Two prerequisites sit outside the action: auto-merge has to be enabled on the repository (Settings > General > Pull Requests), and branch protection on the target branch has to define required status checks. Without required checks there is nothing for auto-merge to gate on, so GitHub rejects the request. Merge the PR by hand for this release, then fix the repository settings.

If the run failed outright instead, naming the value you passed, the `auto-merge` input was not one of `merge`, `squash` or `rebase`. A typo fails rather than quietly disabling — see [Auto-merge](./03-configuration.md#auto-merge).

### Warning: "Unexpected input(s) 'pr-title-prefix'" or "'skip-token-revoke'"

Both inputs were removed. The warning is GitHub's, comes from the workflow file, and breaks nothing — delete the lines.

Token revocation is now unconditional, so `skip-token-revoke` has no replacement. `pr-title-prefix` has none either: every release PR title is derived from the packages that will release, and the fallback for "nothing is releasing" is the literal `release: pending`.

### No phase detected (action does nothing)

The action uses context clues to determine which phase to run. If none match, it exits early. Check that:

- Your workflow triggers include both `main` and `changeset-release/main` branches
- The release PR was merged (not just closed) for Phase 3
- There are pending changeset files in `.changeset/` for Phase 1

You can also set the phase explicitly:

```yaml
- uses: savvy-web/silk-release-action@v4
  with:
    app-client-id: ${{ vars.APP_CLIENT_ID }}
    app-private-key: ${{ secrets.APP_PRIVATE_KEY }}
    phase: branch-management
```

The value must be one of `branch-management`, `validation`, `publishing`, `close-issues` or `none`. Anything else fails the run and names the accepted set. Earlier versions routed an unrecognised value to a no-op, so a typo skipped the entire release while the job stayed green.

### Token permission diagnostics

The action logs token permissions in the pre-action phase. Check the workflow logs for:

- Token type (Bot for GitHub Apps, User for PATs)
- App name and installation ID
- Available permissions

These logs help diagnose authentication issues across different registries.

### Build validation fails

Phase 2 runs the `ci:build` script with your detected package manager — `pnpm ci:build`, `npm run ci:build`, `bun run ci:build`. The script name is fixed and cannot be configured, so every validated workspace must expose a `ci:build` script. If validation fails:

1. Check the workflow logs for the specific build error
2. Fix the issue on the release branch or on `main` (the action will rebase on next push)
3. The validation check on the PR will update automatically

### Publish validation fails on an unpublishable artifact

Phase 2 dry-run packs each publishable package and refuses artifacts that would ship something broken rather than packing them silently. Any of the cases below records an `error` finding and fails the **Publish Validation** check, which blocks anything gated on check status — including auto-merge, whether it came from the `auto-merge` input or was turned on by hand. The remaining packages still validate and report. Fix the offending package, then push the release branch (or push to `main` and let the action rebase).

- **Unresolved `catalog:` or `workspace:` specifiers** — the built `package.json` still carries a `catalog:` or `workspace:` dependency range, which publishes a package that is uninstallable outside the workspace (`EUNSUPPORTEDPROTOCOL`). Your build step must rewrite these to concrete versions before the artifact is packed.
- **Zero-file tarball** — `npm pack` would produce an empty archive. Check the package's `files` field and confirm the build wrote output to the directory being packed.
- **Publish directory not bound by `dist/prod/targets.json`** — publishability detection selected a directory your production build does not declare, usually a dev build, so a non-release artifact was about to be packed. Run the package's production build so the release output exists at a declared target.

### Partial publish — one registry succeeded, another failed

If Phase 3 fails after publishing to some registries but before finishing all of them, the action stops before creating the GitHub Release. On re-run, it detects which registries already received the correct tarball and skips them with a `skipped-identical (recovery)` status, then continues with the remaining registries. No manual cleanup is required.

If you see a registry flagged as `skipped-identical (recovery)` on a fresh (non-retry) run, it means a previous run published that exact build. This is the expected behavior when re-triggering after a timeout or a transient network failure.
