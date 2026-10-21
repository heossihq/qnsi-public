import { readFileSync } from "node:fs";
import {
	resolveManifestExternalPath,
	SERVICE_PROXY_DESCRIPTORS,
} from "@heossihq/qnsi-enforcement-contract/service-proxy-descriptors";
import { describe, expect, it, vi } from "vitest";
import * as generatedClients from "./index.js";
import { QNSI_OPERATIONS } from "./operations.js";

interface InternalCall {
	method: string;
	path: string;
	body?: unknown;
	opts?: unknown;
}

type SurfaceClient = Record<string, (...args: unknown[]) => Promise<unknown>>;
type SurfaceClientConstructor = new (internal: {
	request(method: string, path: string, body?: unknown, opts?: unknown): Promise<unknown>;
}) => object;

describe("generated customer surface clients", () => {
	it("exposes pagination and idempotency options without changing path segments", async () => {
		const request = vi.fn(async () => ({ items: [] }));
		const kms = new generatedClients.KmsSurfaceClient({ request });
		const options = { query: { limit: 25, cursor: "next & page" }, idempotencyKey: "req-123" };
		await kms.getKeys(options);
		expect(request).toHaveBeenLastCalledWith("GET", "/proxy/kms/v1/keys", undefined, options);
		await kms.getKeysKeyId("key/?# &%", options);
		expect(request).toHaveBeenLastCalledWith(
			"GET",
			"/proxy/kms/v1/keys/key%2F%3F%23%20%26%25",
			undefined,
			options,
		);
		const body = { algorithm: "ml-dsa-65", keyId: "test-key", keyType: "data" };
		await kms.postKeys(body, options);
		expect(request).toHaveBeenLastCalledWith("POST", "/proxy/kms/v1/keys", body, options);
		await kms.deleteKeysKeyId("key/?# &%", options);
		expect(request).toHaveBeenLastCalledWith(
			"DELETE",
			"/proxy/kms/v1/keys/key%2F%3F%23%20%26%25",
			undefined,
			options,
		);
	});

	it("tags exactly the reviewed INTERNAL_ONLY_ROUTES methods as @internal operator-only", () => {
		const internalOnly: string[] = [];
		let documented = 0;
		for (const service of new Set(QNSI_OPERATIONS.map((operation) => operation.service))) {
			const source = readFileSync(new URL(`./${service}-client.ts`, import.meta.url), "utf8");
			for (const match of source.matchAll(/\/\*\*([\s\S]*?)\*\/\s*async (\w+)\(/g)) {
				const [, jsdoc = "", method = ""] = match;
				documented += 1;
				if (!jsdoc.includes("@internal")) {
					expect(jsdoc, `${service}.${method}`).not.toContain("allow-listed QNSI operator");
					continue;
				}
				expect(jsdoc, `${service}.${method}`).toContain(
					"Server rejects every caller that is not an allow-listed QNSI operator.",
				);
				internalOnly.push(`${service}.${method}`);
			}
		}
		expect(documented).toBe(QNSI_OPERATIONS.length);
		expect(internalOnly.sort()).toEqual([
			"kms-service.deleteInternalTenantTenantId",
			"kms-service.postDesignatedGrantsEnrollments",
			"kms-service.postDesignatedGrantsKeys",
		]);
	});

	it("delegates every generated route through its declared edge method and path", async () => {
		let executedMethods = 0;
		const manifestRoutes = SERVICE_PROXY_DESCRIPTORS.filter(
			(descriptor) => descriptor.manifestDirectory !== null,
		).flatMap((descriptor) => {
			const manifest = JSON.parse(
				readFileSync(
					new URL(
						`../../../../apps/${descriptor.manifestDirectory}/service.manifest.json`,
						import.meta.url,
					),
					"utf8",
				),
			) as { routes: Array<{ method: string; path: string }> };
			return manifest.routes.map((route) => {
				let index = 0;
				return `${route.method} ${resolveManifestExternalPath(descriptor, route.path).replace(/:[A-Za-z0-9_]+/g, () => encodeURIComponent(`segment-${index++}/?#`))}`;
			});
		});

		for (const [clientName, Client] of Object.entries(generatedClients).filter(([name]) =>
			name.endsWith("SurfaceClient"),
		) as unknown as Array<[string, SurfaceClientConstructor]>) {
			const request = vi.fn(
				async (method: string, path: string, body?: unknown, opts?: unknown) => ({
					method,
					path,
					body,
					opts,
				}),
			);
			const client = new Client({ request }) as SurfaceClient;
			const methods = Object.getOwnPropertyNames(Client.prototype).filter(
				(name) => name !== "constructor",
			);
			expect(methods.length, clientName).toBeGreaterThan(0);

			for (const methodName of methods) {
				request.mockClear();
				const routeMethod = client[methodName];
				if (!routeMethod) throw new Error(`${clientName}.${methodName} is not callable`);
				const verb = methodName.match(/^(get|post|put|patch|delete)/i)?.[1]?.toUpperCase();
				const hasBody = verb !== "GET" && verb !== "DELETE";
				const paramCount = routeMethod.length - (hasBody ? 2 : 1);
				const params = Array.from({ length: paramCount }, (_, index) => `segment-${index}/?#`);
				const body = { tenantId: "tenant", payload: "request" };
				const opts = { query: { limit: 10, cursor: "next & page" }, idempotencyKey: "req-1" };
				const args = [...params, ...(hasBody ? [body] : []), opts];
				const result = (await routeMethod.apply(client, args)) as InternalCall;

				expect(verb, `${clientName}.${methodName}`).toBeDefined();
				expect(request, `${clientName}.${methodName}`).toHaveBeenCalledOnce();
				expect(result.method, `${clientName}.${methodName}`).toBe(verb);
				expect(result.path, `${clientName}.${methodName}`).toMatch(/^\/proxy\/[a-z-]+\//);
				expect(result.path, `${clientName}.${methodName}`).not.toContain("undefined");
				expect(manifestRoutes, `${clientName}.${methodName}`).toContain(
					`${result.method} ${result.path}`,
				);
				expect(result.body).toEqual(hasBody ? body : undefined);
				expect(result.opts).toBe(opts);
				for (let index = 0; index < paramCount; index += 1) {
					expect(result.path, `${clientName}.${methodName} argument ${index}`).toContain(
						encodeURIComponent(`segment-${index}/?#`),
					);
				}
				executedMethods += 1;
			}
		}

		expect(executedMethods).toBeGreaterThan(800);
		expect(QNSI_OPERATIONS).toHaveLength(executedMethods);
		expect(new Set(QNSI_OPERATIONS.map((operation) => operation.id)).size).toBe(executedMethods);
		for (const operation of QNSI_OPERATIONS) {
			let index = 0;
			const path = operation.path.replace(/:[A-Za-z0-9_]+/g, () =>
				encodeURIComponent(`segment-${index++}/?#`),
			);
			expect(manifestRoutes).toContain(`${operation.method} ${path}`);
			expect(operation.pathParameters).toEqual(
				[...operation.path.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => match[1]),
			);
		}
	});
});
