// Unit tests for tarMetaFolder — the meta bundle archiver.

import type { SpawnRecord } from "@effected/commands";
import { ScriptedSpawner } from "@effected/commands";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { tarMetaFolder } from "../../../src/release/meta-archive.js";

const run = async (exit = 0): Promise<{ spawns: ReadonlyArray<SpawnRecord>; failed: boolean }> => {
	const spawner = ScriptedSpawner.make((command) =>
		command === "tar"
			? { exit, stdout: "", stderr: exit === 0 ? "" : "tar: no such file" }
			: ScriptedSpawner.notFound(command),
	);
	const result = await Effect.runPromise(
		Effect.result(
			tarMetaFolder("/repo/pkg/dist/prod/npm/meta", "/tmp/out.meta.tgz").pipe(Effect.provide(spawner.layer)),
		),
	);
	return { spawns: spawner.spawns, failed: result._tag === "Failure" };
};

describe("tarMetaFolder", () => {
	it("invokes tar -czf with the meta folder as the archive root", async () => {
		const { spawns, failed } = await run();

		expect(failed).toBe(false);
		expect(spawns).toHaveLength(1);
		expect(spawns[0]?.command).toBe("tar");
		// `-C <parent> <basename>` is what keeps the archive root the folder name
		// rather than the absolute path.
		expect(spawns[0]?.args).toEqual(["-czf", "/tmp/out.meta.tgz", "-C", "/repo/pkg/dist/prod/npm", "meta"]);
	});

	it("fails when tar exits non-zero", async () => {
		// `Run.text`, not `Run.collect`: producing the tarball is a precondition
		// for uploading it as a release asset, so a non-zero exit must reach the
		// caller as a typed failure rather than as a value it could overlook.
		// The predecessor's `execCapture` had the same semantics.
		const { failed } = await run(2);

		expect(failed).toBe(true);
	});
});
