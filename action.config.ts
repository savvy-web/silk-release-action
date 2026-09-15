import { defineConfig } from "@savvy-web/github-action-builder";

export default defineConfig({
	entries: {
		pre: "src/pre.ts",
		main: "src/main.ts",
		post: "src/post.ts",
		workers: {
			"changelog-silk": "src/changelog/silk.ts",
			"changelog-default": "src/changelog/default.ts",
		},
	},
	build: {
		minify: true,
		// The changesets engine resolves the changelog module path at runtime and
		// dynamic-imports it; without this, rspack compiles that import into a
		// context module that throws "Cannot find module" for on-disk paths.
		// NOTE: do NOT add "@effected/workspaces" here. Its `ConfigDependencyHooks`
		// has a computed `import(candidateUrl)` that rspack flags "Critical
		// dependency: the request of a dependency is an expression." That warning is
		// benign — a structure-reading action never runs the config-dependency-hooks
		// path — and listing the package here fails the whole build with a parse
		// error in that file.
		//
		// The cause is the builder's `webpack-ignore-dynamic-imports` loader, which
		// is a regex string transform with no lexical state, so it also matches the
		// literal text `import()` written inside JSDoc prose (three times in that
		// file — it documents the very import it performs). Injecting
		// `/* webpackIgnore: true */` into a `/** ... */` block closes the doc
		// comment at the injected `*/`, spilling the rest of the comment into the
		// token stream. rspack reports it against the next statement,
		// `const hasTraversalSegment = ...` — that identifier is where the wreckage
		// lands, not what caused it.
		nativeDynamicImports: ["@changesets/apply-release-plan"],
		// Optional requires on the Azure blob path (`@effected/github-actions` →
		// `@azure/storage-blob` → `@typespec/ts-http-runtime` → proxy agents), both
		// try/catch-guarded and neither reachable on a hosted runner: `debug`'s
		// `require("supports-color")` and `proxy-agent-negotiate`'s
		// `import("kerberos")` (Negotiate proxy auth only). Alias each to a
		// throwing stub rather than bundling a dependency nothing uses.
		ignore: ["supports-color", "kerberos"],
	},
	persistLocal: {
		enabled: false,
		path: ".github/actions/local",
	},
});
