/**
 * The release action's structured JSON output contract.
 *
 * @remarks
 * `ReleaseOutput` is a `Schema.Union` of three phase structs, discriminated by
 * the `phase` literal. It is the single source of truth: the committed
 * `silk-release-action.output.schema.json` is generated from it, and
 * `main.ts` emits a Schema-encoded instance as the `result` action output.
 *
 * Field order matters — `setJson` serialises in declaration order, so `$schema`
 * is declared first in every phase struct.
 */

import { Schema } from "effect";

/**
 * Hosted JSON Schema URL; the emitted `result` carries this as `$schema`.
 *
 * @remarks
 * **Versioned, and it has to stay that way.** Every payload the action emits
 * carries this URL, so it must keep resolving to the shape that payload was
 * written against long after the schema has moved on. An unversioned URL would
 * silently re-point old payloads at a newer contract.
 *
 * Kept in step with `SCHEMA_SEMVER` in `lib/scripts/generate-schema.ts`, which
 * derives the file name from the same label. When SchemaStore hosts the
 * document, this becomes its `schemastore.org` URL and the raw GitHub path
 * stays as the fallback origin.
 */
export const SCHEMA_URL =
	"https://raw.githubusercontent.com/savvy-web/silk-release-action/main/schemas/5.0.0/silk-release-action-5.0.0.json";

/**
 * In-band schema version. Bumped only on a breaking JSON-shape change
 * (removed/renamed field, changed type) — additive fields do not bump it.
 *
 * @remarks
 * `"2"` reshaped the publish phase (Phase 3) around the WORKSPACE rather than
 * the package, and replaced the `status`/`noop`/`succeeded`/`hasFailures` flag
 * set with the `success` + `outcome` pair across ALL THREE phases, adding
 * `summary`, `failure` and `totals` to each. The version is one number for the
 * whole document, so it moves when any member of the union does.
 */
export const SCHEMA_VERSION = "2";

// --- shared top-level field annotations ----------------------------------

/**
 * Reusable annotated `$schema` field — the URL of the hosted JSON Schema
 * the `result` output conforms to.
 *
 * Inlined per-phase because `Schema.Literal(SCHEMA_URL)` must remain a literal
 * for the union discriminator to narrow correctly; only the annotations are
 * factored out via a helper.
 */
const annotatedSchemaUrlField = Schema.Literal(SCHEMA_URL).annotate({
	title: "JSON Schema URL",
	description:
		"URL of the hosted JSON Schema this output conforms to. Editors and json-schema-aware consumers use this for hover docs and validation.",
});

const annotatedSchemaVersionField = Schema.Literal(SCHEMA_VERSION).annotate({
	title: "Schema version",
	description:
		"In-band schema version. Bumped only on a breaking JSON-shape change (removed/renamed field, changed type) — additive fields do not bump it.",
});

/**
 * The boolean gate every phase carries.
 *
 * @remarks
 * Deliberately paired with a per-phase `outcome` enum rather than standing
 * alone. `success` answers "did this work?"; `outcome` answers "what
 * specifically happened?". Keeping them separate means a consumer filtering on
 * `success` keeps working when a new outcome member is added — which is what
 * the old four-field flag set (`status`, `noop`, `succeeded`, `hasFailures`)
 * could not offer, because answering either question meant recombining
 * several booleans whose definitions had already drifted from their docs.
 */
const annotatedSuccessField = Schema.Boolean.annotate({
	title: "Succeeded",
	description:
		"The one boolean a consumer should gate on. True when the phase completed with nothing failed — including a run that had nothing to do, which is a success because nothing failed. Read `outcome` for what specifically happened.",
});

/** The derived one-line account every phase carries. */
const annotatedSummaryField = Schema.String.annotate({
	title: "Summary",
	description:
		"One human-readable sentence describing the run. Derived from the structured fields beside it and never authored independently, so the prose cannot drift from the data.",
});

const annotatedDryRunField = Schema.Boolean.annotate({
	title: "Dry run",
	description:
		"True when the action ran with `dry-run: true`. Phase 3 publishes nothing in dry-run mode; Phases 1 and 2 still observe and report, but mutations (branch updates, PR creation/updating) are suppressed.",
});

// --- branch-management phase ---------------------------------------------

const BranchManagementPayload = Schema.Struct({
	releaseBranch: Schema.Struct({
		name: Schema.String.annotate({
			title: "Release branch name",
			description: "The git branch name the release PR targets and changeset versioning lands on.",
			examples: ["changeset-release/main"],
		}),
		existed: Schema.Boolean.annotate({
			title: "Branch existed",
			description: "True when the release branch already existed before this run; false when it was just created.",
		}),
		created: Schema.Boolean.annotate({
			title: "Branch created",
			description: "True when this run created the release branch.",
		}),
		updated: Schema.Boolean.annotate({
			title: "Branch updated",
			description: "True when this run pushed new commits to the release branch (changeset version bumps, etc.).",
		}),
		hasConflicts: Schema.Boolean.annotate({
			title: "Has conflicts",
			description:
				"True when the release branch could not be cleanly fast-forwarded over the target branch and a merge conflict was detected. When true, the release branch needs manual conflict resolution before subsequent runs can complete; the action will keep failing on this branch until the conflict is resolved.",
		}),
	}).annotate({
		identifier: "BranchManagementReleaseBranch",
		title: "Release branch state",
		description:
			"The state of the release branch after Phase 1 — whether it existed, was created/updated, and any conflicts.",
	}),
	releasePr: Schema.NullOr(
		Schema.Struct({
			number: Schema.Finite.annotate({
				title: "Release PR number",
				description: "The GitHub PR number for the release PR.",
			}),
			url: Schema.String.annotate({
				title: "Release PR URL",
				description: "The HTML URL of the release PR on GitHub.",
				examples: ["https://github.com/owner/repo/pull/123"],
			}),
			action: Schema.Literals(["created", "updated"]).annotate({
				title: "Release PR action",
				description: "Whether this run created the release PR or updated an existing one.",
			}),
		}).annotate({
			identifier: "BranchManagementReleasePr",
			title: "Release PR state",
			description:
				"The release PR's number, URL, and the action this run took on it. Null when no PR was created (no changesets to release).",
		}),
	),
	changesets: Schema.Struct({
		count: Schema.Finite.annotate({
			title: "Changeset count",
			description:
				"The number of changeset **files** observed in the `.changeset/` directory. Not the length of `packages`: one file may name several packages, and two files may name the same one, so the two numbers diverge in both directions.",
		}),
		packages: Schema.Array(
			Schema.Struct({
				name: Schema.String.annotate({
					title: "Package name",
					description: "The npm package name this release covers.",
				}),
				bumpType: Schema.Literals(["major", "minor", "patch"]).annotate({
					identifier: "ChangesetsBumpType",
					title: "Changeset bump type",
					description:
						"The bump the release plan applies to this package: `major`, `minor`, or `patch`. The validation phase emits an extended set under `ValidationBumpType` that adds `new` and `unknown`.",
				}),
				changesetCount: Schema.Finite.annotate({
					title: "Changesets naming this package",
					description:
						"How many changeset files name this package. **Zero means the package releases only because a dependency did** — it still gets a version bump and a CHANGELOG entry, but no changeset asked for it, so it is invisible to a count of changeset files. Renders as the `—` in a release table's changeset column.",
				}),
				oldVersion: Schema.String.annotate({
					title: "Current version",
					description:
						"The package's version before this release, as recorded in its `package.json` on the target branch.",
				}),
				newVersion: Schema.String.annotate({
					title: "Next version",
					description:
						"The version this release will publish, after applying `bumpType`. Known in Phase 1 because it comes from the release plan rather than from the changeset files.",
				}),
			}).annotate({
				identifier: "BranchManagementChangesetPackage",
				title: "Changeset package",
				description: "One package the release plan covers, with its bump and whether a changeset asked for it.",
			}),
		).annotate({
			title: "Changeset packages",
			description:
				"Every package this release will version, from the release plan — including packages bumped only because a dependency moved, which `changesetCount: 0` identifies. Empty array when there is nothing to release; the action emits a no-op in that case.",
		}),
	}).annotate({
		identifier: "BranchManagementChangesets",
		title: "Changesets observed",
		description:
			"What this run will release — the number of changeset files, and every package the release plan versions with its bump and whether a changeset named it explicitly.",
	}),
}).annotate({
	identifier: "BranchManagementPayload",
	title: "Branch Management payload",
	description:
		"Phase 1 outcome — the release-branch ensure/create result, the release PR (created or updated, null when no changesets), and the changesets observed in `.changeset/` with their derived per-package bumps.",
});

