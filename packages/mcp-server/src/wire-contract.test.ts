/**
 * REGRESSION GUARD: the MCP tools' request bodies must match the backend's Zod schemas.
 *
 * FOUND 2026-07-14 in a REAL MCP session (stdio, published @heossihq/qnsi-mcp@0.1.6) against
 * production, with a real API key:
 *
 *     tools/call qnsp_kms_generate_key  ->  isError: true, "Invalid request body"
 *
 * kms-service's createKeySchema is:
 *
 *     { tenantId, keyId (REQUIRED, 1-255), keyType (root|master|data|byok), algorithm, metadata }
 *
 * The tool sent `{ tenantId, algorithm, label, metadata }` - no keyId, no keyType, and a
 * top-level `label` the backend does not know. Backend Zod objects are NON-STRICT, so `label`
 * was silently STRIPPED and the two required fields simply never arrived. It returned 400
 * every single time: THE TOOL HAD NEVER GENERATED A KEY.
 *
 * It also blocked two more: qnsp_kms_get_key and qnsp_kms_rotate_key could never obtain a
 * keyId to operate on. Several tools would otherwise be dead.
 *
 * This asserts the BODY THE TOOL BUILDS - no network, no credentials. Same shape of guard as
 * the Python SDK's (sdks/python/qnsi/tests/test_wire_contract.py), and for the same reason:
 * a wrong field name never produces a helpful error, only a missing required field.
 */
import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "./api-client.js";
import type { TierGate } from "./session.js";
import * as tools from "./tools.js";

const TENANT = "155f43f3-bb3f-43be-b62c-0c0c97b5b5b0";

/** Captures the body a tool sends, instead of sending it. */
function spy() {
	const calls: Array<{ method: string; path: string; body?: unknown }> = [];
	const api = {
		post: async (path: string, body?: unknown) => {
			calls.push({ method: "POST", path, body });
			return { data: { id: "00000000-0000-0000-0000-000000000000" } };
		},
		get: async (path: string) => {
			calls.push({ method: "GET", path });
			return { data: {} };
		},
		put: async (path: string, body?: unknown) => {
			calls.push({ method: "PUT", path, body });
			return { data: { method: "PUT" } };
		},
		patch: async (path: string, body?: unknown) => {
			calls.push({ method: "PATCH", path, body });
			return { data: { method: "PATCH" } };
		},
		del: async (path: string) => {
			calls.push({ method: "DELETE", path });
			return { data: { method: "DELETE" } };
		},
	} as unknown as ApiClient;

	const gate = {
		hasFeature: () => true,
		tier: "free",
		tenantId: TENANT,
		limits: {},
	} as unknown as TierGate;

	return { ctx: { api, gate } as tools.ToolContext, calls };
}

