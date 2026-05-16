import { describe, expect, it } from "vitest";
import type { RawPackageJson } from "../src/utils/silk-publishability.js";
import { isSilkPublishable, silkDetect } from "../src/utils/silk-publishability.js";

describe("silk-publishability", () => {
	describe("silkDetect — public packages", () => {
		it("returns a default npm target when private is not set", () => {
			const raw: RawPackageJson = { name: "public-pkg" };
			const targets = silkDetect("public-pkg", raw);

			expect(targets).toHaveLength(1);
			expect(targets[0].name).toBe("public-pkg");
			expect(targets[0].registry).toBe("https://registry.npmjs.org/");
			expect(targets[0].access).toBe("public");
			expect(targets[0].directory).toBe(".");
		});

		it("respects publishConfig.registry/directory/access on public packages", () => {
			const raw: RawPackageJson = {
				name: "public-pkg",
				publishConfig: {
					registry: "https://npm.pkg.github.com/",
					directory: "dist/npm",
					access: "restricted",
				},
			};

			const targets = silkDetect("public-pkg", raw);

			expect(targets).toHaveLength(1);
			expect(targets[0].registry).toBe("https://npm.pkg.github.com/");
			expect(targets[0].directory).toBe("dist/npm");
			expect(targets[0].access).toBe("restricted");
		});
	});

	describe("silkDetect — private packages", () => {
		it("returns [] when private with no publishConfig", () => {
			const raw: RawPackageJson = { name: "private-pkg", private: true };

			expect(silkDetect("private-pkg", raw)).toEqual([]);
		});

		it("returns [] when private with publishConfig but no access or targets", () => {
			const raw: RawPackageJson = {
				name: "private-pkg",
				private: true,
				publishConfig: { directory: "dist/npm" },
			};

			expect(silkDetect("private-pkg", raw)).toEqual([]);
		});

		it("returns one target when private + publishConfig.access (no targets)", () => {
			const raw: RawPackageJson = {
				name: "private-pkg",
				private: true,
				publishConfig: { access: "restricted", registry: "https://registry.savvyweb.dev/" },
			};

			const targets = silkDetect("private-pkg", raw);

			expect(targets).toHaveLength(1);
			expect(targets[0].registry).toBe("https://registry.savvyweb.dev/");
			expect(targets[0].access).toBe("restricted");
		});

		it("expands string-form publishConfig.targets inheriting parent access", () => {
			const raw: RawPackageJson = {
				name: "@scope/silk",
				private: true,
				publishConfig: {
					access: "restricted",
					targets: ["npm", "github"],
				},
			};

			const targets = silkDetect("@scope/silk", raw);

			expect(targets).toHaveLength(2);
			expect(targets.every((t) => t.access === "restricted")).toBe(true);
			expect(targets[0].registry).toBe("https://registry.npmjs.org/");
			expect(targets[1].registry).toBe("https://registry.npmjs.org/");
		});

		it("uses object-form target access override", () => {
			const raw: RawPackageJson = {
				name: "private-pkg",
				private: true,
				publishConfig: {
					access: "restricted",
					targets: [
						{ access: "public", registry: "https://registry.npmjs.org/" },
						{ registry: "https://npm.pkg.github.com/" },
					],
				},
			};

			const targets = silkDetect("private-pkg", raw);

			expect(targets).toHaveLength(2);
			expect(targets[0].access).toBe("public");
			expect(targets[0].registry).toBe("https://registry.npmjs.org/");
			expect(targets[1].access).toBe("restricted");
			expect(targets[1].registry).toBe("https://npm.pkg.github.com/");
		});

		it("skips targets that resolve to no access (string target with no parent access)", () => {
			const raw: RawPackageJson = {
				name: "private-pkg",
				private: true,
				publishConfig: { targets: ["npm"] },
			};

			expect(silkDetect("private-pkg", raw)).toEqual([]);
		});

		it("falls back to publishConfig.registry when an object target omits registry", () => {
			const raw: RawPackageJson = {
				name: "private-pkg",
				private: true,
				publishConfig: {
					access: "public",
					registry: "https://registry.savvyweb.dev/",
					targets: [{}],
				},
			};

			const targets = silkDetect("private-pkg", raw);

			expect(targets).toHaveLength(1);
			expect(targets[0].registry).toBe("https://registry.savvyweb.dev/");
		});
	});

	describe("isSilkPublishable", () => {
		it("is true for public packages", () => {
			expect(isSilkPublishable("pkg", { name: "pkg" })).toBe(true);
		});

		it("is false for private packages with no publishConfig", () => {
			expect(isSilkPublishable("pkg", { name: "pkg", private: true })).toBe(false);
		});

		it("is true for private packages with publishConfig.targets", () => {
			expect(
				isSilkPublishable("pkg", {
					name: "pkg",
					private: true,
					publishConfig: { access: "restricted", targets: ["npm"] },
				}),
			).toBe(true);
		});
	});
});
