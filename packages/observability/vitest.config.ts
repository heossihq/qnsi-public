import { defineConfig, mergeConfig } from "vitest/config";
import { boundedPool } from "../../tooling/vitest/pool.ts";

export default mergeConfig(
	defineConfig({
		// No module aliases: earlier versions substituted hand-written fakes for
		// ALL of OpenTelemetry, so the suite measured the mocks, not the SDK.
		// Tests now run against the real @opentelemetry packages with in-memory
		// exporters.
		test: {
			globals: true,
			environment: "node",
			include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
			exclude: ["src/**/*.integration.ts"],
			passWithNoTests: false,
			pool: "forks",
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
