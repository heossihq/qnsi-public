import * as esbuild from "esbuild";

// Bundle the @vscode/test-electron in-host test suite to a single CJS module that exports run().
await esbuild.build({
	entryPoints: ["test/suite/index.ts"],
	bundle: true,
	outfile: "dist/test/suite/index.cjs",
	format: "cjs",
	platform: "node",
	target: "node20",
	external: ["vscode"],
	sourcemap: false,
	logLevel: "info",
});
console.log("[esbuild] test suite bundled → dist/test/suite/index.cjs");
