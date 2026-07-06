import { defineConfig, mergeConfig } from "vitest/config";
import { boundedPool } from "../../tooling/vitest/pool";

export default mergeConfig(
	defineConfig({
		test: {
			environment: "node",
			include: ["src/**/*.test.ts"],
		},
	}),
	boundedPool,
);
