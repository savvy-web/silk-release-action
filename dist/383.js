export const __rspack_esm_id = 383;
export const __rspack_esm_ids = [383];
export const __webpack_modules__ = {
99522(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  getChangesetStatus: () => (getChangesetStatus)
});
/* import */ var node_fs__rspack_import_0 = __webpack_require__(73024);
/* import */ var node_fs__rspack_import_0_default = /*#__PURE__*/__webpack_require__.n(node_fs__rspack_import_0);
/* import */ var node_path__rspack_import_1 = __webpack_require__(76760);
/* import */ var node_path__rspack_import_1_default = /*#__PURE__*/__webpack_require__.n(node_path__rspack_import_1);
/* import */ var _actions_compat_js__rspack_import_2 = __webpack_require__(50620);



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

};
