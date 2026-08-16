import { resolve } from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import { boundedPool } from "../../tooling/vitest/pool.ts";

// Unit suites run the real module logic against the controllable host-API
// double in test/vscode-api.ts (the `vscode` host API is only available
// inside an Electron extension host). The Electron integration suite
// remains `pnpm test` via test/runTest.mjs.
export default mergeConfig(
	defineConfig({
		resolve: {
			alias: { vscode: resolve(__dirname, "test/vscode-api.ts") },
		},
		test: {
			globals: true,
			environment: "node",
			include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
			exclude: ["src/**/*.integration.ts"],
			passWithNoTests: false,
			coverage: {
				provider: "v8",
				reporter: ["text", "lcov"],
				include: ["src/**/*.ts"],
				exclude: [
					"src/**/*.test.ts",
					"src/**/*.spec.ts",
					"src/**/*.integration.ts",
					"src/**/*.d.ts",
				],
				reportsDirectory: "coverage",
				thresholds: {
					statements: 100,
					branches: 100,
					functions: 100,
					lines: 100,
				},
			},
		},
	}),
	boundedPool,
);
