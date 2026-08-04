#!/usr/bin/env node
const process = require("node:process");
const { readdir, stat } = require("node:fs/promises");
const { resolve } = require("node:path");

async function main() {
	const distDir = resolve(process.cwd(), "dist");
	const entryPoint = resolve(distDir, "index.js");
	try {
		await stat(entryPoint);
	} catch {
		console.warn(
			`[@heossihq/liboqs-native] Warning: no compiled bindings found at ${entryPoint}. Build the native module before publishing or running PQC smoke probes. See docs/guides/liboqs-native-build.md for instructions.`,
		);
		return;
	}

	const prebuildsDir = resolve(process.cwd(), "prebuilds");
	try {
		const contents = await readdir(prebuildsDir, { withFileTypes: true });
		const hasPrebuild = contents.some((entry) => entry.isDirectory() && entry.name !== ".gitkeep");
		if (!hasPrebuild) {
			console.warn(
				"[@heossihq/liboqs-native] Warning: no prebuilt binaries detected in prebuilds/. " +
					"Consumers will fall back to local compilation. " +
					"Run `pnpm --filter @heossihq/liboqs-native build:native` on each target platform " +
					"or configure the CI workflow to publish prebuild artifacts.",
			);
		}
	} catch {
		console.warn(
			"[@heossihq/liboqs-native] Warning: unable to inspect prebuilds/ directory. " +
				"Ensure prebuild assets are generated before publishing.",
		);
	}
}

void main();
