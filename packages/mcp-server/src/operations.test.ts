import { QNSI_OPERATIONS } from "@heossihq/qnsi";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./api-client.js";
import type { TierGate } from "./session.js";
import {
	callOperation,
	callOperationSchema,
	listOperations,
	listOperationsSchema,
} from "./tools.js";

afterEach(() => vi.restoreAllMocks());
const ctx = {
	api: new ApiClient({ baseUrl: "https://api.test", apiKey: "test-key", tenantId: "tenant-1" }),
	gate: { tenantId: "tenant-1" } as TierGate,
};
const data = (result: Awaited<ReturnType<typeof listOperations>>) =>
	JSON.parse(result.content[0]?.text as string);

describe("manifest-declared MCP operations", () => {
	it("supports paginated discovery, exact service filters, and case-insensitive searches", async () => {
		const first = data(await listOperations({}));
		expect(first.total).toBe(QNSI_OPERATIONS.length);
		expect(first.operations).toHaveLength(50);
		expect(first.nextOffset).toBe(50);
		const filtered = data(
			await listOperations({ service: "kms-service", search: "EXPORT", limit: 100, offset: 0 }),
		);
		expect(
			filtered.operations.some(
				(operation: { id: string }) => operation.id === "kms-service.postKeysKeyIdExport",
			),
		).toBe(true);
		expect(filtered.nextOffset).toBeNull();
		expect(data(await listOperations({ service: "unknown" })).total).toBe(0);
		expect(
			data(await listOperations({ offset: QNSI_OPERATIONS.length, search: "" })).operations,
		).toEqual([]);
		expect(() => listOperationsSchema.parse({ limit: 101 })).toThrow();
		expect(() => listOperationsSchema.parse({ offset: -1 })).toThrow();
	});

	it("does not issue HTTP requests for unknown operations or missing/additional parameters", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch");
		for (const input of [
			{ operationId: "does-not-exist" },
			{ operationId: "kms-service.getKeysKeyId" },
			{ operationId: "kms-service.getKeysKeyId", pathParameters: { keyId: "." } },
			{ operationId: "kms-service.getKeysKeyId", pathParameters: { keyId: ".." } },
			{ operationId: "kms-service.getKeys", pathParameters: { extra: "value" } },
		])
			expect((await callOperation(ctx, input)).isError).toBe(true);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(() =>
			callOperationSchema.parse({ operationId: "x", pathParameters: { keyId: "" } }),
		).toThrow();
	});

	it("executes every catalog operation through its declared verb, encoded path, and tenant-bound HTTP client", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async () => new Response("{}"));
		for (const operation of QNSI_OPERATIONS) {
			fetchMock.mockClear();
			const params = Object.fromEntries(
				operation.pathParameters.map((name) => [name, `${name}/?# &%`]),
			);
			await callOperation(ctx, {
				operationId: operation.id,
				pathParameters: params,
				body: { data: "aGVsbG8=" },
				query: { limit: 5, version: 2 },
				idempotencyKey: "request-1",
			});
			const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit];
			const url = new URL(target);
			expect(url.pathname).toBe(
				operation.path.replace(/:([A-Za-z0-9_]+)/g, (_match, name: string) =>
					encodeURIComponent(params[name] as string),
				),
			);
			expect(init.method).toBe(operation.method);
			expect(url.searchParams.get("tenantId")).toBe("tenant-1");
			expect(url.searchParams.get("limit")).toBe("5");
			expect((init.headers as Record<string, string>)["idempotency-key"]).toBe("request-1");
			if (operation.method !== "GET")
				expect(JSON.parse(init.body as string)).toEqual({ tenantId: "tenant-1", data: "aGVsbG8=" });
			else expect(init.body).toBeUndefined();
		}
	});

	it("preserves absent, null, array, primitive, and caller-supplied object bodies for backend validation", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async () => new Response("{}"));
		for (const body of [undefined, null, [], "payload", { tenantId: "caller-tenant" }]) {
			await callOperation(ctx, { operationId: "kms-service.postKeys", body });
			const init = fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
			expect(init.body).toBe(body === undefined ? undefined : JSON.stringify(body));
		}
	});
});
