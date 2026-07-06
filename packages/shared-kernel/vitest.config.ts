import { defineConfig, mergeConfig } from "vitest/config";
import { boundedPool } from "../../tooling/vitest/pool";

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
				reportsDirectory: "coverage",
				thresholds: {
					statements: 85,
					branches: 74,
					functions: 82,
					lines: 85,
				},
			},
		},
	}),
	boundedPool,
);
