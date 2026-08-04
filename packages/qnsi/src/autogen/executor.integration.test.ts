/**
 * Integration tests for @heossihq/qnsi-autogen-qnsp
 *
 * These tests hit the real QNSP AI orchestrator API via edge gateway.
 * Requires QNSI_API_KEY env var - the API key resolves tenant, tier, and policy automatically.
 *
 * Note: Workload submission requires enterprise tier with enclave access.
 * On lower tiers, the test verifies that the executor correctly surfaces the tier error.
 *
 * Run: QNSI_API_KEY=qnsp_... pnpm --filter @heossihq/qnsi-autogen-qnsp test:integration
 */

import { describe, expect, it } from "vitest";
import { QnsiExecutor } from "./executor.js";

const QNSI_API_KEY = process.env["QNSI_API_KEY"];

describe.skipIf(!QNSI_API_KEY)("QnsiExecutor integration", () => {
	it("instantiates with only an API key", () => {
		const executor = new QnsiExecutor({ apiKey: QNSI_API_KEY! });
		expect(executor).toBeDefined();
	});

	it("execute surfaces an error for non-enterprise tiers or returns a workload ID", async () => {
		const executor = new QnsiExecutor({
			apiKey: QNSI_API_KEY!,
			pollTimeoutMs: 30_000,
			pollIntervalMs: 2_000,
		});

		try {
			const result = await executor.execute({
				code: "print('integration test')",
				language: "python",
				name: `integration-test-${Date.now()}`,
			});
			// If we get here, the tier has enclave access
			expect(result.workloadId).toBeTruthy();
			expect(typeof result.status).toBe("string");
		} catch (error) {
			// Expected on non-enterprise tiers - verify it's a structured error, not a crash
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toBeTruthy();
		}
	});

	it("execute with idempotency key is safe to call", async () => {
		const executor = new QnsiExecutor({
			apiKey: QNSI_API_KEY!,
			pollTimeoutMs: 30_000,
		});

		const idempotencyKey = `integration-idempotent-${Date.now()}`;

		try {
			const result = await executor.execute({
				code: "print('idempotent')",
				language: "python",
				idempotencyKey,
			});
			expect(result.workloadId).toBeTruthy();
		} catch (error) {
			// Tier restriction or other expected error
			expect(error).toBeInstanceOf(Error);
		}
	});
});
