export const __rspack_esm_id = 410;
export const __rspack_esm_ids = [410];
export const __webpack_modules__ = {
80793(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.d(__webpack_exports__, {
  detectReleasedPackagesFromCommit: () => (detectReleasedPackagesFromCommit),
  detectReleasedPackagesFromPR: () => (detectReleasedPackagesFromPR)
});
/* import */ var node_fs__rspack_import_0 = __webpack_require__(73024);
/* import */ var node_fs__rspack_import_0_default = /*#__PURE__*/__webpack_require__.n(node_fs__rspack_import_0);
/* import */ var node_path__rspack_import_1 = __webpack_require__(76760);
/* import */ var node_path__rspack_import_1_default = /*#__PURE__*/__webpack_require__.n(node_path__rspack_import_1);
/* import */ var _actions_compat_js__rspack_import_2 = __webpack_require__(77279);



/**
 * Infer bump type from version change
 *
 * @param oldVersion - Previous version
 * @param newVersion - New version
 * @returns Bump type
 */ function inferBumpType(oldVersion, newVersion) {
    const oldParts = oldVersion.split(".").map(Number);
    const newParts = newVersion.split(".").map(Number);
    if (oldParts.length < 3 || newParts.length < 3) {
        return "unknown";
    }
    // Handle prerelease versions by stripping the prerelease suffix
    const oldMajor = oldParts[0];
    const oldMinor = oldParts[1];
    const newMajor = newParts[0];
    const newMinor = newParts[1];
    if (newMajor > oldMajor) {
        return "major";
    }
    if (newMajor === oldMajor && newMinor > oldMinor) {
        return "minor";
    }
    return "patch";
}
/**
 * Detect packages that were released in a merge commit
 *
 * @remarks
 * This function is used in Phase 3 when changesets have already been consumed.
 * It works by:
 * 1. Getting the files changed in the merged PR
 * 2. Finding package.json files that were modified
 * 3. Comparing versions to detect which packages were bumped
 *
 * @param token - GitHub token
 * @param prNumber - The merged PR number
 * @returns Promise resolving to detected packages
 */ async function detectReleasedPackagesFromPR(token, prNumber) {
    const octokit = (0,_actions_compat_js__rspack_import_2/* .getOctokit */.QB)(token);
    const packages = [];
    try {
        (0,_actions_compat_js__rspack_import_2/* .info */.pq)(`Detecting released packages from PR #${prNumber}...`);
        // Get files changed in the PR
        const { data: files } = await octokit.rest.pulls.listFiles({
            owner: _actions_compat_js__rspack_import_2/* .context.repo.owner */._O.repo.owner,
            repo: _actions_compat_js__rspack_import_2/* .context.repo.repo */._O.repo.repo,
            pull_number: prNumber,
            per_page: 100
        });
        // Find package.json files that were modified
        const packageJsonFiles = files.filter((file)=>file.filename.endsWith("package.json") && (file.status === "modified" || file.status === "changed") && // Exclude root package.json for monorepos (usually not published)
            file.filename !== "package.json");
        (0,_actions_compat_js__rspack_import_2/* .info */.pq)(`Found ${packageJsonFiles.length} modified package.json file(s)`);
        // Also check root package.json for single-package repos
        const rootPackageJson = files.find((file)=>file.filename === "package.json" && file.status === "modified");
        if (rootPackageJson) {
            packageJsonFiles.unshift(rootPackageJson);
        }
        // For each modified package.json, get the old and new versions
        for (const file of packageJsonFiles){
            try {
                // Get the file content at the merge commit (current HEAD)
                const currentContent = (0,node_fs__rspack_import_0.readFileSync)((0,node_path__rspack_import_1.join)(process.cwd(), file.filename), "utf-8");
                const currentPkg = JSON.parse(currentContent);
                // Get the file content before the PR (from the base commit)
                const { data: prData } = await octokit.rest.pulls.get({
                    owner: _actions_compat_js__rspack_import_2/* .context.repo.owner */._O.repo.owner,
                    repo: _actions_compat_js__rspack_import_2/* .context.repo.repo */._O.repo.repo,
                    pull_number: prNumber
                });
                let oldVersion = "0.0.0";
                try {
                    const { data: oldContent } = await octokit.rest.repos.getContent({
                        owner: _actions_compat_js__rspack_import_2/* .context.repo.owner */._O.repo.owner,
                        repo: _actions_compat_js__rspack_import_2/* .context.repo.repo */._O.repo.repo,
                        path: file.filename,
                        ref: prData.base.sha
                    });
                    if ("content" in oldContent && oldContent.content) {
                        const decodedContent = Buffer.from(oldContent.content, "base64").toString("utf-8");
                        const oldPkg = JSON.parse(decodedContent);
                        oldVersion = oldPkg.version || "0.0.0";
                    }
                } catch  {
                    // File might not exist in base (new package)
                    (0,_actions_compat_js__rspack_import_2/* .debug */.Yz)(`Could not get old version for ${file.filename}, assuming new package`);
                }
                const newVersion = currentPkg.version || "0.0.0";
                // Only include if version actually changed
                if (oldVersion !== newVersion) {
                    const bumpType = inferBumpType(oldVersion, newVersion);
                    const packageDir = (0,node_path__rspack_import_1.dirname)(file.filename);
                    packages.push({
                        name: currentPkg.name || packageDir,
                        version: newVersion,
                        path: packageDir === "." ? process.cwd() : (0,node_path__rspack_import_1.join)(process.cwd(), packageDir),
                        bumpType
                    });
                    (0,_actions_compat_js__rspack_import_2/* .info */.pq)(`  ${currentPkg.name}: ${oldVersion} → ${newVersion} (${bumpType})`);
                }
            } catch (err) {
                (0,_actions_compat_js__rspack_import_2/* .warning */.$e)(`Failed to process ${file.filename}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        (0,_actions_compat_js__rspack_import_2/* .info */.pq)(`Detected ${packages.length} released package(s)`);
        return {
            success: true,
            packages
        };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        (0,_actions_compat_js__rspack_import_2/* .error */.z3)(`Failed to detect released packages: ${errorMessage}`);
        return {
            success: false,
            packages: [],
            error: errorMessage
        };
    }
}
/**
 * Detect packages that were released by comparing HEAD with its first parent
 *
 * @remarks
 * Alternative detection method that works without needing the PR number.
 * Uses git to compare package.json files between HEAD and HEAD^1.
 *
 * @param token - GitHub token
 * @returns Promise resolving to detected packages
 */ async function detectReleasedPackagesFromCommit(token) {
    const octokit = (0,_actions_compat_js__rspack_import_2/* .getOctokit */.QB)(token);
    const packages = [];
    try {
        (0,_actions_compat_js__rspack_import_2/* .info */.pq)("Detecting released packages from merge commit...");
        // Get the commit to find parent SHAs
        const { data: commit } = await octokit.rest.repos.getCommit({
            owner: _actions_compat_js__rspack_import_2/* .context.repo.owner */._O.repo.owner,
            repo: _actions_compat_js__rspack_import_2/* .context.repo.repo */._O.repo.repo,
            ref: _actions_compat_js__rspack_import_2/* .context.sha */._O.sha
        });
        if (!commit.parents || commit.parents.length === 0) {
            return {
                success: false,
                packages: [],
                error: "No parent commits found"
            };
        }
        const baseSha = commit.parents[0].sha;
        (0,_actions_compat_js__rspack_import_2/* .info */.pq)(`Comparing ${_actions_compat_js__rspack_import_2/* .context.sha.substring */._O.sha.substring(0, 8)} with parent ${baseSha.substring(0, 8)}`);
        // Compare the commits to get changed files
        const { data: comparison } = await octokit.rest.repos.compareCommits({
            owner: _actions_compat_js__rspack_import_2/* .context.repo.owner */._O.repo.owner,
            repo: _actions_compat_js__rspack_import_2/* .context.repo.repo */._O.repo.repo,
            base: baseSha,
            head: _actions_compat_js__rspack_import_2/* .context.sha */._O.sha
        });
        // Find package.json files that were modified
        const packageJsonFiles = comparison.files?.filter((file)=>file.filename.endsWith("package.json") && (file.status === "modified" || file.status === "changed")) || [];
        (0,_actions_compat_js__rspack_import_2/* .info */.pq)(`Found ${packageJsonFiles.length} modified package.json file(s)`);
        // For each modified package.json, get the old and new versions
        for (const file of packageJsonFiles){
            try {
                // Get current content from the filesystem
                const fullPath = (0,node_path__rspack_import_1.join)(process.cwd(), file.filename);
                if (!(0,node_fs__rspack_import_0.existsSync)(fullPath)) {
                    (0,_actions_compat_js__rspack_import_2/* .debug */.Yz)(`File not found: ${fullPath}`);
                    continue;
                }
                const currentContent = (0,node_fs__rspack_import_0.readFileSync)(fullPath, "utf-8");
                const currentPkg = JSON.parse(currentContent);
                // Get old version from base commit
                let oldVersion = "0.0.0";
                try {
                    const { data: oldContent } = await octokit.rest.repos.getContent({
                        owner: _actions_compat_js__rspack_import_2/* .context.repo.owner */._O.repo.owner,
                        repo: _actions_compat_js__rspack_import_2/* .context.repo.repo */._O.repo.repo,
                        path: file.filename,
                        ref: baseSha
                    });
                    if ("content" in oldContent && oldContent.content) {
                        const decodedContent = Buffer.from(oldContent.content, "base64").toString("utf-8");
                        const oldPkg = JSON.parse(decodedContent);
                        oldVersion = oldPkg.version || "0.0.0";
                    }
                } catch  {
                    (0,_actions_compat_js__rspack_import_2/* .debug */.Yz)(`Could not get old version for ${file.filename}`);
                }
                const newVersion = currentPkg.version || "0.0.0";
                // Only include if version actually changed
                if (oldVersion !== newVersion) {
                    const bumpType = inferBumpType(oldVersion, newVersion);
                    const packageDir = (0,node_path__rspack_import_1.dirname)(file.filename);
                    packages.push({
                        name: currentPkg.name || packageDir,
                        version: newVersion,
                        path: packageDir === "." ? process.cwd() : (0,node_path__rspack_import_1.join)(process.cwd(), packageDir),
                        bumpType
                    });
                    (0,_actions_compat_js__rspack_import_2/* .info */.pq)(`  ${currentPkg.name}: ${oldVersion} → ${newVersion} (${bumpType})`);
                }
            } catch (err) {
                (0,_actions_compat_js__rspack_import_2/* .warning */.$e)(`Failed to process ${file.filename}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        (0,_actions_compat_js__rspack_import_2/* .info */.pq)(`Detected ${packages.length} released package(s)`);
        return {
            success: true,
            packages
        };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        (0,_actions_compat_js__rspack_import_2/* .error */.z3)(`Failed to detect released packages: ${errorMessage}`);
        return {
            success: false,
            packages: [],
            error: errorMessage
        };
    }
}


},

};