describe("MCP wire contract: kms.generateKey", () => {
	it("carries full-surface query and idempotency options onto the HTTP wire", async () => {
		const { ctx } = spy();
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async () => new Response("{}"));
		try {
			const api = new ApiClient({
				baseUrl: "https://api.test",
				apiKey: "test-key",
				tenantId: TENANT,
			});
			await tools.apiRequest(
				{ ...ctx, api },
				tools.apiRequestSchema.parse({
					method: "POST",
					path: "/proxy/kms/v1/keys/test/sign",
					body: { tenantId: TENANT, data: "aGVsbG8=" },
					query: { version: 2 },
					idempotencyKey: "sign-1",
				}),
			);
			const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
			expect(new URL(url).searchParams.get("version")).toBe("2");
			expect((init.headers as Record<string, string>)["idempotency-key"]).toBe("sign-1");
			expect(JSON.parse(init.body as string)).toEqual({ tenantId: TENANT, data: "aGVsbG8=" });
		} finally {
			fetchMock.mockRestore();
		}
	});
	it("sends the REQUIRED keyId - its absence returned 400 on every call", async () => {
		const { ctx, calls } = spy();
		await tools.kmsGenerateKey(ctx, { algorithm: "dilithium-3" });

		const body = calls[0]?.body as Record<string, unknown>;
		expect(calls[0]?.path).toBe("/proxy/kms/v1/keys");
		expect(body["keyId"]).toBeTypeOf("string");
		expect(String(body["keyId"]).length).toBeGreaterThan(0);
	});

	it("sends keyType - createKeySchema requires it", async () => {
		const { ctx, calls } = spy();
		await tools.kmsGenerateKey(ctx, { algorithm: "dilithium-3" });

		const body = calls[0]?.body as Record<string, unknown>;
		expect(body["keyType"]).toBe("data");
	});

	it("does NOT send a top-level `label` - the backend strips it", async () => {
		const { ctx, calls } = spy();
		await tools.kmsGenerateKey(ctx, { algorithm: "dilithium-3", label: "my-key" });

		const body = calls[0]?.body as Record<string, unknown>;
		expect(body["label"]).toBeUndefined();
		expect((body["metadata"] as Record<string, string>)["label"]).toBe("my-key");
	});

	it("carries the tenantId and the algorithm", async () => {
		const { ctx, calls } = spy();
		await tools.kmsGenerateKey(ctx, { algorithm: "dilithium-3" });

		const body = calls[0]?.body as Record<string, unknown>;
		expect(body["tenantId"]).toBe(TENANT);
		expect(body["algorithm"]).toBe("dilithium-3");
	});
});

describe("MCP wire contract: vault.createSecret", () => {
	it("sends `payload` (base64), not `payloadBase64`", async () => {
		const { ctx, calls } = spy();
		await tools.vaultCreateSecret(ctx, { name: "a-secret", value: "hello" });

		const body = calls[0]?.body as Record<string, unknown>;
		expect(body["payload"]).toBe(Buffer.from("hello").toString("base64"));
		expect(body["payloadBase64"]).toBeUndefined();
		expect(body["tenantId"]).toBe(TENANT);
	});

	it("fails all vault operations locally when the tier disables vault access", async () => {
		const { ctx, calls } = spy();
		(ctx.gate as { hasFeature: (feature: string) => boolean }).hasFeature = () => false;

		const results = await Promise.all([
			tools.vaultCreateSecret(ctx, { name: "a-secret", value: "hello" }),
			tools.vaultGetSecret(ctx, { secretId: "secret-id" }),
			tools.vaultListSecrets(ctx, {}),
		]);

		expect(calls).toHaveLength(0);
		for (const result of results) {
			expect(result.isError).toBe(true);
			expect(result.content[0]?.text).toContain("Quantum-Safe Vault");
			expect(result.content[0]?.text).toContain("Current tier: free");
		}
	});
});

describe("MCP wire contract: HSPK seal/sign (byohsm/pqc routes)", () => {
	it("kmsHspkSeal POSTs /proxy/kms/v1/byohsm/pqc/seal with tenantId+connectionId+keyId", async () => {
		const { ctx, calls } = spy();
		await tools.kmsHspkSeal(ctx, {
			connectionId: "conn-1",
			keyId: "rsa-root",
			algorithm: "ml-dsa-65",
			oaepHash: "sha256",
		});
		expect(calls[0]?.path).toBe("/proxy/kms/v1/byohsm/pqc/seal");
		const body = calls[0]?.body as Record<string, unknown>;
		expect(body["tenantId"]).toBe(TENANT);
		expect(body["connectionId"]).toBe("conn-1");
		expect(body["keyId"]).toBe("rsa-root");
		expect(body["algorithm"]).toBe("ml-dsa-65");
		expect(body["oaepHash"]).toBe("sha256");
	});

	it("kmsHspkSign base64-encodes the message + forwards sealedKey as an object", async () => {
		const { ctx, calls } = spy();
		const sealedKey = { scheme: "hspk-hsm-cek-aes256gcm-v1", algorithm: "ml-dsa-65" };
		await tools.kmsHspkSign(ctx, {
			connectionId: "conn-1",
			keyId: "rsa-root",
			sealedKey,
			message: "sign me",
			oaepHash: "sha1",
		});
		expect(calls[0]?.path).toBe("/proxy/kms/v1/byohsm/pqc/sign");
		const body = calls[0]?.body as Record<string, unknown>;
		expect(body["sealedKey"]).toEqual(sealedKey);
		expect(body["data"]).toBe(Buffer.from("sign me", "utf-8").toString("base64"));
		expect(body["oaepHash"]).toBe("sha1");
	});
});
describe("MCP wire contract: cryptoScan", () => {
	it("POSTs the real discovery trigger with the authenticated tenant", async () => {
		const { ctx, calls } = spy();
		await tools.cryptoScan(ctx, {});

		expect(calls).toEqual([
			{
				method: "POST",
				path: "/proxy/crypto/v1/assets/discover",
				body: { tenantId: TENANT },
			},
		]);
	});
});

