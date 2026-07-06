import { defineConfig, mergeConfig } from "vitest/config";
import { boundedPool } from "../../tooling/vitest/pool";

export default mergeConfig(
	defineConfig({
		test: {
			exclude: ["dist/**", "node_modules/**"],
			coverage: {
				reporter: ["text", "lcov"],
			},
		},
	}),
	boundedPool,
);
