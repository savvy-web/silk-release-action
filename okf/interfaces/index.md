# Interface

* [Action inputs and outputs](action-inputs.md) - The \`action.yml\` inputs a workflow author sets and the outputs a workflow reads, decoded exactly once on each side.
* [Release PR surfaces](release-pr-surfaces.md) - The two managed regions a reader of the release PR relies on: the PR description's marker-delimited region, and the sticky comment's independently-stamped sections.
* [SBOM configuration](sbom-config.md) - The layered \`sbom-config\` contract Phase 2 reads to fill in SBOM supplier, author, and copyright metadata, and the NTIA compliance it enables.
* [The \`result\` output document](release-output.md) - The phase-discriminated JSON document the action emits as the \`result\` output, and the version contract it carries.
