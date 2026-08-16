import { defineConfig, mergeConfig } from "vitest/config";
import { boundedPool } from "../../tooling/vitest/pool.ts";

export default mergeConfig(
	defineConfig({
		test: {
			environment: "node",
			include: ["src/tls/rotate-pqc-cert.integration.test.ts"],
			passWithNoTests: false,
		},
	}),
	boundedPool,
);