export const BranchManagementOutput = Schema.Struct({
	$schema: annotatedSchemaUrlField,
	schemaVersion: annotatedSchemaVersionField,
	phase: Schema.Literal("branch-management").annotate({
		title: "Phase discriminator",
		description: "`branch-management` identifies this as a Phase 1 output.",
	}),
	success: annotatedSuccessField,
	outcome: Schema.Literals([
		"nothing-to-release",
		"branch-created",
		"branch-updated",
		"branch-unchanged",
		"conflicted",
	]).annotate({
		identifier: "BranchManagementOutcome",
		title: "Phase outcome",
		description:
			"`nothing-to-release` — no changesets were found, so no branch or PR work was needed. A SUCCESS: nothing failed. `branch-created` — the release branch and its PR were created. `branch-updated` — an existing release branch and PR were brought up to date. `branch-unchanged` — the release branch already matched the plan and needed no push. `conflicted` — the release branch could not be updated because the merge conflicted; the only failing outcome for this phase.",
	}),
	summary: annotatedSummaryField,
	dryRun: annotatedDryRunField,
	failure: Schema.NullOr(
		Schema.Struct({
			stage: Schema.Literals(["plan", "branch", "pull-request"]).annotate({
				identifier: "BranchManagementFailureStage",
				title: "Failure stage",
				description:
					"WHEN the phase failed. `plan` — the release plan could not be read; `branch` — the release branch could not be created or updated (a merge conflict is the usual cause); `pull-request` — the release PR could not be opened or updated.",
			}),
			reason: Schema.String.annotate({
				title: "Failure reason",
				description: "WHAT went wrong, as a single-line summary.",
			}),
		}).annotate({ identifier: "BranchManagementFailure", title: "Failure" }),
	).annotate({
		title: "Failure",
		description: "Why and where the phase failed. Null when `success` is true.",
	}),
	totals: Schema.Struct({
		changesetFiles: Schema.Number.annotate({
			title: "Changeset files",
			description:
				"Changeset files observed in `.changeset/`. NOT the workspace count — one file may name several workspaces, and two files may name the same one, so the two diverge in both directions.",
		}),
		workspaces: Schema.Number.annotate({
			title: "Workspaces",
			description:
				"Workspaces the release plan versions. Includes those pulled in only because a dependency moved, which name no changeset of their own.",
		}),
	}).annotate({
		identifier: "BranchManagementTotals",
		title: "Totals",
		description: "Aggregate counts, so a consumer does not have to reduce the changeset list.",
	}),
	branchManagement: BranchManagementPayload,
}).annotate({
	identifier: "BranchManagementOutput",
	title: "Branch Management output (Phase 1)",
	description:
		"The structured `result` output emitted when the action runs in the branch-management phase (Phase 1). Triggered by a push to the target branch; ensures/creates the release branch and the release PR.",
	examples: [
		{
			$schema: SCHEMA_URL,
			schemaVersion: SCHEMA_VERSION,
			phase: "branch-management",
			success: true,
			outcome: "branch-created",
			summary: "1 changeset file · 1 workspace to version · release PR created",
			failure: null,
			totals: { changesetFiles: 1, workspaces: 1 },
			dryRun: false,
			branchManagement: {
				releaseBranch: {
					name: "changeset-release/main",
					existed: true,
					created: false,
					updated: true,
					hasConflicts: false,
				},
				releasePr: {
					number: 42,
					url: "https://github.com/savvy-web/example-repo/pull/42",
					action: "updated",
				},
				changesets: {
					count: 1,
					packages: [
						{
							name: "@savvy-web/example",
							bumpType: "minor",
							changesetCount: 1,
							oldVersion: "1.4.0",
							newVersion: "1.5.0",
						},
						{
							name: "@savvy-web/example-consumer",
							bumpType: "patch",
							changesetCount: 0,
							oldVersion: "2.0.3",
							newVersion: "2.0.4",
						},
					],
				},
			},
		},
	],
});
export type BranchManagementOutput = Schema.Schema.Type<typeof BranchManagementOutput>;

// --- validation phase ----------------------------------------------------

/** The build-validation step's per-row checks table outcome. */
const ValidationCheck = Schema.Struct({
	name: Schema.String.annotate({
		title: "Check name",
		description:
			"Row label for the Validation Checks table. Canonical five-row set today: 'Build Validation', 'Link Issues', 'Publish Validation', 'Release Notes Preview', 'SBOM Preview'.",
		examples: ["Build Validation", "Link Issues", "Publish Validation", "Release Notes Preview", "SBOM Preview"],
	}),
	status: Schema.Literals(["pass", "warning", "error"]).annotate({
		title: "Check status",
		description:
			"`pass` — the check passed; `warning` — the check raised a non-blocking warning; `error` — the check failed and blocks the release.",
	}),
	outcome: Schema.String.annotate({
		title: "Outcome message",
		description: "Short human-readable summary of the check's outcome (e.g. counts, registry names, error class).",
	}),
	url: Schema.NullOr(
		Schema.String.annotate({
			title: "Check URL",
			description:
				"URL pointing to detail for this check (a check-run URL or external report). Null when no URL applies.",
		}),
	),
}).annotate({
	identifier: "ValidationCheck",
	title: "Validation check row",
	description:
		"One row of the five-row Validation Checks table shown in the release PR comment and the unified check-run summary.",
});

