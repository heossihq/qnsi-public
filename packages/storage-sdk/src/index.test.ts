import { clearActivationCache } from "@heossi/qnsi-sdk-activation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageClient, StorageEventsClient } from "./index.js";

const mockTenantId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const baseUrl = "https://storage.qnsp.example/";

// Valid UUID test constants
const mockUploadId = "11111111-1111-4111-a111-111111111111";
const mockUploadId2 = "22222222-2222-4222-a222-222222222222";
const mockUploadIdErr = "33333333-3333-4333-a333-333333333333";
const mockDocumentId = "44444444-4444-4444-a444-444444444444";

const MOCK_ACTIVATION_RESPONSE = {
	activated: true,
	tenantId: "a1b2c3d4-e5f6-4789-8abc-def012345678",
	tier: "dev-pro",
	activationToken: "tok_test",
	expiresInSeconds: 3600,
	activatedAt: new Date().toISOString(),
	limits: {
		storageGB: 50,
		apiCalls: 100_000,
		enclavesEnabled: false,
		aiTrainingEnabled: false,
		aiInferenceEnabled: true,
		sseEnabled: true,
		vaultEnabled: true,
	},
};

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
			...(init?.headers ?? {}),
		},
		...init,
	});
}

async function collectStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];

	while (true) {
		const { value, done } = await reader.read();
		if (done) {
			break;
		}
		if (value) {
			chunks.push(value);
		}
	}

	const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
	const buffer = new Uint8Array(totalLength);
	let offset = 0;

	for (const chunk of chunks) {
		buffer.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return buffer;
}

