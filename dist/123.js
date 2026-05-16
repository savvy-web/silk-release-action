export const __rspack_esm_id = 123;
export const __rspack_esm_ids = [123];
export const __webpack_modules__ = {
5441(__unused_rspack_module, __webpack_exports__, __webpack_require__) {

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  n4: () => (/* binding */ createPackageAttestation),
  au: () => (/* binding */ createReleaseAssetAttestation),
  Ug: () => (/* binding */ createSBOMAttestation),
  At: () => (/* binding */ validateSBOMGeneration)
});

// EXTERNAL MODULE: external "node:crypto"
var external_node_crypto_ = __webpack_require__(77598);
// EXTERNAL MODULE: external "node:fs"
var external_node_fs_ = __webpack_require__(73024);
// EXTERNAL MODULE: external "node:path"
var external_node_path_ = __webpack_require__(76760);
// EXTERNAL MODULE: ./src/utils/_actions-compat.ts
var _actions_compat = __webpack_require__(77279);
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
        const exitCode = await (0,_actions_compat/* .exec */.m0)("npm", [
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
                (0,_actions_compat/* .debug */.Yz)(`Package ${packageName} not found on registry - likely a new package`);
                return undefined;
            }
            (0,_actions_compat/* .debug */.Yz)(`npm view failed for ${packageName}: ${stderr}`);
            return undefined;
        }
        // Parse the time object
        // Format: { "created": "2024-01-15T...", "modified": "...", "1.0.0": "..." }
        const timeData = JSON.parse(output);
        if (timeData.created) {
            (0,_actions_compat/* .debug */.Yz)(`Found creation date for ${packageName}: ${timeData.created}`);
            return timeData.created;
        }
        return undefined;
    } catch (error) {
        (0,_actions_compat/* .debug */.Yz)(`Failed to fetch npm package creation date: ${error instanceof Error ? error.message : String(error)}`);
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
 */ async function detectCopyrightYear(packageName, configStartYear, registry) {
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
    (0,_actions_compat/* .debug */.Yz)(`Using current year ${currentYear} as copyright start year for ${packageName}`);
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
 */ function inferSBOMMetadata(directory) {
    const pkgJsonPath = (0,external_node_path_.join)(directory, "package.json");
    if (!(0,external_node_fs_.existsSync)(pkgJsonPath)) {
        (0,_actions_compat/* .debug */.Yz)(`No package.json found at ${pkgJsonPath} for SBOM metadata inference`);
        return {};
    }
    let pkgJson;
    try {
        pkgJson = JSON.parse((0,external_node_fs_.readFileSync)(pkgJsonPath, "utf-8"));
    } catch (error) {
        (0,_actions_compat/* .debug */.Yz)(`Failed to parse package.json for SBOM metadata: ${error instanceof Error ? error.message : String(error)}`);
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
    (0,_actions_compat/* .debug */.Yz)(`Inferred SBOM metadata from ${directory}: ${JSON.stringify(result)}`);
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
 */ function resolveSBOMMetadata(inferred, config, copyrightStartYear) {
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
    (0,_actions_compat/* .info */.pq)(`Resolved SBOM metadata: supplier=${result.supplier?.name || "none"}, publisher=${result.component?.publisher || "none"}`);
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
 */ const CONFIG_FILE_NAMES = [
    "silk-release.json",
    "silk-release.jsonc"
];
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
 */ const SBOM_CONFIG_FIELDS = [
    "supplier",
    "copyright",
    "publisher",
    "documentationUrl"
];
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
        const parsed = main_parse(content, errors);
        if (errors.length > 0) {
            (0,_actions_compat/* .warning */.$e)(`Failed to parse config from ${source}: JSON syntax error at offset ${errors[0].offset}`);
            return undefined;
        }
        // Check for unwrapped SBOM config (common mistake)
        const unwrappedFields = detectUnwrappedSBOMFields(parsed);
        if (unwrappedFields.length > 0 && parsed.sbom === undefined) {
            (0,_actions_compat/* .warning */.$e)(`Invalid config structure from ${source}: Found SBOM fields (${unwrappedFields.join(", ")}) at root level.\n` + `  The configuration must be wrapped in an "sbom" key.\n` + `  Expected: { "sbom": { "supplier": {...}, ... } }\n` + `  Found:    { "supplier": {...}, ... }\n` + `  See schema: https://raw.githubusercontent.com/savvy-web/workflow-release-action/main/.github/silk-release.schema.json`);
            return undefined;
        }
        // Validate the sbom section if present
        const releaseConfig = parsed;
        if (releaseConfig.sbom !== undefined) {
            const validationErrors = validateSBOMConfig(releaseConfig.sbom);
            if (validationErrors.length > 0) {
                (0,_actions_compat/* .warning */.$e)(`Invalid SBOM config from ${source}:\n${validationErrors.map((e)=>`  - ${e}`).join("\n")}`);
                return undefined;
            }
        }
        return releaseConfig;
    } catch (error) {
        (0,_actions_compat/* .warning */.$e)(`Failed to parse config from ${source}: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * Load release configuration from a local file
 *
 * @param configPath - Path to the configuration file
 * @returns Parsed configuration or undefined if file doesn't exist or is invalid
 */ function loadConfigFromFile(configPath) {
    if (!(0,external_node_fs_.existsSync)(configPath)) {
        return undefined;
    }
    const content = (0,external_node_fs_.readFileSync)(configPath, "utf-8");
    return parseConfigContent(content, configPath);
}
/**
 * Load configuration from local repository
 *
 * @param rootDir - Repository root directory
 * @returns Configuration or undefined if not found
 */ function loadConfigFromLocalRepo(rootDir) {
    for (const fileName of CONFIG_FILE_NAMES){
        const configPath = (0,external_node_path_.join)(rootDir, ".github", fileName);
        const config = loadConfigFromFile(configPath);
        if (config !== undefined) {
            (0,_actions_compat/* .info */.pq)(`Loaded Silk release config from .github/${fileName}`);
            (0,_actions_compat/* .debug */.Yz)(`Release config: ${JSON.stringify(config)}`);
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
        (0,_actions_compat/* .debug */.Yz)(`${CONFIG_ENV_VAR} environment variable not set`);
        return undefined;
    }
    (0,_actions_compat/* .info */.pq)(`Found ${CONFIG_ENV_VAR} environment variable (${envValue.length} chars)`);
    const config = parseConfigContent(envValue, `${CONFIG_ENV_VAR} variable`);
    if (config !== undefined) {
        (0,_actions_compat/* .info */.pq)(`Loaded Silk release config from ${CONFIG_ENV_VAR} variable`);
        if (config.sbom?.supplier?.name) {
            (0,_actions_compat/* .info */.pq)(`  Supplier: ${config.sbom.supplier.name}`);
        }
        (0,_actions_compat/* .debug */.Yz)(`Release config: ${JSON.stringify(config)}`);
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
        inputValue = (0,_actions_compat/* .getInput */.V4)(CONFIG_INPUT_NAME);
    } catch  {
        // getInput may throw if we're not in an action context
        return undefined;
    }
    if (!inputValue) {
        (0,_actions_compat/* .debug */.Yz)(`${CONFIG_INPUT_NAME} action input not set`);
        return undefined;
    }
    (0,_actions_compat/* .info */.pq)(`Found ${CONFIG_INPUT_NAME} action input (${inputValue.length} chars)`);
    const config = parseConfigContent(inputValue, `${CONFIG_INPUT_NAME} input`);
    if (config !== undefined) {
        (0,_actions_compat/* .info */.pq)(`Loaded Silk release config from ${CONFIG_INPUT_NAME} input`);
        if (config.sbom?.supplier?.name) {
            (0,_actions_compat/* .info */.pq)(`  Supplier: ${config.sbom.supplier.name}`);
        }
        (0,_actions_compat/* .debug */.Yz)(`Release config: ${JSON.stringify(config)}`);
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
    (0,_actions_compat/* .debug */.Yz)("No Silk release configuration found");
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
 */ function loadSBOMConfig(rootDir) {
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
 */ async function enhanceSBOMMetadata(sbom, options) {
    const { packageName, packageVersion, packageDirectory, rootDirectory, registry } = options;
    (0,_actions_compat/* .info */.pq)(`Enhancing SBOM metadata for ${packageName}@${packageVersion}`);
    // Load or use provided config
    const config = options.sbomConfig ?? loadSBOMConfig(rootDirectory);
    // Infer metadata from package.json
    const inferred = inferSBOMMetadata(packageDirectory);
    // Detect copyright year (from config or npm registry)
    const copyrightYearResult = await detectCopyrightYear(packageName, config?.copyright?.startYear, registry);
    (0,_actions_compat/* .debug */.Yz)(`Copyright year for ${packageName}: ${copyrightYearResult.startYear} (source: ${copyrightYearResult.source})`);
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
    (0,_actions_compat/* .debug */.Yz)(`Enhanced SBOM metadata: supplier=${enhanced.metadata?.supplier?.name}, purl=${enhanced.metadata?.component?.purl}`);
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
    const pkgJsonPath = (0,external_node_path_.join)(directory, "package.json");
    if (!(0,external_node_fs_.existsSync)(pkgJsonPath)) {
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
        pkgJson = JSON.parse((0,external_node_fs_.readFileSync)(pkgJsonPath, "utf-8"));
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
    (0,_actions_compat/* .debug */.Yz)(`Validating SBOM generation by generating SBOM for ${directory}`);
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
    (0,_actions_compat/* .debug */.Yz)(`SBOM validation passed for ${directory}: ${dependencyCount} deps, ${componentCount} components`);
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
            (0,_actions_compat/* .debug */.Yz)(`Enhanced SBOM with metadata for ${pkgName}@${pkgVersion}`);
        } catch (error) {
            // Enhancement failure should not fail validation, just log warning
            (0,_actions_compat/* .warning */.$e)(`Failed to enhance SBOM metadata: ${error instanceof Error ? error.message : String(error)}`);
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
28190(__unused_rspack_module, __webpack_exports__, __webpack_require__) {

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  generateSBOMPreview: () => (/* binding */ generateSBOMPreview)
});

// EXTERNAL MODULE: ./src/utils/_actions-compat.ts
var _actions_compat = __webpack_require__(77279);
// EXTERNAL MODULE: ./src/utils/create-attestation.ts + 10 modules
var create_attestation = __webpack_require__(5441);
;// CONCATENATED MODULE: ./src/utils/validate-ntia-compliance.ts
/**
 * NTIA Minimum Elements for SBOM
 *
 * @see https://www.ntia.gov/files/ntia/publications/sbom_minimum_elements_report.pdf
 *
 * The seven minimum elements are:
 * 1. Supplier Name - Entity that creates, defines, and identifies components
 * 2. Component Name - Designation assigned to a component
 * 3. Component Version - Identifier for specific release
 * 4. Unique Identifier - A unique identifier for each component (PURL)
 * 5. Dependency Relationship - Characterizes relationship between upstream/downstream
 * 6. Author of SBOM Data - Entity that creates the SBOM
 * 7. Timestamp - Record of date/time when SBOM was assembled
 */ /**
 * Check if supplier name is present in SBOM
 */ function checkSupplierName(sbom) {
    const supplierName = sbom.metadata?.supplier?.name;
    const passed = typeof supplierName === "string" && supplierName.length > 0;
    return {
        name: "Supplier Name",
        description: "Entity that supplies the software",
        passed,
        value: passed ? supplierName : undefined,
        suggestion: passed ? undefined : "Add `supplier.name` to `.github/silk-release.json`"
    };
}
/**
 * Check if component name is present in SBOM
 */ function checkComponentName(sbom) {
    const componentName = sbom.metadata?.component?.name;
    const passed = typeof componentName === "string" && componentName.length > 0;
    return {
        name: "Component Name",
        description: "Name of the software component",
        passed,
        value: passed ? componentName : undefined,
        suggestion: passed ? undefined : "Component name should be auto-populated from package.json"
    };
}
/**
 * Check if component version is present in SBOM
 */ function checkComponentVersion(sbom) {
    const componentVersion = sbom.metadata?.component?.version;
    const passed = typeof componentVersion === "string" && componentVersion.length > 0;
    return {
        name: "Component Version",
        description: "Version of the software component",
        passed,
        value: passed ? componentVersion : undefined,
        suggestion: passed ? undefined : "Component version should be auto-populated from package.json"
    };
}
/**
 * Check if unique identifier (PURL) is present in SBOM
 */ function checkUniqueIdentifier(sbom) {
    const purl = sbom.metadata?.component?.purl;
    const passed = typeof purl === "string" && purl.startsWith("pkg:");
    return {
        name: "Unique Identifier",
        description: "Package URL (PURL) uniquely identifying the component",
        passed,
        value: passed ? purl : undefined,
        suggestion: passed ? undefined : "PURL should be auto-generated from package name and version"
    };
}
/**
 * Check if dependency relationships are present in SBOM
 */ function checkDependencyRelationship(sbom) {
    // Check for either components array or dependencies array
    const hasComponents = Array.isArray(sbom.components) && sbom.components.length > 0;
    const hasDependencies = Array.isArray(sbom.dependencies) && sbom.dependencies.length > 0;
    // A package with no dependencies should still pass (empty dependency list is valid)
    // We check if the SBOM structure is capable of representing dependencies
    const passed = hasComponents || hasDependencies || sbom.components !== undefined;
    const componentCount = sbom.components?.length ?? 0;
    return {
        name: "Dependency Relationship",
        description: "Dependencies included in the component",
        passed,
        value: passed ? `${componentCount} direct dep${componentCount === 1 ? "" : "s"}` : undefined,
        suggestion: passed ? undefined : "Run SBOM generation with dependencies installed"
    };
}
/**
 * Check if SBOM author is present
 *
 * @remarks
 * In CycloneDX, the author can be represented through:
 * 1. metadata.authors (CycloneDX 1.5+)
 * 2. metadata.supplier (as the creator of the SBOM)
 * 3. metadata.tools (tool that generated the SBOM)
 */ function checkAuthor(sbom) {
    // Check for tools (cdxgen or similar)
    const hasTools = Array.isArray(sbom.metadata?.tools?.components) && sbom.metadata.tools.components.length > 0;
    // Check for supplier (often the author of both software and SBOM)
    const hasSupplier = typeof sbom.metadata?.supplier?.name === "string" && sbom.metadata.supplier.name.length > 0;
    // Check component publisher
    const hasPublisher = typeof sbom.metadata?.component?.publisher === "string" && sbom.metadata.component.publisher.length > 0;
    const passed = hasTools || hasSupplier || hasPublisher;
    let value;
    if (hasPublisher) {
        value = sbom.metadata?.component?.publisher;
    } else if (hasSupplier) {
        value = sbom.metadata?.supplier?.name;
    } else if (hasTools) {
        const tool = sbom.metadata?.tools?.components?.[0];
        value = tool ? `${tool.name}${tool.version ? ` ${tool.version}` : ""}` : undefined;
    }
    return {
        name: "Author",
        description: "Entity that created the SBOM data",
        passed,
        value,
        suggestion: passed ? undefined : "Author is auto-populated from SBOM generation tool or package.json author"
    };
}
/**
 * Check if timestamp is present in SBOM
 */ function checkTimestamp(sbom) {
    const timestamp = sbom.metadata?.timestamp;
    const passed = typeof timestamp === "string" && timestamp.length > 0;
    // Format timestamp for display
    let displayValue;
    if (passed && timestamp) {
        try {
            displayValue = new Date(timestamp).toISOString();
        } catch  {
            displayValue = timestamp;
        }
    }
    return {
        name: "Timestamp",
        description: "Date and time when SBOM was assembled",
        passed,
        value: displayValue,
        suggestion: passed ? undefined : "Timestamp is auto-generated during SBOM creation"
    };
}
/**
 * Validate SBOM against NTIA minimum elements
 *
 * @remarks
 * Checks the SBOM document for compliance with the seven NTIA minimum elements:
 * 1. Supplier Name
 * 2. Component Name
 * 3. Component Version
 * 4. Unique Identifier (PURL)
 * 5. Dependency Relationship
 * 6. Author of SBOM Data
 * 7. Timestamp
 *
 * @param sbom - CycloneDX SBOM document to validate
 * @returns Compliance result with field-by-field analysis
 *
 * @see https://www.ntia.gov/files/ntia/publications/sbom_minimum_elements_report.pdf
 */ function validateNTIACompliance(sbom) {
    const fields = [
        checkSupplierName(sbom),
        checkComponentName(sbom),
        checkComponentVersion(sbom),
        checkUniqueIdentifier(sbom),
        checkDependencyRelationship(sbom),
        checkAuthor(sbom),
        checkTimestamp(sbom)
    ];
    const passedCount = fields.filter((f)=>f.passed).length;
    const totalCount = fields.length;
    const percentage = Math.round(passedCount / totalCount * 100 * 10) / 10;
    const compliant = passedCount === totalCount;
    return {
        compliant,
        passedCount,
        totalCount,
        percentage,
        fields
    };
}
/**
 * Generate markdown summary for NTIA compliance results
 *
 * @param result - NTIA compliance validation result
 * @returns Markdown formatted compliance summary
 */ function formatNTIAComplianceMarkdown(result) {
    const lines = [];
    // Header with overall status
    const statusIcon = result.compliant ? "✅" : "⚠️";
    lines.push(`### ${statusIcon} SBOM Compliance Check`);
    lines.push("");
    lines.push(`**NTIA Minimum Elements:** ${result.passedCount}/${result.totalCount} (${result.percentage}%)`);
    lines.push("");
    // Field results table
    lines.push("| Field | Status |");
    lines.push("|-------|--------|");
    for (const field of result.fields){
        const statusEmoji = field.passed ? "✅" : "❌";
        const valueDisplay = field.passed && field.value ? ` ${field.value}` : field.passed ? "" : " Missing";
        lines.push(`| ${field.name} | ${statusEmoji}${valueDisplay} |`);
    }
    lines.push("");
    // Add suggestions for missing fields
    const missingFields = result.fields.filter((f)=>!f.passed);
    if (missingFields.length > 0) {
        lines.push("**Action required:**");
        for (const field of missingFields){
            if (field.suggestion) {
                lines.push(`- ${field.suggestion}`);
            }
        }
        lines.push("");
    }
    return lines.join("\n");
}

;// CONCATENATED MODULE: ./src/utils/generate-sbom-preview.ts



/**
 * Group components by type for better display
 */ function groupComponentsByType(components) {
    const groups = new Map();
    for (const component of components){
        const type = component.type || "unknown";
        if (!groups.has(type)) {
            groups.set(type, []);
        }
        groups.get(type)?.push({
            name: component.name,
            version: component.version
        });
    }
    return groups;
}
/**
 * Extract license summary from SBOM components
 */ function extractLicenses(components) {
    const licenseCounts = new Map();
    for (const component of components){
        if (component.licenses) {
            for (const licenseEntry of component.licenses){
                let licenseId = "Unknown";
                if (licenseEntry.license?.id) {
                    licenseId = licenseEntry.license.id;
                } else if (licenseEntry.license?.name) {
                    licenseId = licenseEntry.license.name;
                } else if (licenseEntry.expression) {
                    licenseId = licenseEntry.expression;
                }
                licenseCounts.set(licenseId, (licenseCounts.get(licenseId) || 0) + 1);
            }
        }
    }
    // Sort by count descending
    return Array.from(licenseCounts.entries()).map(([id, count])=>({
            id,
            count
        })).sort((a, b)=>b.count - a.count);
}
/**
 * Generate SBOM preview for packages during validation
 *
 * This function generates SBOMs for packages with npm targets that have
 * provenance enabled, and returns a formatted preview for the PR check.
 * Includes NTIA compliance analysis and enhanced metadata preview.
 *
 * @param packageManager - Package manager to use
 * @param validations - Package validation results from validatePublish
 * @param rootDirectory - Repository root directory (for config loading)
 * @returns SBOM preview result with summary content
 */ async function generateSBOMPreview(packageManager, validations, rootDirectory) {
    (0,_actions_compat/* .startGroup */.Oh)("Generating SBOM Preview");
    const packages = [];
    let allSuccess = true;
    for (const validation of validations){
        // Skip packages without publishable targets
        if (!validation.hasPublishableTargets) {
            (0,_actions_compat/* .debug */.Yz)(`Skipping ${validation.name} - no publishable targets`);
            continue;
        }
        // Find npm targets with provenance (these need SBOMs)
        const npmTargetWithProvenance = validation.targets.find((t)=>t.target.protocol === "npm" && t.target.provenance);
        if (!npmTargetWithProvenance) {
            (0,_actions_compat/* .debug */.Yz)(`Skipping ${validation.name} - no npm target with provenance`);
            continue;
        }
        // Use existing SBOM validation result if available, otherwise generate
        let sbomResult;
        if (validation.sbomValidation?.generatedSbom) {
            (0,_actions_compat/* .info */.pq)(`Using existing SBOM for ${validation.name}`);
            sbomResult = {
                valid: validation.sbomValidation.valid,
                hasDependencies: validation.sbomValidation.hasDependencies,
                dependencyCount: validation.sbomValidation.dependencyCount,
                warning: validation.sbomValidation.warning,
                error: validation.sbomValidation.error,
                generatedSbom: validation.sbomValidation.generatedSbom
            };
        } else {
            (0,_actions_compat/* .info */.pq)(`Generating SBOM for ${validation.name}`);
            sbomResult = await (0,create_attestation/* .validateSBOMGeneration */.At)({
                directory: npmTargetWithProvenance.target.directory,
                packageManager,
                packageName: validation.name,
                packageVersion: validation.version,
                rootDirectory,
                enhanceMetadata: true
            });
        }
        const componentCount = sbomResult.generatedSbom?.components?.length || 0;
        if (!sbomResult.valid) {
            (0,_actions_compat/* .warning */.$e)(`SBOM generation failed for ${validation.name}: ${sbomResult.error}`);
            allSuccess = false;
        }
        // Run NTIA compliance check on the SBOM
        let ntiaCompliance;
        if (sbomResult.generatedSbom) {
            ntiaCompliance = validateNTIACompliance(sbomResult.generatedSbom);
            if (!ntiaCompliance.compliant) {
                (0,_actions_compat/* .debug */.Yz)(`NTIA compliance check for ${validation.name}: ${ntiaCompliance.passedCount}/${ntiaCompliance.totalCount}`);
            }
        }
        packages.push({
            name: validation.name,
            version: validation.version,
            success: sbomResult.valid,
            dependencyCount: sbomResult.dependencyCount,
            componentCount,
            sbom: sbomResult.generatedSbom,
            ntiaCompliance,
            error: sbomResult.error,
            warning: sbomResult.warning
        });
    }
    (0,_actions_compat/* .endGroup */.N4)();
    // Generate summary content
    const summaryContent = generateSummaryContent(packages, packageManager);
    const successCount = packages.filter((p)=>p.success).length;
    const checkTitle = packages.length === 0 ? "No packages require SBOM" : allSuccess ? `${packages.length} SBOM(s) generated successfully` : `${successCount}/${packages.length} SBOM(s) generated`;
    // Check for NTIA compliance warnings
    const packagesWithWarnings = packages.filter((p)=>p.ntiaCompliance && !p.ntiaCompliance.compliant);
    const hasComplianceWarnings = packagesWithWarnings.length > 0;
    // Generate compliance summary for outcome display
    let complianceSummary;
    if (hasComplianceWarnings) {
        const missingFields = new Set();
        for (const pkg of packagesWithWarnings){
            if (pkg.ntiaCompliance) {
                for (const field of pkg.ntiaCompliance.fields){
                    if (!field.passed) {
                        missingFields.add(field.name);
                    }
                }
            }
        }
        complianceSummary = `Missing: ${Array.from(missingFields).join(", ")}`;
    }
    return {
        packages,
        summaryContent,
        checkTitle,
        success: allSuccess,
        hasComplianceWarnings,
        complianceSummary
    };
}
/**
 * Generate markdown summary content for the SBOM preview
 */ function generateSummaryContent(packages, packageManager) {
    const lines = [];
    lines.push("## SBOM Preview");
    lines.push("");
    if (packages.length === 0) {
        lines.push("No packages with npm provenance targets found. SBOMs are generated for npm packages ");
        lines.push("that have `provenance: true` in their publish configuration.");
        lines.push("");
        return lines.join("\n");
    }
    // Summary table
    lines.push("| Package | Status | Dependencies | Components | NTIA |");
    lines.push("|---------|--------|--------------|------------|------|");
    for (const pkg of packages){
        const status = pkg.success ? "✅ Ready" : "❌ Failed";
        const deps = pkg.dependencyCount.toString();
        const components = pkg.componentCount.toString();
        const ntia = pkg.ntiaCompliance ? pkg.ntiaCompliance.compliant ? "✅ 100%" : `⚠️ ${pkg.ntiaCompliance.percentage}%` : "—";
        lines.push(`| \`${pkg.name}@${pkg.version}\` | ${status} | ${deps} | ${components} | ${ntia} |`);
    }
    lines.push("");
    // Detailed SBOM content for each package
    for (const pkg of packages){
        // Use warning icon if there are NTIA compliance issues or other warnings
        const hasWarnings = pkg.warning || pkg.ntiaCompliance && !pkg.ntiaCompliance.compliant;
        const headerIcon = pkg.error ? "❌" : hasWarnings ? "⚠️" : "📦";
        lines.push(`### ${headerIcon} ${pkg.name}@${pkg.version}`);
        lines.push("");
        if (pkg.error) {
            lines.push(`**Error:** ${pkg.error}`);
            lines.push("");
            continue;
        }
        if (pkg.warning) {
            lines.push(`**Warning:** ${pkg.warning}`);
            lines.push("");
        }
        if (!pkg.sbom) {
            lines.push("*No SBOM content available*");
            lines.push("");
            continue;
        }
        // Type cast for enhanced SBOM
        const sbom = pkg.sbom;
        // SBOM metadata summary
        const supplierName = sbom.metadata?.supplier?.name;
        const publisher = sbom.metadata?.component?.publisher;
        lines.push(`**SBOM Format:** CycloneDX ${sbom.specVersion}`);
        if (supplierName) {
            lines.push(`**Supplier:** ${supplierName}`);
        }
        if (publisher) {
            lines.push(`**Publisher:** ${publisher}`);
        }
        lines.push("");
        // External references
        const externalRefs = sbom.metadata?.component?.externalReferences;
        if (externalRefs && externalRefs.length > 0) {
            lines.push("**External References:**");
            for (const ref of externalRefs){
                const icon = getExternalRefIcon(ref.type);
                const label = capitalizeFirst(ref.type.replace(/-/g, " "));
                lines.push(`- ${icon} [${label}](${ref.url})`);
            }
            lines.push("");
        }
        // License summary
        const components = sbom.components || [];
        const licenses = extractLicenses(components);
        if (licenses.length > 0) {
            lines.push("**License Summary:**");
            lines.push("");
            lines.push("| License | Count |");
            lines.push("|---------|-------|");
            // Show top 10 licenses
            for (const license of licenses.slice(0, 10)){
                lines.push(`| ${license.id} | ${license.count} |`);
            }
            if (licenses.length > 10) {
                lines.push(`| *... ${licenses.length - 10} more* | |`);
            }
            lines.push("");
        }
        // NTIA compliance section
        if (pkg.ntiaCompliance) {
            lines.push(formatNTIAComplianceMarkdown(pkg.ntiaCompliance));
        }
        // Components grouped by type
        if (components.length === 0) {
            lines.push("*No components found in SBOM*");
            lines.push("");
        } else {
            const groups = groupComponentsByType(components);
            for (const [type, typeComponents] of groups){
                lines.push(`#### ${getTypeIcon(type)} ${capitalizeFirst(type)} (${typeComponents.length})`);
                lines.push("");
                // Show up to 20 components, then summarize
                const maxDisplay = 20;
                const displayComponents = typeComponents.slice(0, maxDisplay);
                lines.push("<details>");
                lines.push(`<summary>View ${typeComponents.length} ${type} components</summary>`);
                lines.push("");
                lines.push("```");
                for (const comp of displayComponents){
                    lines.push(`${comp.name}@${comp.version || "unknown"}`);
                }
                if (typeComponents.length > maxDisplay) {
                    lines.push(`... and ${typeComponents.length - maxDisplay} more`);
                }
                lines.push("```");
                lines.push("");
                lines.push("</details>");
                lines.push("");
            }
        }
        // Raw SBOM JSON for debugging
        if (pkg.sbom) {
            lines.push("<details>");
            lines.push("<summary>🔍 View raw SBOM JSON</summary>");
            lines.push("");
            lines.push("```json");
            lines.push(JSON.stringify(pkg.sbom, null, 2));
            lines.push("```");
            lines.push("");
            lines.push("</details>");
            lines.push("");
        }
    }
    // Footer with info about SBOM
    lines.push("---");
    lines.push(`*SBOMs are generated using [CycloneDX](https://cyclonedx.org/) format via \`${packageManager}\` and will be attached as attestations during publish.*`);
    lines.push("");
    return lines.join("\n");
}
/**
 * Get icon for component type
 */ function getTypeIcon(type) {
    switch(type.toLowerCase()){
        case "library":
            return "📚";
        case "application":
            return "🚀";
        case "framework":
            return "🏗️";
        case "file":
            return "📄";
        case "container":
            return "📦";
        case "device":
            return "🖥️";
        case "firmware":
            return "💾";
        case "operating-system":
            return "🖥️";
        default:
            return "📦";
    }
}
/**
 * Get icon for external reference type
 */ function getExternalRefIcon(type) {
    switch(type.toLowerCase()){
        case "vcs":
            return "🔗";
        case "issue-tracker":
            return "🐛";
        case "documentation":
            return "📚";
        case "website":
            return "🌐";
        case "support":
            return "💬";
        case "license":
            return "📜";
        case "release-notes":
            return "📝";
        case "security-contact":
            return "🔒";
        default:
            return "🔗";
    }
}
/**
 * Capitalize first letter
 */ function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
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

};
