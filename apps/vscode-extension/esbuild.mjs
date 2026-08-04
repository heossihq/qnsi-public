import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

/** @type {import("esbuild").BuildOptions} */
const options = {
	entryPoints: ["src/extension.ts"],
	bundle: true,
	outfile: "dist/extension.js",
	// VS Code's extension host loads CommonJS; bundle the ESM @heossihq/qnsi SDK into CJS.
	format: "cjs",
	platform: "node",
	target: "node20",
	sourcemap: true,
	minify: !watch,
	// `vscode` is provided by the extension host at runtime - never bundle it.
	external: ["vscode"],
	logLevel: "info",
};

if (watch) {
	const ctx = await esbuild.context(options);
	await ctx.watch();
	console.log("[esbuild] watching…");
} else {
	await esbuild.build(options);
	console.log("[esbuild] build complete → dist/extension.js");
}
