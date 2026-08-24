import { GitHubMarkdown } from "@effected/github-actions";
import { classifyRegistry, registryDisplayName } from "@effected/npm";
import type { SbomMetadata } from "@effected/sbom";
import type { ValidationOutput } from "../schema/release-output.js";
import { DEFAULT_SERVER_URL, orgPackagePageUrl } from "../utils/github-urls.js";
import type { ConfigSource } from "../utils/load-release-config.js";

/**
 * The `validation` payload of a {@link ValidationOutput} — the single
 * build-centric object the comment renderers consume.
 *
 * @public
 */
export type ValidationPayload = ValidationOutput["validation"];

/** The publish sub-struct: ready flags, target counts, and build-centric packages. */
type ValidationPublish = ValidationPayload["publish"];

/** A released package with its builds, as carried by {@link ValidationOutput}. */
type ValidationPublishPackage = ValidationPublish["packages"][number];

/** A single build directory of a released package. */
type ValidationBuild = ValidationPublishPackage["builds"][number];

/** A single registry target under a build. */
type ValidationBuildTarget = ValidationBuild["targets"][number];

/** One row of the validation checks table. */
type ValidationCheck = ValidationPayload["checks"][number];

/** One non-pass validation outcome. */
type ValidationFinding = ValidationPayload["findings"][number];

/**
 * Options for the publish summary report.
 *
 * @public
 */
export interface PublishSummaryOptions {
	/** Whether this is a dry-run. */
	dryRun?: boolean | undefined;
}

/**
 * Get the web URL for a package page on a registry.
 *
 * @param registry - Registry URL (e.g., `https://registry.npmjs.org`), or `null` for JSR.
 * @param packageName - Package name (e.g., `@savvy-web/standalone-package`).
 * @param version - Package version (e.g., `1.0.0`).
 * @param owner - Repository owner, required for GitHub Packages URL construction.
 * @returns URL to the package page, or `undefined` if the registry has no web UI.
 *
 * @public
 */
