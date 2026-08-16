import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createModelPackageManifest } from "./packaging.js";

let workspace: string;

beforeAll(async () => {
	workspace = await mkdtemp(join(tmpdir(), "qnsp-model-arms-"));
	await writeFile(join(workspace, "single.bin"), "solo");
});

afterAll(async () => {
	await rm(workspace, { recursive: true, force: true });
});

describe("createModelPackageManifest arms", () => {
	it("packages a single file source relative to its parent directory", async () => {
		const manifest = await createModelPackageManifest({
			modelName: "solo",
			version: "1.0.0",
			sourcePath: join(workspace, "single.bin"),
		});
		expect(manifest.files).toHaveLength(1);
		expect(manifest.files[0]?.path).toBe("single.bin");
		expect(manifest.metadata).toEqual({});
	});

	it("skips filesystem entries that are neither files nor directories", async () => {
		const fifoPath = join(workspace, "stream.fifo");
		execFileSync("mkfifo", [fifoPath]);
		try {
			const manifest = await createModelPackageManifest({
				modelName: "mixed",
				version: "1.0.0",
				sourcePath: workspace,
			});
			expect(manifest.files.map((f) => basename(f.path))).toEqual(["single.bin"]);
		} finally {
			await rm(fifoPath, { force: true });
		}
	});
});
