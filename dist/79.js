export const __rspack_esm_id = 79;
export const __rspack_esm_ids = [79];
export const __webpack_modules__ = {
24538(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  determineReleaseType: () => (determineReleaseType),
  determineTagStrategy: () => (determineTagStrategy),
  isMonorepoForTagging: () => (isMonorepoForTagging)
});
/* import */ var _actions_compat_js__rspack_import_0 = __webpack_require__(77279);
/* import */ var _release_summary_helpers_js__rspack_import_1 = __webpack_require__(26950);


/**
 * Determines if the repository requires per-package tags (is a "monorepo" for tagging purposes)
 *
 * @remarks
 * A repository needs per-package tags when:
 * - Multiple publishable packages exist AND they are NOT all in the same fixed group
 *
 * A repository uses single version tags when:
 * - Only 1 publishable package exists, OR
 * - All publishable packages are in the same fixed group
 *
 * A package is "publishable" if:
 * - It has publishConfig.targets or publishConfig.access, OR
 * - It is not marked as private
 *
 * @returns True if per-package tags are needed, false for single version tag
 */ function isMonorepoForTagging() {
    const allPackages = (0,_release_summary_helpers_js__rspack_import_1/* .getAllWorkspacePackages */.Qu)();
    const changesetConfig = (0,_release_summary_helpers_js__rspack_import_1/* .readChangesetConfig */.fz)();
    // Filter to publishable packages
    // A package is publishable if it has publish config OR is not private
    const publishablePackages = allPackages.filter((pkg)=>pkg.hasPublishConfig || pkg.targetCount > 0 || !pkg.private);
    (0,_actions_compat_js__rspack_import_0/* .debug */.Yz)(`Found ${publishablePackages.length} publishable packages out of ${allPackages.length} total`);
    // Single publishable package → single tag
    if (publishablePackages.length <= 1) {
        (0,_actions_compat_js__rspack_import_0/* .debug */.Yz)("Single publishable package detected, using single tag strategy");
        return false;
    }
    // Check if all publishable packages are in the same fixed group
    if (changesetConfig?.fixed) {
        const publishableNames = new Set(publishablePackages.map((p)=>p.name));
        for (const fixedGroup of changesetConfig.fixed){
            // Check if all publishable packages are in this fixed group
            const allInGroup = [
                ...publishableNames
            ].every((name)=>fixedGroup.includes(name));
            if (allInGroup) {
                (0,_actions_compat_js__rspack_import_0/* .debug */.Yz)(`All publishable packages are in fixed group: [${fixedGroup.join(", ")}]`);
                return false;
            }
        }
    }
    // Multiple publishable packages not all in same fixed group → per-package tags
    (0,_actions_compat_js__rspack_import_0/* .debug */.Yz)("Multiple publishable packages with independent/linked versioning, using per-package tags");
    return true;
}
/**
 * Determine the tagging strategy for releases
 *
 * @remarks
 * Tagging strategy rules:
 * - Single-package repo → single tag: `v1.0.0`
 * - Monorepo with all packages in same fixed group → single tag: `v1.0.0`
 * - Monorepo with independent/linked versioning → per-package tags: `@scope/pkg@1.0.0`
 *
 * @param publishResults - Results from publishing packages
 * @returns Tag strategy with tags to create
 */ function determineTagStrategy(publishResults) {
    // Filter to only successful packages: those with at least one successful target,
    // or version-only packages (empty targets array - nothing to fail)
    const successfulPackages = publishResults.filter((pkg)=>pkg.targets.length === 0 || pkg.targets.some((t)=>t.success));
    if (successfulPackages.length === 0) {
        (0,_actions_compat_js__rspack_import_0/* .info */.pq)("No packages were published successfully, no tags to create");
        return {
            strategy: "single",
            tags: [],
            isFixedVersioning: true
        };
    }
    // Check if this is a monorepo that needs per-package tags
    const needsPerPackageTags = isMonorepoForTagging();
    if (!needsPerPackageTags) {
        // Single-package repo or all packages in same fixed group
        // Check if all released packages have same version (should be true for fixed)
        const versions = new Set(successfulPackages.map((pkg)=>pkg.version));
        const isFixedVersioning = versions.size === 1;
        if (isFixedVersioning) {
            const version = successfulPackages[0].version;
            const tag = version;
            const packageNames = successfulPackages.length === 1 ? successfulPackages[0].name : successfulPackages.map((p)=>p.name).join(", ");
            (0,_actions_compat_js__rspack_import_0/* .info */.pq)(`Single tag strategy: creating tag ${tag} for ${packageNames}`);
            return {
                strategy: "single",
                tags: [
                    {
                        name: tag,
                        packageName: packageNames,
                        version
                    }
                ],
                isFixedVersioning: true
            };
        }
        // Edge case: multiple packages released with different versions but not a monorepo
        // This shouldn't happen in practice, but handle it by using highest version
        const highestVersion = [
            ...versions
        ].sort().pop() || successfulPackages[0].version;
        const tag = highestVersion;
        (0,_actions_compat_js__rspack_import_0/* .warning */.$e)(`Unexpected: multiple versions in single-tag mode. Using highest version: ${tag}`);
        return {
            strategy: "single",
            tags: [
                {
                    name: tag,
                    packageName: successfulPackages.map((p)=>p.name).join(", "),
                    version: highestVersion
                }
            ],
            isFixedVersioning: false
        };
    }
    // Monorepo with independent/linked versioning - create tag per package
    (0,_actions_compat_js__rspack_import_0/* .info */.pq)(`Per-package tag strategy: creating ${successfulPackages.length} tags`);
    const tags = successfulPackages.map((pkg)=>{
        // Use npm-style tags for scoped packages: @scope/pkg@1.0.0
        // Use v-prefix for non-scoped: pkg@v1.0.0
        const tag = pkg.name.startsWith("@") ? `${pkg.name}@${pkg.version}` : `${pkg.name}@v${pkg.version}`;
        (0,_actions_compat_js__rspack_import_0/* .info */.pq)(`  - ${tag}`);
        return {
            name: tag,
            packageName: pkg.name,
            version: pkg.version
        };
    });
    // Check if all released packages happen to have same version
    const versions = new Set(successfulPackages.map((pkg)=>pkg.version));
    const isFixedVersioning = versions.size === 1;
    return {
        strategy: "multiple",
        tags,
        isFixedVersioning
    };
}
/**
 * Determine the release type based on version changes
 *
 * @remarks
 * Analyzes the version changes to determine if this is a major, minor, or patch release.
 * For multiple packages with different bump types, returns the highest (major > minor > patch).
 *
 * @param publishResults - Results from publishing packages
 * @param bumpTypes - Map of package name to bump type
 * @returns Release type: 'major', 'minor', or 'patch'
 */ function determineReleaseType(publishResults, bumpTypes) {
    // Include version-only packages (empty targets) in release type determination
    const successfulPackages = publishResults.filter((pkg)=>pkg.targets.length === 0 || pkg.targets.some((t)=>t.success));
    // Get bump types for successful packages
    const bumps = successfulPackages.map((pkg)=>bumpTypes.get(pkg.name)).filter((bump)=>bump !== undefined);
    // Return highest bump type
    if (bumps.includes("major")) return "major";
    if (bumps.includes("minor")) return "minor";
    return "patch";
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

};
