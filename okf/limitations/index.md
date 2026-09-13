# Limitation

* [Check-run summary byte cap](check-summary-byte-cap.md) - A Phase-2 check-run summary over GitHub's 65535-byte limit is truncated on a byte budget, which is why per-package release notes are stripped from the structured output.
* [GitHub Packages needs the workflow's own token](github-packages-needs-workflow-token.md) - A GitHub Packages publish target with no github-token input fails by name, because a GitHub App installation token cannot authenticate to GitHub Packages at all.
