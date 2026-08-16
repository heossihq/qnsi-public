import { defineConfig, mergeConfig } from "vitest/config";
import { boundedPool } from "../../tooling/vitest/pool.ts";

export default mergeConfig(
	defineConfig({
		test: {
			globals: true,
			environment: "node",
			include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
			exclude: ["src/tls/rotate-pqc-cert.integration.test.ts"],
			passWithNoTests: false,
			coverage: {
				provider: "v8",
				reporter: ["text", "json", "html"],
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