/** A non-pass outcome — the package / build directory it concerns. */
const ValidationFindingScope = Schema.Struct({
	package: Schema.NullOr(
		Schema.String.annotate({
			title: "Package name",
			description:
				"The npm package name the finding concerns. When non-null, equals the `name` of an entry in `publish.packages[]`. When null, the finding is global to the validation run rather than tied to a specific package.",
		}),
	),
	directory: Schema.NullOr(
		Schema.String.annotate({
			title: "Build directory",
			description:
				"The build output directory the finding concerns, package-relative. When non-null, equals the `directory` of an entry in the owning package's `builds[]`. When null, the finding concerns the package as a whole rather than a specific build.",
			examples: ["dist/npm", "dist/jsr"],
		}),
	),
}).annotate({
	identifier: "ValidationFindingScope",
	title: "Validation finding scope",
	description:
		"What a non-pass finding concerns: which package and which of its build directories. `package` is null for global findings; `directory` is null for findings not tied to a specific build directory.",
});

/** Every non-pass validation outcome, projected for the comment / consumers. */
const ValidationFinding = Schema.Struct({
	severity: Schema.Literals(["error", "warning"]).annotate({
		title: "Finding severity",
		description:
			"`error` — fails the validation phase; the release PR is blocked from merging until resolved. `warning` — advisory only and does not block the release; the comment surfaces it for the author to read.",
	}),
	check: Schema.String.annotate({
		title: "Owning check",
		description:
			"The validation check that produced this finding (e.g. `Build Validation`, `Publish Validation`). Equal to the `name` of an entry in `checks[]`. Consumers can group findings under their owning check by joining on this value.",
	}),
	scope: Schema.NullOr(ValidationFindingScope),
	message: Schema.String.annotate({
		title: "Finding message",
		description: "Human-readable description of the finding, suitable for direct display in the release PR comment.",
	}),
}).annotate({
	identifier: "ValidationFinding",
	title: "Validation finding",
	description:
		"Every non-pass validation outcome — `error` fails the check and blocks the release; `warning` is advisory. Findings are projected for the release PR comment and for downstream consumers of the `result` output.",
});

/** The SBOM preview for one build directory. */
const ValidationBuildSbom = Schema.Struct({
	componentCount: Schema.Finite.annotate({
		title: "Component count",
		description:
			"Number of components (direct + transitive dependencies) in the BOM. 0 is legitimate for a dependency-free package.",
	}),
	ntiaCompliant: Schema.Boolean.annotate({
		title: "NTIA compliant",
		description:
			"True when the BOM satisfies every NTIA minimum-elements field. False when at least one field is missing — see `missingNtiaFields`.",
	}),
	missingNtiaFields: Schema.Array(Schema.String).annotate({
		title: "Missing NTIA fields",
		description: "Names of the NTIA minimum-elements fields the BOM is missing. Empty when `ntiaCompliant` is true.",
		examples: [["Supplier Name", "Author"], ["Timestamp"]],
	}),
}).annotate({
	identifier: "ValidationBuildSbom",
	title: "SBOM preview",
	description:
		"Per-build SBOM preview: component count, NTIA minimum-elements compliance, and the list of missing NTIA fields when not compliant.",
});

/** A single registry target under a build — its per-registry publish readiness. */
const ValidationBuildTarget = Schema.Struct({
	registry: Schema.String.annotate({
		title: "Registry URL",
		description: "The registry endpoint this target would publish to.",
		examples: ["https://registry.npmjs.org/", "https://npm.pkg.github.com/", "https://jsr.io"],
	}),
	status: Schema.Literals(["ready", "skipped", "failed"]).annotate({
		title: "Target readiness",
		description:
			"`ready` — the dry-run publish probe succeeded and the target is ready to publish; `skipped` — the target was intentionally not probed (e.g. unconfigured or filtered out); `failed` — the dry-run probe failed and the target would not publish.",
	}),
	access: Schema.Literals(["public", "restricted"]).annotate({
		title: "Access level",
		description:
			"`public` — the package would publish publicly; `restricted` — the package would publish privately (scoped, restricted access).",
	}),
	provenance: Schema.Boolean.annotate({
		title: "Provenance",
		description: "True when the target supports and would emit npm OIDC sigstore provenance attestations.",
	}),
}).annotate({
	identifier: "ValidationBuildTarget",
	title: "Publish target",
	description:
		"Per-registry publish readiness for a single build directory: `ready` / `skipped` / `failed`, plus access level and provenance support.",
});

/** A build — one per unique target directory of a released package. */
const ValidationBuild = Schema.Struct({
	directory: Schema.String.annotate({
		title: "Build directory",
		description:
			"Package-relative path to the build's output directory. One build is produced per unique output directory; the tarball is packed once and shared across all targets publishing this directory.",
		examples: ["dist/npm", "dist/jsr"],
	}),
	packedBytes: Schema.NullOr(
		Schema.Finite.annotate({
			title: "Packed size (bytes)",
			description: "Size of the packed tarball in bytes. Null when the dry-run did not report it.",
		}),
	),
	unpackedBytes: Schema.NullOr(
		Schema.Finite.annotate({
			title: "Unpacked size (bytes)",
			description: "Size of the unpacked contents in bytes. Null when the dry-run did not report it.",
		}),
	),
	fileCount: Schema.NullOr(
		Schema.Finite.annotate({
			title: "File count",
			description: "Number of files in the packed tarball. Null when the dry-run did not report it.",
		}),
	),
	sbom: Schema.NullOr(ValidationBuildSbom),
	targets: Schema.Array(ValidationBuildTarget).annotate({
		title: "Publish targets",
		description: "The registry targets this build would publish to, with per-target readiness.",
	}),
}).annotate({
	identifier: "ValidationBuild",
	title: "Build",
	description:
		"One unique output directory of a released package. The tarball is packed once and shared across all registry targets publishing this directory; per-target readiness is enumerated in `targets`.",
});

/**
 * The CHANGELOG.md section extracted for the new version.
 *
 * @remarks
 * Discriminated by `status`. The validation phase reads each released
 * package's `CHANGELOG.md` (already populated by `changeset version`) and
 * locates the section for the new version. The shape mirrors the
 * `ReleaseNotesExtraction` type in `utils/extract-release-notes.ts` so the
 * pure extractor and the schema-encoded output share one wire format.
 */
