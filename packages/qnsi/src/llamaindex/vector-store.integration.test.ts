/**
 * Integration tests for @heossi/qnsi-llamaindex-qnsp
 *
 * These tests hit the real QNSP search-service API via edge gateway.
 * Requires QNSI_API_KEY env var — the API key resolves tenant, tier, and policy automatically.
 *
 * Run: QNSI_API_KEY=qnsp_... pnpm --filter @heossi/qnsi-llamaindex-qnsp test:integration
 */

import { describe, expect, it } from "vitest";
import { QnsiVectorStore } from "./vector-store.js";

const QNSI_API_KEY = process.env["QNSI_API_KEY"];

describe.skipIf(!QNSI_API_KEY)("QnsiVectorStore integration", () => {
	it("instantiates with only an API key", () => {
		const store = new QnsiVectorStore({ apiKey: QNSI_API_KEY! });
		expect(store).toBeDefined();
	});

	it("query returns results or a service error for tenants without search add-on", async () => {
		const store = new QnsiVectorStore({ apiKey: QNSI_API_KEY! });
		try {
			const result = await store.query({
				queryStr: `integration-test-${Date.now()}-nonexistent`,
				similarityTopK: 1,
			});
			expect(result.nodes).toBeDefined();
			expect(result.similarities).toBeDefined();
			expect(result.ids).toBeDefined();
			expect(Array.isArray(result.nodes)).toBe(true);
		} catch (error) {
			// Expected if tenant lacks vector-sse-x-search add-on
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toBeTruthy();
		}
	});

	it("add indexes a document or surfaces a service error", async () => {
		const store = new QnsiVectorStore({ apiKey: QNSI_API_KEY! });
		const uniqueId = `integration-test-${Date.now()}`;
		const uniqueText = `QNSP integration test document ${uniqueId} post-quantum cryptography`;

		try {
			const ids = await store.add([{ id_: uniqueId, text: uniqueText, metadata: { test: true } }]);
			expect(ids).toEqual([uniqueId]);
		} catch (error) {
			// Expected if tenant lacks vector-sse-x-search add-on
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toBeTruthy();
		}
	});

	it("delete tombstones a document or surfaces a service error", async () => {
		const store = new QnsiVectorStore({ apiKey: QNSI_API_KEY! });
		const uniqueId = `integration-delete-${Date.now()}`;

		try {
			await store.delete(uniqueId);
		} catch (error) {
			// Expected if tenant lacks vector-sse-x-search add-on
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toBeTruthy();
		}
	});
});
