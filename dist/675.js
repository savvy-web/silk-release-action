export const __rspack_esm_id = 675;
export const __rspack_esm_ids = [675];
export const __webpack_modules__ = {
61700(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.d(__webpack_exports__, {
  di: () => (findPackagePath)
});
/* import */ var node_path__rspack_import_0 = __webpack_require__(76760);
/* import */ var node_path__rspack_import_0_default = /*#__PURE__*/__webpack_require__.n(node_path__rspack_import_0);
/* import */ var workspaces_effect__rspack_import_1 = __webpack_require__(31947);
/* import */ var _actions_compat_js__rspack_import_2 = __webpack_require__(77279);



/**
 * Cached workspace info to avoid repeated filesystem operations
 */ let cachedWorkspaces = null;
/**
 * Gets all workspace packages mapped by name to path
 *
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns Map of package name to package path
 */ function getWorkspaceMap(cwd = process.cwd()) {
    if (cachedWorkspaces) {
        return cachedWorkspaces;
    }
    cachedWorkspaces = new Map();
    const root = (0,workspaces_effect__rspack_import_1/* .findWorkspaceRootSync */.sn)(cwd);
    if (!root) {
        (0,_actions_compat_js__rspack_import_2/* .info */.pq)("No workspace root detected from cwd; package map will be empty");
        return cachedWorkspaces;
    }
    const packages = (0,workspaces_effect__rspack_import_1/* .getWorkspacePackagesSync */.we)(root);
    for (const pkg of packages){
        cachedWorkspaces.set(pkg.name, pkg.path);
        (0,_actions_compat_js__rspack_import_2/* .debug */.Yz)(`Found workspace: ${pkg.name} at ${pkg.path}`);
    }
    (0,_actions_compat_js__rspack_import_2/* .info */.pq)(`Found ${cachedWorkspaces.size} workspace package(s)`);
    return cachedWorkspaces;
}
/**
 * Clears the workspace cache (useful for testing)
 */ function clearWorkspaceCache() {
    cachedWorkspaces = null;
}
/**
 * Finds the file system path for a package
 *
 * @param packageName - Package name to find
 * @param publishSubdir - Subdirectory containing publishable files (e.g., "dist/npm")
 * @returns Package path or null if not found
 *
 * @remarks
 * Uses `workspaces-effect` to find package paths from the workspace
 * configuration. This handles cases where directory names don't match
 * package names (e.g., `@savvy-web/dependency-package` in directory
 * `dependency`).
 *
 * If `publishSubdir` is provided, it is appended to the package path to
 * locate the directory containing the publishable package.
 */ function findPackagePath(packageName, publishSubdir) {
    const workspaceMap = getWorkspaceMap();
    const packagePath = workspaceMap.get(packageName);
    if (!packagePath) {
        (0,_actions_compat_js__rspack_import_2/* .warning */.$e)(`Could not find workspace path for package: ${packageName}`);
        return null;
    }
    // If a publish subdirectory is specified, append it to the path
    if (publishSubdir) {
        const publishPath = (0,node_path__rspack_import_0.join)(packagePath, publishSubdir);
        (0,_actions_compat_js__rspack_import_2/* .debug */.Yz)(`Package ${packageName} publish path: ${publishPath}`);
        return publishPath;
    }
    (0,_actions_compat_js__rspack_import_2/* .debug */.Yz)(`Found package ${packageName} at: ${packagePath}`);
    return packagePath;
}
/**
 * Finds the publishable directory for a package
 *
 * @param packageName - Package name to find
 * @returns Path to the dist/npm directory for publishing, or null if not found
 *
 * @remarks
 * Returns the path to the package's dist/npm directory, which is where
 * built packages are located for publishing.
 */ function findPublishablePath(packageName) {
    return findPackagePath(packageName, "dist/npm");
}


},
19494(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.d(__webpack_exports__, {
  generateReleaseNotesPreview: () => (generateReleaseNotesPreview)
});
/* import */ var node_fs__rspack_import_0 = __webpack_require__(73024);
/* import */ var node_fs__rspack_import_0_default = /*#__PURE__*/__webpack_require__.n(node_fs__rspack_import_0);
/* import */ var node_path__rspack_import_1 = __webpack_require__(76760);
/* import */ var node_path__rspack_import_1_default = /*#__PURE__*/__webpack_require__.n(node_path__rspack_import_1);
/* import */ var _actions_compat_js__rspack_import_2 = __webpack_require__(77279);
/* import */ var _find_package_path_js__rspack_import_3 = __webpack_require__(61700);
/* import */ var _get_changeset_status_js__rspack_import_4 = __webpack_require__(99522);
/* import */ var _release_summary_helpers_js__rspack_import_5 = __webpack_require__(26950);
/* import */ var _resolve_targets_js__rspack_import_6 = __webpack_require__(26741);
/* import */ var _summary_writer_js__rspack_import_7 = __webpack_require__(42264);








/**
 * Generate a GitHub link for a package path
 *
 * @param packagePath - Absolute path to the package
 * @returns Markdown link to the package in GitHub
 */ function getPackageGitHubLink(packagePath, packageName) {
    if (!packagePath) return packageName;
    const cwd = process.cwd();
    const relativePath = packagePath.startsWith(cwd) ? packagePath.slice(cwd.length + 1) : packagePath;
    // Use context.ref which could be refs/heads/branch-name or refs/pull/123/merge
    const ref = _actions_compat_js__rspack_import_2/* .context.ref.replace */._O.ref.replace("refs/heads/", "").replace("refs/pull/", "pull/").replace("/merge", "");
    const url = `https://github.com/${_actions_compat_js__rspack_import_2/* .context.repo.owner */._O.repo.owner}/${_actions_compat_js__rspack_import_2/* .context.repo.repo */._O.repo.repo}/tree/${ref}/${relativePath}`;
    return `[${packageName}](${url})`;
}
/**
 * Escapes all regex metacharacters in a string
 *
 * @param str - String to escape
 * @returns Escaped string safe for use in RegExp
 */ function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
 * Extracts version section from CHANGELOG
 *
 * @param changelogContent - CHANGELOG.md content
 * @param version - Version to extract
 * @returns Extracted release notes or error message
 */ function extractVersionSection(changelogContent, version) {
    // Match version headings in various formats:
    // ## [1.0.0] - 2024-01-01
    // ## 1.0.0
    // # [1.0.0]
    // ### 1.0.0 (2024-01-01)
    const versionPattern = new RegExp(`^#+\\s+\\[?${escapeRegex(version)}\\]?.*$`, "im");
    const match = changelogContent.match(versionPattern);
    if (!match || match.index === undefined) {
        return "Could not find version section in CHANGELOG";
    }
    const startIndex = match.index;
    const lines = changelogContent.slice(startIndex).split("\n");
    // Find the end of this version section (next heading of same or higher level)
    /* v8 ignore next -- @preserve - Defensive: regex match always succeeds since we already matched heading pattern */ const headingLevel = (match[0].match(/^#+/) || [
        "##"
    ])[0].length;
    const endPattern = new RegExp(`^#{1,${headingLevel}}\\s+`);
    let endIndex = lines.length;
    for(let i = 1; i < lines.length; i++){
        if (endPattern.test(lines[i])) {
            endIndex = i;
            break;
        }
    }
    // Extract and clean up the section
    const section = lines.slice(0, endIndex).join("\n").trim();
    // Remove the heading itself to just return the content
    const contentLines = section.split("\n").slice(1);
    return contentLines.join("\n").trim();
}
/**
 * Generate explanatory release notes for a group package with no direct changes
 *
 * @param packageName - Package name
 * @param groupType - Type of group (fixed or linked)
 * @param siblings - Sibling packages in the group
 * @param releases - All releases from changeset status
 * @returns Explanatory release notes markdown
 */ function generateGroupPackageNotes(packageName, groupType, siblings, releases) {
    // Find which siblings are actually being released
    const releasedSiblings = siblings.filter((sibling)=>releases.some((r)=>r.name === sibling));
    if (releasedSiblings.length === 0) {
        return `_This package has no direct changes but is being released due to ${groupType} versioning._`;
    }
    const siblingList = releasedSiblings.map((s)=>`\`${s}\``).join(", ");
    const groupDescription = groupType === "fixed" ? "fixed versioning" : "linked versioning";
    const allPackages = [
        `\`${packageName}\``,
        ...releasedSiblings.map((s)=>`\`${s}\``)
    ].join(", ");
    return `_This package has no direct changes but is being released because it shares ${groupDescription} with ${siblingList} which ${releasedSiblings.length > 1 ? "have" : "has"} changes._

This release maintains version alignment across the following packages: ${allPackages}.`;
}
/**
 * Generate registry table for a package
 *
 * @param validation - Package publish validation result
 * @returns Markdown table string
 */ function generateRegistryTable(validation) {
    if (validation.targets.length === 0) {
        return "_No publish targets configured_";
    }
    const rows = validation.targets.map((target)=>{
        const registry = (0,_resolve_targets_js__rspack_import_6/* .getRegistryDisplayName */.DN)(target.target.registry);
        const dirName = target.target.directory.split("/").pop() || ".";
        const packed = target.stats?.packageSize || "—";
        const unpacked = target.stats?.unpackedSize || "—";
        const files = target.stats?.totalFiles?.toString() || "—";
        const access = target.target.access || "—";
        const provenance = target.target.provenance ? target.provenanceReady ? "✅" : "⚠️" : "🚫";
        return [
            registry,
            `\`${dirName}\``,
            packed,
            unpacked,
            files,
            access,
            provenance
        ];
    });
    return _summary_writer_js__rspack_import_7/* .summaryWriter.table */.u.table([
        "Registry",
        "Directory",
        "Packed",
        "Unpacked",
        "Files",
        "Access",
        "Provenance"
    ], rows);
}
/**
 * Generates release notes preview for all packages
 *
 * @param publishValidations - Optional publish validation results from dry-run
 * @returns Release notes preview result
 *
 * @remarks
 * Uses `workspaces-effect` to discover package paths from workspace
 * configuration. This handles cases where directory names don't match
 * package names.
 */ async function generateReleaseNotesPreview(packageManager, publishValidations) {
    // Read all inputs
    const targetBranch = (0,_actions_compat_js__rspack_import_2/* .getInput */.V4)("target-branch") || "main";
    const dryRun = (0,_actions_compat_js__rspack_import_2/* .getBooleanInput */.Vt)("dry-run") || false;
    (0,_actions_compat_js__rspack_import_2/* .startGroup */.Oh)("Generating release notes preview");
    // Read changeset config to detect fixed/linked groups
    const changesetConfig = (0,_release_summary_helpers_js__rspack_import_5/* .readChangesetConfig */.fz)();
    if (changesetConfig?.fixed && changesetConfig.fixed.length > 0) {
        (0,_actions_compat_js__rspack_import_2/* .debug */.Yz)(`Found ${changesetConfig.fixed.length} fixed group(s) in changeset config`);
    }
    if (changesetConfig?.linked && changesetConfig.linked.length > 0) {
        (0,_actions_compat_js__rspack_import_2/* .debug */.Yz)(`Found ${changesetConfig.linked.length} linked group(s) in changeset config`);
    }
    // Get packages from changeset status (handles consumed changesets)
    const changesetStatus = await (0,_get_changeset_status_js__rspack_import_4.getChangesetStatus)(packageManager, targetBranch);
    (0,_actions_compat_js__rspack_import_2/* .info */.pq)(`Found ${changesetStatus.releases.length} package(s) to release`);
    // Get all workspace packages (including non-releasing)
    const allWorkspacePackages = (0,_release_summary_helpers_js__rspack_import_5/* .getAllWorkspacePackages */.Qu)();
    (0,_actions_compat_js__rspack_import_2/* .info */.pq)(`Found ${allWorkspacePackages.length} total package(s) in workspace`);
    // Count changesets per package
    const changesetCounts = (0,_release_summary_helpers_js__rspack_import_5/* .countChangesetsPerPackage */.yo)(changesetStatus.changesets);
    // Build a map of package name -> validation result
    const validationMap = new Map();
    if (publishValidations) {
        for (const validation of publishValidations){
            validationMap.set(validation.name, validation);
        }
    }
    // Build release info map
    const releaseMap = new Map();
    for (const release of changesetStatus.releases){
        releaseMap.set(release.name, release);
    }
    const packageNotes = [];
    // Process each releasing package
    for (const release of changesetStatus.releases){
        (0,_actions_compat_js__rspack_import_2/* .info */.pq)(`Processing ${release.name}@${release.newVersion}`);
        // Find package directory via workspaces-effect-backed lookup
        const packagePath = (0,_find_package_path_js__rspack_import_3/* .findPackagePath */.di)(release.name);
        if (!packagePath) {
            (0,_actions_compat_js__rspack_import_2/* .warning */.$e)(`Could not find package directory for ${release.name}`);
            packageNotes.push({
                name: release.name,
                oldVersion: release.oldVersion || "0.0.0",
                version: release.newVersion,
                type: release.type,
                path: "",
                hasChangelog: false,
                notes: "",
                error: "Package directory not found"
            });
            continue;
        }
        // Check for CHANGELOG.md
        const changelogPath = (0,node_path__rspack_import_1.join)(packagePath, "CHANGELOG.md");
        if (!(0,node_fs__rspack_import_0.existsSync)(changelogPath)) {
            (0,_actions_compat_js__rspack_import_2/* .warning */.$e)(`No CHANGELOG.md found for ${release.name}`);
            packageNotes.push({
                name: release.name,
                oldVersion: release.oldVersion || "0.0.0",
                version: release.newVersion,
                type: release.type,
                path: packagePath,
                hasChangelog: false,
                notes: "",
                error: "CHANGELOG.md not found"
            });
            continue;
        }
        // Read and extract version section
        try {
            const changelogContent = (0,node_fs__rspack_import_0.readFileSync)(changelogPath, "utf8");
            let notes = extractVersionSection(changelogContent, release.newVersion);
            let extractionError;
            if (notes.startsWith("Could not find")) {
                extractionError = notes;
                notes = "";
            }
            // Check if notes are empty and package might be in a group
            const hasNoNotes = !notes.trim();
            const group = (0,_release_summary_helpers_js__rspack_import_5/* .findPackageGroup */.$h)(release.name, changesetConfig);
            if (hasNoNotes && group.type !== "none" && group.siblings.length > 0) {
                // This is a group package with no direct changes
                const groupNotes = generateGroupPackageNotes(release.name, group.type, group.siblings, changesetStatus.releases);
                (0,_actions_compat_js__rspack_import_2/* .info */.pq)(`✓ Generated ${group.type}-version notes for ${release.name}@${release.newVersion}`);
                packageNotes.push({
                    name: release.name,
                    oldVersion: release.oldVersion || "0.0.0",
                    version: release.newVersion,
                    type: release.type,
                    path: packagePath,
                    hasChangelog: true,
                    notes: groupNotes
                });
            } else if (extractionError) {
                (0,_actions_compat_js__rspack_import_2/* .warning */.$e)(`Could not extract version ${release.newVersion} from ${release.name} CHANGELOG`);
                packageNotes.push({
                    name: release.name,
                    oldVersion: release.oldVersion || "0.0.0",
                    version: release.newVersion,
                    type: release.type,
                    path: packagePath,
                    hasChangelog: true,
                    notes: "",
                    error: extractionError
                });
            } else {
                (0,_actions_compat_js__rspack_import_2/* .info */.pq)(`✓ Extracted release notes for ${release.name}@${release.newVersion}`);
                packageNotes.push({
                    name: release.name,
                    oldVersion: release.oldVersion || "0.0.0",
                    version: release.newVersion,
                    type: release.type,
                    path: packagePath,
                    hasChangelog: true,
                    notes
                });
            }
        } catch (error) {
            /* v8 ignore next -- @preserve - Defensive: handles non-Error throws (extremely rare) */ const errorMsg = error instanceof Error ? error.message : String(error);
            (0,_actions_compat_js__rspack_import_2/* .warning */.$e)(`Failed to read CHANGELOG for ${release.name}: ${errorMsg}`);
            packageNotes.push({
                name: release.name,
                oldVersion: release.oldVersion || "0.0.0",
                version: release.newVersion,
                type: release.type,
                path: packagePath,
                hasChangelog: false,
                notes: "",
                error: errorMsg
            });
        }
    }
    (0,_actions_compat_js__rspack_import_2/* .endGroup */.N4)();
    // Build the enhanced summary
    const checkTitle = dryRun ? "📋 Release Notes Preview (Dry Run)" : "📋 Release Notes Preview";
    // Build job summary sections
    const jobSections = [
        {
            heading: checkTitle,
            content: ""
        }
    ];
    // Generate "Packages Releasing" summary table
    if (packageNotes.length > 0) {
        const summaryRows = packageNotes.map((pkg)=>{
            const group = (0,_release_summary_helpers_js__rspack_import_5/* .findPackageGroup */.$h)(pkg.name, changesetConfig);
            const validation = validationMap.get(pkg.name);
            const changesetCount = changesetCounts.get(pkg.name) || 0;
            const targetCount = validation?.targets.length || 0;
            const notesStatus = pkg.error ? "⚠️" : pkg.notes ? "✅" : "⚠️";
            return [
                getPackageGitHubLink(pkg.path, pkg.name),
                pkg.oldVersion,
                pkg.version,
                `${(0,_release_summary_helpers_js__rspack_import_5/* .getBumpTypeIcon */.kQ)(pkg.type)} ${pkg.type}`,
                (0,_release_summary_helpers_js__rspack_import_5/* .getGroupIcon */.PC)(group.type),
                targetCount.toString(),
                changesetCount.toString(),
                notesStatus
            ];
        });
        const summaryTable = _summary_writer_js__rspack_import_7/* .summaryWriter.table */.u.table([
            "Package",
            "Current",
            "Next",
            "Type",
            "Group",
            "Targets",
            "Changesets",
            "Notes"
        ], summaryRows);
        jobSections.push({
            heading: "Packages Releasing",
            level: 3,
            content: summaryTable
        });
    }
    // Generate "Packages Not Releasing" section
    const releasingNames = new Set(packageNotes.map((p)=>p.name));
    const notReleasingPackages = allWorkspacePackages.filter((pkg)=>!releasingNames.has(pkg.name));
    if (notReleasingPackages.length > 0) {
        const notReleasingRows = notReleasingPackages.map((pkg)=>{
            const skipReason = (0,_release_summary_helpers_js__rspack_import_5/* .getSkipReason */.QH)(pkg, false);
            return [
                getPackageGitHubLink(pkg.path, pkg.name),
                pkg.version,
                skipReason ? (0,_release_summary_helpers_js__rspack_import_5/* .formatSkipReason */.$x)(skipReason) : "🚫"
            ];
        });
        const notReleasingTable = _summary_writer_js__rspack_import_7/* .summaryWriter.table */.u.table([
            "Package",
            "Version",
            "Reason"
        ], notReleasingRows);
        jobSections.push({
            heading: "Packages Not Releasing",
            level: 3,
            content: notReleasingTable
        });
    }
    // Generate per-package sections with registry tables and release notes
    if (packageNotes.length > 0) {
        jobSections.push({
            content: "---"
        });
        for (const pkg of packageNotes){
            const validation = validationMap.get(pkg.name);
            const firstRelease = (0,_release_summary_helpers_js__rspack_import_5/* .isFirstRelease */.oK)(pkg.oldVersion);
            // Package header with version info
            let versionInfo = `**${pkg.oldVersion} → ${pkg.version}** (${pkg.type})`;
            if (firstRelease) {
                versionInfo += " — 🆕 First Release";
            }
            jobSections.push({
                heading: pkg.name,
                level: 3,
                content: versionInfo
            });
            // Registry table (if validation data available)
            if (validation && validation.targets.length > 0) {
                const registryTable = generateRegistryTable(validation);
                jobSections.push({
                    content: registryTable
                });
            }
            // Release notes
            if (pkg.error) {
                jobSections.push({
                    heading: "Release Notes",
                    level: 4,
                    content: `⚠️ **Error**: ${pkg.error}`
                });
            } else if (pkg.notes) {
                jobSections.push({
                    heading: "Release Notes",
                    level: 4,
                    content: pkg.notes
                });
            } else {
                jobSections.push({
                    heading: "Release Notes",
                    level: 4,
                    content: "_No release notes available_"
                });
            }
            jobSections.push({
                content: "---"
            });
        }
    }
    // Add legend
    jobSections.push({
        content: "**Legend:** 🔴 major | 🟡 minor | 🟢 patch | 🔒 fixed | 🔗 linked | 📦 standalone | 🆕 first release | ✅ ready | ⚠️ warning | 🚫 N/A"
    });
    const summaryContent = _summary_writer_js__rspack_import_7/* .summaryWriter.build */.u.build(jobSections);
    // Write job summary
    await _summary_writer_js__rspack_import_7/* .summaryWriter.write */.u.write(summaryContent);
    return {
        packages: packageNotes,
        summaryContent,
        checkTitle
    };
}


},
99522(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  getChangesetStatus: () => (getChangesetStatus)
});
/* import */ var node_fs__rspack_import_0 = __webpack_require__(73024);
/* import */ var node_fs__rspack_import_0_default = /*#__PURE__*/__webpack_require__.n(node_fs__rspack_import_0);
/* import */ var node_path__rspack_import_1 = __webpack_require__(76760);
/* import */ var node_path__rspack_import_1_default = /*#__PURE__*/__webpack_require__.n(node_path__rspack_import_1);
/* import */ var _actions_compat_js__rspack_import_2 = __webpack_require__(77279);