const ValidationReleaseNotes = Schema.Union([
	Schema.Struct({
		status: Schema.Literal("found").annotate({
			title: "Found",
			description: "The CHANGELOG.md was found and the section for the new version was successfully extracted.",
		}),
		content: Schema.String.annotate({
			title: "Release notes content",
			description: "The extracted Markdown content of the CHANGELOG.md section for the new version.",
		}),
	}).annotate({
		identifier: "ReleaseNotesFound",
		title: "Release notes found",
		description: "The CHANGELOG.md exists and the section for the new version was located and extracted.",
	}),
	Schema.Struct({
		status: Schema.Literal("no-changelog").annotate({
			title: "No CHANGELOG.md",
			description: "The package has no CHANGELOG.md file — no release notes can be extracted.",
		}),
	}).annotate({
		identifier: "ReleaseNotesNoChangelog",
		title: "Release notes — no CHANGELOG.md",
		description:
			"The package has no CHANGELOG.md file. This is non-fatal; the GitHub release is created with the version-bump summary instead.",
	}),
	Schema.Struct({
		status: Schema.Literal("version-not-found").annotate({
			title: "Version not found",
			description: "The CHANGELOG.md exists but no section for the new version was found.",
		}),
		reason: Schema.String.annotate({
			title: "Reason",
			description:
				"Human-readable explanation of why the version section was not located (e.g. parser couldn't find a matching heading).",
		}),
	}).annotate({
		identifier: "ReleaseNotesVersionNotFound",
		title: "Release notes — version not found",
		description: "The CHANGELOG.md exists but no section for the new version was found.",
	}),
	Schema.Struct({
		status: Schema.Literal("error").annotate({
			title: "Error",
			description: "An error occurred while attempting to read or parse the CHANGELOG.md.",
		}),
		message: Schema.String.annotate({
			title: "Error message",
			description: "The error message from the failed read/parse operation.",
		}),
	}).annotate({
		identifier: "ReleaseNotesError",
		title: "Release notes — error",
		description:
			"An error occurred while attempting to read or parse the CHANGELOG.md. Non-fatal — the release still proceeds; the GitHub Release body falls back to an auto-generated bump summary.",
	}),
]).annotate({
	identifier: "ValidationReleaseNotes",
	title: "Release notes extraction",
	description:
		"Discriminated outcome of reading the package's CHANGELOG.md (already populated by `changeset version`) and locating the section for the new version: `found`, `no-changelog`, `version-not-found`, or `error`.",
});

/** A released package and the builds it produces. */
const ValidationPublishPackage = Schema.Struct({
	name: Schema.String.annotate({
		title: "Package name",
		description: "The npm package name being released.",
	}),
	version: Schema.String.annotate({
		title: "New version",
		description: "The new semver version this release would publish.",
		examples: ["1.2.3", "0.4.0-beta.1"],
	}),
	baseVersion: Schema.NullOr(
		Schema.String.annotate({
			title: "Base version",
			description: "The previously published version this release is bumped from. Null when this is the first publish.",
		}),
	),
	bumpType: Schema.Literals(["major", "minor", "patch", "new", "unknown"]).annotate({
		identifier: "ValidationBumpType",
		title: "Bump type",
		description:
			"The validation phase's package bump type, derived by diffing the release-branch version against the target-branch version. A superset of `ChangesetsBumpType` (Phase 1 declared bumps): `major`/`minor`/`patch` are the standard semver bumps, and this enum adds `new` (no prior published version exists on the target branch) and `unknown` (could not be determined, typically when the prior version was a pre-release tag).",
	}),
	changesetCount: Schema.NullOr(
		Schema.Finite.annotate({
			title: "Changeset count",
			description: "Number of changesets contributing to this package's bump. Null when unknown.",
		}),
	),
	ready: Schema.Boolean.annotate({
		title: "Ready",
		description: "True when every publish target for this package's builds passed its dry-run probe.",
	}),
	versionOnly: Schema.Boolean.annotate({
		title: "Version-only",
		description:
			"True when the package has no publish targets — only a GitHub release (and tag) is produced. Used for repos that version a package but don't publish it to a registry.",
	}),
	builds: Schema.Array(ValidationBuild).annotate({
		title: "Builds",
		description: "The unique output directories this package produces, one entry per build.",
	}),
	// Optional in the machine-readable output: the full CHANGELOG content is rendered in the
	// dedicated Release Notes Preview check, not duplicated into the `result` payload / the
	// embedded JSON block (where it otherwise dominates the size and can exceed the
	// check-summary byte limit). Populated in-memory for the preview check, stripped before
	// serialization.
	releaseNotes: Schema.optional(ValidationReleaseNotes),
}).annotate({
	identifier: "ValidationPublishPackage",
	title: "Released package",
	description:
		"A package being released this run, with its bump type, builds, per-target readiness, and the extracted release notes.",
});

const ValidationPayload = Schema.Struct({
	// The action's build-validation step (renamed from `builds` to free that
	// name for the per-package build directories below).
	buildValidation: Schema.Struct({
		passed: Schema.Boolean.annotate({
			title: "Build validation passed",
			description: "True when every released package built successfully.",
		}),
		packageCount: Schema.Finite.annotate({
			title: "Package count",
			description: "Number of packages built and validated.",
		}),
	}).annotate({
		identifier: "ValidationBuildValidation",
		title: "Build validation summary",
		description: "Summary of the build-validation step: whether every package built, and how many were built.",
	}),
	checks: Schema.Array(ValidationCheck).annotate({
		title: "Validation checks",
		description:
			"The five-row Validation Checks table — one entry per validation step run this phase. Canonical names: 'Build Validation', 'Link Issues', 'Publish Validation', 'Release Notes Preview', 'SBOM Preview'.",
	}),
	findings: Schema.Array(ValidationFinding).annotate({
		title: "Findings",
		description:
			"Every non-pass outcome surfaced by the validation checks, projected for the release PR comment. Empty array when no checks produced an error or warning. Findings preserve the order the checks ran in; the comment renderer reorders errors-before-warnings for display.",
	}),
	publish: Schema.Struct({
		npmReady: Schema.Boolean.annotate({
			title: "npm ready",
			description: "True when every npm publish target passed its dry-run probe.",
		}),
		githubPackagesReady: Schema.Boolean.annotate({
			title: "GitHub Packages ready",
			description: "True when every GitHub Packages publish target passed its dry-run probe.",
		}),
		totalTargets: Schema.Finite.annotate({
			title: "Total targets",
			description: "Total number of publish targets across every released package and every registry.",
		}),
		readyTargets: Schema.Finite.annotate({
			title: "Ready targets",
			description: "Number of publish targets that passed their dry-run probe.",
		}),
		packages: Schema.Array(ValidationPublishPackage).annotate({
			title: "Released packages",
			description:
				"The packages being released this run, with their builds and per-target readiness. Empty array only when no packages had version differences against the target branch — in that case the run is a noop and a warning-severity finding is emitted to explain why. A release that bumps only private/version-only packages still populates this array, with empty `builds` per package.",
		}),
	}).annotate({
		identifier: "ValidationPublish",
		title: "Publish preview",
		description:
			"Build-centric publish preview — per-registry readiness rollup plus the full per-package, per-build, per-target breakdown.",
	}),
	checkRun: Schema.NullOr(
		Schema.Struct({
			url: Schema.String.annotate({
				title: "Check-run URL",
				description: "The HTML URL of the unified Release Validation Summary check-run.",
				examples: ["https://github.com/owner/repo/runs/123456789"],
			}),
			conclusion: Schema.Literals([
				"success",
				"failure",
				"neutral",
				"cancelled",
				"skipped",
				"timed_out",
				"action_required",
			]).annotate({
				title: "Check-run conclusion",
				description:
					"The GitHub check-run conclusion enum: `success`, `failure`, `neutral`, `cancelled`, `skipped`, `timed_out`, or `action_required`.",
			}),
		}).annotate({
			identifier: "ValidationCheckRun",
			title: "Validation check-run",
			description:
				"The unified Release Validation Summary check-run produced by the validation phase. Null when no check-run was created.",
		}),
	),
}).annotate({
	identifier: "ValidationPayload",
	title: "Validation payload",
	description:
		"Phase 2 outcome — the build-validation result, the Validation Checks table, every non-pass finding, the build-centric publish preview (per-package, per-build, per-target readiness), and the unified Release Validation Summary check-run URL.",
});

