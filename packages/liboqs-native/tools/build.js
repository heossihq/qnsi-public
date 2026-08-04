#!/usr/bin/env node
const { access } = require("node:fs/promises");
const { spawn } = require("node:child_process");
const { dirname, resolve } = require("node:path");

function resolveIncludePath() {
	return process.env.OQS_INCLUDE_PATH;
}

function resolveLibraryPath() {
	return process.env.OQS_LIB_PATH;
}

async function fileExists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function ensureNativePrerequisites() {
	let includeRoot = resolveIncludePath();
	let libraryRoot = resolveLibraryPath();

	// If not set, check default paths relative to monorepo root
	if (
		!includeRoot ||
		includeRoot.trim().length === 0 ||
		!libraryRoot ||
		libraryRoot.trim().length === 0
	) {
		const monorepoRoot = resolve(__dirname, "..", "..", "..");
		const defaultInclude = resolve(monorepoRoot, "tooling/liboqs-src/build/include");
		const defaultLib = resolve(monorepoRoot, "tooling/liboqs-src/build/lib");

		if (await fileExists(resolve(defaultInclude, "oqs/oqs.h"))) {
			includeRoot = defaultInclude;
		}
		if (await fileExists(resolve(defaultLib, "liboqs.a"))) {
			libraryRoot = defaultLib;
		}
	}

	if (!includeRoot || includeRoot.trim().length === 0) {
		console.warn(
			"[@heossihq/liboqs-native] OQS_INCLUDE_PATH is not set. Skipping prebuild generation.",
		);
		return { found: false };
	}

	if (!libraryRoot || libraryRoot.trim().length === 0) {
		console.warn(
			"[@heossihq/liboqs-native] OQS_LIB_PATH is not set. Skipping prebuild generation.",
		);
		return { found: false };
	}

	const headerPath = resolve(includeRoot, "oqs/oqs.h");
	const libraryPath = resolve(libraryRoot, "liboqs.a");

	if (!(await fileExists(headerPath))) {
		console.warn(
			`[@heossihq/liboqs-native] Missing liboqs header at ${headerPath}. Set OQS_INCLUDE_PATH to a liboqs build directory to enable native compilation.`,
		);
		return { found: false };
	}

	if (!(await fileExists(libraryPath))) {
		console.warn(
			`[@heossihq/liboqs-native] Missing liboqs static library at ${libraryPath}. Set OQS_LIB_PATH to a liboqs build directory to enable native compilation.`,
		);
		return { found: false };
	}

	return { found: true, includeRoot, libraryRoot };
}

async function run() {
	const prerequisites = await ensureNativePrerequisites();
	if (!prerequisites.found) {
		console.warn(
			"[@heossihq/liboqs-native] Native toolchain prerequisites unavailable. " +
				"Continuing without generating prebuilt binaries.",
		);
		return;
	}

	const { includeRoot, libraryRoot } = prerequisites;
	const nodeVersion = process.versions.node;
	const nodeTargetArg = `node@${nodeVersion}`;
	const nodeRootDir = resolve(dirname(process.execPath), "..");
	const pathKeyShimPath = resolve(__dirname, "..", "vendor", "path-key-shim.js");
	const nodeOptions = [process.env.NODE_OPTIONS, `--require ${pathKeyShimPath}`]
		.filter((entry) => entry !== undefined && entry !== "")
		.join(" ");
	const prebuildArgs = ["--napi", "--strip", "--tag-libc", "--target", nodeTargetArg];

	await new Promise((resolvePromise, rejectPromise) => {
		const task = spawn("prebuildify", prebuildArgs, {
			stdio: "inherit",
			env: {
				...process.env,
				...(nodeOptions.length > 0 ? { NODE_OPTIONS: nodeOptions } : {}),
				npm_config_nodedir: process.env.npm_config_nodedir ?? nodeRootDir,
				OQS_INCLUDE_PATH: includeRoot,
				OQS_LIB_PATH: libraryRoot,
			},
		});

		task.on("exit", (code) => {
			if (code === 0) {
				resolvePromise();
			} else {
				rejectPromise(new Error(`prebuildify exited with code ${code ?? "unknown"}`));
			}
		});

		task.on("error", (error) => rejectPromise(error));
	});
}

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
