# Troubleshooting

## Common issues

### "Installation not allowed to Create organization package"

The GitHub App needs the **Packages: Write** repository permission. Update the app's permissions in GitHub Settings > Developer Settings > GitHub Apps.

Alternatively, pass a `github-token` with `packages: write` permission:

```yaml
- uses: savvy-web/silk-release-action@main
  with:
    app-client-id: ${{ vars.APP_CLIENT_ID }}
    app-private-key: ${{ secrets.APP_PRIVATE_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### OIDC Publishing Fails for New Packages

OIDC trusted publishing to npm requires two things: the package must already exist on npmjs.com, and your repository must be listed as a trusted publisher on that package. Both conditions must be satisfied — a 404 from npm usually means the package has never been published; a 403 means the package exists but the repository is not trusted.

For first-time publishes, or when OIDC trusted publishing has not yet been configured on npmjs.com, provide an npm token:

```yaml
- uses: savvy-web/silk-release-action@main
  with:
    app-client-id: ${{ vars.APP_CLIENT_ID }}
    app-private-key: ${{ secrets.APP_PRIVATE_KEY }}
    npm-token: ${{ secrets.NPM_TOKEN }}
```

After the first publish, configure OIDC trusted publishing on npmjs.com (Settings > Granular Access Tokens > Add a trusted publisher) and remove the `npm-token` input.

### Release Branch Has Merge Conflicts

When the action detects conflicts while updating the release branch, the `result` output's branch-management phase payload reports `releaseBranch.hasConflicts` as `true`. Resolve the conflicts manually:

```bash
git checkout changeset-release/main
git rebase main
# Resolve conflicts
git rebase --continue
git push --force-with-lease
```

### No Phase Detected (Action Does Nothing)

The action uses context clues to determine which phase to run. If none match, it exits early. Check that:

- Your workflow triggers include both `main` and `changeset-release/main` branches
- The release PR was merged (not just closed) for Phase 3
- There are pending changeset files in `.changeset/` for Phase 1

You can also set the phase explicitly:

```yaml
- uses: savvy-web/silk-release-action@main
  with:
    app-client-id: ${{ vars.APP_CLIENT_ID }}
    app-private-key: ${{ secrets.APP_PRIVATE_KEY }}
    phase: branch-management
```

### Token Permission Diagnostics

The action logs token permissions in the pre-action phase. Check the workflow logs for:

- Token type (Bot for GitHub Apps, User for PATs)
- App name and installation ID
- Available permissions

These logs help diagnose authentication issues across different registries.

### Build Validation Fails

Phase 2 runs `pnpm build` (or your configured package manager's build command). If validation fails:

1. Check the workflow logs for the specific build error
2. Fix the issue on the release branch or on `main` (the action will rebase on next push)
3. The validation check on the PR will update automatically

### Partial Publish — One Registry Succeeded, Another Failed

If Phase 3 fails after publishing to some registries but before finishing all of them, the action stops before creating the GitHub Release. On re-run, it detects which registries already received the correct tarball and skips them with a `skipped-identical (recovery)` status, then continues with the remaining registries. No manual cleanup is required.

If you see a registry flagged as `skipped-identical (recovery)` on a fresh (non-retry) run, it means a previous run published that exact build. This is the expected behavior when re-triggering after a timeout or a transient network failure.

### Changeset Version Command Fails

The default version command is `{package-manager} ci:version`. If your project uses a different script, set the `version-command` input:

```yaml
- uses: savvy-web/silk-release-action@main
  with:
    app-client-id: ${{ vars.APP_CLIENT_ID }}
    app-private-key: ${{ secrets.APP_PRIVATE_KEY }}
    version-command: "pnpm changeset version"
```
