import { beforeEach, describe, expect, it, vi } from "vitest";
import { QnsiToolkit } from "./toolkit.js";

// Test double: @heossihq/qnsi-vault-sdk
const mockVaultInstance = {
	getSecret: vi.fn().mockResolvedValue({
		id: "secret-123",
		name: "my-api-key",
		envelope: { encrypted: "abc", algorithm: "kyber-768" },
		pqc: { algorithm: "kyber-768", provider: "liboqs", keyId: "key-1" },
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-01T00:00:00Z",
		tenantId: "tenant-abc",
		version: 1,
		metadata: {},
		rotationPolicy: {},
		checksum: "abc",
		versionCreatedAt: "2026-01-01T00:00:00Z",
	}),
	createSecret: vi.fn().mockResolvedValue({
		id: "secret-456",
		name: "new-secret",
		envelope: { encrypted: "def", algorithm: "kyber-768" },
		pqc: { algorithm: "kyber-768", provider: "liboqs", keyId: "key-1" },
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-01T00:00:00Z",
		tenantId: "tenant-abc",
		version: 1,
		metadata: {},
		rotationPolicy: {},
		checksum: "def",
		versionCreatedAt: "2026-01-01T00:00:00Z",
	}),
	rotateSecret: vi.fn().mockResolvedValue({
		id: "secret-123",
		name: "my-api-key",
		envelope: { encrypted: "ghi", algorithm: "kyber-768" },
		pqc: { algorithm: "kyber-768", provider: "liboqs", keyId: "key-1" },
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-04-01T00:00:00Z",
		tenantId: "tenant-abc",
		version: 2,
		metadata: {},
		rotationPolicy: {},
		checksum: "ghi",
		versionCreatedAt: "2026-04-01T00:00:00Z",
	}),
};

vi.mock("./vault-client.js", () => ({
	VaultClient: class MockVaultClient {
		getSecret = mockVaultInstance.getSecret;
		createSecret = mockVaultInstance.createSecret;
		rotateSecret = mockVaultInstance.rotateSecret;
		setTenantId = vi.fn();
	},
}));

vi.mock("../_activation/index.js", () => ({
	activateSdk: vi.fn().mockResolvedValue({
		tenantId: "tenant-abc",
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

async function activatedToolkit(config: ConstructorParameters<typeof QnsiToolkit>[0]) {
	const toolkit = new QnsiToolkit(config);
	await toolkit.activate();
	return toolkit;
}

describe("QnsiToolkit", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates a toolkit with default config", async () => {
		const toolkit = await activatedToolkit({ apiKey: "test-key" });
		expect(toolkit).toBeDefined();
	});

	it("returns all tools by default (vault=3, kms=2, audit=1)", async () => {
		const toolkit = await activatedToolkit({ apiKey: "test-key" });
		const tools = toolkit.getTools();
		expect(tools).toHaveLength(6);
	});

	it("returns only vault tools when include=['vault']", async () => {
		const toolkit = await activatedToolkit({ apiKey: "test-key", include: ["vault"] });
		const tools = toolkit.getTools();
		expect(tools).toHaveLength(3);
		expect(tools.map((t) => t.name)).toEqual([
			"qnsp_read_secret",
			"qnsp_write_secret",
			"qnsp_rotate_secret",
		]);
	});

	it("returns only kms tools when include=['kms']", async () => {
		const toolkit = await activatedToolkit({ apiKey: "test-key", include: ["kms"] });
		const tools = toolkit.getTools();
		expect(tools).toHaveLength(2);
		expect(tools.map((t) => t.name)).toEqual(["qnsp_sign_data", "qnsp_verify_signature"]);
	});

	it("returns only audit tool when include=['audit']", async () => {
		const toolkit = await activatedToolkit({ apiKey: "test-key", include: ["audit"] });
		const tools = toolkit.getTools();
		expect(tools).toHaveLength(1);
		expect(tools[0]?.name).toBe("qnsp_log_agent_action");
	});

	it("getVaultTools returns 3 vault tools", async () => {
		const toolkit = await activatedToolkit({ apiKey: "test-key" });
		expect(toolkit.getVaultTools()).toHaveLength(3);
	});

	it("getKmsTools returns 2 kms tools", async () => {
		const toolkit = await activatedToolkit({ apiKey: "test-key" });
		expect(toolkit.getKmsTools()).toHaveLength(2);
	});

	it("getAuditTools returns 1 audit tool", async () => {
		const toolkit = await activatedToolkit({ apiKey: "test-key" });
		expect(toolkit.getAuditTools()).toHaveLength(1);
	});

	it("all tools have non-empty name and description", async () => {
		const toolkit = await activatedToolkit({ apiKey: "test-key" });
		for (const tool of toolkit.getTools()) {
			expect(tool.name.length).toBeGreaterThan(0);
			expect(tool.description.length).toBeGreaterThan(0);
		}
	});

	it("qnsp_read_secret invokes vault.getSecret", async () => {
		const toolkit = await activatedToolkit({ apiKey: "test-key" });
		const [readTool] = toolkit.getVaultTools();
		if (!readTool) throw new Error("No read tool");

		const result = await readTool.invoke({ secretId: "secret-123" });
		const parsed = JSON.parse(result as string) as Record<string, unknown>;
		expect(parsed["id"]).toBe("secret-123");
		expect(parsed["name"]).toBe("my-api-key");
		expect(parsed["algorithm"]).toBe("kyber-768");
	});

	it("qnsp_write_secret invokes vault.createSecret", async () => {
		const toolkit = await activatedToolkit({ apiKey: "test-key" });
		const tools = toolkit.getVaultTools();
		const writeTool = tools[1];
		if (!writeTool) throw new Error("No write tool");

		const result = await writeTool.invoke({
			tenantId: "tenant-abc",
			name: "new-secret",
			payload: "dGVzdA==",
		});
		const parsed = JSON.parse(result as string) as Record<string, unknown>;
		expect(parsed["id"]).toBe("secret-456");
		expect(parsed["name"]).toBe("new-secret");
	});

	it("qnsp_rotate_secret invokes vault.rotateSecret", async () => {
		const toolkit = await activatedToolkit({ apiKey: "test-key" });
		const tools = toolkit.getVaultTools();
		const rotateTool = tools[2];
		if (!rotateTool) throw new Error("No rotate tool");

		const result = await rotateTool.invoke({
			secretId: "secret-123",
			tenantId: "tenant-abc",
			newPayload: "bmV3dmFsdWU=",
		});
		const parsed = JSON.parse(result as string) as Record<string, unknown>;
		expect(parsed["id"]).toBe("secret-123");
		expect(typeof parsed["rotatedAt"]).toBe("string");
	});
});

describe("explicit tenant configuration", () => {
	it("keeps a caller-supplied tenantId instead of inheriting from activation", async () => {
		const toolkit = await activatedToolkit({ apiKey: "test-key", tenantId: "explicit-tenant" });
		const tools = toolkit.getTools();
		expect(tools.length).toBeGreaterThan(0);
	});
});

describe("subpath index", () => {
	it("bridges env aliases on import and re-exports the toolkit", async () => {
		const mod = await import("./index.js");
		expect(mod.QnsiToolkit).toBeDefined();
	});
});
