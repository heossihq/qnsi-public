import { defineConfig, mergeConfig } from "vitest/config";
import { boundedPool } from "../../tooling/vitest/pool.ts";

export default mergeConfig(
	defineConfig({
		test: {
			globals: true,
			environment: "node",
			include: ["src/**/*.test.ts"],
			passWithNoTests: false,
			coverage: {
				provider: "v8",
				reporter: ["text", "json-summary", "lcov"],
				include: ["src/**/*.ts"],
				exclude: ["src/**/*.test.ts", "src/**/*.d.ts"],
				thresholds: { lines: 100, statements: 100, functions: 100, branches: 100 },
			},
		},
	}),
	boundedPool,
);
