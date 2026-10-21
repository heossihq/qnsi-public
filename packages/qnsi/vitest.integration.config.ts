import { defineConfig, mergeConfig } from "vitest/config";
import { boundedPool } from "../../tooling/vitest/pool.ts";

export default mergeConfig(
	defineConfig({
		test: {
			environment: "node",
			include: [
				"src/autogen/executor.integration.test.ts",
				"src/langchain/toolkit.integration.test.ts",
				"src/llamaindex/vector-store.integration.test.ts",
			],
			passWithNoTests: false,
			coverage: {
				enabled: false,
			},
		},
	}),
	boundedPool,
);