export const ValidationOutput = Schema.Struct({
	$schema: annotatedSchemaUrlField,
	schemaVersion: annotatedSchemaVersionField,
	phase: Schema.Literal("validation").annotate({
		title: "Phase discriminator",
		description: "`validation` identifies this as a Phase 2 output.",
	}),
	success: annotatedSuccessField,
	outcome: Schema.Literals(["validated", "nothing-to-release", "build-failed", "checks-failed"]).annotate({
		identifier: "ValidationOutcome",
		title: "Phase outcome",
		description:
			"`validated` — every build passed and no check raised an error finding. `nothing-to-release` — no workspace had a version difference against the target branch, so there was nothing to validate; a SUCCESS, because nothing failed. It usually means the release already merged, or Phase 1 did not commit the expected bumps, and a warning-severity finding is emitted alongside it. `build-failed` — a build failed, so the publish dry-runs never ran and their check rows report the cascade rather than a result of their own. `checks-failed` — builds passed but at least one check produced an error finding.",
	}),
	summary: annotatedSummaryField,
	dryRun: annotatedDryRunField,
	failure: Schema.NullOr(
		Schema.Struct({
			stage: Schema.Literals(["build", "publish-validation", "sbom", "release-notes"]).annotate({
				identifier: "ValidationFailureStage",
				title: "Failure stage",
				description:
					"WHEN validation failed. `build` — a workspace build failed, which cascades to every downstream check; `publish-validation` — a publish dry-run failed or could not be completed; `sbom` — SBOM generation or its NTIA check failed; `release-notes` — the release-notes preview could not be produced.",
			}),
			reason: Schema.String.annotate({
				title: "Failure reason",
				description: "WHAT went wrong, as a single-line summary.",
			}),
		}).annotate({ identifier: "ValidationFailure", title: "Failure" }),
	).annotate({
		title: "Failure",
		description: "Why and where validation failed. Null when `success` is true.",
	}),
	totals: Schema.Struct({
		workspaces: Schema.Number.annotate({
			title: "Workspaces",
			description: "Workspaces with a version difference against the target branch.",
		}),
		githubOnly: Schema.Number.annotate({
			title: "GitHub-only workspaces",
			description:
				"Workspaces that resolved no publish target — versioned, tagged and released, publishing to no registry. Zero builds is their steady state, not a failure.",
		}),
		githubWithPackages: Schema.Number.annotate({
			title: "Registry-publishing workspaces",
			description: "Workspaces that resolved at least one publish target.",
		}),
		checksPassed: Schema.Number.annotate({ title: "Checks passed", description: "Validation checks that succeeded." }),
		checksFailed: Schema.Number.annotate({ title: "Checks failed", description: "Validation checks that failed." }),
		errorFindings: Schema.Number.annotate({
			title: "Error findings",
			description: "Findings of `error` severity. Any of these makes `success` false.",
		}),
		warningFindings: Schema.Number.annotate({
			title: "Warning findings",
			description:
				"Findings of `warning` severity. These do NOT make `success` false unless the run set `strict-warnings`.",
		}),
	}).annotate({
		identifier: "ValidationTotals",
		title: "Totals",
		description: "Aggregate counts, so a consumer does not have to reduce the package, check and finding arrays.",
	}),
	validation: ValidationPayload,
}).annotate({
	identifier: "ValidationOutput",
	title: "Validation output (Phase 2)",
	description:
		"The structured `result` output emitted when the action runs in the validation phase (Phase 2). Triggered by a push to the release branch; runs build validation, publish dry-runs, release-notes extraction, and emits the unified Release Validation Summary check-run.",
	examples: [
		{
			$schema: SCHEMA_URL,
			schemaVersion: SCHEMA_VERSION,
			phase: "validation",
			success: true,
			outcome: "validated",
			summary: "1 workspace validated · builds passed · 0 error findings",
			failure: null,
			totals: {
				workspaces: 1,
				githubOnly: 0,
				githubWithPackages: 1,
				checksPassed: 5,
				checksFailed: 0,
				errorFindings: 0,
				warningFindings: 0,
			},
			dryRun: false,
			validation: {
				buildValidation: { passed: true, packageCount: 1 },
				checks: [
					{ name: "Build Validation", status: "pass", outcome: "1/1 package(s) built", url: null },
					{
						name: "Link Issues",
						status: "pass",
						outcome: "Linked 2 issue(s)",
						url: "https://github.com/savvy-web/example-repo/runs/123",
					},
					{
						name: "Publish Validation",
						status: "pass",
						outcome: "2/2 target(s) ready",
						url: "https://github.com/savvy-web/example-repo/runs/123",
					},
					{
						name: "Release Notes Preview",
						status: "pass",
						outcome: "Found release notes for 1 package(s)",
						url: "https://github.com/savvy-web/example-repo/runs/123",
					},
					{
						name: "SBOM Preview",
						status: "pass",
						outcome: "1/1 SBOM(s) NTIA-compliant",
						url: "https://github.com/savvy-web/example-repo/runs/123",
					},
				],
				findings: [],
				publish: {
					npmReady: true,
					githubPackagesReady: true,
					totalTargets: 2,
					readyTargets: 2,
					packages: [
						{
							name: "@savvy-web/example",
							version: "1.2.0",
							baseVersion: "1.1.0",
							bumpType: "minor",
							changesetCount: 1,
							ready: true,
							versionOnly: false,
							builds: [
								{
									directory: "dist/npm",
									packedBytes: 716,
									unpackedBytes: 2300,
									fileCount: 5,
									sbom: {
										componentCount: 3,
										ntiaCompliant: true,
										missingNtiaFields: [],
									},
									targets: [
										{
											registry: "https://registry.npmjs.org/",
											status: "ready",
											access: "public",
											provenance: true,
										},
										{
											registry: "https://npm.pkg.github.com/",
											status: "ready",
											access: "public",
											provenance: false,
										},
									],
								},
							],
							releaseNotes: {
								status: "found",
								content: "### Minor Changes\n\n- Added the springLaunch API.",
							},
						},
					],
				},
				checkRun: {
					url: "https://github.com/savvy-web/example-repo/runs/124",
					conclusion: "success",
				},
			},
		},
	],
});
export type ValidationOutput = Schema.Schema.Type<typeof ValidationOutput>;

