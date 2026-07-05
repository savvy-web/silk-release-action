# Troubleshooting

## Common issues

### "Installation not allowed to Create organization package"

The GitHub App needs the **Packages: Write** repository permission. Update the app's permissions in GitHub Settings > Developer Settings > GitHub Apps.

Alternatively, pass a `github-token` with `packages: write` permission:

```yaml
- uses: savvy-web/silk-release-action@v3
  with:
    app-client-id: ${{ vars.APP_CLIENT_ID }}
    app-private-key: ${{ secrets.APP_PRIVATE_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Publishing fails for new npm packages

OIDC trusted publishing to npm requires two things: the package must already exist on npmjs.com, and your repository must be listed as a trusted publisher on that package. A first-time publish cannot satisfy either condition, so trusted publishing fails. When an `npm-token` is available, the action automatically retries the same tarball with classic token auth, so a first-time publish succeeds as long as you provide the token.

If a publish fails and you have not supplied an `npm-token`, provide one so the token-auth fallback can complete the publish:

```yaml
- uses: savvy-web/silk-release-action@v3
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

### No phase detected (action does nothing)

The action uses context clues to determine which phase to run. If none match, it exits early. Check that:

- Your workflow triggers include both `main` and `changeset-release/main` branches
- The release PR was merged (not just closed) for Phase 3
- There are pending changeset files in `.changeset/` for Phase 1

You can also set the phase explicitly:

```yaml
- uses: savvy-web/silk-release-action@v3
  with:
    app-client-id: ${{ vars.APP_CLIENT_ID }}
    app-private-key: ${{ secrets.APP_PRIVATE_KEY }}
    phase: branch-management
```

### Token permission diagnostics

The action logs token permissions in the pre-action phase. Check the workflow logs for:

- Token type (Bot for GitHub Apps, User for PATs)
- App name and installation ID
- Available permissions

These logs help diagnose authentication issues across different registries.

### Build validation fails

Phase 2 runs `pnpm build` (or your configured package manager's build command). If validation fails:

1. Check the workflow logs for the specific build error
2. Fix the issue on the release branch or on `main` (the action will rebase on next push)
3. The validation check on the PR will update automatically

### Partial publish — one registry succeeded, another failed

If Phase 3 fails after publishing to some registries but before finishing all of them, the action stops before creating the GitHub Release. On re-run, it detects which registries already received the correct tarball and skips them with a `skipped-identical (recovery)` status, then continues with the remaining registries. No manual cleanup is required.

If you see a registry flagged as `skipped-identical (recovery)` on a fresh (non-retry) run, it means a previous run published that exact build. This is the expected behavior when re-triggering after a timeout or a transient network failure.
