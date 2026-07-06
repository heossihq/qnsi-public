import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, mergeConfig } from "vitest/config";
import { boundedPool } from "../../tooling/vitest/pool";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default mergeConfig(
	defineConfig({
		resolve: {
			alias: {
				"@opentelemetry/api": resolve(__dirname, "src/__mocks__/otel-api.ts"),
				"@opentelemetry/resources": resolve(__dirname, "src/__mocks__/otel-resources.ts"),
				"@opentelemetry/sdk-metrics": resolve(__dirname, "src/__mocks__/otel-metrics.ts"),
				"@opentelemetry/sdk-trace-node": resolve(__dirname, "src/__mocks__/otel-trace.ts"),
			},
		},
		test: {
			globals: true,
			environment: "node",
			include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
			exclude: ["src/**/*.integration.ts"],
			passWithNoTests: false,
			pool: "forks",
		},
	}),
	boundedPool,
);
