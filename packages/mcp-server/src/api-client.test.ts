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

	it("supports POST, PATCH, and DELETE with explicit timeout configuration", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(() =>
				Promise.resolve(new Response(JSON.stringify({ saved: true }), { status: 200 })),
			);
		const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
		const client = new ApiClient({
			baseUrl: "https://api.example",
			apiKey: "key",
			tenantId: "tenant",
			timeoutMs: 321,
		});

		await client.post("/items", { value: 1 });
		await client.patch("/items/1", { value: 2 });
		await client.del("/items/1");

		expect(fetchSpy).toHaveBeenNthCalledWith(
			1,
			"https://api.example/items",
			expect.objectContaining({ method: "POST", body: JSON.stringify({ value: 1 }) }),
		);
		expect(fetchSpy).toHaveBeenNthCalledWith(
			2,
			"https://api.example/items/1",
			expect.objectContaining({ method: "PATCH", body: JSON.stringify({ value: 2 }) }),
		);
		expect(fetchSpy).toHaveBeenNthCalledWith(
			3,
			"https://api.example/items/1",
			expect.objectContaining({ method: "DELETE" }),
		);
		expect(fetchSpy.mock.calls[2]?.[1]).not.toHaveProperty("body");
		expect(timeoutSpy).toHaveBeenCalledTimes(3);
		expect(timeoutSpy).toHaveBeenCalledWith(321);
	});

	it("returns a successful non-JSON response as text", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("healthy", { status: 200 }));
		const client = new ApiClient({
			baseUrl: "https://api.example",
			apiKey: "key",
			tenantId: "tenant",
		});

		await expect(client.get<string>("/health")).resolves.toEqual({
			ok: true,
			status: 200,
			data: "healthy",
		});
	});

	it("throws an API error using a structured service message", async () => {
		const body = { message: "denied", reason: "policy" };
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify(body), { status: 403 }),
		);
		const client = new ApiClient({
			baseUrl: "https://api.example",
			apiKey: "key",
			tenantId: "tenant",
		});

		await expect(client.get("/protected")).rejects.toMatchObject({
			name: "QnspApiError",
			message: "denied",
			statusCode: 403,
			body,
		});
	});

	it("uses the HTTP status when an error body has no message", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("upstream unavailable", { status: 503 }),
		);
		const client = new ApiClient({
			baseUrl: "https://api.example",
			apiKey: "key",
			tenantId: "tenant",
		});

		await expect(client.post("/work")).rejects.toMatchObject({
			message: "HTTP 503",
			statusCode: 503,
			body: "upstream unavailable",
		});
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
