/**
 * Smoke tests for @heossihq/qnsi-langchain-qnsp
 *
 * Verifies that the package exports are importable and classes can be instantiated.
 * No real API key or network access required - `@heossihq/qnsi-sdk-activation` is mocked
 * so the activation handshake resolves immediately. Catches build regressions.
 *
 * Run: pnpm --filter @heossihq/qnsi-langchain-qnsp test
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("../_activation/index.js", () => ({
	activateSdk: vi.fn().mockResolvedValue({
		tenantId: "smoke-tenant",
		tier: "free",
		limits: {
			storageGB: 10,
			apiCalls: 50_000,
			enclavesEnabled: false,
			aiTrainingEnabled: false,
			aiInferenceEnabled: true,
			sseEnabled: false,
		},
		expiresInSeconds: 3600,
	}),
}));

import { QnsiToolkit } from "./toolkit.js";

async function activated(config: ConstructorParameters<typeof QnsiToolkit>[0]) {
	const toolkit = new QnsiToolkit(config);
	await toolkit.activate();
	return toolkit;
}

describe("QnsiToolkit smoke", () => {
	it("exports QnsiToolkit class", () => {
		expect(QnsiToolkit).toBeDefined();
		expect(typeof QnsiToolkit).toBe("function");
	});

	it("constructs with minimal config", () => {
		const toolkit = new QnsiToolkit({ apiKey: "smoke-test-key" });
		expect(toolkit).toBeInstanceOf(QnsiToolkit);
		expect(toolkit.isActivated).toBe(false);
	});

	it("getTools throws if activate() not called first", () => {
		const toolkit = new QnsiToolkit({ apiKey: "smoke-test-key" });
		expect(() => toolkit.getTools()).toThrow(/activate/);
	});

	it("getTools returns 6 tools after activation", async () => {
		const toolkit = await activated({ apiKey: "smoke-test-key" });
		expect(toolkit.isActivated).toBe(true);
		const tools = toolkit.getTools();
		expect(Array.isArray(tools)).toBe(true);
		expect(tools.length).toBe(6);
	});

	it("each tool has name, description, and schema", async () => {
		const toolkit = await activated({ apiKey: "smoke-test-key" });
		for (const tool of toolkit.getTools()) {
			expect(typeof tool.name).toBe("string");
			expect(tool.name.length).toBeGreaterThan(0);
			expect(typeof tool.description).toBe("string");
			expect(tool.description.length).toBeGreaterThan(0);
			expect(tool.schema).toBeDefined();
		}
	});

	it("getVaultTools, getKmsTools, getAuditTools return correct counts", async () => {
		const toolkit = await activated({ apiKey: "smoke-test-key" });
		expect(toolkit.getVaultTools()).toHaveLength(3);
		expect(toolkit.getKmsTools()).toHaveLength(2);
		expect(toolkit.getAuditTools()).toHaveLength(1);
	});

	it("include filter restricts returned tools", async () => {
		const vaultOnly = await activated({ apiKey: "smoke-test-key", include: ["vault"] });
		expect(vaultOnly.getTools()).toHaveLength(3);

		const kmsOnly = await activated({ apiKey: "smoke-test-key", include: ["kms"] });
		expect(kmsOnly.getTools()).toHaveLength(2);

		const auditOnly = await activated({ apiKey: "smoke-test-key", include: ["audit"] });
		expect(auditOnly.getTools()).toHaveLength(1);
	});
});
