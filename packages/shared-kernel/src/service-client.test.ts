/**
 * Unit tests for ServiceClient with circuit breakers
 */

import { CircuitBreaker, CircuitBreakerOpenError } from "@heossi/qnsi-resilience";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceClient, ServiceClientError } from "./service-client.js";

// Intercept fetch
global.fetch = vi.fn();

describe("ServiceClient", () => {
	let client: ServiceClient;
	const baseUrl = "http://localhost:3000";

	beforeEach(() => {
		client = new ServiceClient({
			baseUrl,
			timeout: 5000,
		});
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should make successful GET request", async () => {
		const mockData = { id: "1", name: "test" };
		(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ "content-type": "application/json" }),
			json: async () => mockData,
		});

		const result = await client.get("/api/test");
		expect(result).toEqual(mockData);
		expect(global.fetch).toHaveBeenCalled();
		const callArgs = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(callArgs).toBeDefined();
		expect(callArgs?.[0]?.toString()).toContain("/api/test");
		expect(callArgs?.[1]?.method).toBe("GET");
	});

	it("should make successful POST request", async () => {
		const requestBody = { name: "test" };
		const mockResponse = { id: "1", ...requestBody };
		(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ "content-type": "application/json" }),
			json: async () => mockResponse,
		});

		const result = await client.post("/api/test", requestBody);
		expect(result).toEqual(mockResponse);
		expect(global.fetch).toHaveBeenCalled();
		const callArgs = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(callArgs).toBeDefined();
		expect(callArgs?.[0]?.toString()).toContain("/api/test");
		expect(callArgs?.[1]?.method).toBe("POST");
	});

	it("returns text response when content-type is not JSON", async () => {
		(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ "content-type": "text/plain" }),
			text: async () => "hello",
		});

		const result = await client.get<string>("/api/text");
		expect(result).toBe("hello");
	});

	it("should throw ServiceClientError on HTTP error", async () => {
		(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			ok: false,
			status: 404,
			statusText: "Not Found",
			text: async () => "Resource not found",
		});

		await expect(client.get("/api/test")).rejects.toThrow(ServiceClientError);
	});

	it("should throw timeout error", async () => {
		const timeoutClient = new ServiceClient({
			baseUrl,
			timeout: 100, // Short timeout for test
		});

		(global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
			() => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 200)),
		);

		await expect(timeoutClient.get("/api/test")).rejects.toThrow(ServiceClientError);
	}, 10000);

	it("maps AbortError to TIMEOUT", async () => {
		const abortError = new Error("aborted");
		abortError.name = "AbortError";
		(global.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(abortError);

		await expect(client.get("/api/test")).rejects.toMatchObject({
			code: "TIMEOUT",
			statusCode: 504,
		});
	});

	it("maps circuit breaker open errors to a 503", async () => {
		const cb = {
			execute: vi.fn(async () => {
				throw new CircuitBreakerOpenError();
			}),
			getState: vi.fn(() => "open"),
		} as unknown as CircuitBreaker;

		const clientWithCB = new ServiceClient({ baseUrl, circuitBreaker: cb });
		await expect(clientWithCB.get("/api/test")).rejects.toMatchObject({
			code: "CIRCUIT_BREAKER_OPEN",
			statusCode: 503,
		});
	});

	it("supports put and delete helpers", async () => {
		(global.fetch as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce({
				ok: true,
				headers: new Headers({ "content-type": "application/json" }),
				json: async () => ({ ok: true }),
			})
			.mockResolvedValueOnce({
				ok: true,
				headers: new Headers({ "content-type": "application/json" }),
				json: async () => ({ ok: true }),
			});

		await client.put("/api/test", { a: 1 });
		await client.delete("/api/test");

		const calls = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
		expect(calls[0]?.[1]?.method).toBe("PUT");
		expect(calls[1]?.[1]?.method).toBe("DELETE");
	});

	it("should open circuit breaker after failures", async () => {
		const circuitBreaker = new CircuitBreaker({
			failureThreshold: 3,
			timeout: 1000,
			halfOpenMaxCalls: 2,
		});

		const clientWithCB = new ServiceClient({
			baseUrl,
			circuitBreaker,
		});

		// Trigger failures
		(global.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("Service unavailable"),
		);

		// Trigger failures
		for (let i = 0; i < 4; i++) {
			try {
				await clientWithCB.get("/api/test");
			} catch {
				// Expected
			}
		}

		// Circuit breaker should be open
		expect(clientWithCB.getCircuitBreakerState()).toBe("open");
	});

	it("should return circuit breaker state", () => {
		const state = client.getCircuitBreakerState();
		expect(["closed", "open", "half-open"]).toContain(state);
	});
});
