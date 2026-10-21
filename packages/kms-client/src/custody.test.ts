import { afterEach, expect, it, vi } from "vitest";
import { HttpKmsServiceClient } from "./index.js";
import { validateKeyCustodyResource } from "./validation.js";

const tenantId = "00000000-0000-4000-8000-000000000001";
const resource = {
	id: "00000000-0000-4000-8000-000000000002",
	tenantId,
	keyId: "owned/key?",
	exportable: false,
	custodyPolicy: {
		exportable: false,
		enforcement: "service",
		hardwareNonExportability: "not_verified",
		policyVersion: 1,
	},
	metadata: { exportable: true },
};
afterEach(() => vi.restoreAllMocks());
it("reads authoritative custody without substituting metadata and encodes key identifiers", async () => {
	const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(resource));
	const client = new HttpKmsServiceClient("https://owned-kms.test", {
		getAuthHeader: async () => "Bearer controlled-token",
	});
	expect(await client.getKey({ tenantId, keyId: resource.keyId })).toEqual(resource);
	expect(String(fetch.mock.calls[0]?.[0])).toBe(
		`https://owned-kms.test/kms/v1/keys/owned%2Fkey%3F?tenantId=${tenantId}`,
	);
	expect(fetch.mock.calls[0]?.[1]).toMatchObject({
		method: "GET",
		redirect: "error",
		cache: "no-store",
		headers: { authorization: "Bearer controlled-token" },
	});
});
it.each([
	{ ...resource, exportable: true },
	{ ...resource, custodyPolicy: undefined, metadata: { exportable: false } },
	{ ...resource, custodyPolicy: { ...resource.custodyPolicy, exportable: null } },
	{ ...resource, custodyPolicy: { ...resource.custodyPolicy, enforcement: "unverified" } },
	{ ...resource, custodyPolicy: { ...resource.custodyPolicy, policyVersion: null } },
	{
		...resource,
		custodyPolicy: { ...resource.custodyPolicy, hardwareNonExportability: "verified" },
	},
])("rejects unsupported/inconsistent custody responses (%#)", (value) => {
	expect(() => validateKeyCustodyResource(value)).toThrow(
		"KMS authoritative custody response unavailable or invalid",
	);
});
it("keeps legacy policy null rather than converting metadata into assurance", () => {
	expect(
		validateKeyCustodyResource({
			...resource,
			exportable: null,
			custodyPolicy: {
				exportable: null,
				enforcement: "unverified",
				hardwareNonExportability: "not_verified",
				policyVersion: null,
			},
		}).exportable,
	).toBeNull();
});
it.each([
	{ ...resource, keyId: "foreign" },
	{ ...resource, tenantId: resource.id },
])("rejects mismatched key identity (%#)", async (value) => {
	vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(value));
	await expect(
		new HttpKmsServiceClient("https://owned-kms.test", {
			getAuthHeader: async () => "Bearer controlled-token",
		}).getKey({
			tenantId,
			keyId: resource.keyId,
		}),
	).rejects.toThrow("KMS key identity mismatch");
});
it("sends no authorization header when the caller supplies no credential", async () => {
	const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(resource));
	const client = new HttpKmsServiceClient("https://owned-kms.test", {
		getAuthHeader: async () => undefined,
	});
	expect(await client.getKey({ tenantId, keyId: resource.keyId })).toEqual(resource);
	const init = fetch.mock.calls[0]?.[1] as { headers: Record<string, string> };
	expect(init.headers).toEqual({});
});
it("does not return key authority on upstream failure", async () => {
	vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));
	await expect(
		new HttpKmsServiceClient("https://owned-kms.test", {
			getAuthHeader: async () => "Bearer controlled-token",
		}).getKey({
			tenantId,
			keyId: resource.keyId,
		}),
	).rejects.toThrow("HTTP 503");
});
