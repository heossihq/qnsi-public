/**
 * Smoke tests for @heossi/qnsi-autogen-qnsp
 *
 * Verifies that the package exports are importable and classes can be instantiated.
 * No API key or network access required — catches build regressions.
 *
 * Run: pnpm --filter @heossi/qnsi-autogen-qnsp test
 */

import { describe, expect, it } from "vitest";
import { QnsiExecutor } from "./executor.js";

describe("QnsiExecutor smoke", () => {
	it("exports QnsiExecutor class", () => {
		expect(QnsiExecutor).toBeDefined();
		expect(typeof QnsiExecutor).toBe("function");
	});

	it("constructs with only an API key", () => {
		const executor = new QnsiExecutor({ apiKey: "smoke-test-key" });
		expect(executor).toBeInstanceOf(QnsiExecutor);
	});

	it("constructs with full config", () => {
		const executor = new QnsiExecutor({
			apiKey: "smoke-test-key",
			tenantId: "tenant-123",
			baseUrl: "http://localhost:3000",
			containerImage: "custom-image:latest",
			cpu: 2,
			memoryGiB: 4,
			gpu: 1,
			acceleratorType: "nvidia-a100",
			pollTimeoutMs: 60_000,
			pollIntervalMs: 5_000,
		});
		expect(executor).toBeInstanceOf(QnsiExecutor);
	});

	it("has execute method", () => {
		const executor = new QnsiExecutor({ apiKey: "smoke-test-key" });
		expect(typeof executor.execute).toBe("function");
	});

	it("rejects unsupported language synchronously", async () => {
		const executor = new QnsiExecutor({ apiKey: "smoke-test-key" });
		await expect(
			// @ts-expect-error — intentionally passing invalid language
			executor.execute({ code: "SELECT 1", language: "sql" }),
		).rejects.toThrow("Unsupported language: sql");
	});
});
