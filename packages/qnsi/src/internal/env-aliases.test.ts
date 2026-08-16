import { describe, expect, it } from "vitest";

import { bridgeQnsiEnv } from "./env-aliases.js";

describe("bridgeQnsiEnv", () => {
	it("mirrors QNSP_* to QNSI_* and back without overwriting explicit values", () => {
		const env: NodeJS.ProcessEnv = {
			QNSP_API_KEY: "legacy-key",
			QNSI_TENANT_ID: "canonical-tenant",
			QNSP_SERVICE_ID: "svc-legacy",
			QNSI_SERVICE_ID: "svc-canonical",
			UNRELATED: "left-alone",
			EMPTYISH: undefined,
		};
		bridgeQnsiEnv(env);

		// Legacy propagates to canonical.
		expect(env["QNSI_API_KEY"]).toBe("legacy-key");
		// Canonical propagates to legacy.
		expect(env["QNSP_TENANT_ID"]).toBe("canonical-tenant");
		// An explicitly set counterpart is never overwritten.
		expect(env["QNSI_SERVICE_ID"]).toBe("svc-canonical");
		expect(env["QNSP_SERVICE_ID"]).toBe("svc-legacy");
		// Non-family keys are untouched.
		expect(env["UNRELATED"]).toBe("left-alone");

		// Idempotent: a second pass changes nothing.
		const snapshot = { ...env };
		bridgeQnsiEnv(env);
		expect(env).toEqual(snapshot);
	});

	it("defaults to process.env", () => {
		process.env["QNSP_BRIDGE_PROBE"] = "probe-value";
		try {
			bridgeQnsiEnv();
			expect(process.env["QNSI_BRIDGE_PROBE"]).toBe("probe-value");
		} finally {
			delete process.env["QNSP_BRIDGE_PROBE"];
			delete process.env["QNSI_BRIDGE_PROBE"];
		}
	});
});