/**
 * Gets changeset status, handling the case where changesets have been consumed
 *
 * @remarks
 * On the release branch after `changeset version` has run, the changesets are
 * consumed (deleted). To get the release information, we need to:
 * 1. Find the merge base between HEAD and the target branch (main)
 * 2. Checkout that commit
 * 3. Run `changeset status --output=json`
 * 4. Checkout back to HEAD
 *
 * @param packageManager - Package manager to use (pnpm, yarn, npm)
 * @param targetBranch - Target branch to find merge base with (default: main)
 * @returns Changeset status with releases and changesets
 */ async function getChangesetStatus(packageManager, targetBranch = "main") {
    let stderrOutput = "";
    // Create a temp file for changeset output
    // Changeset's --output flag writes to a file relative to cwd
    // Use just a filename (no path) to avoid path resolution issues
    const tempFileName = `.changeset-status-${Date.now()}.json`;
    const tempFile = (0,node_path__rspack_import_1.join)(process.cwd(), tempFileName);
    const statusCmd = packageManager === "pnpm" ? "pnpm" : packageManager === "yarn" ? "yarn" : packageManager === "bun" ? "bun" : "npm";
    const statusArgs = packageManager === "pnpm" ? [
        "changeset",
        "status",
        `--output=${tempFileName}`
    ] : packageManager === "yarn" ? [
        "changeset",
        "status",
        `--output=${tempFileName}`
    ] : packageManager === "bun" ? [
        "x",
        "changeset",
        "status",
        `--output=${tempFileName}`
    ] : [
        "run",
        "changeset",
        "status",
        "--",
        `--output=${tempFileName}`
    ];
    const exitCode = await (0,_actions_compat_js__rspack_import_2/* .exec */.m0)(statusCmd, statusArgs, {
        listeners: {
            stderr: (data)=>{
                stderrOutput += data.toString();
                (0,_actions_compat_js__rspack_import_2/* .debug */.Yz)(`changeset status stderr: ${data.toString()}`);
            }
        },
        ignoreReturnCode: true
    });
    // Try to read the output file if it exists
    let output = "";
    try {
        if ((0,node_fs__rspack_import_0.existsSync)(tempFile)) {
            output = (0,node_fs__rspack_import_0.readFileSync)(tempFile, "utf8");
            (0,node_fs__rspack_import_0.unlinkSync)(tempFile); // Clean up
        }
    } catch (err) {
        (0,_actions_compat_js__rspack_import_2/* .debug */.Yz)(`Failed to read changeset output file: ${err instanceof Error ? err.message : String(err)}`);
    }
    // If successful and has output, parse and return
    if (exitCode === 0 && output.trim()) {
        return JSON.parse(output.trim());
    }
    // Handle case where changesets have already been consumed (versioned)
    // This happens on the release branch after `changeset version` has run
    const noChangesetsError = stderrOutput.includes("no changesets were found") || stderrOutput.includes("No changesets present");
    if (noChangesetsError || exitCode === 0 && !output.trim()) {
        (0,_actions_compat_js__rspack_import_2/* .info */.pq)("Changesets have been consumed, checking merge base for release info...");
        // Try to get release info from merge base
        const result = await getChangesetStatusFromMergeBase(packageManager, targetBranch);
        if (result) {
            return result;
        }
        // If we can't get merge base info, return empty
        (0,_actions_compat_js__rspack_import_2/* .info */.pq)("Could not determine releases from merge base, returning empty");
        return {
            releases: [],
            changesets: []
        };
    }
    // For other errors, throw to surface the issue
    throw new Error(`changeset status failed with exit code ${exitCode}: ${stderrOutput}`);
}
/**
 * Gets changeset status by checking out the merge base
 *
 * @param packageManager - Package manager to use
 * @param targetBranch - Target branch to find merge base with
 * @returns Changeset status or null if unable to retrieve
 */ async function getChangesetStatusFromMergeBase(packageManager, targetBranch) {
    // Store current HEAD for restoration
    let currentHead = "";
    try {
        let headOutput = "";
        await (0,_actions_compat_js__rspack_import_2/* .exec */.m0)("git", [
            "rev-parse",
            "HEAD"
        ], {
            listeners: {
                stdout: (data)=>{
                    headOutput += data.toString();
                }
            }
        });
        currentHead = headOutput.trim();
    } catch (err) {
        (0,_actions_compat_js__rspack_import_2/* .warning */.$e)(`Failed to get current HEAD: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
    // Find merge base
    let mergeBase = "";
    try {
        let mergeBaseOutput = "";
        await (0,_actions_compat_js__rspack_import_2/* .exec */.m0)("git", [
            "merge-base",
            "HEAD",
            targetBranch
        ], {
            listeners: {
                stdout: (data)=>{
                    mergeBaseOutput += data.toString();
                }
            }
        });
        mergeBase = mergeBaseOutput.trim();
        (0,_actions_compat_js__rspack_import_2/* .info */.pq)(`Found merge base: ${mergeBase.substring(0, 8)}`);
    } catch (err) {
        (0,_actions_compat_js__rspack_import_2/* .warning */.$e)(`Failed to find merge base: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
    // Checkout merge base
    // Use --force because the working tree may have modifications from pnpm install
    // or other CI setup steps that would block a normal checkout. This is safe because
    // we always restore to the original HEAD afterward.
    try {
        (0,_actions_compat_js__rspack_import_2/* .info */.pq)(`Checking out merge base ${mergeBase.substring(0, 8)} to get changeset status...`);
        await (0,_actions_compat_js__rspack_import_2/* .exec */.m0)("git", [
            "checkout",
            "--force",
            mergeBase
        ]);
    } catch (err) {
        (0,_actions_compat_js__rspack_import_2/* .warning */.$e)(`Failed to checkout merge base: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
    // Get changeset status at merge base using temp file
    // Changeset writes output relative to cwd, so use just filename for --output
    // but full path for fs operations
    let result = null;
    const tempFileName = `.changeset-mergebase-${Date.now()}.json`;
    const tempFile = (0,node_path__rspack_import_1.join)(process.cwd(), tempFileName);
    try {
        const statusCmd = packageManager === "pnpm" ? "pnpm" : packageManager === "yarn" ? "yarn" : packageManager === "bun" ? "bun" : "npm";
        const statusArgs = packageManager === "pnpm" ? [
            "changeset",
            "status",
            `--output=${tempFileName}`
        ] : packageManager === "yarn" ? [
            "changeset",
            "status",
            `--output=${tempFileName}`
        ] : packageManager === "bun" ? [
            "x",
            "changeset",
            "status",
            `--output=${tempFileName}`
        ] : [
            "run",
            "changeset",
            "status",
            "--",
            `--output=${tempFileName}`
        ];
        const exitCode = await (0,_actions_compat_js__rspack_import_2/* .exec */.m0)(statusCmd, statusArgs, {
            ignoreReturnCode: true
        });
        // Read output from temp file
        if (exitCode === 0 && (0,node_fs__rspack_import_0.existsSync)(tempFile)) {
            const output = (0,node_fs__rspack_import_0.readFileSync)(tempFile, "utf8");
            if (output.trim()) {
                result = JSON.parse(output.trim());
                (0,_actions_compat_js__rspack_import_2/* .info */.pq)(`Found ${result.releases.length} package(s) to release from merge base`);
            }
        }
    } catch (err) {
        (0,_actions_compat_js__rspack_import_2/* .warning */.$e)(`Failed to get changeset status at merge base: ${err instanceof Error ? err.message : String(err)}`);
    } finally{
        // Clean up temp file
        try {
            if ((0,node_fs__rspack_import_0.existsSync)(tempFile)) {
                (0,node_fs__rspack_import_0.unlinkSync)(tempFile);
            }
        } catch  {
        // Ignore cleanup errors
        }
    }
    // Always restore to original HEAD
    // Use --force to match the checkout above — ensures clean restoration
    try {
        (0,_actions_compat_js__rspack_import_2/* .info */.pq)(`Restoring to HEAD ${currentHead.substring(0, 8)}...`);
        await (0,_actions_compat_js__rspack_import_2/* .exec */.m0)("git", [
            "checkout",
            "--force",
            currentHead
        ]);
    } catch (err) {
        (0,_actions_compat_js__rspack_import_2/* .warning */.$e)(`Failed to restore HEAD: ${err instanceof Error ? err.message : String(err)}`);
        // This is critical - try harder to restore
        try {
            await (0,_actions_compat_js__rspack_import_2/* .exec */.m0)("git", [
                "checkout",
                "--force",
                "-"
            ]);
        } catch  {
            (0,_actions_compat_js__rspack_import_2/* .warning */.$e)("Could not restore git state - manual intervention may be required");
        }
    }
    return result;
}


},
36679(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.d(__webpack_exports__, {
  DN: () => (getRegistryDisplayName),
  HJ: () => (isNpmRegistry),
  sh: () => (generatePackageViewUrl),
  yQ: () => (isGitHubPackagesRegistry)
});
/**
 * Registry detection and display utilities
 *
 * @remarks
 * This module provides URL-safe registry detection that properly parses URLs
 * before checking hostnames. Using substring matching on URLs is a security
 * issue (CWE-20) as it can be bypassed with malicious URLs like:
 * - `http://evil-npmjs.org` (prefix)
 * - `http://npmjs.org.evil.com` (suffix)
 * - `http://evil.com/npmjs.org` (path component)
 *
 * All functions in this module parse URLs and check the hostname properly.
 */ /** Known registry types */ /**
 * Parse a URL and extract the hostname safely
 *
 * @param url - URL string to parse
 * @returns Lowercase hostname or null if invalid
 */ function getHostname(url) {
    if (!url) return null;
    try {
        return new URL(url).hostname.toLowerCase();
    } catch  {
        return null;
    }
}
/**
 * Check if a hostname matches a known registry domain
 *
 * @remarks
 * Uses exact match or subdomain match to ensure security:
 * - `registry.npmjs.org` matches `npmjs.org`
 * - `npm.pkg.github.com` matches `pkg.github.com`
 * - `evil-npmjs.org` does NOT match `npmjs.org`
 *
 * @param hostname - Parsed hostname to check
 * @param domain - Domain to match against (e.g., "npmjs.org")
 * @returns true if hostname matches the domain
 */ function matchesDomain(hostname, domain) {
    if (!hostname) return false;
    const normalizedDomain = domain.toLowerCase();
    // Exact match or subdomain match (hostname ends with .domain)
    return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
}
/**
 * Check if a registry URL is the npm public registry
 *
 * @param registry - Registry URL to check
 * @returns true if this is the npm public registry (registry.npmjs.org or subdomain)
 */ function isNpmRegistry(registry) {
    return matchesDomain(getHostname(registry), "npmjs.org");
}
/**
 * Check if a registry URL is GitHub Packages
 *
 * @param registry - Registry URL to check
 * @returns true if this is GitHub Packages (npm.pkg.github.com or subdomain)
 */ function isGitHubPackagesRegistry(registry) {
    return matchesDomain(getHostname(registry), "pkg.github.com");
}
/**
 * Check if a registry URL is JSR
 *
 * @param registry - Registry URL to check
 * @returns true if this is JSR (jsr.io or subdomain)
 */ function isJsrRegistry(registry) {
    return matchesDomain(getHostname(registry), "jsr.io");
}
/**
 * Check if a registry URL is a custom (non-standard) registry
 *
 * @param registry - Registry URL to check
 * @returns true if this is not npm, GitHub Packages, or JSR
 */ function isCustomRegistry(registry) {
    if (!registry) return false;
    return !isNpmRegistry(registry) && !isGitHubPackagesRegistry(registry) && !isJsrRegistry(registry);
}
/**
 * Detect the type of a registry from its URL
 *
 * @param registry - Registry URL to check
 * @returns The registry type
 */ function getRegistryType(registry) {
    if (isNpmRegistry(registry)) return "npm";
    if (isGitHubPackagesRegistry(registry)) return "github-packages";
    if (isJsrRegistry(registry)) return "jsr";
    return "custom";
}
/**
 * Get a human-readable display name for a registry URL
 *
 * @param registry - Registry URL to convert to display name
 * @returns Human-readable registry name (e.g., "npm", "GitHub Packages", or hostname)
 */ function getRegistryDisplayName(registry) {
    if (!registry) return "jsr.io";
    if (isNpmRegistry(registry)) return "npm";
    if (isGitHubPackagesRegistry(registry)) return "GitHub Packages";
    if (isJsrRegistry(registry)) return "jsr.io";
    // For custom registries, return the hostname
    const hostname = getHostname(registry);
    return hostname || registry;
}
/**
 * Generate a URL to view the published package on its registry
 *
 * @param registry - Registry URL
 * @param packageName - Name of the package (including scope if any)
 * @returns URL to view the package, or undefined if not supported
 */ function generatePackageViewUrl(registry, packageName) {
    if (!packageName || !registry) return undefined;
    if (isNpmRegistry(registry)) {
        return `https://www.npmjs.com/package/${packageName}`;
    }
    if (isGitHubPackagesRegistry(registry)) {
        // GitHub Packages URL format: github.com/{owner}/packages
        const scope = packageName.startsWith("@") ? packageName.split("/")[0].slice(1) : undefined;
        return scope ? `https://github.com/${scope}/packages` : undefined;
    }
    // Custom registries have no standard URL format
    return undefined;
}


},
26950(__unused_rspack_module, __webpack_exports__, __webpack_require__) {

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  yo: () => (/* binding */ countChangesetsPerPackage),
  $h: () => (/* binding */ findPackageGroup),
  $x: () => (/* binding */ formatSkipReason),
  Qu: () => (/* binding */ getAllWorkspacePackages),
  kQ: () => (/* binding */ getBumpTypeIcon),
  PC: () => (/* binding */ getGroupIcon),
  QH: () => (/* binding */ getSkipReason),
  oK: () => (/* binding */ isFirstRelease),
  fz: () => (/* binding */ readChangesetConfig)
});

// EXTERNAL MODULE: external "node:fs"
var external_node_fs_ = __webpack_require__(73024);
// EXTERNAL MODULE: external "node:path"
var external_node_path_ = __webpack_require__(76760);
// EXTERNAL MODULE: ./node_modules/.pnpm/workspaces-effect@1.0.0_@effect+platform@0.96.1_effect@3.21.2__effect@3.21.2/node_modules/workspaces-effect/index.js + 8 modules
var workspaces_effect = __webpack_require__(31947);
// EXTERNAL MODULE: ./src/utils/_actions-compat.ts
var _actions_compat = __webpack_require__(77279);
;// CONCATENATED MODULE: ./src/utils/silk-publishability.ts
/**
 * Silk-flavored publishability rules.
 *
 * @remarks
 * The vanilla `PublishabilityDetectorLive` from `workspaces-effect` treats
 * `package.json#private: true` as "not publishable" full stop. The silk-suite
 * convention extends that:
 *
 * 1. A private package whose `publishConfig.access` is set is still
 *    publishable to one target.
 * 2. A private package with `publishConfig.targets` (an array of target
 *    specs) is publishable to one or more targets — string targets inherit
 *    parent access, object targets may override.
 * 3. Shorthand target names (e.g., `"npm"` / `"github"` / `"jsr"`) are
 *    accepted as string-form targets; the consumer maps shorthand to a
 *    registry URL at publish time.
 *
 * This mirrors the canonical implementation at
 * `pnpm-config-dependency-action/src/services/publishability.ts` so that the
 * workflow-release-action agrees with the dependency-update action about
 * which packages count as publishable.
 */ 
const DEFAULT_REGISTRY = "https://registry.npmjs.org/";
function resolveTargetAccess(target, parentAccess) {
    if (typeof target === "string") return parentAccess;
    return target.access ?? parentAccess;
}
/**
 * Apply the silk publishability rules to a parsed package.json.
 *
 * @param pkgName - Package name (used to populate `PublishTarget.name`)
 * @param raw - Parsed package.json contents
 * @returns Publish targets. Empty array means "not publishable".
 *
 * @remarks
 * Rules:
 * - `private !== true` → one public target (with defaults)
 * - `private === true` + `publishConfig.targets` → one target per spec that
 *   resolves to public/restricted access
 * - `private === true` + `publishConfig.access` (no targets) → one target
 * - Otherwise → `[]`
 */ function silkDetect(pkgName, raw) {
    if (raw.private !== true) {
        return [
            new workspaces_effect/* .PublishTarget */.j$({
                name: pkgName,
                registry: raw.publishConfig?.registry ?? DEFAULT_REGISTRY,
                directory: raw.publishConfig?.directory ?? ".",
                access: raw.publishConfig?.access ?? "public"
            })
        ];
    }
    const pc = raw.publishConfig;
    if (!pc) return [];
    if (pc.targets && pc.targets.length > 0) {
        const results = [];
        for (const target of pc.targets){
            const access = resolveTargetAccess(target, pc.access);
            if (access !== "public" && access !== "restricted") continue;
            const registry = typeof target === "string" ? pc.registry ?? DEFAULT_REGISTRY : target.registry ?? pc.registry ?? DEFAULT_REGISTRY;
            results.push(new workspaces_effect/* .PublishTarget */.j$({
                name: pkgName,
                registry,
                directory: pc.directory ?? ".",
                access
            }));
        }
        return results;
    }
    if (pc.access === "public" || pc.access === "restricted") {
        return [
            new workspaces_effect/* .PublishTarget */.j$({
                name: pkgName,
                registry: pc.registry ?? DEFAULT_REGISTRY,
                directory: pc.directory ?? ".",
                access: pc.access
            })
        ];
    }
    return [];
}
/**
 * Convenience predicate built on top of {@link silkDetect}.
 *
 * @returns True when the package resolves to one or more publish targets.
 */ function isSilkPublishable(pkgName, raw) {
    return silkDetect(pkgName, raw).length > 0;
}

;// CONCATENATED MODULE: ./src/utils/release-summary-helpers.ts





/**
 * Read the changeset configuration file
 *
 * @returns Changeset config or null if not found/readable
 */ function readChangesetConfig() {
    const configPath = (0,external_node_path_.join)(process.cwd(), ".changeset", "config.json");
    try {
        if ((0,external_node_fs_.existsSync)(configPath)) {
            const content = (0,external_node_fs_.readFileSync)(configPath, "utf8");
            return JSON.parse(content);
        }
    } catch (err) {
        (0,_actions_compat/* .debug */.Yz)(`Failed to read changeset config: ${err instanceof Error ? err.message : String(err)}`);
    }
    return null;
}
/**
 * Find which group a package belongs to (fixed or linked)
 *
 * @param packageName - Package name to look up
 * @param config - Changeset configuration
 * @returns Group information
 */ function findPackageGroup(packageName, config) {
    if (!config) {
        return {
            type: "none",
            siblings: []
        };
    }
    // Check fixed groups
    if (config.fixed) {
        for (const group of config.fixed){
            if (group.includes(packageName)) {
                return {
                    type: "fixed",
                    siblings: group.filter((name)=>name !== packageName)
                };
            }
        }
    }
    // Check linked groups
    if (config.linked) {
        for (const group of config.linked){
            if (group.includes(packageName)) {
                return {
                    type: "linked",
                    siblings: group.filter((name)=>name !== packageName)
                };
            }
        }
    }
    return {
        type: "none",
        siblings: []
    };
}
/**
 * Get all workspace packages including their publish configuration
 *
 * @returns Array of workspace package info
 */ function getAllWorkspacePackages() {
    const cwd = process.cwd();
    const workspaceRoot = (0,workspaces_effect/* .findWorkspaceRootSync */.sn)(cwd);
    if (!workspaceRoot) {
        (0,_actions_compat/* .debug */.Yz)("No workspace root found");
        return [];
    }
    const workspaces = (0,workspaces_effect/* .getWorkspacePackagesSync */.we)(workspaceRoot);
    const packages = [];
    for (const workspace of workspaces){
        // `workspaces-effect`'s typed PublishConfig doesn't carry `targets`, so
        // re-read the raw package.json to compute target counts under silk rules.
        const rawPath = (0,external_node_path_.join)(workspace.path, "package.json");
        let rawPkg = {};
        try {
            rawPkg = JSON.parse((0,external_node_fs_.readFileSync)(rawPath, "utf8"));
        } catch (err) {
            (0,_actions_compat/* .debug */.Yz)(`Failed to re-read ${rawPath}: ${err instanceof Error ? err.message : String(err)}`);
        }
        const hasPublishConfig = rawPkg.publishConfig?.access !== undefined;
        const targets = silkDetect(workspace.name, rawPkg);
        packages.push({
            name: workspace.name,
            version: workspace.version || "0.0.0",
            path: workspace.path,
            private: workspace.private === true,
            hasPublishConfig,
            access: rawPkg.publishConfig?.access,
            targetCount: targets.length
        });
    }
    return packages;
}
/**
 * Count changesets per package
 *
 * @param changesets - Array of changeset info
 * @returns Map of package name to changeset count
 */ function countChangesetsPerPackage(changesets) {
    const counts = new Map();
    for (const changeset of changesets){
        for (const release of changeset.releases){
            const current = counts.get(release.name) || 0;
            counts.set(release.name, current + 1);
        }
    }
    return counts;
}
/**
 * Get the reason why a package is not being released
 *
 * @param pkg - Workspace package info
 * @param isInReleases - Whether the package is in the release list
 * @returns Skip reason or null if package is being released
 */ function getSkipReason(pkg, isInReleases) {
    if (isInReleases) {
        return null;
    }
    if (pkg.private && !pkg.hasPublishConfig) {
        return "private";
    }
    if (!pkg.hasPublishConfig) {
        return "no-publish-config";
    }
    return "no-changes";
}
/**
 * Format skip reason for display
 *
 * @param reason - Skip reason
 * @returns Human-readable skip reason
 */ function formatSkipReason(reason) {
    switch(reason){
        case "private":
            return "🔒 Private (no `publishConfig.access`)";
        case "no-publish-config":
            return "⚙️ No `publishConfig.access`";
        case "no-changes":
            return "📭 No changes";
        case "ignored":
            return "🚫 Ignored";
    }
}
/**
 * Get bump type icon
 *
 * @param type - Bump type
 * @returns Emoji icon for the bump type
 */ function getBumpTypeIcon(type) {
    switch(type){
        case "major":
            return "🔴";
        case "minor":
            return "🟡";
        case "patch":
            return "🟢";
        default:
            return "⚪️";
    }
}
/**
 * Get group type icon
 *
 * @param type - Group type
 * @returns Emoji icon for the group type
 */ function getGroupIcon(type) {
    switch(type){
        case "fixed":
            return "🔒";
        case "linked":
            return "🔗";
        default:
            return "📦";
    }
}
/**
 * Check if this is a first release (version starting with 0.0.0)
 *
 * @param oldVersion - Old version string
 * @returns Whether this is a first release
 */ function isFirstRelease(oldVersion) {
    return oldVersion === "0.0.0";
}


},
26741(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.d(__webpack_exports__, {
  DN: () => (/* reexport safe */ _registry_utils_js__rspack_import_1.DN),
  Pr: () => (registryToEnvName),
  h5: () => (resolveTargets)
});
/* import */ var node_path__rspack_import_0 = __webpack_require__(76760);
/* import */ var node_path__rspack_import_0_default = /*#__PURE__*/__webpack_require__.n(node_path__rspack_import_0);
/* import */ var _registry_utils_js__rspack_import_1 = __webpack_require__(36679);

// Re-export from registry-utils for backward compatibility

/**
 * Known shorthands that expand to full targets
 *
 * @remarks
 * Authentication strategy:
 * - **npm**: Uses OIDC trusted publishing via Sigstore (no token needed)
 * - **github**: Uses the GitHub Packages token (SILK_GITHUB_PACKAGES_TOKEN)
 * - **jsr**: Uses OIDC natively in GitHub Actions (no token needed)
 */ const KNOWN_SHORTHANDS = {
    npm: {
        protocol: "npm",
        registry: "https://registry.npmjs.org/",
        provenance: true
    },
    github: {
        protocol: "npm",
        registry: "https://npm.pkg.github.com/",
        provenance: true,
        tokenEnv: "SILK_GITHUB_PACKAGES_TOKEN"
    },
    jsr: {
        protocol: "jsr",
        provenance: false
    }
};
/**
 * Registry-specific defaults for provenance and access
 *
 * @remarks
 * - npm public registry uses OIDC, so tokenEnv is null
 * - GitHub Packages requires SILK_GITHUB_PACKAGES_TOKEN
 */ const REGISTRY_DEFAULTS = {
    "https://registry.npmjs.org/": {
        provenance: true,
        access: "restricted",
        tokenEnv: null
    },
    "https://npm.pkg.github.com/": {
        provenance: true,
        access: "restricted",
        tokenEnv: "SILK_GITHUB_PACKAGES_TOKEN"
    }
};
/**
 * Get defaults for a registry URL
 */ function getRegistryDefaults(registry) {
    if (!registry) {
        return {
            provenance: false,
            access: "restricted",
            tokenEnv: null
        };
    }
    const defaults = REGISTRY_DEFAULTS[registry];
    if (defaults) {
        return defaults;
    }
    // Custom registry - generate token env name from URL
    return {
        provenance: false,
        access: "restricted",
        tokenEnv: registryToEnvName(registry)
    };
}
/**
 * Convert a registry URL to a valid environment variable name
 * https://registry.savvyweb.dev/ -> REGISTRY_SAVVYWEB_DEV_TOKEN
 *
 * @param registry - Registry URL to convert
 * @returns Environment variable name
 */ function registryToEnvName(registry) {
    return `${registry.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9]/g, "_").toUpperCase().replace(/_+/g, "_").replace(/^_|_$/g, "")}_TOKEN`;
}
/**
 * Expand a shorthand target to a full PublishTarget object
 */ function expandShorthand(target) {
    // Already a full object
    if (typeof target === "object") {
        return target;
    }
    // Known shorthand (npm, github, jsr)
    if (target in KNOWN_SHORTHANDS) {
        return {
            ...KNOWN_SHORTHANDS[target]
        };
    }
    // URL shorthand - treat as custom npm-compatible registry
    if (target.startsWith("https://") || target.startsWith("http://")) {
        return {
            protocol: "npm",
            registry: target,
            provenance: false,
            tokenEnv: registryToEnvName(target)
        };
    }
    throw new Error(`Unknown target shorthand: ${target}`);
}
/**
 * Resolve all publish targets for a package
 *
 * Resolution rules:
 * 1. No publishConfig + private:true → not publishable (empty array)
 * 2. No publishConfig + private:false → publish from root to npm
 * 3. publishConfig without targets → legacy mode, single npm target
 * 4. publishConfig with targets → resolve each target
 *
 * @param packagePath - Absolute path to the package directory
 * @param packageJson - Parsed package.json contents
 * @returns Array of resolved targets
 */ function resolveTargets(packagePath, packageJson) {
    const { publishConfig } = packageJson;
    const isPrivate = packageJson.private === true;
    // Case 1: No publishConfig
    if (!publishConfig) {
        if (isPrivate) {
            return []; // Not publishable
        }
        // Default: publish from root to npm (uses OIDC, no token needed)
        return [
            {
                protocol: "npm",
                registry: "https://registry.npmjs.org/",
                directory: packagePath,
                access: "restricted",
                provenance: true,
                tag: "latest",
                tokenEnv: null
            }
        ];
    }
    // Case 2: publishConfig without targets (legacy mode)
    if (!publishConfig.targets || publishConfig.targets.length === 0) {
        const registry = publishConfig.registry || "https://registry.npmjs.org/";
        const defaults = getRegistryDefaults(registry);
        return [
            {
                protocol: "npm",
                registry,
                directory: publishConfig.directory ? (0,node_path__rspack_import_0.resolve)(packagePath, publishConfig.directory) : packagePath,
                access: publishConfig.access || defaults.access,
                provenance: defaults.provenance,
                tag: "latest",
                tokenEnv: defaults.tokenEnv
            }
        ];
    }
    // Case 3: publishConfig with targets
    return publishConfig.targets.map((target)=>{
        const expanded = expandShorthand(target);
        // Determine registry (null for JSR)
        const registry = expanded.protocol === "npm" ? expanded.registry || "https://registry.npmjs.org/" : null;
        const registryDefaults = getRegistryDefaults(registry);
        // Resolve directory: target > publishConfig > package root
        const directory = expanded.directory ? (0,node_path__rspack_import_0.resolve)(packagePath, expanded.directory) : publishConfig.directory ? (0,node_path__rspack_import_0.resolve)(packagePath, publishConfig.directory) : packagePath;
        // Resolve tokenEnv: target > registry default
        const tokenEnv = expanded.tokenEnv ?? registryDefaults.tokenEnv;
        return {
            protocol: expanded.protocol,
            registry,
            directory,
            access: expanded.access ?? publishConfig.access ?? registryDefaults.access,
            provenance: expanded.provenance ?? registryDefaults.provenance,
            tag: expanded.tag ?? "latest",
            tokenEnv
        };
    });
}


},

};