describe("StorageClient", () => {
	beforeEach(() => {
		clearActivationCache();
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it("initiates an upload with authorization and sensible defaults", async () => {
		const client = new StorageClient({
			baseUrl,
			apiKey: "api-key",
			tenantId: mockTenantId,
			timeoutMs: 5_000,
		});

		const expectedResponse = {
			uploadId: mockUploadId,
			documentId: mockDocumentId,
			tenantId: mockTenantId,
			chunkSizeBytes: 16_777_216,
			totalSizeBytes: 42_000_000,
			totalParts: 4,
			expiresAt: new Date().toISOString(),
			resumeToken: "resume-token",
			pqc: {
				provider: "vault-pqc",
				algorithm: "kyber-768",
				algorithmNist: "ML-KEM-768",
				keyId: "key-1",
			},
		};

		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce(jsonResponse(MOCK_ACTIVATION_RESPONSE))
			.mockResolvedValueOnce(jsonResponse(expectedResponse));

		const result = await client.initiateUpload({
			name: "contract.pdf",
			mimeType: "application/pdf",
			sizeBytes: 42_000_000,
			tags: ["legal", "asia"],
		});

		expect(result).toEqual(expectedResponse);
		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
		const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(1);
		expect(call).toBeDefined();
		if (!call) throw new Error("fetch not invoked");
		const [url, init] = call;

		expect(url).toBe("https://storage.qnsp.example/storage/v1/documents");
		expect(init?.method).toBe("POST");
		expect(init?.headers).toMatchObject({
			"Content-Type": "application/json",
			Authorization: "Bearer api-key",
		});

		const body = init?.body ? JSON.parse(String(init.body)) : null;
		expect(body).not.toBeNull();
		expect(body).toMatchObject({
			classification: "confidential",
			metadata: {},
			tags: ["legal", "asia"],
		});
	});

	it("uploads binary parts using streaming semantics", async () => {
		const client = new StorageClient({
			baseUrl,
			apiKey: "upload-key",
			tenantId: mockTenantId,
		});

		const expectedPayload = {
			uploadId: mockUploadId,
			partId: 1,
			status: "uploaded",
			sizeBytes: 3,
			checksumSha3: "abc123",
			retries: 0,
			totalParts: 8,
			completedParts: 1,
			bytesReceived: 3,
			lastPartNumber: 1,
			resumeToken: null,
		};

		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce(jsonResponse(MOCK_ACTIVATION_RESPONSE))
			.mockResolvedValueOnce(jsonResponse(expectedPayload));

		const source = Buffer.from([0xde, 0xad, 0xbe]);

		const result = await client.uploadPart(mockUploadId, 1, source);
		expect(result).toEqual(expectedPayload);
		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
		const uploadCall = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(1);
		expect(uploadCall).toBeDefined();
		if (!uploadCall) throw new Error("fetch not invoked");
		const [, init] = uploadCall;
		expect(init?.method).toBe("PUT");
		expect(init?.headers).toMatchObject({
			"Content-Type": "application/octet-stream",
			Authorization: "Bearer upload-key",
		});
		expect(init?.body).toBeInstanceOf(ReadableStream);

		const bodyBuffer = await collectStream(init?.body as ReadableStream<Uint8Array>);
		expect(Array.from(bodyBuffer)).toEqual([0xde, 0xad, 0xbe]);
	});

	it("parses ranged download responses and surfaces stream metadata", async () => {
		const client = new StorageClient({
			baseUrl,
			apiKey: "test-api-key",
			tenantId: mockTenantId,
		});

		const payload = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array([1, 2, 3]));
				controller.close();
			},
		});

		const response = new Response(payload, {
			status: 206,
			headers: {
				"Content-Length": "3",
				"Content-Range": "bytes 0-2/10",
				"X-Checksum-Sha3": "sha3-test",
			},
		});

		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce(jsonResponse(MOCK_ACTIVATION_RESPONSE))
			.mockResolvedValueOnce(response);

		const result = await client.downloadStream(mockDocumentId, 2, {
			range: "bytes=0-2",
		});

		expect(globalThis.fetch).toHaveBeenCalledWith(
			`https://storage.qnsp.example/storage/v1/documents/${mockDocumentId}/versions/2/content?tenantId=${mockTenantId}&range=bytes%3D0-2`,
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({
					Range: "bytes=0-2",
				}),
			}),
		);

		expect(result.statusCode).toBe(206);
		expect(result.totalSize).toBe(10);
		expect(result.contentLength).toBe(3);
		expect(result.range).toEqual({ start: 0, end: 2 });
		expect(result.checksumSha3).toBe("sha3-test");

		const buffer = await collectStream(result.stream);
		expect(Array.from(buffer)).toEqual([1, 2, 3]);
	});

	it("records telemetry for successful requests", async () => {
		const telemetry = { record: vi.fn() };
		const client = new StorageClient({
			baseUrl,
			apiKey: "test-api-key",
			tenantId: mockTenantId,
			telemetry,
		});

		const statusResponse = {
			uploadId: mockUploadId2,
			documentId: mockDocumentId,
			tenantId: mockTenantId,
			status: "pending",
			chunkSizeBytes: 4,
			totalSizeBytes: 4,
			totalParts: 1,
			expiresAt: new Date().toISOString(),
			resumeToken: null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			retries: 0,
			bytesReceived: 0,
			lastPartNumber: 1,
		};

		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce(jsonResponse(MOCK_ACTIVATION_RESPONSE))
			.mockResolvedValueOnce(jsonResponse(statusResponse));

		await client.getUploadStatus(mockUploadId2);

		expect(telemetry.record).toHaveBeenCalled();
		const event = (telemetry.record as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
		expect(event).toBeDefined();
		expect(event).toMatchObject({
			operation: "getUploadStatus",
			method: "GET",
			status: "ok",
		});
	});

	it("records telemetry failures", async () => {
		const telemetry = { record: vi.fn() };
		const client = new StorageClient({
			baseUrl,
			apiKey: "test-api-key",
			tenantId: mockTenantId,
			telemetry,
		});

		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce(jsonResponse(MOCK_ACTIVATION_RESPONSE))
			.mockResolvedValueOnce(new Response("boom", { status: 500, statusText: "error" }));

		await expect(client.completeUpload(mockUploadIdErr)).rejects.toThrow(/Storage API error/);

		const event = (telemetry.record as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
		expect(event).toBeDefined();
		expect(event).toMatchObject({
			operation: "completeUpload",
			status: "error",
			httpStatus: 500,
		});
	});

	it("records bytes for upload parts", async () => {
		const telemetry = { record: vi.fn() };
		const client = new StorageClient({
			baseUrl,
			apiKey: "test-api-key",
			tenantId: mockTenantId,
			telemetry,
		});

		const expectedPayload = {
			uploadId: mockUploadId,
			partId: 1,
			status: "uploaded",
			sizeBytes: 3,
			checksumSha3: "abc123",
			retries: 0,
			totalParts: 8,
			completedParts: 1,
			bytesReceived: 3,
			lastPartNumber: 1,
			resumeToken: null,
		};

		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce(jsonResponse(MOCK_ACTIVATION_RESPONSE))
			.mockResolvedValueOnce(jsonResponse(expectedPayload));

		await client.uploadPart(mockUploadId, 1, Buffer.from([1, 2, 3]));

		const event = (telemetry.record as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
		expect(event).toBeDefined();
		expect(event).toMatchObject({
			operation: "uploadPart",
			bytesSent: 3,
			status: "ok",
		});
	});

	it("updates and fetches document policies with x-tenant-id header", async () => {
		const client = new StorageClient({
			baseUrl,
			apiKey: "key",
			tenantId: mockTenantId,
		});

		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
			// activation
			.mockResolvedValueOnce(jsonResponse(MOCK_ACTIVATION_RESPONSE))
			// PATCH response
			.mockResolvedValueOnce(
				jsonResponse({
					documentId: mockDocumentId,
					tenantId: mockTenantId,
					compliance: {
						retentionMode: "compliance",
						retainUntil: "2026-01-01T00:00:00Z",
						legalHolds: ["hold-1"],
						wormLockExpiresAt: null,
					},
				}),
			)
			// GET response
			.mockResolvedValueOnce(
				jsonResponse({
					documentId: mockDocumentId,
					tenantId: mockTenantId,
					compliance: {
						retentionMode: "compliance",
						retainUntil: "2026-01-01T00:00:00Z",
						legalHolds: ["hold-1"],
						wormLockExpiresAt: null,
					},
					lifecycle: {
						currentTier: "hot",
						targetTier: null,
						transitionAfter: null,
					},
				}),
			);

		const updated = await client.updateDocumentPolicies(mockDocumentId, {
			retentionMode: "compliance",
			retainUntil: "2026-01-01T00:00:00Z",
			legalHolds: ["hold-1"],
		});
		expect(updated.documentId).toBe(mockDocumentId);
		const patchCall = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock
			.calls[1] as unknown as [string, RequestInit];
		expect(patchCall[0]).toBe(
			`https://storage.qnsp.example/storage/v1/documents/${mockDocumentId}/policies`,
		);
		expect(patchCall[1]?.headers).toMatchObject({
			"Content-Type": "application/json",
			Authorization: "Bearer key",
			"x-tenant-id": mockTenantId,
		});

		const policies = await client.getDocumentPolicies(mockDocumentId);
		expect(policies.tenantId).toBe(mockTenantId);
		const getCall = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock
			.calls[2] as unknown as [string, RequestInit];
		expect(getCall[0]).toBe(
			`https://storage.qnsp.example/storage/v1/documents/${mockDocumentId}/policies`,
		);
		expect(getCall[1]?.headers).toMatchObject({
			"Content-Type": "application/json",
			Authorization: "Bearer key",
			"x-tenant-id": mockTenantId,
		});
	});

	it("applies and releases legal holds", async () => {
		const client = new StorageClient({
			baseUrl,
			apiKey: "key",
			tenantId: mockTenantId,
		});

		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
			// activation
			.mockResolvedValueOnce(jsonResponse(MOCK_ACTIVATION_RESPONSE))
			// apply
			.mockResolvedValueOnce(
				jsonResponse({
					documentId: mockDocumentId,
					tenantId: mockTenantId,
					legalHolds: ["hold-9"],
				}),
			)
			// release (204)
			.mockResolvedValueOnce(new Response(null, { status: 204 }));

		const applied = await client.applyLegalHold(mockDocumentId, { holdId: "hold-9" });
		expect(applied.legalHolds).toContain("hold-9");
		const postCall = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock
			.calls[1] as unknown as [string, RequestInit];
		expect(postCall[0]).toBe(
			`https://storage.qnsp.example/storage/v1/documents/${mockDocumentId}/legal-holds`,
		);
		expect(postCall[1]?.method).toBe("POST");
		expect(postCall[1]?.headers).toMatchObject({
			"x-tenant-id": mockTenantId,
		});

		await client.releaseLegalHold(mockDocumentId, "hold-9");
		const delCall = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock
			.calls[2] as unknown as [string, RequestInit];
		expect(delCall[0]).toBe(
			`https://storage.qnsp.example/storage/v1/documents/${mockDocumentId}/legal-holds/hold-9`,
		);
		expect(delCall[1]?.method).toBe("DELETE");
		expect(delCall[1]?.headers).toMatchObject({
			"x-tenant-id": mockTenantId,
		});
	});
});

describe("StorageEventsClient", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it("records telemetry when fetching events", async () => {
		const telemetry = { record: vi.fn() };
		const client = new StorageEventsClient({
			baseUrl,
			apiKey: "test-api-key",
			telemetry,
		});

		const eventPayload = [
			{
				topic: "storage.document.replicated",
				version: "1",
				payload: { documentId: "doc-1" },
				metadata: { timestamp: new Date().toISOString() },
			},
		];

		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
			jsonResponse(eventPayload, { headers: { "Content-Length": "256" } }),
		);

		const events = await client.fetchEvents("storage.document.replicated");
		expect(events).toHaveLength(1);

		const call = (telemetry.record as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
		expect(call).toBeDefined();
		expect(call).toMatchObject({
			operation: expect.stringContaining("fetchEvents"),
			status: "ok",
		});
	});
});
