import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VaultClient } from "../vault-client.js";
import { QnsiLogAgentActionTool } from "./audit.js";
import { QnsiSignDataTool, QnsiVerifySignatureTool } from "./kms.js";
import { QnsiReadSecretTool, QnsiRotateSecretTool, QnsiWriteSecretTool } from "./vault.js";

const TENANT = "77777777-7777-4777-8777-777777777777";
const SECRET_ID = "88888888-8888-4888-8888-888888888888";
const TOOL_CONFIG = {
	apiKey: "tool-key-000001",
	tenantId: TENANT,
	baseUrl: "https://edge.test",
};

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		statusText: status === 200 ? "OK" : "Error",
		headers: { get: () => null },
		json: async () => body,
	} as unknown as Response;
}

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("QnsiSignDataTool", () => {
	it("signs data through the proxy route with tenant headers and optional context", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ signature: "c2ln", algorithm: "ml-dsa-65" }));
		const tool = new QnsiSignDataTool(TOOL_CONFIG);
		const result = JSON.parse(
			await tool.invoke({ keyId: SECRET_ID, data: "ZGF0YQ==", context: "Y3R4" }),
		);
		expect(result).toMatchObject({ keyId: SECRET_ID, signature: "c2ln", algorithm: "ml-dsa-65" });
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(`https://edge.test/proxy/kms/v1/keys/${SECRET_ID}/sign`);
		expect((init.headers as Record<string, string>)["x-qnsp-tenant-id"]).toBe(TENANT);
		expect(JSON.parse(String(init.body))).toEqual({
			tenantId: TENANT,
			data: "ZGF0YQ==",
			context: "Y3R4",
		});

		fetchMock.mockClear();
		fetchMock.mockResolvedValue(jsonResponse({ signature: "c2ln", algorithm: "ml-dsa-65" }));
		await tool.invoke({ keyId: SECRET_ID, data: "ZGF0YQ==" });
		expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({
			tenantId: TENANT,
			data: "ZGF0YQ==",
		});
	});

	it("surfaces backend messages and falls back for unreadable error bodies", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ message: "key revoked" }, 403));
		await expect(
			new QnsiSignDataTool(TOOL_CONFIG).invoke({ keyId: SECRET_ID, data: "ZA==" }),
		).rejects.toThrow("KMS sign failed (403): key revoked");

		fetchMock.mockResolvedValueOnce({
			ok: false,
			status: 502,
			headers: { get: () => null },
			json: async () => {
				throw new Error("not json");
			},
		});
		await expect(
			new QnsiSignDataTool(TOOL_CONFIG).invoke({ keyId: SECRET_ID, data: "ZA==" }),
		).rejects.toThrow("KMS sign failed (502): unknown error");
	});
});

describe("QnsiVerifySignatureTool", () => {
	it("verifies signatures with and without context and maps failures", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ valid: true, algorithm: "ml-dsa-65" }));
		const tool = new QnsiVerifySignatureTool(TOOL_CONFIG);
		const result = JSON.parse(
			await tool.invoke({ keyId: SECRET_ID, data: "ZA==", signature: "c2ln", context: "Y3R4" }),
		);
		expect(result).toMatchObject({ keyId: SECRET_ID, valid: true });
		expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
			`https://edge.test/proxy/kms/v1/keys/${SECRET_ID}/verify`,
		);
		expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({
			tenantId: TENANT,
			data: "ZA==",
			signature: "c2ln",
			context: "Y3R4",
		});

		fetchMock.mockClear();
		fetchMock.mockResolvedValue(jsonResponse({ valid: false, algorithm: "ml-dsa-65" }));
		await tool.invoke({ keyId: SECRET_ID, data: "ZA==", signature: "c2ln" });
		expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({
			tenantId: TENANT,
			data: "ZA==",
			signature: "c2ln",
		});

		fetchMock.mockResolvedValueOnce(jsonResponse({ message: "bad signature" }, 400));
		await expect(
			new QnsiVerifySignatureTool(TOOL_CONFIG).invoke({
				keyId: SECRET_ID,
				data: "ZA==",
				signature: "c2ln",
			}),
		).rejects.toThrow("KMS verify failed (400): bad signature");
	});
});

describe("QnsiLogAgentActionTool", () => {
	it("posts audit events with optional metadata and maps failures", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ accepted: 1, received: 1 }));
		const tool = new QnsiLogAgentActionTool(TOOL_CONFIG);
		const result = JSON.parse(
			await tool.invoke({
				topic: "agent.decision",
				sourceService: "langchain-agent",
				payload: { action: "signed" },
				metadata: { runId: "r1" },
			}),
		);
		expect(result).toMatchObject({ accepted: 1, received: 1, topic: "agent.decision" });
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://edge.test/proxy/audit/v1/events");
		const body = JSON.parse(String(init.body));
		expect(body.events[0]).toMatchObject({
			tenantId: TENANT,
			topic: "agent.decision",
			metadata: { runId: "r1" },
		});

		fetchMock.mockClear();
		fetchMock.mockResolvedValue(jsonResponse({ accepted: 1, received: 1 }));
		await tool.invoke({ topic: "t", sourceService: "s", payload: { a: 1 } });
		expect(
			JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)).events[0]
				.metadata,
		).toBeUndefined();

		fetchMock.mockResolvedValueOnce(jsonResponse({ message: "schema rejected" }, 400));
		await expect(
			new QnsiLogAgentActionTool(TOOL_CONFIG).invoke({
				topic: "t",
				sourceService: "s",
				payload: {},
			}),
		).rejects.toThrow("Audit ingest failed (400): schema rejected");
	});
});

