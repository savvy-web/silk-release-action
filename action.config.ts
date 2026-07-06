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
		// workspaces-effect's pnpm config-dependency hook loader has the same
		// runtime-path dynamic-import pattern.
		nativeDynamicImports: ["@changesets/apply-release-plan", "workspaces-effect"],
		// `@cyclonedx/cyclonedx-library` ships optional plugins (XML
		// serializers, XML validators, draft-2019 JSON validators) we
		// never invoke — we only use the JSON serializer. They aren't
		// installed and would never be present in the deployed action,
		// so `ignore` (alias to a throwing stub) is correct here, not
		// `externals` (which means "available at runtime"). cyclonedx's
		// `_optPlug` wrapper try/catches the stub throw and falls
		// through gracefully.
		ignore: ["xmlbuilder2", "libxmljs2", "ajv-formats-draft2019"],
	},
	persistLocal: {
		enabled: true,
		path: ".github/actions/local",
	},
});