// --- publishing phase ----------------------------------------------------

/**
 * Per-target digest pair recorded when the orchestrator made a recovery
 * decision against the target's registry. Carries the local pack digest
 * and the digest the registry already has so consumers can render
 * "recovered after partial publish" without re-deriving the state.
 */

// --- Phase 3 (publish) — schema v2 ------------------------------------------
//
// The unit this phase acts on is a WORKSPACE, not a package. A workspace is
// the thing a changeset names, the thing that gets a version, a git tag and a
// GitHub release. Some workspaces additionally publish one or more *packages*
// to one or more registries; some publish none at all. Modelling packages as
// the top level could not express either end of that: a private tracking
// workspace has no package, and one workspace can publish the same version
// under several names to several registries.
//
// Two orthogonal fields describe every outcome, at every level:
//   `success` — the boolean gate. Did this work?
//   `outcome` — the taxonomy. WHAT happened, specifically?
// A recovered publish and a fresh upload are both `success: true` and are
// told apart by `outcome`. Keeping them separate means a consumer filtering
// on `success` keeps working when a new `outcome` member is added.

/** How a registry is classified. */
const PublishRegistry = Schema.Struct({
	name: Schema.String.annotate({
		title: "Registry display name",
		description: "Human-readable registry name, e.g. `npm`, `GitHub Packages`, or the host of a custom registry.",
		examples: ["npm", "GitHub Packages", "JSR"],
	}),
	type: Schema.Literals(["npm", "github-packages", "jsr", "custom"]).annotate({
		title: "Registry type",
		description:
			"`npm` — the public npm registry; `github-packages` — GitHub Packages; `jsr` — the JSR registry; `custom` — any other registry configured through the `custom-registries` input. A custom registry usually speaks the npm protocol, but is reported as `custom` rather than `npm` so it is never mistaken for the public registry.",
	}),
	url: Schema.String.annotate({
		title: "Registry URL",
		description: "The registry endpoint this package was published to.",
		examples: ["https://registry.npmjs.org/", "https://npm.pkg.github.com/"],
	}),
}).annotate({
	identifier: "PublishRegistry",
	title: "Registry",
	description: "The registry a package was published to, classified and named.",
});

const PublishRecoveryDigests = Schema.Struct({
	localDigest: Schema.String.annotate({
		title: "Local digest",
		description:
			"Integrity digest of the locally-packed tarball, in npm's `dist.integrity` format (`sha512-<base64>`) — what this run would have uploaded.",
	}),
	remoteDigest: Schema.String.annotate({
		title: "Remote digest",
		description:
			"Integrity digest the registry already had on file for this version, in npm's `dist.integrity` format. Equal to `localDigest` on a `recovered` outcome; different on a digest-mismatch `failed` outcome.",
	}),
}).annotate({
	identifier: "PublishRecoveryDigests",
	title: "Recovery digest pair",
	description:
		"The digest comparison behind a recovery decision. Present when the orchestrator probed the registry — on `recovered` and on a digest-mismatch `failed`; null when the publish went straight to upload.",
});

/** One package, published (or not) to one registry. */
const PublishedPackage = Schema.Struct({
	name: Schema.String.annotate({
		title: "Published package name",
		description:
			"The package name as published. This is the name on the tarball, which is NOT necessarily the workspace's own name — a workspace may publish under a different name per target.",
	}),
	version: Schema.String.annotate({
		title: "Published version",
		description: "The semver version published to this registry.",
	}),
	success: Schema.Boolean.annotate({
		title: "Succeeded",
		description:
			"True when this version is on this registry as a result of this run — whether newly uploaded (`published`) or confirmed already present at an identical digest (`recovered`). False for `failed` and `blocked`.",
	}),
	outcome: Schema.Literals(["published", "recovered", "failed", "blocked"]).annotate({
		identifier: "PublishedPackageOutcome",
		title: "Package outcome",
		description:
			"`published` — new bytes were uploaded to this registry; `recovered` — the version was already present with an identical tarball digest, so nothing was re-uploaded and the run treated it as done; `failed` — the upload was attempted and did not land (see `error`); `blocked` — the upload was never attempted because the phase aborted first (see the phase-level `failure`).",
	}),
	registry: PublishRegistry,
	url: Schema.NullOr(
		Schema.String.annotate({
			title: "Package URL",
			description: "Web URL of the published package version. Null when the registry exposes no such page.",
		}),
	),
	error: Schema.NullOr(
		Schema.String.annotate({
			title: "Error message",
			description: "Why the publish failed. Non-null only when `outcome` is `failed`.",
		}),
	),
	recovery: Schema.NullOr(PublishRecoveryDigests).annotate({
		title: "Recovery digests",
		description: "The digest pair behind a `recovered` outcome or a digest-mismatch `failed`. Null otherwise.",
	}),
	tarballDigest: Schema.NullOr(
		Schema.String.annotate({
			title: "Tarball digest",
			description: "Integrity hash of the published tarball as `sha512-<base64>`. Null when nothing was uploaded.",
			examples: ["sha512-Vb1g8tXp4l8a9bC..."],
		}),
	),
	attestations: Schema.Struct({
		provenanceUrl: Schema.NullOr(Schema.String).annotate({
			title: "Provenance attestation URL",
			description: "The npm OIDC sigstore provenance attestation. Null when none was emitted.",
		}),
		sbomUrl: Schema.NullOr(Schema.String).annotate({
			title: "SBOM attestation URL",
			description: "The CycloneDX SBOM attestation. Null when none was emitted.",
		}),
		githubAttestationUrl: Schema.NullOr(Schema.String).annotate({
			title: "GitHub attestation URL",
			description: "The GitHub artifact-attestation (`gh attestation verify`). Null when none was emitted.",
		}),
		provenanceRecovered: Schema.NullOr(Schema.Boolean).annotate({
			title: "Provenance attestation recovered",
			description:
				"True when a provenance attestation already existed for this tarball's sha256 and was reused. False when one was written this run. Null when no attestation step ran.",
		}),
		sbomRecovered: Schema.NullOr(Schema.Boolean).annotate({
			title: "SBOM attestation recovered",
			description:
				"True when an SBOM attestation already existed for this tarball's sha256 and was reused. False when one was written this run. Null when no SBOM attestation ran.",
		}),
	}).annotate({
		identifier: "PublishedPackageAttestations",
		title: "Attestations",
		description: "Supply-chain anchors over this published tarball.",
	}),
}).annotate({
	identifier: "PublishedPackage",
	title: "Published package",
	description:
		"One package published to one registry. A workspace publishing the same version to three registries produces three entries here, and they may not all share a name.",
});