describe("vault tools", () => {
	function makeVault(secretBody: Record<string, unknown>): VaultClient {
		fetchMock.mockResolvedValue(jsonResponse(secretBody));
		const vault = new VaultClient({ apiKey: "tool-key-000001", baseUrl: "https://edge.test" });
		vault.setTenantId(TENANT);
		return vault;
	}

	const SECRET = {
		id: SECRET_ID,
		name: "db-password",
		tenantId: TENANT,
		version: 3,
		envelope: { encrypted: "x", algorithm: "aes-256-gcm" },
		pqc: { provider: "liboqs", algorithm: "ml-kem-768", keyId: "k1" },
		createdAt: "2026-08-16T00:00:00Z",
		updatedAt: "2026-08-16T01:00:00Z",
	};

	it("read tool reports the PQC algorithm and falls back to the envelope algorithm", async () => {
		const read = new QnsiReadSecretTool(makeVault(SECRET));
		expect(JSON.parse(await read.invoke({ secretId: SECRET_ID }))).toMatchObject({
			id: SECRET_ID,
			algorithm: "ml-kem-768",
			version: 3,
		});

		const legacy = new QnsiReadSecretTool(makeVault({ ...SECRET, pqc: undefined }));
		expect(JSON.parse(await legacy.invoke({ secretId: SECRET_ID }))).toMatchObject({
			algorithm: "aes-256-gcm",
		});
	});

	it("write tool folds descriptions into metadata and reports the stored id", async () => {
		const write = new QnsiWriteSecretTool(makeVault(SECRET));
		const result = JSON.parse(
			await write.invoke({
				tenantId: TENANT,
				name: "db-password",
				payload: "cGF5bG9hZA==",
				description: "primary db credential",
			}),
		);
		expect(result).toMatchObject({ id: SECRET_ID, algorithm: "ml-kem-768" });
		const createBody = JSON.parse(
			String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
		);
		expect(createBody.metadata).toEqual({ description: "primary db credential" });

		fetchMock.mockClear();
		fetchMock.mockResolvedValue(jsonResponse(SECRET));
		await write.invoke({ tenantId: TENANT, name: "n", payload: "cA==" });
		expect(
			JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)).metadata,
		).toBeUndefined();
	});

	it("rotate tool posts the new payload and reports the rotated version", async () => {
		const rotate = new QnsiRotateSecretTool(makeVault(SECRET));
		const result = JSON.parse(
			await rotate.invoke({ secretId: SECRET_ID, tenantId: TENANT, newPayload: "bmV3" }),
		);
		expect(result).toMatchObject({ id: SECRET_ID, version: 3, rotatedAt: SECRET.updatedAt });
		const rotateCall = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(rotateCall[0]).toContain(`/vault/v1/secrets/${SECRET_ID}/rotate`);
		expect(JSON.parse(String(rotateCall[1].body))).toEqual({
			tenantId: TENANT,
			newPayload: "bmV3",
		});

		const legacyRotate = new QnsiRotateSecretTool(makeVault({ ...SECRET, pqc: undefined }));
		expect(
			JSON.parse(
				await legacyRotate.invoke({ secretId: SECRET_ID, tenantId: TENANT, newPayload: "bmV3" }),
			),
		).toMatchObject({ algorithm: "aes-256-gcm" });
	});
});

describe("error-body fallbacks", () => {
	it("audit and verify tools fall back to unknown error for unreadable bodies", async () => {
		const unreadable = {
			ok: false,
			status: 502,
			headers: { get: () => null },
			json: async () => {
				throw new Error("not json");
			},
		} as unknown as Response;

		fetchMock.mockResolvedValueOnce(unreadable);
		await expect(
			new QnsiLogAgentActionTool(TOOL_CONFIG).invoke({
				topic: "t",
				sourceService: "s",
				payload: {},
			}),
		).rejects.toThrow("Audit ingest failed (502): unknown error");

		fetchMock.mockResolvedValueOnce(unreadable);
		await expect(
			new QnsiVerifySignatureTool(TOOL_CONFIG).invoke({
				keyId: SECRET_ID,
				data: "ZA==",
				signature: "c2ln",
			}),
		).rejects.toThrow("KMS verify failed (502): unknown error");
	});

	it("write tool falls back to the envelope algorithm for legacy secrets", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse({
				id: SECRET_ID,
				name: "legacy",
				tenantId: TENANT,
				version: 1,
				envelope: { encrypted: "x", algorithm: "aes-256-gcm" },
				createdAt: "2026-08-16T00:00:00Z",
				updatedAt: "2026-08-16T00:00:00Z",
			}),
		);
		const vault = new VaultClient({ apiKey: "tool-key-000001", baseUrl: "https://edge.test" });
		vault.setTenantId(TENANT);
		const result = JSON.parse(
			await new QnsiWriteSecretTool(vault).invoke({
				tenantId: TENANT,
				name: "legacy",
				payload: "cA==",
			}),
		);
		expect(result).toMatchObject({ algorithm: "aes-256-gcm" });
	});
});