describe("MCP tools emit only canonically mounted routes", () => {
	it("preserves optional storage, search, and billing request fields", async () => {
		const { ctx, calls } = spy();

		await tools.storageListObjects(ctx, { bucket: "audit records", limit: 25 });
		await tools.storageListObjects(ctx, { bucket: "audit records" });
		await tools.storagePutObject(ctx, {
			bucket: "evidence",
			key: "report one",
			dataB64: "cHJvb2Y=",
			contentType: "application/pdf",
		});
		await tools.storagePutObject(ctx, {
			bucket: "evidence",
			key: "raw",
			dataB64: "cHJvb2Y=",
		});
		await tools.searchVectorQuery(ctx, {
			indexName: "customer evidence",
			vector: [0.25, 0.75],
			topK: 2,
			filter: { classification: "public" },
		});
		await tools.searchVectorQuery(ctx, {
			indexName: "customer evidence",
			vector: [0.25, 0.75],
			topK: 2,
		});
		await tools.billingListInvoices(ctx, { limit: 5 });
		await tools.billingListInvoices(ctx, {});

		expect(calls).toEqual([
			{
				method: "GET",
				path: "/proxy/storage/v1/buckets/audit%20records/objects?limit=25",
			},
			{ method: "GET", path: "/proxy/storage/v1/buckets/audit%20records/objects" },
			{
				method: "PUT",
				path: "/proxy/storage/v1/buckets/evidence/objects/report%20one",
				body: { dataB64: "cHJvb2Y=", contentType: "application/pdf" },
			},
			{
				method: "PUT",
				path: "/proxy/storage/v1/buckets/evidence/objects/raw",
				body: { dataB64: "cHJvb2Y=" },
			},
			{
				method: "POST",
				path: "/proxy/search/v1/indexes/customer%20evidence/query",
				body: {
					vector: [0.25, 0.75],
					topK: 2,
					filter: { classification: "public" },
				},
			},
			{
				method: "POST",
				path: "/proxy/search/v1/indexes/customer%20evidence/query",
				body: { vector: [0.25, 0.75], topK: 2 },
			},
			{
				method: "GET",
				path: `/proxy/billing/v1/invoices?limit=5&tenantId=${TENANT}`,
			},
			{ method: "GET", path: `/proxy/billing/v1/invoices?tenantId=${TENANT}` },
		]);
	});

	it.each(["GET", "POST", "PUT", "PATCH", "DELETE"] as const)(
		"dispatches full-surface %s requests through the matching API client method",
		async (method) => {
			const { ctx, calls } = spy();
			const result = await tools.apiRequest(ctx, {
				method,
				path: "/proxy/kms/v1/keys",
				body: { requestedBy: "coverage-contract" },
			});

			expect(calls).toEqual([
				{
					method,
					path: "/proxy/kms/v1/keys",
					...(method === "GET" || method === "DELETE"
						? {}
						: { body: { requestedBy: "coverage-contract" } }),
				},
			]);
			expect(result.isError).toBeUndefined();
		},
	);

	it("forwards optional audit filters", async () => {
		const { ctx, calls } = spy();

		await tools.auditQuery(ctx, {
			topic: "kms.key.rotated",
			sourceService: "kms-service",
			limit: 7,
		});

		expect(calls[0]?.path).toBe(
			`/proxy/audit/v1/events?topic=kms.key.rotated&sourceService=kms-service&tenantId=${TENANT}&limit=7`,
		);
	});

	it("fails encrypted search locally when the tier disables SSE", async () => {
		const { ctx, calls } = spy();
		(ctx.gate as { hasFeature: (feature: string) => boolean }).hasFeature = () => false;

		const result = await tools.searchQuery(ctx, { query: "sensitive" });

		expect(calls).toHaveLength(0);
		expect(result.isError).toBe(true);
		expect(result.content[0]?.text).toContain("Encrypted Search (SSE-X)");
	});

	it("invokes all 17 tools and resolves every network call exactly once", async () => {
		const { readFile } = await import("node:fs/promises");
		const { fileURLToPath } = await import("node:url");
		const { EDGE_DIRECT_ROUTES, resolveServiceProxyDescriptor, resolveServiceProxyManifestRoute } =
			await import("@heossihq/qnsi-enforcement-contract/service-proxy-descriptors");
		const { ctx, calls } = spy();

		await tools.kmsGenerateKey(ctx, { algorithm: "ml-dsa-65" });
		await tools.kmsListKeys(ctx, {});
		await tools.kmsGetKey(ctx, { keyId: "key-id" });
		await tools.kmsRotateKey(ctx, { keyId: "key-id" });
		await tools.kmsHspkSeal(ctx, { connectionId: "connection-id", keyId: "hsm-key" });
		await tools.kmsHspkSign(ctx, {
			connectionId: "connection-id",
			keyId: "hsm-key",
			sealedKey: { scheme: "hspk-hsm-cek-aes256gcm-v1", algorithm: "ml-dsa-65" },
			message: "message",
		});
		await tools.vaultCreateSecret(ctx, { name: "secret", value: "value" });
		await tools.vaultGetSecret(ctx, { secretId: "secret-id" });
		await tools.vaultListSecrets(ctx, {});
		await tools.cryptoScan(ctx, {});
		await tools.cryptoInventory(ctx, {});
		await tools.cryptoReadiness(ctx, {});
		await tools.auditQuery(ctx, {});
		await tools.searchQuery(ctx, { query: "query" });
		await tools.tenantInfo(ctx, {});
		const callsBeforeBillingStatus = calls.length;
		await tools.billingStatus(ctx, {});
		expect(calls).toHaveLength(callsBeforeBillingStatus);
		await tools.platformHealth(ctx, {});

		expect(calls).toHaveLength(16);
		const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
		const manifests = new Map<string, { routes: Array<{ method: string; path: string }> }>();
		for (const call of calls) {
			const externalPath = new URL(call.path, "https://edge.example.test").pathname;
			if (externalPath === "/proxy/health") {
				const matches = EDGE_DIRECT_ROUTES.filter(
					(route) => route.method === call.method && route.path === externalPath,
				);
				expect(matches, `${call.method} ${externalPath}`).toHaveLength(1);
				continue;
			}
			const descriptor = resolveServiceProxyDescriptor(externalPath);
			expect(descriptor.manifestDirectory, `${call.method} ${externalPath}`).not.toBeNull();
			const directory = descriptor.manifestDirectory as string;
			let manifest = manifests.get(directory);
			if (!manifest) {
				manifest = JSON.parse(
					await readFile(`${repoRoot}apps/${directory}/service.manifest.json`, "utf8"),
				) as { routes: Array<{ method: string; path: string }> };
				manifests.set(directory, manifest);
			}
			expect(
				resolveServiceProxyManifestRoute(descriptor, manifest.routes, call.method, externalPath),
				`${call.method} ${externalPath}`,
			).toBeDefined();
		}
	});
});
