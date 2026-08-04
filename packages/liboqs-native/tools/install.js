#!/usr/bin/env node
const { access } = require("node:fs/promises");
const { spawn } = require("node:child_process");
const { resolve } = require("node:path");

async function fileExists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function checkPrebuiltBinary() {
	try {
		const prebuildsPath = resolve(__dirname, "..", "prebuilds");
		const { readdir } = require("node:fs/promises");
		const entries = await readdir(prebuildsPath, { withFileTypes: true });
		const hasPrebuild = entries.some((entry) => entry.isDirectory() && entry.name !== ".gitkeep");
		if (hasPrebuild) {
			// Also check if the actual binary exists for this platform
			const platform = process.platform;
			const arch = process.arch;
			const candidates = [
				`${platform}-${arch}`,
				`${platform}-${arch}-musl`,
				`${platform}-${arch}-gnu`,
			];
			for (const platformArch of candidates) {
				try {
					const platformDir = resolve(prebuildsPath, platformArch);
					const platformEntries = await readdir(platformDir, { withFileTypes: true });
					if (platformEntries.some((entry) => entry.isFile() && entry.name.endsWith(".node"))) {
						return true;
					}
				} catch {
					// ignore missing candidate directory
				}
			}
			return false;
		}
		return false;
	} catch {
		return false;
	}
}

async function checkNativePrerequisites() {
	// Check environment variables first
	let includeRoot = process.env.OQS_INCLUDE_PATH;
	let libraryRoot = process.env.OQS_LIB_PATH;

	// If not set, check default paths relative to monorepo root
	if (!includeRoot || !libraryRoot) {
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

	if (!includeRoot || !libraryRoot) {
		return false;
	}

	const headerPath = resolve(includeRoot, "oqs/oqs.h");
	const libraryPath = resolve(libraryRoot, "liboqs.a");

	return (await fileExists(headerPath)) && (await fileExists(libraryPath));
}

async function run() {
	// First, try to use prebuilt binary via node-gyp-build
	const hasPrebuilt = await checkPrebuiltBinary();
	if (hasPrebuilt) {
		const { spawn } = require("node:child_process");
		return new Promise((resolvePromise, rejectPromise) => {
			const task = spawn("node-gyp-build", [], {
				stdio: "inherit",
				shell: true,
			});

			task.on("exit", (code) => {
				if (code === 0) {
					resolvePromise();
				} else {
					rejectPromise(new Error(`node-gyp-build exited with code ${code ?? "unknown"}`));
				}
			});

			task.on("error", (error) => rejectPromise(error));
		});
	}

	// No prebuilt binary - check if we can build from source
	const canBuild = await checkNativePrerequisites();
	if (canBuild) {
		console.info(
			"[@heossihq/liboqs-native] Native prerequisites detected. Building from source...",
		);
		// Set environment variables for node-gyp-build if using defaults
		if (!process.env.OQS_INCLUDE_PATH || !process.env.OQS_LIB_PATH) {
			const monorepoRoot = resolve(__dirname, "..", "..", "..");
			process.env.OQS_INCLUDE_PATH =
				process.env.OQS_INCLUDE_PATH ?? resolve(monorepoRoot, "tooling/liboqs-src/build/include");
			process.env.OQS_LIB_PATH =
				process.env.OQS_LIB_PATH ?? resolve(monorepoRoot, "tooling/liboqs-src/build/lib");
		}

		return new Promise((resolvePromise, _rejectPromise) => {
			const task = spawn("node-gyp-build", [], {
				stdio: "inherit",
				shell: true,
				env: {
					...process.env,
					OQS_INCLUDE_PATH: process.env.OQS_INCLUDE_PATH,
					OQS_LIB_PATH: process.env.OQS_LIB_PATH,
				},
			});

			task.on("exit", (code) => {
				if (code === 0) {
					resolvePromise();
				} else {
					console.warn(
						`[@heossihq/liboqs-native] Build failed with code ${code ?? "unknown"}. Continuing installation - native bindings will be unavailable.`,
					);
					resolvePromise(); // Don't fail install
				}
			});

			task.on("error", (error) => {
				console.warn(
					`[@heossihq/liboqs-native] Build error: ${error.message}. Continuing installation - native bindings will be unavailable.`,
				);
				resolvePromise(); // Don't fail install
			});
		});
	}

	// No prerequisites - this is expected for most developers
	console.warn(
		"[@heossihq/liboqs-native] No prebuilt binary and native prerequisites unavailable. " +
			"This is expected if liboqs is not built. " +
			"The package will use deterministic PQC provider in tests. " +
			"To build native bindings, see docs/guides/liboqs-native-build.md",
	);
}

run().catch((error) => {
	// Don't fail install - just warn
	console.warn(`[@heossihq/liboqs-native] Install warning: ${error.message}`);
	console.warn(
		"[@heossihq/liboqs-native] Continuing installation. Native bindings will be unavailable.",
	);
});
