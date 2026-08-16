import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join, relative } from "node:path";

import type { ModelPackageManifest, ModelPackageManifestFile } from "./types.js";

export interface CreateModelPackageOptions {
	readonly modelName: string;
	readonly version: string;
	readonly sourcePath: string;
	readonly metadata?: Record<string, unknown>;
}

export async function createModelPackageManifest(
	options: CreateModelPackageOptions,
): Promise<ModelPackageManifest> {
	const stats = await fs.stat(options.sourcePath);
	const baseDir = stats.isDirectory() ? options.sourcePath : dirname(options.sourcePath);
	const files = await collectFiles(options.sourcePath, baseDir);

	return {
		modelName: options.modelName,
		version: options.version,
		createdAt: new Date().toISOString(),
		files,
		metadata: options.metadata ?? {},
	};
}

async function collectFiles(
	target: string,
	baseDir: string,
): Promise<ReadonlyArray<ModelPackageManifestFile>> {
	const stats = await fs.stat(target);
	if (stats.isDirectory()) {
		const entries = await fs.readdir(target);
		const nested = await Promise.all(
			entries.map((entry) => collectFiles(join(target, entry), baseDir)),
		);
		return nested.flat();
	}

	if (!stats.isFile()) {
		return [];
	}

	const contents = await fs.readFile(target);
	const hash = createHash("sha3-512").update(contents).digest("hex");
	return [
		{
			// baseDir is always a proper ancestor of target, so relative() is non-empty.
			path: relative(baseDir, target),
			sizeBytes: stats.size,
			checksumSha3_512: hash,
		},
	];
}
