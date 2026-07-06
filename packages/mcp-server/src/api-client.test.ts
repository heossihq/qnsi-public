import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, QnspApiError } from "./api-client.js";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("ApiClient", () => {
	it("constructs with required config", () => {
		const client = new ApiClient({
			baseUrl: "https://api.qnsi.heossi.com",
			apiKey: "test-key",
			tenantId: "test-tenant",
		});
		expect(client).toBeDefined();
	});

	it("strips trailing slash from baseUrl", () => {
		const client = new ApiClient({
			baseUrl: "https://api.qnsi.heossi.com/",
			apiKey: "test-key",
			tenantId: "test-tenant",
		});
		expect(client).toBeDefined();
	});

	it("sends canonical and legacy tenant headers on requests", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		const client = new ApiClient({
			baseUrl: "https://api.qnsi.heossi.com/",
			apiKey: "test-key",
			tenantId: "tenant-123",
		});

		await client.get("/proxy/test");

		const [, init] = fetchSpy.mock.calls[0] ?? [];
		const headers = (init?.headers ?? {}) as Record<string, string>;
		expect(headers["x-qnsp-tenant"]).toBe("tenant-123");
		expect(headers["x-qnsp-tenant-id"]).toBe("tenant-123");
		expect(headers["x-tenant-id"]).toBe("tenant-123");
	});
});

describe("QnspApiError", () => {
	it("captures status code and body", () => {
		const error = new QnspApiError("Not found", 404, { message: "Not found" });
		expect(error.statusCode).toBe(404);
		expect(error.body).toEqual({ message: "Not found" });
		expect(error.name).toBe("QnspApiError");
		expect(error.message).toBe("Not found");
	});
});