export function getPackagePageUrl(
	registry: string | null,
	packageName: string,
	version: string,
	owner?: string | undefined,
	// Optional with a public default: every other branch of this function points
	// at a public registry (npm, JSR) whose host is fixed, so only the GitHub
	// Packages branch varies by instance, and only a GHES caller has a value to
	// pass. Defaulting keeps the twelve public-registry call sites unchanged.
	serverUrl: string = DEFAULT_SERVER_URL,
): string | undefined {
	if (!registry) {
		// JSR
		return `https://jsr.io/${packageName}@${version}`;
	}

	const kind = classifyRegistry(registry);

	if (kind === "npm") {
		// npm public registry
		return `https://www.npmjs.com/package/${packageName}/v/${version}`;
	}

	if (kind === "github-packages") {
		// GitHub Packages — URL format:
		// https://github.com/orgs/{owner}/packages/npm/package/{package-name-without-scope}
		const repoOwner = owner ?? "unknown";
		// Remove scope from package name (e.g. @savvy-web/standalone-package -> standalone-package)
		return orgPackagePageUrl(serverUrl, repoOwner, packageName);
	}

	// Custom registries — no standard web UI
	return undefined;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Get the protocol icon emoji for a registry target.
 */
function getRegistryIcon(registry: string): string {
	// JSR is the only non-npm protocol the release pipeline emits; every other
	// registry (npm public, GitHub Packages, custom) renders with the npm icon.
	if (classifyRegistry(registry) === "jsr") {
		return "\u{1F995}"; // 🦕
	}
	return "\u{1F4E6}"; // 📦
}

/**
 * Get the bump type icon emoji.
 */
function getBumpTypeIcon(type: string): string {
	switch (type) {
		case "major":
			return "\u{1F534}"; // 🔴
		case "minor":
			return "\u{1F7E1}"; // 🟡
		case "patch":
			return "\u{1F7E2}"; // 🟢
		case "new":
			return "\u{1F195}"; // 🆕
		default:
			return "⚪"; // ⚪
	}
}

/**
 * Humanise a raw byte count for display.
 *
 * @remarks
 * `0` renders as `0 B`; every positive value renders as kilobytes with one
 * decimal place (e.g. `716` → `0.7 kB`).
 *
 * @param bytes - Raw byte count.
 * @returns Human-readable size string.
 */
export function humanizeSize(bytes: number): string {
	if (bytes === 0) {
		return "0 B";
	}
	return `${(bytes / 1000).toFixed(1)} kB`;
}

/**
 * Render the `Current → Next` cell for a package.
 */
function renderVersionTransition(pkg: ValidationPublishPackage): string {
	const base = pkg.baseVersion == null ? "—" : pkg.baseVersion;
	return `${base} → ${pkg.version}`;
}

/**
 * Render the `Bump` cell for a package from the precomputed `bumpType`.
 */
function renderBumpCell(pkg: ValidationPublishPackage): string {
	if (pkg.bumpType === "new") {
		return "\u{1F195} new"; // 🆕
	}
	return `${getBumpTypeIcon(pkg.bumpType)} ${pkg.bumpType}`;
}

/**
 * Classify the overall publish status for a package.
 */
type PackageStatus = "success" | "skipped" | "partial" | "failed";

function getPackageStatus(pkg: ValidationPublishPackage): PackageStatus {
	const targets = pkg.builds.flatMap((b) => b.targets);
	if (targets.length === 0) return "success";

	const allSkipped = targets.every((t) => t.status === "skipped");
	if (allSkipped) return "skipped";

	const hasFailures = targets.some((t) => t.status === "failed");
	if (hasFailures) return "failed";

	const anySkipped = targets.some((t) => t.status === "skipped");
	if (anySkipped) return "partial";

	return "success";
}

/**
 * Get the status icon for a package.
 */
function getPackageStatusIcon(status: PackageStatus): string {
	switch (status) {
		case "success":
			return "✅";
		case "skipped":
			return "⏭️";
		case "partial":
			return "⚠️";
		case "failed":
			return "❌";
	}
}

/**
 * Get the per-target status cell for a build's registry table.
 */
function getTargetDetailStatus(target: ValidationBuildTarget): string {
	switch (target.status) {
		case "skipped":
			return "⏭️ Skipped";
		case "failed":
			return "❌ Failed";
		case "ready":
			return "✅ Ready";
	}
}

/**
 * Render the directory + sizes + SBOM line for one build.
 *
 * @remarks
 * The directory is rendered verbatim — it is the build-relative output
 * directory (e.g. `dist/npm`) the build-centric `ValidationOutput` carries.
 */
function renderBuildHeadline(build: ValidationBuild): string {
	const directory = GitHubMarkdown.code(build.directory);
	const packed = build.packedBytes === null ? "—" : humanizeSize(build.packedBytes);
	const unpacked = build.unpackedBytes === null ? "—" : humanizeSize(build.unpackedBytes);
	const files = build.fileCount === null ? "—" : String(build.fileCount);

	const parts = [
		`**${directory}**`,
		`\u{1F4E6} ${packed}`, // 📦
		`\u{1F4C2} ${unpacked}`, // 📂
		`\u{1F4C4} ${files} files`, // 📄
	];

	if (build.sbom !== null) {
		const ntia = build.sbom.ntiaCompliant ? "✅" : "⚠️";
		parts.push(`SBOM: ${build.sbom.componentCount} components · NTIA ${ntia}`);
	}

	return parts.join(" · ");
}

/**
 * Render one build's registry table.
 */
function renderBuildTargetsTable(build: ValidationBuild): string {
	const rows: ReadonlyArray<ReadonlyArray<string>> = build.targets.map((t) => {
		const registry = registryDisplayName(t.registry);
		const icon = getRegistryIcon(t.registry);
		const provenance = t.provenance ? "✅" : "\u{1F6AB}"; // 🚫
		return [getTargetDetailStatus(t), `${icon} ${registry}`, t.access, provenance];
	});
	return GitHubMarkdown.table([" ", "Registry", "Access", "Provenance"], rows);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the "What will be released" markdown section from a
 * {@link ValidationOutput}'s `publish` payload.
 *
 * @remarks
 * Pure function — no I/O. Called by the Phase-2 validation handler; frames the
 * result as a forecast of what merging the release PR will publish. Renders a
 * summary table (current → next, bump, changeset count, targets), a legend, a
 * totals line, and a per-package Details block — one section per build
 * directory, each carrying the directory's sizes, SBOM line, and registry
 * table.
 *
 * @param publish - The build-centric publish payload to summarise.
 * @param options - Optional display options.
 * @returns Markdown string.
 *
 * @public
 */
/**
 * The aggregate line that belongs under the release table.
 *
 * @remarks
 * Separated from {@link buildPublishSummary} so it can sit with the table it
 * totals. It was previously buried inside the detail section, two headings
 * below the table whose rows it sums — a reader had to scroll past the
 * per-package breakdown to find the total of what was above it.
 *
 * @param publish - The build-centric publish payload.
 * @returns One line of totals.
 *
 * @public
 */
export function buildReleaseTotals(publish: ValidationPublish): string {
	let packed = 0;
	let unpacked = 0;
	let files = 0;
	let targets = 0;
	let ready = 0;
	for (const pkg of publish.packages) {
		for (const build of pkg.builds) {
			if (build.packedBytes !== null) packed += build.packedBytes;
			if (build.unpackedBytes !== null) unpacked += build.unpackedBytes;
			if (build.fileCount !== null) files += build.fileCount;
			for (const t of build.targets) {
				targets++;
				// `=== "ready"`, matching `toValidatedReleaseRows` in
				// `src/utils/release-table.ts`. Counting every non-`failed` target
				// here made `skipped` targets count as ready, so the same release
				// reported two different `n/m ready` figures in two adjacent sections
				// of the same comment.
				if (t.status === "ready") ready++;
			}
		}
	}
	return (
		`**Totals:** \u{1F4E6} ${humanizeSize(packed)} packed · ` +
		`\u{1F4C2} ${humanizeSize(unpacked)} unpacked · ` +
		`\u{1F4C4} ${files} files · ` +
		`\u{1F3AF} ${ready}/${targets} targets ready`
	);
}

export function buildPublishSummary(publish: ValidationPublish): string {
	// Per-package detail sections. Version-only packages (no builds) are
	// excluded — a `<details>` block around a header-only, zero-row table is
	// malformed output. They still appear in the summary table above with the
	// `🏷️ Version only` cell.
	const detailSections = publish.packages
		.filter((pkg) => pkg.builds.length > 0)
		.map((pkg) => {
			const pkgStatus = getPackageStatus(pkg);
			const statusIcon = getPackageStatusIcon(pkgStatus);
			// `<summary>` does not render markdown — use a raw HTML <strong> tag.
			const summary = `<strong>${statusIcon} ${pkg.name}@${pkg.version}</strong>`;

			// One section per build directory: directory + sizes + SBOM line, then
			// that build's registry table.
			const buildSections = pkg.builds
				.map((build) => `${renderBuildHeadline(build)}\n\n${renderBuildTargetsTable(build)}`)
				.join("\n\n");

			return GitHubMarkdown.details(summary, buildSections);
		})
		.join("\n");

	// The predecessor's `ReportBuilder` was a fluent wrapper over exactly this:
	// an H2 title followed by H3 sections, joined by blank lines. Its other
	// members (`stat`, `toSummary`, `toComment`, `toCheckRun`) had no consumer
	// here — the caller already owns delivery — so only the composition survives.
	// No title and no Summary wrapper: this renders INSIDE a section that already
	// carries a heading, so an H2 here produced "Details ▸ What will be released
	// ▸ Summary" for one list of packages. The totals moved to the release table
	// they total.
	const parts: string[] = [];
	if (detailSections.length > 0) {
		parts.push(detailSections);
	}
	return parts.join("\n\n");
}

/**
 * Build the validation checks table.
 *
 * @remarks
 * Pure function — no I/O. Renders a `|   | Check | Outcome |` table; a row's
 * `Check` cell is a markdown link when the row carries a non-`null` `url`,
 * otherwise the plain check name.
 *
 * @param checks - The {@link ValidationOutput} checks to render.
 * @returns Markdown table string.
 *
 * @public
 */
/**
 * The validation checks, in the order they are reported.
 *
 * @remarks
 * Shared so the pending table Phase 1 renders and the real table Phase 2
 * renders describe the same five rows in the same order. A reader watching the
 * comment sees rows resolve in place rather than the table changing shape.
 *
 * @public
 */
export const VALIDATION_CHECK_NAMES: ReadonlyArray<string> = [
	"Link Issues from Commits",
	"Build Validation",
	"Publish Validation",
	"Release Notes Preview",
	"SBOM Preview",
];

/**
 * The checks table before anything has run — every row pending.
 *
 * @remarks
 * Rendered by Phase 1 so the verdict section carries a table from the moment
 * the pull request exists. The previous "_Validation has not run yet._" said
 * less than an all-pending table does, and changed shape when validation
 * replaced it.
 *
 * @returns The table, with no links since no check run exists yet.
 *
 * @public
 */
export function buildPendingChecksTable(): string {
	return GitHubMarkdown.table(
		[" ", "Check", "Outcome"],
		VALIDATION_CHECK_NAMES.map((name) => ["⏳", name, "pending"]),
	);
}

export function buildChecksTable(checks: ReadonlyArray<ValidationCheck>): string {
	const statusIcon = (status: ValidationCheck["status"]): "✅" | "⚠️" | "❌" =>
		status === "error" ? "❌" : status === "warning" ? "⚠️" : "✅";
	const tableRows: ReadonlyArray<ReadonlyArray<string>> = checks.map((check) => {
		const checkCell = check.url !== null ? GitHubMarkdown.link(check.name, check.url) : check.name;
		return [statusIcon(check.status), checkCell, check.outcome];
	});
	return GitHubMarkdown.table([" ", "Check", "Outcome"], tableRows);
}

/**
 * Build the validation findings table.
 *
 * @remarks
 * Pure function — no I/O. Returns an empty string when `findings` is empty.
 * Otherwise renders a heading (`### <icons> N error(s) · M warning(s)`, with a
 * side omitted when its count is zero) and a table with all errors first
 * (discovery order), then all warnings.
 *
 * @param findings - The structured {@link ValidationOutput} findings to render.
 * @returns Markdown string, or `""` when there are no findings.
 *
 * @public
 */
export function buildFindingsTable(findings: ReadonlyArray<ValidationFinding>): string {
	if (findings.length === 0) {
		return "";
	}

	const errors = findings.filter((f) => f.severity === "error");
	const warnings = findings.filter((f) => f.severity === "warning");

	const headingParts: string[] = [];
	if (errors.length > 0) {
		headingParts.push(`❌ ${errors.length} ${errors.length === 1 ? "error" : "errors"}`);
	}
	if (warnings.length > 0) {
		headingParts.push(`⚠️ ${warnings.length} ${warnings.length === 1 ? "warning" : "warnings"}`);
	}
	const heading = `### ${headingParts.join(" · ")}`;

	const ordered = [...errors, ...warnings];
	const tableRows: ReadonlyArray<ReadonlyArray<string>> = ordered.map((f) => {
		const icon = f.severity === "error" ? "❌" : "⚠️";
		const scopeCell =
			f.scope === null || f.scope.package === null
				? "—"
				: f.scope.directory === null
					? f.scope.package
					: `${f.scope.package} · ${f.scope.directory}`;
		return [icon, f.check, scopeCell, f.message];
	});
	const table = GitHubMarkdown.table([" ", "Check", "Package", "Detail"], tableRows);

	return `${heading}\n\n${table}`;
}

/**
 * Display options for {@link buildValidationComment}.
 *
 * @public
 */
export interface ValidationCommentOptions {
	/** Web URL of the unified validation check run, for the release-notes link. */
	readonly releaseNotesUrl?: string | undefined;
	/** Whether this is a dry-run. */
	readonly dryRun?: boolean | undefined;
	/** Timestamp for the footer; defaults to the current time. Inject a fixed
	 * value to keep the function deterministic (e.g. in tests). */
	readonly now?: Date | undefined;
}

/**
 * The validation verdict, as a heading title.
 *
 * @remarks
 * Pure function — no I/O. The icon **is** the verdict, computed as the worst
 * severity across `findings`: `❌` if any error, `⚠️` if any warning, `✅`
 * otherwise — and `⏳` when validation has not run yet, which is what Phase 1
 * reports. Carried as the managed section's title rather than baked into the
 * body (see {@link buildValidationHeader}), so the verdict moves with the
 * heading.
 *
 * @param validation - The canonical build-centric validation payload, or
 *   `null` when validation has not run.
 * @returns The heading text, icon first.
 *
 * @public
 */
export function validationStatusTitle(validation: ValidationPayload | null): string {
	// `null` is "validation has not run", which Phase 1 reports.
	if (validation === null) return "⏳ Release Validation";
	const hasError = validation.findings.some((f) => f.severity === "error");
	const hasWarning = validation.findings.some((f) => f.severity === "warning");
	return `${hasError ? "❌" : hasWarning ? "⚠️" : "✅"} Release Validation`;
}

/**
 * The validation verdict's body — everything under its heading.
 *
 * @remarks
 * The heading itself is {@link validationStatusTitle}, carried as the managed
 * section's title rather than baked in here: a section renders its own heading,
 * so a body that repeated it produced the heading twice. The icon has to move
 * with the title because it *is* the verdict.
 *
 * Empty on a normal run — the verdict is the heading, and there is nothing more
 * to say until something is wrong.
 *
 * @param validation - The canonical build-centric validation payload.
 * @param options - Optional display options.
 * @returns The verdict body, or `""` when there is nothing to add.
 *
 * @public
 */
export function buildValidationHeader(validation: ValidationPayload, options?: ValidationCommentOptions): string {
	const dryRun = options?.dryRun === true ? "> \u{1F9EA} **DRY RUN MODE** - No actual publishing will occur\n\n" : "";
	return `${dryRun}${buildChecksTable(validation.checks)}`;
}

/**
 * The validation comment's detail body — everything below the release table.
 *
 * @remarks
 * Split from {@link buildValidationHeader} so the two can occupy separate
 * managed sections of one comment: the verdict at the top updates on its own,
 * the detail below it updates on its own, and the release table sits between
 * them owned by a third. Each is independently stamped, so a phase rewriting
 * one leaves the others exactly as it found them.
 *
 * @param validation - The canonical build-centric validation payload.
 * @param options - Optional display options.
 * @returns The detail markdown, without the verdict header.
 *
 * @public
 */
export function buildValidationDetails(validation: ValidationPayload, options?: ValidationCommentOptions): string {
	const dryRun = options?.dryRun ?? false;
	const parts: string[] = [];

	// No checks table here: the verdict section above carries it, so a reader
	// meets the state of every check before any of the detail behind them.
	const findingsTable = buildFindingsTable(validation.findings);
	if (findingsTable !== "") {
		parts.push(findingsTable);
	}

	// "What will be released" — degrade to a single explanatory line when
	// there is nothing to preview. An empty summary table with 0-byte totals
	// and a release-notes link reads like a successful-but-empty release,
	// which is misleading in the two cases where validation produced no
	// publishable packages: a failed build (validation aborted before it
	// could resolve targets) or a release branch with no version diffs.
	const publishTitle = `## \u{1F680} What will be released${dryRun ? " \u{1F9EA} (Dry Run)" : ""}`;
	if (!validation.buildValidation.passed) {
		parts.push(
			`${publishTitle}\n\n` +
				"⚠️ **Build validation failed** — no release preview is available. " +
				"Fix the build errors flagged above; the preview regenerates once the build passes.",
		);
	} else if (validation.publish.packages.length === 0) {
		parts.push(
			`${publishTitle}\n\n` +
				"_No packages have version differences against the target branch — nothing will be published or released on merge._",
		);
	} else {
		parts.push(buildPublishSummary(validation.publish));
	}

	// One footer, carrying the link and the timestamp.
	//
	// The link was previously headed "📋 Release Notes Preview", which named the
	// wrong thing: it points at the unified validation check run — the full
	// summary, structured output included — and the release-notes preview is a
	// section on that page rather than the page itself. A heading asserting
	// otherwise sent a reader looking for notes and delivered a summary.
	//
	// Folded into the footer rather than given its own heading: it is a pointer
	// away from this comment, which is what a footer is for.
	const now = options?.now ?? new Date();
	const summaryUrl = options?.releaseNotesUrl;
	const link =
		summaryUrl !== undefined && summaryUrl !== ""
			? `${GitHubMarkdown.link("Full validation summary →", summaryUrl)} · `
			: "";
	parts.push(`---\n\n${link}<sub>Updated at ${now.toISOString()}</sub>`);

	return parts.join("\n\n");
}

/**
 * The whole validation comment, header and detail together.
 *
 * @remarks
 * Retained as the composition of {@link buildValidationHeader} and
 * {@link buildValidationDetails} for the check-run and job-summary surfaces,
 * which render one body and have no sections to update independently. The PR
 * comment uses the two halves separately.
 *
 * @param validation - The canonical build-centric validation payload.
 * @param options - Optional display options.
 * @returns The full markdown comment body.
 *
 * @public
 */
export function buildValidationComment(validation: ValidationPayload, options?: ValidationCommentOptions): string {
	const header = buildValidationHeader(validation, options);
	return [`## ${validationStatusTitle(validation)}`, header, buildValidationDetails(validation, options)]
		.filter((part) => part !== "")
		.join("\n\n");
}

/**
 * Get bump type icon for display in release reports.
 *
 * @param type - Bump type string (`major`, `minor`, `patch`, `new`).
 * @returns Emoji icon string.
 *
 * @public
 */
export { getBumpTypeIcon };

// ─── Per-step check-run summaries ─────────────────────────────────────────────

/**
 * Build the Publish Validation check-run markdown summary from the canonical
 * {@link ValidationOutput} validation payload.
 *
 * @remarks
 * Pure function — no I/O. Mirrors the build-grouped registry tables the sticky
 * comment's Details block carries, but flattened (no `<details>` wrapper) so
 * the check-run page renders them expanded. One section per released package,
 * one sub-section per build directory, each with its sizes, SBOM line, and
 * registry table.
 *
 * @param validation - The canonical build-centric validation payload.
 * @returns Markdown string for the check-run summary.
 *
 * @public
 */
export function buildPublishValidationSummary(validation: ValidationPayload): string {
	const publish = validation.publish;

	// The check-run page already renders the title; the body must not repeat
	// a `## Publish Validation` heading underneath it.
	const totals =
		`**Targets ready:** ${publish.readyTargets}/${publish.totalTargets} · ` +
		`**npm:** ${publish.npmReady ? "✅" : "❌"} · ` +
		`**GitHub Packages:** ${publish.githubPackagesReady ? "✅" : "❌"}`;

	if (publish.packages.length === 0) {
		return `${totals}\n\n_No packages with publish targets._`;
	}

	const sections: string[] = [totals];

	for (const pkg of publish.packages) {
		const pkgStatus = getPackageStatus(pkg);
		const statusIcon = getPackageStatusIcon(pkgStatus);
		sections.push(`### ${statusIcon} ${pkg.name}@${pkg.version}`);

		if (pkg.builds.length === 0) {
			sections.push("_Version-only package — no publish targets._");
			continue;
		}

		for (const buildEntry of pkg.builds) {
			sections.push(renderBuildHeadline(buildEntry));
			if (buildEntry.targets.length > 0) {
				sections.push(renderBuildTargetsTable(buildEntry));
			}
		}
	}

	return sections.join("\n\n");
}

/**
 * Render the per-package release-notes section that follows the summary
 * table. The shape mirrors what the old GitHub-Actions-summary writer
 * produced: a `### <package>` heading, a `**oldVersion → newVersion** (type)`
 * line, and the extracted CHANGELOG section (or an explanatory status).
 */
function renderReleaseNotesSection(pkg: ValidationPayload["publish"]["packages"][number]): string {
	const heading = `### ${pkg.name}`;
	const transition = `**${renderVersionTransition(pkg)}** · ${renderBumpCell(pkg)}`;

	const notes = pkg.releaseNotes;
	let body: string;
	// `releaseNotes` is optional in the schema (stripped from the serialized
	// structured output). The Release Notes Preview check is rendered from the
	// in-memory payload where it is always populated; this guard satisfies the
	// optional type for the stripped form (never rendered through here).
	if (notes === undefined) {
		body = "_No release notes captured._";
	} else
		switch (notes.status) {
			case "found":
				body = notes.content;
				break;
			case "no-changelog":
				body = "_⚠️ No `CHANGELOG.md` found for this package._";
				break;
			case "version-not-found":
				body = `_⚠️ Could not locate the \`${pkg.version}\` section in \`CHANGELOG.md\`._\n\n_Reason:_ ${notes.reason}`;
				break;
			case "error":
				body = `_⚠️ Failed to read \`CHANGELOG.md\`:_ ${notes.message}`;
				break;
		}

	return [heading, transition, body].join("\n\n");
}

/**
 * Build the Release Notes Preview check-run markdown summary from the
 * canonical {@link ValidationOutput} validation payload.
 *
 * @remarks
 * Pure function — no I/O. Renders:
 *
 * 1. A header.
 * 2. The "N package(s) ready" intro line.
 * 3. The released-packages summary table (current → next, bump, changeset
 *    count, release-notes status icon).
 * 4. A per-package section with the extracted CHANGELOG body — or an
 *    explanatory ⚠️ status when no notes could be extracted (the package has
 *    no `CHANGELOG.md`, the new version's heading was missing, or the file
 *    failed to read).
 *
 * @param validation - The canonical build-centric validation payload.
 * @returns Markdown string for the check-run summary.
 *
 * @public
 */
export function buildReleaseNotesPreviewSummary(validation: ValidationPayload): string {
	// The check-run page already renders the title; the body must not repeat
	// a `## Release Notes Preview` heading underneath it.
	const packages = validation.publish.packages;

	if (packages.length === 0) {
		return "_No packages are being released._";
	}

	const notesIcon = (notes: ValidationPayload["publish"]["packages"][number]["releaseNotes"]): string =>
		notes?.status === "found" ? "✅" : "⚠️";

	const tableRows: ReadonlyArray<ReadonlyArray<string>> = packages.map((pkg) => {
		const changesets = pkg.changesetCount === null ? "—" : String(pkg.changesetCount);
		return [pkg.name, renderVersionTransition(pkg), renderBumpCell(pkg), changesets, notesIcon(pkg.releaseNotes)];
	});
	const table = GitHubMarkdown.table(["Package", "Current → Next", "Bump", "Changesets", "Notes"], tableRows);

	const intro = `**${packages.length} package(s) ready for release on merge.**`;

	const sections = packages.map(renderReleaseNotesSection);

	return [intro, table, "---", ...sections].join("\n\n");
}

/**
 * Format a `ConfigSource` for the SBOM Preview "Config source" line.
 *
 * @remarks
 * `"input"` is the most common (and most invisible) source — printing the
 * input name beside it makes the source explicit. `"local"` carries the
 * matched file path. `"variable"` carries the env-var name. `"none"` prints
 * just the label.
 */
function formatSbomConfigSource(source: ConfigSource): string {
	const location = source.location ?? "";
	switch (source.source) {
		case "input":
			return location ? `\`input\` (${location})` : "`input`";
		case "local":
			return location ? `\`local\` (${location})` : "`local`";
		case "variable":
			return location ? `\`variable\` (${location})` : "`variable`";
		case "none":
			return "`none` — no config supplied";
	}
}

/**
 * Build the SBOM Preview check-run markdown summary from the canonical
 * {@link ValidationOutput} validation payload, plus the per-build resolved
 * `sbom-config` metadata threaded through `runValidation`.
 *
 * @remarks
 * Pure function — no I/O. Per build: component count, NTIA pass/fail, the
 * missing NTIA fields, and the resolved `sbom-config` metadata used (rendered
 * as a fenced JSON block). When the config source is `"none"` (or no source
 * info is provided and the resolved map is empty), surfaces a hint so
 * config-or-mapping bugs are immediately visible.
 *
 * The first line of the summary identifies which source the action chose
 * (`input` / `local` / `variable` / `none`) — invaluable when NTIA still warns
 * despite a caller-supplied template.
 *
 * The map is keyed by `${pkg.name}:${build.directory}` (the same key
 * `runValidation` writes).
 *
 * @param validation - The canonical build-centric validation payload.
 * @param resolvedSbomConfig - Per-build resolved sbom-config metadata, or
 *   `null` when no map was produced.
 * @param sbomConfigSource - Where the `sbom-config` was loaded from, or
 *   `null` when `runValidation` did not reach the config-load step.
 * @returns Markdown string for the check-run summary.
 *
 * @public
 */
export function buildSbomPreviewSummary(
	validation: ValidationPayload,
	resolvedSbomConfig: ReadonlyMap<string, SbomMetadata> | null,
	sbomConfigSource: ConfigSource | null = null,
): string {
	// The check-run page already renders the title; the body must not repeat
	// a `## SBOM Preview` heading underneath it.
	const packages = validation.publish.packages;

	const sourceLine =
		sbomConfigSource !== null ? `**Config source:** ${formatSbomConfigSource(sbomConfigSource)}` : null;

	const hint =
		"> _No `sbom-config` resolved — supply via the `sbom-config` action input or `vars.SILK_RELEASE_SBOM_TEMPLATE`._";

	if (packages.length === 0) {
		// The empty-config hint is only useful when no config was supplied. A
		// caller that did supply a config (non-null, non-empty map) just sees
		// the "no packages" line.
		const hasConfig = resolvedSbomConfig !== null && resolvedSbomConfig.size > 0;
		const parts: string[] = [];
		if (sourceLine !== null) parts.push(sourceLine);
		parts.push("_No packages require an SBOM._");
		if (!hasConfig && (sbomConfigSource === null || sbomConfigSource.source === "none")) {
			parts.push(hint);
		}
		return parts.join("\n\n");
	}

	// Source field is authoritative when supplied — every processed build
	// records a `ResolvedSBOMMetadata` from `resolveSBOMMetadata` (which falls
	// back to inferred-only when no template), so the map alone can't tell us
	// "no template supplied." When the caller did not provide `sbomConfigSource`
	// (e.g. legacy callers, or tests), fall back to "map is null or empty" as
	// the best available approximation.
	const noTemplateSupplied =
		sbomConfigSource !== null
			? sbomConfigSource.source === "none"
			: resolvedSbomConfig === null || resolvedSbomConfig.size === 0;

	const sections: string[] = [];
	if (sourceLine !== null) sections.push(sourceLine);

	if (noTemplateSupplied) {
		sections.push(hint);
	}

	for (const pkg of packages) {
		sections.push(`### ${pkg.name}@${pkg.version}`);

		if (pkg.builds.length === 0) {
			sections.push("_Version-only package — no SBOM generated._");
			continue;
		}

		for (const buildEntry of pkg.builds) {
			const buildHeader = `**${GitHubMarkdown.code(buildEntry.directory)}**`;
			sections.push(buildHeader);

			if (buildEntry.sbom === null) {
				sections.push("_SBOM not generated for this build._");
			} else {
				const ntiaIcon = buildEntry.sbom.ntiaCompliant ? "✅" : "⚠️";
				const ntiaLine = `SBOM: ${buildEntry.sbom.componentCount} components · NTIA ${ntiaIcon}`;
				sections.push(ntiaLine);
				if (!buildEntry.sbom.ntiaCompliant && buildEntry.sbom.missingNtiaFields.length > 0) {
					const missing = buildEntry.sbom.missingNtiaFields.join(", ");
					sections.push(`**Missing NTIA fields:** ${missing}`);
				}
			}

			const key = `${pkg.name}:${buildEntry.directory}`;
			const resolved = resolvedSbomConfig !== null ? resolvedSbomConfig.get(key) : undefined;
			if (resolved !== undefined) {
				sections.push("_Resolved `sbom-config` metadata used:_");
				sections.push(GitHubMarkdown.codeBlock(JSON.stringify(resolved, null, 2), "json"));
			} else if (resolvedSbomConfig !== null) {
				// Map exists but no entry for this build — keep the per-build
				// rendering honest.
				sections.push("_No resolved `sbom-config` metadata for this build._");
			}
		}
	}

	return sections.join("\n\n");
}
