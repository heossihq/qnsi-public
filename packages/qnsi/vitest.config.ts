import { defineConfig, mergeConfig } from "vitest/config";
import { boundedPool } from "../../tooling/vitest/pool.ts";

export default mergeConfig(
	defineConfig({
		test: {
			environment: "node",
			include: ["src/**/*.test.ts"],
			exclude: [
				"src/autogen/executor.integration.test.ts",
				"src/langchain/toolkit.integration.test.ts",
				"src/llamaindex/vector-store.integration.test.ts",
			],
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
				thresholds: { lines: 100, statements: 100, functions: 100, branches: 100 },
			},
		},
	}),
	boundedPool,
);
