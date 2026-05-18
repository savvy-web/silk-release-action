export const __rspack_esm_id = 685;
export const __rspack_esm_ids = [685];
export const __webpack_modules__ = {
5441(__unused_rspack_module, __webpack_exports__, __webpack_require__) {

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  n4: () => (/* binding */ createPackageAttestation),
  au: () => (/* binding */ createReleaseAssetAttestation),
  Ug: () => (/* binding */ createSBOMAttestation)
});

// UNUSED EXPORTS: validateSBOMGeneration

// EXTERNAL MODULE: external "node:crypto"
var external_node_crypto_ = __webpack_require__(77598);
// EXTERNAL MODULE: external "node:fs"
var external_node_fs_ = __webpack_require__(73024);
// EXTERNAL MODULE: external "node:path"
var external_node_path_ = __webpack_require__(76760);
// EXTERNAL MODULE: ./src/utils/_actions-compat.ts + 18 modules
var _actions_compat = __webpack_require__(50620);
;// CONCATENATED MODULE: ./src/utils/detect-copyright-year.ts

/**
 * Fetch package creation date from npm registry
 *
 * @remarks
 * Queries the npm registry for the package metadata and extracts the
 * `time.created` timestamp which indicates when the package was first published.
 *
 * @param packageName - Package name to query
 * @param registry - Registry URL (defaults to https://registry.npmjs.org)
 * @returns ISO timestamp of first publication or undefined
 */ async function fetchNpmPackageCreationDate(packageName, registry = "https://registry.npmjs.org") {
    try {
        // Use npm view to get the time metadata
        // This is more reliable than direct fetch as it handles authentication
        let output = "";
        let stderr = "";
        const exitCode = await exec("npm", [
            "view",
            packageName,
            "time",
            "--json",
            "--registry",
            registry
        ], {
            silent: true,
            ignoreReturnCode: true,
            listeners: {
                stdout: (data)=>{
                    output += data.toString();
                },
                stderr: (data)=>{
                    stderr += data.toString();
                }
            }
        });
        if (exitCode !== 0) {
            // Package might not exist yet (new package)
            if (stderr.includes("E404") || stderr.includes("not found") || output.includes("E404")) {
                debug(`Package ${packageName} not found on registry - likely a new package`);
                return undefined;
            }
            debug(`npm view failed for ${packageName}: ${stderr}`);
            return undefined;
        }
        // Parse the time object
        // Format: { "created": "2024-01-15T...", "modified": "...", "1.0.0": "..." }
        const timeData = JSON.parse(output);
        if (timeData.created) {
            debug(`Found creation date for ${packageName}: ${timeData.created}`);
            return timeData.created;
        }
        return undefined;
    } catch (error) {
        debug(`Failed to fetch npm package creation date: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * Extract year from ISO date string
 *
 * @param isoDate - ISO 8601 date string
 * @returns Year as number
 */ function extractYearFromDate(isoDate) {
    const date = new Date(isoDate);
    const year = date.getFullYear();
    // Check for Invalid Date (NaN year)
    if (Number.isNaN(year)) {
        return new Date().getFullYear();
    }
    return year;
}
/**
 * Detect copyright start year for a package
 *
 * @remarks
 * Determines the copyright start year using the following precedence:
 * 1. Explicit startYear override from configuration (if provided)
 * 2. First publication date from npm registry (auto-detected)
 * 3. Current year (for new/unpublished packages)
 *
 * Most packages will use auto-detection (option 2 or 3). The config override
 * is only needed for edge cases like packages published elsewhere before npm.
 *
 * @param packageName - Package name
 * @param configStartYear - Optional override from configuration (most users should not set this)
 * @param registry - Registry URL for npm lookup
 * @returns Copyright year detection result
 */ async function detect_copyright_year_detectCopyrightYear(packageName, configStartYear, registry) {
    // If config specifies a start year, use it
    if (configStartYear !== undefined) {
        return {
            startYear: configStartYear,
            source: "config"
        };
    }
    // Try to get creation date from npm registry
    const createdDate = await fetchNpmPackageCreationDate(packageName, registry);
    if (createdDate) {
        const year = extractYearFromDate(createdDate);
        return {
            startYear: year,
            source: "npm-registry",
            firstPublished: createdDate
        };
    }
    // Fall back to current year for new packages
    const currentYear = new Date().getFullYear();
    debug(`Using current year ${currentYear} as copyright start year for ${packageName}`);
    return {
        startYear: currentYear,
        source: "default"
    };
}

;// CONCATENATED MODULE: ./src/utils/infer-sbom-metadata.ts



/**
 * Parse author field from package.json
 *
 * @remarks
 * The author field can be a string in format "Name <email> (url)"
 * or an object with name, email, and url properties.
 *
 * @param author - Author field from package.json
 * @returns Parsed author name and email
 */ function parseAuthor(author) {
    if (!author) {
        return {};
    }
    if (typeof author === "object") {
        return {
            name: author.name,
            email: author.email
        };
    }
    // Parse string format: "Name <email> (url)"
    const nameMatch = author.match(/^([^<(]+)/);
    const emailMatch = author.match(/<([^>]+)>/);
    return {
        name: nameMatch?.[1]?.trim(),
        email: emailMatch?.[1]?.trim()
    };
}
/**
 * Parse repository field from package.json
 *
 * @param repository - Repository field from package.json
 * @returns Normalized repository URL
 */ function parseRepository(repository) {
    if (!repository) {
        return undefined;
    }
    let url;
    if (typeof repository === "string") {
        url = repository;
    } else {
        url = repository.url;
    }
    if (!url) {
        return undefined;
    }
    // Normalize git URLs to HTTPS
    // git+https://github.com/org/repo.git -> https://github.com/org/repo
    // git://github.com/org/repo.git -> https://github.com/org/repo
    // git@github.com:org/repo.git -> https://github.com/org/repo
    url = url.replace(/^git\+/, "").replace(/^git:\/\//, "https://").replace(/^git@([^:]+):/, "https://$1/").replace(/\.git$/, "");
    return url;
}
/**
 * Parse bugs field from package.json
 *
 * @param bugs - Bugs field from package.json
 * @returns Issue tracker URL
 */ function parseBugs(bugs) {
    if (!bugs) {
        return undefined;
    }
    if (typeof bugs === "string") {
        return bugs;
    }
    return bugs.url;
}
/**
 * Infer SBOM metadata from package.json
 *
 * @remarks
 * Reads package.json from the specified directory and extracts metadata
 * that can be used for SBOM generation:
 * - author (name, email)
 * - repository (VCS URL)
 * - bugs (issue tracker URL)
 * - homepage (documentation URL)
 * - license
 *
 * @param directory - Directory containing package.json
 * @returns Inferred metadata from package.json fields
 */ function infer_sbom_metadata_inferSBOMMetadata(directory) {
    const pkgJsonPath = join(directory, "package.json");
    if (!existsSync(pkgJsonPath)) {
        debug(`No package.json found at ${pkgJsonPath} for SBOM metadata inference`);
        return {};
    }
    let pkgJson;
    try {
        pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
    } catch (error) {
        debug(`Failed to parse package.json for SBOM metadata: ${error instanceof Error ? error.message : String(error)}`);
        return {};
    }
    const author = parseAuthor(pkgJson.author);
    const vcsUrl = parseRepository(pkgJson.repository);
    const issueTrackerUrl = parseBugs(pkgJson.bugs);
    const result = {
        authorName: author.name,
        authorEmail: author.email,
        vcsUrl,
        issueTrackerUrl,
        documentationUrl: pkgJson.homepage,
        license: pkgJson.license
    };
    debug(`Inferred SBOM metadata from ${directory}: ${JSON.stringify(result)}`);
    return result;
}
/**
 * Format copyright string
 *
 * @param holder - Copyright holder name
 * @param startYear - Start year
 * @param endYear - End year (defaults to current year)
 * @returns Formatted copyright string
 */ function formatCopyright(holder, startYear, endYear) {
    const currentYear = endYear ?? new Date().getFullYear();
    if (!startYear || startYear === currentYear) {
        return `Copyright ${currentYear} ${holder}`;
    }
    return `Copyright ${startYear}-${currentYear} ${holder}`;
}
/**
 * Merge inferred metadata with explicit configuration
 *
 * @remarks
 * Explicit configuration values take precedence over inferred values.
 * This implements the layered configuration system where:
 * 1. Auto-inferred values from package.json are the base
 * 2. Explicit config from silk-release.json overrides
 *
 * @param inferred - Metadata inferred from package.json
 * @param config - Explicit configuration from silk-release.json
 * @param copyrightStartYear - Detected copyright start year
 * @returns Resolved metadata ready for SBOM injection
 */ function infer_sbom_metadata_resolveSBOMMetadata(inferred, config, copyrightStartYear) {
    const result = {};
    // Resolve supplier
    if (config?.supplier?.name) {
        const supplierUrls = config.supplier.url ? Array.isArray(config.supplier.url) ? config.supplier.url : [
            config.supplier.url
        ] : undefined;
        const supplierContacts = config.supplier.contact ? Array.isArray(config.supplier.contact) ? config.supplier.contact : [
            config.supplier.contact
        ] : undefined;
        result.supplier = {
            name: config.supplier.name,
            url: supplierUrls,
            contact: supplierContacts?.map((c)=>({
                    name: c.name,
                    email: c.email,
                    phone: c.phone
                }))
        };
    }
    // Resolve component metadata
    const publisher = config?.publisher || config?.supplier?.name || inferred.authorName;
    const copyrightHolder = config?.copyright?.holder || config?.supplier?.name;
    const startYear = config?.copyright?.startYear || copyrightStartYear;
    // Build external references from inferred and config
    const externalReferences = {
        externalReferences: []
    };
    // VCS reference (from package.json repository)
    if (inferred.vcsUrl) {
        externalReferences.externalReferences?.push({
            type: "vcs",
            url: inferred.vcsUrl
        });
    }
    // Issue tracker reference (from package.json bugs)
    if (inferred.issueTrackerUrl) {
        externalReferences.externalReferences?.push({
            type: "issue-tracker",
            url: inferred.issueTrackerUrl
        });
    }
    // Documentation reference (config overrides homepage)
    const docUrl = config?.documentationUrl || inferred.documentationUrl;
    if (docUrl) {
        externalReferences.externalReferences?.push({
            type: "documentation",
            url: docUrl
        });
    }
    // Website reference (from supplier URL if different from doc URL)
    const supplierUrl = config?.supplier?.url ? Array.isArray(config.supplier.url) ? config.supplier.url[0] : config.supplier.url : undefined;
    if (supplierUrl && supplierUrl !== docUrl) {
        externalReferences.externalReferences?.push({
            type: "website",
            url: supplierUrl
        });
    }
    result.component = {
        publisher,
        copyright: copyrightHolder ? formatCopyright(copyrightHolder, startYear) : undefined,
        externalReferences: externalReferences.externalReferences && externalReferences.externalReferences.length > 0 ? externalReferences.externalReferences : undefined
    };
    // Resolve author
    result.author = inferred.authorName;
    info(`Resolved SBOM metadata: supplier=${result.supplier?.name || "none"}, publisher=${result.component?.publisher || "none"}`);
    return result;
}

;// CONCATENATED MODULE: ./node_modules/.pnpm/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/impl/scanner.js
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Creates a JSON scanner on the given text.
 * If ignoreTrivia is set, whitespaces or comments are ignored.
 */
function scanner_createScanner(text, ignoreTrivia = false) {
    const len = text.length;
    let pos = 0, value = '', tokenOffset = 0, token = 16 /* SyntaxKind.Unknown */, lineNumber = 0, lineStartOffset = 0, tokenLineStartOffset = 0, prevTokenLineStartOffset = 0, scanError = 0 /* ScanError.None */;
    function scanHexDigits(count, exact) {
        let digits = 0;
        let value = 0;
        while (digits < count || !exact) {
            let ch = text.charCodeAt(pos);
            if (ch >= 48 /* CharacterCodes._0 */ && ch <= 57 /* CharacterCodes._9 */) {
                value = value * 16 + ch - 48 /* CharacterCodes._0 */;
            }
            else if (ch >= 65 /* CharacterCodes.A */ && ch <= 70 /* CharacterCodes.F */) {
                value = value * 16 + ch - 65 /* CharacterCodes.A */ + 10;
            }
            else if (ch >= 97 /* CharacterCodes.a */ && ch <= 102 /* CharacterCodes.f */) {
                value = value * 16 + ch - 97 /* CharacterCodes.a */ + 10;
            }
            else {
                break;
            }
            pos++;
            digits++;
        }
        if (digits < count) {
            value = -1;
        }
        return value;
    }
    function setPosition(newPosition) {
        pos = newPosition;
        value = '';
        tokenOffset = 0;
        token = 16 /* SyntaxKind.Unknown */;
        scanError = 0 /* ScanError.None */;
    }
    function scanNumber() {
        let start = pos;
        if (text.charCodeAt(pos) === 48 /* CharacterCodes._0 */) {
            pos++;
        }
        else {
            pos++;
            while (pos < text.length && isDigit(text.charCodeAt(pos))) {
                pos++;
            }
        }
        if (pos < text.length && text.charCodeAt(pos) === 46 /* CharacterCodes.dot */) {
            pos++;
            if (pos < text.length && isDigit(text.charCodeAt(pos))) {
                pos++;
                while (pos < text.length && isDigit(text.charCodeAt(pos))) {
                    pos++;
                }
            }
            else {
                scanError = 3 /* ScanError.UnexpectedEndOfNumber */;
                return text.substring(start, pos);
            }
        }
        let end = pos;
        if (pos < text.length && (text.charCodeAt(pos) === 69 /* CharacterCodes.E */ || text.charCodeAt(pos) === 101 /* CharacterCodes.e */)) {
            pos++;
            if (pos < text.length && text.charCodeAt(pos) === 43 /* CharacterCodes.plus */ || text.charCodeAt(pos) === 45 /* CharacterCodes.minus */) {
                pos++;
            }
            if (pos < text.length && isDigit(text.charCodeAt(pos))) {
                pos++;
                while (pos < text.length && isDigit(text.charCodeAt(pos))) {
                    pos++;
                }
                end = pos;
            }
            else {
                scanError = 3 /* ScanError.UnexpectedEndOfNumber */;
            }
        }
        return text.substring(start, end);
    }
    function scanString() {
        let result = '', start = pos;
        while (true) {
            if (pos >= len) {
                result += text.substring(start, pos);
                scanError = 2 /* ScanError.UnexpectedEndOfString */;
                break;
            }
            const ch = text.charCodeAt(pos);
            if (ch === 34 /* CharacterCodes.doubleQuote */) {
                result += text.substring(start, pos);
                pos++;
                break;
            }
            if (ch === 92 /* CharacterCodes.backslash */) {
                result += text.substring(start, pos);
                pos++;
                if (pos >= len) {
                    scanError = 2 /* ScanError.UnexpectedEndOfString */;
                    break;
                }
                const ch2 = text.charCodeAt(pos++);
                switch (ch2) {
                    case 34 /* CharacterCodes.doubleQuote */:
                        result += '\"';
                        break;
                    case 92 /* CharacterCodes.backslash */:
                        result += '\\';
                        break;
                    case 47 /* CharacterCodes.slash */:
                        result += '/';
                        break;
                    case 98 /* CharacterCodes.b */:
                        result += '\b';
                        break;
                    case 102 /* CharacterCodes.f */:
                        result += '\f';
                        break;
                    case 110 /* CharacterCodes.n */:
                        result += '\n';
                        break;
                    case 114 /* CharacterCodes.r */:
                        result += '\r';
                        break;
                    case 116 /* CharacterCodes.t */:
                        result += '\t';
                        break;
                    case 117 /* CharacterCodes.u */:
                        const ch3 = scanHexDigits(4, true);
                        if (ch3 >= 0) {
                            result += String.fromCharCode(ch3);
                        }
                        else {
                            scanError = 4 /* ScanError.InvalidUnicode */;
                        }
                        break;
                    default:
                        scanError = 5 /* ScanError.InvalidEscapeCharacter */;
                }
                start = pos;
                continue;
            }
            if (ch >= 0 && ch <= 0x1f) {
                if (isLineBreak(ch)) {
                    result += text.substring(start, pos);
                    scanError = 2 /* ScanError.UnexpectedEndOfString */;
                    break;
                }
                else {
                    scanError = 6 /* ScanError.InvalidCharacter */;
                    // mark as error but continue with string
                }
            }
            pos++;
        }
        return result;
    }
    function scanNext() {
        value = '';
        scanError = 0 /* ScanError.None */;
        tokenOffset = pos;
        lineStartOffset = lineNumber;
        prevTokenLineStartOffset = tokenLineStartOffset;
        if (pos >= len) {
            // at the end
            tokenOffset = len;
            return token = 17 /* SyntaxKind.EOF */;
        }
        let code = text.charCodeAt(pos);
        // trivia: whitespace
        if (isWhiteSpace(code)) {
            do {
                pos++;
                value += String.fromCharCode(code);
                code = text.charCodeAt(pos);
            } while (isWhiteSpace(code));
            return token = 15 /* SyntaxKind.Trivia */;
        }
        // trivia: newlines
        if (isLineBreak(code)) {
            pos++;
            value += String.fromCharCode(code);
            if (code === 13 /* CharacterCodes.carriageReturn */ && text.charCodeAt(pos) === 10 /* CharacterCodes.lineFeed */) {
                pos++;
                value += '\n';
            }
            lineNumber++;
            tokenLineStartOffset = pos;
            return token = 14 /* SyntaxKind.LineBreakTrivia */;
        }
        switch (code) {
            // tokens: []{}:,
            case 123 /* CharacterCodes.openBrace */:
                pos++;
                return token = 1 /* SyntaxKind.OpenBraceToken */;
            case 125 /* CharacterCodes.closeBrace */:
                pos++;
                return token = 2 /* SyntaxKind.CloseBraceToken */;
            case 91 /* CharacterCodes.openBracket */:
                pos++;
                return token = 3 /* SyntaxKind.OpenBracketToken */;
            case 93 /* CharacterCodes.closeBracket */:
                pos++;
                return token = 4 /* SyntaxKind.CloseBracketToken */;
            case 58 /* CharacterCodes.colon */:
                pos++;
                return token = 6 /* SyntaxKind.ColonToken */;
            case 44 /* CharacterCodes.comma */:
                pos++;
                return token = 5 /* SyntaxKind.CommaToken */;
            // strings
            case 34 /* CharacterCodes.doubleQuote */:
                pos++;
                value = scanString();
                return token = 10 /* SyntaxKind.StringLiteral */;
            // comments
            case 47 /* CharacterCodes.slash */:
                const start = pos - 1;
                // Single-line comment
                if (text.charCodeAt(pos + 1) === 47 /* CharacterCodes.slash */) {
                    pos += 2;
                    while (pos < len) {
                        if (isLineBreak(text.charCodeAt(pos))) {
                            break;
                        }
                        pos++;
                    }
                    value = text.substring(start, pos);
                    return token = 12 /* SyntaxKind.LineCommentTrivia */;
                }
                // Multi-line comment
                if (text.charCodeAt(pos + 1) === 42 /* CharacterCodes.asterisk */) {
                    pos += 2;
                    const safeLength = len - 1; // For lookahead.
                    let commentClosed = false;
                    while (pos < safeLength) {
                        const ch = text.charCodeAt(pos);
                        if (ch === 42 /* CharacterCodes.asterisk */ && text.charCodeAt(pos + 1) === 47 /* CharacterCodes.slash */) {
                            pos += 2;
                            commentClosed = true;
                            break;
                        }
                        pos++;
                        if (isLineBreak(ch)) {
                            if (ch === 13 /* CharacterCodes.carriageReturn */ && text.charCodeAt(pos) === 10 /* CharacterCodes.lineFeed */) {
                                pos++;
                            }
                            lineNumber++;
                            tokenLineStartOffset = pos;
                        }
                    }
                    if (!commentClosed) {
                        pos++;
                        scanError = 1 /* ScanError.UnexpectedEndOfComment */;
                    }
                    value = text.substring(start, pos);
                    return token = 13 /* SyntaxKind.BlockCommentTrivia */;
                }
                // just a single slash
                value += String.fromCharCode(code);
                pos++;
                return token = 16 /* SyntaxKind.Unknown */;
            // numbers
            case 45 /* CharacterCodes.minus */:
                value += String.fromCharCode(code);
                pos++;
                if (pos === len || !isDigit(text.charCodeAt(pos))) {
                    return token = 16 /* SyntaxKind.Unknown */;
                }
            // found a minus, followed by a number so
            // we fall through to proceed with scanning
            // numbers
            case 48 /* CharacterCodes._0 */:
            case 49 /* CharacterCodes._1 */:
            case 50 /* CharacterCodes._2 */:
            case 51 /* CharacterCodes._3 */:
            case 52 /* CharacterCodes._4 */:
            case 53 /* CharacterCodes._5 */:
            case 54 /* CharacterCodes._6 */:
            case 55 /* CharacterCodes._7 */:
            case 56 /* CharacterCodes._8 */:
            case 57 /* CharacterCodes._9 */:
                value += scanNumber();
                return token = 11 /* SyntaxKind.NumericLiteral */;
            // literals and unknown symbols
            default:
                // is a literal? Read the full word.
                while (pos < len && isUnknownContentCharacter(code)) {
                    pos++;
                    code = text.charCodeAt(pos);
                }
                if (tokenOffset !== pos) {
                    value = text.substring(tokenOffset, pos);
                    // keywords: true, false, null
                    switch (value) {
                        case 'true': return token = 8 /* SyntaxKind.TrueKeyword */;
                        case 'false': return token = 9 /* SyntaxKind.FalseKeyword */;
                        case 'null': return token = 7 /* SyntaxKind.NullKeyword */;
                    }
                    return token = 16 /* SyntaxKind.Unknown */;
                }
                // some
                value += String.fromCharCode(code);
                pos++;
                return token = 16 /* SyntaxKind.Unknown */;
        }
    }
    function isUnknownContentCharacter(code) {
        if (isWhiteSpace(code) || isLineBreak(code)) {
            return false;
        }
        switch (code) {
            case 125 /* CharacterCodes.closeBrace */:
            case 93 /* CharacterCodes.closeBracket */:
            case 123 /* CharacterCodes.openBrace */:
            case 91 /* CharacterCodes.openBracket */:
            case 34 /* CharacterCodes.doubleQuote */:
            case 58 /* CharacterCodes.colon */:
            case 44 /* CharacterCodes.comma */:
            case 47 /* CharacterCodes.slash */:
                return false;
        }
        return true;
    }
    function scanNextNonTrivia() {
        let result;
        do {
            result = scanNext();
        } while (result >= 12 /* SyntaxKind.LineCommentTrivia */ && result <= 15 /* SyntaxKind.Trivia */);
        return result;
    }
    return {
        setPosition: setPosition,
        getPosition: () => pos,
        scan: ignoreTrivia ? scanNextNonTrivia : scanNext,
        getToken: () => token,
        getTokenValue: () => value,
        getTokenOffset: () => tokenOffset,
        getTokenLength: () => pos - tokenOffset,
        getTokenStartLine: () => lineStartOffset,
        getTokenStartCharacter: () => tokenOffset - prevTokenLineStartOffset,
        getTokenError: () => scanError,
    };
}
function isWhiteSpace(ch) {
    return ch === 32 /* CharacterCodes.space */ || ch === 9 /* CharacterCodes.tab */;
}
function isLineBreak(ch) {
    return ch === 10 /* CharacterCodes.lineFeed */ || ch === 13 /* CharacterCodes.carriageReturn */;
}
function isDigit(ch) {
    return ch >= 48 /* CharacterCodes._0 */ && ch <= 57 /* CharacterCodes._9 */;
}
var scanner_CharacterCodes;
(function (CharacterCodes) {
    CharacterCodes[CharacterCodes["lineFeed"] = 10] = "lineFeed";
    CharacterCodes[CharacterCodes["carriageReturn"] = 13] = "carriageReturn";
    CharacterCodes[CharacterCodes["space"] = 32] = "space";
    CharacterCodes[CharacterCodes["_0"] = 48] = "_0";
    CharacterCodes[CharacterCodes["_1"] = 49] = "_1";
    CharacterCodes[CharacterCodes["_2"] = 50] = "_2";
    CharacterCodes[CharacterCodes["_3"] = 51] = "_3";
    CharacterCodes[CharacterCodes["_4"] = 52] = "_4";
    CharacterCodes[CharacterCodes["_5"] = 53] = "_5";
    CharacterCodes[CharacterCodes["_6"] = 54] = "_6";
    CharacterCodes[CharacterCodes["_7"] = 55] = "_7";
    CharacterCodes[CharacterCodes["_8"] = 56] = "_8";
    CharacterCodes[CharacterCodes["_9"] = 57] = "_9";
    CharacterCodes[CharacterCodes["a"] = 97] = "a";
    CharacterCodes[CharacterCodes["b"] = 98] = "b";
    CharacterCodes[CharacterCodes["c"] = 99] = "c";
    CharacterCodes[CharacterCodes["d"] = 100] = "d";
    CharacterCodes[CharacterCodes["e"] = 101] = "e";
    CharacterCodes[CharacterCodes["f"] = 102] = "f";
    CharacterCodes[CharacterCodes["g"] = 103] = "g";
    CharacterCodes[CharacterCodes["h"] = 104] = "h";
    CharacterCodes[CharacterCodes["i"] = 105] = "i";
    CharacterCodes[CharacterCodes["j"] = 106] = "j";
    CharacterCodes[CharacterCodes["k"] = 107] = "k";
    CharacterCodes[CharacterCodes["l"] = 108] = "l";
    CharacterCodes[CharacterCodes["m"] = 109] = "m";
    CharacterCodes[CharacterCodes["n"] = 110] = "n";
    CharacterCodes[CharacterCodes["o"] = 111] = "o";
    CharacterCodes[CharacterCodes["p"] = 112] = "p";
    CharacterCodes[CharacterCodes["q"] = 113] = "q";
    CharacterCodes[CharacterCodes["r"] = 114] = "r";
    CharacterCodes[CharacterCodes["s"] = 115] = "s";
    CharacterCodes[CharacterCodes["t"] = 116] = "t";
    CharacterCodes[CharacterCodes["u"] = 117] = "u";
    CharacterCodes[CharacterCodes["v"] = 118] = "v";
    CharacterCodes[CharacterCodes["w"] = 119] = "w";
    CharacterCodes[CharacterCodes["x"] = 120] = "x";
    CharacterCodes[CharacterCodes["y"] = 121] = "y";
    CharacterCodes[CharacterCodes["z"] = 122] = "z";
    CharacterCodes[CharacterCodes["A"] = 65] = "A";
    CharacterCodes[CharacterCodes["B"] = 66] = "B";
    CharacterCodes[CharacterCodes["C"] = 67] = "C";
    CharacterCodes[CharacterCodes["D"] = 68] = "D";
    CharacterCodes[CharacterCodes["E"] = 69] = "E";
    CharacterCodes[CharacterCodes["F"] = 70] = "F";
    CharacterCodes[CharacterCodes["G"] = 71] = "G";
    CharacterCodes[CharacterCodes["H"] = 72] = "H";
    CharacterCodes[CharacterCodes["I"] = 73] = "I";
    CharacterCodes[CharacterCodes["J"] = 74] = "J";
    CharacterCodes[CharacterCodes["K"] = 75] = "K";
    CharacterCodes[CharacterCodes["L"] = 76] = "L";
    CharacterCodes[CharacterCodes["M"] = 77] = "M";
    CharacterCodes[CharacterCodes["N"] = 78] = "N";
    CharacterCodes[CharacterCodes["O"] = 79] = "O";
    CharacterCodes[CharacterCodes["P"] = 80] = "P";
    CharacterCodes[CharacterCodes["Q"] = 81] = "Q";
    CharacterCodes[CharacterCodes["R"] = 82] = "R";
    CharacterCodes[CharacterCodes["S"] = 83] = "S";
    CharacterCodes[CharacterCodes["T"] = 84] = "T";
    CharacterCodes[CharacterCodes["U"] = 85] = "U";
    CharacterCodes[CharacterCodes["V"] = 86] = "V";
    CharacterCodes[CharacterCodes["W"] = 87] = "W";
    CharacterCodes[CharacterCodes["X"] = 88] = "X";
    CharacterCodes[CharacterCodes["Y"] = 89] = "Y";
    CharacterCodes[CharacterCodes["Z"] = 90] = "Z";
    CharacterCodes[CharacterCodes["asterisk"] = 42] = "asterisk";
    CharacterCodes[CharacterCodes["backslash"] = 92] = "backslash";
    CharacterCodes[CharacterCodes["closeBrace"] = 125] = "closeBrace";
    CharacterCodes[CharacterCodes["closeBracket"] = 93] = "closeBracket";
    CharacterCodes[CharacterCodes["colon"] = 58] = "colon";
    CharacterCodes[CharacterCodes["comma"] = 44] = "comma";
    CharacterCodes[CharacterCodes["dot"] = 46] = "dot";
    CharacterCodes[CharacterCodes["doubleQuote"] = 34] = "doubleQuote";
    CharacterCodes[CharacterCodes["minus"] = 45] = "minus";
    CharacterCodes[CharacterCodes["openBrace"] = 123] = "openBrace";
    CharacterCodes[CharacterCodes["openBracket"] = 91] = "openBracket";
    CharacterCodes[CharacterCodes["plus"] = 43] = "plus";
    CharacterCodes[CharacterCodes["slash"] = 47] = "slash";
    CharacterCodes[CharacterCodes["formFeed"] = 12] = "formFeed";
    CharacterCodes[CharacterCodes["tab"] = 9] = "tab";
})(scanner_CharacterCodes || (scanner_CharacterCodes = {}));

;// CONCATENATED MODULE: ./node_modules/.pnpm/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/impl/string-intern.js
const string_intern_cachedSpaces = new Array(20).fill(0).map((_, index) => {
    return ' '.repeat(index);
});
const maxCachedValues = 200;
const string_intern_cachedBreakLinesWithSpaces = {
    ' ': {
        '\n': new Array(maxCachedValues).fill(0).map((_, index) => {
            return '\n' + ' '.repeat(index);
        }),
        '\r': new Array(maxCachedValues).fill(0).map((_, index) => {
            return '\r' + ' '.repeat(index);
        }),
        '\r\n': new Array(maxCachedValues).fill(0).map((_, index) => {
            return '\r\n' + ' '.repeat(index);
        }),
    },
    '\t': {
        '\n': new Array(maxCachedValues).fill(0).map((_, index) => {
            return '\n' + '\t'.repeat(index);
        }),
        '\r': new Array(maxCachedValues).fill(0).map((_, index) => {
            return '\r' + '\t'.repeat(index);
        }),
        '\r\n': new Array(maxCachedValues).fill(0).map((_, index) => {
            return '\r\n' + '\t'.repeat(index);
        }),
    }
};
const string_intern_supportedEols = (/* unused pure expression or super */ null && (['\n', '\r', '\r\n']));

;// CONCATENATED MODULE: ./node_modules/.pnpm/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/impl/format.js
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/



function format_format(documentText, range, options) {
    let initialIndentLevel;
    let formatText;
    let formatTextStart;
    let rangeStart;
    let rangeEnd;
    if (range) {
        rangeStart = range.offset;
        rangeEnd = rangeStart + range.length;
        formatTextStart = rangeStart;
        while (formatTextStart > 0 && !format_isEOL(documentText, formatTextStart - 1)) {
            formatTextStart--;
        }
        let endOffset = rangeEnd;
        while (endOffset < documentText.length && !format_isEOL(documentText, endOffset)) {
            endOffset++;
        }
        formatText = documentText.substring(formatTextStart, endOffset);
        initialIndentLevel = computeIndentLevel(formatText, options);
    }
    else {
        formatText = documentText;
        initialIndentLevel = 0;
        formatTextStart = 0;
        rangeStart = 0;
        rangeEnd = documentText.length;
    }
    const eol = getEOL(options, documentText);
    const eolFastPathSupported = supportedEols.includes(eol);
    let numberLineBreaks = 0;
    let indentLevel = 0;
    let indentValue;
    if (options.insertSpaces) {
        indentValue = cachedSpaces[options.tabSize || 4] ?? repeat(cachedSpaces[1], options.tabSize || 4);
    }
    else {
        indentValue = '\t';
    }
    const indentType = indentValue === '\t' ? '\t' : ' ';
    let scanner = createScanner(formatText, false);
    let hasError = false;
    function newLinesAndIndent() {
        if (numberLineBreaks > 1) {
            return repeat(eol, numberLineBreaks) + repeat(indentValue, initialIndentLevel + indentLevel);
        }
        const amountOfSpaces = indentValue.length * (initialIndentLevel + indentLevel);
        if (!eolFastPathSupported || amountOfSpaces > cachedBreakLinesWithSpaces[indentType][eol].length) {
            return eol + repeat(indentValue, initialIndentLevel + indentLevel);
        }
        if (amountOfSpaces <= 0) {
            return eol;
        }
        return cachedBreakLinesWithSpaces[indentType][eol][amountOfSpaces];
    }
    function scanNext() {
        let token = scanner.scan();
        numberLineBreaks = 0;
        while (token === 15 /* SyntaxKind.Trivia */ || token === 14 /* SyntaxKind.LineBreakTrivia */) {
            if (token === 14 /* SyntaxKind.LineBreakTrivia */ && options.keepLines) {
                numberLineBreaks += 1;
            }
            else if (token === 14 /* SyntaxKind.LineBreakTrivia */) {
                numberLineBreaks = 1;
            }
            token = scanner.scan();
        }
        hasError = token === 16 /* SyntaxKind.Unknown */ || scanner.getTokenError() !== 0 /* ScanError.None */;
        return token;
    }
    const editOperations = [];
    function addEdit(text, startOffset, endOffset) {
        if (!hasError && (!range || (startOffset < rangeEnd && endOffset > rangeStart)) && documentText.substring(startOffset, endOffset) !== text) {
            editOperations.push({ offset: startOffset, length: endOffset - startOffset, content: text });
        }
    }
    let firstToken = scanNext();
    if (options.keepLines && numberLineBreaks > 0) {
        addEdit(repeat(eol, numberLineBreaks), 0, 0);
    }
    if (firstToken !== 17 /* SyntaxKind.EOF */) {
        let firstTokenStart = scanner.getTokenOffset() + formatTextStart;
        let initialIndent = (indentValue.length * initialIndentLevel < 20) && options.insertSpaces
            ? cachedSpaces[indentValue.length * initialIndentLevel]
            : repeat(indentValue, initialIndentLevel);
        addEdit(initialIndent, formatTextStart, firstTokenStart);
    }
    while (firstToken !== 17 /* SyntaxKind.EOF */) {
        let firstTokenEnd = scanner.getTokenOffset() + scanner.getTokenLength() + formatTextStart;
        let secondToken = scanNext();
        let replaceContent = '';
        let needsLineBreak = false;
        while (numberLineBreaks === 0 && (secondToken === 12 /* SyntaxKind.LineCommentTrivia */ || secondToken === 13 /* SyntaxKind.BlockCommentTrivia */)) {
            let commentTokenStart = scanner.getTokenOffset() + formatTextStart;
            addEdit(cachedSpaces[1], firstTokenEnd, commentTokenStart);
            firstTokenEnd = scanner.getTokenOffset() + scanner.getTokenLength() + formatTextStart;
            needsLineBreak = secondToken === 12 /* SyntaxKind.LineCommentTrivia */;
            replaceContent = needsLineBreak ? newLinesAndIndent() : '';
            secondToken = scanNext();
        }
        if (secondToken === 2 /* SyntaxKind.CloseBraceToken */) {
            if (firstToken !== 1 /* SyntaxKind.OpenBraceToken */) {
                indentLevel--;
            }
            ;
            if (options.keepLines && numberLineBreaks > 0 || !options.keepLines && firstToken !== 1 /* SyntaxKind.OpenBraceToken */) {
                replaceContent = newLinesAndIndent();
            }
            else if (options.keepLines) {
                replaceContent = cachedSpaces[1];
            }
        }
        else if (secondToken === 4 /* SyntaxKind.CloseBracketToken */) {
            if (firstToken !== 3 /* SyntaxKind.OpenBracketToken */) {
                indentLevel--;
            }
            ;
            if (options.keepLines && numberLineBreaks > 0 || !options.keepLines && firstToken !== 3 /* SyntaxKind.OpenBracketToken */) {
                replaceContent = newLinesAndIndent();
            }
            else if (options.keepLines) {
                replaceContent = cachedSpaces[1];
            }
        }
        else {
            switch (firstToken) {
                case 3 /* SyntaxKind.OpenBracketToken */:
                case 1 /* SyntaxKind.OpenBraceToken */:
                    indentLevel++;
                    if (options.keepLines && numberLineBreaks > 0 || !options.keepLines) {
                        replaceContent = newLinesAndIndent();
                    }
                    else {
                        replaceContent = cachedSpaces[1];
                    }
                    break;
                case 5 /* SyntaxKind.CommaToken */:
                    if (options.keepLines && numberLineBreaks > 0 || !options.keepLines) {
                        replaceContent = newLinesAndIndent();
                    }
                    else {
                        replaceContent = cachedSpaces[1];
                    }
                    break;
                case 12 /* SyntaxKind.LineCommentTrivia */:
                    replaceContent = newLinesAndIndent();
                    break;
                case 13 /* SyntaxKind.BlockCommentTrivia */:
                    if (numberLineBreaks > 0) {
                        replaceContent = newLinesAndIndent();
                    }
                    else if (!needsLineBreak) {
                        replaceContent = cachedSpaces[1];
                    }
                    break;
                case 6 /* SyntaxKind.ColonToken */:
                    if (options.keepLines && numberLineBreaks > 0) {
                        replaceContent = newLinesAndIndent();
                    }
                    else if (!needsLineBreak) {
                        replaceContent = cachedSpaces[1];
                    }
                    break;
                case 10 /* SyntaxKind.StringLiteral */:
                    if (options.keepLines && numberLineBreaks > 0) {
                        replaceContent = newLinesAndIndent();
                    }
                    else if (secondToken === 6 /* SyntaxKind.ColonToken */ && !needsLineBreak) {
                        replaceContent = '';
                    }
                    break;
                case 7 /* SyntaxKind.NullKeyword */:
                case 8 /* SyntaxKind.TrueKeyword */:
                case 9 /* SyntaxKind.FalseKeyword */:
                case 11 /* SyntaxKind.NumericLiteral */:
                case 2 /* SyntaxKind.CloseBraceToken */:
                case 4 /* SyntaxKind.CloseBracketToken */:
                    if (options.keepLines && numberLineBreaks > 0) {
                        replaceContent = newLinesAndIndent();
                    }
                    else {
                        if ((secondToken === 12 /* SyntaxKind.LineCommentTrivia */ || secondToken === 13 /* SyntaxKind.BlockCommentTrivia */) && !needsLineBreak) {
                            replaceContent = cachedSpaces[1];
                        }
                        else if (secondToken !== 5 /* SyntaxKind.CommaToken */ && secondToken !== 17 /* SyntaxKind.EOF */) {
                            hasError = true;
                        }
                    }
                    break;
                case 16 /* SyntaxKind.Unknown */:
                    hasError = true;
                    break;
            }
            if (numberLineBreaks > 0 && (secondToken === 12 /* SyntaxKind.LineCommentTrivia */ || secondToken === 13 /* SyntaxKind.BlockCommentTrivia */)) {
                replaceContent = newLinesAndIndent();
            }
        }
        if (secondToken === 17 /* SyntaxKind.EOF */) {
            if (options.keepLines && numberLineBreaks > 0) {
                replaceContent = newLinesAndIndent();
            }
            else {
                replaceContent = options.insertFinalNewline ? eol : '';
            }
        }
        const secondTokenStart = scanner.getTokenOffset() + formatTextStart;
        addEdit(replaceContent, firstTokenEnd, secondTokenStart);
        firstToken = secondToken;
    }
    return editOperations;
}
function repeat(s, count) {
    let result = '';
    for (let i = 0; i < count; i++) {
        result += s;
    }
    return result;
}
function computeIndentLevel(content, options) {
    let i = 0;
    let nChars = 0;
    const tabSize = options.tabSize || 4;
    while (i < content.length) {
        let ch = content.charAt(i);
        if (ch === cachedSpaces[1]) {
            nChars++;
        }
        else if (ch === '\t') {
            nChars += tabSize;
        }
        else {
            break;
        }
        i++;
    }
    return Math.floor(nChars / tabSize);
}
function getEOL(options, text) {
    for (let i = 0; i < text.length; i++) {
        const ch = text.charAt(i);
        if (ch === '\r') {
            if (i + 1 < text.length && text.charAt(i + 1) === '\n') {
                return '\r\n';
            }
            return '\r';
        }
        else if (ch === '\n') {
            return '\n';
        }
    }
    return (options && options.eol) || '\n';
}
function format_isEOL(text, offset) {
    return '\r\n'.indexOf(text.charAt(offset)) !== -1;
}

;// CONCATENATED MODULE: ./node_modules/.pnpm/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/impl/parser.js
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


var parser_ParseOptions;
(function (ParseOptions) {
    ParseOptions.DEFAULT = {
        allowTrailingComma: false
    };
})(parser_ParseOptions || (parser_ParseOptions = {}));
/**
 * For a given offset, evaluate the location in the JSON document. Each segment in the location path is either a property name or an array index.
 */
function getLocation(text, position) {
    const segments = []; // strings or numbers
    const earlyReturnException = new Object();
    let previousNode = undefined;
    const previousNodeInst = {
        value: {},
        offset: 0,
        length: 0,
        type: 'object',
        parent: undefined
    };
    let isAtPropertyKey = false;
    function setPreviousNode(value, offset, length, type) {
        previousNodeInst.value = value;
        previousNodeInst.offset = offset;
        previousNodeInst.length = length;
        previousNodeInst.type = type;
        previousNodeInst.colonOffset = undefined;
        previousNode = previousNodeInst;
    }
    try {
        visit(text, {
            onObjectBegin: (offset, length) => {
                if (position <= offset) {
                    throw earlyReturnException;
                }
                previousNode = undefined;
                isAtPropertyKey = position > offset;
                segments.push(''); // push a placeholder (will be replaced)
            },
            onObjectProperty: (name, offset, length) => {
                if (position < offset) {
                    throw earlyReturnException;
                }
                setPreviousNode(name, offset, length, 'property');
                segments[segments.length - 1] = name;
                if (position <= offset + length) {
                    throw earlyReturnException;
                }
            },
            onObjectEnd: (offset, length) => {
                if (position <= offset) {
                    throw earlyReturnException;
                }
                previousNode = undefined;
                segments.pop();
            },
            onArrayBegin: (offset, length) => {
                if (position <= offset) {
                    throw earlyReturnException;
                }
                previousNode = undefined;
                segments.push(0);
            },
            onArrayEnd: (offset, length) => {
                if (position <= offset) {
                    throw earlyReturnException;
                }
                previousNode = undefined;
                segments.pop();
            },
            onLiteralValue: (value, offset, length) => {
                if (position < offset) {
                    throw earlyReturnException;
                }
                setPreviousNode(value, offset, length, getNodeType(value));
                if (position <= offset + length) {
                    throw earlyReturnException;
                }
            },
            onSeparator: (sep, offset, length) => {
                if (position <= offset) {
                    throw earlyReturnException;
                }
                if (sep === ':' && previousNode && previousNode.type === 'property') {
                    previousNode.colonOffset = offset;
                    isAtPropertyKey = false;
                    previousNode = undefined;
                }
                else if (sep === ',') {
                    const last = segments[segments.length - 1];
                    if (typeof last === 'number') {
                        segments[segments.length - 1] = last + 1;
                    }
                    else {
                        isAtPropertyKey = true;
                        segments[segments.length - 1] = '';
                    }
                    previousNode = undefined;
                }
            }
        });
    }
    catch (e) {
        if (e !== earlyReturnException) {
            throw e;
        }
    }
    return {
        path: segments,
        previousNode,
        isAtPropertyKey,
        matches: (pattern) => {
            let k = 0;
            for (let i = 0; k < pattern.length && i < segments.length; i++) {
                if (pattern[k] === segments[i] || pattern[k] === '*') {
                    k++;
                }
                else if (pattern[k] !== '**') {
                    return false;
                }
            }
            return k === pattern.length;
        }
    };
}
/**
 * Parses the given text and returns the object the JSON content represents. On invalid input, the parser tries to be as fault tolerant as possible, but still return a result.
 * Therefore always check the errors list to find out if the input was valid.
 */
function parse(text, errors = [], options = parser_ParseOptions.DEFAULT) {
    let currentProperty = null;
    let currentParent = [];
    const previousParents = [];
    function onValue(value) {
        if (Array.isArray(currentParent)) {
            currentParent.push(value);
        }
        else if (currentProperty !== null) {
            currentParent[currentProperty] = value;
        }
    }
    const visitor = {
        onObjectBegin: () => {
            const object = {};
            onValue(object);
            previousParents.push(currentParent);
            currentParent = object;
            currentProperty = null;
        },
        onObjectProperty: (name) => {
            currentProperty = name;
        },
        onObjectEnd: () => {
            currentParent = previousParents.pop();
        },
        onArrayBegin: () => {
            const array = [];
            onValue(array);
            previousParents.push(currentParent);
            currentParent = array;
            currentProperty = null;
        },
        onArrayEnd: () => {
            currentParent = previousParents.pop();
        },
        onLiteralValue: onValue,
        onError: (error, offset, length) => {
            errors.push({ error, offset, length });
        }
    };
    visit(text, visitor, options);
    return currentParent[0];
}
/**
 * Parses the given text and returns a tree representation the JSON content. On invalid input, the parser tries to be as fault tolerant as possible, but still return a result.
 */
function parser_parseTree(text, errors = [], options = parser_ParseOptions.DEFAULT) {
    let currentParent = { type: 'array', offset: -1, length: -1, children: [], parent: undefined }; // artificial root
    function ensurePropertyComplete(endOffset) {
        if (currentParent.type === 'property') {
            currentParent.length = endOffset - currentParent.offset;
            currentParent = currentParent.parent;
        }
    }
    function onValue(valueNode) {
        currentParent.children.push(valueNode);
        return valueNode;
    }
    const visitor = {
        onObjectBegin: (offset) => {
            currentParent = onValue({ type: 'object', offset, length: -1, parent: currentParent, children: [] });
        },
        onObjectProperty: (name, offset, length) => {
            currentParent = onValue({ type: 'property', offset, length: -1, parent: currentParent, children: [] });
            currentParent.children.push({ type: 'string', value: name, offset, length, parent: currentParent });
        },
        onObjectEnd: (offset, length) => {
            ensurePropertyComplete(offset + length); // in case of a missing value for a property: make sure property is complete
            currentParent.length = offset + length - currentParent.offset;
            currentParent = currentParent.parent;
            ensurePropertyComplete(offset + length);
        },
        onArrayBegin: (offset, length) => {
            currentParent = onValue({ type: 'array', offset, length: -1, parent: currentParent, children: [] });
        },
        onArrayEnd: (offset, length) => {
            currentParent.length = offset + length - currentParent.offset;
            currentParent = currentParent.parent;
            ensurePropertyComplete(offset + length);
        },
        onLiteralValue: (value, offset, length) => {
            onValue({ type: getNodeType(value), offset, length, parent: currentParent, value });
            ensurePropertyComplete(offset + length);
        },
        onSeparator: (sep, offset, length) => {
            if (currentParent.type === 'property') {
                if (sep === ':') {
                    currentParent.colonOffset = offset;
                }
                else if (sep === ',') {
                    ensurePropertyComplete(offset);
                }
            }
        },
        onError: (error, offset, length) => {
            errors.push({ error, offset, length });
        }
    };
    visit(text, visitor, options);
    const result = currentParent.children[0];
    if (result) {
        delete result.parent;
    }
    return result;
}
/**
 * Finds the node at the given path in a JSON DOM.
 */
function parser_findNodeAtLocation(root, path) {
    if (!root) {
        return undefined;
    }
    let node = root;
    for (let segment of path) {
        if (typeof segment === 'string') {
            if (node.type !== 'object' || !Array.isArray(node.children)) {
                return undefined;
            }
            let found = false;
            for (const propertyNode of node.children) {
                if (Array.isArray(propertyNode.children) && propertyNode.children[0].value === segment && propertyNode.children.length === 2) {
                    node = propertyNode.children[1];
                    found = true;
                    break;
                }
            }
            if (!found) {
                return undefined;
            }
        }
        else {
            const index = segment;
            if (node.type !== 'array' || index < 0 || !Array.isArray(node.children) || index >= node.children.length) {
                return undefined;
            }
            node = node.children[index];
        }
    }
    return node;
}
/**
 * Gets the JSON path of the given JSON DOM node
 */
function getNodePath(node) {
    if (!node.parent || !node.parent.children) {
        return [];
    }
    const path = getNodePath(node.parent);
    if (node.parent.type === 'property') {
        const key = node.parent.children[0].value;
        path.push(key);
    }
    else if (node.parent.type === 'array') {
        const index = node.parent.children.indexOf(node);
        if (index !== -1) {
            path.push(index);
        }
    }
    return path;
}
/**
 * Evaluates the JavaScript object of the given JSON DOM node
 */
function getNodeValue(node) {
    switch (node.type) {
        case 'array':
            return node.children.map(getNodeValue);
        case 'object':
            const obj = Object.create(null);
            for (let prop of node.children) {
                const valueNode = prop.children[1];
                if (valueNode) {
                    obj[prop.children[0].value] = getNodeValue(valueNode);
                }
            }
            return obj;
        case 'null':
        case 'string':
        case 'number':
        case 'boolean':
            return node.value;
        default:
            return undefined;
    }
}
function contains(node, offset, includeRightBound = false) {
    return (offset >= node.offset && offset < (node.offset + node.length)) || includeRightBound && (offset === (node.offset + node.length));
}
/**
 * Finds the most inner node at the given offset. If includeRightBound is set, also finds nodes that end at the given offset.
 */
function findNodeAtOffset(node, offset, includeRightBound = false) {
    if (contains(node, offset, includeRightBound)) {
        const children = node.children;
        if (Array.isArray(children)) {
            for (let i = 0; i < children.length && children[i].offset <= offset; i++) {
                const item = findNodeAtOffset(children[i], offset, includeRightBound);
                if (item) {
                    return item;
                }
            }
        }
        return node;
    }
    return undefined;
}
/**
 * Parses the given text and invokes the visitor functions for each object, array and literal reached.
 */
function visit(text, visitor, options = parser_ParseOptions.DEFAULT) {
    const _scanner = scanner_createScanner(text, false);
    // Important: Only pass copies of this to visitor functions to prevent accidental modification, and
    // to not affect visitor functions which stored a reference to a previous JSONPath
    const _jsonPath = [];
    // Depth of onXXXBegin() callbacks suppressed. onXXXEnd() decrements this if it isn't 0 already.
    // Callbacks are only called when this value is 0.
    let suppressedCallbacks = 0;
    function toNoArgVisit(visitFunction) {
        return visitFunction ? () => suppressedCallbacks === 0 && visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter()) : () => true;
    }
    function toOneArgVisit(visitFunction) {
        return visitFunction ? (arg) => suppressedCallbacks === 0 && visitFunction(arg, _scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter()) : () => true;
    }
    function toOneArgVisitWithPath(visitFunction) {
        return visitFunction ? (arg) => suppressedCallbacks === 0 && visitFunction(arg, _scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter(), () => _jsonPath.slice()) : () => true;
    }
    function toBeginVisit(visitFunction) {
        return visitFunction ?
            () => {
                if (suppressedCallbacks > 0) {
                    suppressedCallbacks++;
                }
                else {
                    let cbReturn = visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter(), () => _jsonPath.slice());
                    if (cbReturn === false) {
                        suppressedCallbacks = 1;
                    }
                }
            }
            : () => true;
    }
    function toEndVisit(visitFunction) {
        return visitFunction ?
            () => {
                if (suppressedCallbacks > 0) {
                    suppressedCallbacks--;
                }
                if (suppressedCallbacks === 0) {
                    visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter());
                }
            }
            : () => true;
    }
    const onObjectBegin = toBeginVisit(visitor.onObjectBegin), onObjectProperty = toOneArgVisitWithPath(visitor.onObjectProperty), onObjectEnd = toEndVisit(visitor.onObjectEnd), onArrayBegin = toBeginVisit(visitor.onArrayBegin), onArrayEnd = toEndVisit(visitor.onArrayEnd), onLiteralValue = toOneArgVisitWithPath(visitor.onLiteralValue), onSeparator = toOneArgVisit(visitor.onSeparator), onComment = toNoArgVisit(visitor.onComment), onError = toOneArgVisit(visitor.onError);
    const disallowComments = options && options.disallowComments;
    const allowTrailingComma = options && options.allowTrailingComma;
    function scanNext() {
        while (true) {
            const token = _scanner.scan();
            switch (_scanner.getTokenError()) {
                case 4 /* ScanError.InvalidUnicode */:
                    handleError(14 /* ParseErrorCode.InvalidUnicode */);
                    break;
                case 5 /* ScanError.InvalidEscapeCharacter */:
                    handleError(15 /* ParseErrorCode.InvalidEscapeCharacter */);
                    break;
                case 3 /* ScanError.UnexpectedEndOfNumber */:
                    handleError(13 /* ParseErrorCode.UnexpectedEndOfNumber */);
                    break;
                case 1 /* ScanError.UnexpectedEndOfComment */:
                    if (!disallowComments) {
                        handleError(11 /* ParseErrorCode.UnexpectedEndOfComment */);
                    }
                    break;
                case 2 /* ScanError.UnexpectedEndOfString */:
                    handleError(12 /* ParseErrorCode.UnexpectedEndOfString */);
                    break;
                case 6 /* ScanError.InvalidCharacter */:
                    handleError(16 /* ParseErrorCode.InvalidCharacter */);
                    break;
            }
            switch (token) {
                case 12 /* SyntaxKind.LineCommentTrivia */:
                case 13 /* SyntaxKind.BlockCommentTrivia */:
                    if (disallowComments) {
                        handleError(10 /* ParseErrorCode.InvalidCommentToken */);
                    }
                    else {
                        onComment();
                    }
                    break;
                case 16 /* SyntaxKind.Unknown */:
                    handleError(1 /* ParseErrorCode.InvalidSymbol */);
                    break;
                case 15 /* SyntaxKind.Trivia */:
                case 14 /* SyntaxKind.LineBreakTrivia */:
                    break;
                default:
                    return token;
            }
        }
    }
    function handleError(error, skipUntilAfter = [], skipUntil = []) {
        onError(error);
        if (skipUntilAfter.length + skipUntil.length > 0) {
            let token = _scanner.getToken();
            while (token !== 17 /* SyntaxKind.EOF */) {
                if (skipUntilAfter.indexOf(token) !== -1) {
                    scanNext();
                    break;
                }
                else if (skipUntil.indexOf(token) !== -1) {
                    break;
                }
                token = scanNext();
            }
        }
    }
    function parseString(isValue) {
        const value = _scanner.getTokenValue();
        if (isValue) {
            onLiteralValue(value);
        }
        else {
            onObjectProperty(value);
            // add property name afterwards
            _jsonPath.push(value);
        }
        scanNext();
        return true;
    }
    function parseLiteral() {
        switch (_scanner.getToken()) {
            case 11 /* SyntaxKind.NumericLiteral */:
                const tokenValue = _scanner.getTokenValue();
                let value = Number(tokenValue);
                if (isNaN(value)) {
                    handleError(2 /* ParseErrorCode.InvalidNumberFormat */);
                    value = 0;
                }
                onLiteralValue(value);
                break;
            case 7 /* SyntaxKind.NullKeyword */:
                onLiteralValue(null);
                break;
            case 8 /* SyntaxKind.TrueKeyword */:
                onLiteralValue(true);
                break;
            case 9 /* SyntaxKind.FalseKeyword */:
                onLiteralValue(false);
                break;
            default:
                return false;
        }
        scanNext();
        return true;
    }
    function parseProperty() {
        if (_scanner.getToken() !== 10 /* SyntaxKind.StringLiteral */) {
            handleError(3 /* ParseErrorCode.PropertyNameExpected */, [], [2 /* SyntaxKind.CloseBraceToken */, 5 /* SyntaxKind.CommaToken */]);
            return false;
        }
        parseString(false);
        if (_scanner.getToken() === 6 /* SyntaxKind.ColonToken */) {
            onSeparator(':');
            scanNext(); // consume colon
            if (!parseValue()) {
                handleError(4 /* ParseErrorCode.ValueExpected */, [], [2 /* SyntaxKind.CloseBraceToken */, 5 /* SyntaxKind.CommaToken */]);
            }
        }
        else {
            handleError(5 /* ParseErrorCode.ColonExpected */, [], [2 /* SyntaxKind.CloseBraceToken */, 5 /* SyntaxKind.CommaToken */]);
        }
        _jsonPath.pop(); // remove processed property name
        return true;
    }
    function parseObject() {
        onObjectBegin();
        scanNext(); // consume open brace
        let needsComma = false;
        while (_scanner.getToken() !== 2 /* SyntaxKind.CloseBraceToken */ && _scanner.getToken() !== 17 /* SyntaxKind.EOF */) {
            if (_scanner.getToken() === 5 /* SyntaxKind.CommaToken */) {
                if (!needsComma) {
                    handleError(4 /* ParseErrorCode.ValueExpected */, [], []);
                }
                onSeparator(',');
                scanNext(); // consume comma
                if (_scanner.getToken() === 2 /* SyntaxKind.CloseBraceToken */ && allowTrailingComma) {
                    break;
                }
            }
            else if (needsComma) {
                handleError(6 /* ParseErrorCode.CommaExpected */, [], []);
            }
            if (!parseProperty()) {
                handleError(4 /* ParseErrorCode.ValueExpected */, [], [2 /* SyntaxKind.CloseBraceToken */, 5 /* SyntaxKind.CommaToken */]);
            }
            needsComma = true;
        }
        onObjectEnd();
        if (_scanner.getToken() !== 2 /* SyntaxKind.CloseBraceToken */) {
            handleError(7 /* ParseErrorCode.CloseBraceExpected */, [2 /* SyntaxKind.CloseBraceToken */], []);
        }
        else {
            scanNext(); // consume close brace
        }
        return true;
    }
    function parseArray() {
        onArrayBegin();
        scanNext(); // consume open bracket
        let isFirstElement = true;
        let needsComma = false;
        while (_scanner.getToken() !== 4 /* SyntaxKind.CloseBracketToken */ && _scanner.getToken() !== 17 /* SyntaxKind.EOF */) {
            if (_scanner.getToken() === 5 /* SyntaxKind.CommaToken */) {
                if (!needsComma) {
                    handleError(4 /* ParseErrorCode.ValueExpected */, [], []);
                }
                onSeparator(',');
                scanNext(); // consume comma
                if (_scanner.getToken() === 4 /* SyntaxKind.CloseBracketToken */ && allowTrailingComma) {
                    break;
                }
            }
            else if (needsComma) {
                handleError(6 /* ParseErrorCode.CommaExpected */, [], []);
            }
            if (isFirstElement) {
                _jsonPath.push(0);
                isFirstElement = false;
            }
            else {
                _jsonPath[_jsonPath.length - 1]++;
            }
            if (!parseValue()) {
                handleError(4 /* ParseErrorCode.ValueExpected */, [], [4 /* SyntaxKind.CloseBracketToken */, 5 /* SyntaxKind.CommaToken */]);
            }
            needsComma = true;
        }
        onArrayEnd();
        if (!isFirstElement) {
            _jsonPath.pop(); // remove array index
        }
        if (_scanner.getToken() !== 4 /* SyntaxKind.CloseBracketToken */) {
            handleError(8 /* ParseErrorCode.CloseBracketExpected */, [4 /* SyntaxKind.CloseBracketToken */], []);
        }
        else {
            scanNext(); // consume close bracket
        }
        return true;
    }
    function parseValue() {
        switch (_scanner.getToken()) {
            case 3 /* SyntaxKind.OpenBracketToken */:
                return parseArray();
            case 1 /* SyntaxKind.OpenBraceToken */:
                return parseObject();
            case 10 /* SyntaxKind.StringLiteral */:
                return parseString(true);
            default:
                return parseLiteral();
        }
    }
    scanNext();
    if (_scanner.getToken() === 17 /* SyntaxKind.EOF */) {
        if (options.allowEmptyContent) {
            return true;
        }
        handleError(4 /* ParseErrorCode.ValueExpected */, [], []);
        return false;
    }
    if (!parseValue()) {
        handleError(4 /* ParseErrorCode.ValueExpected */, [], []);
        return false;
    }
    if (_scanner.getToken() !== 17 /* SyntaxKind.EOF */) {
        handleError(9 /* ParseErrorCode.EndOfFileExpected */, [], []);
    }
    return true;
}
/**
 * Takes JSON with JavaScript-style comments and remove
 * them. Optionally replaces every none-newline character
 * of comments with a replaceCharacter
 */
function stripComments(text, replaceCh) {
    let _scanner = scanner_createScanner(text), parts = [], kind, offset = 0, pos;
    do {
        pos = _scanner.getPosition();
        kind = _scanner.scan();
        switch (kind) {
            case 12 /* SyntaxKind.LineCommentTrivia */:
            case 13 /* SyntaxKind.BlockCommentTrivia */:
            case 17 /* SyntaxKind.EOF */:
                if (offset !== pos) {
                    parts.push(text.substring(offset, pos));
                }
                if (replaceCh !== undefined) {
                    parts.push(_scanner.getTokenValue().replace(/[^\r\n]/g, replaceCh));
                }
                offset = _scanner.getPosition();
                break;
        }
    } while (kind !== 17 /* SyntaxKind.EOF */);
    return parts.join('');
}
function getNodeType(value) {
    switch (typeof value) {
        case 'boolean': return 'boolean';
        case 'number': return 'number';
        case 'string': return 'string';
        case 'object': {
            if (!value) {
                return 'null';
            }
            else if (Array.isArray(value)) {
                return 'array';
            }
            return 'object';
        }
        default: return 'null';
    }
}

;// CONCATENATED MODULE: ./node_modules/.pnpm/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/impl/edit.js
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/



function removeProperty(text, path, options) {
    return setProperty(text, path, void 0, options);
}
function setProperty(text, originalPath, value, options) {
    const path = originalPath.slice();
    const errors = [];
    const root = parseTree(text, errors);
    let parent = void 0;
    let lastSegment = void 0;
    while (path.length > 0) {
        lastSegment = path.pop();
        parent = findNodeAtLocation(root, path);
        if (parent === void 0 && value !== void 0) {
            if (typeof lastSegment === 'string') {
                value = { [lastSegment]: value };
            }
            else {
                value = [value];
            }
        }
        else {
            break;
        }
    }
    if (!parent) {
        // empty document
        if (value === void 0) { // delete
            throw new Error('Can not delete in empty document');
        }
        return withFormatting(text, { offset: root ? root.offset : 0, length: root ? root.length : 0, content: JSON.stringify(value) }, options);
    }
    else if (parent.type === 'object' && typeof lastSegment === 'string' && Array.isArray(parent.children)) {
        const existing = findNodeAtLocation(parent, [lastSegment]);
        if (existing !== void 0) {
            if (value === void 0) { // delete
                if (!existing.parent) {
                    throw new Error('Malformed AST');
                }
                const propertyIndex = parent.children.indexOf(existing.parent);
                let removeBegin;
                let removeEnd = existing.parent.offset + existing.parent.length;
                if (propertyIndex > 0) {
                    // remove the comma of the previous node
                    let previous = parent.children[propertyIndex - 1];
                    removeBegin = previous.offset + previous.length;
                }
                else {
                    removeBegin = parent.offset + 1;
                    if (parent.children.length > 1) {
                        // remove the comma of the next node
                        let next = parent.children[1];
                        removeEnd = next.offset;
                    }
                }
                return withFormatting(text, { offset: removeBegin, length: removeEnd - removeBegin, content: '' }, options);
            }
            else {
                // set value of existing property
                return withFormatting(text, { offset: existing.offset, length: existing.length, content: JSON.stringify(value) }, options);
            }
        }
        else {
            if (value === void 0) { // delete
                return []; // property does not exist, nothing to do
            }
            const newProperty = `${JSON.stringify(lastSegment)}: ${JSON.stringify(value)}`;
            const index = options.getInsertionIndex ? options.getInsertionIndex(parent.children.map(p => p.children[0].value)) : parent.children.length;
            let edit;
            if (index > 0) {
                let previous = parent.children[index - 1];
                edit = { offset: previous.offset + previous.length, length: 0, content: ',' + newProperty };
            }
            else if (parent.children.length === 0) {
                edit = { offset: parent.offset + 1, length: 0, content: newProperty };
            }
            else {
                edit = { offset: parent.offset + 1, length: 0, content: newProperty + ',' };
            }
            return withFormatting(text, edit, options);
        }
    }
    else if (parent.type === 'array' && typeof lastSegment === 'number' && Array.isArray(parent.children)) {
        const insertIndex = lastSegment;
        if (insertIndex === -1) {
            // Insert
            const newProperty = `${JSON.stringify(value)}`;
            let edit;
            if (parent.children.length === 0) {
                edit = { offset: parent.offset + 1, length: 0, content: newProperty };
            }
            else {
                const previous = parent.children[parent.children.length - 1];
                edit = { offset: previous.offset + previous.length, length: 0, content: ',' + newProperty };
            }
            return withFormatting(text, edit, options);
        }
        else if (value === void 0 && parent.children.length >= 0) {
            // Removal
            const removalIndex = lastSegment;
            const toRemove = parent.children[removalIndex];
            let edit;
            if (parent.children.length === 1) {
                // only item
                edit = { offset: parent.offset + 1, length: parent.length - 2, content: '' };
            }
            else if (parent.children.length - 1 === removalIndex) {
                // last item
                let previous = parent.children[removalIndex - 1];
                let offset = previous.offset + previous.length;
                let parentEndOffset = parent.offset + parent.length;
                edit = { offset, length: parentEndOffset - 2 - offset, content: '' };
            }
            else {
                edit = { offset: toRemove.offset, length: parent.children[removalIndex + 1].offset - toRemove.offset, content: '' };
            }
            return withFormatting(text, edit, options);
        }
        else if (value !== void 0) {
            let edit;
            const newProperty = `${JSON.stringify(value)}`;
            if (!options.isArrayInsertion && parent.children.length > lastSegment) {
                const toModify = parent.children[lastSegment];
                edit = { offset: toModify.offset, length: toModify.length, content: newProperty };
            }
            else if (parent.children.length === 0 || lastSegment === 0) {
                edit = { offset: parent.offset + 1, length: 0, content: parent.children.length === 0 ? newProperty : newProperty + ',' };
            }
            else {
                const index = lastSegment > parent.children.length ? parent.children.length : lastSegment;
                const previous = parent.children[index - 1];
                edit = { offset: previous.offset + previous.length, length: 0, content: ',' + newProperty };
            }
            return withFormatting(text, edit, options);
        }
        else {
            throw new Error(`Can not ${value === void 0 ? 'remove' : (options.isArrayInsertion ? 'insert' : 'modify')} Array index ${insertIndex} as length is not sufficient`);
        }
    }
    else {
        throw new Error(`Can not add ${typeof lastSegment !== 'number' ? 'index' : 'property'} to parent of type ${parent.type}`);
    }
}
function withFormatting(text, edit, options) {
    if (!options.formattingOptions) {
        return [edit];
    }
    // apply the edit
    let newText = applyEdit(text, edit);
    // format the new text
    let begin = edit.offset;
    let end = edit.offset + edit.content.length;
    if (edit.length === 0 || edit.content.length === 0) { // insert or remove
        while (begin > 0 && !isEOL(newText, begin - 1)) {
            begin--;
        }
        while (end < newText.length && !isEOL(newText, end)) {
            end++;
        }
    }
    const edits = format(newText, { offset: begin, length: end - begin }, { ...options.formattingOptions, keepLines: false });
    // apply the formatting edits and track the begin and end offsets of the changes
    for (let i = edits.length - 1; i >= 0; i--) {
        const edit = edits[i];
        newText = applyEdit(newText, edit);
        begin = Math.min(begin, edit.offset);
        end = Math.max(end, edit.offset + edit.length);
        end += edit.content.length - edit.length;
    }
    // create a single edit with all changes
    const editLength = text.length - (newText.length - end) - begin;
    return [{ offset: begin, length: editLength, content: newText.substring(begin, end) }];
}
function applyEdit(text, edit) {
    return text.substring(0, edit.offset) + edit.content + text.substring(edit.offset + edit.length);
}
function isWS(text, offset) {
    return '\r\n \t'.indexOf(text.charAt(offset)) !== -1;
}

;// CONCATENATED MODULE: ./node_modules/.pnpm/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/main.js
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/





/**
 * Creates a JSON scanner on the given text.
 * If ignoreTrivia is set, whitespaces or comments are ignored.
 */
const main_createScanner = scanner_createScanner;
var main_ScanError;
(function (ScanError) {
    ScanError[ScanError["None"] = 0] = "None";
    ScanError[ScanError["UnexpectedEndOfComment"] = 1] = "UnexpectedEndOfComment";
    ScanError[ScanError["UnexpectedEndOfString"] = 2] = "UnexpectedEndOfString";
    ScanError[ScanError["UnexpectedEndOfNumber"] = 3] = "UnexpectedEndOfNumber";
    ScanError[ScanError["InvalidUnicode"] = 4] = "InvalidUnicode";
    ScanError[ScanError["InvalidEscapeCharacter"] = 5] = "InvalidEscapeCharacter";
    ScanError[ScanError["InvalidCharacter"] = 6] = "InvalidCharacter";
})(main_ScanError || (main_ScanError = {}));
var main_SyntaxKind;
(function (SyntaxKind) {
    SyntaxKind[SyntaxKind["OpenBraceToken"] = 1] = "OpenBraceToken";
    SyntaxKind[SyntaxKind["CloseBraceToken"] = 2] = "CloseBraceToken";
    SyntaxKind[SyntaxKind["OpenBracketToken"] = 3] = "OpenBracketToken";
    SyntaxKind[SyntaxKind["CloseBracketToken"] = 4] = "CloseBracketToken";
    SyntaxKind[SyntaxKind["CommaToken"] = 5] = "CommaToken";
    SyntaxKind[SyntaxKind["ColonToken"] = 6] = "ColonToken";
    SyntaxKind[SyntaxKind["NullKeyword"] = 7] = "NullKeyword";
    SyntaxKind[SyntaxKind["TrueKeyword"] = 8] = "TrueKeyword";
    SyntaxKind[SyntaxKind["FalseKeyword"] = 9] = "FalseKeyword";
    SyntaxKind[SyntaxKind["StringLiteral"] = 10] = "StringLiteral";
    SyntaxKind[SyntaxKind["NumericLiteral"] = 11] = "NumericLiteral";
    SyntaxKind[SyntaxKind["LineCommentTrivia"] = 12] = "LineCommentTrivia";
    SyntaxKind[SyntaxKind["BlockCommentTrivia"] = 13] = "BlockCommentTrivia";
    SyntaxKind[SyntaxKind["LineBreakTrivia"] = 14] = "LineBreakTrivia";
    SyntaxKind[SyntaxKind["Trivia"] = 15] = "Trivia";
    SyntaxKind[SyntaxKind["Unknown"] = 16] = "Unknown";
    SyntaxKind[SyntaxKind["EOF"] = 17] = "EOF";
})(main_SyntaxKind || (main_SyntaxKind = {}));
/**
 * For a given offset, evaluate the location in the JSON document. Each segment in the location path is either a property name or an array index.
 */
const main_getLocation = getLocation;
/**
 * Parses the given text and returns the object the JSON content represents. On invalid input, the parser tries to be as fault tolerant as possible, but still return a result.
 * Therefore, always check the errors list to find out if the input was valid.
 */
const main_parse = parse;
/**
 * Parses the given text and returns a tree representation the JSON content. On invalid input, the parser tries to be as fault tolerant as possible, but still return a result.
 */
const main_parseTree = parser_parseTree;
/**
 * Finds the node at the given path in a JSON DOM.
 */
const main_findNodeAtLocation = parser_findNodeAtLocation;
/**
 * Finds the innermost node at the given offset. If includeRightBound is set, also finds nodes that end at the given offset.
 */
const main_findNodeAtOffset = findNodeAtOffset;
/**
 * Gets the JSON path of the given JSON DOM node
 */
const main_getNodePath = getNodePath;
/**
 * Evaluates the JavaScript object of the given JSON DOM node
 */
const main_getNodeValue = getNodeValue;
/**
 * Parses the given text and invokes the visitor functions for each object, array and literal reached.
 */
const main_visit = visit;
/**
 * Takes JSON with JavaScript-style comments and remove
 * them. Optionally replaces every none-newline character
 * of comments with a replaceCharacter
 */
const main_stripComments = stripComments;
var main_ParseErrorCode;
(function (ParseErrorCode) {
    ParseErrorCode[ParseErrorCode["InvalidSymbol"] = 1] = "InvalidSymbol";
    ParseErrorCode[ParseErrorCode["InvalidNumberFormat"] = 2] = "InvalidNumberFormat";
    ParseErrorCode[ParseErrorCode["PropertyNameExpected"] = 3] = "PropertyNameExpected";
    ParseErrorCode[ParseErrorCode["ValueExpected"] = 4] = "ValueExpected";
    ParseErrorCode[ParseErrorCode["ColonExpected"] = 5] = "ColonExpected";
    ParseErrorCode[ParseErrorCode["CommaExpected"] = 6] = "CommaExpected";
    ParseErrorCode[ParseErrorCode["CloseBraceExpected"] = 7] = "CloseBraceExpected";
    ParseErrorCode[ParseErrorCode["CloseBracketExpected"] = 8] = "CloseBracketExpected";
    ParseErrorCode[ParseErrorCode["EndOfFileExpected"] = 9] = "EndOfFileExpected";
    ParseErrorCode[ParseErrorCode["InvalidCommentToken"] = 10] = "InvalidCommentToken";
    ParseErrorCode[ParseErrorCode["UnexpectedEndOfComment"] = 11] = "UnexpectedEndOfComment";
    ParseErrorCode[ParseErrorCode["UnexpectedEndOfString"] = 12] = "UnexpectedEndOfString";
    ParseErrorCode[ParseErrorCode["UnexpectedEndOfNumber"] = 13] = "UnexpectedEndOfNumber";
    ParseErrorCode[ParseErrorCode["InvalidUnicode"] = 14] = "InvalidUnicode";
    ParseErrorCode[ParseErrorCode["InvalidEscapeCharacter"] = 15] = "InvalidEscapeCharacter";
    ParseErrorCode[ParseErrorCode["InvalidCharacter"] = 16] = "InvalidCharacter";
})(main_ParseErrorCode || (main_ParseErrorCode = {}));
function printParseErrorCode(code) {
    switch (code) {
        case 1 /* ParseErrorCode.InvalidSymbol */: return 'InvalidSymbol';
        case 2 /* ParseErrorCode.InvalidNumberFormat */: return 'InvalidNumberFormat';
        case 3 /* ParseErrorCode.PropertyNameExpected */: return 'PropertyNameExpected';
        case 4 /* ParseErrorCode.ValueExpected */: return 'ValueExpected';
        case 5 /* ParseErrorCode.ColonExpected */: return 'ColonExpected';
        case 6 /* ParseErrorCode.CommaExpected */: return 'CommaExpected';
        case 7 /* ParseErrorCode.CloseBraceExpected */: return 'CloseBraceExpected';
        case 8 /* ParseErrorCode.CloseBracketExpected */: return 'CloseBracketExpected';
        case 9 /* ParseErrorCode.EndOfFileExpected */: return 'EndOfFileExpected';
        case 10 /* ParseErrorCode.InvalidCommentToken */: return 'InvalidCommentToken';
        case 11 /* ParseErrorCode.UnexpectedEndOfComment */: return 'UnexpectedEndOfComment';
        case 12 /* ParseErrorCode.UnexpectedEndOfString */: return 'UnexpectedEndOfString';
        case 13 /* ParseErrorCode.UnexpectedEndOfNumber */: return 'UnexpectedEndOfNumber';
        case 14 /* ParseErrorCode.InvalidUnicode */: return 'InvalidUnicode';
        case 15 /* ParseErrorCode.InvalidEscapeCharacter */: return 'InvalidEscapeCharacter';
        case 16 /* ParseErrorCode.InvalidCharacter */: return 'InvalidCharacter';
    }
    return '<unknown ParseErrorCode>';
}
/**
 * Computes the edit operations needed to format a JSON document.
 *
 * @param documentText The input text
 * @param range The range to format or `undefined` to format the full content
 * @param options The formatting options
 * @returns The edit operations describing the formatting changes to the original document following the format described in {@linkcode EditResult}.
 * To apply the edit operations to the input, use {@linkcode applyEdits}.
 */
function main_format(documentText, range, options) {
    return formatter.format(documentText, range, options);
}
/**
 * Computes the edit operations needed to modify a value in the JSON document.
 *
 * @param documentText The input text
 * @param path The path of the value to change. The path represents either to the document root, a property or an array item.
 * If the path points to an non-existing property or item, it will be created.
 * @param value The new value for the specified property or item. If the value is undefined,
 * the property or item will be removed.
 * @param options Options
 * @returns The edit operations describing the changes to the original document, following the format described in {@linkcode EditResult}.
 * To apply the edit operations to the input, use {@linkcode applyEdits}.
 */
function modify(text, path, value, options) {
    return edit.setProperty(text, path, value, options);
}
/**
 * Applies edits to an input string.
 * @param text The input text
 * @param edits Edit operations following the format described in {@linkcode EditResult}.
 * @returns The text with the applied edits.
 * @throws An error if the edit operations are not well-formed as described in {@linkcode EditResult}.
 */
function applyEdits(text, edits) {
    let sortedEdits = edits.slice(0).sort((a, b) => {
        const diff = a.offset - b.offset;
        if (diff === 0) {
            return a.length - b.length;
        }
        return diff;
    });
    let lastModifiedOffset = text.length;
    for (let i = sortedEdits.length - 1; i >= 0; i--) {
        let e = sortedEdits[i];
        if (e.offset + e.length <= lastModifiedOffset) {
            text = edit.applyEdit(text, e);
        }
        else {
            throw new Error('Overlapping edit');
        }
        lastModifiedOffset = e.offset;
    }
    return text;
}

;// CONCATENATED MODULE: ./src/utils/load-release-config.ts




/**
 * Config file names to search for (in order of preference)
 */ const CONFIG_FILE_NAMES = (/* unused pure expression or super */ null && ([
    "silk-release.json",
    "silk-release.jsonc"
]));
/**
 * Environment variable name for variable-based configuration
 */ const CONFIG_ENV_VAR = "SILK_RELEASE_SBOM_TEMPLATE";
/**
 * Action input name for SBOM configuration
 */ const CONFIG_INPUT_NAME = "sbom-config";
/**
 * Validate SBOM metadata configuration
 *
 * @remarks
 * Performs basic validation of the SBOM metadata configuration structure.
 * Does not enforce required fields since the config is merged with inferred values.
 *
 * @param config - Configuration to validate
 * @returns Array of validation error messages (empty if valid)
 */ function validateSBOMConfig(config) {
    const errors = [];
    if (config === null || config === undefined) {
        return errors; // Empty config is valid
    }
    if (typeof config !== "object") {
        errors.push(`sbom config must be an object, got ${typeof config}`);
        return errors;
    }
    const sbomConfig = config;
    // Validate supplier
    if (sbomConfig.supplier !== undefined) {
        if (typeof sbomConfig.supplier !== "object" || sbomConfig.supplier === null) {
            errors.push("sbom.supplier must be an object");
        } else {
            const supplier = sbomConfig.supplier;
            if (supplier.name !== undefined && typeof supplier.name !== "string") {
                errors.push("sbom.supplier.name must be a string");
            }
            if (supplier.url !== undefined) {
                if (typeof supplier.url !== "string" && !Array.isArray(supplier.url)) {
                    errors.push("sbom.supplier.url must be a string or array of strings");
                }
            }
        }
    }
    // Validate copyright
    if (sbomConfig.copyright !== undefined) {
        if (typeof sbomConfig.copyright !== "object" || sbomConfig.copyright === null) {
            errors.push("sbom.copyright must be an object");
        } else {
            const copyright = sbomConfig.copyright;
            if (copyright.holder !== undefined && typeof copyright.holder !== "string") {
                errors.push("sbom.copyright.holder must be a string");
            }
            if (copyright.startYear !== undefined && typeof copyright.startYear !== "number") {
                errors.push("sbom.copyright.startYear must be a number");
            }
        }
    }
    // Validate publisher
    if (sbomConfig.publisher !== undefined && typeof sbomConfig.publisher !== "string") {
        errors.push("sbom.publisher must be a string");
    }
    // Validate documentationUrl
    if (sbomConfig.documentationUrl !== undefined && typeof sbomConfig.documentationUrl !== "string") {
        errors.push("sbom.documentationUrl must be a string");
    }
    return errors;
}
/**
 * SBOM config fields that indicate an unwrapped configuration
 */ const SBOM_CONFIG_FIELDS = (/* unused pure expression or super */ null && ([
    "supplier",
    "copyright",
    "publisher",
    "documentationUrl"
]));
/**
 * Check if a parsed config appears to be an unwrapped SBOMMetadataConfig
 *
 * @remarks
 * Detects if the config contains SBOM fields at the root level rather than
 * being wrapped in an `sbom` key. This is used to provide helpful error messages.
 *
 * @param config - Parsed configuration object
 * @returns Array of SBOM field names found at root level, empty if none
 */ function detectUnwrappedSBOMFields(config) {
    return SBOM_CONFIG_FIELDS.filter((field)=>config[field] !== undefined);
}
/**
 * Parse and validate configuration content
 *
 * @param content - Raw JSON/JSONC content
 * @param source - Source description for error messages
 * @returns Parsed configuration or undefined if invalid
 */ function parseConfigContent(content, source) {
    try {
        const errors = [];
        const parsed = parseJsonc(content, errors);
        if (errors.length > 0) {
            warning(`Failed to parse config from ${source}: JSON syntax error at offset ${errors[0].offset}`);
            return undefined;
        }
        // Check for unwrapped SBOM config (common mistake)
        const unwrappedFields = detectUnwrappedSBOMFields(parsed);
        if (unwrappedFields.length > 0 && parsed.sbom === undefined) {
            warning(`Invalid config structure from ${source}: Found SBOM fields (${unwrappedFields.join(", ")}) at root level.\n` + `  The configuration must be wrapped in an "sbom" key.\n` + `  Expected: { "sbom": { "supplier": {...}, ... } }\n` + `  Found:    { "supplier": {...}, ... }\n` + `  See schema: https://raw.githubusercontent.com/savvy-web/workflow-release-action/main/.github/silk-release.schema.json`);
            return undefined;
        }
        // Validate the sbom section if present
        const releaseConfig = parsed;
        if (releaseConfig.sbom !== undefined) {
            const validationErrors = validateSBOMConfig(releaseConfig.sbom);
            if (validationErrors.length > 0) {
                warning(`Invalid SBOM config from ${source}:\n${validationErrors.map((e)=>`  - ${e}`).join("\n")}`);
                return undefined;
            }
        }
        return releaseConfig;
    } catch (error) {
        warning(`Failed to parse config from ${source}: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * Load release configuration from a local file
 *
 * @param configPath - Path to the configuration file
 * @returns Parsed configuration or undefined if file doesn't exist or is invalid
 */ function loadConfigFromFile(configPath) {
    if (!existsSync(configPath)) {
        return undefined;
    }
    const content = readFileSync(configPath, "utf-8");
    return parseConfigContent(content, configPath);
}
/**
 * Load configuration from local repository
 *
 * @param rootDir - Repository root directory
 * @returns Configuration or undefined if not found
 */ function loadConfigFromLocalRepo(rootDir) {
    for (const fileName of CONFIG_FILE_NAMES){
        const configPath = join(rootDir, ".github", fileName);
        const config = loadConfigFromFile(configPath);
        if (config !== undefined) {
            info(`Loaded Silk release config from .github/${fileName}`);
            debug(`Release config: ${JSON.stringify(config)}`);
            return config;
        }
    }
    return undefined;
}
/**
 * Load configuration from SILK_RELEASE_SBOM_TEMPLATE environment variable
 *
 * @remarks
 * This allows organizations to store the configuration as a GitHub variable
 * and pass it to the workflow as an environment variable. The variable can
 * be defined at the repository or organization level.
 *
 * **Important:** Organization/repository variables must be explicitly passed
 * to the action as environment variables in the workflow:
 *
 * ```yaml
 * - uses: savvy-web/workflow-release-action@main
 *   env:
 *     SILK_RELEASE_SBOM_TEMPLATE: ${{ vars.SILK_RELEASE_SBOM_TEMPLATE }}
 * ```
 *
 * The variable must contain a valid ReleaseConfig with the SBOM config
 * wrapped in an `sbom` key: `{ "sbom": { "supplier": {...} } }`
 *
 * @returns Configuration or undefined if not set or invalid
 */ function loadConfigFromEnvVar() {
    const envValue = process.env[CONFIG_ENV_VAR];
    if (!envValue) {
        debug(`${CONFIG_ENV_VAR} environment variable not set`);
        return undefined;
    }
    info(`Found ${CONFIG_ENV_VAR} environment variable (${envValue.length} chars)`);
    const config = parseConfigContent(envValue, `${CONFIG_ENV_VAR} variable`);
    if (config !== undefined) {
        info(`Loaded Silk release config from ${CONFIG_ENV_VAR} variable`);
        if (config.sbom?.supplier?.name) {
            info(`  Supplier: ${config.sbom.supplier.name}`);
        }
        debug(`Release config: ${JSON.stringify(config)}`);
        return config;
    }
    return undefined;
}
/**
 * Load configuration from sbom-config action input
 *
 * @remarks
 * This allows the SBOM configuration to be passed directly as an action input,
 * which is useful for reusable workflows where environment variables don't
 * propagate through the workflow_call chain.
 *
 * @returns Configuration or undefined if not set or invalid
 */ function loadConfigFromInput() {
    let inputValue;
    try {
        inputValue = getInput(CONFIG_INPUT_NAME);
    } catch  {
        // getInput may throw if we're not in an action context
        return undefined;
    }
    if (!inputValue) {
        debug(`${CONFIG_INPUT_NAME} action input not set`);
        return undefined;
    }
    info(`Found ${CONFIG_INPUT_NAME} action input (${inputValue.length} chars)`);
    const config = parseConfigContent(inputValue, `${CONFIG_INPUT_NAME} input`);
    if (config !== undefined) {
        info(`Loaded Silk release config from ${CONFIG_INPUT_NAME} input`);
        if (config.sbom?.supplier?.name) {
            info(`  Supplier: ${config.sbom.supplier.name}`);
        }
        debug(`Release config: ${JSON.stringify(config)}`);
        return config;
    }
    return undefined;
}
/**
 * Load release configuration with fallback lookup
 *
 * @remarks
 * Searches for Silk release configuration in the following order:
 *
 * 1. **Local repository**: `.github/silk-release.json` or `.github/silk-release.jsonc`
 *    in the repository being released
 *
 * 2. **Action input**: `sbom-config` input parameter (useful for reusable workflows)
 *
 * 3. **Environment variable**: `SILK_RELEASE_SBOM_TEMPLATE` environment variable
 *
 * The first configuration found is used. This allows:
 * - Repository-specific config in the repo itself
 * - Organization-wide defaults via action input or environment variable
 *
 * @param rootDir - Repository root directory (defaults to process.cwd())
 * @returns Release configuration with source information
 *
 * @example
 * ```typescript
 * const result = loadReleaseConfig();
 * if (result.config) {
 *   console.log(`Config loaded from: ${result.source.source}`);
 * }
 * ```
 */ function loadReleaseConfig(rootDir) {
    const root = rootDir || process.cwd();
    // 1. Check local repository
    const localConfig = loadConfigFromLocalRepo(root);
    if (localConfig !== undefined) {
        return {
            config: localConfig,
            source: {
                source: "local",
                location: ".github/silk-release.json"
            }
        };
    }
    // 2. Check action input (preferred for reusable workflows)
    const inputConfig = loadConfigFromInput();
    if (inputConfig !== undefined) {
        return {
            config: inputConfig,
            source: {
                source: "input",
                location: CONFIG_INPUT_NAME
            }
        };
    }
    // 3. Check environment variable
    const envConfig = loadConfigFromEnvVar();
    if (envConfig !== undefined) {
        return {
            config: envConfig,
            source: {
                source: "variable",
                location: CONFIG_ENV_VAR
            }
        };
    }
    debug("No Silk release configuration found");
    return {
        config: undefined,
        source: {
            source: "none"
        }
    };
}
/**
 * Load SBOM metadata configuration
 *
 * @remarks
 * Convenience function to load just the SBOM section of the release configuration.
 * Uses fallback lookup: local repo → environment variable.
 *
 * @param rootDir - Repository root directory (defaults to process.cwd())
 * @returns SBOM metadata configuration or undefined if not found
 */ function load_release_config_loadSBOMConfig(rootDir) {
    const result = loadReleaseConfig(rootDir);
    return result.config?.sbom;
}

;// CONCATENATED MODULE: ./src/utils/enhance-sbom-metadata.ts




/**
 * Generate PURL (Package URL) for an npm package
 *
 * @param packageName - Package name (may include scope)
 * @param version - Package version
 * @returns PURL string in format pkg:npm/[@scope/]name@version
 */ function generatePurl(packageName, version) {
    // Encode the package name properly for PURL
    // Scoped packages: @scope/name -> pkg:npm/%40scope/name@version
    const encodedName = packageName.startsWith("@") ? `%40${packageName.slice(1)}` : packageName;
    return `pkg:npm/${encodedName}@${version}`;
}
/**
 * Enhance a CycloneDX SBOM document with additional metadata
 *
 * @remarks
 * This function enriches a generated SBOM with:
 * - Supplier information (required for NTIA compliance)
 * - Component metadata (publisher, copyright, external references)
 * - PURL for unique identification
 *
 * The metadata is sourced from:
 * 1. Auto-inferred values from package.json
 * 2. Explicit configuration from .github/silk-release.json
 * 3. Auto-detected copyright year from npm registry
 *
 * @param sbom - Original SBOM document from cdxgen
 * @param options - Enhancement options
 * @returns Enhanced SBOM document with additional metadata
 */ async function enhance_sbom_metadata_enhanceSBOMMetadata(sbom, options) {
    const { packageName, packageVersion, packageDirectory, rootDirectory, registry } = options;
    info(`Enhancing SBOM metadata for ${packageName}@${packageVersion}`);
    // Load or use provided config
    const config = options.sbomConfig ?? loadSBOMConfig(rootDirectory);
    // Infer metadata from package.json
    const inferred = inferSBOMMetadata(packageDirectory);
    // Detect copyright year (from config or npm registry)
    const copyrightYearResult = await detectCopyrightYear(packageName, config?.copyright?.startYear, registry);
    debug(`Copyright year for ${packageName}: ${copyrightYearResult.startYear} (source: ${copyrightYearResult.source})`);
    // Resolve final metadata (config overrides inferred)
    const resolved = resolveSBOMMetadata(inferred, config, copyrightYearResult.startYear);
    // Create enhanced SBOM
    const enhanced = {
        ...sbom,
        metadata: {
            ...sbom.metadata,
            timestamp: sbom.metadata?.timestamp || new Date().toISOString()
        }
    };
    // Add supplier information
    if (resolved.supplier) {
        enhanced.metadata = {
            ...enhanced.metadata,
            supplier: {
                name: resolved.supplier.name,
                url: resolved.supplier.url,
                contact: resolved.supplier.contact
            }
        };
    }
    // Enhance component metadata
    const existingComponent = sbom.metadata?.component || {};
    enhanced.metadata = {
        ...enhanced.metadata,
        component: {
            ...existingComponent,
            type: existingComponent.type || "library",
            name: packageName,
            version: packageVersion,
            purl: generatePurl(packageName, packageVersion),
            publisher: resolved.component?.publisher || existingComponent.name,
            copyright: resolved.component?.copyright,
            externalReferences: mergeExternalReferences(existingComponent.externalReferences, resolved.component?.externalReferences)
        }
    };
    // Ensure tools are present (for NTIA author field)
    if (!enhanced.metadata?.tools?.components?.length) {
        enhanced.metadata = {
            ...enhanced.metadata,
            tools: {
                components: [
                    {
                        type: "application",
                        name: "workflow-release-action",
                        version: "1.0.0"
                    }
                ]
            }
        };
    }
    debug(`Enhanced SBOM metadata: supplier=${enhanced.metadata?.supplier?.name}, purl=${enhanced.metadata?.component?.purl}`);
    return enhanced;
}
/**
 * Merge external references, avoiding duplicates
 */ function mergeExternalReferences(existing, additional) {
    if (!existing && !additional) {
        return undefined;
    }
    const merged = new Map();
    // Add existing references first
    for (const ref of existing || []){
        merged.set(`${ref.type}:${ref.url}`, ref);
    }
    // Add additional references (won't overwrite existing same-type refs)
    for (const ref of additional || []){
        const key = `${ref.type}:${ref.url}`;
        if (!merged.has(key)) {
            merged.set(key, ref);
        }
    }
    const result = Array.from(merged.values());
    return result.length > 0 ? result : undefined;
}
/**
 * Quick enhancement for SBOM without async copyright detection
 *
 * @remarks
 * Use this when you already have resolved metadata or don't need
 * copyright year detection from the npm registry.
 *
 * @param sbom - Original SBOM document
 * @param packageName - Package name
 * @param packageVersion - Package version
 * @param metadata - Pre-resolved metadata
 * @returns Enhanced SBOM document
 */ function enhanceSBOMWithMetadata(sbom, packageName, packageVersion, metadata) {
    const enhanced = {
        ...sbom,
        metadata: {
            ...sbom.metadata,
            timestamp: sbom.metadata?.timestamp || new Date().toISOString()
        }
    };
    // Add supplier if present
    if (metadata.supplier) {
        enhanced.metadata = {
            ...enhanced.metadata,
            supplier: metadata.supplier
        };
    }
    // Enhance component
    const existingComponent = sbom.metadata?.component || {};
    enhanced.metadata = {
        ...enhanced.metadata,
        component: {
            ...existingComponent,
            type: existingComponent.type || "library",
            name: packageName,
            version: packageVersion,
            purl: generatePurl(packageName, packageVersion),
            publisher: metadata.component?.publisher,
            copyright: metadata.component?.copyright,
            externalReferences: mergeExternalReferences(existingComponent.externalReferences, metadata.component?.externalReferences)
        }
    };
    return enhanced;
}

// EXTERNAL MODULE: ./src/utils/registry-utils.ts
var registry_utils = __webpack_require__(36679);
// EXTERNAL MODULE: ./src/utils/release-summary-helpers.ts + 1 modules
var release_summary_helpers = __webpack_require__(26950);
// EXTERNAL MODULE: ./src/utils/tokens.ts
var tokens = __webpack_require__(54190);
;// CONCATENATED MODULE: ./src/utils/create-attestation.ts








/**
 * Compute SHA256 digest of a file
 *
 * @param filePath - Path to the file
 * @returns SHA256 digest in format "sha256:hex"
 */ function computeFileDigest(filePath) {
    const content = (0,external_node_fs_.readFileSync)(filePath);
    const hash = (0,external_node_crypto_.createHash)("sha256").update(content).digest("hex");
    return `sha256:${hash}`;
}
/**
 * Find the tarball file for a package in a directory
 *
 * @param directory - Directory to search
 * @param packageName - Package name (for naming the tarball)
 * @param version - Package version
 * @returns Path to tarball if found
 */ function findTarball(directory, packageName, version) {
    // npm pack creates tarballs with scoped names like "scope-name-1.0.0.tgz"
    const normalizedName = packageName.replace(/^@/, "").replace(/\//g, "-");
    const expectedName = `${normalizedName}-${version}.tgz`;
    const tarballPath = (0,external_node_path_.join)(directory, expectedName);
    if ((0,external_node_fs_.existsSync)(tarballPath)) {
        return tarballPath;
    }
    // Also check for any .tgz file in the directory
    const files = (0,external_node_fs_.readdirSync)(directory);
    const tgzFile = files.find((f)=>f.endsWith(".tgz"));
    if (tgzFile) {
        return (0,external_node_path_.join)(directory, tgzFile);
    }
    return undefined;
}
/**
 * Get the command to run npm operations
 *
 * @remarks
 * npm is always available in GitHub Actions runners and alongside all major
 * package managers (pnpm, yarn, bun). Using npm directly is simpler and more
 * reliable than routing through package manager dlx/npx wrappers.
 */ function getNpmCommand() {
    return {
        cmd: "npm",
        baseArgs: []
    };
}
/**
 * Get the command to execute a package via the package manager
 *
 * @remarks
 * Different package managers have different ways to execute packages:
 * - npm/npx: npx
 * - pnpm: pnpm dlx (or pnpm exec for installed packages)
 * - yarn: yarn dlx
 * - bun: bun x (note: `bunx` alias is not available on GitHub Actions runners)
 *
 * Using the package manager's exec command ensures consistency with
 * the project's dependency resolution and avoids issues with npx
 * in non-npm managed projects.
 *
 * @param packageManager - Package manager to use
 * @returns Command and base args for executing packages
 */ function getDlxCommand(packageManager) {
    switch(packageManager){
        case "pnpm":
            return {
                cmd: "pnpm",
                baseArgs: [
                    "dlx"
                ]
            };
        case "yarn":
            return {
                cmd: "yarn",
                baseArgs: [
                    "dlx"
                ]
            };
        case "bun":
            // Use `bun x` instead of `bunx` - the alias is not available on GitHub Actions runners
            return {
                cmd: "bun",
                baseArgs: [
                    "x"
                ]
            };
        default:
            return {
                cmd: "npx",
                baseArgs: []
            };
    }
}
/**
 * Create artifact metadata storage record to link attestation with GitHub Packages
 *
 * @remarks
 * This creates a storage record in GitHub's artifact metadata API, which links
 * the attestation to the package artifact in GitHub Packages. Delegates to the
 * Effect-based `runCreateStorageRecord` shim.
 *
 * @param packageName - Name of the package (e.g., "@org/pkg")
 * @param version - Package version
 * @param digest - SHA256 digest of the tarball (format: "sha256:hex")
 * @param token - GitHub token for authentication
 * @returns Array of storage record IDs if successful, undefined otherwise
 */ async function createArtifactMetadataRecord(packageName, version, digest, token) {
    // Use PURL format for the artifact name
    const purlName = `pkg:npm/${packageName}@${version}`;
    // Extract the unscoped package name for the repository field
    // e.g., "@savvy-web/fixed-2" -> "fixed-2"
    const unscopedName = packageName.replace(/^@[^/]+\//, "");
    // Build the artifact URL pointing to the package in GitHub Packages
    // Format: https://github.com/{owner}/{repo}/pkgs/npm/{package-name}
    const artifactUrl = `https://github.com/${_actions_compat/* .context.repo.owner */._O.repo.owner}/${_actions_compat/* .context.repo.repo */._O.repo.repo}/pkgs/npm/${unscopedName}`;
    try {
        const { runCreateStorageRecord } = await __webpack_require__.e(/* import() */ 805).then(__webpack_require__.bind(__webpack_require__, 86708));
        const storageRecordIds = await runCreateStorageRecord({
            purl: purlName,
            digest,
            version,
            registryUrl: "https://npm.pkg.github.com/",
            artifactUrl,
            // The npm package name within the registry.
            repo: unscopedName,
            token
        });
        if (storageRecordIds && storageRecordIds.length > 0) {
            (0,_actions_compat/* .debug */.Yz)(`Created artifact metadata storage record for ${purlName}, IDs: ${storageRecordIds.join(",")}`);
            return [
                ...storageRecordIds
            ];
        }
        (0,_actions_compat/* .info */.pq)(`  ⓘ Storage-record API accepted ${purlName} but recorded no IDs — artifact link not created`);
        return undefined;
    } catch (error) {
        // Don't fail attestation if storage record creation fails
        // This requires artifact-metadata:write permission which may not be available
        (0,_actions_compat/* .warning */.$e)(`Failed to create artifact metadata storage record: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * Create a tarball for a package using npm pack via the configured package manager
 *
 * @param directory - Directory containing the package
 * @param packageManager - Package manager to use (npm, pnpm, yarn, bun)
 * @returns Path to created tarball, or undefined if failed
 */ async function createTarball(directory) {
    try {
        let output = "";
        const npmCmd = getNpmCommand();
        const packArgs = [
            ...npmCmd.baseArgs,
            "pack",
            "--json"
        ];
        await (0,_actions_compat/* .exec */.m0)(npmCmd.cmd, packArgs, {
            cwd: directory,
            silent: true,
            listeners: {
                stdout: (data)=>{
                    output += data.toString();
                }
            }
        });
        // Parse JSON output to get filename
        const packInfo = JSON.parse(output);
        if (packInfo.length > 0 && packInfo[0].filename) {
            const tarballPath = (0,external_node_path_.join)(directory, packInfo[0].filename);
            if ((0,external_node_fs_.existsSync)(tarballPath)) {
                return tarballPath;
            }
        }
    } catch (error) {
        (0,_actions_compat/* .debug */.Yz)(`Failed to create tarball: ${error instanceof Error ? error.message : String(error)}`);
    }
    return undefined;
}
/**
 * Create a GitHub attestation for a release asset (tarball)
 *
 * @remarks
 * This creates a SLSA provenance attestation for a specific artifact file.
 * Unlike createPackageAttestation, this uses the artifact's file path directly
 * and is designed for GitHub Release assets.
 *
 * The attestation links the artifact to the workflow and repository that created it,
 * making it verifiable via `gh attestation verify`.
 *
 * Requires:
 * - `id-token: write` permission for OIDC signing
 * - `attestations: write` permission for storing attestations
 *
 * @param artifactPath - Full path to the artifact file
 * @param packageName - Name of the package (for PURL format)
 * @param version - Version of the package
 * @param dryRun - Whether to skip actual attestation creation
 * @returns Promise resolving to attestation result
 */ async function createReleaseAssetAttestation(artifactPath, packageName, version, dryRun) {
    if (dryRun) {
        (0,_actions_compat/* .info */.pq)(`[DRY RUN] Would create attestation for release asset ${(0,external_node_path_.basename)(artifactPath)}`);
        return {
            success: true,
            attestationUrl: `https://github.com/${_actions_compat/* .context.repo.owner */._O.repo.owner}/${_actions_compat/* .context.repo.repo */._O.repo.repo}/attestations/dry-run`
        };
    }
    // Get the GITHUB_TOKEN for attestation API
    const token = (0,tokens/* .packagesToken */.R)();
    if (!token) {
        return {
            success: false,
            error: "No GITHUB_TOKEN available for attestation creation"
        };
    }
    if (!(0,external_node_fs_.existsSync)(artifactPath)) {
        return {
            success: false,
            error: `Artifact not found: ${artifactPath}`
        };
    }
    const artifactName = (0,external_node_path_.basename)(artifactPath);
    // Use PURL format for npm packages to link with GitHub Packages
    const purlName = `pkg:npm/${packageName}@${version}`;
    (0,_actions_compat/* .info */.pq)(`Creating attestation for release asset ${artifactName}...`);
    try {
        // Compute digest of the actual artifact
        const digest = computeFileDigest(artifactPath);
        (0,_actions_compat/* .debug */.Yz)(`Artifact digest: ${digest}`);
        (0,_actions_compat/* .debug */.Yz)(`Subject name (PURL): ${purlName}`);
        // Run the Effect-based provenance pipeline (Sigstore + GitHub).
        const { runProvenanceAttestation } = await __webpack_require__.e(/* import() */ 805).then(__webpack_require__.bind(__webpack_require__, 86708));
        const attestation = await runProvenanceAttestation(purlName, digest, token);
        (0,_actions_compat/* .info */.pq)(`✓ Created attestation for ${artifactName}`);
        (0,_actions_compat/* .info */.pq)(`  Attestation URL: ${attestation.attestationUrl}`);
        return {
            success: true,
            attestationUrl: attestation.attestationUrl,
            attestationId: attestation.attestationId
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        (0,_actions_compat/* .warning */.$e)(`Failed to create attestation for ${artifactName}: ${message}`);
        return {
            success: false,
            error: message
        };
    }
}
/**
 * Create a GitHub attestation for a published package
 *
 * @remarks
 * This creates a SLSA provenance attestation using GitHub's attestation API.
 * The attestation is signed using Sigstore and stored on GitHub, making it
 * verifiable via `gh attestation verify`.
 *
 * When `tarballDigest` is provided, it uses that digest directly. This is the
 * preferred approach for published packages as it ensures the attestation
 * matches the exact artifact in the registry.
 *
 * When `tarballDigest` is not provided, it falls back to finding or creating
 * a local tarball and computing its digest.
 *
 * Requires:
 * - `id-token: write` permission for OIDC signing
 * - `attestations: write` permission for storing attestations
 *
 * @param options - Attestation creation options
 * @returns Promise resolving to attestation result
 */ async function createPackageAttestation(options) {
    const { packageName, version, directory, dryRun, tarballDigest, registry } = options;
    if (dryRun) {
        (0,_actions_compat/* .info */.pq)(`[DRY RUN] Would create attestation for ${packageName}@${version}`);
        return {
            success: true,
            attestationUrl: `https://github.com/${_actions_compat/* .context.repo.owner */._O.repo.owner}/${_actions_compat/* .context.repo.repo */._O.repo.repo}/attestations/dry-run`
        };
    }
    // Get the GITHUB_TOKEN for attestation API
    // We need the workflow token, not the App token, for attestations
    const token = (0,tokens/* .packagesToken */.R)();
    if (!token) {
        return {
            success: false,
            error: "No GITHUB_TOKEN available for attestation creation"
        };
    }
    // Use provided digest or compute from local tarball
    let digest;
    let tarballName;
    if (tarballDigest) {
        // Use the pre-computed digest from the published tarball
        digest = tarballDigest;
        tarballName = `${packageName}@${version}`;
        (0,_actions_compat/* .debug */.Yz)(`Using provided tarball digest: ${digest}`);
    } else {
        // Fall back to finding or creating a local tarball
        let tarballPath = findTarball(directory, packageName, version);
        if (!tarballPath) {
            (0,_actions_compat/* .debug */.Yz)(`No tarball found in ${directory} for ${packageName}@${version}, creating one...`);
            tarballPath = await createTarball(directory);
            if (!tarballPath) {
                (0,_actions_compat/* .debug */.Yz)(`Failed to create tarball in ${directory}`);
                return {
                    success: false,
                    error: `No tarball found and could not create one for ${packageName}@${version}`
                };
            }
            (0,_actions_compat/* .debug */.Yz)(`Created tarball: ${tarballPath}`);
        }
        tarballName = (0,external_node_path_.basename)(tarballPath);
        digest = computeFileDigest(tarballPath);
        (0,_actions_compat/* .debug */.Yz)(`Computed tarball digest: ${digest}`);
    }
    // Use PURL format for npm packages to link with GitHub Packages
    // Format: pkg:npm/@scope/name@version or pkg:npm/name@version
    const purlName = `pkg:npm/${packageName}@${version}`;
    (0,_actions_compat/* .info */.pq)(`Creating attestation for ${purlName}...`);
    try {
        (0,_actions_compat/* .debug */.Yz)(`Subject name (PURL): ${purlName}`);
        (0,_actions_compat/* .debug */.Yz)(`Subject digest: ${digest}`);
        // Use the Effect-based provenance pipeline (Sigstore + GitHub).
        const { runProvenanceAttestation } = await __webpack_require__.e(/* import() */ 805).then(__webpack_require__.bind(__webpack_require__, 86708));
        const attestation = await runProvenanceAttestation(purlName, digest, token);
        (0,_actions_compat/* .info */.pq)(`✓ Created attestation for ${tarballName}`);
        (0,_actions_compat/* .info */.pq)(`  Attestation URL: ${attestation.attestationUrl}`);
        // Link attestation to GitHub Packages artifact via storage record API
        // Only applicable for GitHub Packages registry
        if ((0,registry_utils/* .isGitHubPackagesRegistry */.yQ)(registry)) {
            const pkgToken = (0,tokens/* .packagesToken */.R)();
            if (pkgToken) {
                const storageRecordIds = await createArtifactMetadataRecord(packageName, version, digest, pkgToken);
                if (storageRecordIds && storageRecordIds.length > 0) {
                    (0,_actions_compat/* .info */.pq)(`  ✓ Linked attestation to GitHub Packages artifact (storage record IDs: ${storageRecordIds.join(",")})`);
                }
            }
        }
        return {
            success: true,
            attestationUrl: attestation.attestationUrl,
            attestationId: attestation.attestationId
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        (0,_actions_compat/* .warning */.$e)(`Failed to create attestation for ${packageName}@${version}: ${message}`);
        // Don't fail the publish for attestation errors
        return {
            success: false,
            error: message
        };
    }
}
/**
 * CycloneDX predicate type URI for SBOM attestations
 * @see https://cyclonedx.org/specification/overview/
 * @see https://github.com/in-toto/attestation/issues/82
 */ const CYCLONEDX_PREDICATE_TYPE = "https://cyclonedx.org/bom";
/**
 * Ensure .npmignore exists in directory to exclude SBOM artifacts from npm pack
 *
 * @remarks
 * When we install dependencies for SBOM generation, we create node_modules
 * in the dist directory. This must be excluded from any future npm pack
 * operations to prevent polluting the published package.
 *
 * Only creates the file if it doesn't already exist - does not modify
 * existing .npmignore files to respect user configuration.
 *
 * @param directory - Directory to create .npmignore in
 */ function ensureNpmIgnore(directory) {
    const npmignorePath = (0,external_node_path_.join)(directory, ".npmignore");
    // Don't overwrite existing .npmignore - respect user configuration
    if ((0,external_node_fs_.existsSync)(npmignorePath)) {
        return;
    }
    try {
        const content = `${[
            "node_modules",
            "*.tgz",
            "*.sbom.json"
        ].join("\n")}\n`;
        (0,external_node_fs_.writeFileSync)(npmignorePath, content);
        (0,_actions_compat/* .debug */.Yz)(`Created .npmignore in ${directory}`);
    } catch (error) {
        (0,_actions_compat/* .debug */.Yz)(`Failed to create .npmignore: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Collect every workspace package keyed by name, pointing at its built
 * `dist/npm` directory.
 *
 * @remarks
 * SBOM generation runs `npm install` inside a package's `dist/npm`. When the
 * package depends on a workspace sibling that is not published to the public
 * registry, that install 404s. {@link rewriteWorkspaceDeps} rewrites such
 * dependencies to `file:` references — but only for packages present in this
 * map, so the map must cover **all** workspace packages, not just the ones
 * being released in the current cycle.
 *
 * @returns Map of package name to its `dist/npm` directory and version.
 */ function collectWorkspacePackages() {
    const map = new Map();
    for (const pkg of (0,release_summary_helpers/* .getAllWorkspacePackages */.Qu)()){
        const distDir = (0,external_node_path_.join)(pkg.path, "dist", "npm");
        if ((0,external_node_fs_.existsSync)(distDir)) {
            map.set(pkg.name, {
                directory: distDir,
                version: pkg.version
            });
        }
    }
    return map;
}
/**
 * Rewrite workspace dependencies in package.json to use file: references
 *
 * @remarks
 * When publishing multiple workspace packages in the same batch, some may
 * depend on others that haven't been published yet. By using file: references,
 * npm can resolve these dependencies locally instead of trying to fetch from
 * the registry.
 *
 * This function modifies the package.json in place, backing up the original.
 * The backup should be restored after SBOM generation.
 *
 * @param directory - Directory containing package.json
 * @param workspacePackages - Map of package names to their info
 * @returns Path to backup file if changes were made, undefined otherwise
 */ function rewriteWorkspaceDeps(directory, workspacePackages) {
    const pkgJsonPath = (0,external_node_path_.join)(directory, "package.json");
    if (!(0,external_node_fs_.existsSync)(pkgJsonPath)) {
        (0,_actions_compat/* .debug */.Yz)(`No package.json in ${directory}, skipping dep rewrite`);
        return undefined;
    }
    const originalContent = (0,external_node_fs_.readFileSync)(pkgJsonPath, "utf-8");
    const pkgJson = JSON.parse(originalContent);
    let modified = false;
    // Check each dependency type for workspace packages
    for (const depType of [
        "dependencies",
        "peerDependencies",
        "optionalDependencies"
    ]){
        const deps = pkgJson[depType];
        if (!deps) continue;
        for (const [depName, depVersion] of Object.entries(deps)){
            const workspacePkg = workspacePackages.get(depName);
            if (workspacePkg) {
                // Replace with file: reference to the workspace package's dist directory
                const fileRef = `file:${workspacePkg.directory}`;
                if (deps[depName] !== fileRef) {
                    (0,_actions_compat/* .debug */.Yz)(`Rewriting ${depName}: ${depVersion} -> ${fileRef}`);
                    deps[depName] = fileRef;
                    modified = true;
                }
            }
        }
    }
    if (!modified) {
        return undefined;
    }
    // Backup original and write modified version
    const backupPath = `${pkgJsonPath}.backup`;
    (0,external_node_fs_.writeFileSync)(backupPath, originalContent);
    (0,external_node_fs_.writeFileSync)(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
    (0,_actions_compat/* .debug */.Yz)(`Rewrote workspace deps in ${directory}, backup at ${backupPath}`);
    return backupPath;
}
/**
 * Restore package.json from backup
 *
 * @param backupPath - Path to the backup file
 */ function restorePackageJson(backupPath) {
    const originalPath = backupPath.replace(".backup", "");
    if ((0,external_node_fs_.existsSync)(backupPath)) {
        const content = (0,external_node_fs_.readFileSync)(backupPath, "utf-8");
        (0,external_node_fs_.writeFileSync)(originalPath, content);
        // Remove backup file
        try {
            (0,external_node_fs_.unlinkSync)(backupPath);
        } catch  {
        // Ignore cleanup errors
        }
        (0,_actions_compat/* .debug */.Yz)(`Restored package.json from ${backupPath}`);
    }
}
/**
 * Install production dependencies in a directory
 *
 * @remarks
 * This is needed before running cdxgen in dist directories, which have
 * resolved package.json versions but no node_modules installed.
 *
 * If workspacePackages is provided, dependencies on those packages will be
 * rewritten to use file: references before installation, allowing npm to
 * resolve dependencies that may not yet be published to the registry.
 *
 * @param directory - Directory containing package.json
 * @param packageManager - Package manager to use for installation
 * @param workspacePackages - Optional map of workspace package names to their info
 * @returns Whether installation succeeded
 */ async function installDependencies(directory, workspacePackages) {
    let backupPath;
    try {
        // Ensure .npmignore excludes installed dependencies from future npm pack
        ensureNpmIgnore(directory);
        // Log package.json contents for debugging
        const pkgJsonPath = (0,external_node_path_.join)(directory, "package.json");
        if ((0,external_node_fs_.existsSync)(pkgJsonPath)) {
            try {
                const pkgContent = (0,external_node_fs_.readFileSync)(pkgJsonPath, "utf-8");
                const pkg = JSON.parse(pkgContent);
                (0,_actions_compat/* .debug */.Yz)(`Package.json dependencies in ${directory}: ${JSON.stringify(pkg.dependencies || {})}`);
            } catch  {
            // Ignore parsing errors for debug logging
            }
        }
        // Rewrite workspace dependencies to use file: references if provided
        if (workspacePackages && workspacePackages.size > 0) {
            backupPath = rewriteWorkspaceDeps(directory, workspacePackages);
        }
        const npmCmd = getNpmCommand();
        // Install production dependencies only (omit dev dependencies)
        // Use --legacy-peer-deps to avoid peer dependency resolution failures
        const installArgs = [
            ...npmCmd.baseArgs,
            "install",
            "--omit=dev",
            "--ignore-scripts",
            "--legacy-peer-deps"
        ];
        (0,_actions_compat/* .debug */.Yz)(`Running: ${npmCmd.cmd} ${installArgs.join(" ")} in ${directory}`);
        // Capture output for debugging
        let stdout = "";
        let stderr = "";
        const exitCode = await (0,_actions_compat/* .exec */.m0)(npmCmd.cmd, installArgs, {
            cwd: directory,
            silent: true,
            ignoreReturnCode: true,
            listeners: {
                stdout: (data)=>{
                    stdout += data.toString();
                },
                stderr: (data)=>{
                    stderr += data.toString();
                }
            }
        });
        if (exitCode !== 0) {
            // Surface the real failure — the caller only logs a generic warning.
            const detail = (stderr || stdout).trim().slice(0, 600);
            (0,_actions_compat/* .warning */.$e)(`npm install failed in ${directory} (exit ${exitCode})${detail ? `:\n${detail}` : ""}`);
            return false;
        }
        (0,_actions_compat/* .debug */.Yz)(`Installed dependencies in ${directory}`);
        return true;
    } catch (error) {
        (0,_actions_compat/* .debug */.Yz)(`Failed to install dependencies: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    } finally{
        // Always restore the original package.json if we modified it
        if (backupPath) {
            restorePackageJson(backupPath);
        }
    }
}
/**
 * Generate a CycloneDX SBOM for a package using cdxgen
 *
 * @remarks
 * Uses @cyclonedx/cdxgen which supports multiple package managers (npm, pnpm, yarn, bun).
 * This is more reliable than npm sbom which requires package-lock.json.
 *
 * If no node_modules exists in the directory, this function will first install
 * production dependencies to ensure cdxgen has the dependency tree to analyze.
 *
 * @param directory - Directory containing the package
 * @param packageManager - Package manager to use for running cdxgen
 * @returns Parsed CycloneDX document or undefined if generation failed
 */ async function generateSBOM(directory, packageManager) {
    // Check if node_modules exists, if not install dependencies first
    // cdxgen can work with lockfiles directly, but node_modules gives more accurate results
    const nodeModulesPath = (0,external_node_path_.join)(directory, "node_modules");
    if (!(0,external_node_fs_.existsSync)(nodeModulesPath)) {
        (0,_actions_compat/* .debug */.Yz)(`No node_modules in ${directory}, installing dependencies...`);
        const installed = await installDependencies(directory, collectWorkspacePackages());
        if (!installed) {
            (0,_actions_compat/* .warning */.$e)(`Failed to install dependencies in ${directory} for SBOM generation`);
            return undefined;
        }
    }
    let stderr = "";
    // Use cdxgen (@cyclonedx/cdxgen) which supports npm, pnpm, yarn, and other package managers
    // This is more reliable than npm sbom which requires package-lock.json
    const sbomOutputPath = (0,external_node_path_.join)(directory, ".cdxgen-sbom.json");
    // Use the package manager's dlx/exec command to run cdxgen
    // This ensures consistency with the project's dependency resolution
    const dlxCmd = getDlxCommand(packageManager);
    const cdxgenArgs = [
        ...dlxCmd.baseArgs,
        "@cyclonedx/cdxgen",
        "-o",
        sbomOutputPath,
        "--spec-version",
        "1.5",
        "--no-recurse",
        "--required-only",
        "--no-install-deps",
        directory
    ];
    (0,_actions_compat/* .debug */.Yz)(`Running SBOM generation: ${dlxCmd.cmd} ${cdxgenArgs.join(" ")}`);
    try {
        const exitCode = await (0,_actions_compat/* .exec */.m0)(dlxCmd.cmd, cdxgenArgs, {
            cwd: directory,
            silent: true,
            ignoreReturnCode: true,
            listeners: {
                stderr: (data)=>{
                    stderr += data.toString();
                }
            }
        });
        if (exitCode !== 0) {
            const errorDetails = stderr.trim() || `exit code ${exitCode}`;
            (0,_actions_compat/* .warning */.$e)(`cdxgen failed for ${directory}: ${errorDetails}`);
            return undefined;
        }
        // Read the generated SBOM file
        if (!(0,external_node_fs_.existsSync)(sbomOutputPath)) {
            (0,_actions_compat/* .warning */.$e)(`cdxgen did not produce output file at ${sbomOutputPath}`);
            return undefined;
        }
        const sbomContent = (0,external_node_fs_.readFileSync)(sbomOutputPath, "utf-8");
        // Clean up the temp file
        try {
            (0,external_node_fs_.unlinkSync)(sbomOutputPath);
        } catch  {
        // Ignore cleanup errors
        }
        if (!sbomContent.trim()) {
            (0,_actions_compat/* .warning */.$e)(`cdxgen produced empty SBOM for ${directory}`);
            return undefined;
        }
        const sbom = JSON.parse(sbomContent);
        (0,_actions_compat/* .debug */.Yz)(`Generated SBOM: ${sbom.bomFormat} v${sbom.specVersion}`);
        // Emit the full SBOM in a collapsed log group so it can be inspected
        // on demand without flooding the log on a healthy run.
        (0,_actions_compat/* .startGroup */.Oh)(`CycloneDX SBOM — ${directory}`);
        (0,_actions_compat/* .info */.pq)(JSON.stringify(sbom, null, 2));
        (0,_actions_compat/* .endGroup */.N4)();
        return sbom;
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const stderrInfo = stderr.trim() ? `\nStderr: ${stderr.trim()}` : "";
        (0,_actions_compat/* .warning */.$e)(`Failed to generate SBOM for ${directory}: ${errorMsg}${stderrInfo}`);
        // Clean up temp file if it exists
        try {
            if ((0,external_node_fs_.existsSync)(sbomOutputPath)) {
                (0,external_node_fs_.unlinkSync)(sbomOutputPath);
            }
        } catch  {
        // Ignore cleanup errors
        }
        return undefined;
    }
}
/**
 * Create a GitHub SBOM attestation for a published package
 *
 * @remarks
 * This creates a CycloneDX SBOM attestation using GitHub's attestation API.
 * The attestation binds the SBOM to the package artifact, allowing consumers
 * to verify what dependencies were included in the build.
 *
 * The SBOM is generated using cdxgen (@cyclonedx/cdxgen) and then attested
 * using the in-toto CycloneDX predicate type. CycloneDX is preferred over SPDX
 * for JavaScript/npm projects due to better npm-specific metadata support.
 *
 * Requires:
 * - `id-token: write` permission for OIDC signing
 * - `attestations: write` permission for storing attestations
 *
 * @param options - SBOM attestation creation options
 * @returns Promise resolving to attestation result
 *
 * @see https://cyclonedx.org/specification/overview/
 * @see https://github.com/actions/attest-sbom
 */ async function createSBOMAttestation(options) {
    const { packageName, version, directory, dryRun, tarballDigest } = options;
    if (dryRun) {
        (0,_actions_compat/* .info */.pq)(`[DRY RUN] Would create SBOM attestation for ${packageName}@${version}`);
        return {
            success: true,
            attestationUrl: `https://github.com/${_actions_compat/* .context.repo.owner */._O.repo.owner}/${_actions_compat/* .context.repo.repo */._O.repo.repo}/attestations/dry-run-sbom`
        };
    }
    // Get the GITHUB_TOKEN for attestation API
    const token = (0,tokens/* .packagesToken */.R)();
    if (!token) {
        return {
            success: false,
            error: "No GITHUB_TOKEN available for SBOM attestation creation"
        };
    }
    // Use pre-generated SBOM if provided, otherwise generate a new one
    // Pre-generated SBOMs come from the validation phase to avoid duplicate generation
    let sbom;
    if (options.preGeneratedSbom) {
        (0,_actions_compat/* .info */.pq)(`Using pre-generated SBOM for ${packageName}@${version}`);
        sbom = options.preGeneratedSbom;
    } else {
        // Generate the SBOM from the dist directory where package.json has resolved versions
        // (workspace:* dependencies are transformed to real versions during build)
        // generateSBOM installs dependencies if node_modules doesn't exist,
        // rewriting workspace-sibling deps to file: references first.
        (0,_actions_compat/* .info */.pq)(`Generating SBOM for ${packageName}@${version}...`);
        const pm = options.packageManager || "npm";
        sbom = await generateSBOM(directory, pm);
    }
    if (!sbom) {
        return {
            success: false,
            error: `Failed to generate SBOM for ${packageName}@${version}`
        };
    }
    // Save the SBOM to a file for later upload as a release asset
    // Naming convention: {package-name-without-scope}-{version}[-{target}].sbom.json
    const pkgNameWithoutScope = packageName.startsWith("@") ? packageName.split("/")[1] : packageName;
    const sbomFileName = options.targetName ? `${pkgNameWithoutScope}-${version}-${options.targetName}.sbom.json` : `${pkgNameWithoutScope}-${version}.sbom.json`;
    const sbomPath = (0,external_node_path_.join)(directory, sbomFileName);
    (0,external_node_fs_.writeFileSync)(sbomPath, JSON.stringify(sbom, null, 2));
    (0,_actions_compat/* .info */.pq)(`  Saved SBOM to ${sbomPath}`);
    // Determine the digest to use for the subject
    let digest;
    if (tarballDigest) {
        digest = tarballDigest;
        (0,_actions_compat/* .debug */.Yz)(`Using provided tarball digest for SBOM subject: ${digest}`);
    } else {
        // Try to find or create a tarball to compute digest
        let tarballPath = findTarball(directory, packageName, version);
        if (!tarballPath) {
            tarballPath = await createTarball(directory);
        }
        if (!tarballPath) {
            return {
                success: false,
                error: `No tarball found for SBOM attestation of ${packageName}@${version}`
            };
        }
        digest = computeFileDigest(tarballPath);
        (0,_actions_compat/* .debug */.Yz)(`Computed tarball digest for SBOM subject: ${digest}`);
    }
    // Use PURL format for npm packages
    const purlName = `pkg:npm/${packageName}@${version}`;
    (0,_actions_compat/* .info */.pq)(`Creating SBOM attestation for ${purlName}...`);
    try {
        (0,_actions_compat/* .debug */.Yz)(`Subject name (PURL): ${purlName}`);
        (0,_actions_compat/* .debug */.Yz)(`Subject digest: ${digest}`);
        (0,_actions_compat/* .debug */.Yz)(`Predicate type: ${CYCLONEDX_PREDICATE_TYPE}`);
        // Use the Effect-based attestation pipeline with the BOM as the
        // CycloneDX predicate.
        const { runSbomAttestation } = await __webpack_require__.e(/* import() */ 805).then(__webpack_require__.bind(__webpack_require__, 86708));
        const attestation = await runSbomAttestation(purlName, digest, sbom, token);
        (0,_actions_compat/* .info */.pq)(`✓ Created SBOM attestation for ${packageName}@${version}`);
        (0,_actions_compat/* .info */.pq)(`  Attestation URL: ${attestation.attestationUrl}`);
        return {
            success: true,
            attestationUrl: attestation.attestationUrl,
            attestationId: attestation.attestationId,
            sbomPath
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        (0,_actions_compat/* .warning */.$e)(`Failed to create SBOM attestation for ${packageName}@${version}: ${message}`);
        // Don't fail the publish for SBOM attestation errors
        return {
            success: false,
            error: message
        };
    }
}
/**
 * Validate that SBOM generation works for a package by actually generating it
 *
 * @remarks
 * This performs a full SBOM generation during the validation phase to ensure
 * it will work during the actual release. The generated SBOM is returned
 * so it can be reused later.
 *
 * This function:
 * 1. Checks if package.json exists and is valid
 * 2. Counts production dependencies
 * 3. Actually generates the SBOM using cdxgen via the package manager
 * 4. Optionally enhances SBOM with metadata from config and package.json
 * 5. Returns the generated SBOM for later use
 *
 * This helps catch SBOM issues early before the actual release.
 *
 * @param options - Validation options
 * @returns SBOM validation result with the generated SBOM if successful
 */ async function validateSBOMGeneration(options) {
    const { directory, packageManager, packageName, packageVersion, rootDirectory, enhanceMetadata } = options;
    // Check if package.json exists
    const pkgJsonPath = join(directory, "package.json");
    if (!existsSync(pkgJsonPath)) {
        return {
            valid: false,
            hasDependencies: false,
            dependencyCount: 0,
            error: `package.json not found at ${pkgJsonPath}`
        };
    }
    // Read package.json to check dependencies and get package info
    let pkgJson;
    try {
        pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
    } catch (error) {
        return {
            valid: false,
            hasDependencies: false,
            dependencyCount: 0,
            error: `Failed to parse package.json: ${error instanceof Error ? error.message : String(error)}`
        };
    }
    // Count production dependencies
    const dependencies = pkgJson.dependencies || {};
    const dependencyCount = Object.keys(dependencies).length;
    const hasDependencies = dependencyCount > 0;
    if (!hasDependencies) {
        return {
            valid: true,
            hasDependencies: false,
            dependencyCount: 0,
            warning: "Package has no production dependencies - SBOM will be minimal"
        };
    }
    // Actually generate the SBOM to validate it works
    // This catches issues like missing dependencies, cdxgen failures, etc.
    debug(`Validating SBOM generation by generating SBOM for ${directory}`);
    const sbom = await generateSBOM(directory, packageManager);
    if (!sbom) {
        return {
            valid: false,
            hasDependencies,
            dependencyCount,
            error: "Failed to generate SBOM - check cdxgen output for details"
        };
    }
    const componentCount = sbom.components?.length || 0;
    debug(`SBOM validation passed for ${directory}: ${dependencyCount} deps, ${componentCount} components`);
    // Enhance SBOM with metadata if requested and we have package info
    let finalSbom = sbom;
    const pkgName = packageName || pkgJson.name;
    const pkgVersion = packageVersion || pkgJson.version;
    if (enhanceMetadata && pkgName && pkgVersion) {
        try {
            finalSbom = await enhanceSBOMMetadata(sbom, {
                packageName: pkgName,
                packageVersion: pkgVersion,
                packageDirectory: directory,
                rootDirectory
            });
            debug(`Enhanced SBOM with metadata for ${pkgName}@${pkgVersion}`);
        } catch (error) {
            // Enhancement failure should not fail validation, just log warning
            warning(`Failed to enhance SBOM metadata: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return {
        valid: true,
        hasDependencies,
        dependencyCount,
        generatedSbom: finalSbom
    };
}


},
61700(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.d(__webpack_exports__, {
  di: () => (findPackagePath)
});
/* import */ var node_path__rspack_import_0 = __webpack_require__(76760);
/* import */ var node_path__rspack_import_0_default = /*#__PURE__*/__webpack_require__.n(node_path__rspack_import_0);
/* import */ var workspaces_effect__rspack_import_1 = __webpack_require__(52855);
/* import */ var _actions_compat_js__rspack_import_2 = __webpack_require__(50620);



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
30508(__unused_rspack_module, __webpack_exports__, __webpack_require__) {

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  publishPackages: () => (/* binding */ publishPackages)
});

// EXTERNAL MODULE: external "node:fs"
var external_node_fs_ = __webpack_require__(73024);
// EXTERNAL MODULE: external "node:path"
var external_node_path_ = __webpack_require__(76760);
// EXTERNAL MODULE: ./src/utils/_actions-compat.ts + 18 modules
var _actions_compat = __webpack_require__(50620);
// EXTERNAL MODULE: ./src/utils/create-attestation.ts + 10 modules
var create_attestation = __webpack_require__(5441);
// EXTERNAL MODULE: ./src/utils/find-package-path.ts
var find_package_path = __webpack_require__(61700);
// EXTERNAL MODULE: ./src/utils/get-changeset-status.ts
var get_changeset_status = __webpack_require__(99522);
// EXTERNAL MODULE: external "node:crypto"
var external_node_crypto_ = __webpack_require__(77598);
// EXTERNAL MODULE: ./src/utils/registry-utils.ts
var registry_utils = __webpack_require__(36679);
;// CONCATENATED MODULE: ./src/utils/publish-target.ts





/**
 * Generate a URL to the published package
 */ function generatePackageUrl(target) {
    const pkgJsonPath = (0,external_node_path_.join)(target.directory, "package.json");
    if (!(0,external_node_fs_.existsSync)(pkgJsonPath)) return undefined;
    const pkg = JSON.parse((0,external_node_fs_.readFileSync)(pkgJsonPath, "utf-8"));
    return (0,registry_utils/* .generatePackageViewUrl */.sh)(target.registry, pkg.name);
}
/**
 * Extract provenance URL from npm publish output
 */ function extractProvenanceUrl(output) {
    const match = output.match(/Provenance statement published to (https:\/\/[^\s]+)/);
    return match?.[1];
}
/**
 * Check if error indicates version already published
 */ function isVersionAlreadyPublished(output, error) {
    return output.includes("cannot publish over previously published version") || error.includes("cannot publish over previously published version") || error.includes("You cannot publish over the previously published versions");
}
/**
 * Get the command to run npm operations
 *
 * This is the primary wrapper for running npm commands across different package managers.
 * All package managers use their "execute" command to run npm.
 *
 * @remarks
 * - npm: `npx npm <args>`
 * - pnpm: `pnpm dlx npm <args>`
 * - yarn: `yarn npm <args>`
 * - bun: `bun x npm <args>`
 *
 * @param packageManager - The package manager being used
 * @returns Command and base args to prepend before npm arguments
 */ function getNpmCommand(packageManager) {
    switch(packageManager){
        case "pnpm":
            return {
                cmd: "pnpm",
                baseArgs: [
                    "dlx",
                    "npm"
                ]
            };
        case "yarn":
            return {
                cmd: "yarn",
                baseArgs: [
                    "npm"
                ]
            };
        case "bun":
            return {
                cmd: "bun",
                baseArgs: [
                    "x",
                    "npm"
                ]
            };
        default:
            return {
                cmd: "npx",
                baseArgs: [
                    "npm"
                ]
            };
    }
}
/**
 * Get the publish command for a package manager
 *
 * @remarks
 * We use `npm publish` via the package manager's dlx/npx command to avoid
 * package manager-specific git checks. For example, pnpm has strict branch
 * validation that fails on release branches like `changeset-release/main`.
 *
 * - npm: `npx npm publish`
 * - pnpm: `pnpm dlx npm publish`
 * - yarn: `yarn npm publish` (yarn has its own npm wrapper)
 * - bun: `bun x npm publish`
 */ function getPublishCommand(packageManager) {
    switch(packageManager){
        case "pnpm":
            return {
                cmd: "pnpm",
                baseArgs: [
                    "dlx",
                    "npm"
                ]
            };
        case "yarn":
            // Yarn uses "yarn npm publish" for publishing to npm registries
            return {
                cmd: "yarn",
                baseArgs: [
                    "npm"
                ]
            };
        case "bun":
            return {
                cmd: "bun",
                baseArgs: [
                    "x",
                    "npm"
                ]
            };
        default:
            return {
                cmd: "npx",
                baseArgs: [
                    "npm"
                ]
            };
    }
}
/**
 * Get the npx equivalent for a package manager (for running external tools)
 */ function getNpxCommand(packageManager) {
    switch(packageManager){
        case "pnpm":
            return {
                cmd: "pnpm",
                args: [
                    "dlx"
                ]
            };
        case "yarn":
            return {
                cmd: "yarn",
                args: [
                    "dlx"
                ]
            };
        case "bun":
            return {
                cmd: "bun",
                args: [
                    "x"
                ]
            };
        default:
            return {
                cmd: "npx",
                args: []
            };
    }
}
/**
 * Get local tarball integrity by running npm pack --json --dry-run
 */ async function getLocalTarballIntegrity(directory, packageManager) {
    let output = "";
    const npmCmd = getNpmCommand(packageManager);
    try {
        await (0,_actions_compat/* .exec */.m0)(npmCmd.cmd, [
            ...npmCmd.baseArgs,
            "pack",
            "--json",
            "--dry-run"
        ], {
            cwd: directory,
            silent: true,
            listeners: {
                stdout: (data)=>{
                    output += data.toString();
                }
            },
            ignoreReturnCode: true
        });
        // pack --json returns an array of package info
        const parsed = JSON.parse(output);
        // Return shasum (SHA-1) for comparison - it's more universally available
        return parsed[0]?.shasum;
    } catch  {
        (0,_actions_compat/* .debug */.Yz)(`Failed to get local tarball integrity: ${output}`);
        return undefined;
    }
}
/**
 * Pack a package into a tarball and compute its SHA-256 digest
 *
 * @remarks
 * This creates a tarball using `npm pack --json` and computes its SHA-256 digest.
 * The digest can be used for attestations and linking to GitHub Packages.
 *
 * When publishing to multiple targets, call this ONCE and pass the result to
 * each `publishToTarget` call to ensure all targets receive identical content.
 *
 * @param directory - Directory containing the package
 * @param packageManager - Package manager to use
 * @returns Pack result with tarball path and digest, or undefined if failed
 */ async function packAndComputeDigest(directory, packageManager) {
    let output = "";
    let errorOutput = "";
    const npmCmd = getNpmCommand(packageManager);
    try {
        const exitCode = await (0,_actions_compat/* .exec */.m0)(npmCmd.cmd, [
            ...npmCmd.baseArgs,
            "pack",
            "--json"
        ], {
            cwd: directory,
            silent: true,
            ignoreReturnCode: true,
            listeners: {
                stdout: (data)=>{
                    output += data.toString();
                },
                stderr: (data)=>{
                    errorOutput += data.toString();
                }
            }
        });
        if (exitCode !== 0) {
            (0,_actions_compat/* .warning */.$e)(`npm pack failed with exit code ${exitCode} in ${directory}`);
            if (errorOutput) {
                (0,_actions_compat/* .warning */.$e)(`npm pack stderr: ${errorOutput.trim()}`);
            }
            return undefined;
        }
        // Parse JSON output to get filename
        let packInfo;
        try {
            packInfo = JSON.parse(output);
        } catch (parseErr) {
            (0,_actions_compat/* .warning */.$e)(`Failed to parse npm pack JSON output: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
            if (output) {
                (0,_actions_compat/* .debug */.Yz)(`npm pack stdout: ${output.trim()}`);
            }
            return undefined;
        }
        if (packInfo.length === 0 || !packInfo[0].filename) {
            (0,_actions_compat/* .warning */.$e)(`npm pack did not return filename in ${directory}`);
            if (output) {
                (0,_actions_compat/* .debug */.Yz)(`npm pack stdout: ${output.trim()}`);
            }
            return undefined;
        }
        const filename = packInfo[0].filename;
        const tarballPath = (0,external_node_path_.join)(directory, filename);
        if (!(0,external_node_fs_.existsSync)(tarballPath)) {
            (0,_actions_compat/* .warning */.$e)(`Tarball not found at expected path: ${tarballPath}`);
            return undefined;
        }
        // Compute SHA-256 digest
        const content = (0,external_node_fs_.readFileSync)(tarballPath);
        const hash = (0,external_node_crypto_.createHash)("sha256").update(content).digest("hex");
        const digest = `sha256:${hash}`;
        (0,_actions_compat/* .debug */.Yz)(`Packed tarball: ${filename}, digest: ${digest}`);
        return {
            path: tarballPath,
            digest,
            filename
        };
    } catch (err) {
        (0,_actions_compat/* .warning */.$e)(`Failed to pack tarball in ${directory}: ${err instanceof Error ? err.message : String(err)}`);
        if (errorOutput) {
            (0,_actions_compat/* .warning */.$e)(`npm pack stderr: ${errorOutput.trim()}`);
        }
        return undefined;
    }
}
/**
 * Get remote tarball integrity from registry using npm view
 */ async function getRemoteTarballIntegrity(packageName, version, registry, packageManager) {
    let output = "";
    const npmCmd = getNpmCommand(packageManager);
    const args = [
        ...npmCmd.baseArgs,
        "view",
        `${packageName}@${version}`,
        "dist.shasum"
    ];
    if (registry) {
        args.push("--registry", registry);
    }
    try {
        await (0,_actions_compat/* .exec */.m0)(npmCmd.cmd, args, {
            silent: true,
            listeners: {
                stdout: (data)=>{
                    output += data.toString();
                }
            },
            ignoreReturnCode: true
        });
        const shasum = output.trim();
        return shasum || undefined;
    } catch  {
        (0,_actions_compat/* .debug */.Yz)(`Failed to get remote tarball integrity for ${packageName}@${version}`);
        return undefined;
    }
}
/**
 * Check if a specific version exists on a registry
 *
 * Uses `npm view <package>@<version> --json --registry <url>` to check
 * if a version already exists before attempting to publish.
 *
 * @param packageName - Package name (e.g., "@savvy-web/my-package")
 * @param version - Version to check (e.g., "1.0.0")
 * @param registry - Registry URL (e.g., "https://registry.npmjs.org/")
 * @param packageManager - Package manager to use for the npm command
 * @returns Version check result with existence status and version info
 */ async function checkVersionExists(packageName, version, registry, packageManager) {
    let output = "";
    let errorOutput = "";
    const npmCmd = getNpmCommand(packageManager);
    const args = [
        ...npmCmd.baseArgs,
        "view",
        `${packageName}@${version}`,
        "--json"
    ];
    if (registry) {
        args.push("--registry", registry);
    }
    const registryName = (0,registry_utils/* .getRegistryDisplayName */.DN)(registry);
    (0,_actions_compat/* .debug */.Yz)(`Checking if ${packageName}@${version} exists on ${registryName}`);
    let exitCode = 0;
    try {
        exitCode = await (0,_actions_compat/* .exec */.m0)(npmCmd.cmd, args, {
            silent: true,
            listeners: {
                stdout: (data)=>{
                    output += data.toString();
                },
                stderr: (data)=>{
                    errorOutput += data.toString();
                }
            },
            ignoreReturnCode: true
        });
    } catch (e) {
        return {
            success: false,
            versionExists: false,
            error: e instanceof Error ? e.message : String(e),
            rawOutput: output || errorOutput
        };
    }
    // Try to parse the JSON output
    const trimmedOutput = output.trim();
    // If no output or exit code indicates error, check for specific cases
    if (!trimmedOutput || exitCode !== 0) {
        // Check if this is a "not found" error (package or version doesn't exist)
        // npm view returns exit code 1 and E404 for missing packages
        if (errorOutput.includes("E404") || errorOutput.includes("is not in this registry")) {
            (0,_actions_compat/* .debug */.Yz)(`Package ${packageName}@${version} not found on ${registryName}`);
            return {
                success: true,
                versionExists: false,
                rawOutput: errorOutput
            };
        }
        // Try to parse error JSON
        try {
            const errorJson = JSON.parse(trimmedOutput || errorOutput);
            if (errorJson.error?.code === "E404") {
                return {
                    success: true,
                    versionExists: false,
                    rawOutput: trimmedOutput || errorOutput
                };
            }
        } catch  {
        // Not JSON, continue with error handling
        }
        // Other errors (network, auth, etc.)
        return {
            success: false,
            versionExists: false,
            error: errorOutput || `npm view failed with exit code ${exitCode}`,
            rawOutput: trimmedOutput || errorOutput
        };
    }
    // Parse successful response
    try {
        const data = JSON.parse(trimmedOutput);
        // npm view returns the version info if it exists
        if (data.name && data.version) {
            const versionInfo = {
                name: data.name,
                version: data.version,
                versions: data.versions || [
                    data.version
                ],
                distTags: data["dist-tags"] || {},
                dist: data.dist,
                time: data.time
            };
            return {
                success: true,
                versionExists: true,
                versionInfo,
                rawOutput: trimmedOutput
            };
        }
        // Empty response means version doesn't exist
        return {
            success: true,
            versionExists: false,
            rawOutput: trimmedOutput
        };
    } catch (e) {
        return {
            success: false,
            versionExists: false,
            error: `Failed to parse npm view output: ${e instanceof Error ? e.message : String(e)}`,
            rawOutput: trimmedOutput
        };
    }
}
/**
 * Compare local and remote tarball integrity to determine if skip is safe
 */ async function compareTarballIntegrity(target, packageManager) {
    const pkgJsonPath = (0,external_node_path_.join)(target.directory, "package.json");
    if (!(0,external_node_fs_.existsSync)(pkgJsonPath)) {
        return {
            reason: "unknown"
        };
    }
    const pkg = JSON.parse((0,external_node_fs_.readFileSync)(pkgJsonPath, "utf-8"));
    if (!pkg.name || !pkg.version) {
        return {
            reason: "unknown"
        };
    }
    const [localIntegrity, remoteIntegrity] = await Promise.all([
        getLocalTarballIntegrity(target.directory, packageManager),
        getRemoteTarballIntegrity(pkg.name, pkg.version, target.registry, packageManager)
    ]);
    if (!localIntegrity || !remoteIntegrity) {
        (0,_actions_compat/* .debug */.Yz)(`Could not compare integrity: local=${localIntegrity}, remote=${remoteIntegrity}`);
        return {
            reason: "unknown",
            localIntegrity,
            remoteIntegrity
        };
    }
    if (localIntegrity === remoteIntegrity) {
        (0,_actions_compat/* .info */.pq)(`✓ Local tarball matches remote (shasum: ${localIntegrity.substring(0, 12)}...)`);
        return {
            reason: "identical",
            localIntegrity,
            remoteIntegrity
        };
    }
    (0,_actions_compat/* .warning */.$e)(`✗ Local tarball differs from remote!`);
    (0,_actions_compat/* .warning */.$e)(`  Local:  ${localIntegrity}`);
    (0,_actions_compat/* .warning */.$e)(`  Remote: ${remoteIntegrity}`);
    return {
        reason: "different",
        localIntegrity,
        remoteIntegrity
    };
}
/**
 * Publish to any npm-compatible registry
 *
 * This function implements a pre-check strategy:
 * 1. Read package.json to get name and version
 * 2. Check if the version already exists on the registry
 * 3. If exists with identical content, skip publishing
 * 4. If exists with different content, fail with clear error
 * 5. If doesn't exist, proceed with publish
 *
 * @param target - Resolved target to publish to
 * @param packageManager - Package manager to use
 * @param prePackedTarball - Optional pre-packed tarball to use instead of packing fresh
 */ async function publishToNpmCompatible(target, packageManager, prePackedTarball) {
    const registryName = (0,registry_utils/* .getRegistryDisplayName */.DN)(target.registry);
    // Read package.json to get name and version
    const pkgJsonPath = (0,external_node_path_.join)(target.directory, "package.json");
    if (!(0,external_node_fs_.existsSync)(pkgJsonPath)) {
        return {
            success: false,
            output: "",
            error: `package.json not found at ${pkgJsonPath}`,
            exitCode: 1
        };
    }
    const pkg = JSON.parse((0,external_node_fs_.readFileSync)(pkgJsonPath, "utf-8"));
    if (!pkg.name || !pkg.version) {
        return {
            success: false,
            output: "",
            error: "package.json missing name or version",
            exitCode: 1
        };
    }
    const packageName = pkg.name;
    const version = pkg.version;
    // Pre-check: Does this version already exist on the registry?
    (0,_actions_compat/* .info */.pq)(`Checking ${packageName}@${version} on ${registryName}...`);
    const versionCheck = await checkVersionExists(packageName, version, target.registry, packageManager);
    if (!versionCheck.success) {
        // Registry check failed - could be auth issue, network issue, etc.
        (0,_actions_compat/* .warning */.$e)(`⚠ Could not verify version on ${registryName}: ${versionCheck.error}`);
        (0,_actions_compat/* .info */.pq)("Proceeding with publish attempt...");
    } else if (versionCheck.versionExists) {
        // Version already exists - compare integrity
        (0,_actions_compat/* .info */.pq)(`Version ${version} already exists on ${registryName}`);
        // Get local tarball integrity for comparison
        const localIntegrity = await getLocalTarballIntegrity(target.directory, packageManager);
        const remoteIntegrity = versionCheck.versionInfo?.dist?.shasum;
        if (localIntegrity && remoteIntegrity) {
            if (localIntegrity === remoteIntegrity) {
                (0,_actions_compat/* .info */.pq)(`✓ Local tarball matches remote (shasum: ${localIntegrity.substring(0, 12)}...)`);
                (0,_actions_compat/* .info */.pq)(`✓ Skipping publish - identical content already published`);
                // Show dist-tags info
                const distTags = versionCheck.versionInfo?.distTags;
                if (distTags && Object.keys(distTags).length > 0) {
                    const tagsList = Object.entries(distTags).map(([tag, ver])=>`${tag}=${ver}`).join(", ");
                    (0,_actions_compat/* .info */.pq)(`  Current dist-tags: ${tagsList}`);
                }
                // Pack fresh from target.directory if no pre-packed tarball
                // was supplied. Downstream consumers (release assets, SBOM
                // uploads, provenance attestations) need a path to the
                // actual artifact — npm pack resolves the published file
                // set via the directory's own package.json, so this
                // reproduces the same digest the registry already has.
                const resolvedTarball = prePackedTarball ?? await packAndComputeDigest(target.directory, packageManager);
                return {
                    success: true,
                    output: `Version ${version} already published with identical content`,
                    error: "",
                    exitCode: 0,
                    registryUrl: generatePackageUrl(target),
                    alreadyPublished: true,
                    alreadyPublishedReason: "identical",
                    localIntegrity,
                    remoteIntegrity,
                    tarballPath: resolvedTarball?.path,
                    tarballDigest: resolvedTarball?.digest
                };
            }
            // Content differs - this is an error condition
            (0,_actions_compat/* .error */.z3)(`✗ Local tarball differs from published version!`);
            (0,_actions_compat/* .error */.z3)(`  Local shasum:  ${localIntegrity}`);
            (0,_actions_compat/* .error */.z3)(`  Remote shasum: ${remoteIntegrity}`);
            (0,_actions_compat/* .error */.z3)(`  This indicates the package content changed without a version bump.`);
            return {
                success: false,
                output: "",
                error: `Version ${version} already published with different content (local: ${localIntegrity}, remote: ${remoteIntegrity})`,
                exitCode: 1,
                alreadyPublished: true,
                alreadyPublishedReason: "different",
                localIntegrity,
                remoteIntegrity
            };
        }
        // Could not compare integrity - proceed with warning
        (0,_actions_compat/* .warning */.$e)(`⚠ Could not compare tarball integrity (local: ${localIntegrity || "unavailable"}, remote: ${remoteIntegrity || "unavailable"})`);
        (0,_actions_compat/* .info */.pq)(`✓ Skipping publish - version already exists`);
        const resolvedTarball = prePackedTarball ?? await packAndComputeDigest(target.directory, packageManager);
        return {
            success: true,
            output: `Version ${version} already published (integrity comparison unavailable)`,
            error: "",
            exitCode: 0,
            registryUrl: generatePackageUrl(target),
            alreadyPublished: true,
            alreadyPublishedReason: "unknown",
            localIntegrity,
            remoteIntegrity,
            tarballPath: resolvedTarball?.path,
            tarballDigest: resolvedTarball?.digest
        };
    } else {
        // Version doesn't exist - show available versions for context
        (0,_actions_compat/* .info */.pq)(`✓ Version ${version} not found on ${registryName} - proceeding with publish`);
    }
    // Step 1: Use pre-packed tarball if provided, otherwise pack fresh
    // Using a pre-packed tarball ensures all targets receive identical content with the same digest
    let packResult;
    if (prePackedTarball) {
        // Reuse the pre-packed tarball for consistent multi-target publishing
        (0,_actions_compat/* .debug */.Yz)(`Using pre-packed tarball: ${prePackedTarball.filename}`);
        packResult = prePackedTarball;
    } else {
        // Pack fresh (single-target or legacy mode)
        (0,_actions_compat/* .info */.pq)(`Packing ${packageName}@${version}...`);
        const freshPackResult = await packAndComputeDigest(target.directory, packageManager);
        if (!freshPackResult) {
            return {
                success: false,
                output: "",
                error: "Failed to create tarball with npm pack",
                exitCode: 1
            };
        }
        packResult = freshPackResult;
        (0,_actions_compat/* .info */.pq)(`✓ Created tarball: ${packResult.filename}`);
    }
    (0,_actions_compat/* .debug */.Yz)(`  Digest: ${packResult.digest}`);
    // Step 2: Build publish command with the specific tarball
    let output = "";
    let errorOutput = "";
    let exitCode = 0;
    // Publish the specific tarball file to ensure digest consistency
    const args = [
        "publish",
        packResult.path
    ];
    if (target.registry) {
        args.push("--registry", target.registry);
    }
    // Provenance creates SLSA attestation via Sigstore
    // Requires OIDC token permissions in GitHub Actions
    if (target.provenance) {
        args.push("--provenance");
    }
    if (target.access) {
        args.push("--access", target.access);
    }
    if (target.tag && target.tag !== "latest") {
        args.push("--tag", target.tag);
    }
    const publishCmd = getPublishCommand(packageManager);
    const fullArgs = [
        ...publishCmd.baseArgs,
        ...args
    ];
    (0,_actions_compat/* .info */.pq)(`Running: ${publishCmd.cmd} ${fullArgs.join(" ")}`);
    try {
        exitCode = await (0,_actions_compat/* .exec */.m0)(publishCmd.cmd, fullArgs, {
            cwd: target.directory,
            listeners: {
                stdout: (data)=>{
                    output += data.toString();
                },
                stderr: (data)=>{
                    errorOutput += data.toString();
                }
            },
            ignoreReturnCode: true
        });
    } catch (e) {
        exitCode = 1;
        errorOutput = e instanceof Error ? e.message : String(e);
    }
    const registryUrl = generatePackageUrl(target);
    const attestationUrl = target.provenance ? extractProvenanceUrl(output) : undefined;
    if (exitCode === 0) {
        (0,_actions_compat/* .info */.pq)(`✓ Successfully published ${packageName}@${version} to ${registryName}`);
        if (attestationUrl) {
            (0,_actions_compat/* .info */.pq)(`  Provenance: ${attestationUrl}`);
        }
    } else {
        // Check if this is a "version already published" error (race condition)
        const alreadyPublished = isVersionAlreadyPublished(output, errorOutput);
        if (alreadyPublished) {
            (0,_actions_compat/* .info */.pq)("Version was published by another process - verifying integrity...");
            const comparison = await compareTarballIntegrity(target, packageManager);
            return {
                success: comparison.reason !== "different",
                output,
                error: errorOutput,
                exitCode,
                registryUrl,
                alreadyPublished: true,
                alreadyPublishedReason: comparison.reason,
                localIntegrity: comparison.localIntegrity,
                remoteIntegrity: comparison.remoteIntegrity
            };
        }
        (0,_actions_compat/* .error */.z3)(`✗ Failed to publish ${packageName}@${version} to ${registryName}`);
    }
    return {
        success: exitCode === 0,
        output,
        error: errorOutput,
        exitCode,
        registryUrl,
        attestationUrl,
        tarballPath: packResult.path,
        tarballDigest: packResult.digest
    };
}
/**
 * Check if JSR error indicates version already published
 */ function isJsrVersionAlreadyPublished(output, error) {
    return output.includes("already exists") || error.includes("already exists") || error.includes("Version") && error.includes("already published");
}
/**
 * Publish to JSR
 */ async function publishToJsr(target, packageManager) {
    let output = "";
    let errorOutput = "";
    let exitCode = 0;
    // JSR uses npx/pnpm dlx/bun x to run jsr publish
    // --allow-dirty is needed because we're in a git repo with changes
    const npx = getNpxCommand(packageManager);
    const args = [
        ...npx.args,
        "jsr",
        "publish",
        "--allow-dirty"
    ];
    (0,_actions_compat/* .info */.pq)(`Publishing to JSR: ${npx.cmd} ${args.join(" ")}`);
    (0,_actions_compat/* .info */.pq)(`  Directory: ${target.directory}`);
    try {
        exitCode = await (0,_actions_compat/* .exec */.m0)(npx.cmd, args, {
            cwd: target.directory,
            listeners: {
                stdout: (data)=>{
                    output += data.toString();
                },
                stderr: (data)=>{
                    errorOutput += data.toString();
                }
            },
            ignoreReturnCode: true
        });
    } catch (e) {
        exitCode = 1;
        errorOutput = e instanceof Error ? e.message : String(e);
    }
    // Extract JSR package URL from output
    const urlMatch = output.match(/https:\/\/jsr\.io\/@[^\s]+/);
    const registryUrl = urlMatch?.[0];
    const alreadyPublished = isJsrVersionAlreadyPublished(output, errorOutput);
    return {
        success: exitCode === 0,
        output,
        error: errorOutput,
        exitCode,
        registryUrl,
        alreadyPublished
    };
}
/**
 * Publish a package to a target
 *
 * @param target - Resolved target to publish to
 * @param dryRun - Whether this is a dry-run (skip actual publish)
 * @param packageManager - Package manager to use (defaults to "npm")
 * @param prePackedTarball - Optional pre-packed tarball for consistent multi-target publishing
 * @returns Publish result
 */ async function publishToTarget(target, dryRun, packageManager = "npm", prePackedTarball) {
    if (dryRun) {
        const registryName = target.protocol === "jsr" ? "JSR" : (0,registry_utils/* .getRegistryDisplayName */.DN)(target.registry);
        (0,_actions_compat/* .info */.pq)(`[DRY RUN] Would publish to ${registryName}: ${target.directory}`);
        return {
            success: true,
            output: "[DRY RUN] Skipped actual publish",
            error: "",
            exitCode: 0
        };
    }
    switch(target.protocol){
        case "npm":
            return publishToNpmCompatible(target, packageManager, prePackedTarball);
        case "jsr":
            return publishToJsr(target, packageManager);
        default:
            throw new Error(`Unknown protocol: ${target.protocol}`);
    }
}

;// CONCATENATED MODULE: ./src/utils/resolve-targets.ts

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
                directory: publishConfig.directory ? (0,external_node_path_.resolve)(packagePath, publishConfig.directory) : packagePath,
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
        const directory = expanded.directory ? (0,external_node_path_.resolve)(packagePath, expanded.directory) : publishConfig.directory ? (0,external_node_path_.resolve)(packagePath, publishConfig.directory) : packagePath;
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

;// CONCATENATED MODULE: ./src/utils/registry-auth.ts





/** Timeout for registry health checks (10 seconds) */ const REGISTRY_CHECK_TIMEOUT_MS = 10000;
/**
 * Get the command to run npm operations
 *
 * This is the primary wrapper for running npm commands across different package managers.
 * All package managers use their "execute" command to run npm.
 *
 * @remarks
 * - npm: `npx npm <args>`
 * - pnpm: `pnpm dlx npm <args>`
 * - yarn: `yarn npm <args>`
 * - bun: `bun x npm <args>`
 *
 * @param packageManager - The package manager being used
 * @returns Command and base args to prepend before npm arguments
 */ function registry_auth_getNpmCommand(packageManager) {
    switch(packageManager){
        case "pnpm":
            return {
                cmd: "pnpm",
                baseArgs: [
                    "dlx",
                    "npm"
                ]
            };
        case "yarn":
            return {
                cmd: "yarn",
                baseArgs: [
                    "npm"
                ]
            };
        case "bun":
            return {
                cmd: "bun",
                baseArgs: [
                    "x",
                    "npm"
                ]
            };
        default:
            return {
                cmd: "npx",
                baseArgs: [
                    "npm"
                ]
            };
    }
}
/**
 * Check if npm token is available (either via input or environment)
 *
 * @returns The npm token if available, undefined otherwise
 */ function getNpmToken() {
    // Check input first (set by pre.ts or directly)
    const inputToken = (0,_actions_compat/* .getInput */.V4)("npm-token");
    if (inputToken) return inputToken;
    // Check environment variable as fallback
    return process.env.NPM_TOKEN;
}
/**
 * Check if a registry uses OIDC-based authentication
 *
 * @remarks
 * OIDC (OpenID Connect) enables token-less publishing:
 * - npm public registry: Uses trusted publishing via Sigstore OIDC (when no NPM_TOKEN provided)
 * - JSR: Uses OIDC natively in GitHub Actions
 *
 * Note: If an NPM_TOKEN is provided, npm registry will NOT use OIDC.
 * This allows first-time publishes and fallback authentication.
 *
 * @param registry - Registry URL to check
 * @returns true if registry uses OIDC
 */ function isOidcRegistry(registry) {
    if (!registry) return false;
    // npm public registry supports OIDC trusted publishing
    // BUT only if no NPM_TOKEN is provided (OIDC requires package to exist first)
    if ((0,registry_utils/* .isNpmRegistry */.HJ)(registry)) {
        const npmToken = getNpmToken();
        if (npmToken) {
            // Token provided - don't use OIDC, use token auth instead
            (0,_actions_compat/* .debug */.Yz)("NPM_TOKEN provided - using token auth instead of OIDC for npm");
            return false;
        }
        return true;
    }
    return false;
}
/**
 * Check if a registry URL is reachable using npm ping
 *
 * @remarks
 * Uses `npm ping --registry=<url> --json` which is more accurate than HTTP fetch
 * because it tests the actual npm protocol that will be used for publishing.
 *
 * @param registry - Registry URL to check
 * @param packageManager - Package manager to use for running npm commands
 * @returns Object with reachable status and error message if failed
 */ async function checkRegistryReachable(registry, packageManager) {
    let output = "";
    let errorOutput = "";
    // Create a timeout promise that rejects after the timeout
    const timeoutPromise = new Promise((_, reject)=>{
        setTimeout(()=>{
            reject(new Error(`Timeout after ${REGISTRY_CHECK_TIMEOUT_MS}ms`));
        }, REGISTRY_CHECK_TIMEOUT_MS);
    });
    // Create the exec promise
    const execPromise = (async ()=>{
        const npmCmd = registry_auth_getNpmCommand(packageManager);
        const args = [
            ...npmCmd.baseArgs,
            "ping",
            "--registry",
            registry,
            "--json"
        ];
        const exitCode = await (0,_actions_compat/* .exec */.m0)(npmCmd.cmd, args, {
            silent: true,
            listeners: {
                stdout: (data)=>{
                    output += data.toString();
                },
                stderr: (data)=>{
                    errorOutput += data.toString();
                }
            },
            ignoreReturnCode: true
        });
        if (exitCode === 0) {
            return {
                reachable: true
            };
        }
        // Try to parse JSON error from npm
        try {
            const parsed = JSON.parse(output || errorOutput);
            if (parsed.error) {
                return {
                    reachable: false,
                    error: parsed.error.summary || parsed.error.code || "npm ping failed"
                };
            }
        } catch  {
        // Not JSON, use raw output
        }
        // Extract meaningful error from output
        const combinedOutput = `${output} ${errorOutput}`.trim();
        if (combinedOutput.includes("ENOTFOUND") || combinedOutput.includes("getaddrinfo")) {
            return {
                reachable: false,
                error: "Registry hostname not found"
            };
        }
        if (combinedOutput.includes("ECONNREFUSED")) {
            return {
                reachable: false,
                error: "Connection refused"
            };
        }
        if (combinedOutput.includes("ETIMEDOUT") || combinedOutput.includes("timeout")) {
            return {
                reachable: false,
                error: "Connection timed out"
            };
        }
        if (combinedOutput.includes("503") || combinedOutput.includes("Service Unavailable")) {
            return {
                reachable: false,
                error: "Service unavailable (503)"
            };
        }
        return {
            reachable: false,
            error: combinedOutput.slice(0, 200) || `npm ping failed with exit code ${exitCode}`
        };
    })();
    try {
        // Race between exec and timeout
        return await Promise.race([
            execPromise,
            timeoutPromise
        ]);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes("Timeout")) {
                return {
                    reachable: false,
                    error: error.message
                };
            }
            return {
                reachable: false,
                error: error.message
            };
        }
        return {
            reachable: false,
            error: "Unknown error checking registry"
        };
    }
}
/**
 * Validate that all non-OIDC registries are reachable
 *
 * @remarks
 * Checks each custom registry URL to ensure it responds. This prevents
 * npm from hanging indefinitely when a registry URL is misconfigured.
 *
 * @param targets - Array of resolved targets to validate
 * @param packageManager - Package manager to use for running npm commands
 * @returns Array of unreachable registries with error messages
 */ async function validateRegistriesReachable(targets, packageManager) {
    const unreachable = [];
    const checkedRegistries = new Set();
    for (const target of targets){
        // Skip non-npm protocols
        if (target.protocol !== "npm" || !target.registry) continue;
        // Skip already checked registries
        if (checkedRegistries.has(target.registry)) continue;
        checkedRegistries.add(target.registry);
        // Skip well-known registries that we trust
        if (isOidcRegistry(target.registry)) continue;
        if ((0,registry_utils/* .isGitHubPackagesRegistry */.yQ)(target.registry)) continue;
        (0,_actions_compat/* .debug */.Yz)(`Checking registry reachability: ${target.registry}`);
        const result = await checkRegistryReachable(target.registry, packageManager);
        if (!result.reachable) {
            (0,_actions_compat/* .warning */.$e)(`Registry unreachable: ${target.registry} - ${result.error}`);
            unreachable.push({
                registry: target.registry,
                error: result.error || "Unknown error"
            });
        } else {
            (0,_actions_compat/* .debug */.Yz)(`Registry reachable: ${target.registry}`);
        }
    }
    return unreachable;
}
/**
 * Validate that required tokens are available in environment
 *
 * @remarks
 * OIDC-based registries (npm without NPM_TOKEN, JSR) don't require tokens - they use
 * temporary credentials from the GitHub Actions OIDC provider.
 * When NPM_TOKEN is provided, npm uses token auth instead of OIDC.
 * GitHub Packages and custom registries always require tokens.
 *
 * @param targets - Array of resolved targets to validate
 * @returns Validation result with missing tokens
 */ function validateTokensAvailable(targets) {
    const missing = [];
    for (const target of targets){
        // JSR uses OIDC in GitHub Actions, token is optional
        if (target.protocol === "jsr") {
            (0,_actions_compat/* .debug */.Yz)("JSR uses OIDC - no token required");
            continue;
        }
        // npm public registry uses OIDC trusted publishing (when no NPM_TOKEN)
        if (isOidcRegistry(target.registry)) {
            (0,_actions_compat/* .debug */.Yz)("npm uses OIDC trusted publishing - no token required");
            continue;
        }
        // For npm registry with NPM_TOKEN, check the special env var we set up
        if ((0,registry_utils/* .isNpmRegistry */.HJ)(target.registry) && !target.tokenEnv) {
            // Check if REGISTRY_NPMJS_ORG_TOKEN was set by setupRegistryAuth
            if (process.env.REGISTRY_NPMJS_ORG_TOKEN) {
                (0,_actions_compat/* .debug */.Yz)("npm registry using NPM_TOKEN - token available");
                continue;
            }
            missing.push({
                registry: target.registry || "unknown",
                tokenEnv: "NPM_TOKEN or OIDC trusted publishing"
            });
            continue;
        }
        // GitHub Packages and custom registries need tokens
        if (!target.tokenEnv) {
            missing.push({
                registry: target.registry || "unknown",
                tokenEnv: "tokenEnv not specified"
            });
            continue;
        }
        if (!process.env[target.tokenEnv]) {
            missing.push({
                registry: target.registry || "unknown",
                tokenEnv: target.tokenEnv
            });
        }
    }
    return {
        valid: missing.length === 0,
        missing
    };
}
/**
 * Generate .npmrc with authentication for non-OIDC registries
 *
 * @remarks
 * Only generates auth entries for:
 * - npm public registry (when NPM_TOKEN is provided)
 * - GitHub Packages (uses GitHub App token)
 * - Custom registries (uses provided tokens)
 *
 * OIDC registries (npm public without token, JSR) don't need .npmrc entries.
 *
 * @param targets - Array of resolved targets to configure auth for
 */ function generateNpmrc(targets) {
    const lines = [];
    const processedRegistries = new Set();
    for (const target of targets){
        if (target.protocol !== "npm" || !target.registry) continue;
        if (processedRegistries.has(target.registry)) continue;
        // Skip OIDC registries - they don't need .npmrc auth
        if (isOidcRegistry(target.registry)) {
            (0,_actions_compat/* .info */.pq)(`${target.registry} uses OIDC - skipping .npmrc auth`);
            processedRegistries.add(target.registry);
            continue;
        }
        processedRegistries.add(target.registry);
        // Determine the token env var to use
        // For npm registry with NPM_TOKEN, we use REGISTRY_NPMJS_ORG_TOKEN (set by setupRegistryAuth)
        let tokenEnvVar = target.tokenEnv;
        if (!tokenEnvVar && (0,registry_utils/* .isNpmRegistry */.HJ)(target.registry)) {
            // npm registry without explicit tokenEnv - check for NPM_TOKEN setup
            tokenEnvVar = "REGISTRY_NPMJS_ORG_TOKEN";
        }
        if (!tokenEnvVar) {
            (0,_actions_compat/* .warning */.$e)(`No token env var for registry: ${target.registry}`);
            continue;
        }
        const authValue = process.env[tokenEnvVar];
        if (!authValue) {
            (0,_actions_compat/* .warning */.$e)(`Token env var ${tokenEnvVar} is not set for registry: ${target.registry}`);
            continue;
        }
        // Convert registry URL to npmrc format
        // https://npm.pkg.github.com/ -> //npm.pkg.github.com/:_authToken=TOKEN
        const registryPath = target.registry.replace(/^https?:/, "");
        // Check if authValue is already a full auth string (_authToken=... or _auth=...)
        // or if it's just a raw token that needs wrapping
        if (authValue.startsWith("_authToken=") || authValue.startsWith("_auth=")) {
            // Full auth string - use as-is
            lines.push(`${registryPath}:${authValue}`);
        } else {
            // Raw token - wrap with _authToken=
            lines.push(`${registryPath}:_authToken=${authValue}`);
        }
        (0,_actions_compat/* .info */.pq)(`Configured auth for: ${target.registry}`);
    }
    if (lines.length === 0) {
        (0,_actions_compat/* .debug */.Yz)("No registries to configure in .npmrc");
        return;
    }
    // Write to user's home .npmrc
    const npmrcPath = (0,external_node_path_.join)(process.env.HOME || "~", ".npmrc");
    // Append to existing .npmrc if it exists
    const existingContent = (0,external_node_fs_.existsSync)(npmrcPath) ? (0,external_node_fs_.readFileSync)(npmrcPath, "utf-8") : "";
    const newContent = existingContent ? `${existingContent}\n\n# Added by workflow-release-action\n${lines.join("\n")}\n` : `# Generated by workflow-release-action\n${lines.join("\n")}\n`;
    (0,external_node_fs_.writeFileSync)(npmrcPath, newContent);
    (0,_actions_compat/* .info */.pq)(`Updated .npmrc with ${lines.length} registry auth(s)`);
}
/**
 * Setup authentication for all registries
 *
 * @remarks
 * Authentication strategy:
 * - **npm public registry**: Uses `npm-token` input if provided, otherwise OIDC trusted publishing
 * - **GitHub Packages**: Uses `github-token` input if provided, otherwise GitHub App token
 * - **JSR**: Uses OIDC (no token needed)
 * - **Custom registries**: Uses tokens from `custom-registries` input, or GitHub App token if not specified
 *
 * The GitHub Packages token is set to SILK_GITHUB_PACKAGES_TOKEN for the npm subprocess.
 * NPM_TOKEN is set when npm-token input is provided (for first-time publishes or OIDC fallback).
 * No .npmrc entry is needed for JSR since it uses OIDC.
 *
 * Custom registries format (one per line):
 * - `https://registry.example.com/` - Use GitHub App token
 * - `https://registry.example.com/=TOKEN` - Use explicit token (optional)
 *
 * @param targets - Array of resolved targets to setup auth for
 * @param packageManager - Package manager to use for running npm commands
 * @returns Authentication setup result
 */ async function setupRegistryAuth(targets, packageManager) {
    // Get tokens from state (set by pre.ts)
    const appToken = (0,_actions_compat/* .getState */.Gu)("token");
    const githubToken = (0,_actions_compat/* .getState */.Gu)("githubToken"); // Optional: workflow's GITHUB_TOKEN for packages:write
    // Check for NPM token (for npm registry when OIDC isn't configured)
    const npmToken = getNpmToken();
    if (npmToken) {
        // Set NPM_TOKEN environment variable for npm CLI
        process.env.NPM_TOKEN = npmToken;
        (0,_actions_compat/* .setSecret */.Pq)(npmToken);
        (0,_actions_compat/* .info */.pq)("Using NPM_TOKEN for npm registry authentication (OIDC disabled)");
        // Also set the env var that will be used by tokenEnv in targets
        process.env.REGISTRY_NPMJS_ORG_TOKEN = `_authToken=${npmToken}`;
        (0,_actions_compat/* .setSecret */.Pq)(`_authToken=${npmToken}`);
    }
    // Determine which token to use for GitHub Packages
    // Prefer the explicit github-token input (has packages:write from workflow permissions)
    // Fall back to GitHub App token if not provided
    const packagesToken = githubToken || appToken;
    if (!packagesToken) {
        (0,_actions_compat/* .warning */.$e)("No GitHub token available - GitHub Packages and custom registries may fail to authenticate");
    } else {
        // Provide the GitHub Packages token to the npm subprocess via a
        // dedicated env var (the target's tokenEnv) — never GITHUB_TOKEN.
        process.env.SILK_GITHUB_PACKAGES_TOKEN = packagesToken;
        if (githubToken) {
            (0,_actions_compat/* .info */.pq)("Using workflow github-token for GitHub Packages authentication (packages:write)");
        } else {
            (0,_actions_compat/* .info */.pq)("Using GitHub App token for GitHub Packages authentication");
        }
    }
    // Use appToken for custom registries (GitHub App token for API operations)
    const customRegistryToken = appToken;
    // Parse custom registries input
    // Format: "https://registry.example.com/" (uses GitHub App token)
    // Format: "https://registry.example.com/_authToken=TOKEN" (npmrc auth string appended)
    // Format: "https://registry.example.com/_auth=BASE64" (htpasswd auth string appended)
    const customRegistriesInput = (0,_actions_compat/* .getInput */.V4)("custom-registries");
    if (customRegistriesInput) {
        const inputLines = customRegistriesInput.split("\n").filter((line)=>line.trim());
        for (const line of inputLines){
            const trimmedLine = line.trim();
            // Look for npmrc auth string patterns (_authToken= or _auth=)
            const authTokenMatch = trimmedLine.match(/^(.+?)(_authToken=.+)$/);
            const authMatch = trimmedLine.match(/^(.+?)(_auth=.+)$/);
            if (authTokenMatch) {
                // Format: URL_authToken=TOKEN (npmrc auth string appended directly)
                const registry = `${authTokenMatch[1].replace(/\/$/, "")}/`; // Normalize trailing slash
                const authString = authTokenMatch[2]; // Full auth string: _authToken=TOKEN
                const envVarName = registryToEnvName(registry);
                // Mask both the full auth string and the token value to prevent leaks
                (0,_actions_compat/* .setSecret */.Pq)(authString);
                const tokenValue = authString.replace(/^_authToken=/, "");
                if (tokenValue) (0,_actions_compat/* .setSecret */.Pq)(tokenValue);
                process.env[envVarName] = authString;
                (0,_actions_compat/* .info */.pq)(`Set ${envVarName} for custom registry: ${registry}`);
            } else if (authMatch) {
                // Format: URL_auth=BASE64 (htpasswd auth string appended directly)
                const registry = `${authMatch[1].replace(/\/$/, "")}/`; // Normalize trailing slash
                const authString = authMatch[2]; // Full auth string: _auth=BASE64
                const envVarName = registryToEnvName(registry);
                // Mask both the full auth string and the base64 value to prevent leaks
                (0,_actions_compat/* .setSecret */.Pq)(authString);
                const authValue = authString.replace(/^_auth=/, "");
                if (authValue) (0,_actions_compat/* .setSecret */.Pq)(authValue);
                process.env[envVarName] = authString;
                (0,_actions_compat/* .info */.pq)(`Set ${envVarName} for custom registry: ${registry}`);
            } else {
                // No auth string found - registry URL only, use GitHub App token
                const registry = trimmedLine;
                if (registry && customRegistryToken) {
                    const envVarName = registryToEnvName(registry);
                    // Store as _authToken= format for consistency
                    const authString = `_authToken=${customRegistryToken}`;
                    // Mask both formats (token is already masked by GitHub, but be safe)
                    (0,_actions_compat/* .setSecret */.Pq)(authString);
                    (0,_actions_compat/* .setSecret */.Pq)(customRegistryToken);
                    process.env[envVarName] = authString;
                    (0,_actions_compat/* .info */.pq)(`Set ${envVarName} for custom registry: ${registry} (using GitHub App token)`);
                }
            }
        }
    }
    // Validate tokens for non-OIDC registries
    const validation = validateTokensAvailable(targets);
    // Check custom registries are reachable before attempting to use them
    const unreachableRegistries = await validateRegistriesReachable(targets, packageManager);
    // Generate .npmrc for GitHub Packages and custom registries
    generateNpmrc(targets);
    return {
        success: validation.valid && unreachableRegistries.length === 0,
        configuredRegistries: Array.from(new Set(targets.filter((t)=>t.protocol === "npm" && t.registry).map((t)=>t.registry))),
        missingTokens: validation.missing,
        unreachableRegistries
    };
}

// EXTERNAL MODULE: ./node_modules/.pnpm/workspaces-effect@1.0.0_@effect+platform@0.96.1_effect@3.21.2__effect@3.21.2/node_modules/workspaces-effect/index.js + 11 modules
var workspaces_effect = __webpack_require__(52855);
;// CONCATENATED MODULE: ./src/utils/topological-sort.ts


/**
 * Build a name -> production-deps map for every workspace package.
 *
 * @remarks
 * Mirrors the old `workspace-tools` `createDependencyMap` call with
 * `withDevDependencies: false`, `withPeerDependencies: false`,
 * `withOptionalDependencies: false`. Only `dependencies` from each
 * `package.json` participates in the publish order.
 */ function buildWorkspaceDependencyMap(cwd) {
    const map = new Map();
    const root = (0,workspaces_effect/* .findWorkspaceRootSync */.sn)(cwd);
    if (!root) return map;
    const packages = (0,workspaces_effect/* .getWorkspacePackagesSync */.we)(root);
    const known = new Set(packages.map((p)=>p.name));
    for (const pkg of packages){
        const deps = new Set();
        for (const depName of Object.keys(pkg.dependencies)){
            if (known.has(depName)) deps.add(depName);
        }
        map.set(pkg.name, deps);
    }
    return map;
}
/**
 * Sort packages in topological order (dependencies first)
 *
 * @remarks
 * Uses Kahn's algorithm to perform topological sorting. This ensures that
 * when publishing packages, dependencies are published before dependents.
 * This is required for registries like JSR that validate dependencies exist.
 *
 * @param packageNames - List of package names to sort
 * @param cwd - Working directory for finding workspace packages
 * @returns Sorted package names with dependencies first
 *
 * @example
 * ```typescript
 * // Given packages: A depends on B, B depends on C
 * const result = sortPackagesTopologically(['A', 'B', 'C'], process.cwd());
 * // result.sorted = ['C', 'B', 'A']
 * ```
 */ function sortPackagesTopologically(packageNames, cwd = process.cwd()) {
    if (packageNames.length <= 1) {
        return {
            sorted: [
                ...packageNames
            ],
            success: true
        };
    }
    try {
        const dependencies = buildWorkspaceDependencyMap(cwd);
        // Filter to only the packages we care about
        const packageSet = new Set(packageNames);
        // Build in-degree map (count of dependencies within our package set)
        const inDegree = new Map();
        const filteredDeps = new Map();
        for (const pkg of packageNames){
            inDegree.set(pkg, 0);
            filteredDeps.set(pkg, new Set());
        }
        // Count dependencies that are within our package set
        for (const pkg of packageNames){
            const deps = dependencies.get(pkg) || new Set();
            for (const dep of deps){
                if (packageSet.has(dep)) {
                    filteredDeps.get(pkg)?.add(dep);
                    inDegree.set(pkg, (inDegree.get(pkg) || 0) + 1);
                }
            }
        }
        // Kahn's algorithm for topological sort
        const sorted = [];
        const queue = [];
        // Find all packages with no dependencies (in-degree 0)
        for (const [pkg, degree] of inDegree){
            if (degree === 0) {
                queue.push(pkg);
            }
        }
        while(queue.length > 0){
            const pkg = queue.shift();
            if (!pkg) break;
            sorted.push(pkg);
            // For each package that depends on this one, decrement in-degree
            for (const [dependent, deps] of filteredDeps){
                if (deps.has(pkg)) {
                    deps.delete(pkg);
                    const newDegree = (inDegree.get(dependent) || 1) - 1;
                    inDegree.set(dependent, newDegree);
                    if (newDegree === 0) {
                        queue.push(dependent);
                    }
                }
            }
        }
        // Check for circular dependencies
        if (sorted.length !== packageNames.length) {
            const remaining = packageNames.filter((p)=>!sorted.includes(p));
            return {
                sorted: packageNames,
                success: false,
                error: `Circular dependency detected involving: ${remaining.join(", ")}`
            };
        }
        (0,_actions_compat/* .debug */.Yz)(`Topological sort order: ${sorted.join(" -> ")}`);
        return {
            sorted,
            success: true
        };
    } catch (error) {
        // If sorting fails, return original order
        (0,_actions_compat/* .debug */.Yz)(`Topological sort failed: ${error instanceof Error ? error.message : String(error)}`);
        return {
            sorted: [
                ...packageNames
            ],
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
/**
 * Sort a map of packages in topological order
 *
 * @param packageMap - Map of package name to package info
 * @param cwd - Working directory for finding workspace packages
 * @returns Array of [name, info] tuples sorted by dependency order
 */ function sortPackageMapTopologically(packageMap, cwd = process.cwd()) {
    const packageNames = [
        ...packageMap.keys()
    ];
    const result = sortPackagesTopologically(packageNames, cwd);
    if (!result.success && result.error) {
        (0,_actions_compat/* .info */.pq)(`⚠️ ${result.error} - publishing in original order`);
    }
    return result.sorted.map((name)=>{
        const info = packageMap.get(name);
        return info ? [
            name,
            info
        ] : undefined;
    }).filter((entry)=>entry !== undefined);
}

;// CONCATENATED MODULE: ./src/utils/publish-packages.ts











/**
 * Pre-validate all targets before publishing
 *
 * This function checks all targets across all packages to ensure:
 * 1. Authentication is valid (no E401 errors)
 * 2. Registry is reachable (no network errors)
 * 3. If version exists, content is identical (no content mismatch)
 *
 * If ANY target has an error, we fail early to prevent partial publishes.
 *
 * @param packageTargetsMap - Map of package name to targets
 * @param packageManager - Package manager to use
 * @returns Pre-validation result
 */ async function preValidateAllTargets(packageTargetsMap, packageManager) {
    (0,_actions_compat/* .startGroup */.Oh)("Pre-validating all publish targets");
    const validations = [];
    const readyTargets = [];
    const skipTargets = [];
    const errorTargets = [];
    for (const [packageName, packageInfo] of packageTargetsMap){
        for (const target of packageInfo.targets){
            const registryName = (0,registry_utils/* .getRegistryDisplayName */.DN)(target.registry);
            // Read the built package.json to get the resolved name for this target.
            // The built name is authoritative — it may differ from the source name
            // (e.g., "pkg" for npm vs "@scope/pkg" for GitHub Packages).
            let resolvedName = packageName;
            const builtPkgJsonPath = (0,external_node_path_.join)(target.directory, "package.json");
            (0,_actions_compat/* .debug */.Yz)(`Looking for built package.json at: ${builtPkgJsonPath}`);
            if ((0,external_node_fs_.existsSync)(builtPkgJsonPath)) {
                try {
                    const builtPkg = JSON.parse((0,external_node_fs_.readFileSync)(builtPkgJsonPath, "utf-8"));
                    if (builtPkg.name) {
                        resolvedName = builtPkg.name;
                        (0,_actions_compat/* .debug */.Yz)(`Resolved name: ${resolvedName} (from built package.json)`);
                    } else {
                        (0,_actions_compat/* .error */.z3)(`  ✗ Built package.json in ${target.directory} has no 'name' field`);
                        const validation = {
                            target,
                            packageName,
                            version: packageInfo.version,
                            status: "error",
                            error: `Built package.json in ${target.directory} missing 'name' field`
                        };
                        validations.push(validation);
                        errorTargets.push(validation);
                        continue;
                    }
                } catch (err) {
                    (0,_actions_compat/* .error */.z3)(`  ✗ Failed to read built package.json in ${target.directory}: ${err instanceof Error ? err.message : String(err)}`);
                    const validation = {
                        target,
                        packageName,
                        version: packageInfo.version,
                        status: "error",
                        error: `Failed to read built package.json: ${err instanceof Error ? err.message : String(err)}`
                    };
                    validations.push(validation);
                    errorTargets.push(validation);
                    continue;
                }
            } else if (target.directory !== packageInfo.path) {
                // target.directory differs from source path → build output directory
                // that MUST exist after ci:build. Missing = build didn't produce it.
                (0,_actions_compat/* .error */.z3)(`  ✗ Build output directory not found: ${target.directory}`);
                (0,_actions_compat/* .error */.z3)(`    The build did not produce this target directory.`);
                (0,_actions_compat/* .error */.z3)(`    Check that ci:build creates output for all publishConfig.targets.`);
                const validation = {
                    target,
                    packageName,
                    version: packageInfo.version,
                    status: "error",
                    error: `Build output directory not found: ${target.directory}`
                };
                validations.push(validation);
                errorTargets.push(validation);
                continue;
            } else {
                // Source directory — no built package.json expected, source name is fine
                (0,_actions_compat/* .debug */.Yz)(`No built package.json at ${builtPkgJsonPath} — using source name: ${packageName}`);
            }
            (0,_actions_compat/* .info */.pq)(`Checking ${resolvedName}@${packageInfo.version} on ${registryName}...`);
            // Skip JSR targets for now - they have different validation
            if (target.protocol === "jsr") {
                (0,_actions_compat/* .info */.pq)(`  ✓ JSR target - will validate during publish`);
                const validation = {
                    target,
                    packageName: resolvedName,
                    version: packageInfo.version,
                    status: "ready"
                };
                validations.push(validation);
                readyTargets.push(validation);
                continue;
            }
            // Check if version exists on this registry
            const versionCheck = await checkVersionExists(resolvedName, packageInfo.version, target.registry, packageManager);
            if (!versionCheck.success) {
                // Registry check failed - auth error, network error, etc.
                const errorMsg = versionCheck.error || "Unknown error checking registry";
                (0,_actions_compat/* .error */.z3)(`  ✗ ${registryName}: ${errorMsg}`);
                const validation = {
                    target,
                    packageName: resolvedName,
                    version: packageInfo.version,
                    status: "error",
                    versionCheck,
                    error: errorMsg
                };
                validations.push(validation);
                errorTargets.push(validation);
                continue;
            }
            if (versionCheck.versionExists) {
                // Version exists - check if content is identical
                const localIntegrity = await getLocalTarballIntegrity(target.directory, packageManager);
                const remoteIntegrity = versionCheck.versionInfo?.dist?.shasum;
                if (localIntegrity && remoteIntegrity) {
                    if (localIntegrity === remoteIntegrity) {
                        // Identical content - safe to skip
                        (0,_actions_compat/* .info */.pq)(`  ✓ Version exists with identical content - will skip`);
                        const validation = {
                            target,
                            packageName: resolvedName,
                            version: packageInfo.version,
                            status: "skip",
                            versionCheck,
                            localIntegrity,
                            remoteIntegrity
                        };
                        validations.push(validation);
                        skipTargets.push(validation);
                    } else {
                        // Content mismatch - error
                        (0,_actions_compat/* .error */.z3)(`  ✗ Version exists with DIFFERENT content!`);
                        (0,_actions_compat/* .error */.z3)(`    Local shasum:  ${localIntegrity}`);
                        (0,_actions_compat/* .error */.z3)(`    Remote shasum: ${remoteIntegrity}`);
                        const validation = {
                            target,
                            packageName: resolvedName,
                            version: packageInfo.version,
                            status: "error",
                            versionCheck,
                            localIntegrity,
                            remoteIntegrity,
                            error: `Content mismatch: local=${localIntegrity}, remote=${remoteIntegrity}`
                        };
                        validations.push(validation);
                        errorTargets.push(validation);
                    }
                } else {
                    // Cannot compare integrity - treat as skip with warning
                    (0,_actions_compat/* .warning */.$e)(`  ⚠ Version exists but could not verify integrity - will skip`);
                    const validation = {
                        target,
                        packageName: resolvedName,
                        version: packageInfo.version,
                        status: "skip",
                        versionCheck,
                        localIntegrity,
                        remoteIntegrity
                    };
                    validations.push(validation);
                    skipTargets.push(validation);
                }
            } else {
                // Version doesn't exist - ready to publish
                (0,_actions_compat/* .info */.pq)(`  ✓ Version not found - ready to publish`);
                const validation = {
                    target,
                    packageName: resolvedName,
                    version: packageInfo.version,
                    status: "ready",
                    versionCheck
                };
                validations.push(validation);
                readyTargets.push(validation);
            }
        }
    }
    const success = errorTargets.length === 0;
    if (success) {
        (0,_actions_compat/* .info */.pq)("");
        (0,_actions_compat/* .info */.pq)(`Pre-validation passed: ${readyTargets.length} to publish, ${skipTargets.length} to skip`);
    } else {
        (0,_actions_compat/* .error */.z3)("");
        (0,_actions_compat/* .error */.z3)(`Pre-validation FAILED: ${errorTargets.length} target(s) have errors`);
        (0,_actions_compat/* .error */.z3)("Fix these issues before publishing:");
        for (const errorItem of errorTargets){
            const registryName = (0,registry_utils/* .getRegistryDisplayName */.DN)(errorItem.target.registry);
            (0,_actions_compat/* .error */.z3)(`  - ${errorItem.packageName}@${errorItem.version} → ${registryName}: ${errorItem.error}`);
        }
    }
    (0,_actions_compat/* .endGroup */.N4)();
    return {
        success,
        validations,
        readyTargets,
        skipTargets,
        errorTargets
    };
}
/**
 * Convert internal validation results to summary-compatible format
 */ function toPreValidationDetails(result) {
    const convert = (v)=>({
            registryName: (0,registry_utils/* .getRegistryDisplayName */.DN)(v.target.registry),
            protocol: v.target.protocol,
            packageName: v.packageName,
            version: v.version,
            status: v.status,
            error: v.error,
            localIntegrity: v.localIntegrity,
            remoteIntegrity: v.remoteIntegrity,
            registryUrl: v.target.registry
        });
    return {
        targets: result.validations.map(convert),
        readyTargets: result.readyTargets.map(convert),
        skipTargets: result.skipTargets.map(convert),
        errorTargets: result.errorTargets.map(convert)
    };
}
/**
 * Publish all packages to their configured targets
 *
 * @remarks
 * This function:
 * 1. Gets changeset status to find packages with version changes (or uses pre-detected releases)
 * 2. Resolves publish targets for each package
 * 3. Sets up registry authentication
 * 4. Runs build if configured
 * 5. Publishes each package to each target
 *
 * @param packageManager - Package manager to use
 * @param targetBranch - Target branch for merge base comparison
 * @param dryRun - Whether to skip actual publishing
 * @param preDetectedReleases - Optional pre-detected releases (for Phase 3 when changesets are consumed)
 * @returns Promise resolving to publish result
 */ async function publishPackages(packageManager, targetBranch, dryRun, preDetectedReleases) {
    (0,_actions_compat/* .startGroup */.Oh)("Publishing packages");
    // Use pre-detected releases if provided, otherwise get from changeset status
    let releases;
    if (preDetectedReleases && preDetectedReleases.length > 0) {
        (0,_actions_compat/* .info */.pq)(`Using ${preDetectedReleases.length} pre-detected release(s)`);
        releases = preDetectedReleases.map((r)=>({
                name: r.name,
                newVersion: r.version,
                type: "patch",
                path: r.path
            }));
    } else {
        // Get changeset status to find packages with version changes
        (0,_actions_compat/* .info */.pq)("Getting changeset status...");
        const changesetStatus = await (0,get_changeset_status.getChangesetStatus)(packageManager, targetBranch);
        (0,_actions_compat/* .info */.pq)(`Found ${changesetStatus.releases.length} package(s) with version changes`);
        releases = changesetStatus.releases;
    }
    if (releases.length === 0) {
        (0,_actions_compat/* .info */.pq)("No packages to publish");
        (0,_actions_compat/* .endGroup */.N4)();
        return {
            success: true,
            packages: [],
            totalPackages: 0,
            successfulPackages: 0,
            totalTargets: 0,
            successfulTargets: 0
        };
    }
    // Resolve targets for all packages
    const allTargets = [];
    const packageTargetsMap = new Map();
    for (const release of releases){
        // Use pre-detected path if available, otherwise find it
        const workspacePath = release.path || (0,find_package_path/* .findPackagePath */.di)(release.name);
        if (!workspacePath) {
            (0,_actions_compat/* .error */.z3)(`Could not find workspace path for package ${release.name}`);
            continue;
        }
        const pkgJsonPath = (0,external_node_path_.join)(workspacePath, "package.json");
        if (!(0,external_node_fs_.existsSync)(pkgJsonPath)) {
            (0,_actions_compat/* .error */.z3)(`package.json not found at ${pkgJsonPath}`);
            continue;
        }
        const pkgJson = JSON.parse((0,external_node_fs_.readFileSync)(pkgJsonPath, "utf-8"));
        const targets = resolveTargets(workspacePath, pkgJson);
        if (targets.length === 0) {
            (0,_actions_compat/* .info */.pq)(`Package ${release.name} has no publish targets (version-only - GitHub release only)`);
        }
        packageTargetsMap.set(release.name, {
            path: workspacePath,
            version: release.newVersion,
            targets
        });
        allTargets.push(...targets);
        (0,_actions_compat/* .info */.pq)(`Package ${release.name}@${release.newVersion}: ${targets.length} target(s)`);
    }
    // Setup authentication for all registries
    (0,_actions_compat/* .info */.pq)("Setting up registry authentication...");
    const authResult = await setupRegistryAuth(allTargets, packageManager);
    if (!authResult.success) {
        if (authResult.missingTokens.length > 0) {
            (0,_actions_compat/* .warning */.$e)("Some registry tokens are missing:");
            for (const missing of authResult.missingTokens){
                (0,_actions_compat/* .warning */.$e)(`  - ${missing.registry}: ${missing.tokenEnv} not set`);
            }
        }
    }
    // Run build BEFORE pre-validation so we can compare tarball integrity
    // Run build before publishing
    (0,_actions_compat/* .info */.pq)("Running build...");
    const buildCmd = packageManager === "npm" ? "npm" : packageManager;
    const buildArgs = packageManager === "npm" ? [
        "run",
        "ci:build"
    ] : [
        "ci:build"
    ];
    let buildExitCode = 0;
    let buildStdout = "";
    let buildStderr = "";
    try {
        buildExitCode = await (0,_actions_compat/* .exec */.m0)(buildCmd, buildArgs, {
            ignoreReturnCode: true,
            listeners: {
                stdout: (data)=>{
                    buildStdout += data.toString();
                },
                stderr: (data)=>{
                    buildStderr += data.toString();
                }
            }
        });
    } catch (err) {
        (0,_actions_compat/* .error */.z3)(`Build failed: ${err instanceof Error ? err.message : String(err)}`);
        buildStderr = err instanceof Error ? err.message : String(err);
        buildExitCode = 1;
    }
    if (buildExitCode !== 0) {
        (0,_actions_compat/* .error */.z3)("Build failed, aborting publish");
        (0,_actions_compat/* .endGroup */.N4)();
        return {
            success: false,
            packages: [],
            totalPackages: packageTargetsMap.size,
            successfulPackages: 0,
            totalTargets: allTargets.length,
            successfulTargets: 0,
            buildError: buildStderr || `Build exited with code ${buildExitCode}`,
            buildOutput: buildStdout
        };
    }
    (0,_actions_compat/* .info */.pq)("Build completed successfully");
    // Pre-validate ALL targets before publishing ANY
    // This prevents partial publishes where some registries succeed and others fail
    const preValidation = await preValidateAllTargets(packageTargetsMap, packageManager);
    if (!preValidation.success) {
        (0,_actions_compat/* .error */.z3)("");
        (0,_actions_compat/* .error */.z3)("🔴 Pre-validation failed - aborting publish to prevent partial releases");
        (0,_actions_compat/* .endGroup */.N4)();
        return {
            success: false,
            packages: [],
            totalPackages: packageTargetsMap.size,
            successfulPackages: 0,
            totalTargets: allTargets.length,
            successfulTargets: 0,
            buildError: `Pre-validation failed: ${preValidation.errorTargets.length} target(s) have errors`,
            preValidationDetails: toPreValidationDetails(preValidation)
        };
    }
    // Build a set of targets that should be skipped (already published with identical content).
    // Key on directory + registry to avoid source-name vs built-name mismatches.
    const skipTargetKeys = new Set(preValidation.skipTargets.map((v)=>`${v.target.directory}:${v.target.registry || "jsr"}`));
    // Publish each package to each target
    // Sort packages topologically so dependencies are published before dependents
    // This is required for registries like JSR that validate dependencies exist
    const sortedPackages = sortPackageMapTopologically(packageTargetsMap);
    (0,_actions_compat/* .info */.pq)(`Publishing ${sortedPackages.length} package(s) in dependency order`);
    const results = [];
    let successfulPackages = 0;
    let successfulTargets = 0;
    const totalTargets = allTargets.length;
    for (const [name, packageInfo] of sortedPackages){
        (0,_actions_compat/* .startGroup */.Oh)(`Publishing ${name}@${packageInfo.version}`);
        const targetResults = [];
        let allTargetsSuccess = true;
        // Build a map of directory -> resolved (built) package name for this package.
        // The built name is authoritative for each target and may differ from the source name.
        // NOTE: preValidateAllTargets() also reads these built package.json files and stores
        // the resolved names in TargetPreValidation.packageName. This is intentionally duplicated
        // because the two loops serve different purposes and the pre-validation results aren't
        // keyed in a way that's convenient to look up per-directory here.
        const resolvedNameByDir = new Map();
        for (const target of packageInfo.targets){
            if (resolvedNameByDir.has(target.directory)) continue;
            const builtPkgPath = (0,external_node_path_.join)(target.directory, "package.json");
            (0,_actions_compat/* .debug */.Yz)(`[publish] Looking for built package.json at: ${builtPkgPath}`);
            if ((0,external_node_fs_.existsSync)(builtPkgPath)) {
                try {
                    const builtPkg = JSON.parse((0,external_node_fs_.readFileSync)(builtPkgPath, "utf-8"));
                    if (builtPkg.name) {
                        resolvedNameByDir.set(target.directory, builtPkg.name);
                        (0,_actions_compat/* .debug */.Yz)(`[publish] Resolved name for ${target.directory}: ${builtPkg.name}`);
                    }
                } catch  {
                    (0,_actions_compat/* .debug */.Yz)(`[publish] Failed to parse built package.json at ${builtPkgPath} — using source name`);
                }
            } else {
                (0,_actions_compat/* .debug */.Yz)(`[publish] Built package.json not found at ${builtPkgPath} — using source name: ${name}`);
            }
        }
        // Check if we have npm targets that need packing
        const npmTargets = packageInfo.targets.filter((t)=>t.protocol === "npm");
        const needsPacking = npmTargets.some((t)=>!skipTargetKeys.has(`${t.directory}:${t.registry || "jsr"}`));
        // Stage 2: Pack once PER UNIQUE DIRECTORY to handle multi-target scenarios where
        // different targets publish from different directories (e.g., dist/npm vs dist/github)
        // This ensures consistent digest for attestation linking while supporting different content per target
        const prePackedTarballs = new Map();
        const failedPackDirectories = new Set();
        if (needsPacking && npmTargets.length > 0) {
            // Group targets by directory and pack each unique directory once
            const uniqueDirectories = [
                ...new Set(npmTargets.map((t)=>t.directory))
            ];
            for (const directory of uniqueDirectories){
                // Skip directories where all targets are already published
                const targetsForDir = npmTargets.filter((t)=>t.directory === directory);
                const allSkipped = targetsForDir.every((t)=>skipTargetKeys.has(`${t.directory}:${t.registry || "jsr"}`));
                if (allSkipped) {
                    continue;
                }
                const packName = resolvedNameByDir.get(directory) ?? name;
                (0,_actions_compat/* .info */.pq)(`Packing ${packName}@${packageInfo.version} from ${directory}...`);
                const packed = await packAndComputeDigest(directory, packageManager);
                if (packed) {
                    prePackedTarballs.set(directory, packed);
                    (0,_actions_compat/* .info */.pq)(`✓ Created tarball: ${packed.filename}`);
                    (0,_actions_compat/* .info */.pq)(`  Digest: ${packed.digest}`);
                } else {
                    (0,_actions_compat/* .warning */.$e)(`Failed to pack tarball for ${packName} from ${directory}`);
                    failedPackDirectories.add(directory);
                }
            }
        }
        // Abort gate: if ANY ready target failed to pack, abort the entire package
        // to prevent half-publishes where some registries get the package but others don't
        if (failedPackDirectories.size > 0) {
            (0,_actions_compat/* .error */.z3)(`Aborting publish for ${name}: ${failedPackDirectories.size} directory(s) failed to pack`);
            for (const dir of failedPackDirectories){
                (0,_actions_compat/* .error */.z3)(`  - ${dir}`);
            }
            for (const target of packageInfo.targets){
                const targetKey = `${target.directory}:${target.registry || "jsr"}`;
                if (!skipTargetKeys.has(targetKey)) {
                    targetResults.push({
                        target,
                        success: false,
                        error: "Aborted — not all targets could be packed",
                        exitCode: 1
                    });
                }
            }
            allTargetsSuccess = false;
            results.push({
                name,
                version: packageInfo.version,
                targets: targetResults
            });
            (0,_actions_compat/* .endGroup */.N4)();
            continue;
        }
        for (const target of packageInfo.targets){
            const registryName = (0,registry_utils/* .getRegistryDisplayName */.DN)(target.registry);
            const targetKey = `${target.directory}:${target.registry || "jsr"}`;
            // Skip targets that were pre-validated as "skip" (already published with identical content)
            if (skipTargetKeys.has(targetKey)) {
                (0,_actions_compat/* .info */.pq)(`✓ Skipping ${registryName} - already published with identical content`);
                successfulTargets++;
                // Pack on demand for downstream release-asset / attestation
                // consumers. The pre-pack stage above skips directories
                // where every target is pre-validated skip, so we may not
                // have a tarball cached yet. Pack here and cache so
                // sibling targets in the same directory reuse it.
                let cachedTarball = target.protocol === "npm" ? prePackedTarballs.get(target.directory) : undefined;
                if (target.protocol === "npm" && !cachedTarball && !failedPackDirectories.has(target.directory)) {
                    (0,_actions_compat/* .info */.pq)(`Packing ${target.directory} for release-asset / attestation use...`);
                    cachedTarball = await packAndComputeDigest(target.directory, packageManager);
                    if (cachedTarball) {
                        prePackedTarballs.set(target.directory, cachedTarball);
                        (0,_actions_compat/* .info */.pq)(`✓ Created tarball: ${cachedTarball.filename}`);
                    } else {
                        (0,_actions_compat/* .warning */.$e)(`Failed to pack tarball for skipped target ${target.directory}`);
                        failedPackDirectories.add(target.directory);
                    }
                }
                targetResults.push({
                    target,
                    success: true,
                    alreadyPublished: true,
                    alreadyPublishedReason: "identical",
                    tarballPath: cachedTarball?.path,
                    tarballDigest: cachedTarball?.digest
                });
                continue;
            }
            // Get pre-packed tarball for this target's directory
            // After the abort gate above, all ready npm targets are guaranteed to have tarballs
            const targetTarball = target.protocol === "npm" ? prePackedTarballs.get(target.directory) : undefined;
            (0,_actions_compat/* .info */.pq)(`Publishing to ${registryName}...`);
            try {
                // Pass pre-packed tarball to npm targets for consistent digest
                const publishResult = await publishToTarget(target, dryRun, packageManager, targetTarball);
                // Determine if this is a safe skip or an error
                // "different" means tarball content mismatch - this is an error
                const isDifferentContent = publishResult.alreadyPublishedReason === "different";
                const isSafeSkip = publishResult.alreadyPublished === true && !isDifferentContent;
                const effectiveSuccess = publishResult.success || isSafeSkip;
                const result = {
                    target,
                    success: effectiveSuccess,
                    registryUrl: publishResult.registryUrl,
                    attestationUrl: publishResult.attestationUrl,
                    error: effectiveSuccess ? undefined : publishResult.error,
                    stdout: publishResult.output,
                    stderr: publishResult.error,
                    exitCode: publishResult.exitCode,
                    alreadyPublished: publishResult.alreadyPublished,
                    alreadyPublishedReason: publishResult.alreadyPublishedReason,
                    tarballPath: publishResult.tarballPath,
                    tarballDigest: publishResult.tarballDigest
                };
                targetResults.push(result);
                if (publishResult.success) {
                    successfulTargets++;
                    (0,_actions_compat/* .info */.pq)(`✓ Published to ${registryName}`);
                    if (publishResult.registryUrl) {
                        (0,_actions_compat/* .info */.pq)(`  Package URL: ${publishResult.registryUrl}`);
                    }
                    if (publishResult.attestationUrl) {
                        (0,_actions_compat/* .info */.pq)(`  Provenance: ${publishResult.attestationUrl}`);
                    }
                } else if (publishResult.alreadyPublished) {
                    if (isDifferentContent) {
                        // Content mismatch is an actual error
                        allTargetsSuccess = false;
                        (0,_actions_compat/* .error */.z3)(`✗ Version already published to ${registryName} with DIFFERENT content!`);
                        (0,_actions_compat/* .error */.z3)(`  Local shasum:  ${publishResult.localIntegrity}`);
                        (0,_actions_compat/* .error */.z3)(`  Remote shasum: ${publishResult.remoteIntegrity}`);
                        (0,_actions_compat/* .error */.z3)(`  This indicates the same version was published with different files.`);
                    } else if (publishResult.alreadyPublishedReason === "identical") {
                        // Identical content - safe to skip
                        successfulTargets++;
                        (0,_actions_compat/* .info */.pq)(`✓ Version already published to ${registryName} with identical content - skipping`);
                    } else {
                        // Unknown - couldn't compare, treat as warning
                        successfulTargets++;
                        (0,_actions_compat/* .warning */.$e)(`⚠ Version already published to ${registryName} - skipping (could not verify content)`);
                    }
                } else {
                    allTargetsSuccess = false;
                    (0,_actions_compat/* .error */.z3)(`✗ Failed to publish to ${registryName}: ${publishResult.error}`);
                }
            } catch (err) {
                allTargetsSuccess = false;
                const errorMessage = err instanceof Error ? err.message : String(err);
                (0,_actions_compat/* .error */.z3)(`✗ Failed to publish to ${registryName}: ${errorMessage}`);
                targetResults.push({
                    target,
                    success: false,
                    error: errorMessage,
                    exitCode: 1
                });
            }
        }
        // Create GitHub attestation for successfully published packages ONLY if:
        // 1. All targets succeeded
        // 2. No target already has a provenance attestation URL (from npm --provenance)
        //
        // This avoids duplicate attestations when npm's built-in provenance is used.
        // The npm provenance attestation is preferred because it's integrated with the registry.
        let githubAttestationUrl;
        const hasProvenanceAttestation = targetResults.some((t)=>t.success && t.attestationUrl);
        if (allTargetsSuccess && !hasProvenanceAttestation && prePackedTarballs.size > 0) {
            // Find a GitHub Packages target for linking, fall back to first npm target
            const githubPackagesTarget = npmTargets.find((t)=>(0,registry_utils/* .isGitHubPackagesRegistry */.yQ)(t.registry));
            const attestationTarget = githubPackagesTarget || npmTargets[0];
            if (attestationTarget) {
                // Get the tarball for the attestation target's directory
                const attestationTarball = prePackedTarballs.get(attestationTarget.directory);
                if (attestationTarball) {
                    (0,_actions_compat/* .info */.pq)("Creating GitHub attestation for package (no npm provenance available)...");
                    const attestationResult = await (0,create_attestation/* .createPackageAttestation */.n4)({
                        packageName: name,
                        version: packageInfo.version,
                        directory: attestationTarget.directory,
                        dryRun,
                        packageManager,
                        tarballDigest: attestationTarball.digest,
                        registry: githubPackagesTarget?.registry ?? undefined
                    });
                    if (attestationResult.success && attestationResult.attestationUrl) {
                        githubAttestationUrl = attestationResult.attestationUrl;
                        (0,_actions_compat/* .info */.pq)(`  ✓ Created GitHub attestation: ${githubAttestationUrl}`);
                    }
                }
            }
        } else if (hasProvenanceAttestation) {
            (0,_actions_compat/* .info */.pq)("✓ Package attestation already created via npm provenance");
        }
        // Create SBOM attestations per target directory
        // Each directory can have different dependencies, so we generate separate SBOMs
        if (allTargetsSuccess && prePackedTarballs.size > 0) {
            const processedDirectories = new Set();
            for (const result of targetResults){
                const dir = result.target.directory;
                // Skip if we already processed this directory (multiple targets can share a directory)
                if (processedDirectories.has(dir)) {
                    // Find the already-processed result and copy SBOM info
                    const existingResult = targetResults.find((r)=>r.target.directory === dir && r.sbomPath && processedDirectories.has(dir));
                    if (existingResult) {
                        result.sbomPath = existingResult.sbomPath;
                        result.sbomAttestationUrl = existingResult.sbomAttestationUrl;
                    }
                    continue;
                }
                processedDirectories.add(dir);
                const tarball = prePackedTarballs.get(dir);
                if (!tarball) continue;
                // Extract target name from directory (e.g., "dist/npm" -> "npm")
                const targetName = dir.split("/").filter(Boolean).pop() || "dist";
                const sbomPackageName = resolvedNameByDir.get(dir) ?? name;
                (0,_actions_compat/* .info */.pq)(`Creating SBOM attestation for ${sbomPackageName} (${targetName})...`);
                const sbomResult = await (0,create_attestation/* .createSBOMAttestation */.Ug)({
                    packageName: sbomPackageName,
                    version: packageInfo.version,
                    directory: dir,
                    dryRun,
                    packageManager,
                    tarballDigest: tarball.digest,
                    targetName
                });
                if (sbomResult.success) {
                    result.sbomPath = sbomResult.sbomPath;
                    result.sbomAttestationUrl = sbomResult.attestationUrl;
                    (0,_actions_compat/* .info */.pq)(`  ✓ Created SBOM: ${sbomResult.sbomPath}`);
                    if (sbomResult.attestationUrl) {
                        (0,_actions_compat/* .info */.pq)(`  ✓ Created SBOM attestation: ${sbomResult.attestationUrl}`);
                    }
                }
            }
        }
        results.push({
            name,
            version: packageInfo.version,
            targets: targetResults,
            githubAttestationUrl
        });
        if (allTargetsSuccess) {
            successfulPackages++;
        }
        (0,_actions_compat/* .endGroup */.N4)();
    }
    (0,_actions_compat/* .endGroup */.N4)();
    const allSuccess = successfulPackages === packageTargetsMap.size;
    return {
        success: allSuccess,
        packages: results,
        totalPackages: packageTargetsMap.size,
        successfulPackages,
        totalTargets,
        successfulTargets
    };
}


},
26950(__unused_rspack_module, __webpack_exports__, __webpack_require__) {

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  Qu: () => (/* binding */ getAllWorkspacePackages),
  fz: () => (/* binding */ readChangesetConfig)
});

// UNUSED EXPORTS: countChangesetsPerPackage, findPackageGroup, formatSkipReason, getBumpTypeIcon, getGroupIcon, getSkipReason, isFirstRelease

// EXTERNAL MODULE: external "node:fs"
var external_node_fs_ = __webpack_require__(73024);
// EXTERNAL MODULE: external "node:path"
var external_node_path_ = __webpack_require__(76760);
// EXTERNAL MODULE: ./node_modules/.pnpm/workspaces-effect@1.0.0_@effect+platform@0.96.1_effect@3.21.2__effect@3.21.2/node_modules/workspaces-effect/index.js + 11 modules
var workspaces_effect = __webpack_require__(52855);
// EXTERNAL MODULE: ./src/utils/_actions-compat.ts + 18 modules
var _actions_compat = __webpack_require__(50620);
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
