import { defineConfig, mergeConfig } from "vitest/config";
import { boundedPool } from "../../tooling/vitest/pool.ts";

export default mergeConfig(
	defineConfig({
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
