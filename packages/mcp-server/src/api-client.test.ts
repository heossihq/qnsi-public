import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, QnsiApiError } from "./api-client.js";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("ApiClient", () => {
	it("preserves encoded query values, idempotency, DELETE bodies, and refuses redirects", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
		const client = new ApiClient({
			baseUrl: "https://api.example",
			apiKey: "key",
			tenantId: "tenant",
		});
		await client.del(
			"/proxy/kms/v2/recovery/requests?existing=keep",
			{ reason: "approved" },
			{
				query: { cursor: "next & # page", limit: 5, enabled: false, absent: undefined },
				idempotencyKey: "req-1",
			},
		);
		const [target, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		const url = new URL(target);
		expect(url.searchParams.get("cursor")).toBe("next & # page");
		expect(url.searchParams.get("existing")).toBe("keep");
		expect(url.searchParams.get("limit")).toBe("5");
		expect(url.searchParams.get("enabled")).toBe("false");
		expect(url.searchParams.has("absent")).toBe(false);
		expect(init.redirect).toBe("error");
		expect((init.headers as Record<string, string>)["idempotency-key"]).toBe("req-1");
		expect(JSON.parse(init.body as string)).toEqual({ reason: "approved" });
	});
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

	it("supports POST, PUT, PATCH, and DELETE with explicit timeout configuration", async () => {
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
		await client.put("/items/1", { value: 2 });
		await client.patch("/items/1", { value: 3 });
		await client.del("/items/1");

		expect(fetchSpy).toHaveBeenNthCalledWith(
			1,
			"https://api.example/items",
			expect.objectContaining({ method: "POST", body: JSON.stringify({ value: 1 }) }),
		);
		expect(fetchSpy).toHaveBeenNthCalledWith(
			2,
			"https://api.example/items/1",
			expect.objectContaining({ method: "PUT", body: JSON.stringify({ value: 2 }) }),
		);
		expect(fetchSpy).toHaveBeenNthCalledWith(
			3,
			"https://api.example/items/1",
			expect.objectContaining({ method: "PATCH", body: JSON.stringify({ value: 3 }) }),
		);
		expect(fetchSpy).toHaveBeenNthCalledWith(
			4,
			"https://api.example/items/1",
			expect.objectContaining({ method: "DELETE" }),
		);
		expect(fetchSpy.mock.calls[3]?.[1]).not.toHaveProperty("body");
		expect(timeoutSpy).toHaveBeenCalledTimes(4);
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
			name: "QnsiApiError",
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

describe("QnsiApiError", () => {
	it("captures status code and body", () => {
		const error = new QnsiApiError("Not found", 404, { message: "Not found" });
		expect(error.statusCode).toBe(404);
		expect(error.body).toEqual({ message: "Not found" });
		expect(error.name).toBe("QnsiApiError");
		expect(error.message).toBe("Not found");
	});
});
