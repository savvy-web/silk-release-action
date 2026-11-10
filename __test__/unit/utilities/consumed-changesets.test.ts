import { describe, expect, it } from "@effect/vitest";
import { MemoryFileSystem } from "@effected/memfs";
import { Effect, Layer, Path } from "effect";
import {
	ConsumedChangesetError,
	leftoverConsumedChangesets,
	verifyConsumedChangesetsRemoved,
} from "../../../src/utils/consumed-changesets.js";

const changeset = (file: string, releases: Record<string, string>) => ({
	file,
	releases: new Map(Object.entries(releases)),
});

const volume = (files: Record<string, string>) => Layer.merge(MemoryFileSystem.layerWith(files), Path.layer);

const md = (releases: Record<string, string>): string =>
	`---\n${Object.entries(releases)
		.map(([name, type]) => `"${name}": ${type}`)
		.join("\n")}\n---\n\nSummary.\n`;

describe("leftoverConsumedChangesets", () => {
	it("reports a changeset still on disk that names a released package", () => {
		expect(leftoverConsumedChangesets([changeset("a.md", { "@x/s3": "minor" })], ["@x/s3"])).toEqual(["a.md"]);
	});

	it("reports a mixed changeset whose other package was not released", () => {
		const mixed = changeset("mixed.md", { "@x/s3": "minor", "@x/private": "patch" });
		expect(leftoverConsumedChangesets([mixed], ["@x/s3"])).toEqual(["mixed.md"]);
	});

	it("ignores a changeset that names only unreleased packages", () => {
		expect(leftoverConsumedChangesets([changeset("b.md", { "@x/other": "patch" })], ["@x/s3"])).toEqual([]);
	});

	it("ignores a released package the changeset bumps as none", () => {
		expect(leftoverConsumedChangesets([changeset("c.md", { "@x/s3": "none" })], ["@x/s3"])).toEqual([]);
	});

	it("ignores changesets a pre-release moved under pre/", () => {
		expect(leftoverConsumedChangesets([changeset("pre/d.md", { "@x/s3": "minor" })], ["@x/s3"])).toEqual([]);
	});
});

describe("verifyConsumedChangesetsRemoved", () => {
	it.effect("fails with the leftover file named when a consumed changeset is still on disk", () =>
		Effect.gen(function* () {
			const error = yield* verifyConsumedChangesetsRemoved("/repo", ["@x/s3"]).pipe(
				Effect.flip,
				Effect.provide(
					volume({
						"/repo/.changeset/small-buckets-store.md": md({ "@x/s3": "minor" }),
						"/repo/.changeset/README.md": "# Changesets\n",
						"/repo/.changeset/config.json": "{}",
					}),
				),
			);
			expect(error).toBeInstanceOf(ConsumedChangesetError);
			expect(error.reason).toBe("leftover");
			expect(error.files).toEqual(["small-buckets-store.md"]);
			expect(error.message).toMatch(/small-buckets-store\.md/);
		}),
	);

	it.effect("passes when every changeset naming a released package is gone", () =>
		Effect.gen(function* () {
			yield* verifyConsumedChangesetsRemoved("/repo", ["@x/s3"]).pipe(
				Effect.provide(
					volume({
						"/repo/.changeset/later.md": md({ "@x/other": "patch" }),
						"/repo/.changeset/pre/moved.md": md({ "@x/s3": "minor" }),
					}),
				),
			);
		}),
	);

	it.effect("passes when there is no .changeset directory", () =>
		Effect.gen(function* () {
			yield* verifyConsumedChangesetsRemoved("/repo", ["@x/s3"]).pipe(
				Effect.provide(volume({ "/repo/package.json": "{}" })),
			);
		}),
	);

	it.effect("skips the read entirely when nothing was released", () =>
		Effect.gen(function* () {
			// A leftover-shaped file is present, but with no releases there is
			// nothing it could re-release; the guard must not fail.
			yield* verifyConsumedChangesetsRemoved("/repo", []).pipe(
				Effect.provide(volume({ "/repo/.changeset/a.md": md({ "@x/s3": "minor" }) })),
			);
		}),
	);
});