const PublishReleaseAsset = Schema.Struct({
	name: Schema.String.annotate({ title: "Asset name", description: "File name of the release asset." }),
	url: Schema.String.annotate({ title: "Download URL", description: "Browser download URL for the asset." }),
	size: Schema.Number.annotate({ title: "Size", description: "Asset size in bytes." }),
}).annotate({
	identifier: "PublishReleaseAsset",
	title: "Release asset",
	description: "A file attached to the GitHub release — a tarball, an SBOM, or an API report.",
});

const PublishTag = Schema.Struct({
	name: Schema.String.annotate({
		title: "Tag name",
		description: "The git tag created for this workspace.",
		examples: ["@effected/claude-code-plugin@0.14.0", "v1.2.0"],
	}),
	sha: Schema.String.annotate({
		title: "Tag SHA",
		description:
			"Commit SHA the tag points at. Empty string when the tag exists but the local clone could not resolve it — never null, so a consumer reading `.tag.sha` always gets a string.",
	}),
}).annotate({
	identifier: "PublishTag",
	title: "Git tag",
	description: "The git tag cut for a workspace's release.",
});

const PublishRelease = Schema.Struct({
	id: Schema.Number.annotate({ title: "Release ID", description: "GitHub's numeric release id." }),
	url: Schema.String.annotate({ title: "Release URL", description: "Web URL of the GitHub release." }),
	assets: Schema.Array(PublishReleaseAsset).annotate({
		title: "Release assets",
		description: "Files attached to the release. Empty array when none were uploaded — never null.",
	}),
}).annotate({
	identifier: "PublishRelease",
	title: "GitHub release",
	description:
		"The GitHub release created for a workspace. The git tag is a SIBLING of this object, not a child: tags and releases are created by separate operations, so a tag can exist while release creation failed. Nesting the tag here would lose it in exactly that case.",
});

/** One workspace's release. */
const PublishWorkspace = Schema.Struct({
	version: Schema.String.annotate({
		title: "Released version",
		description: "The version this workspace was bumped to and released at.",
	}),
	kind: Schema.Literals(["github-only", "github-with-packages"]).annotate({
		identifier: "PublishWorkspaceKind",
		title: "Workspace kind",
		description:
			"What this workspace is *designed* to do, resolved before any publishing is attempted so it stays meaningful on an aborted run. `github-only` — it publishes to no registry; its release is a version bump, a git tag and a GitHub release. This is the steady state for a private tracking workspace and is NOT a degraded `github-with-packages`. `github-with-packages` — it resolved at least one publish target and is expected to put packages on a registry.",
	}),
	success: Schema.Boolean.annotate({
		title: "Succeeded",
		description:
			"True when this workspace's release completed as intended — every package that should have landed did (whether uploaded or recovered), and the tag and GitHub release were created. False for `partial`, `failed` and `blocked`.",
	}),
	outcome: Schema.Literals(["released", "published", "recovered", "partial", "failed", "blocked"]).annotate({
		identifier: "PublishWorkspaceOutcome",
		title: "Workspace outcome",
		description:
			"`released` — a `github-only` workspace was tagged and released; nothing was uploaded because nothing was meant to be. `published` — every package landed on its registry. `recovered` — every package was already present at an identical digest, so nothing was re-uploaded. `partial` — some packages landed and at least one failed. `failed` — the workspace was attempted and nothing landed. `blocked` — the workspace was never attempted because the phase aborted first; see the phase-level `failure`.",
	}),
	summary: Schema.String.annotate({
		title: "Summary",
		description:
			"One human-readable sentence describing this workspace's release. Derived from the structured fields on this object and never authored independently, so it cannot drift from them.",
		examples: ["Tagged and released on GitHub; no registry target."],
	}),
	packages: Schema.Array(PublishedPackage).annotate({
		title: "Published packages",
		description:
			"One entry per (package, registry) publication. Always an empty array — never null — for a `github-only` workspace, and for any workspace whose publishing never ran.",
	}),
	tag: Schema.NullOr(PublishTag).annotate({
		title: "Git tag",
		description:
			"The git tag cut for this workspace. Null when no tag was created — the phase aborted before tagging, or tag creation itself failed. Deliberately a sibling of `release` rather than nested inside it: tagging and release creation are separate steps, and a tag can land while the release does not.",
	}),
	release: Schema.NullOr(PublishRelease).annotate({
		title: "GitHub release",
		description:
			"The GitHub release created for this workspace. Null when none was created — either the phase aborted before releases ran (`outcome: blocked`) or release creation itself failed. Null therefore means *not present*, distinct from an empty `packages` array which means *none were meant to exist*.",
	}),
}).annotate({
	identifier: "PublishWorkspace",
	title: "Workspace release",
	description:
		"Everything that happened to one workspace: what it is, whether it worked, the packages it put on registries, and the GitHub release it produced.",
});

const PublishFailure = Schema.Struct({
	stage: Schema.Literals(["detect", "build", "sbom", "publish", "tags", "releases", "linked-issues"]).annotate({
		identifier: "PublishFailureStage",
		title: "Failure stage",
		description:
			"WHEN the phase stopped or degraded, named by the step that failed. `detect` — released packages could not be determined; `build` — the `ci:build` gate failed, so nothing was packed; `sbom` — an SBOM could not be written (non-fatal; the release loses an asset); `publish` — at least one registry upload failed; `tags` — a git tag could not be created; `releases` — a GitHub release could not be created or updated; `linked-issues` — the post-release issue housekeeping failed. `build` and `detect` abort before any workspace is attempted, so every workspace is `blocked`.",
	}),
	reason: Schema.String.annotate({
		title: "Failure reason",
		description:
			"WHAT went wrong, as a single-line summary. For `build` this is the compiler or task diagnostic; the full transcript is in the job log, not here.",
	}),
	blockedWorkspaces: Schema.Array(Schema.String).annotate({
		title: "Blocked workspaces",
		description:
			"Names of workspaces that were never attempted because of this failure — the same set that carry `outcome: blocked`. Empty array when the failure happened after every workspace had been attempted.",
	}),
}).annotate({
	identifier: "PublishFailure",
	title: "Failure",
	description:
		"Why the phase did not complete cleanly, and where it stopped. Null on a clean run. This is the only place the abort reason appears — it is not duplicated onto individual workspaces, which report only that they were `blocked`.",
});

