/**
 * Smoke tests for @heossihq/qnsi-llamaindex-qnsp
 *
 * Verifies that the package exports are importable and classes can be instantiated.
 * No API key or network access required - catches build regressions.
 *
 * Run: pnpm --filter @heossihq/qnsi-llamaindex-qnsp test
 */

import { describe, expect, it } from "vitest";
import { QnsiVectorStore } from "./vector-store.js";

describe("QnsiVectorStore smoke", () => {
	it("exports QnsiVectorStore class", () => {
		expect(QnsiVectorStore).toBeDefined();
		expect(typeof QnsiVectorStore).toBe("function");
	});

	it("constructs with only an API key", () => {
		const store = new QnsiVectorStore({ apiKey: "smoke-test-key" });
		expect(store).toBeInstanceOf(QnsiVectorStore);
	});

	it("constructs with full config", () => {
		const store = new QnsiVectorStore({
			apiKey: "smoke-test-key",
			tenantId: "tenant-123",
			sourceService: "my-agent",
			baseUrl: "http://localhost:3000",
			timeoutMs: 5_000,
		});
		expect(store).toBeInstanceOf(QnsiVectorStore);
	});

	it("add with empty array returns empty without network call", async () => {
		const store = new QnsiVectorStore({ apiKey: "smoke-test-key" });
		const result = await store.add([]);
		expect(result).toEqual([]);
	});

	it("query with empty string returns empty without network call", async () => {
		const store = new QnsiVectorStore({ apiKey: "smoke-test-key" });
		const result = await store.query({ queryStr: "" });
		expect(result).toEqual({ nodes: [], similarities: [], ids: [] });
	});

	it("query with no queryStr returns empty without network call", async () => {
		const store = new QnsiVectorStore({ apiKey: "smoke-test-key" });
		const result = await store.query({});
		expect(result).toEqual({ nodes: [], similarities: [], ids: [] });
	});

	it("has add, query, and delete methods", () => {
		const store = new QnsiVectorStore({ apiKey: "smoke-test-key" });
		expect(typeof store.add).toBe("function");
		expect(typeof store.query).toBe("function");
		expect(typeof store.delete).toBe("function");
	});
});
