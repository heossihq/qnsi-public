/**
 * QnsiVectorStore unit tests.
 *
 * Folded in from the former standalone `@heossi/qnsi-llamaindex-qnsp`; the
 * search-service HTTP is now inlined, so these tests mock `globalThis.fetch`
 * (the real seam) rather than the former `@heossi/qnsi-search-sdk` client.
 * Same behaviors asserted.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QnsiVectorStoreConfig } from "./vector-store.js";
import { QnsiVectorStore } from "./vector-store.js";

// ─── fetch test double ────────────────────────────────────────────────────────

function okResponse(): Response {
	return {
		ok: true,
		status: 200,
		statusText: "OK",
		headers: { get: () => null },
		text: async () => "",
		json: async () => ({}),
	} as unknown as Response;
}

function errResponse(status: number, statusText: string): Response {
	return {
		ok: false,
		status,
		statusText,
		headers: { get: () => null },
		text: async () => "",
		json: async () => ({}),
	} as unknown as Response;
}

function searchResponse(body: unknown): Response {
	return {
		ok: true,
		status: 200,
		statusText: "OK",
		headers: { get: () => null },
		text: async () => JSON.stringify(body),
		json: async () => body,
	} as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	fetchMock.mockResolvedValue(okResponse());
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function indexCalls(): Array<{ url: string; body: Record<string, unknown> }> {
	return fetchMock.mock.calls
		.filter(([url, init]) => String(url).includes("/documents/index") && init?.method === "POST")
		.map(([url, init]) => ({
			url: String(url),
			body: JSON.parse(String((init as RequestInit).body)) as Record<string, unknown>,
		}));
}

function searchCall(): string | undefined {
	const call = fetchMock.mock.calls.find(([url, init]) => {
		const u = String(url);
		return u.includes("/search/v1/documents?") && (init?.method ?? "GET") === "GET";
	});
	return call ? String(call[0]) : undefined;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_CONFIG: QnsiVectorStoreConfig = {
	apiKey: "qnsp_test_key",
	tenantId: "tenant-uuid-1234",
};

function makeStore(overrides?: Partial<QnsiVectorStoreConfig>): QnsiVectorStore {
	return new QnsiVectorStore({ ...BASE_CONFIG, ...overrides });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("QnsiVectorStore", () => {
	describe("add()", () => {
		it("returns empty array when given no nodes", async () => {
			const result = await makeStore().add([]);
			expect(result).toEqual([]);
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("indexes each node and returns their IDs", async () => {
			const result = await makeStore().add([
				{ id_: "node-1", text: "PQC overview", metadata: { source: "doc-a" } },
				{ id_: "node-2", text: "ML-KEM details", metadata: {} },
			]);

			expect(result).toEqual(["node-1", "node-2"]);
			const calls = indexCalls();
			expect(calls).toHaveLength(2);
			const first = calls.find((c) => c.body["documentId"] === "node-1");
			expect(first?.body).toMatchObject({
				tenantId: "tenant-uuid-1234",
				documentId: "node-1",
				body: "PQC overview",
				metadata: { source: "doc-a" },
				sourceService: "llamaindex-qnsp",
			});
		});

		it("uses custom sourceService when configured", async () => {
			await makeStore({ sourceService: "my-agent" }).add([{ id_: "n1", text: "hello" }]);
			expect(indexCalls()[0]?.body["sourceService"]).toBe("my-agent");
		});

		it("uses empty metadata when node has no metadata", async () => {
			await makeStore().add([{ id_: "n1", text: "text" }]);
			expect(indexCalls()[0]?.body["metadata"]).toEqual({});
		});

		it("propagates indexing errors", async () => {
			fetchMock.mockResolvedValueOnce(errResponse(503, "Service Unavailable"));
			await expect(makeStore().add([{ id_: "n1", text: "text" }])).rejects.toThrow(
				"Search API error: 503",
			);
		});
	});

	describe("query()", () => {
		it("returns empty result when queryStr is empty", async () => {
			const result = await makeStore().query({ queryStr: "" });
			expect(result).toEqual({ nodes: [], similarities: [], ids: [] });
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("returns empty result when queryStr is absent", async () => {
			const result = await makeStore().query({});
			expect(result).toEqual({ nodes: [], similarities: [], ids: [] });
		});

		it("maps search hits to nodes with correct shape", async () => {
			fetchMock.mockResolvedValueOnce(
				searchResponse({
					items: [
						{
							documentId: "doc-1",
							title: "PQC overview",
							description: null,
							metadata: { source: "manual" },
							score: 0.95,
							tags: [],
							version: "1",
							tenantId: "tenant-uuid-1234",
							updatedAt: "2026-04-07T00:00:00Z",
						},
						{
							documentId: "doc-2",
							title: null,
							description: null,
							metadata: {},
							score: 0.72,
							tags: [],
							version: "1",
							tenantId: "tenant-uuid-1234",
							updatedAt: "2026-04-07T00:00:00Z",
						},
					],
					nextCursor: null,
				}),
			);

			const result = await makeStore().query({
				queryStr: "quantum cryptography",
				similarityTopK: 5,
			});

			expect(result.ids).toEqual(["doc-1", "doc-2"]);
			expect(result.similarities).toEqual([0.95, 0.72]);
			expect(result.nodes[0]).toMatchObject({ id_: "doc-1", text: "PQC overview" });
			expect(result.nodes[1]).toMatchObject({ id_: "doc-2", text: "doc-2" });

			const url = searchCall();
			expect(url).toBeDefined();
			expect(url).toContain("tenantId=tenant-uuid-1234");
			expect(url).toContain("q=quantum+cryptography");
			expect(url).toContain("limit=5");
		});

		it("defaults similarityTopK to 10", async () => {
			fetchMock.mockResolvedValueOnce(searchResponse({ items: [], nextCursor: null }));
			await makeStore().query({ queryStr: "test" });
			expect(searchCall()).toContain("limit=10");
		});

		it("skips hits that fail schema validation", async () => {
			fetchMock.mockResolvedValueOnce(
				searchResponse({
					items: [
						{ documentId: "doc-1", title: "valid", description: null, metadata: {}, score: 0.9 },
						{ documentId: "doc-2", title: "bad", description: null, metadata: {} },
					],
					nextCursor: null,
				}),
			);
			const result = await makeStore().query({ queryStr: "test" });
			expect(result.ids).toEqual(["doc-1"]);
		});

		it("propagates search errors", async () => {
			fetchMock.mockResolvedValueOnce(errResponse(500, "Internal Server Error"));
			await expect(makeStore().query({ queryStr: "test" })).rejects.toThrow(
				"Search API error: 500",
			);
		});
	});

	describe("delete()", () => {
		it("tombstones the document by re-indexing with __deleted__ tag", async () => {
			await makeStore().delete("node-to-delete");
			const calls = indexCalls();
			expect(calls).toHaveLength(1);
			expect(calls[0]?.body).toMatchObject({
				tenantId: "tenant-uuid-1234",
				documentId: "node-to-delete",
				version: "deleted",
				body: null,
				tags: ["__deleted__"],
				metadata: expect.objectContaining({ deleted: true }),
			});
		});

		it("propagates delete errors", async () => {
			fetchMock.mockResolvedValueOnce(errResponse(500, "Internal Server Error"));
			await expect(makeStore().delete("n1")).rejects.toThrow("Search API error: 500");
		});
	});
});