const PublishTotals = Schema.Struct({
	workspaces: Schema.Number.annotate({
		title: "Workspaces",
		description: "Total workspaces released this run. Zero only when the run had nothing to release.",
	}),
	githubOnly: Schema.Number.annotate({
		title: "GitHub-only workspaces",
		description: "Workspaces of kind `github-only` — tagged and released, publishing to no registry.",
	}),
	githubWithPackages: Schema.Number.annotate({
		title: "Registry-publishing workspaces",
		description: "Workspaces of kind `github-with-packages` — those that resolved at least one publish target.",
	}),
	blocked: Schema.Number.annotate({
		title: "Blocked workspaces",
		description: "Workspaces never attempted because the phase aborted. Zero on a clean run.",
	}),
	packagesResolved: Schema.Number.annotate({
		title: "Packages resolved",
		description:
			"Package publications that were *intended* — one per (package, registry) pair resolved before publishing began. Compare with `packagesPublished` to see how much of the intent was realised.",
	}),
	packagesPublished: Schema.Number.annotate({
		title: "Packages published",
		description: "Publications whose bytes were newly uploaded this run.",
	}),
	packagesRecovered: Schema.Number.annotate({
		title: "Packages recovered",
		description: "Publications already present at an identical digest, so nothing was re-uploaded.",
	}),
	packagesFailed: Schema.Number.annotate({
		title: "Packages failed",
		description: "Publications that were attempted and did not land.",
	}),
	tagsCreated: Schema.Number.annotate({ title: "Tags created", description: "Git tags cut this run." }),
	releasesCreated: Schema.Number.annotate({
		title: "Releases created",
		description: "GitHub releases created this run.",
	}),
}).annotate({
	identifier: "PublishTotals",
	title: "Totals",
	description:
		"Aggregate counts, so no consumer has to reduce the workspace map to answer a question about scale. Every number here is derivable from `publish.workspaces`; it is duplicated deliberately.",
});

const PublishPayload = Schema.Struct({
	order: Schema.Array(Schema.String).annotate({
		title: "Publish order",
		description:
			"Workspace names in the dependency-first order they were processed. A JSON object has no guaranteed key order, so this preserves the topological sequence that `workspaces` alone would lose.",
	}),
	workspaces: Schema.Record(Schema.String, PublishWorkspace).annotate({
		title: "Workspaces",
		description:
			"Every workspace in this release, keyed by workspace name — so a consumer looks one up directly rather than scanning an array. Populated even on an aborted run, where entries carry `outcome: blocked`.",
	}),
}).annotate({
	identifier: "PublishPayload",
	title: "Publish payload",
	description: "The per-workspace detail of the publish phase.",
});

/** The Phase 3 (publish) output. */
export const PublishOutput = Schema.Struct({
	$schema: annotatedSchemaUrlField,
	schemaVersion: annotatedSchemaVersionField,
	phase: Schema.Literal("publish").annotate({
		title: "Phase discriminator",
		description: "`publish` identifies this as a Phase 3 output.",
	}),
	success: Schema.Boolean.annotate({
		title: "Succeeded",
		description:
			"The one boolean a consumer should gate on. True when the phase completed with nothing failed — including a run that had nothing to release, and a run whose every workspace was `github-only`. False when anything failed or the phase aborted. Read `outcome` for what specifically happened.",
	}),
	outcome: Schema.Literals(["released", "nothing-to-release", "partial", "failed", "blocked"]).annotate({
		identifier: "PublishOutcome",
		title: "Phase outcome",
		description:
			"`released` — every workspace completed. `nothing-to-release` — no workspace had a version difference against the target branch; the only genuinely empty run, and a SUCCESS, because nothing failed. `partial` — some workspaces completed and at least one did not. `failed` — workspaces were attempted and none completed. `blocked` — the phase aborted before any workspace was attempted; see `failure` for the stage and reason.",
	}),
	summary: Schema.String.annotate({
		title: "Summary",
		description:
			"One human-readable sentence describing the whole run. Derived from `totals` and never authored independently, so it always agrees with the structured counts.",
		examples: ["2 workspaces versioned · 0 packages published to a registry · 2 GitHub releases created"],
	}),
	dryRun: annotatedDryRunField,
	failure: Schema.NullOr(PublishFailure).annotate({
		title: "Failure",
		description: "Why and where the phase failed. Null when `success` is true.",
	}),
	totals: PublishTotals,
	publish: PublishPayload,
}).annotate({
	identifier: "PublishOutput",
	title: "Publish output (Phase 3)",
	description:
		"The structured `result` output emitted when the action runs in the publish phase (Phase 3). Triggered by the merge of the release PR; publishes each workspace's packages to every configured registry, generates SBOM and provenance attestations, and creates git tags and GitHub releases.",
});

/** The Phase 3 (publish) output type. */
export type PublishOutput = Schema.Schema.Type<typeof PublishOutput>;

// --- the union -----------------------------------------------------------

/** The phase-discriminated release output contract. */
export const ReleaseOutput = Schema.Union([BranchManagementOutput, ValidationOutput, PublishOutput]).annotate({
	identifier: "ReleaseOutput",
	title: "Silk Release Action output",
	description:
		'The phase-discriminated release output contract. Use `phase` to discriminate to the right variant. Four orthogonal state signals (`status`, `noop`, `succeeded`, `hasFailures`) are derived from the same underlying outcome and obey a fixed relationship: `noop` is true when the phase had nothing to do (no changesets, no release-branch updates pending, or no publish targets resolved) — in this case `succeeded` is true and `hasFailures` is false; `status` is `"no-op"`. When the phase produced its intended work without errors, `noop` is false, `succeeded` is true, `hasFailures` is false, and `status` is `"success"`. When the phase produced any failure, `noop` is false, `succeeded` is false, `hasFailures` is true, and `status` is `"partial"`. The `status` value `"failed"` is reserved for an impossible flag combination and is never emitted by the current projections; treat `"partial"` as the canonical failure label. `status` is a coarse label for logs and summaries; the three booleans are the machine contract. Every variant carries the same shared top-level fields (`$schema`, `schemaVersion`, `phase`, `status`, `noop`, `succeeded`, `hasFailures`, `dryRun`) plus a phase-specific payload.',
});
export type ReleaseOutput = Schema.Schema.Type<typeof ReleaseOutput>;
