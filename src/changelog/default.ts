/**
 * Bundled vanilla changesets changelog generator — the action-shipped module
 * for repos whose config names `@changesets/cli/changelog` (which upstream is
 * a re-export of `@changesets/changelog-git`).
 *
 * The implementation comes from silk-effects' `vanillaChangelogFunctions`
 * re-export rather than a direct `@changesets/changelog-git` dependency, so
 * the action carries a single changesets vendor surface — the same one that
 * backs the silk generator in `./silk.ts`.
 */

import { Changesets } from "@savvy-web/silk-effects";

export default Changesets.vanillaChangelogFunctions;
